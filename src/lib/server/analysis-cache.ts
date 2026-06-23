import "server-only";

import { createHash } from "crypto";
import type { JobAnalysis } from "@/types/job";

type AnalysisCacheEntry = {
  analysis: JobAnalysis;
  createdAt: string;
};

const globalForAnalysisCache = globalThis as typeof globalThis & {
  __aiJobTrackerAnalysisCache?: Map<string, AnalysisCacheEntry>;
};

export function createServerAnalysisCacheKey(
  rawJd: string,
  candidateProfile = ""
) {
  const normalized = `${rawJd}\n${candidateProfile}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return createHash("sha256").update(normalized).digest("hex");
}

export function readServerCachedAnalysis(cacheKey: string) {
  return getAnalysisCache().get(cacheKey)?.analysis ?? null;
}

export function writeServerCachedAnalysis(
  cacheKey: string,
  analysis: JobAnalysis
) {
  // TODO: Move this cache to persistent storage alongside guest credits so
  // duplicate public-demo analyses are reused across serverless instances.
  getAnalysisCache().set(cacheKey, {
    analysis,
    createdAt: new Date().toISOString()
  });
}

function getAnalysisCache() {
  const cache =
    globalForAnalysisCache.__aiJobTrackerAnalysisCache ??
    new Map<string, AnalysisCacheEntry>();
  globalForAnalysisCache.__aiJobTrackerAnalysisCache = cache;
  return cache;
}
