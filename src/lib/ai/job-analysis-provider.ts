import { buildJobAnalysisMessages } from "@/lib/ai/job-analysis-prompt";
import { buildResumeProfileMessages } from "@/lib/ai/resume-profile-prompt";
import { normalizeCandidateProfile } from "@/lib/candidate-profile";
import { clampScore } from "@/lib/utils";
import {
  APPLICATION_RECOMMENDATIONS,
  ApplicationRecommendation,
  CandidateProfile,
  CONFIDENCE_LEVELS,
  ConfidenceLevel,
  JobAnalysis,
  MATCH_SCORE_DIMENSIONS,
  MatchScoreBreakdown,
  MissingSkillDetail,
  NEXT_ACTIONS,
  NextActionLabel,
  PRIORITY_LEVELS,
  PriorityLevel,
  RecommendedNextAction,
  ResumeProfileAnalysis,
  ScoreDimension,
  WORK_MODES,
  WorkMode
} from "@/types/job";

type AnalyzeJobInput = {
  rawJd: string;
  sourceUrl?: string;
  candidateProfile?: string;
};

type AnalyzeResumeProfileInput = {
  resumeText: string;
  currentProfile?: CandidateProfile;
};

export interface AiProvider {
  analyzeJob(input: AnalyzeJobInput): Promise<JobAnalysis>;
  analyzeResumeProfile(
    input: AnalyzeResumeProfileInput
  ): Promise<ResumeProfileAnalysis>;
}

type ProviderConfig = {
  apiKey?: string;
  apiKeyEnvName: string;
  endpoint: string;
  maxTokensField: "max_completion_tokens" | "max_tokens";
  model: string;
  providerName: string;
};

type ProviderConfigOptions = {
  useAdminConfig?: boolean;
};

export function getAiProviderConfigStatus(options: ProviderConfigOptions = {}) {
  try {
    const config = getProviderConfig(options);
    return {
      configured: isConfiguredApiKey(config.apiKey),
      provider: config.providerName,
      apiKeyEnvName: config.apiKeyEnvName
    };
  } catch {
    return {
      configured: false,
      provider: getProviderName(options.useAdminConfig)
    };
  }
}

export function getAiProvider(options: ProviderConfigOptions = {}): AiProvider {
  return new ChatCompletionsJobAnalysisProvider(getProviderConfig(options));
}

function getProviderConfig(options: ProviderConfigOptions = {}): ProviderConfig {
  const provider = getProviderName(options.useAdminConfig);

  switch (provider.toLowerCase()) {
    case "openai":
      return {
        apiKey: getApiKey("openai", options.useAdminConfig),
        apiKeyEnvName: getApiKeyEnvName("openai", options.useAdminConfig),
        endpoint: "https://api.openai.com/v1/chat/completions",
        maxTokensField: "max_completion_tokens",
        model: getModel("gpt-5-mini", options.useAdminConfig),
        providerName: "OpenAI"
      };
    case "deepseek":
      return {
        apiKey: getApiKey("deepseek", options.useAdminConfig),
        apiKeyEnvName: getApiKeyEnvName("deepseek", options.useAdminConfig),
        endpoint: "https://api.deepseek.com/chat/completions",
        maxTokensField: "max_tokens",
        model: getModel("deepseek-v4-flash", options.useAdminConfig),
        providerName: "DeepSeek"
      };
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }
}

function getProviderName(useAdminConfig?: boolean) {
  return (
    (useAdminConfig ? process.env.ADMIN_AI_PROVIDER : undefined) ||
    process.env.AI_PROVIDER ||
    "openai"
  );
}

function getModel(defaultModel: string, useAdminConfig?: boolean) {
  return (
    (useAdminConfig ? process.env.ADMIN_AI_MODEL : undefined) ||
    process.env.AI_MODEL ||
    defaultModel
  );
}

function getApiKey(provider: "openai" | "deepseek", useAdminConfig?: boolean) {
  if (provider === "openai") {
    return (
      (useAdminConfig ? process.env.ADMIN_OPENAI_API_KEY : undefined) ||
      process.env.OPENAI_API_KEY
    );
  }
  return (
    (useAdminConfig ? process.env.ADMIN_DEEPSEEK_API_KEY : undefined) ||
    process.env.DEEPSEEK_API_KEY
  );
}

function getApiKeyEnvName(
  provider: "openai" | "deepseek",
  useAdminConfig?: boolean
) {
  if (provider === "openai") {
    return useAdminConfig && process.env.ADMIN_OPENAI_API_KEY
      ? "ADMIN_OPENAI_API_KEY"
      : "OPENAI_API_KEY";
  }
  return useAdminConfig && process.env.ADMIN_DEEPSEEK_API_KEY
    ? "ADMIN_DEEPSEEK_API_KEY"
    : "DEEPSEEK_API_KEY";
}

/** Collect full content from SSE streaming response */
async function collectStreamContent(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body not readable");

  const decoder = new TextDecoder();
  let content = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) content += delta;
      } catch {
        // skip malformed chunks
      }
    }
  }

  return content;
}

class ChatCompletionsJobAnalysisProvider implements AiProvider {
  constructor(private readonly config: ProviderConfig) {}

  async analyzeJob(input: AnalyzeJobInput): Promise<JobAnalysis> {
    if (!isConfiguredApiKey(this.config.apiKey)) {
      throw new Error(`${this.config.apiKeyEnvName} is not configured.`);
    }

    const messages = buildJobAnalysisMessages(input);
    const body = {
      model: this.config.model,
      messages,
      stream: true,
      [this.config.maxTokensField]: 2400
    };

    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(
        err.error?.message || `${this.config.providerName} returned ${response.status}`
      );
    }

    const content = await collectStreamContent(response);
    if (!content) throw new Error("AI returned empty content");
    return normalizeJobAnalysis(parseJsonContent(content));
  }

  async analyzeResumeProfile(
    input: AnalyzeResumeProfileInput
  ): Promise<ResumeProfileAnalysis> {
    if (!isConfiguredApiKey(this.config.apiKey)) {
      throw new Error(`${this.config.apiKeyEnvName} is not configured.`);
    }

    const messages = buildResumeProfileMessages(input);
    const body = {
      model: this.config.model,
      messages,
      stream: true,
      [this.config.maxTokensField]: 1800
    };

    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(
        err.error?.message || `${this.config.providerName} returned ${response.status}`
      );
    }

    const content = await collectStreamContent(response);
    if (!content) throw new Error("AI returned empty content");
    return normalizeResumeProfileAnalysis(parseJsonContent(content));
  }
}

function isConfiguredApiKey(apiKey: string | undefined) {
  if (!apiKey?.trim()) return false;
  const normalized = apiKey.trim().toLowerCase();
  return ![
    "replace_with_a_new_deepseek_key",
    "your_deepseek_api_key_here",
    "your_openai_api_key_here"
  ].includes(normalized);
}

function parseJsonContent(content: string) {
  let trimmed = content.trim();

  // Remove markdown code fences
  trimmed = trimmed.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```$/i, "").trim();

  // Extract first {...} block
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    trimmed = trimmed.slice(braceStart, braceEnd + 1);
  }

  // Try direct parse
  try {
    return JSON.parse(trimmed);
  } catch (_firstError) {
    // Attempt repairs common in LLM JSON output
    try {
      return JSON.parse(repairLlmJson(trimmed));
    } catch {
      // Log the raw content for debugging, then throw original error
      console.error(
        "[parseJsonContent] Failed to parse AI response. First 500 chars:",
        trimmed.slice(0, 500)
      );
      console.error(
        "[parseJsonContent] Last 300 chars:",
        trimmed.slice(-300)
      );
      throw new Error(
        `AI returned invalid JSON at position approximately ${Math.max(0, _firstError instanceof SyntaxError ? parseInt(String(_firstError.message).match(/position (\d+)/)?.[1] ?? "0") : 0)}: ${_firstError instanceof Error ? _firstError.message : "Unknown parse error"}`
      );
    }
  }
}

/**
 * Character-by-character JSON repair for LLM outputs.
 * Handles: bare newlines in strings, unescaped quotes in strings,
 * trailing commas, and missing closing brackets.
 */
function repairLlmJson(json: string): string {
  let result = "";
  let inString = false;
  let escapeNext = false;
  const len = json.length;

  for (let i = 0; i < len; i++) {
    const ch = json[i];

    if (inString) {
      if (escapeNext) {
        result += ch;
        escapeNext = false;
        continue;
      }

      if (ch === "\\") {
        result += ch;
        escapeNext = true;
        continue;
      }

      if (ch === '"') {
        // Check if this " closes the string or is an unescaped interior quote
        // Heuristic: peek ahead. If the next non-whitespace char is : , } or ],
        // this is likely the closing quote of a key or value.
        // Otherwise, it's an unescaped interior quote → escape it.
        const peekStart = i + 1;
        let peek = peekStart;
        // Skip whitespace after the quote
        while (peek < len && (json[peek] === " " || json[peek] === "\t" || json[peek] === "\n" || json[peek] === "\r")) {
          peek++;
        }
        const nextChar = peek < len ? json[peek] : "";
        if (nextChar === ":" || nextChar === "," || nextChar === "}" || nextChar === "]" || peek >= len) {
          // Likely a valid closing quote
          result += ch;
          inString = false;
        } else {
          // Unescaped interior quote → escape it
          result += '\\"';
        }
        continue;
      }

      // Raw newline inside string → escape it
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }

      result += ch;
      continue;
    }

    // Outside string
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }

    result += ch;
  }

  // If we're still inside a string at EOF, close it
  if (inString) {
    result += '"';
  }

  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([}\]])/g, "$1");

  // Balance brackets: add missing } or ] at the end
  let braceDepth = 0;
  let bracketDepth = 0;
  for (const ch of result) {
    if (ch === "{") braceDepth++;
    if (ch === "}") braceDepth--;
    if (ch === "[") bracketDepth++;
    if (ch === "]") bracketDepth--;
  }
  while (braceDepth > 0) { result += "}"; braceDepth--; }
  while (bracketDepth > 0) { result += "]"; bracketDepth--; }

  return result;
}

function normalizeJobAnalysis(value: Partial<JobAnalysis>): JobAnalysis {
  const matchScore = clampScore(value.match_score);
  const skills = asStringArray(value.skills);
  const tools = asStringArray(value.tools);

  return {
    company: asString(value.company, "Not specified"),
    job_title_original: asString(value.job_title_original, "Not specified"),
    job_title_zh: asString(value.job_title_zh, "Not specified"),
    job_title_en: asString(value.job_title_en, "Not specified"),
    location: asString(value.location, "Not specified"),
    work_mode: asWorkMode(value.work_mode),
    job_type_en: asString(value.job_type_en, "Not specified"),
    job_type_zh: asString(value.job_type_zh, "Not specified"),
    education_requirement_en: asString(value.education_requirement_en, "Not specified"),
    education_requirement_zh: asString(value.education_requirement_zh, "Not specified"),
    experience_requirement_en: asString(value.experience_requirement_en, "Not specified"),
    experience_requirement_zh: asString(value.experience_requirement_zh, "Not specified"),
    skills,
    tools,
    responsibilities_en: asStringArray(value.responsibilities_en),
    responsibilities_zh: asStringArray(value.responsibilities_zh),
    requirements_en: asStringArray(value.requirements_en),
    requirements_zh: asStringArray(value.requirements_zh),
    nice_to_have_en: asStringArray(value.nice_to_have_en),
    nice_to_have_zh: asStringArray(value.nice_to_have_zh),
    match_score: matchScore,
    match_score_breakdown: normalizeMatchScoreBreakdown(value.match_score_breakdown, matchScore),
    key_strengths_en: asStringArray(value.key_strengths_en),
    key_strengths_zh: asStringArray(value.key_strengths_zh),
    main_gaps_en: asStringArray(value.main_gaps_en),
    main_gaps_zh: asStringArray(value.main_gaps_zh),
    application_recommendation: asApplicationRecommendation(value.application_recommendation, matchScore),
    recommended_next_action: normalizeNextAction(value.recommended_next_action, matchScore),
    red_flags_en: asStringArray(value.red_flags_en),
    red_flags_zh: asStringArray(value.red_flags_zh),
    positive_signals_en: asStringArray(value.positive_signals_en),
    positive_signals_zh: asStringArray(value.positive_signals_zh),
    assumptions_en: asStringArray(value.assumptions_en),
    assumptions_zh: asStringArray(value.assumptions_zh),
    missing_information_en: asStringArray(value.missing_information_en),
    missing_information_zh: asStringArray(value.missing_information_zh),
    resume_tailoring_advice_en: asStringArray(value.resume_tailoring_advice_en),
    resume_tailoring_advice_zh: asStringArray(value.resume_tailoring_advice_zh),
    skills_to_improve_en: asStringArray(value.skills_to_improve_en),
    skills_to_improve_zh: asStringArray(value.skills_to_improve_zh),
    matched_skills: asStringArray(value.matched_skills, skills),
    missing_skills: asStringArray(value.missing_skills),
    missing_skill_details: normalizeMissingSkillDetails(value.missing_skill_details),
    important_tools: asStringArray(value.important_tools, tools),
    suggested_learning_actions_en: asStringArray(value.suggested_learning_actions_en),
    suggested_learning_actions_zh: asStringArray(value.suggested_learning_actions_zh),
    ai_summary_en: asString(value.ai_summary_en, "Not specified"),
    ai_summary_zh: asString(value.ai_summary_zh, "Not specified"),
    resume_keywords: asStringArray(value.resume_keywords)
  };
}

function normalizeResumeProfileAnalysis(value: Partial<ResumeProfileAnalysis>): ResumeProfileAnalysis {
  return {
    candidate_profile: normalizeCandidateProfile(value.candidate_profile),
    profile_summary_en: asString(value.profile_summary_en, "Not specified"),
    profile_summary_zh: asString(value.profile_summary_zh, "未注明"),
    extracted_strengths: asStringArray(value.extracted_strengths),
    missing_or_unclear_information: asStringArray(value.missing_or_unclear_information),
    confidence: asConfidenceLevel(value.confidence)
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => (typeof item === "string" ? item.trim() : String(item))).filter(Boolean);
}

function asWorkMode(value: unknown): WorkMode {
  const text = asString(value, "Not specified");
  return WORK_MODES.includes(text as WorkMode) ? (text as WorkMode) : "Not specified";
}

function normalizeMatchScoreBreakdown(value: unknown, fallbackScore: number): MatchScoreBreakdown {
  const source = isRecord(value) ? value : {};
  return MATCH_SCORE_DIMENSIONS.reduce((breakdown, key) => {
    breakdown[key] = normalizeScoreDimension(source[key], fallbackScore);
    return breakdown;
  }, {} as MatchScoreBreakdown);
}

function normalizeScoreDimension(value: unknown, fallbackScore: number): ScoreDimension {
  const source = isRecord(value) ? value : {};
  return {
    score: clampScore(source.score ?? fallbackScore),
    explanation_en: asString(source.explanation_en, "Not specified"),
    explanation_zh: asString(source.explanation_zh, "未注明"),
    evidence_from_jd: asString(source.evidence_from_jd, "Not specified"),
    candidate_gap_en: asString(source.candidate_gap_en, "Not specified"),
    candidate_gap_zh: asString(source.candidate_gap_zh, "未注明"),
    confidence: asConfidenceLevel(source.confidence)
  };
}

function asApplicationRecommendation(value: unknown, matchScore: number): ApplicationRecommendation {
  const text = asString(value, "");
  if (APPLICATION_RECOMMENDATIONS.includes(text as ApplicationRecommendation)) return text as ApplicationRecommendation;
  if (matchScore >= 85) return "Strongly apply";
  if (matchScore >= 65) return "Worth trying";
  if (matchScore >= 45) return "Low priority";
  return "Not recommended";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNextAction(value: unknown, matchScore: number): RecommendedNextAction {
  const source = isRecord(value) ? value : {};
  return {
    action: asNextAction(source.action, matchScore),
    reason_en: asString(source.reason_en, defaultNextActionReason(matchScore, "en")),
    reason_zh: asString(source.reason_zh, defaultNextActionReason(matchScore, "zh")),
    urgency: asPriorityLevel(source.urgency, matchScore >= 80 ? "High" : "Medium"),
    suggested_deadline: asString(source.suggested_deadline, matchScore >= 80 ? "Within 3 days" : "This week"),
    resume_focus_points: asStringArray(source.resume_focus_points)
  };
}

function normalizeMissingSkillDetails(value: unknown): MissingSkillDetail[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      skill: asString(item.skill, "Not specified"),
      priority: asPriorityLevel(item.priority),
      why_it_matters_en: asString(item.why_it_matters_en, "Not specified"),
      why_it_matters_zh: asString(item.why_it_matters_zh, "未注明"),
      impact_on_match_score: asString(item.impact_on_match_score, "Not specified"),
      suggested_resource_type: asString(item.suggested_resource_type, "practice task")
    }))
    .filter((item) => item.skill !== "Not specified");
}

function asNextAction(value: unknown, matchScore: number): NextActionLabel {
  const text = asString(value, "");
  if (NEXT_ACTIONS.includes(text as NextActionLabel)) return text as NextActionLabel;
  if (matchScore >= 85) return "Apply now";
  if (matchScore >= 65) return "Tailor resume first";
  if (matchScore >= 45) return "Save for later";
  return "Skip";
}

function asPriorityLevel(value: unknown, fallback: PriorityLevel = "Medium") {
  const text = asString(value, "");
  return PRIORITY_LEVELS.includes(text as PriorityLevel) ? (text as PriorityLevel) : fallback;
}

function asConfidenceLevel(value: unknown): ConfidenceLevel {
  const text = asString(value, "");
  return CONFIDENCE_LEVELS.includes(text as ConfidenceLevel) ? (text as ConfidenceLevel) : "Medium";
}

function defaultNextActionReason(matchScore: number, language: "en" | "zh") {
  if (language === "zh") {
    if (matchScore >= 85) return "匹配度高，建议尽快申请。";
    if (matchScore >= 65) return "岗位值得尝试，但建议先优化简历。";
    return "匹配度有限，建议先补强关键差距。";
  }
  if (matchScore >= 85) return "The role is a strong fit, so apply promptly.";
  if (matchScore >= 65) return "The role is worth trying after tailoring the resume.";
  return "The fit is limited, so address the main gaps first.";
}
