"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function WorkspaceError({
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
      title="Failed to load workspace"
      description="Could not load your job list. Please try again."
    />
  );
}
