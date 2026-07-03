import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import net from "node:net";
import {
  getAiProvider,
  getAiProviderConfigStatus
} from "@/lib/ai/job-analysis-provider";
import {
  MAX_JD_TEXT_LENGTH,
  MIN_JD_TEXT_LENGTH
} from "@/lib/credits/constants";
import {
  createServerAnalysisCacheKey,
  readServerCachedAnalysis,
  writeServerCachedAnalysis
} from "@/lib/server/analysis-cache";
import {
  createAiCreditContext,
  createAiCreditResponse,
  getLatestAiCredits,
  refundAiCredit,
  reserveAiCredit,
  toPublicCredits
} from "@/lib/server/ai-credit-usage";
import { validateRawJd } from "@/lib/validation/job-analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeJobRequest = {
  raw_jd?: string;
  source_url?: string;
  candidate_profile?: string;
  language?: "en" | "zh";
};

type BilingualMessage = {
  en: string;
  zh: string;
};

type ResolveRawJdResult =
  | {
      ok: true;
      rawJd: string;
    }
  | {
      ok: false;
      code:
        | "empty_jd"
        | "invalid_source_url"
        | "jd_too_long"
        | "jd_too_short"
        | "source_url_fetch_failed";
      status: number;
    };

const ERROR_MESSAGES = {
  invalid_json: {
    en: "Invalid JSON request body.",
    zh: "请求内容格式不正确。"
  },
  empty_jd: {
    en: "Please paste a job URL or job description before analyzing.",
    zh: "请先粘贴职位链接或岗位描述。"
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
  credits_exhausted: {
    en: "Your 10 free guest credits have been used. Sample data and cached analyses are still available.",
    zh: "你的 10 次免费访客额度已用完。仍可使用示例数据和已缓存分析。"
  },
  credits_unavailable: {
    en: "Credit storage is unavailable. Please check Supabase server configuration before running paid AI analysis.",
    zh: "额度存储暂时不可用。请先检查 Supabase 服务端配置，再运行付费 AI 分析。"
  },
  analysis_failed: {
    en: "The AI provider could not complete this analysis. Please try again later.",
    zh: "AI 服务暂时无法完成分析，请稍后再试。"
  },
  invalid_source_url: {
    en: "Please enter a valid public http(s) job URL, or paste the job description directly.",
    zh: "请输入有效的公开 http(s) 职位链接，或直接粘贴职位描述。"
  },
  source_url_fetch_failed: {
    en: "Offerwise could not extract enough job description text from this link. Please paste the JD text directly.",
    zh: "Offerwise 无法从该链接提取足够的职位描述内容。请直接粘贴 JD 文本。"
  }
} satisfies Record<string, BilingualMessage>;

const JOB_URL_FETCH_TIMEOUT_MS = 10000;
const MAX_JOB_URL_REDIRECTS = 3;

export async function POST(request: Request) {
  let body: AnalyzeJobRequest;

  try {
    body = (await request.json()) as AnalyzeJobRequest;
  } catch {
    return jsonError("invalid_json", ERROR_MESSAGES.invalid_json, 400);
  }

  const language = parseLanguage(body.language);
  const resolvedRawJd = await resolveRawJd(body, language);

  if (!resolvedRawJd.ok) {
    return jsonError(
      resolvedRawJd.code,
      ERROR_MESSAGES[resolvedRawJd.code],
      resolvedRawJd.status,
      language
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
    return jsonError(
      "credits_unavailable",
      ERROR_MESSAGES.credits_unavailable,
      503,
      language
    );
  }

  const respond = (
    payload: Record<string, unknown>,
    init?: ResponseInit
  ) => createAiCreditResponse(creditContext, payload, init);
  const rawJd = resolvedRawJd.rawJd;
  const candidateProfile = body.candidate_profile?.trim() ?? "";
  const cacheKey = createServerAnalysisCacheKey(
    rawJd,
    candidateProfile,
    language
  );
  const cachedAnalysis = await readServerCachedAnalysis(cacheKey);

  if (cachedAnalysis) {
    return respond({
      analysis: cachedAnalysis,
      cached: true,
      raw_jd: rawJd,
      credits: toPublicCredits(creditContext.currentCredits)
    });
  }

  const providerStatus = getAiProviderConfigStatus({
    useAdminConfig: creditContext.isAdmin
  });

  if (!providerStatus.configured) {
    return respond(
      {
        code: "missing_api_key",
        error: ERROR_MESSAGES.missing_api_key[language],
        message: ERROR_MESSAGES.missing_api_key,
        credits: toPublicCredits(creditContext.currentCredits)
      },
      { status: 503 }
    );
  }

  const reservation = await reserveAiCredit(creditContext);

  if (!reservation) {
    return respond(
      {
        code: "credits_exhausted",
        error: ERROR_MESSAGES.credits_exhausted[language],
        message: ERROR_MESSAGES.credits_exhausted,
        credits: toPublicCredits(creditContext.currentCredits)
      },
      { status: 402 }
    );
  }

  try {
    const provider = getAiProvider({ useAdminConfig: creditContext.isAdmin });

    const analysis = await provider.analyzeJob({
      rawJd,
      sourceUrl: body.source_url,
      candidateProfile,
      language
    });

    await writeServerCachedAnalysis(cacheKey, analysis);

    return respond({
      analysis,
      cached: false,
      raw_jd: rawJd,
      credits: toPublicCredits(
        await getLatestAiCredits(creditContext)
      )
    });
  } catch (error) {
    await refundAiCredit(reservation);

    if (isMissingApiKeyError(error)) {
      return respond(
        {
          code: "missing_api_key",
          error: ERROR_MESSAGES.missing_api_key[language],
          message: ERROR_MESSAGES.missing_api_key,
          credits: toPublicCredits(
            await getLatestAiCredits(creditContext)
          )
        },
        { status: 503 }
      );
    }

    console.error(
      "Job analysis failed",
      error instanceof Error ? error.message : String(error),
      error instanceof Error && error.stack ? error.stack.slice(0, 500) : ""
    );

    return respond(
      {
        code: "analysis_failed",
        error: ERROR_MESSAGES.analysis_failed[language],
        message: ERROR_MESSAGES.analysis_failed,
        credits: toPublicCredits(
          await getLatestAiCredits(creditContext)
        )
      },
      { status: 500 }
    );
  }
}

function jsonError(
  code: string,
  message: BilingualMessage,
  status: number,
  language: "en" | "zh" = "en"
) {
  return NextResponse.json(
    {
      code,
      error: message[language],
      message
    },
    { status }
  );
}

function parseLanguage(value: unknown): "en" | "zh" {
  return value === "zh" ? "zh" : "en";
}

async function resolveRawJd(
  body: AnalyzeJobRequest,
  language: "en" | "zh"
): Promise<ResolveRawJdResult> {
  const validation = validateRawJd(body.raw_jd);
  const sourceUrl = body.source_url?.trim() ?? "";

  if (validation.ok) {
    return validation;
  }

  if (validation.code === "jd_too_long") {
    return {
      code: validation.code,
      ok: false,
      status: 400
    };
  }

  if (!sourceUrl) {
    return {
      code: validation.code,
      ok: false,
      status: 400
    };
  }

  try {
    const fetchedText = await fetchJobDescriptionFromUrl(sourceUrl);
    const fetchedValidation = validateRawJd(fetchedText);

    if (fetchedValidation.ok) {
      return fetchedValidation;
    }

    return {
      code:
        fetchedValidation.code === "jd_too_long"
          ? "jd_too_long"
          : "source_url_fetch_failed",
      ok: false,
      status: 422
    };
  } catch (error) {
    console.warn(
      "Job URL extraction failed",
      language,
      error instanceof Error ? error.message : String(error)
    );

    return {
      code: isInvalidSourceUrlError(error)
        ? "invalid_source_url"
        : "source_url_fetch_failed",
      ok: false,
      status: isInvalidSourceUrlError(error) ? 400 : 422
    };
  }
}

async function fetchJobDescriptionFromUrl(sourceUrl: string) {
  let url = await normalizePublicJobUrl(sourceUrl);

  for (let redirects = 0; redirects <= MAX_JOB_URL_REDIRECTS; redirects += 1) {
    await assertPublicHostname(url.hostname);

    const response = await fetch(url, {
      headers: {
        accept: "text/html,text/plain;q=0.9,*/*;q=0.5",
        "user-agent":
          "OfferwiseJobAnalyzer/1.0 (+https://github.com/SKiu0109/AI-bilingual-job-tracker)"
      },
      redirect: "manual",
      signal: AbortSignal.timeout(JOB_URL_FETCH_TIMEOUT_MS)
    });

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error("Redirect missing location header.");
      }

      url = await normalizePublicJobUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`Job URL returned HTTP ${response.status}.`);
    }

    const html = await response.text();
    const extracted = extractReadableText(html).slice(0, MAX_JD_TEXT_LENGTH);

    if (extracted.length < MIN_JD_TEXT_LENGTH) {
      throw new Error("Extracted job text was too short.");
    }

    return extracted;
  }

  throw new Error("Too many redirects while fetching job URL.");
}

async function normalizePublicJobUrl(sourceUrl: string) {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    throw new InvalidSourceUrlError("Invalid URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new InvalidSourceUrlError("Only http(s) URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new InvalidSourceUrlError("Credentials in URLs are not allowed.");
  }

  await assertPublicHostname(url.hostname);
  return url;
}

async function assertPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    throw new InvalidSourceUrlError("Local hostnames are not allowed.");
  }

  if (net.isIP(normalized)) {
    if (isPrivateIp(normalized)) {
      throw new InvalidSourceUrlError("Private IP addresses are not allowed.");
    }
    return;
  }

  const addresses = await lookup(normalized, { all: true });

  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new InvalidSourceUrlError("URL resolves to a private address.");
  }
}

function isPrivateIp(address: string) {
  if (net.isIP(address) === 6) {
    const value = address.toLowerCase();
    return (
      value === "::1" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe80:") ||
      value.startsWith("::ffff:127.") ||
      value.startsWith("::ffff:10.") ||
      value.startsWith("::ffff:192.168.")
    );
  }

  const parts = address.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function extractReadableText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isInvalidSourceUrlError(error: unknown) {
  return error instanceof InvalidSourceUrlError;
}

class InvalidSourceUrlError extends Error {}

function isMissingApiKeyError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("api_key") &&
    error.message.toLowerCase().includes("not configured")
  );
}
