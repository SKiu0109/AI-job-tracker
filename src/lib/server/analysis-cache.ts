import "server-only";

import { createHash } from "crypto";
import { getSupabaseServerConfig } from "@/lib/server/supabase-config";
import type { JobAnalysis } from "@/types/job";

type AnalysisCacheEntry = {
  analysis: JobAnalysis;
  createdAt: string;
  expiresAt: string;
};

type ServerAnalysisCacheRow = {
  payload: JobAnalysis;
  expires_at: string | null;
};

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

const globalForAnalysisCache = globalThis as typeof globalThis & {
  __aiJobTrackerAnalysisCache?: Map<string, AnalysisCacheEntry>;
};

export function createServerAnalysisCacheKey(
  rawJd: string,
  candidateProfile = "",
  language: "en" | "zh" = "en"
) {
  const normalized = `${language}\n${rawJd}\n${candidateProfile}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return createHash("sha256").update(normalized).digest("hex");
}

export async function readServerCachedAnalysis(cacheKey: string) {
  const cloudAnalysis = await readSupabaseCachedAnalysis(cacheKey);

  if (cloudAnalysis) {
    return cloudAnalysis;
  }

  const entry = getAnalysisCache().get(cacheKey);

  if (!entry) {
    return null;
  }

  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    getAnalysisCache().delete(cacheKey);
    return null;
  }

  return entry.analysis;
}

export async function writeServerCachedAnalysis(
  cacheKey: string,
  analysis: JobAnalysis
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS).toISOString();

  getAnalysisCache().set(cacheKey, {
    analysis,
    createdAt: now.toISOString(),
    expiresAt
  });

  await writeSupabaseCachedAnalysis(cacheKey, analysis, expiresAt);
}

async function readSupabaseCachedAnalysis(cacheKey: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  try {
    const response = await fetch(
      `${getRestUrl(
        supabaseUrl
      )}/server_analysis_cache?cache_key=eq.${encodeURIComponent(
        cacheKey
      )}&select=payload,expires_at&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`read failed with ${response.status}`);
    }

    const rows = (await response.json()) as ServerAnalysisCacheRow[];
    const row = rows[0];

    if (!row) {
      return null;
    }

    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }

    return row.payload;
  } catch (error) {
    console.warn(
      "[analysis-cache:supabase-read]",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}

async function writeSupabaseCachedAnalysis(
  cacheKey: string,
  analysis: JobAnalysis,
  expiresAt: string
) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    return;
  }

  try {
    const response = await fetch(`${getRestUrl(supabaseUrl)}/server_analysis_cache`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        cache_key: cacheKey,
        payload: analysis,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`write failed with ${response.status}`);
    }
  } catch (error) {
    console.warn(
      "[analysis-cache:supabase-write]",
      error instanceof Error ? error.message : String(error)
    );
  }
}

function getAnalysisCache() {
  const cache =
    globalForAnalysisCache.__aiJobTrackerAnalysisCache ??
    new Map<string, AnalysisCacheEntry>();
  globalForAnalysisCache.__aiJobTrackerAnalysisCache = cache;
  return cache;
}

function getRestUrl(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
}
