import "server-only";

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
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env
      .sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_URL ??
    process.env
      .NEXT_PUBLIC_sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_URL;
  const apiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env
      .sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_SERVICE_ROLE_KEY ??
    process.env
      .sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env
      .sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env
      .NEXT_PUBLIC_sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_ANON_KEY;

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
