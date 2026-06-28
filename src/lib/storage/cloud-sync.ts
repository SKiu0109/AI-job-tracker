"use client";

import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase-client";
import {
  loadCandidateProfile,
  saveCandidateProfile
} from "@/lib/storage/candidate-profile";
import { loadJobs, saveJobs } from "@/lib/storage/jobs";
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

export async function hydrateJobsFromCloud(session: Session | null) {
  if (!session) {
    return loadJobs();
  }

  const localJobs = loadJobs();
  const cloudJobs = await loadCloudJobs(session);

  if (cloudJobs === null) {
    return localJobs;
  }

  const mergedJobs = mergeJobs(localJobs, cloudJobs);
  saveJobs(mergedJobs);

  if (mergedJobs.length > 0) {
    void upsertCloudJobs(session, mergedJobs);
  }

  return mergedJobs;
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
  }
}

export async function hydrateCandidateProfileFromCloud(
  session: Session | null
) {
  if (!session) {
    return loadCandidateProfile();
  }

  const cloudProfile = await loadCloudCandidateProfile(session);

  if (cloudProfile === undefined) {
    return loadCandidateProfile();
  }

  if (cloudProfile) {
    saveCandidateProfile(cloudProfile);
    return loadCandidateProfile();
  }

  const localProfile = loadCandidateProfile();
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
  }
}

function mergeJobs(localJobs: JobRecord[], cloudJobs: JobRecord[]) {
  const jobsById = new Map<string, JobRecord>();

  [...cloudJobs, ...localJobs].forEach((job) => {
    const current = jobsById.get(job.id);

    if (!current || getTime(job.updated_at) > getTime(current.updated_at)) {
      jobsById.set(job.id, job);
    }
  });

  return Array.from(jobsById.values()).sort(
    (left, right) => getTime(right.updated_at) - getTime(left.updated_at)
  );
}

function getTime(value: string | undefined) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}
