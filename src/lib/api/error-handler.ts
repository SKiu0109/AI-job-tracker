import { NextResponse } from "next/server";

/**
 * Wraps an API route handler with unified error handling.
 * Catches thrown errors and returns a 500 JSON response.
 */
export function apiHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse> | NextResponse
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      const result = handler(...args);
      return result instanceof Promise ? await result : result;
    } catch (error) {
      console.error(`[API Error]`, error);
      const message =
        error instanceof Error ? error.message : "Internal Server Error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
