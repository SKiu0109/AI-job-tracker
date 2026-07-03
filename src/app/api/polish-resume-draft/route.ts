import { NextResponse } from "next/server";
import {
  getAiProvider,
  getAiProviderConfigStatus
} from "@/lib/ai/job-analysis-provider";
import type { ResumeDraftPolishJobContext } from "@/lib/ai/resume-draft-polish-prompt";
import {
  createAiCreditContext,
  createAiCreditResponse,
  getLatestAiCredits,
  refundAiCredit,
  reserveAiCredit,
  toPublicCredits
} from "@/lib/server/ai-credit-usage";
import type { ResumeTailoringDraft } from "@/types/job";

export const runtime = "nodejs";
export const maxDuration = 60;

type PolishResumeDraftRequest = {
  draft?: Partial<ResumeTailoringDraft>;
  instruction?: string;
  job?: Partial<ResumeDraftPolishJobContext>;
  language?: "en" | "zh";
};

type BilingualMessage = {
  en: string;
  zh: string;
};

const ERROR_MESSAGES = {
  invalid_json: {
    en: "Invalid JSON request body.",
    zh: "请求内容格式不正确。"
  },
  invalid_draft: {
    en: "Resume draft is missing or incomplete.",
    zh: "简历草稿缺失或不完整。"
  },
  invalid_job: {
    en: "Job evidence is missing.",
    zh: "岗位证据缺失。"
  },
  missing_api_key: {
    en: "AI polishing is not configured yet.",
    zh: "AI 优化尚未配置。"
  },
  credits_exhausted: {
    en: "Your AI credits have been used. Resume polish requires 1 credit.",
    zh: "AI 点数已用完。简历优化需要消耗 1 点。"
  },
  credits_unavailable: {
    en: "Credit storage is unavailable. Please check Supabase server configuration.",
    zh: "额度存储暂时不可用。请检查 Supabase 服务端配置。"
  },
  polish_failed: {
    en: "AI polishing failed. Please try again later.",
    zh: "AI 优化失败，请稍后再试。"
  }
} satisfies Record<string, BilingualMessage>;

export async function POST(request: Request) {
  let body: PolishResumeDraftRequest;

  try {
    body = (await request.json()) as PolishResumeDraftRequest;
  } catch {
    return jsonError("invalid_json", ERROR_MESSAGES.invalid_json, 400);
  }

  const language = body.language === "zh" ? "zh" : "en";
  const draft = normalizeDraft(body.draft);
  const job = normalizeJobContext(body.job);

  if (!draft) {
    return jsonError("invalid_draft", ERROR_MESSAGES.invalid_draft, 400, language);
  }

  if (!job) {
    return jsonError("invalid_job", ERROR_MESSAGES.invalid_job, 400, language);
  }

  let creditContext: Awaited<ReturnType<typeof createAiCreditContext>>;

  try {
    creditContext = await createAiCreditContext(request);
  } catch (error) {
    console.error(
      "Credit storage unavailable",
      error instanceof Error ? error.message : String(error)
    );
    return jsonError(
      "credits_unavailable",
      ERROR_MESSAGES.credits_unavailable,
      503,
      language
    );
  }

  const providerStatus = getAiProviderConfigStatus({
    useAdminConfig: creditContext.isAdmin
  });

  if (!providerStatus.configured) {
    return createAiCreditResponse(
      creditContext,
      {
        code: "missing_api_key",
        credits: toPublicCredits(creditContext.currentCredits),
        error: ERROR_MESSAGES.missing_api_key[language],
        message: ERROR_MESSAGES.missing_api_key
      },
      { status: 503 }
    );
  }

  const reservation = await reserveAiCredit(creditContext);

  if (!reservation) {
    return createAiCreditResponse(
      creditContext,
      {
        code: "credits_exhausted",
        credits: toPublicCredits(creditContext.currentCredits),
        error: ERROR_MESSAGES.credits_exhausted[language],
        message: ERROR_MESSAGES.credits_exhausted
      },
      { status: 402 }
    );
  }

  try {
    const provider = getAiProvider({
      useAdminConfig: creditContext.isAdmin
    });
    const polishedDraft = await provider.polishResumeDraft({
      draft,
      instruction: body.instruction,
      job,
      language
    });

    return createAiCreditResponse(creditContext, {
      credits: toPublicCredits(await getLatestAiCredits(creditContext)),
      draft: polishedDraft,
      ok: true
    });
  } catch (error) {
    await refundAiCredit(reservation);

    if (isMissingApiKeyError(error)) {
      return createAiCreditResponse(
        creditContext,
        {
          code: "missing_api_key",
          credits: toPublicCredits(await getLatestAiCredits(creditContext)),
          error: ERROR_MESSAGES.missing_api_key[language],
          message: ERROR_MESSAGES.missing_api_key
        },
        { status: 503 }
      );
    }

    console.error("Resume draft polish failed", error);

    return createAiCreditResponse(
      creditContext,
      {
        code: "polish_failed",
        credits: toPublicCredits(await getLatestAiCredits(creditContext)),
        error: ERROR_MESSAGES.polish_failed[language],
        message: ERROR_MESSAGES.polish_failed
      },
      { status: 500 }
    );
  }
}

function jsonError(
  code: string,
  message: BilingualMessage,
  status: number,
  language: "en" | "zh" = "en"
) {
  return NextResponse.json(
    {
      code,
      error: message[language],
      message
    },
    { status }
  );
}

function normalizeDraft(
  value: Partial<ResumeTailoringDraft> | undefined
): ResumeTailoringDraft | null {
  if (!isRecord(value)) return null;

  const summary = asString(value.summary_en);
  const bullets = asStringArray(value.bullets_en).slice(0, 4);
  const keywords = asStringArray(value.keywords).slice(0, 12);

  if (!summary && !bullets.length && !keywords.length) return null;

  return {
    summary_en: summary,
    bullets_en: bullets,
    keywords,
    explanation_zh: asString(value.explanation_zh),
    risk_notes_zh: asStringArray(value.risk_notes_zh).slice(0, 4)
  };
}

function normalizeJobContext(
  value: Partial<ResumeDraftPolishJobContext> | undefined
): ResumeDraftPolishJobContext | null {
  if (!isRecord(value)) return null;

  const company = asString(value.company);
  const jobTitle =
    asString(value.job_title_en) ||
    asString(value.job_title_original) ||
    asString(value.job_title_zh);

  if (!company && !jobTitle) return null;

  return {
    company,
    important_tools: asStringArray(value.important_tools),
    job_title_en: asString(value.job_title_en) || jobTitle,
    job_title_original: asString(value.job_title_original) || jobTitle,
    job_title_zh: asString(value.job_title_zh) || jobTitle,
    key_strengths_en: asStringArray(value.key_strengths_en),
    key_strengths_zh: asStringArray(value.key_strengths_zh),
    main_gaps_en: asStringArray(value.main_gaps_en),
    main_gaps_zh: asStringArray(value.main_gaps_zh),
    match_score: clampNumber(value.match_score),
    matched_skills: asStringArray(value.matched_skills),
    missing_skills: asStringArray(value.missing_skills),
    positive_signals_en: asStringArray(value.positive_signals_en),
    positive_signals_zh: asStringArray(value.positive_signals_zh),
    raw_jd: asString(value.raw_jd),
    red_flags_en: asStringArray(value.red_flags_en),
    red_flags_zh: asStringArray(value.red_flags_zh),
    resume_focus_points: asStringArray(value.resume_focus_points),
    resume_keywords: asStringArray(value.resume_keywords),
    resume_tailoring_advice_en: asStringArray(value.resume_tailoring_advice_en),
    resume_tailoring_advice_zh: asStringArray(value.resume_tailoring_advice_zh),
    skills: asStringArray(value.skills),
    tools: asStringArray(value.tools)
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item)))
    .filter(Boolean);
}

function clampNumber(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingApiKeyError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("api_key") &&
    error.message.toLowerCase().includes("not configured")
  );
}
