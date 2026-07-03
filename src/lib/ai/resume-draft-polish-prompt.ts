import type { ResumeTailoringDraft } from "@/types/job";

export type ResumeDraftPolishJobContext = {
  company: string;
  job_title_original: string;
  job_title_en: string;
  job_title_zh: string;
  match_score: number;
  skills: string[];
  tools: string[];
  matched_skills: string[];
  missing_skills: string[];
  important_tools: string[];
  resume_keywords: string[];
  resume_focus_points: string[];
  key_strengths_en: string[];
  key_strengths_zh: string[];
  main_gaps_en: string[];
  main_gaps_zh: string[];
  positive_signals_en: string[];
  positive_signals_zh: string[];
  red_flags_en: string[];
  red_flags_zh: string[];
  resume_tailoring_advice_en: string[];
  resume_tailoring_advice_zh: string[];
  raw_jd?: string;
};

export type ResumeDraftPolishInput = {
  draft: ResumeTailoringDraft;
  instruction?: string;
  job: ResumeDraftPolishJobContext;
  language?: "en" | "zh";
};

export function buildResumeDraftPolishMessages(input: ResumeDraftPolishInput) {
  const noteLanguage =
    input.language === "zh" ? "Simplified Chinese" : "English";
  const schema = `{
  "summary_en": "English resume summary, 45-75 words",
  "bullets_en": ["2-4 English resume bullets, each <= 32 words"],
  "keywords": ["6-12 ATS keywords supported by the evidence"],
  "explanation_zh": "brief explanation in the user's UI language",
  "risk_notes_zh": ["1-4 guardrails in the user's UI language"]
}`;

  return [
    {
      role: "system" as const,
      content:
        "You are a cautious resume tailoring editor. Return valid JSON only. Do not include markdown, comments, or extra text."
    },
    {
      role: "user" as const,
      content: [
        "Rewrite the current resume tailoring draft for this one job.",
        "Use only the supplied current draft and job evidence. Do not invent degrees, employers, job titles, projects, tools, metrics, industries, credentials, work rights, or domain experience.",
        "Never add FinTech, finance, gaming, consulting, healthcare, or any broad industry label unless it is explicitly present in the current draft or job evidence.",
        "If a claim is not clearly supported, soften it or move it into risk_notes_zh as a guardrail.",
        "Keep summary_en and bullets_en as English resume content.",
        `Write explanation_zh and risk_notes_zh in ${noteLanguage}, despite the legacy field names.`,
        "Keep proper nouns, company names, role titles, tools, and programming languages in their standard form.",
        "Prefer concise, recruiter-readable phrasing over dense keyword stuffing.",
        "Do not change the target company or role.",
        "",
        "Return valid JSON only using this exact schema:",
        schema,
        "",
        "Optional user instruction:",
        input.instruction?.trim() || "No extra instruction.",
        "",
        "Current draft:",
        JSON.stringify(input.draft, null, 2),
        "",
        "Job evidence:",
        JSON.stringify(normalizeJobContext(input.job), null, 2)
      ].join("\n")
    }
  ];
}

function normalizeJobContext(job: ResumeDraftPolishJobContext) {
  return {
    company: limitText(job.company, 120),
    job_title_original: limitText(job.job_title_original, 180),
    job_title_en: limitText(job.job_title_en, 180),
    job_title_zh: limitText(job.job_title_zh, 180),
    match_score: job.match_score,
    skills: limitList(job.skills, 24),
    tools: limitList(job.tools, 24),
    matched_skills: limitList(job.matched_skills, 20),
    missing_skills: limitList(job.missing_skills, 20),
    important_tools: limitList(job.important_tools, 20),
    resume_keywords: limitList(job.resume_keywords, 24),
    resume_focus_points: limitList(job.resume_focus_points, 8),
    key_strengths_en: limitList(job.key_strengths_en, 8),
    key_strengths_zh: limitList(job.key_strengths_zh, 8),
    main_gaps_en: limitList(job.main_gaps_en, 8),
    main_gaps_zh: limitList(job.main_gaps_zh, 8),
    positive_signals_en: limitList(job.positive_signals_en, 8),
    positive_signals_zh: limitList(job.positive_signals_zh, 8),
    red_flags_en: limitList(job.red_flags_en, 8),
    red_flags_zh: limitList(job.red_flags_zh, 8),
    resume_tailoring_advice_en: limitList(job.resume_tailoring_advice_en, 8),
    resume_tailoring_advice_zh: limitList(job.resume_tailoring_advice_zh, 8),
    raw_jd: limitText(job.raw_jd || "", 5000)
  };
}

function limitList(values: string[], maxItems: number) {
  return values
    .map((item) => limitText(item, 360))
    .filter(Boolean)
    .slice(0, maxItems);
}

function limitText(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}
