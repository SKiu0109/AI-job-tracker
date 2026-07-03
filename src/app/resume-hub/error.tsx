"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function ResumeHubError({
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
      title="Failed to load resume hub"
      description="Could not load your candidate profile and resume data. Please try again."
    />
  );
}
