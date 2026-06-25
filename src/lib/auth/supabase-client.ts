"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

function getSupabaseBrowserConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env
      .NEXT_PUBLIC_sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env
      .NEXT_PUBLIC_sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_PUBLISHABLE_KEY ??
    process.env
      .NEXT_PUBLIC_sb_publishable_BpbXVKeLScG9bnq7IUYCeg_CZ6Tr4ey_SUPABASE_ANON_KEY;

  return {
    supabaseUrl,
    publishableKey
  };
}

export function isSupabaseAuthConfigured() {
  const { supabaseUrl, publishableKey } = getSupabaseBrowserConfig();

  return Boolean(supabaseUrl && publishableKey);
}

export function getSupabaseBrowserClient() {
  const { supabaseUrl, publishableKey } = getSupabaseBrowserConfig();

  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  return browserClient;
}
