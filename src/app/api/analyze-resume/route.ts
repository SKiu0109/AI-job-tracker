import { NextResponse } from "next/server";
import {
  getAiProvider,
  getAiProviderConfigStatus
} from "@/lib/ai/job-analysis-provider";
import { normalizeCandidateProfile } from "@/lib/candidate-profile";
import {
  extractResumeText,
  ResumeTextExtractionError
} from "@/lib/resume/extract-resume-text";
import {
  createAiCreditContext,
  createAiCreditResponse,
  getLatestAiCredits,
  refundAiCredit,
  reserveAiCredit,
  toPublicCredits
} from "@/lib/server/ai-credit-usage";
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

  const language = parseLanguage(formData.get("language"));
  const resume = formData.get("resume");

  if (!(resume instanceof File)) {
    return NextResponse.json(
      {
        code: "resume_required",
        error: localizeResumeError(
          "Resume file is required.",
          "resume_required",
          language
        )
      },
      { status: 400 }
    );
  }

  const currentProfile = parseCurrentProfile(formData.get("current_profile"));
  let extracted: Awaited<ReturnType<typeof extractResumeText>>;

  try {
    extracted = await extractResumeText(resume);
  } catch (error) {
    if (error instanceof ResumeTextExtractionError) {
      return NextResponse.json(
        {
          code: error.code,
          error: localizeResumeError(error.message, error.code, language)
        },
        { status: 400 }
      );
    }

    console.error("Resume text extraction failed", error);

    return NextResponse.json(
      {
        code: "resume_analysis_failed",
        error: localizeResumeError(
          "Resume analysis failed. Please try again.",
          "resume_analysis_failed",
          language
        )
      },
      { status: 500 }
    );
  }

  let creditContext: Awaited<ReturnType<typeof createAiCreditContext>>;

  try {
    creditContext = await createAiCreditContext(request);
  } catch (error) {
    console.error(
      "Credit storage unavailable",
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json(
      {
        code: "credits_unavailable",
        error: localizeResumeError(
          "Credit storage is unavailable. Please check Supabase server configuration.",
          "credits_unavailable",
          language
        )
      },
      { status: 503 }
    );
  }

  const providerStatus = getAiProviderConfigStatus({
    useAdminConfig: creditContext.isAdmin
  });

  if (!providerStatus.configured) {
    return createAiCreditResponse(
      creditContext,
      {
        code: "missing_api_key",
        credits: toPublicCredits(creditContext.currentCredits),
        error: localizeResumeError(
          "AI resume analysis is not configured yet. Add the provider API key to .env.local and restart the dev server.",
          "missing_api_key",
          language
        )
      },
      { status: 503 }
    );
  }

  const reservation = await reserveAiCredit(creditContext);

  if (!reservation) {
    return createAiCreditResponse(
      creditContext,
      {
        code: "credits_exhausted",
        credits: toPublicCredits(creditContext.currentCredits),
        error: localizeResumeError(
          "Your AI credits have been used. Resume analysis requires 1 credit.",
          "credits_exhausted",
          language
        )
      },
      { status: 402 }
    );
  }

  try {
    const provider = getAiProvider({
      useAdminConfig: creditContext.isAdmin
    });
    const analysis = await provider.analyzeResumeProfile({
      resumeText: extracted.text,
      currentProfile,
      language
    });

    return createAiCreditResponse(creditContext, {
      analysis,
      credits: toPublicCredits(await getLatestAiCredits(creditContext)),
      file_name: extracted.fileName,
      file_type: extracted.fileType,
      was_truncated: extracted.wasTruncated,
      extracted_text_preview: extracted.text.slice(0, 900)
    });
  } catch (error) {
    await refundAiCredit(reservation);

    if (isMissingApiKeyError(error)) {
      return createAiCreditResponse(
        creditContext,
        {
          code: "missing_api_key",
          credits: toPublicCredits(await getLatestAiCredits(creditContext)),
          error: localizeResumeError(
            "AI resume analysis is not configured yet. Add the provider API key to .env.local and restart the dev server.",
            "missing_api_key",
            language
          )
        },
        { status: 503 }
      );
    }

    console.error("Resume analysis failed", error);

    return createAiCreditResponse(
      creditContext,
      {
        code: "resume_analysis_failed",
        credits: toPublicCredits(await getLatestAiCredits(creditContext)),
        error: localizeResumeError(
          error instanceof Error
            ? error.message
            : "Resume analysis failed. Please try again.",
          "resume_analysis_failed",
          language
        )
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

function parseLanguage(value: FormDataEntryValue | null): "en" | "zh" {
  return value === "zh" ? "zh" : "en";
}

function localizeResumeError(
  fallback: string,
  code: string,
  language: "en" | "zh"
) {
  if (language === "en") return fallback;

  const messages: Record<string, string> = {
    missing_api_key: "AI 简历分析尚未配置。请在 .env.local 中添加服务商 API Key 并重启开发服务。",
    credits_exhausted: "AI 点数已用完。简历分析需要消耗 1 点。",
    credits_unavailable: "额度存储暂时不可用。请检查 Supabase 服务端配置。",
    resume_analysis_failed: "简历分析失败，请稍后重试。",
    resume_required: "请先上传简历文件。",
    resume_text_empty: "无法从这份简历中提取足够文本。暂不支持扫描版 PDF。",
    resume_too_large: "简历文件过大，请上传 5 MB 以内的文件。",
    unsupported_file_type: "暂不支持该简历格式。请上传 .docx 或基于文本的 .pdf 文件。"
  };

  return messages[code] || fallback;
}

function isMissingApiKeyError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("api_key") &&
    error.message.toLowerCase().includes("not configured")
  );
}
