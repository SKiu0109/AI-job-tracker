import { NextRequest, NextResponse } from "next/server";
import {
  applyGuestSessionCookie,
  getOrCreateGuestSession,
  GUEST_ID_COOKIE
} from "@/lib/server/guest-session";
import { getProductValidationService } from "@/lib/server/product-validation-service";
import type { FeedbackPayload, FeedbackResponse } from "@/types/product-validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let payload: FeedbackPayload;

  try {
    payload = await request.json();
  } catch {
    return feedbackError("Invalid feedback payload.", 400);
  }

  const validationError = validateFeedback(payload);

  if (validationError) {
    return feedbackError(validationError, 400);
  }

  const guestSession = getOrCreateGuestSession(
    request.cookies.get(GUEST_ID_COOKIE)?.value
  );
  const feedback = getProductValidationService().createFeedback(
    guestSession.guestId,
    {
      ...payload,
      email: payload.email?.trim() || undefined,
      role: payload.role.trim(),
      goal: payload.goal.trim(),
      feedback: payload.feedback.trim()
    }
  );

  const response = NextResponse.json<FeedbackResponse>({
    ok: true,
    feedbackId: feedback.id
  });
  applyGuestSessionCookie(response, guestSession.guestId);

  return response;
}

function validateFeedback(payload: FeedbackPayload) {
  if (!payload || typeof payload !== "object") {
    return "Invalid feedback payload.";
  }

  if (typeof payload.role !== "string" || payload.role.trim().length > 120) {
    return "Role must be 120 characters or fewer.";
  }

  if (
    typeof payload.goal !== "string" ||
    payload.goal.trim().length < 8 ||
    payload.goal.trim().length > 400
  ) {
    return "Goal must be between 8 and 400 characters.";
  }

  if (
    typeof payload.feedback !== "string" ||
    payload.feedback.trim().length < 20 ||
    payload.feedback.trim().length > 2000
  ) {
    return "Feedback must be between 20 and 2,000 characters.";
  }

  if (
    payload.email &&
    (typeof payload.email !== "string" ||
      payload.email.length > 160 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
  ) {
    return "Email is invalid.";
  }

  if (
    payload.rating !== undefined &&
    (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5)
  ) {
    return "Rating must be between 1 and 5.";
  }

  return "";
}

function feedbackError(error: string, status: number) {
  return NextResponse.json<FeedbackResponse>({ ok: false, error }, { status });
}
