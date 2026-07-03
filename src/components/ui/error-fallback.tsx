"use client";

import { useEffect } from "react";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. You can try again or go back.",
}: ErrorFallbackProps) {
  useEffect(() => {
    console.error("Error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="max-w-md text-center space-y-5">
        {/* 错误图标 */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-score-low-bg">
          <svg
            className="h-8 w-8 text-score-low"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-app-text-primary">{title}</h2>
          <p className="text-sm text-app-text-secondary">{description}</p>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-app-surface-muted p-3 text-left text-xs text-app-text-secondary">
              {error.message}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-sm bg-app-text-primary px-5 py-2.5 text-sm font-medium text-app-surface transition-colors hover:bg-app-text-secondary"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-sm border border-app-border-soft bg-app-surface px-5 py-2.5 text-sm font-medium text-app-text-primary transition-colors hover:bg-app-surface-hover"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
