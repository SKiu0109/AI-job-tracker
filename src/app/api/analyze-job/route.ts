import { NextResponse } from "next/server";
import {
  getAiProvider,
  getAiProviderConfigStatus
} from "@/lib/ai/job-analysis-provider";
import {
  createServerAnalysisCacheKey,
  readServerCachedAnalysis,
  writeServerCachedAnalysis
} from "@/lib/server/analysis-cache";
import { validateRawJd } from "@/lib/validation/job-analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeJobRequest = {
  raw_jd?: string;
  source_url?: string;
  candidate_profile?: string;
};

type BilingualMessage = {
  en: string;
  zh: string;
};

const ERROR_MESSAGES = {
  invalid_json: {
    en: "Invalid JSON request body.",
    zh: "请求内容格式不正确。"
  },
  empty_jd: {
    en: "Please paste the job description before analyzing.",
    zh: "请先粘贴岗位描述。"
  },
  jd_too_short: {
    en: "Please paste a more complete job description before analyzing.",
    zh: "请粘贴更完整的岗位描述后再分析。"
  },
  jd_too_long: {
    en: "Job description is too long. Please keep it under 12,000 characters.",
    zh: "岗位描述过长，请控制在 12,000 个字符以内。"
  },
  missing_api_key: {
    en: "Demo mode is active. Configure an API key to run real AI JD analysis.",
    zh: "当前为演示模式。如需真实 AI 岗位分析，请配置 API Key。"
  },
  analysis_failed: {
    en: "The AI provider could not complete this analysis. Please try again later.",
    zh: "AI 服务暂时无法完成分析，请稍后再试。"
  }
} satisfies Record<string, BilingualMessage>;

export async function POST(request: Request) {
  let body: AnalyzeJobRequest;

  try {
    body = (await request.json()) as AnalyzeJobRequest;
  } catch {
    return jsonError("invalid_json", ERROR_MESSAGES.invalid_json, 400);
  }

  const validation = validateRawJd(body.raw_jd);

  if (!validation.ok) {
    return jsonError(validation.code, ERROR_MESSAGES[validation.code], 400);
  }

  const rawJd = validation.rawJd;
  const candidateProfile = body.candidate_profile?.trim() ?? "";
  const cacheKey = createServerAnalysisCacheKey(rawJd, candidateProfile);
  const cachedAnalysis = readServerCachedAnalysis(cacheKey);

  if (cachedAnalysis) {
    return NextResponse.json({
      analysis: cachedAnalysis,
      cached: true
    });
  }

  const providerStatus = getAiProviderConfigStatus();

  if (!providerStatus.configured) {
    return NextResponse.json(
      {
        code: "missing_api_key",
        error: ERROR_MESSAGES.missing_api_key.en,
        message: ERROR_MESSAGES.missing_api_key
      },
      { status: 503 }
    );
  }

  try {
    const provider = getAiProvider();
    const analysis = await provider.analyzeJob({
      rawJd,
      sourceUrl: body.source_url,
      candidateProfile
    });

    writeServerCachedAnalysis(cacheKey, analysis);

    return NextResponse.json({
      analysis,
      cached: false
    });
  } catch (error) {
    if (isMissingApiKeyError(error)) {
      return NextResponse.json(
        {
          code: "missing_api_key",
          error: ERROR_MESSAGES.missing_api_key.en,
          message: ERROR_MESSAGES.missing_api_key
        },
        { status: 503 }
      );
    }

    console.error(
      "Job analysis failed",
      error instanceof Error ? error.message : String(error),
      error instanceof Error && error.stack ? error.stack.slice(0, 500) : ""
    );

    return NextResponse.json(
      {
        code: "analysis_failed",
        error: ERROR_MESSAGES.analysis_failed.en,
        message: ERROR_MESSAGES.analysis_failed
      },
      { status: 500 }
    );
  }
}

function jsonError(code: string, message: BilingualMessage, status: number) {
  return NextResponse.json(
    {
      code,
      error: message.en,
      message
    },
    { status }
  );
}

function isMissingApiKeyError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("api_key") &&
    error.message.toLowerCase().includes("not configured")
  );
}
