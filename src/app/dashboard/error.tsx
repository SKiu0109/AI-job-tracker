"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function DashboardError({
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
      title="Failed to load dashboard"
      description="Could not load the dashboard analytics. Please try again."
    />
  );
}
