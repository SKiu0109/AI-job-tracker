import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAiProviderConfigStatus } from "@/lib/ai/job-analysis-provider";
import { isAdminEmail } from "@/lib/auth/admin";
import { getBearerToken, verifySupabaseAccessToken } from "@/lib/auth/server-auth";
import { shouldAutoMigrateGuestCreditsToUser } from "@/lib/credits/credit-policy";
import { getCreditsService } from "@/lib/server/credits-service";
import { getOrCreateUserAccount } from "@/lib/server/account-service";
import {
  createAdminCreditBalance,
  getUserCreditsService
} from "@/lib/server/user-credits-service";
import {
  applyGuestSessionCookie,
  getOrCreateGuestSession,
  GUEST_ID_COOKIE
} from "@/lib/server/guest-session";
import {
  checkRateLimit,
  createRequestIdentityHash
} from "@/lib/server/rate-limit-service";
import type { CreditBalance, CreditsStatusResponse } from "@/types/credits";

export const runtime = "nodejs";

const GUEST_CREDIT_CREATION_LIMIT = 20;
const GUEST_CREDIT_CREATION_WINDOW_SECONDS = 60 * 60;

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const guestSession = getOrCreateGuestSession(
    cookieStore.get(GUEST_ID_COOKIE)?.value
  );
  const authUser = await verifySupabaseAccessToken(
    getBearerToken(request.headers.get("authorization"))
  );
  const isAdmin = isAdminEmail(authUser?.email);
  let credits: CreditBalance;

  try {
    if (!authUser && guestSession.isNew) {
      const rateLimit = await checkRateLimit({
        identity: createRequestIdentityHash(request),
        limit: GUEST_CREDIT_CREATION_LIMIT,
        scope: "guest_credit_creation",
        windowSeconds: GUEST_CREDIT_CREATION_WINDOW_SECONDS
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            code: "rate_limited",
            error: "Too many new guest credit sessions. Please try again later."
          },
          {
            status: 429,
            headers: {
              "retry-after": String(rateLimit.retryAfterSeconds)
            }
          }
        );
      }
    }

    credits = authUser
      ? await getAuthenticatedCredits(
          authUser.id,
          authUser.email,
          guestSession.guestId,
          guestSession.isNew
        )
      : await getCreditsService().getBalance(guestSession.guestId);
  } catch (error) {
    console.error(
      "Credits status unavailable",
      error instanceof Error ? error.message : String(error)
    );

    const response = NextResponse.json(
      {
        code: "credits_unavailable",
        error:
          "Credit storage is unavailable. Please check Supabase server configuration."
      },
      { status: 503 }
    );
    if (!authUser || !guestSession.isNew) {
      applyGuestSessionCookie(response, guestSession.guestId);
    }
    return response;
  }

  const ai = getAiProviderConfigStatus({ useAdminConfig: isAdmin });
  const payload: CreditsStatusResponse = {
    credits: {
      remaining: credits.remaining,
      limit: credits.limit,
      costPerAnalysis: credits.costPerAnalysis,
      store: credits.store
    },
    ai: {
      configured: ai.configured,
      provider: ai.provider,
      apiKeyEnvName: ai.apiKeyEnvName
    },
    demoMode: !ai.configured
  };
  const response = NextResponse.json(payload);

  if (!authUser || !guestSession.isNew) {
    applyGuestSessionCookie(response, guestSession.guestId);
  }

  return response;
}

async function getAuthenticatedCredits(
  userId: string,
  email: string,
  guestId: string,
  isNewGuestSession: boolean
) {
  if (isAdminEmail(email)) {
    return createAdminCreditBalance();
  }

  const account = await getOrCreateUserAccount(userId, email);
  const userCreditsService = getUserCreditsService();

  if (shouldAutoMigrateGuestCreditsToUser() && !isNewGuestSession) {
    await userCreditsService.migrateGuestCredits(
      userId,
      guestId,
      account.monthlyCreditLimit
    );
  }

  return userCreditsService.getBalance(userId, account.monthlyCreditLimit);
}
