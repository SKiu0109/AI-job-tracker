"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-controls";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import type { FeedbackResponse } from "@/types/product-validation";

const RATINGS = [5, 4, 3, 2, 1];

export default function FeedbackPage() {
  const { language, t } = useLanguage();
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [feedback, setFeedback] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState("5");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          rating: Number(rating),
          language,
          path: "/feedback"
        })
      });
      const payload = (await response.json()) as FeedbackResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || t.feedbackError);
      }

      trackProductEvent("feedback_submitted", {
        rating: Number(rating),
        hasEmail: Boolean(email.trim())
      });
      setStatus("success");
      setMessage(t.feedbackSuccess);
      setGoal("");
      setFeedback("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.feedbackError);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-panel border border-line bg-white p-5 shadow-panel sm:p-6">
        <p className="text-sm font-semibold text-accent">{t.feedbackEyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">
          {t.feedbackTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
          {t.feedbackIntro}
        </p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="rounded-panel border border-line bg-white p-5 shadow-panel sm:p-6"
      >
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="feedback-role">{t.feedbackRoleLabel}</Label>
            <Input
              id="feedback-role"
              value={role}
              maxLength={120}
              onChange={(event) => setRole(event.target.value)}
              placeholder={t.feedbackRolePlaceholder}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-goal">{t.feedbackGoalLabel}</Label>
            <Textarea
              id="feedback-goal"
              value={goal}
              minLength={8}
              maxLength={400}
              rows={3}
              required
              onChange={(event) => setGoal(event.target.value)}
              placeholder={t.feedbackGoalPlaceholder}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-body">{t.feedbackBodyLabel}</Label>
            <Textarea
              id="feedback-body"
              value={feedback}
              minLength={20}
              maxLength={2000}
              rows={7}
              required
              onChange={(event) => setFeedback(event.target.value)}
              placeholder={t.feedbackBodyPlaceholder}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
            <div className="grid gap-2">
              <Label htmlFor="feedback-email">{t.feedbackEmailLabel}</Label>
              <Input
                id="feedback-email"
                type="email"
                value={email}
                maxLength={160}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.feedbackEmailPlaceholder}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feedback-rating">{t.feedbackRatingLabel}</Label>
              <Select
                id="feedback-rating"
                value={rating}
                onChange={(event) => setRating(event.target.value)}
              >
                {RATINGS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {message ? (
            <p
              className={
                status === "success"
                  ? "rounded-app border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
                  : "rounded-app border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
              }
            >
              {message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? t.feedbackSubmitting : t.feedbackSubmit}
            </Button>
            <p className="text-sm leading-6 text-muted">{t.feedbackPrivacy}</p>
          </div>
        </div>
      </form>
    </div>
  );
}
