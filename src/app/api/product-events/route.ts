import { NextRequest, NextResponse } from "next/server";
import {
  applyGuestSessionCookie,
  getOrCreateGuestSession,
  GUEST_ID_COOKIE
} from "@/lib/server/guest-session";
import { getProductValidationService } from "@/lib/server/product-validation-service";
import type { ProductEventPayload } from "@/types/product-validation";

export const runtime = "nodejs";

const EVENT_NAME_PATTERN = /^[a-z][a-z0-9_]{1,79}$/;

export async function POST(request: NextRequest) {
  let payload: ProductEventPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!isValidEvent(payload)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const guestSession = getOrCreateGuestSession(
    request.cookies.get(GUEST_ID_COOKIE)?.value
  );
  await getProductValidationService().recordEvent(guestSession.guestId, payload);

  const response = NextResponse.json({ ok: true });
  applyGuestSessionCookie(response, guestSession.guestId);

  return response;
}

function isValidEvent(payload: ProductEventPayload) {
  return (
    payload &&
    typeof payload.eventName === "string" &&
    EVENT_NAME_PATTERN.test(payload.eventName) &&
    typeof payload.path === "string" &&
    payload.path.length > 0 &&
    payload.path.length <= 240 &&
    typeof payload.language === "string" &&
    payload.language.length > 0 &&
    payload.language.length <= 12 &&
    typeof payload.occurredAt === "string" &&
    payload.occurredAt.length <= 40 &&
    (!payload.properties ||
      (typeof payload.properties === "object" &&
        JSON.stringify(payload.properties).length <= 2000))
  );
}
