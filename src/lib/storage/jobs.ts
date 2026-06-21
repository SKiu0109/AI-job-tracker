"use client";

import { JobAnalysis, JobRecord, ApplicationStatus } from "@/types/job";

const JOBS_STORAGE_KEY = "ai-bilingual-job-tracker.jobs.v1";
const ANALYSIS_CACHE_KEY = "ai-bilingual-job-tracker.analysis-cache.v1";

type AnalysisCache = Record<
  string,
  {
    analysis: JobAnalysis;
    createdAt: string;
  }
>;

export function loadJobs(): JobRecord[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(JOBS_STORAGE_KEY);
    const jobs = raw ? (JSON.parse(raw) as JobRecord[]) : [];
    return Array.isArray(jobs) ? jobs : [];
  } catch {
    return [];
  }
}

export function getStoredJob(id: string) {
  return loadJobs().find((job) => job.id === id);
}

export function saveJob(job: JobRecord) {
  const jobs = loadJobs();
  const nextJobs = [job, ...jobs.filter((item) => item.id !== job.id)];
  saveJobs(nextJobs);
}

export function updateStoredJobStatus(id: string, status: ApplicationStatus) {
  const jobs = loadJobs();
  const now = new Date().toISOString();
  const nextJobs = jobs.map((job) =>
    job.id === id ? { ...job, application_status: status, updated_at: now } : job
  );

  saveJobs(nextJobs);
  return nextJobs.find((job) => job.id === id);
}

export function saveJobs(jobs: JobRecord[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
}

export function createAnalysisCacheKey(rawJd: string, candidateProfile = "") {
  const normalized = `${rawJd}\n${candidateProfile}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) | 0;
  }

  return `${normalized.length}:${Math.abs(hash).toString(36)}`;
}

export function readCachedAnalysis(cacheKey: string) {
  return readAnalysisCache()[cacheKey]?.analysis;
}

export function writeCachedAnalysis(cacheKey: string, analysis: JobAnalysis) {
  const cache = readAnalysisCache();
  cache[cacheKey] = {
    analysis,
    createdAt: new Date().toISOString()
  };

  if (canUseStorage()) {
    window.localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(cache));
  }
}

function readAnalysisCache(): AnalysisCache {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ANALYSIS_CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as AnalysisCache) : {};
    return cache && typeof cache === "object" ? cache : {};
  } catch {
    return {};
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
