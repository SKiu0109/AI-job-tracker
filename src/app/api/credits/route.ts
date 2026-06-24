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
import type { CreditsStatusResponse } from "@/types/credits";

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
  const credits = authUser
    ? await getAuthenticatedCredits(authUser.id, authUser.email)
    : await getCreditsService().getBalance(guestSession.guestId);
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

  // TODO: Add IP-based guest account creation limits, server-side rate
  // limiting, persistent Supabase/Vercel KV/Upstash credit storage, and a
  // login-based credit system before this becomes production enforcement.
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
