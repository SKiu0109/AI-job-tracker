const FALLBACK_APP_ORIGIN = "http://localhost:3000";

export function getAuthRedirectUrl(path = "/login") {
  const currentOrigin =
    typeof window === "undefined" ? "" : window.location.origin;

  if (currentOrigin && isLocalOrigin(currentOrigin) && process.env.NODE_ENV !== "production") {
    return joinOriginAndPath(currentOrigin, path);
  }

  const configuredOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);

  return joinOriginAndPath(
    configuredOrigin || currentOrigin || FALLBACK_APP_ORIGIN,
    path
  );
}

function normalizeOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function joinOriginAndPath(origin: string, path: string) {
  return `${origin.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function isLocalOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
