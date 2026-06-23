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

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
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

export function getAiProviderConfigStatus() {
  try {
    const config = getProviderConfig();

    return {
      configured: isConfiguredApiKey(config.apiKey),
      provider: config.providerName,
      apiKeyEnvName: config.apiKeyEnvName
    };
  } catch {
    return {
      configured: false,
      provider: process.env.AI_PROVIDER || "openai"
    };
  }
}

export function getAiProvider(): AiProvider {
  return new ChatCompletionsJobAnalysisProvider(getProviderConfig());
}

function getProviderConfig(): ProviderConfig {
  const provider = process.env.AI_PROVIDER || "openai";

  switch (provider.toLowerCase()) {
    case "openai":
      return {
        apiKey: process.env.OPENAI_API_KEY,
        apiKeyEnvName: "OPENAI_API_KEY",
        endpoint: "https://api.openai.com/v1/chat/completions",
        maxTokensField: "max_completion_tokens",
        model: process.env.AI_MODEL || "gpt-5-mini",
        providerName: "OpenAI"
      };
    case "deepseek":
      return {
        apiKey: process.env.DEEPSEEK_API_KEY,
        apiKeyEnvName: "DEEPSEEK_API_KEY",
        endpoint: "https://api.deepseek.com/chat/completions",
        maxTokensField: "max_tokens",
        model: process.env.AI_MODEL || "deepseek-chat",
        providerName: "DeepSeek"
      };
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }
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
      response_format: { type: "json_object" },
      [this.config.maxTokensField]: 3600
    };

    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as OpenAIChatResponse;

    if (!response.ok) {
      throw new Error(
        payload.error?.message ||
          `${this.config.providerName} request failed with ${response.status}.`
      );
    }

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI response did not include JSON content.");
    }

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
      response_format: { type: "json_object" },
      [this.config.maxTokensField]: 2200
    };

    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as OpenAIChatResponse;

    if (!response.ok) {
      throw new Error(
        payload.error?.message ||
          `${this.config.providerName} request failed with ${response.status}.`
      );
    }

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI response did not include JSON content.");
    }

    return normalizeResumeProfileAnalysis(parseJsonContent(content));
  }
}

function isConfiguredApiKey(apiKey: string | undefined) {
  if (!apiKey?.trim()) {
    return false;
  }

  const normalized = apiKey.trim().toLowerCase();

  return ![
    "replace_with_a_new_deepseek_key",
    "your_deepseek_api_key_here",
    "your_openai_api_key_here"
  ].includes(normalized);
}

function parseJsonContent(content: string) {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(withoutFence);
}

function normalizeJobAnalysis(value: Partial<JobAnalysis>): JobAnalysis {
  const matchScore = clampScore(value.match_score);
  const skills = asStringArray(value.skills);
  const tools = asStringArray(value.tools);

  return {
    company: asString(value.company, "Not specified"),
    job_title_original: asString(value.job_title_original, "Not specified"),
    job_title_zh: asString(value.job_title_zh, "Not specified"),
    location: asString(value.location, "Not specified"),
    work_mode: asWorkMode(value.work_mode),
    job_type_en: asString(value.job_type_en, "Not specified"),
    job_type_zh: asString(value.job_type_zh, "Not specified"),
    education_requirement_en: asString(
      value.education_requirement_en,
      "Not specified"
    ),
    education_requirement_zh: asString(value.education_requirement_zh, "Not specified"),
    experience_requirement_en: asString(
      value.experience_requirement_en,
      "Not specified"
    ),
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
    match_score_breakdown: normalizeMatchScoreBreakdown(
      value.match_score_breakdown,
      matchScore
    ),
    key_strengths_en: asStringArray(value.key_strengths_en),
    key_strengths_zh: asStringArray(value.key_strengths_zh),
    main_gaps_en: asStringArray(value.main_gaps_en),
    main_gaps_zh: asStringArray(value.main_gaps_zh),
    application_recommendation: asApplicationRecommendation(
      value.application_recommendation,
      matchScore
    ),
    recommended_next_action: normalizeNextAction(
      value.recommended_next_action,
      matchScore
    ),
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
    missing_skill_details: normalizeMissingSkillDetails(
      value.missing_skill_details
    ),
    important_tools: asStringArray(value.important_tools, tools),
    suggested_learning_actions_en: asStringArray(value.suggested_learning_actions_en),
    suggested_learning_actions_zh: asStringArray(value.suggested_learning_actions_zh),
    ai_summary_en: asString(value.ai_summary_en, "Not specified"),
    ai_summary_zh: asString(value.ai_summary_zh, "Not specified"),
    resume_keywords: asStringArray(value.resume_keywords)
  };
}

function normalizeResumeProfileAnalysis(
  value: Partial<ResumeProfileAnalysis>
): ResumeProfileAnalysis {
  return {
    candidate_profile: normalizeCandidateProfile(value.candidate_profile),
    profile_summary_en: asString(value.profile_summary_en, "Not specified"),
    profile_summary_zh: asString(value.profile_summary_zh, "未注明"),
    extracted_strengths: asStringArray(value.extracted_strengths),
    missing_or_unclear_information: asStringArray(
      value.missing_or_unclear_information
    ),
    confidence: asConfidenceLevel(value.confidence)
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item)))
    .filter(Boolean);
}

function asWorkMode(value: unknown): WorkMode {
  const text = asString(value, "Not specified");
  return WORK_MODES.includes(text as WorkMode) ? (text as WorkMode) : "Not specified";
}

function normalizeMatchScoreBreakdown(
  value: unknown,
  fallbackScore: number
): MatchScoreBreakdown {
  const source = isRecord(value) ? value : {};

  return MATCH_SCORE_DIMENSIONS.reduce((breakdown, key) => {
    breakdown[key] = normalizeScoreDimension(source[key], fallbackScore);
    return breakdown;
  }, {} as MatchScoreBreakdown);
}

function normalizeScoreDimension(
  value: unknown,
  fallbackScore: number
): ScoreDimension {
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

function asApplicationRecommendation(
  value: unknown,
  matchScore: number
): ApplicationRecommendation {
  const text = asString(value, "");

  if (APPLICATION_RECOMMENDATIONS.includes(text as ApplicationRecommendation)) {
    return text as ApplicationRecommendation;
  }

  if (matchScore >= 85) {
    return "Strongly apply";
  }

  if (matchScore >= 65) {
    return "Worth trying";
  }

  if (matchScore >= 45) {
    return "Low priority";
  }

  return "Not recommended";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNextAction(
  value: unknown,
  matchScore: number
): RecommendedNextAction {
  const source = isRecord(value) ? value : {};

  return {
    action: asNextAction(source.action, matchScore),
    reason_en: asString(source.reason_en, defaultNextActionReason(matchScore, "en")),
    reason_zh: asString(source.reason_zh, defaultNextActionReason(matchScore, "zh")),
    urgency: asPriorityLevel(source.urgency, matchScore >= 80 ? "High" : "Medium"),
    suggested_deadline: asString(
      source.suggested_deadline,
      matchScore >= 80 ? "Within 3 days" : "This week"
    ),
    resume_focus_points: asStringArray(source.resume_focus_points)
  };
}

function normalizeMissingSkillDetails(value: unknown): MissingSkillDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      skill: asString(item.skill, "Not specified"),
      priority: asPriorityLevel(item.priority),
      why_it_matters_en: asString(item.why_it_matters_en, "Not specified"),
      why_it_matters_zh: asString(item.why_it_matters_zh, "未注明"),
      impact_on_match_score: asString(item.impact_on_match_score, "Not specified"),
      suggested_resource_type: asString(
        item.suggested_resource_type,
        "practice task"
      )
    }))
    .filter((item) => item.skill !== "Not specified");
}

function asNextAction(value: unknown, matchScore: number): NextActionLabel {
  const text = asString(value, "");

  if (NEXT_ACTIONS.includes(text as NextActionLabel)) {
    return text as NextActionLabel;
  }

  if (matchScore >= 85) {
    return "Apply now";
  }

  if (matchScore >= 65) {
    return "Tailor resume first";
  }

  if (matchScore >= 45) {
    return "Save for later";
  }

  return "Skip";
}

function asPriorityLevel(value: unknown, fallback: PriorityLevel = "Medium") {
  const text = asString(value, "");
  return PRIORITY_LEVELS.includes(text as PriorityLevel)
    ? (text as PriorityLevel)
    : fallback;
}

function asConfidenceLevel(value: unknown): ConfidenceLevel {
  const text = asString(value, "");
  return CONFIDENCE_LEVELS.includes(text as ConfidenceLevel)
    ? (text as ConfidenceLevel)
    : "Medium";
}

function defaultNextActionReason(matchScore: number, language: "en" | "zh") {
  if (language === "zh") {
    if (matchScore >= 85) {
      return "匹配度高，建议尽快申请。";
    }

    if (matchScore >= 65) {
      return "岗位值得尝试，但建议先优化简历。";
    }

    return "匹配度有限，建议先补强关键差距。";
  }

  if (matchScore >= 85) {
    return "The role is a strong fit, so apply promptly.";
  }

  if (matchScore >= 65) {
    return "The role is worth trying after tailoring the resume.";
  }

  return "The fit is limited, so address the main gaps first.";
}
