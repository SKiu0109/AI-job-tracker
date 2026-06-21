import { buildJobAnalysisMessages } from "@/lib/ai/job-analysis-prompt";
import { clampScore } from "@/lib/utils";
import { JobAnalysis, WORK_MODES, WorkMode } from "@/types/job";

type AnalyzeJobInput = {
  rawJd: string;
  sourceUrl?: string;
  candidateProfile?: string;
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
}

export function getAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER || "openai";

  switch (provider.toLowerCase()) {
    case "openai":
      return new OpenAIJobAnalysisProvider();
    default:
      throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  }
}

class OpenAIJobAnalysisProvider implements AiProvider {
  async analyzeJob(input: AnalyzeJobInput): Promise<JobAnalysis> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const model = process.env.AI_MODEL || "gpt-5-mini";
    const messages = buildJobAnalysisMessages(input);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        max_completion_tokens: 2200
      })
    });

    const payload = (await response.json().catch(() => ({}))) as OpenAIChatResponse;

    if (!response.ok) {
      throw new Error(
        payload.error?.message || `OpenAI request failed with ${response.status}.`
      );
    }

    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI response did not include JSON content.");
    }

    return normalizeJobAnalysis(parseJsonContent(content));
  }
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
    skills: asStringArray(value.skills),
    tools: asStringArray(value.tools),
    responsibilities_en: asStringArray(value.responsibilities_en),
    responsibilities_zh: asStringArray(value.responsibilities_zh),
    requirements_en: asStringArray(value.requirements_en),
    requirements_zh: asStringArray(value.requirements_zh),
    nice_to_have_en: asStringArray(value.nice_to_have_en),
    nice_to_have_zh: asStringArray(value.nice_to_have_zh),
    match_score: clampScore(value.match_score),
    ai_summary_en: asString(value.ai_summary_en, "Not specified"),
    ai_summary_zh: asString(value.ai_summary_zh, "Not specified"),
    resume_keywords: asStringArray(value.resume_keywords)
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item)))
    .filter(Boolean);
}

function asWorkMode(value: unknown): WorkMode {
  const text = asString(value, "Not specified");
  return WORK_MODES.includes(text as WorkMode) ? (text as WorkMode) : "Not specified";
}
