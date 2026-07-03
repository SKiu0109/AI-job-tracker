import "server-only";

export function getSupabaseServerConfig() {
  return {
    supabaseUrl: firstNonEmptyEnv(
      process.env.SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL
    ),
    serviceRoleKey: firstNonEmptyEnv(
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  };
}

export function shouldFailClosedForPersistentUserData() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

function firstNonEmptyEnv(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim();
}
