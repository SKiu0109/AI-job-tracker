"use client";

import {
  EMPTY_CANDIDATE_PROFILE,
  normalizeCandidateProfile
} from "@/lib/candidate-profile";
import {
  getScopedStorageKey,
  isUserStorageScope,
  type StorageScope
} from "@/lib/storage/scope";
import { CandidateProfile } from "@/types/job";

const PROFILE_STORAGE_KEY = "ai-bilingual-job-tracker.candidate-profile.v1";

export function loadCandidateProfile(scope?: StorageScope): CandidateProfile {
  if (!canUseStorage()) {
    return { ...EMPTY_CANDIDATE_PROFILE };
  }

  try {
    const raw = readScopedStorageValue(PROFILE_STORAGE_KEY, scope);
    if (!raw) return { ...EMPTY_CANDIDATE_PROFILE };
    const value = JSON.parse(raw) as Partial<CandidateProfile>;
    return normalizeCandidateProfile(value);
  } catch {
    return { ...EMPTY_CANDIDATE_PROFILE };
  }
}

export function saveCandidateProfile(
  profile: CandidateProfile,
  scope?: StorageScope
) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    getScopedStorageKey(PROFILE_STORAGE_KEY, scope),
    JSON.stringify(normalizeCandidateProfile(profile))
  );
}

export function resetCandidateProfile(scope?: StorageScope) {
  const emptyProfile = { ...EMPTY_CANDIDATE_PROFILE };
  saveCandidateProfile(emptyProfile, scope);
  return emptyProfile;
}

function readScopedStorageValue(baseKey: string, scope?: StorageScope) {
  const scopedKey = getScopedStorageKey(baseKey, scope);
  const scopedValue = window.localStorage.getItem(scopedKey);

  if (scopedValue || isUserStorageScope(scope)) {
    return scopedValue;
  }

  const legacyValue = window.localStorage.getItem(baseKey);

  if (legacyValue) {
    window.localStorage.setItem(scopedKey, legacyValue);
    window.localStorage.removeItem(baseKey);
  }

  return legacyValue;
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
