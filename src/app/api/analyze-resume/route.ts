import { NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai/job-analysis-provider";
import { normalizeCandidateProfile } from "@/lib/candidate-profile";
import {
  extractResumeText,
  ResumeTextExtractionError
} from "@/lib/resume/extract-resume-text";
import type { CandidateProfile } from "@/types/job";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { code: "invalid_form_data", error: "Invalid form data." },
      { status: 400 }
    );
  }

  const resume = formData.get("resume");

  if (!(resume instanceof File)) {
    return NextResponse.json(
      { code: "resume_required", error: "Resume file is required." },
      { status: 400 }
    );
  }

  try {
    const currentProfile = parseCurrentProfile(formData.get("current_profile"));
    const extracted = await extractResumeText(resume);
    const provider = getAiProvider();
    const analysis = await provider.analyzeResumeProfile({
      resumeText: extracted.text,
      currentProfile
    });

    return NextResponse.json({
      analysis,
      file_name: extracted.fileName,
      file_type: extracted.fileType,
      was_truncated: extracted.wasTruncated,
      extracted_text_preview: extracted.text.slice(0, 900)
    });
  } catch (error) {
    if (error instanceof ResumeTextExtractionError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: 400 }
      );
    }

    if (isMissingApiKeyError(error)) {
      return NextResponse.json(
        {
          code: "missing_api_key",
          error:
            "AI resume analysis is not configured yet. Add the provider API key to .env.local and restart the dev server."
        },
        { status: 503 }
      );
    }

    console.error("Resume analysis failed", error);

    return NextResponse.json(
      {
        code: "resume_analysis_failed",
        error:
          error instanceof Error
            ? error.message
            : "Resume analysis failed. Please try again."
      },
      { status: 500 }
    );
  }
}

function parseCurrentProfile(value: FormDataEntryValue | null): CandidateProfile {
  if (typeof value !== "string" || !value.trim()) {
    return normalizeCandidateProfile(null);
  }

  try {
    return normalizeCandidateProfile(JSON.parse(value) as Partial<CandidateProfile>);
  } catch {
    return normalizeCandidateProfile(null);
  }
}

function isMissingApiKeyError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("api_key") &&
    error.message.toLowerCase().includes("not configured")
  );
}
