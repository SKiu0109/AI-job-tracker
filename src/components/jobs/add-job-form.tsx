"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ANALYSIS_STEP_INTERVAL_MS } from "@/lib/constants";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { useLanguage } from "@/lib/i18n/language-provider";
import { SAMPLE_JD, SAMPLE_SOURCE_URL } from "@/lib/sample-jd";
import { formatCandidateProfile } from "@/lib/candidate-profile";
import { createAnalysisCacheKey, createInitialStatusHistory, readCachedAnalysis, saveJob, writeCachedAnalysis } from "@/lib/storage/jobs";
import { loadCandidateProfile } from "@/lib/storage/candidate-profile";
import { JobAnalysis, JobRecord } from "@/types/job";
import {
  MAX_JD_TEXT_LENGTH,
  MIN_JD_TEXT_LENGTH
} from "@/lib/validation/job-analysis";

type AnalyzeResponse = { analysis?: JobAnalysis; cached?: boolean; error?: string; message?: { en: string; zh: string }; code?: "missing_api_key" | "analysis_failed" | "empty_jd" | "jd_too_short" | "jd_too_long" };

const CHANNEL_CHIPS = ["公司官网", "LinkedIn", "Seek", "Indeed", "内推", "其他"];

const ANALYSIS_STEPS = [
  { en: "Parsing job description", zh: "解析岗位描述" },
  { en: "Matching skills & experience", zh: "匹配技能与经验" },
  { en: "Evaluating education fit", zh: "评估教育背景匹配度" },
  { en: "Analyzing industry alignment", zh: "分析行业契合度" },
  { en: "Generating score & recommendations", zh: "生成综合评分建议" },
];

const STEP_DETAILS = [
  { en: "Extracting role, requirements, and keywords from the job description.", zh: "从职位描述中提取岗位类型、要求和关键词。" },
  { en: "Comparing your technical skills and experience with the job requirements.", zh: "正在比较你的候选人画像与 JD 中的技能和经验要求。" },
  { en: "Checking education level match against the job posting.", zh: "正在对比 JD 中的学历要求与你的教育背景。" },
  { en: "Assessing industry alignment and domain knowledge fit.", zh: "正在分析行业契合度和领域知识匹配情况。" },
  { en: "Computing final match score and generating next-action recommendations.", zh: "正在计算综合匹配评分并生成下一步行动建议。" },
];

export function AddJobForm({ initialRawJd = "", initialSourceUrl = "", samplePrefilled = false }: { initialRawJd?: string; initialSourceUrl?: string; samplePrefilled?: boolean }) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [deadline, setDeadline] = useState("");
  const [applicationChannel, setApplicationChannel] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [rawJd, setRawJd] = useState(initialRawJd);
  const [notes, setNotes] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(samplePrefilled ? t.sampleLoaded : "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [optionalExpanded, setOptionalExpanded] = useState(false);

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => { setAnalysisStep((s) => (s + 1) % ANALYSIS_STEPS.length); }, ANALYSIS_STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const jdLen = rawJd.trim().length;
  const jdValid = jdLen >= MIN_JD_TEXT_LENGTH && jdLen <= MAX_JD_TEXT_LENGTH;

  const fillSampleJd = () => { setRawJd(SAMPLE_JD); setSourceUrl((c) => c || SAMPLE_SOURCE_URL); setError(""); setInfo(t.sampleLoaded); };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(""); setInfo("");
    const rawJdText = rawJd.trim();
    if (!rawJdText) { setError(t.rawJdRequired); return; }
    if (rawJdText.length < MIN_JD_TEXT_LENGTH) { setError(t.rawJdTooShort); return; }
    if (rawJdText.length > MAX_JD_TEXT_LENGTH) { setError(t.rawJdTooLong); return; }

    const candidateProfileText = formatCandidateProfile(loadCandidateProfile());
    const cacheKey = createAnalysisCacheKey(rawJdText, candidateProfileText);
    const cachedAnalysis = readCachedAnalysis(cacheKey);

    if (cachedAnalysis) {
      writeCachedAnalysis(cacheKey, cachedAnalysis); setInfo(t.analysisCached);
      const job = createJobRecord({ analysis: cachedAnalysis, sourceUrl, rawJd: rawJdText, notes, deadline, applicationChannel, contactPerson, interviewDate, followUpNotes });
      saveJob(job);
      router.push(`/jobs/${job.id}`); return;
    }

    setIsAnalyzing(true); setAnalysisStep(0);
    try {
      const response = await fetch("/api/analyze-job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_url: sourceUrl.trim() || undefined, raw_jd: rawJdText, candidate_profile: candidateProfileText }) });
      const payload = (await response.json().catch(() => ({}))) as AnalyzeResponse;
      if (!response.ok || !payload.analysis) throw new Error(getAnalyzeErrorMessage(payload, language, t));
      writeCachedAnalysis(cacheKey, payload.analysis);
      const job = createJobRecord({ analysis: payload.analysis, sourceUrl, rawJd: rawJdText, notes, deadline, applicationChannel, contactPerson, interviewDate, followUpNotes });
      saveJob(job);
      router.push(`/jobs/${job.id}`);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : t.analysisFailed); }
    finally { setIsAnalyzing(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-primary">{t.addJob}</h1>
        <p className="mt-1 text-[14px] text-secondary">{t.defaultProfileHint}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Main JD card */}
        <section className="rounded-xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="source-url">{t.sourceUrl}</Label>
            <Input id="source-url" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder={t.sourceUrlPlaceholder} />
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="raw-jd">{t.rawJd}</Label>
              <button type="button" onClick={fillSampleJd} className="text-[12px] font-medium text-accent transition-colors hover:text-accent-hover">
                {t.useSampleJd}
              </button>
            </div>
            <Textarea id="raw-jd" value={rawJd} onChange={(e) => setRawJd(e.target.value)} placeholder={t.rawJdPlaceholder} maxLength={MAX_JD_TEXT_LENGTH} rows={16} required
              className="min-h-[300px]" />
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-secondary/50">{language === "zh" ? "粘贴完整 JD，包括职责、要求、技能、地点、工作模式和申请说明。" : "Paste full JD with responsibilities, requirements, skills, location, and work mode."}</span>
              <span className="text-secondary/40">{jdLen} / {MAX_JD_TEXT_LENGTH}</span>
            </div>
            <p className="text-[12px] text-secondary/50">{language === "zh" ? "建议长度：80–12,000 字符。支持英文 JD，系统会输出中文解释。" : "80–12,000 characters. English JDs supported with Chinese explanations."}</p>
          </div>
        </section>

        {/* Optional tracking details (collapsible) */}
        <section className="rounded-xl border border-black/[0.04] bg-white shadow-sm">
          <button type="button" onClick={() => setOptionalExpanded((v) => !v)} className="flex w-full items-center justify-between px-5 py-4 text-left">
            <div>
              <span className="text-[14px] font-semibold text-primary">{language === "zh" ? "申请跟进信息（可选）" : "Application tracking (optional)"}</span>
              <span className="ml-2 text-[12px] text-secondary/50">{language === "zh" ? "用于管理申请进度" : "For progress tracking"}</span>
            </div>
            <svg className={`h-4 w-4 text-secondary/40 transition-transform ${optionalExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3"/></svg>
          </button>
          {optionalExpanded ? (
            <div className="border-t border-black/[0.04] px-5 py-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deadline">{t.deadline}</Label>
                  <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interview-date">{t.interviewDate}</Label>
                  <Input id="interview-date" type="datetime-local" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.applicationChannel}</Label>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_CHIPS.map((chip) => (
                    <button key={chip} type="button" onClick={() => setApplicationChannel((c) => c === chip ? "" : chip)}
                      className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${applicationChannel === chip ? "border-accent/20 bg-accent-subtle/40 text-accent" : "border-black/[0.06] bg-[#FAFAFA] text-secondary hover:border-black/[0.1]"}`}>
                      {chip}
                    </button>
                  ))}
                </div>
                <Input value={applicationChannel} onChange={(e) => setApplicationChannel(e.target.value)} placeholder={language === "zh" ? "或手动输入..." : "Or type manually..."} className="mt-1" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-person">{t.contactPerson}</Label>
                <Input id="contact-person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder={t.contactPersonPlaceholder} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t.notes}</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.notesPlaceholder} rows={3} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="follow-up-notes">{t.followUpNotes}</Label>
                <Textarea id="follow-up-notes" value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} placeholder={t.followUpNotesPlaceholder} rows={3} />
              </div>
            </div>
          ) : null}
        </section>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-[13px] text-red-700">{error}</div> : null}
        {info ? <div className="rounded-lg border border-green-200 bg-green-50/50 px-4 py-3 text-[13px] text-green-700">{info}</div> : null}

        <div className="flex justify-end">
          {isAnalyzing ? (
            <AnalysisLoadingPanel steps={ANALYSIS_STEPS} details={STEP_DETAILS} currentStep={analysisStep} language={language} />
          ) : (
            <Button type="submit" disabled={!jdValid} className="min-h-12 px-8 text-[15px] font-medium">
              {t.analyzeAndSaveJob}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/* ── Analysis loading panel ── */
function AnalysisLoadingPanel({ steps, details, currentStep, language }: { steps: typeof ANALYSIS_STEPS; details: typeof STEP_DETAILS; currentStep: number; language: "en" | "zh" }) {
  return (
    <div className="w-full rounded-xl border border-black/[0.04] bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/10" />
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M8 14a4 4 0 0 1 8 0"/><path d="M2 22c0-5.523 4.477-10 10-10s10 4.477 10 10"/></svg>
          </span>
        </div>
        <div>
          <p className="text-[15px] font-semibold text-primary">{language === "zh" ? "AI 正在分析岗位" : "AI is analyzing the job"}</p>
          <p className="text-[13px] text-secondary">{language === "zh" ? "预计 10–30 秒，请不要关闭页面。" : "10–30 seconds expected. Please keep this page open."}</p>
        </div>
      </div>

      {/* Steps timeline */}
      <div className="mt-5 space-y-1.5">
        {steps.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={step.en} className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${active ? "bg-accent-subtle/30" : ""}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${done ? "bg-green-100 text-green-600" : active ? "bg-accent text-white" : "bg-black/[0.04] text-secondary/30"}`}>
                {done ? <svg fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" viewBox="0 0 10 10" className="h-3 w-3"><path d="M1 5l3 3 5-6"/></svg> : active ? <span className="h-1.5 w-1.5 rounded-full bg-white"/> : i + 1}
              </span>
              <span className={`text-[13px] ${done ? "text-green-700" : active ? "font-medium text-accent" : "text-secondary/30"}`}>
                {language === "zh" ? step.zh : step.en}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current step detail */}
      <p className="mt-3 text-[12px] leading-relaxed text-secondary/60">
        <span className="font-medium text-secondary">{language === "zh" ? "当前步骤" : "Current step"}: </span>
        {language === "zh" ? details[currentStep].zh : details[currentStep].en}
      </p>

      {/* Subtle progress bar */}
      <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-black/[0.04]">
        <div className="h-full rounded-full bg-accent/40" style={{ width: `${((currentStep + 1) / steps.length) * 100}%`, transition: "width 0.8s ease-out" }} />
      </div>
    </div>
  );
}

/* ── Helpers ── */

function getAnalyzeErrorMessage(payload: AnalyzeResponse, language: "en" | "zh", t: ReturnType<typeof useLanguage>["t"]) {
  if (payload.message) return payload.message[language];
  switch (payload.code) {
    case "missing_api_key": return t.demoModeAnalyzeUnavailable;
    case "empty_jd": return t.rawJdRequired;
    case "jd_too_short": return t.rawJdTooShort;
    case "jd_too_long": return t.rawJdTooLong;
    case "analysis_failed": return t.analysisFailed;
    default: return payload.error || t.analysisFailed;
  }
}

function createJobRecord({ analysis, sourceUrl, rawJd, notes, deadline, applicationChannel, contactPerson, interviewDate, followUpNotes }: { analysis: JobAnalysis; sourceUrl: string; rawJd: string; notes: string; deadline: string; applicationChannel: string; contactPerson: string; interviewDate: string; followUpNotes: string }): JobRecord {
  const now = new Date().toISOString();
  return { ...analysis, id: createId(), application_status: "Not Applied", application_deadline: deadline, application_channel: applicationChannel.trim(), contact_person: contactPerson.trim(), interview_date: interviewDate, follow_up_notes: followUpNotes.trim(), status_history: createInitialStatusHistory(now), source_url: sourceUrl.trim(), raw_jd: rawJd, notes: notes.trim(), created_at: now, updated_at: now };
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
