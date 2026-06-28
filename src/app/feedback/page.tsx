"use client";

import { FormEvent, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { StarRating } from "@/components/ui/star-rating";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import type { FeedbackResponse } from "@/types/product-validation";

export default function FeedbackPage() {
  const { language, t } = useLanguage();
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [feedback, setFeedback] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const markTouched = useCallback(
    (field: string) => {
      if (touched.has(field)) return;
      setTouched((prev) => new Set(prev).add(field));
    },
    [touched]
  );

  const goalValid = goal.trim().length >= 8;
  const goalShowError = touched.has("goal") && goal.trim().length > 0 && !goalValid;
  const feedbackValid = feedback.trim().length >= 20;
  const feedbackShowError =
    touched.has("feedback") && feedback.trim().length > 0 && !feedbackValid;
  const emailValid =
    !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailShowError =
    touched.has("email") && email.trim().length > 0 && !emailValid;

  const canSubmit =
    goalValid && feedbackValid && emailValid && status !== "submitting";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          goal,
          feedback,
          email,
          rating,
          language,
          path: "/feedback"
        })
      });
      const payload = (await response.json()) as FeedbackResponse;
      if (!response.ok || !payload.ok)
        throw new Error(payload.error || t.feedbackError);
      trackProductEvent("feedback_submitted", {
        rating,
        hasEmail: Boolean(email.trim())
      });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : t.feedbackError
      );
    }
  };

  const ratingLabels = [
    t.feedbackRating1,
    t.feedbackRating2,
    t.feedbackRating3,
    t.feedbackRating4,
    t.feedbackRating5
  ];

  /* ---- Success state with checkmark animation ---- */
  if (status === "success") {
    return (
      <div className="mx-auto max-w-lg animate-fade-in-up">
        <div className="rounded-2xl border bg-tertiary p-10 sm:p-12 text-center space-y-6 shadow-panel">
          <svg
            className="mx-auto checkmark-draw"
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
          >
            <circle
              cx="32"
              cy="32"
              r="29"
              stroke="#3B6D11"
              strokeWidth="3"
              fill="#EAF3DE"
              className="checkmark-circle"
            />
            <path
              d="M20 32l8 8 16-16"
              stroke="#3B6D11"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              className="checkmark-path"
            />
          </svg>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-primary">
              {t.feedbackSuccessTitle}
            </h2>
            <p className="mt-2 text-sm text-secondary max-w-sm mx-auto leading-relaxed">
              {t.feedbackSuccessSubtitle}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Form state ---- */
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-tertiary mb-2">
          {t.feedbackEyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {t.feedbackTitle}
        </h1>
        <p className="mt-2 text-sm text-secondary max-w-md mx-auto leading-relaxed">
          {t.feedbackIntro}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Card 1: About you */}
        <div className="rounded-2xl border bg-tertiary p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#378ADD"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-primary">
              {t.feedbackSectionAbout}
            </h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-role">{t.feedbackRoleLabel}</Label>
            <Input
              id="feedback-role"
              value={role}
              maxLength={120}
              onChange={(e) => setRole(e.target.value)}
              placeholder={t.feedbackRolePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-goal">
              {t.feedbackGoalLabel}
            </Label>
            <Textarea
              id="feedback-goal"
              value={goal}
              minLength={8}
              maxLength={400}
              rows={3}
              required
              onChange={(e) => setGoal(e.target.value)}
              onBlur={() => markTouched("goal")}
              placeholder={t.feedbackGoalPlaceholder}
              className={goalShowError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}
            />
            <div className="flex items-center justify-between text-xs">
              {goalShowError ? (
                <span className="text-red-500">{t.feedbackMinGoal}</span>
              ) : goal.trim().length > 0 && goalValid ? (
                <span className="flex items-center gap-1 text-green-600">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {goal.trim().length}/{400} {t.feedbackCharCount}
                </span>
              ) : (
                <span className="text-tertiary">{t.feedbackMinGoal}</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Your feedback */}
        <div className="rounded-2xl border bg-tertiary p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-50">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7F77DD"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-primary">
              {t.feedbackSectionFeedback}
            </h2>
          </div>

          <div className="space-y-2">
            <Label>{t.feedbackRatingLabel}</Label>
            <StarRating
              value={rating}
              onChange={setRating}
              labels={ratingLabels}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-body">
              {t.feedbackBodyLabel}
            </Label>
            <Textarea
              id="feedback-body"
              value={feedback}
              minLength={20}
              maxLength={2000}
              rows={6}
              required
              onChange={(e) => setFeedback(e.target.value)}
              onBlur={() => markTouched("feedback")}
              placeholder={t.feedbackBodyPlaceholder}
              className={feedbackShowError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}
            />
            <div className="flex items-center justify-between text-xs">
              {feedbackShowError ? (
                <span className="text-red-500">{t.feedbackMinBody}</span>
              ) : feedback.trim().length > 0 && feedbackValid ? (
                <span className="flex items-center gap-1 text-green-600">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {feedback.trim().length} / 2000 {t.feedbackCharCount}
                </span>
              ) : (
                <span className="text-tertiary">{t.feedbackMinBody}</span>
              )}
              <span
                className={`tabular-nums transition-colors duration-200 ${
                  feedback.trim().length >= 1800
                    ? "text-amber-600 font-medium"
                    : feedback.trim().length >= 1600
                      ? "text-amber-500"
                      : "text-tertiary"
                }`}
              >
                {feedback.trim().length} / 2000
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Stay in touch */}
        <div className="rounded-2xl border bg-tertiary p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-50">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1D9E75"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-primary">
              {t.feedbackSectionContact}
            </h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-email">
              {t.feedbackEmailLabel}
            </Label>
            <Input
              id="feedback-email"
              type="email"
              value={email}
              maxLength={160}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched("email")}
              placeholder={t.feedbackEmailPlaceholder}
              className={emailShowError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}
            />
            {emailShowError ? (
              <p className="text-xs text-red-500">{t.feedbackEmailInvalid}</p>
            ) : null}
          </div>

          {/* Privacy badge */}
          <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="mt-0.5 shrink-0"
            >
              <rect
                x="3"
                y="11"
                width="18"
                height="11"
                rx="2"
                stroke="#888780"
                strokeWidth="1.5"
              />
              <path
                d="M7 11V7a5 5 0 0 1 10 0v4"
                stroke="#888780"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="16" r="1" fill="#888780" />
            </svg>
            <p className="text-xs text-secondary leading-relaxed">
              {t.feedbackPrivacyBadge}
            </p>
          </div>
        </div>

        {/* Error message */}
        {message ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </div>
        ) : null}

        {/* Submit row */}
        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          {status === "submitting" ? t.feedbackSubmitting : t.feedbackSubmit}
        </Button>
      </form>
    </div>
  );
}
