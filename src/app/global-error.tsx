"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <ErrorFallback
          error={error}
          reset={reset}
          title="Application error"
          description="Something went wrong with the application. Please reload the page to try again."
        />
      </body>
    </html>
  );
}
