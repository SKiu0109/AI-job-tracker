import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAiProviderConfigStatus } from "@/lib/ai/job-analysis-provider";
import { getCreditsService } from "@/lib/server/credits-service";
import {
  applyGuestSessionCookie,
  getOrCreateGuestSession,
  GUEST_ID_COOKIE
} from "@/lib/server/guest-session";
import type { CreditsStatusResponse } from "@/types/credits";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const guestSession = getOrCreateGuestSession(
    cookieStore.get(GUEST_ID_COOKIE)?.value
  );
  const credits = await getCreditsService().getBalance(guestSession.guestId);
  const ai = getAiProviderConfigStatus();
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
