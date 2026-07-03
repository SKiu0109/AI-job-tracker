"use client";

import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-client";
import {
  loadCandidateProfile,
  saveCandidateProfile
} from "@/lib/storage/candidate-profile";
import { loadImportDrafts, saveImportDrafts } from "@/lib/storage/import-inbox";
import { loadJobs, saveJobs } from "@/lib/storage/jobs";
import { createStorageScope } from "@/lib/storage/scope";
import { CandidateProfile, JobAnalysis, JobRecord } from "@/types/job";

type CloudJobRow = {
  job_id: string;
  payload: JobRecord;
  updated_at: string;
};

type CloudProfileRow = {
  payload: CandidateProfile;
  updated_at: string;
};

type CloudAnalysisCacheRow = {
  payload: JobAnalysis;
};

export type GuestWorkspaceSummary = {
  draftCount: number;
  jobCount: number;
  profileFieldCount: number;
  totalItems: number;
};

export type CloudSyncIssue = {
  message: string;
  occurredAt: string;
};

const CLOUD_SYNC_ISSUE_KEY = "ai-bilingual-job-tracker.cloud-sync-issue.v1";
const CLOUD_SYNC_ISSUE_EVENT = "pathwise-cloud-sync-issue";
export const GUEST_WORKSPACE_IMPORTED_EVENT =
  "pathwise-guest-workspace-imported";

export async function hydrateJobsFromCloud(session: Session | null) {
  const scope = createStorageScope(session?.user.id);

  if (!session) {
    return loadJobs(scope);
  }

  const cloudJobs = await loadCloudJobs(session);

  if (cloudJobs === null) {
    return loadJobs(scope);
  }

  saveJobs(mergeJobsByUpdatedAt(loadJobs(scope), cloudJobs), scope);
  return loadJobs(scope);
}

export async function loadCloudJobs(session: Session | null) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !session) {
    return null;
  }

  const { data, error } = await supabase
    .from("cloud_jobs")
    .select("job_id,payload,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[cloud-sync:loadJobs]", error.message);
    recordCloudSyncIssue(error.message);
    return null;
  }

  return ((data ?? []) as CloudJobRow[])
    .map((row) => row.payload)
    .filter(Boolean);
}

export async function upsertCloudJob(session: Session | null, job: JobRecord) {
  return upsertCloudJobs(session, [job]);
}

export async function upsertCloudJobs(
  session: Session | null,
  jobs: JobRecord[]
) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !session || jobs.length === 0) {
    return;
  }

  const rows = jobs.map((job) => ({
    user_id: session.user.id,
    job_id: job.id,
    payload: job,
    created_at: job.created_at,
    updated_at: job.updated_at
  }));

  const { error } = await supabase
    .from("cloud_jobs")
    .upsert(rows, { onConflict: "user_id,job_id" });

  if (error) {
    console.warn("[cloud-sync:upsertJobs]", error.message);
    recordCloudSyncIssue(error.message);
  }
}

export async function deleteCloudJob(session: Session | null, jobId: string) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !session) {
    return;
  }

  const { error } = await supabase
    .from("cloud_jobs")
    .delete()
    .eq("user_id", session.user.id)
    .eq("job_id", jobId);

  if (error) {
    console.warn("[cloud-sync:deleteJob]", error.message);
    recordCloudSyncIssue(error.message);
  }
}

export async function deleteCloudJobs(session: Session | null, jobIds: string[]) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !session || jobIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("cloud_jobs")
    .delete()
    .eq("user_id", session.user.id)
    .in("job_id", jobIds);

  if (error) {
    console.warn("[cloud-sync:deleteJobs]", error.message);
    recordCloudSyncIssue(error.message);
  }
}

export async function hydrateCandidateProfileFromCloud(
  session: Session | null
) {
  const scope = createStorageScope(session?.user.id);

  if (!session) {
    return loadCandidateProfile(scope);
  }

  const cloudProfile = await loadCloudCandidateProfile(session);

  if (cloudProfile === undefined) {
    return loadCandidateProfile(scope);
  }

  if (cloudProfile) {
    saveCandidateProfile(cloudProfile, scope);
    return loadCandidateProfile(scope);
  }

  const localProfile = loadCandidateProfile(scope);
  void upsertCloudCandidateProfile(session, localProfile);
  return localProfile;
}

export async function loadCloudCandidateProfile(session: Session | null) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !session) {
    return undefined;
  }

  const { data, error } = await supabase
    .from("cloud_candidate_profiles")
    .select("payload,updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) {
    console.warn("[cloud-sync:loadProfile]", error.message);
    recordCloudSyncIssue(error.message);
    return undefined;
  }

  return (data as CloudProfileRow | null)?.payload ?? null;
}

export async function upsertCloudCandidateProfile(
  session: Session | null,
  profile: CandidateProfile
) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !session) {
    return;
  }

  const { error } = await supabase.from("cloud_candidate_profiles").upsert({
    user_id: session.user.id,
    payload: profile,
    updated_at: new Date().toISOString()
  });

  if (error) {
    console.warn("[cloud-sync:upsertProfile]", error.message);
    recordCloudSyncIssue(error.message);
  }
}

export async function readCloudCachedAnalysis(
  session: Session | null,
  cacheKey: string
) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !session) {
    return null;
  }

  const { data, error } = await supabase
    .from("cloud_analysis_cache")
    .select("payload")
    .eq("user_id", session.user.id)
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error) {
    console.warn("[cloud-sync:readAnalysisCache]", error.message);
    recordCloudSyncIssue(error.message);
    return null;
  }

  return (data as CloudAnalysisCacheRow | null)?.payload ?? null;
}

export async function writeCloudCachedAnalysis(
  session: Session | null,
  cacheKey: string,
  analysis: JobAnalysis
) {
  const supabase = getSupabaseBrowserClient();

  if (!supabase || !session) {
    return;
  }

  const { error } = await supabase.from("cloud_analysis_cache").upsert({
    user_id: session.user.id,
    cache_key: cacheKey,
    payload: analysis,
    created_at: new Date().toISOString()
  });

  if (error) {
    console.warn("[cloud-sync:writeAnalysisCache]", error.message);
    recordCloudSyncIssue(error.message);
  }
}

export function getGuestWorkspaceSummary(): GuestWorkspaceSummary {
  const guestScope = createStorageScope(null);
  const guestProfile = loadCandidateProfile(guestScope);
  const profileFieldCount = Object.values(guestProfile).filter((value) =>
    value.trim()
  ).length;
  const jobCount = loadJobs(guestScope).length;
  const draftCount = loadImportDrafts(guestScope).length;

  return {
    draftCount,
    jobCount,
    profileFieldCount,
    totalItems: jobCount + draftCount + profileFieldCount
  };
}

export async function importGuestWorkspaceToAccount(session: Session) {
  const guestScope = createStorageScope(null);
  const userScope = createStorageScope(session.user.id);
  const guestJobs = loadJobs(guestScope);
  const guestDrafts = loadImportDrafts(guestScope);
  const guestProfile = loadCandidateProfile(guestScope);
  const userJobs = loadJobs(userScope);
  const mergedJobs = mergeJobsByUpdatedAt(userJobs, guestJobs);

  if (guestJobs.length) {
    saveJobs(mergedJobs, userScope);
    await upsertCloudJobs(session, mergedJobs);
  }

  const userProfile = loadCandidateProfile(userScope);
  const mergedProfile = mergeCandidateProfile(userProfile, guestProfile);

  if (hasProfileData(guestProfile)) {
    saveCandidateProfile(mergedProfile, userScope);
    await upsertCloudCandidateProfile(session, mergedProfile);
  }

  const mergedDrafts = mergeImportDrafts(
    loadImportDrafts(userScope),
    guestDrafts
  );

  if (mergedDrafts.length) {
    saveImportDrafts(mergedDrafts, userScope);
  }

  const summary = {
    draftCount: guestDrafts.length,
    jobCount: guestJobs.length,
    profileFieldCount: Object.values(guestProfile).filter((value) =>
      value.trim()
    ).length,
    totalItems:
      guestJobs.length +
      guestDrafts.length +
      Object.values(guestProfile).filter((value) => value.trim()).length
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(GUEST_WORKSPACE_IMPORTED_EVENT));
  }

  return summary;
}

export function readCloudSyncIssue(): CloudSyncIssue | null {
  if (!canUseStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CLOUD_SYNC_ISSUE_KEY);
    return raw ? (JSON.parse(raw) as CloudSyncIssue) : null;
  } catch {
    return null;
  }
}

export function clearCloudSyncIssue() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(CLOUD_SYNC_ISSUE_KEY);
  window.dispatchEvent(new CustomEvent(CLOUD_SYNC_ISSUE_EVENT));
}

export function subscribeToCloudSyncIssues(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(CLOUD_SYNC_ISSUE_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(CLOUD_SYNC_ISSUE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function mergeJobsByUpdatedAt(localJobs: JobRecord[], cloudJobs: JobRecord[]) {
  const jobsById = new Map<string, JobRecord>();

  for (const job of [...localJobs, ...cloudJobs]) {
    const existing = jobsById.get(job.id);

    if (!existing || getTime(job.updated_at) >= getTime(existing.updated_at)) {
      jobsById.set(job.id, job);
    }
  }

  return [...jobsById.values()].sort(
    (a, b) => getTime(b.updated_at) - getTime(a.updated_at)
  );
}

function mergeCandidateProfile(
  userProfile: CandidateProfile,
  guestProfile: CandidateProfile
) {
  const merged = { ...userProfile };

  for (const key of Object.keys(guestProfile) as Array<keyof CandidateProfile>) {
    if (!merged[key]?.trim() && guestProfile[key]?.trim()) {
      merged[key] = guestProfile[key];
    }
  }

  return merged;
}

function hasProfileData(profile: CandidateProfile) {
  return Object.values(profile).some((value) => value.trim());
}

function mergeImportDrafts(
  userDrafts: ReturnType<typeof loadImportDrafts>,
  guestDrafts: ReturnType<typeof loadImportDrafts>
) {
  const draftsById = new Map<string, (typeof userDrafts)[number]>();

  for (const draft of [...userDrafts, ...guestDrafts]) {
    const existing = draftsById.get(draft.id);

    if (!existing || getTime(draft.updated_at) >= getTime(existing.updated_at)) {
      draftsById.set(draft.id, draft);
    }
  }

  return [...draftsById.values()].sort(
    (a, b) => getTime(b.updated_at) - getTime(a.updated_at)
  );
}

function getTime(value: string | undefined) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function recordCloudSyncIssue(message: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    CLOUD_SYNC_ISSUE_KEY,
    JSON.stringify({
      message,
      occurredAt: new Date().toISOString()
    } satisfies CloudSyncIssue)
  );
  window.dispatchEvent(new CustomEvent(CLOUD_SYNC_ISSUE_EVENT));
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
