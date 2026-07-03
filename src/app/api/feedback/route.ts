import { NextRequest, NextResponse } from "next/server";
import {
  applyGuestSessionCookie,
  getOrCreateGuestSession,
  GUEST_ID_COOKIE
} from "@/lib/server/guest-session";
import { buildFeedbackBrief } from "@/lib/product/feedback-brief";
import { getProductValidationService } from "@/lib/server/product-validation-service";
import type {
  FeedbackResponse,
  FeedbackSubmissionPayload
} from "@/types/product-validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let payload: FeedbackSubmissionPayload;

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
  const email = payload.email?.trim() || undefined;
  const language = payload.language === "zh" ? "zh" : "en";
  const feedbackBrief = buildFeedbackBrief({
    areaLabel: payload.areaLabel.trim(),
    email,
    evidence: payload.evidence.trim(),
    expectedChange: payload.expectedChange.trim(),
    feedbackTypeLabel: payload.feedbackTypeLabel.trim(),
    goal: payload.goal.trim(),
    language,
    priorityLabel: payload.priorityLabel.trim(),
    rating: payload.rating,
    role: payload.role.trim()
  });

  const feedback = await getProductValidationService().createFeedback(
    guestSession.guestId,
    {
      email,
      feedback: feedbackBrief,
      role: payload.role.trim(),
      goal: payload.goal.trim(),
      language,
      path: payload.path.trim(),
      rating: payload.rating
    }
  );

  const response = NextResponse.json<FeedbackResponse>({
    ok: true,
    feedbackId: feedback.id
  });
  applyGuestSessionCookie(response, guestSession.guestId);

  return response;
}

function validateFeedback(payload: FeedbackSubmissionPayload) {
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

  if (!isBoundedString(payload.areaLabel, 1, 80)) {
    return "Area is invalid.";
  }

  if (!isBoundedString(payload.feedbackTypeLabel, 1, 80)) {
    return "Feedback type is invalid.";
  }

  if (!isBoundedString(payload.priorityLabel, 1, 40)) {
    return "Priority is invalid.";
  }

  if (
    typeof payload.evidence !== "string" ||
    payload.evidence.trim().length < 20 ||
    payload.evidence.trim().length > 900
  ) {
    return "Evidence must be between 20 and 900 characters.";
  }

  if (
    typeof payload.expectedChange !== "string" ||
    payload.expectedChange.trim().length < 8 ||
    payload.expectedChange.trim().length > 360
  ) {
    return "Expected change must be between 8 and 360 characters.";
  }

  if (payload.email !== undefined && payload.email !== null) {
    if (
      typeof payload.email !== "string" ||
      payload.email.length > 160 ||
      (payload.email.trim().length > 0 &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim()))
    ) {
      return "Email is invalid.";
    }
  }

  if (
    !Number.isInteger(payload.rating) ||
    payload.rating < 1 ||
    payload.rating > 5
  ) {
    return "Rating must be between 1 and 5.";
  }

  if (payload.language !== "en" && payload.language !== "zh") {
    return "Language is invalid.";
  }

  if (!isBoundedString(payload.path, 1, 120)) {
    return "Path is invalid.";
  }

  return "";
}

function isBoundedString(value: unknown, minLength: number, maxLength: number) {
  if (typeof value !== "string") {
    return false;
  }

  const length = value.trim().length;
  return length >= minLength && length <= maxLength;
}

function feedbackError(error: string, status: number) {
  return NextResponse.json<FeedbackResponse>({ ok: false, error }, { status });
}
