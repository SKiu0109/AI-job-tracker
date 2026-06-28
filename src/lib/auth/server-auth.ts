import "server-only";

import { getSupabaseServerConfig } from "@/lib/server/supabase-config";

type SupabaseUserResponse = {
  id: string;
  email?: string;
};

export type VerifiedAuthUser = {
  id: string;
  email: string;
};

export async function verifySupabaseAccessToken(
  accessToken: string | null | undefined
): Promise<VerifiedAuthUser | null> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig();
  const apiKey =
    serviceRoleKey ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!accessToken || !supabaseUrl || !apiKey) {
    return null;
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const user = (await response.json()) as SupabaseUserResponse;

  if (!user.id || !user.email) {
    return null;
  }

  return {
    id: user.id,
    email: user.email
  };
}

export function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authorizationHeader.slice("bearer ".length).trim();
}
