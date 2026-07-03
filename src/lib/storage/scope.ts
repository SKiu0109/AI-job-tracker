"use client";

export type StorageScope = {
  userId?: string | null;
};

export function createStorageScope(userId?: string | null): StorageScope {
  return { userId: userId?.trim() || null };
}

export function getScopedStorageKey(baseKey: string, scope?: StorageScope) {
  const userId = scope?.userId?.trim();
  return userId
    ? `${baseKey}.user.${encodeURIComponent(userId)}`
    : `${baseKey}.guest`;
}

export function isUserStorageScope(scope?: StorageScope) {
  return Boolean(scope?.userId?.trim());
}
