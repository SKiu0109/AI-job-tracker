"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/ui/app-card";
import { Button } from "@/components/ui/button";
import { ANALYSIS_STEP_INTERVAL_MS } from "@/lib/constants";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { useAuth } from "@/lib/auth/auth-provider";
import { MAX_JD_TEXT_LENGTH, MIN_JD_TEXT_LENGTH } from "@/lib/credits/constants";
import { useGuestCredits } from "@/lib/credits/guest-credits-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import { SAMPLE_JD, SAMPLE_SOURCE_URL } from "@/lib/sample-jd";
import { formatCandidateProfile } from "@/lib/candidate-profile";
import { getCompanyLogoMetadata } from "@/lib/company-logo";
import { readCloudCachedAnalysis, upsertCloudJob, writeCloudCachedAnalysis } from "@/lib/storage/cloud-sync";
import { createAnalysisCacheKey, createInitialStatusHistory, readCachedAnalysis, saveJob, writeCachedAnalysis } from "@/lib/storage/jobs";
import { loadCandidateProfile } from "@/lib/storage/candidate-profile";
import { createStorageScope } from "@/lib/storage/scope";
import { cn } from "@/lib/utils";
import { ActionStage, JobAnalysis, JobRecord, TailoringStatus } from "@/types/job";
import type { CreditBalance } from "@/types/credits";

type AnalyzeResponse = { analysis?: JobAnalysis; cached?: boolean; credits?: CreditBalance; error?: string; message?: { en: string; zh: string }; raw_jd?: string; code?: "missing_api_key" | "analysis_failed" | "credits_exhausted" | "credits_unavailable" | "empty_jd" | "invalid_source_url" | "jd_too_short" | "jd_too_long" | "source_url_fetch_failed" };

export type HeroAnalyzeInputVariant = "compact" | "full" | "hero";

export type HeroAnalyzeInputProps = {
  analyticsSource?: string;
  className?: string;
  initialRawJd?: string;
  initialSourceUrl?: string;
  onJobSaved?: (job: JobRecord) => void;
  redirectAfterSave?: boolean;
  samplePrefilled?: boolean;
  showCreditsStatus?: boolean;
  showHeader?: boolean;
  variant?: HeroAnalyzeInputVariant;
};

type AnalysisProgressStep = {
  key: string;
  label: string;
  labelZh: string;
  detail: string;
  detailZh: string;
};

const ANALYSIS_PROGRESS_STEPS: AnalysisProgressStep[] = [
  {
    key: "reading",
    label: "Reading job page...",
    labelZh: "读取职位页面…",
    detail: "Parsing job description content and metadata",
    detailZh: "解析职位描述内容和元数据",
  },
  {
    key: "extracting",
    label: "Extracting details...",
    labelZh: "提取关键信息…",
    detail: "Identifying requirements, skills, tools, and qualifications",
    detailZh: "识别职责、技能、工具和资质要求",
  },
  {
    key: "evaluating",
    label: "Evaluating fit...",
    labelZh: "评估匹配度…",
    detail: "Comparing your profile against role requirements",
    detailZh: "将你的画像与岗位要求进行对比",
  },
  {
    key: "reporting",
    label: "Creating report...",
    labelZh: "生成分析报告…",
    detail: "Building your personalized action plan and insights",
    detailZh: "生成个性化行动计划和洞察",
  },
];

const LOADING_BUTTON_LABELS = ANALYSIS_PROGRESS_STEPS.map((s) => s.label);

export function HeroAnalyzeInput({
  analyticsSource = "add_job_form",
  className,
  initialRawJd = "",
  initialSourceUrl = "",
  onJobSaved,
  redirectAfterSave = true,
  samplePrefilled = false,
  showCreditsStatus = true,
  showHeader = true,
  variant = "full"
}: HeroAnalyzeInputProps) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { accountStatus, session } = useAuth();
  const { status: creditsStatus, refreshCredits, updateCredits } = useGuestCredits();
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [rawJd, setRawJd] = useState(initialRawJd);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(samplePrefilled ? t.sampleLoaded : "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => { setAnalysisStep((s) => (s + 1) % LOADING_BUTTON_LABELS.length); }, ANALYSIS_STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const creditsRemaining = creditsStatus ? `${creditsStatus.credits.remaining} / ${creditsStatus.credits.limit}` : "—";
  const hasAi = creditsStatus && !creditsStatus.demoMode;
  const jdLen = rawJd.trim().length;
  const jdValid = jdLen >= MIN_JD_TEXT_LENGTH && jdLen <= MAX_JD_TEXT_LENGTH;
  const hasSourceUrl = Boolean(sourceUrl.trim());
  const canAnalyze = jdValid || hasSourceUrl;
  const storageScope = createStorageScope(session?.user.id);

  const fillSampleJd = () => { setRawJd(SAMPLE_JD); setSourceUrl((c) => c || SAMPLE_SOURCE_URL); setError(""); setInfo(t.sampleLoaded); };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setInfo("");
    if (isAnalyzing) return;
    const rawJdText = rawJd.trim();
    const sourceUrlText = sourceUrl.trim();
    trackProductEvent("analyze_jd_clicked", { source: analyticsSource, jdLength: rawJdText.length, hasSourceUrl: Boolean(sourceUrl.trim()) });
    if (!rawJdText && !sourceUrlText) { setError(language === "zh" ? "请先粘贴职位链接或职位描述。" : "Please paste a job URL or job description before analyzing."); return; }
    if (rawJdText.length < MIN_JD_TEXT_LENGTH && !sourceUrlText) { setError(t.rawJdTooShort); return; }
    if (rawJdText.length > MAX_JD_TEXT_LENGTH) { setError(t.rawJdTooLong); return; }

    const candidateProfileText = formatCandidateProfile(
      loadCandidateProfile(storageScope)
    );
    const cacheKey = rawJdText.length >= MIN_JD_TEXT_LENGTH
      ? createAnalysisCacheKey(rawJdText, candidateProfileText, language)
      : null;
    const cachedAnalysis = cacheKey
      ? readCachedAnalysis(cacheKey, storageScope) ?? (await readCloudCachedAnalysis(session, cacheKey))
      : null;

    if (cachedAnalysis && cacheKey) {
      writeCachedAnalysis(cacheKey, cachedAnalysis, storageScope); setInfo(t.analysisCached);
      const job = createJobRecord({ analysis: cachedAnalysis, sourceUrl, rawJd: rawJdText });
      saveJob(job, storageScope); void upsertCloudJob(session, job);
      onJobSaved?.(job);
      trackProductEvent("job_added", { cached: true, matchScore: job.match_score, recommendation: job.application_recommendation });
      if (redirectAfterSave) {
        router.push(`/jobs/${job.id}`);
      } else {
        setInfo(language === "zh" ? "分析完成，已添加到机会追踪器。可在列表中打开详情查看完整报告。" : "Analysis complete. Added to the opportunity tracker. Open details from the list for the full report.");
      }
      return;
    }

    const latestCreditsStatus = await refreshCredits();
    if (!latestCreditsStatus) { setError(t.creditsUnavailable); return; }
    if (latestCreditsStatus.demoMode) { setError(t.demoModeAnalyzeUnavailable); return; }
    if (!accountStatus.credits.adminBypass && latestCreditsStatus.credits.remaining < latestCreditsStatus.credits.costPerAnalysis) { setError(t.creditsExhausted); return; }

    setIsAnalyzing(true); setAnalysisStep(0);
    try {
      const response = await fetch("/api/analyze-job", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ source_url: sourceUrlText || undefined, raw_jd: rawJdText || undefined, candidate_profile: candidateProfileText, language }) });
      const payload = (await response.json().catch(() => ({}))) as AnalyzeResponse;
      if (payload.credits) updateCredits(payload.credits);
      if (!response.ok || !payload.analysis) throw new Error(getAnalyzeErrorMessage(payload, language, t));
      const analyzedRawJd = payload.raw_jd?.trim() || rawJdText;
      const resolvedCacheKey = createAnalysisCacheKey(
        analyzedRawJd,
        candidateProfileText,
        language
      );
      writeCachedAnalysis(resolvedCacheKey, payload.analysis, storageScope); void writeCloudCachedAnalysis(session, resolvedCacheKey, payload.analysis);
      const job = createJobRecord({ analysis: payload.analysis, sourceUrl, rawJd: analyzedRawJd });
      saveJob(job, storageScope); void upsertCloudJob(session, job);
      onJobSaved?.(job);
      trackProductEvent("job_added", { cached: false, matchScore: job.match_score, recommendation: job.application_recommendation });
      if (redirectAfterSave) {
        router.push(`/jobs/${job.id}`);
      } else {
        setInfo(language === "zh" ? "分析完成，已添加到机会追踪器。可在列表中打开详情查看完整报告。" : "Analysis complete. Added to the opportunity tracker. Open details from the list for the full report.");
      }
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : t.analysisFailed); }
    finally { setIsAnalyzing(false); }
  };

  return (
    <div className={cn("app-stagger", getContainerClassName(variant), className)}>
      {/* Header */}
      {showHeader ? (
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-app-text-primary">{t.addJob}</h1>
        <p className="mt-1 text-[14px] text-app-text-secondary">{t.defaultProfileHint}</p>
      </div>
      ) : null}

      {/* AI / quota card */}
      {showCreditsStatus && creditsStatus ? (
        <AppCard as="section" className="p-4" variant="elevated">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {hasAi ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-success-soft text-app-success shadow-app-card ring-1 ring-app-success-border">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 16 16"><path d="M5 8.5l2 2 4-5M13.5 8a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/></svg>
                </span>
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-warning-soft text-app-warning shadow-app-card ring-1 ring-app-warning-border">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 16 16"><path d="M8 10V6M8 3v1M13.5 8a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/></svg>
                </span>
              )}
              <div>
                <p className="text-[13px] font-semibold text-app-text-primary">
                  {creditsStatus.demoMode ? t.demoModeLabel : (language === "zh" ? "AI 分析已启用" : "AI analysis ready")}
                </p>
                <p className="text-[12px] text-app-text-secondary">
                  {creditsStatus.demoMode ? t.demoModeMessage : creditsStatus ? t.realAiReady : t.creditsHelper}
                </p>
              </div>
            </div>
            {!accountStatus.credits.adminBypass ? (
              <span className="inline-flex items-center rounded-app border border-app-border-soft bg-app-surface px-3 py-1.5 text-[13px] font-medium text-app-text-secondary shadow-app-card backdrop-blur-xl">
                {language === "zh" ? "剩余额度" : "Credits"}: {creditsRemaining}
              </span>
            ) : (
              <span className="rounded-app border border-app-border-soft bg-app-surface px-3 py-1.5 text-[12px] text-app-text-tertiary shadow-app-card backdrop-blur-xl">{t.adminCreditsLabel}</span>
            )}
          </div>
        </AppCard>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className={cn("space-y-5", variant === "hero" && "space-y-4")}
      >
        {/* Main JD card */}
        <AppCard
          as="section"
          className={cn(
            "min-w-0 p-5",
            variant === "hero" && "p-4"
          )}
          variant="elevated"
        >
          <div className="space-y-2">
            <Label htmlFor="source-url">{t.sourceUrl}</Label>
            <Input id="source-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder={t.sourceUrlPlaceholder} />
          </div>

          <div className={cn("mt-5 space-y-2", variant === "hero" && "mt-4")}>
            <div className="flex items-center justify-between">
              <Label htmlFor="raw-jd">{t.rawJd}</Label>
              <button
                type="button"
                onClick={fillSampleJd}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-full border border-app-border-soft bg-app-surface px-3 text-[12px] font-semibold text-app-accent shadow-app-card transition duration-300 ease-[var(--app-motion-standard)] hover:-translate-y-px hover:bg-app-surface-hover hover:text-app-accent-hover active:translate-y-0 active:scale-[0.98]",
                  variant !== "hero" && "border-transparent bg-transparent px-0 shadow-none"
                )}
              >
                {t.useSampleJd}
              </button>
            </div>
            <Textarea id="raw-jd" value={rawJd} onChange={(e) => setRawJd(e.target.value)} placeholder={t.rawJdPlaceholder} maxLength={MAX_JD_TEXT_LENGTH} rows={getTextareaRows(variant)} required={!hasSourceUrl}
              className={getTextareaClassName(variant)} />
            <div className="flex flex-col gap-1 rounded-app border border-app-border-soft bg-app-surface px-3 py-2 text-[12px] sm:flex-row sm:items-center sm:justify-between">
              <span className="text-app-text-secondary">{language === "zh" ? "可粘贴职位链接，或粘贴完整 JD。JD 包含职责、要求、技能、地点和工作模式时分析更稳定。" : "Paste a job URL, or paste the full JD. Complete responsibilities, requirements, skills, location, and work mode improve accuracy."}</span>
              <span className="shrink-0 font-semibold text-app-text-tertiary">{jdLen} / {MAX_JD_TEXT_LENGTH}</span>
            </div>
            <p className="text-[12px] text-app-text-tertiary">{language === "zh" ? "建议长度：80–12,000 字符。支持英文 JD，分析会按当前页面语言输出。" : "80–12,000 characters. The analysis follows the current page language."}</p>
          </div>

          {variant === "hero" ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-app-border-soft pt-4 sm:flex-row sm:items-center sm:justify-between">
              {!isAnalyzing ? (
                <>
                  <p
                    className={cn(
                      "text-[12px] leading-5",
                      canAnalyze ? "text-score-high" : "text-app-text-secondary"
                    )}
                  >
                    {canAnalyze
                      ? language === "zh"
                        ? "输入已准备好，可以开始分析。"
                        : "Input is ready. Start the analysis when you are set."
                      : language === "zh"
                        ? `还需要至少 ${Math.max(MIN_JD_TEXT_LENGTH - jdLen, 0)} 个字符才能开始。`
                        : `${Math.max(MIN_JD_TEXT_LENGTH - jdLen, 0)} more characters needed to start.`}
                  </p>
                  <Button
                    type="submit"
                    disabled={!canAnalyze}
                    className="min-h-11 px-7 text-[14px] font-semibold shadow-app-card sm:min-w-[176px]"
                  >
                    {t.analyzeAndSaveJob}
                  </Button>
                </>
              ) : (
                <AnalysisProgressPanel
                  currentStep={analysisStep}
                  language={language}
                  steps={ANALYSIS_PROGRESS_STEPS}
                />
              )}
            </div>
          ) : null}
        </AppCard>

        {showCreditsStatus && creditsStatus && !creditsStatus.demoMode ? (
          <p className="rounded-lg border border-app-border-soft bg-app-surface px-4 py-3 text-[12px] leading-5 text-app-text-secondary shadow-app-card">
            {language === "zh"
              ? `新 AI 分析会消耗 ${creditsStatus.credits.costPerAnalysis} 次额度；如果命中已缓存分析，不会扣额度。`
              : `A new AI analysis costs ${creditsStatus.credits.costPerAnalysis} credit. Cached analyses do not spend credits.`}
          </p>
        ) : null}

        {error ? <div className="app-sheet-enter rounded-lg border border-score-low-border bg-score-low-bg px-4 py-3 text-[13px] font-medium text-score-low">{error}</div> : null}
        {info ? <div className="app-sheet-enter rounded-lg border border-score-high-border bg-score-high-bg px-4 py-3 text-[13px] font-medium text-score-high">{info}</div> : null}

        {variant !== "hero" ? (
          isAnalyzing ? (
            <AnalysisProgressPanel
              currentStep={analysisStep}
              language={language}
              steps={ANALYSIS_PROGRESS_STEPS}
            />
          ) : (
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!canAnalyze}
                className="min-h-12 px-8 text-[15px] font-medium sm:min-w-[176px]"
              >
                {t.analyzeAndSaveJob}
              </Button>
            </div>
          )
        ) : null}
      </form>
    </div>
  );
}

/* ── Helpers ── */

function getContainerClassName(variant: HeroAnalyzeInputVariant) {
  if (variant === "compact") {
    return "mx-auto max-w-3xl space-y-4";
  }

  if (variant === "hero") {
    return "mx-auto max-w-5xl space-y-3";
  }

  return "mx-auto max-w-4xl space-y-5";
}

function getTextareaRows(variant: HeroAnalyzeInputVariant) {
  if (variant === "compact") {
    return 8;
  }

  if (variant === "hero") {
    return 7;
  }

  return 16;
}

function getTextareaClassName(variant: HeroAnalyzeInputVariant) {
  if (variant === "compact") {
    return "min-h-[180px]";
  }

  if (variant === "hero") {
    return "min-h-[168px]";
  }

  return "min-h-[300px]";
}

function getAnalyzeErrorMessage(payload: AnalyzeResponse, language: "en" | "zh", t: ReturnType<typeof useLanguage>["t"]) {
  if (payload.message) return payload.message[language];
  switch (payload.code) {
    case "missing_api_key": return t.demoModeAnalyzeUnavailable;
    case "credits_exhausted": return t.creditsExhausted;
    case "credits_unavailable": return t.creditsUnavailable;
    case "empty_jd": return t.rawJdRequired;
    case "invalid_source_url": return payload.message?.[language] ?? payload.error ?? (language === "zh" ? "职位链接无效。" : "Invalid job URL.");
    case "jd_too_short": return t.rawJdTooShort;
    case "jd_too_long": return t.rawJdTooLong;
    case "source_url_fetch_failed": return payload.message?.[language] ?? payload.error ?? (language === "zh" ? "无法从该链接提取职位描述，请直接粘贴 JD。" : "Could not extract the job description from this URL. Please paste the JD.");
    case "analysis_failed": return t.analysisFailed;
    default: return payload.error || t.analysisFailed;
  }
}

function createJobRecord({
  analysis,
  sourceUrl,
  rawJd
}: {
  analysis: JobAnalysis;
  sourceUrl: string;
  rawJd: string;
}): JobRecord {
  const now = new Date().toISOString();
  const trimmedSourceUrl = sourceUrl.trim();
  const logoMetadata = getCompanyLogoMetadata(trimmedSourceUrl);
  const actionStage = deriveActionStage(analysis);
  const tailoringDraft = analysis.resume_tailoring_draft ?? {
    summary_en: buildDefaultSummaryDraft(analysis),
    bullets_en: analysis.resume_tailoring_advice_en.slice(0, 3),
    keywords: analysis.resume_keywords.slice(0, 8),
    explanation_zh:
      analysis.resume_tailoring_advice_zh[0] ||
      analysis.recommended_next_action.reason_zh,
    risk_notes_zh: analysis.red_flags_zh.slice(0, 2)
  };
  const tailoringStatus: TailoringStatus =
    tailoringDraft.summary_en || tailoringDraft.bullets_en.length || tailoringDraft.keywords.length
      ? "draft_ready"
      : "not_started";

  return { ...analysis, resume_tailoring_draft: tailoringDraft, id: createId(), application_status: "Not Applied", application_deadline: "", application_channel: "", contact_person: "", interview_date: "", follow_up_date: "", action_stage: actionStage, tailoring_status: tailoringStatus, next_step_note: deriveNextStepNote(actionStage), follow_up_notes: "", status_history: createInitialStatusHistory(now), ...logoMetadata, source_url: trimmedSourceUrl, raw_jd: rawJd, notes: "", created_at: now, updated_at: now };
}

function deriveActionStage(analysis: JobAnalysis): ActionStage {
  if (analysis.recommended_next_action.action === "Apply now" && analysis.match_score >= 75) {
    return "ready_to_apply";
  }

  if (analysis.recommended_next_action.action === "Tailor resume first") {
    return "tailor_resume";
  }

  if (
    analysis.recommended_next_action.action === "Save for later" ||
    analysis.recommended_next_action.action === "Skip"
  ) {
    return "parked";
  }

  return "needs_review";
}

function deriveNextStepNote(stage: ActionStage) {
  if (stage === "ready_to_apply") {
    return "Review final resume keywords and submit today.";
  }

  if (stage === "tailor_resume") {
    return "Draft a targeted summary and 2-3 role-specific bullets.";
  }

  if (stage === "parked") {
    return "Keep as lower priority unless the fit or timeline changes.";
  }

  return "Review fit evidence and decide whether this role deserves time.";
}

function buildDefaultSummaryDraft(analysis: JobAnalysis) {
  const strengths = analysis.key_strengths_en.slice(0, 2).join(", ");
  const keywords = analysis.resume_keywords.slice(0, 3).join(", ");
  const role = analysis.job_title_en || analysis.job_title_original;

  if (strengths && keywords) {
    return `Position the resume around ${strengths}, with clear evidence of ${keywords} for ${role}.`;
  }

  return `Tailor the resume summary and project bullets to mirror the strongest requirements in ${role}.`;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ── Analysis Progress Panel ── */

function AnalysisProgressPanel({
  currentStep,
  language,
  steps,
}: {
  currentStep: number;
  language: "en" | "zh";
  steps: AnalysisProgressStep[];
}) {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-app-accent text-white shadow-app-card">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-app-text-primary">
            {language === "zh"
              ? steps[currentStep].labelZh
              : steps[currentStep].label}
          </p>
          <p className="text-[12px] text-app-text-secondary">
            {language === "zh"
              ? steps[currentStep].detailZh
              : steps[currentStep].detail}
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-1.5">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isCurrent = index === currentStep;

              return (
                <div
                  className="flex flex-1 items-center gap-1.5"
                  key={step.key}
                >
                  <div
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors duration-500",
                      isCurrent && "progress-shimmer"
                    )}
                    style={{
                      backgroundColor: isComplete
                        ? "var(--app-accent)"
                        : isCurrent
                          ? "var(--app-accent)"
                          : "var(--app-border)",
                    }}
                  />
              {index < steps.length - 1 ? (
                <div
                  className="h-1 flex-1 rounded-full transition-colors duration-500"
                  style={{
                    backgroundColor: isComplete ? "var(--app-accent)" : "var(--app-border)",
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div className="flex justify-between text-[10px] font-medium text-app-text-tertiary">
        {steps.map((step, index) => (
          <span
            className={index <= currentStep ? "text-app-text-secondary" : ""}
            key={step.key}
          >
            {language === "zh" ? step.labelZh : step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
