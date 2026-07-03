"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function FollowUpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Failed to load follow-ups"
      description="Could not load your follow-up reminders. Please try again."
    />
  );
}
