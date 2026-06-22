import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai/job-analysis-provider";

export const runtime = "nodejs";

type AnalyzeJobRequest = {
  raw_jd?: string;
  source_url?: string;
  candidate_profile?: string;
};

export async function POST(request: Request) {
  let body: AnalyzeJobRequest;

  try {
    body = (await request.json()) as AnalyzeJobRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const rawJd = body.raw_jd?.trim();

  if (!rawJd) {
    return NextResponse.json(
      { error: "raw_jd is required." },
      { status: 400 }
    );
  }

  try {
    const provider = getAiProvider();

    // Future V2: add server-side caching here using a normalized raw_jd hash.
    const analysis = await provider.analyzeJob({
      rawJd,
      sourceUrl: body.source_url,
      candidateProfile: body.candidate_profile
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    if (isMissingApiKeyError(error)) {
      return NextResponse.json(
        {
          code: "missing_api_key",
          error:
            "AI analysis is not configured yet. Add OPENAI_API_KEY to .env.local and restart the dev server."
        },
        { status: 503 }
      );
    }

    console.error("Job analysis failed", error);

    return NextResponse.json(
      {
        code: "analysis_failed",
        error:
          error instanceof Error
            ? error.message
            : "Job analysis failed. Please try again."
      },
      { status: 500 }
    );
  }
}

function isMissingApiKeyError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("openai_api_key")
  );
}
