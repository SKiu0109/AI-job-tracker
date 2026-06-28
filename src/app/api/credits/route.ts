import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAiProviderConfigStatus } from "@/lib/ai/job-analysis-provider";
import { isAdminEmail } from "@/lib/auth/admin";
import { getBearerToken, verifySupabaseAccessToken } from "@/lib/auth/server-auth";
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
import type { CreditBalance, CreditsStatusResponse } from "@/types/credits";

export const runtime = "nodejs";

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
    credits = authUser
      ? await getAuthenticatedCredits(authUser.id, authUser.email)
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
    applyGuestSessionCookie(response, guestSession.guestId);
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

  // TODO: Add IP-based guest account creation limits and server-side rate
  // limiting before this becomes broad public production enforcement.
  applyGuestSessionCookie(response, guestSession.guestId);

  return response;
}

async function getAuthenticatedCredits(userId: string, email: string) {
  if (isAdminEmail(email)) {
    return createAdminCreditBalance();
  }

  const account = await getOrCreateUserAccount(userId, email);
  return getUserCreditsService().getBalance(userId, account.monthlyCreditLimit);
}
