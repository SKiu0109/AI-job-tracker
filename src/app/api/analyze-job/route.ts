import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAiProvider,
  getAiProviderConfigStatus
} from "@/lib/ai/job-analysis-provider";
import { JD_ANALYSIS_CREDIT_COST } from "@/lib/credits/constants";
import {
  createServerAnalysisCacheKey,
  readServerCachedAnalysis,
  writeServerCachedAnalysis
} from "@/lib/server/analysis-cache";
import { getCreditsService } from "@/lib/server/credits-service";
import {
  applyGuestSessionCookie,
  getOrCreateGuestSession,
  GUEST_ID_COOKIE
} from "@/lib/server/guest-session";
import { validateRawJd } from "@/lib/validation/job-analysis";
import type { CreditBalance } from "@/types/credits";

export const runtime = "nodejs";

type AnalyzeJobRequest = {
  raw_jd?: string;
  source_url?: string;
  candidate_profile?: string;
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
  empty_jd: {
    en: "Please paste the job description before analyzing.",
    zh: "请先粘贴岗位描述。"
  },
  jd_too_short: {
    en: "Please paste a more complete job description before analyzing.",
    zh: "请粘贴更完整的岗位描述后再分析。"
  },
  jd_too_long: {
    en: "Job description is too long. Please keep it under 12,000 characters.",
    zh: "岗位描述过长，请控制在 12,000 个字符以内。"
  },
  missing_api_key: {
    en: "Demo mode is active. Configure an API key to run real AI JD analysis.",
    zh: "当前为演示模式。如需真实 AI 岗位分析，请配置 API Key。"
  },
  credits_exhausted: {
    en: "Your 10 free guest credits have been used. Sample data and cached analyses are still available.",
    zh: "你的 10 次免费访客额度已用完。仍可使用示例数据和已缓存分析。"
  },
  analysis_failed: {
    en: "The AI provider could not complete this analysis. Please try again later.",
    zh: "AI 服务暂时无法完成分析，请稍后再试。"
  }
} satisfies Record<string, BilingualMessage>;

export async function POST(request: Request) {
  let body: AnalyzeJobRequest;

  try {
    body = (await request.json()) as AnalyzeJobRequest;
  } catch {
    return jsonError("invalid_json", ERROR_MESSAGES.invalid_json, 400);
  }

  const validation = validateRawJd(body.raw_jd);

  if (!validation.ok) {
    return jsonError(validation.code, ERROR_MESSAGES[validation.code], 400);
  }

  const cookieStore = await cookies();
  const guestSession = getOrCreateGuestSession(
    cookieStore.get(GUEST_ID_COOKIE)?.value
  );
  const creditsService = getCreditsService();
  const currentCredits = creditsService.getBalance(guestSession.guestId);
  const respond = (
    payload: Record<string, unknown>,
    init?: ResponseInit
  ) => {
    const response = NextResponse.json(payload, init);
    applyGuestSessionCookie(response, guestSession.guestId);
    return response;
  };
  const rawJd = validation.rawJd;
  const candidateProfile = body.candidate_profile?.trim() ?? "";
  const cacheKey = createServerAnalysisCacheKey(rawJd, candidateProfile);
  const cachedAnalysis = readServerCachedAnalysis(cacheKey);

  if (cachedAnalysis) {
    return respond({
      analysis: cachedAnalysis,
      cached: true,
      credits: toPublicCredits(currentCredits)
    });
  }

  const providerStatus = getAiProviderConfigStatus();

  if (!providerStatus.configured) {
    return respond(
      {
        code: "missing_api_key",
        error: ERROR_MESSAGES.missing_api_key.en,
        message: ERROR_MESSAGES.missing_api_key,
        credits: toPublicCredits(currentCredits)
      },
      { status: 503 }
    );
  }

  const reservedCredits = creditsService.trySpend(
    guestSession.guestId,
    JD_ANALYSIS_CREDIT_COST
  );

  if (!reservedCredits) {
    return respond(
      {
        code: "credits_exhausted",
        error: ERROR_MESSAGES.credits_exhausted.en,
        message: ERROR_MESSAGES.credits_exhausted,
        credits: toPublicCredits(currentCredits)
      },
      { status: 402 }
    );
  }

  try {
    const provider = getAiProvider();

    const analysis = await provider.analyzeJob({
      rawJd,
      sourceUrl: body.source_url,
      candidateProfile
    });

    writeServerCachedAnalysis(cacheKey, analysis);

    return respond({
      analysis,
      cached: false,
      credits: toPublicCredits(creditsService.getBalance(guestSession.guestId))
    });
  } catch (error) {
    creditsService.refund(guestSession.guestId, JD_ANALYSIS_CREDIT_COST);

    if (isMissingApiKeyError(error)) {
      return respond(
        {
          code: "missing_api_key",
          error: ERROR_MESSAGES.missing_api_key.en,
          message: ERROR_MESSAGES.missing_api_key,
          credits: toPublicCredits(creditsService.getBalance(guestSession.guestId))
        },
        { status: 503 }
      );
    }

    console.error("Job analysis failed", error);

    return respond(
      {
        code: "analysis_failed",
        error: ERROR_MESSAGES.analysis_failed.en,
        message: ERROR_MESSAGES.analysis_failed,
        credits: toPublicCredits(creditsService.getBalance(guestSession.guestId))
      },
      { status: 500 }
    );
  }
}

function jsonError(code: string, message: BilingualMessage, status: number) {
  return NextResponse.json(
    {
      code,
      error: message.en,
      message
    },
    { status }
  );
}

function toPublicCredits(balance: CreditBalance) {
  return {
    remaining: balance.remaining,
    limit: balance.limit,
    costPerAnalysis: balance.costPerAnalysis,
    store: balance.store
  };
}

function isMissingApiKeyError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("api_key") &&
    error.message.toLowerCase().includes("not configured")
  );
}
