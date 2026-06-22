"use client";

import {
  DEFAULT_CANDIDATE_PROFILE,
  normalizeCandidateProfile
} from "@/lib/candidate-profile";
import { CandidateProfile } from "@/types/job";

const PROFILE_STORAGE_KEY = "ai-bilingual-job-tracker.candidate-profile.v1";

export function loadCandidateProfile(): CandidateProfile {
  if (!canUseStorage()) {
    return DEFAULT_CANDIDATE_PROFILE;
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<CandidateProfile>) : null;
    return normalizeCandidateProfile(value);
  } catch {
    return DEFAULT_CANDIDATE_PROFILE;
  }
}

export function saveCandidateProfile(profile: CandidateProfile) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify(normalizeCandidateProfile(profile))
  );
}

export function resetCandidateProfile() {
  saveCandidateProfile(DEFAULT_CANDIDATE_PROFILE);
  return DEFAULT_CANDIDATE_PROFILE;
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
