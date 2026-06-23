import "server-only";

import { randomUUID } from "crypto";
import type { NextResponse } from "next/server";

export const GUEST_ID_COOKIE = "ai-job-tracker-guest-id";

const GUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export function getOrCreateGuestSession(cookieValue: string | undefined) {
  const guestId = isValidGuestId(cookieValue) ? cookieValue : randomUUID();

  return {
    guestId,
    isNew: guestId !== cookieValue
  };
}

export function applyGuestSessionCookie(
  response: NextResponse,
  guestId: string
) {
  response.cookies.set(GUEST_ID_COOKIE, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}

function isValidGuestId(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    GUEST_ID_PATTERN.test(value)
  );
}
