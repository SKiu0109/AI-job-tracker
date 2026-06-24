import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getAiProvider,
  getAiProviderConfigStatus
} from "@/lib/ai/job-analysis-provider";
import { isAdminEmail } from "@/lib/auth/admin";
import { getBearerToken, verifySupabaseAccessToken } from "@/lib/auth/server-auth";
import { JD_ANALYSIS_CREDIT_COST } from "@/lib/credits/constants";
import { getOrCreateUserAccount } from "@/lib/server/account-service";
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
import {
  createAdminCreditBalance,
  getUserCreditsService
} from "@/lib/server/user-credits-service";
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

type CreditReservation =
  | { kind: "admin"; balance: CreditBalance }
  | { kind: "user"; userId: string; monthlyLimit: number; balance: CreditBalance }
  | { kind: "guest"; guestId: string; balance: CreditBalance };

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
  const authUser = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );
  const isAdmin = isAdminEmail(authUser?.email);
  const userAccount =
    authUser && !isAdmin
      ? await getOrCreateUserAccount(authUser.id, authUser.email)
      : null;
  const userCreditsService = getUserCreditsService();
  const currentCredits = isAdmin
    ? createAdminCreditBalance()
    : authUser && userAccount
      ? await userCreditsService.getBalance(
          authUser.id,
          userAccount.monthlyCreditLimit
        )
      : await creditsService.getBalance(guestSession.guestId);
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

  const reservation = await reserveCredit({
    authUser,
    currentCredits,
    guestId: guestSession.guestId,
    isAdmin,
    monthlyLimit: userAccount?.monthlyCreditLimit
  });

  if (!reservation) {
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
      credits: toPublicCredits(
        await getLatestCredits({
          authUser,
          guestId: guestSession.guestId,
          isAdmin,
          monthlyLimit: userAccount?.monthlyCreditLimit
        })
      )
    });
  } catch (error) {
    await refundReservation(reservation);

    if (isMissingApiKeyError(error)) {
      return respond(
        {
          code: "missing_api_key",
          error: ERROR_MESSAGES.missing_api_key.en,
          message: ERROR_MESSAGES.missing_api_key,
          credits: toPublicCredits(
            await getLatestCredits({
              authUser,
              guestId: guestSession.guestId,
              isAdmin,
              monthlyLimit: userAccount?.monthlyCreditLimit
            })
          )
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
        credits: toPublicCredits(
          await getLatestCredits({
            authUser,
            guestId: guestSession.guestId,
            isAdmin,
            monthlyLimit: userAccount?.monthlyCreditLimit
          })
        )
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

async function reserveCredit({
  authUser,
  currentCredits,
  guestId,
  isAdmin,
  monthlyLimit
}: {
  authUser: { id: string } | null;
  currentCredits: CreditBalance;
  guestId: string;
  isAdmin: boolean;
  monthlyLimit?: number;
}): Promise<CreditReservation | null> {
  if (isAdmin) {
    return {
      kind: "admin",
      balance: currentCredits
    };
  }

  if (authUser && monthlyLimit !== undefined) {
    const balance = await getUserCreditsService().trySpend(
      authUser.id,
      JD_ANALYSIS_CREDIT_COST,
      monthlyLimit
    );

    return balance
      ? {
          kind: "user",
          userId: authUser.id,
          monthlyLimit,
          balance
        }
      : null;
  }

  const balance = await getCreditsService().trySpend(
    guestId,
    JD_ANALYSIS_CREDIT_COST
  );

  return balance
    ? {
        kind: "guest",
        guestId,
        balance
      }
    : null;
}

async function refundReservation(reservation: CreditReservation) {
  if (reservation.kind === "admin") {
    return;
  }

  if (reservation.kind === "user") {
    await getUserCreditsService().refund(
      reservation.userId,
      JD_ANALYSIS_CREDIT_COST,
      reservation.monthlyLimit
    );
    return;
  }

  await getCreditsService().refund(
    reservation.guestId,
    JD_ANALYSIS_CREDIT_COST
  );
}

async function getLatestCredits({
  authUser,
  guestId,
  isAdmin,
  monthlyLimit
}: {
  authUser: { id: string } | null;
  guestId: string;
  isAdmin: boolean;
  monthlyLimit?: number;
}) {
  if (isAdmin) {
    return createAdminCreditBalance();
  }

  if (authUser && monthlyLimit !== undefined) {
    return getUserCreditsService().getBalance(authUser.id, monthlyLimit);
  }

  return getCreditsService().getBalance(guestId);
}

function isMissingApiKeyError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("api_key") &&
    error.message.toLowerCase().includes("not configured")
  );
}
