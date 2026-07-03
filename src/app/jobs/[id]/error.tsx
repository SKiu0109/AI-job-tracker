"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function JobDetailError({
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
      title="Failed to load job details"
      description="Could not load this job listing. It may have been removed or there was a network error."
    />
  );
}
