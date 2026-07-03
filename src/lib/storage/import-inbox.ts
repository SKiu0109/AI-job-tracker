"use client";

import {
  getScopedStorageKey,
  isUserStorageScope,
  type StorageScope
} from "@/lib/storage/scope";

const IMPORT_DRAFTS_STORAGE_KEY = "ai-bilingual-job-tracker.import-drafts.v1";

export type ImportDraftStatus = "active" | "archived";

export type ImportDraft = {
  id: string;
  title: string;
  source_url: string;
  raw_jd: string;
  status: ImportDraftStatus;
  created_at: string;
  updated_at: string;
};

export function loadImportDrafts(scope?: StorageScope): ImportDraft[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = readScopedStorageValue(IMPORT_DRAFTS_STORAGE_KEY, scope);
    const drafts = raw ? (JSON.parse(raw) as ImportDraft[]) : [];
    return Array.isArray(drafts)
      ? drafts.map(normalizeImportDraft).sort(compareDrafts)
      : [];
  } catch {
    return [];
  }
}

export function saveImportDraft(
  input: {
    id?: string;
    raw_jd: string;
    source_url?: string;
    title?: string;
  },
  scope?: StorageScope
) {
  const drafts = loadImportDrafts(scope);
  const now = new Date().toISOString();
  const existing = input.id
    ? drafts.find((draft) => draft.id === input.id)
    : undefined;
  const draft = normalizeImportDraft({
    id: existing?.id || input.id || createId(),
    title: input.title || existing?.title || deriveDraftTitle(input.raw_jd),
    source_url: input.source_url ?? existing?.source_url ?? "",
    raw_jd: input.raw_jd,
    status: existing?.status || "active",
    created_at: existing?.created_at || now,
    updated_at: now
  });
  const nextDrafts = [
    draft,
    ...drafts.filter((item) => item.id !== draft.id)
  ];

  writeImportDrafts(nextDrafts, scope);
  return draft;
}

export function archiveImportDraft(id: string, scope?: StorageScope) {
  const drafts = loadImportDrafts(scope);
  let archivedDraft: ImportDraft | undefined;
  const nextDrafts = drafts.map((draft) => {
    if (draft.id !== id) {
      return draft;
    }

    archivedDraft = {
      ...draft,
      status: "archived",
      updated_at: new Date().toISOString()
    };
    return archivedDraft;
  });

  writeImportDrafts(nextDrafts, scope);
  return archivedDraft;
}

export function deleteImportDraft(id: string, scope?: StorageScope) {
  writeImportDrafts(
    loadImportDrafts(scope).filter((draft) => draft.id !== id),
    scope
  );
}

export function saveImportDrafts(drafts: ImportDraft[], scope?: StorageScope) {
  writeImportDrafts(drafts, scope);
}

function writeImportDrafts(drafts: ImportDraft[], scope?: StorageScope) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    getScopedStorageKey(IMPORT_DRAFTS_STORAGE_KEY, scope),
    JSON.stringify(drafts.map(normalizeImportDraft))
  );
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

function normalizeImportDraft(value: ImportDraft): ImportDraft {
  const now = new Date().toISOString();
  const rawJd = asString(value.raw_jd);

  return {
    id: asString(value.id, createId()),
    title: asString(value.title, deriveDraftTitle(rawJd)),
    source_url: asString(value.source_url),
    raw_jd: rawJd,
    status: value.status === "archived" ? "archived" : "active",
    created_at: asString(value.created_at, now),
    updated_at: asString(value.updated_at, value.created_at || now)
  };
}

function compareDrafts(a: ImportDraft, b: ImportDraft) {
  return getTime(b.updated_at) - getTime(a.updated_at);
}

function deriveDraftTitle(rawJd: string) {
  const firstUsefulLine = rawJd
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstUsefulLine?.slice(0, 72) || "Untitled JD draft";
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}
