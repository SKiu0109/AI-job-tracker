"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { AppCard } from "@/components/ui/app-card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SidePanel } from "@/components/ui/side-panel";
import { TabNav, type TabNavItem } from "@/components/ui/tab-nav";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusSelect } from "@/components/jobs/status-select";
import { useAuth } from "@/lib/auth/auth-provider";
import { useGuestCredits } from "@/lib/credits/guest-credits-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useToast } from "@/components/ui/toast";
import { getUserFacingNextStep } from "@/lib/jobs/user-facing-next-step";
import { cn, formatDate } from "@/lib/utils";
import {
  deleteCloudJob,
  hydrateJobsFromCloud,
  upsertCloudJob
} from "@/lib/storage/cloud-sync";
import {
  deleteStoredJob,
  updateStoredJob,
  updateStoredJobStatus
} from "@/lib/storage/jobs";
import { createStorageScope } from "@/lib/storage/scope";
import type { CreditBalance } from "@/types/credits";
import {
  ApplicationStatus,
  JobRecord,
  PriorityLevel,
  ResumeTailoringDraft,
  ResumeTailoringVersion
} from "@/types/job";

const OverviewTab = dynamic(
  () => import("@/components/jobs/tabs/overview-tab").then((mod) => ({ default: mod.OverviewTab })),
  { ssr: false }
);
const SkillsTab = dynamic(
  () => import("@/components/jobs/tabs/skills-tab").then((mod) => ({ default: mod.SkillsTab })),
  { ssr: false }
);
const InterviewTab = dynamic(
  () => import("@/components/jobs/tabs/interview-tab").then((mod) => ({ default: mod.InterviewTab })),
  { ssr: false }
);
const ActionsTab = dynamic(
  () => import("@/components/jobs/tabs/actions-tab").then((mod) => ({ default: mod.ActionsTab })),
  { ssr: false }
);
const TrackingTab = dynamic(
  () => import("@/components/jobs/tabs/tracking-tab").then((mod) => ({ default: mod.TrackingTab })),
  { ssr: false }
);
const DecisionBriefSection = dynamic(
  () => import("@/components/jobs/decision-brief-section"),
  { ssr: false }
);
import { SoftChip, EmptyReportState } from "@/components/jobs/ui/report-components";
import { SectionHeading } from "@/components/jobs/ui/detail-widgets";
import { getDetailCopy, getResumeDraftCopy } from "@/lib/jobs/job-detail-copy";
import {
  getVerdict,
  getJobTitle,
  safeText,
  formatWorkMode,
  formatOptionalDate,
  getSimilarJobs,
  getCoveragePercent,
  localizeKeyword,
  localizeDisplayValue,
  getScoreTone,
  uniqueStrings,
  localizedText,
  isUsefulValue,
} from "@/lib/jobs/job-detail-utils";

type ReportTab =
  | "actions"
  | "interview"
  | "resume"
  | "skills"
  | "tracking";


function getReportTabFromSearch(search: string): ReportTab | null {
  const value = new URLSearchParams(search).get("tab");

  if (
    value === "actions" ||
    value === "interview" ||
    value === "resume" ||
    value === "skills" ||
    value === "tracking"
  ) {
    return value;
  }

  return null;
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const {
    confidences,
    language,
    priorities,
    recommendations,
    statuses,
    t,
    timelineStatuses
  } = useLanguage();
  const storageScope = createStorageScope(session?.user.id);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [job, setJob] = useState<JobRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>("actions");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const requestedTab = getReportTabFromSearch(window.location.search);

      if (requestedTab) {
        setActiveTab(requestedTab);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [params.id]);

  useEffect(() => {
    const handleTabChange = (event: Event) => {
      const tab = (event as CustomEvent<{ tab: string }>).detail?.tab;
      if (tab && ["actions", "interview", "resume", "skills", "tracking"].includes(tab)) {
        setActiveTab(tab as ReportTab);
      }
    };
    window.addEventListener("tab-change", handleTabChange);
    return () => window.removeEventListener("tab-change", handleTabChange);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      hydrateJobsFromCloud(session)
        .then((items) => {
          setJobs(items);
          setJob(items.find((item) => item.id === params.id) ?? null);
        })
        .finally(() => setIsLoaded(true));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [params.id, session]);

  const copy = getDetailCopy(language);
  const locale = language === "zh" ? "zh-CN" : "en-AU";
  const similarJobs = useMemo(
    () => (job ? getSimilarJobs(job, jobs) : []),
    [job, jobs]
  );

  const handleStatusChange = (status: ApplicationStatus) => {
    const updatedJob = updateStoredJobStatus(
      params.id,
      status,
      "",
      storageScope
    );
    if (updatedJob) {
      setJob(updatedJob);
      setJobs((current) =>
        current.map((item) => (item.id === updatedJob.id ? updatedJob : item))
      );
      void upsertCloudJob(session, updatedJob);
    }
  };

  const handleResumeDraftSave = (
    draft: ResumeTailoringDraft,
    options: { reviewed?: boolean; saveVersion?: boolean } = {}
  ) => {
    if (!job) return;

    const versions =
      options.saveVersion || options.reviewed
        ? [
            createResumeTailoringVersion(draft, {
              count: job.resume_tailoring_versions?.length ?? 0,
              reviewed: Boolean(options.reviewed)
            }),
            ...(job.resume_tailoring_versions ?? [])
          ].slice(0, 8)
        : job.resume_tailoring_versions;
    const nextActionStage =
      options.reviewed &&
      (job.action_stage === "tailor_resume" || job.action_stage === "needs_review")
        ? "ready_to_apply"
        : job.action_stage;
    const updatedJob = updateStoredJob(
      params.id,
      {
        action_stage: nextActionStage,
        next_step_note: options.reviewed
          ? language === "zh"
            ? "简历草稿已 reviewed，可以进入最终投递检查。"
            : "Resume draft reviewed. Move into final application check."
          : job.next_step_note,
        resume_tailoring_draft: draft,
        resume_tailoring_versions: versions,
        tailoring_status: options.reviewed ? "reviewed" : "draft_ready"
      },
      "",
      storageScope
    );

    if (updatedJob) {
      setJob(updatedJob);
      setJobs((current) =>
        current.map((item) => (item.id === updatedJob.id ? updatedJob : item))
      );
      void upsertCloudJob(session, updatedJob);
    }
  };

  const handleDelete = () => {
    if (!window.confirm(t.deleteConfirm)) return;
    deleteStoredJob(params.id, storageScope);
    void deleteCloudJob(session, params.id);
    router.push("/workspace");
  };

  if (!isLoaded) {
    return (
      <AppCard className="p-6 text-sm text-app-text-secondary">
        {t.analyzing}
      </AppCard>
    );
  }

  if (!job) {
    return (
      <AppCard className="p-10 text-center" variant="elevated">
        <h1 className="text-xl font-semibold text-app-text-primary">
          {t.notFound}
        </h1>
        <p className="mt-2 text-sm text-app-text-secondary">{t.notFoundBody}</p>
        <ButtonLink href="/workspace" className="mt-5">
          {t.backToList}
        </ButtonLink>
      </AppCard>
    );
  }

  const title = getJobTitle(job, language);
  const subtitle =
    language === "zh" && title !== job.job_title_original
      ? job.job_title_original
      : "";
  const verdict = getVerdict(job.match_score, language);
  const nextStep = getUserFacingNextStep(job, language);
  const tabs: TabNavItem[] = [
    { key: "actions", label: copy.tabs.actions },
    { key: "resume", label: copy.tabs.resume },
    { key: "skills", label: copy.tabs.skills },
    { key: "interview", label: copy.tabs.interview },
    { key: "tracking", label: t.statusTimeline }
  ];

  return (
    <div className="app-stagger space-y-6 pb-8">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/workspace" variant="secondary">
              {t.backToList}
            </ButtonLink>
            <ButtonLink href={`/jobs/${job.id}/edit`} variant="secondary">
              {t.edit}
            </ButtonLink>
            <Button onClick={handleDelete} variant="secondary">
              {t.deleteJob}
            </Button>
          </div>
        }
        breadcrumbs={[
          { href: "/workspace", label: t.jobList },
          { label: copy.title }
        ]}
        metadata={
          <>
            <span>{formatOptionalDate(job.created_at, locale, t.notProvided)}</span>
            <span aria-hidden="true">/</span>
            <span>{copy.updated} {formatOptionalDate(job.updated_at, locale, t.notProvided)}</span>
          </>
        }
        subtitle={copy.subtitle}
        title={copy.title}
      />

      <AppCard className="overflow-hidden p-5 sm:p-6" variant="elevated">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <CompanyLogo company={job.company} logoUrl={job.company_logo_url} size="lg" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-app-accent">
                {job.company}
              </p>
              <h2 className="mt-1 text-[26px] font-semibold tracking-tight text-app-text-primary">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1.5 text-[14px] text-app-text-secondary">
                  {subtitle}
                </p>
              ) : null}
              <div className="app-stagger mt-4 flex flex-wrap gap-2">
                <SoftChip>{safeText(job.location, t.notSpecified)}</SoftChip>
                <SoftChip>{formatWorkMode(job.work_mode, language)}</SoftChip>
                <SoftChip>
                  {language === "zh"
                    ? safeText(job.job_type_zh, job.job_type_en || t.notSpecified)
                    : safeText(job.job_type_en, t.notSpecified)}
                </SoftChip>
                {job.application_deadline ? (
                  <SoftChip>
                    {t.deadline}: {formatDate(job.application_deadline, locale)}
                  </SoftChip>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:flex-col xl:items-end">
            <StatusSelect value={job.application_status} onChange={handleStatusChange} />
            <ScoreBadge
              recommendation={job.application_recommendation}
              score={job.match_score}
            />
          </div>
        </div>
      </AppCard>

      <DecisionBriefSection
        copy={copy}
        job={job}
        language={language}
        locale={locale}
        nextStep={nextStep}
        onOpenActions={() => setActiveTab("actions")}
        onOpenResume={() => setActiveTab("resume")}
        priorities={priorities}
        recommendationLabel={recommendations[job.application_recommendation]}
        statusLabel={statuses[job.application_status]}
        t={t}
        verdict={verdict}
      />

      <TabNav
        activeKey={activeTab}
        ariaLabel={copy.reportTabs}
        onChange={(key) => setActiveTab(key as ReportTab)}
        tabs={tabs}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="tab-panel-enter space-y-5" key={activeTab}>
          {activeTab === "skills" ? (
            <SkillsTab
              confidences={confidences}
              copy={copy}
              job={job}
              language={language}
              priorities={priorities}
              t={t}
            />
          ) : null}

          {activeTab === "resume" ? (
            <ResumeTab
              accessToken={session?.access_token}
              job={job}
              language={language}
              onSaveDraft={handleResumeDraftSave}
              t={t}
            />
          ) : null}

          {activeTab === "interview" ? (
            <InterviewTab copy={copy} job={job} language={language} t={t} />
          ) : null}

          {activeTab === "actions" ? (
            <ActionsTab
              copy={copy}
              job={job}
              language={language}
              nextStep={nextStep}
              priorities={priorities}
              t={t}
            />
          ) : null}

          {activeTab === "tracking" ? (
            <TrackingTab
              job={job}
              language={language}
              locale={locale}
              t={t}
              timelineStatuses={timelineStatuses}
            />
          ) : null}

          <AppCard className="app-hover-lift p-5">
            <details>
              <summary className="cursor-pointer text-[14px] font-semibold text-app-text-primary">
                {t.rawJdToggle}
              </summary>
              <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-app-border-soft bg-app-surface p-4 text-[13px] leading-6 text-app-text-primary shadow-app-card">
                {job.raw_jd}
              </pre>
            </details>
          </AppCard>

          <AppCard className="app-hover-lift p-5">
            <details>
              <summary className="cursor-pointer text-[14px] font-semibold text-app-text-primary">
                {copy.fullAnalysisSummary}
              </summary>
              <div className="mt-5">
                <OverviewTab copy={copy} job={job} language={language} t={t} />
              </div>
            </details>
          </AppCard>
        </div>

        <div className="app-stagger space-y-5">
          <SidePanel title={copy.similarRoles} description={copy.similarRolesSubtitle}>
            {similarJobs.length ? (
              <div className="space-y-3">
                {similarJobs.map((item) => (
                  <Link
                    className="app-hover-lift block rounded-lg border border-app-border-soft bg-app-surface p-3 shadow-app-card backdrop-blur-xl hover:border-app-border hover:bg-app-surface-hover"
                    href={`/jobs/${item.id}`}
                    key={item.id}
                  >
                    <div className="flex items-center gap-3">
                      <CompanyLogo company={item.company} logoUrl={item.company_logo_url} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[13px] font-semibold text-app-text-primary">
                          {getJobTitle(item, language)}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-app-text-secondary">
                          {item.company}
                        </p>
                      </div>
                      <ScoreBadge
                        recommendation={item.application_recommendation}
                        score={item.match_score}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyReportState
                body={copy.noSimilarRolesBody}
                icon="briefcase"
                title={copy.noSimilarRoles}
              />
            )}
          </SidePanel>

          <AppCard className="app-hover-lift p-5">
            <details>
              <summary className="cursor-pointer text-[15px] font-semibold text-app-text-primary">
                {copy.reportHealth}
              </summary>
              <div className="mt-4 space-y-3">
                <ProgressBar
                  label={copy.skillCoverage}
                  showValue
                  tone="accent"
                  value={getCoveragePercent(job.matched_skills.length, job.matched_skills.length + job.missing_skills.length)}
                />
                <ProgressBar
                  label={copy.resumeSignal}
                  showValue
                  tone="success"
                  value={job.resume_keywords.length ? 100 : 0}
                />
                <ProgressBar
                  label={copy.riskReview}
                  showValue
                  tone={job.red_flags_en.length || job.red_flags_zh.length ? "warning" : "success"}
                  value={job.red_flags_en.length || job.red_flags_zh.length ? 60 : 100}
                />
              </div>
            </details>
          </AppCard>
        </div>
      </section>
    </div>
  );
}

function ResumeTab({
  accessToken,
  job,
  language,
  onSaveDraft,
  t
}: {
  accessToken?: string;
  job: JobRecord;
  language: "en" | "zh";
  onSaveDraft: (
    draft: ResumeTailoringDraft,
    options?: { reviewed?: boolean; saveVersion?: boolean }
  ) => void;
  t: Record<string, string>;
}) {
  const { updateCredits } = useGuestCredits();
  const { addToast } = useToast();
  const fallbackDraft = useMemo(
    () => createFallbackResumeDraft(job),
    [job]
  );
  const draft = job.resume_tailoring_draft ?? fallbackDraft;
  const [draftForm, setDraftForm] = useState<ResumeTailoringDraft>(draft);
  const [isPolishing, setIsPolishing] = useState(false);
  const [manualCopyText, setManualCopyText] = useState("");
  const [polishError, setPolishError] = useState("");
  const [polishInstruction, setPolishInstruction] = useState("");
  const [polishOpen, setPolishOpen] = useState(false);
  const [polishResult, setPolishResult] =
    useState<ResumeTailoringDraft | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraftForm(draft);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [draft, job.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setManualCopyText("");
      setPolishError("");
      setPolishInstruction("");
      setPolishOpen(false);
      setPolishResult(null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [job.id]);

  const draftHasChanges =
    JSON.stringify(draftForm) !== JSON.stringify(draft);
  const reviewed = job.tailoring_status === "reviewed";
  const copyLabels = getResumeDraftCopy(language);
  const checklist = getResumeChecklist(draftForm, job, copyLabels);
  const completeCount = checklist.filter((item) => item.complete).length;
  const previewMetrics = useMemo(
    () => getResumePreviewMetrics(draftForm),
    [draftForm]
  );
  const previewStatus = getResumePreviewStatus(previewMetrics, copyLabels);
  const matchInsights = getResumeMatchInsights(
    draftForm,
    job,
    language,
    copyLabels
  );

  const updateDraft = <Key extends keyof ResumeTailoringDraft>(
    key: Key,
    value: ResumeTailoringDraft[Key]
  ) => {
    setDraftForm((current) => ({ ...current, [key]: value }));
  };

  const handleCopy = async (label: string, value: string) => {
    try {
      await copyTextToClipboard(value);
      addToast(
        language === "zh" ? `已复制：${label}` : `Copied: ${label}`
      );
      setManualCopyText("");
    } catch {
      addToast(
        language === "zh"
          ? "复制失败，请手动选中文本。"
          : "Copy failed. Select the text manually.",
        "error"
      );
      setManualCopyText(value);
    }
  };

  const handleCopyPackage = () => {
    void handleCopy(
      copyLabels.packageLabel,
      formatResumeDraftPackage(draftForm, job, copyLabels)
    );
  };

  const handleOpenPolish = () => {
    setPolishError("");
    setPolishOpen(true);
  };

  const handlePolishDraft = async () => {
    setIsPolishing(true);
    setPolishError("");
    setPolishResult(null);

    try {
      const response = await fetch("/api/polish-resume-draft", {
        body: JSON.stringify({
          draft: normalizeDraftForm(draftForm),
          instruction: polishInstruction,
          job: buildResumePolishJobContext(job),
          language
        }),
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {})
        },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as {
        credits?: CreditBalance;
        draft?: ResumeTailoringDraft;
        error?: string;
      };

      if (payload.credits) {
        updateCredits(payload.credits);
      }

      if (!response.ok || !payload.draft) {
        throw new Error(payload.error || copyLabels.polishFailed);
      }

      setPolishResult(normalizeDraftForm(payload.draft));
    } catch (error) {
      setPolishError(
        error instanceof Error ? error.message : copyLabels.polishFailed
      );
    } finally {
      setIsPolishing(false);
    }
  };

  const handleApplyPolish = () => {
    if (!polishResult) {
      setPolishError(copyLabels.polishNoResult);
      return;
    }

    setDraftForm(normalizeDraftForm(polishResult));
    setManualCopyText("");
    setPolishOpen(false);
    addToast(copyLabels.polishApplied);
  };

  const handleSaveDraft = (
    options: { reviewed?: boolean; saveVersion?: boolean } = {}
  ) => {
    const normalizedDraft = normalizeDraftForm(draftForm);
    setDraftForm(normalizedDraft);
    onSaveDraft(normalizedDraft, options);
    addToast(
      options.reviewed
        ? copyLabels.reviewedSaved
        : options.saveVersion
          ? copyLabels.versionSaved
        : copyLabels.draftSaved
    );
  };

  return (
    <>
      <AppCard className="overflow-hidden p-0" variant="elevated">
        <div className="border-b border-app-border-soft bg-app-surface px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[20px] font-semibold tracking-tight text-app-text-primary">
                  {copyLabels.title}
                </h2>
                <ResumeReadinessPill
                  label={reviewed ? copyLabels.reviewed : copyLabels.draftReady}
                  ready={reviewed}
                />
              </div>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-app-text-secondary">
                {copyLabels.subtitle}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="min-h-9 px-3 text-[13px]"
                onClick={handleCopyPackage}
                variant="secondary"
                type="button"
              >
                {copyLabels.copyInsert}
              </Button>
              <Button
                className="min-h-9 px-3 text-[13px]"
                onClick={handleOpenPolish}
                variant="secondary"
                type="button"
              >
                {copyLabels.aiPolish}
              </Button>
              <Button
                className="min-h-9 px-3 text-[13px]"
                onClick={() => handleSaveDraft()}
                variant="secondary"
                disabled={!draftHasChanges}
                type="button"
              >
                {copyLabels.saveDraft}
              </Button>
              <Button
                className="min-h-9 px-3 text-[13px]"
                onClick={() => handleSaveDraft({ reviewed: true })}
                type="button"
              >
                {copyLabels.markReviewed}
              </Button>
            </div>
          </div>

          <ResumeDraftStatusStrip
            checklistDone={completeCount}
            checklistTotal={checklist.length}
            copy={copyLabels}
            metrics={previewMetrics}
            status={previewStatus}
          />

          <ResumeMatchDiagnosticPanel
            copy={copyLabels}
            insights={matchInsights}
            language={language}
          />

          {manualCopyText ? (
            <div className="mt-3 rounded-app border border-app-border-soft bg-app-surface p-3 shadow-app-card">
              <p className="text-[12px] font-semibold text-app-text-secondary">
                {copyLabels.manualCopyHelper}
              </p>
              <textarea
                className="mt-2 max-h-44 w-full resize-y rounded-app border border-app-border-soft bg-app-surface px-3 py-2 text-[12px] leading-5 text-app-text-primary shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)] outline-none"
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                rows={5}
                value={manualCopyText}
              />
            </div>
          ) : null}
        </div>

        <details className="group border-t border-app-border-soft bg-app-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 transition-colors hover:bg-app-surface-hover sm:px-6">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-app-text-primary">
              <svg
                className="h-4 w-4 shrink-0 text-app-text-tertiary transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              {language === "zh" ? "编辑简历草稿" : "Edit resume draft"}
            </span>
            <span className="rounded-full bg-app-surface px-2.5 py-0.5 text-[11px] font-semibold text-app-text-tertiary">
              {completeCount}/{checklist.length} {copyLabels.checklistReady}
            </span>
          </summary>
          <div className="grid">
            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3">
                <EditableDraftBlock
                  copyLabel={copyLabels.copy}
                  label={copyLabels.summary}
                  onChange={(value) => updateDraft("summary_en", value)}
                  onCopy={() => handleCopy(copyLabels.summary, draftForm.summary_en)}
                  rows={4}
                  value={draftForm.summary_en}
                />
                <EditableDraftBlock
                  copyLabel={copyLabels.copy}
                  helper={copyLabels.bulletsHelper}
                  label={copyLabels.bullets}
                  onChange={(value) =>
                    updateDraft("bullets_en", splitLines(value))
                  }
                  onCopy={() =>
                    handleCopy(copyLabels.bullets, draftForm.bullets_en.join("\n"))
                  }
                  rows={5}
                  value={draftForm.bullets_en.join("\n")}
                />
              </div>

              <ResumeOptionalFieldsPanel
                copy={copyLabels}
                keywords={draftForm.keywords.join(", ")}
                onChangeKeywords={(value) =>
                  updateDraft("keywords", splitCommaList(value))
                }
                onChangeRisks={(value) =>
                  updateDraft("risk_notes_zh", splitLines(value))
                }
                resumeKeywordsLabel={t.resumeKeywords}
                riskNotes={draftForm.risk_notes_zh.join("\n")}
              />
            </div>

            <aside className="border-t border-app-border-soft bg-app-surface p-4 sm:p-5">
              <div className="space-y-4">
                <ResumePreviewPanel
                  copy={copyLabels}
                  draft={draftForm}
                  job={job}
                  language={language}
                  metrics={previewMetrics}
                />
                <ResumeChecklistPanel
                  checklist={checklist}
                  completeCount={completeCount}
                  copy={copyLabels}
                />
              </div>
            </aside>
          </div>
        </details>
      </AppCard>
      {polishOpen ? (
        <ResumePolishDialog
          copy={copyLabels}
          currentDraft={draftForm}
          error={polishError}
          instruction={polishInstruction}
          isPolishing={isPolishing}
          onApply={handleApplyPolish}
          onChangeInstruction={setPolishInstruction}
          onClose={() => setPolishOpen(false)}
          onGenerate={() => {
            void handlePolishDraft();
          }}
          result={polishResult}
        />
      ) : null}
    </>
  );
}

function ResumeReadinessPill({
  label,
  ready
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[12px] font-semibold",
        ready
          ? "border border-app-success-border bg-app-success-soft text-app-success"
          : "border border-app-warning-border bg-app-warning-soft text-app-warning"
      )}
    >
      {label}
    </span>
  );
}

function ResumeDraftStatusStrip({
  checklistDone,
  checklistTotal,
  copy,
  metrics,
  status
}: {
  checklistDone: number;
  checklistTotal: number;
  copy: ReturnType<typeof getResumeDraftCopy>;
  metrics: ResumePreviewMetrics;
  status: ReturnType<typeof getResumePreviewStatus>;
}) {
  const items = [
    {
      label: copy.previewDensity,
      value: `${metrics.estimatedLines} ${copy.previewEstimatedLines}`,
      tone: metrics.tone === "ready" ? "success" : metrics.tone === "tight" ? "warning" : "danger"
    },
    {
      label: copy.checklistTitle,
      value: `${checklistDone}/${checklistTotal} ${copy.checklistReady}`,
      tone: checklistDone === checklistTotal ? "success" : "warning"
    },
    {
      label: copy.previewKeywords,
      value: `${metrics.keywordCount}`,
      tone: metrics.keywordCount >= 4 ? "success" : "warning"
    }
  ] as const;

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div
          className="rounded-app border border-app-border-soft bg-app-surface px-3 py-2 shadow-app-card"
          key={item.label}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-app-text-tertiary">
              {item.label}
            </p>
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                item.tone === "success"
                  ? "bg-app-success"
                  : item.tone === "warning"
                    ? "bg-app-warning"
                    : "bg-app-danger"
              )}
            />
          </div>
          <p className="mt-1 text-[13px] font-semibold text-app-text-primary">
            {item.value}
          </p>
        </div>
      ))}
      <div className="sr-only">{status.label}</div>
    </div>
  );
}

function ResumeMatchDiagnosticPanel({
  copy,
  insights,
  language
}: {
  copy: ReturnType<typeof getResumeDraftCopy>;
  insights: ResumeMatchInsights;
  language: "en" | "zh";
}) {
  return (
    <div className="mt-4 rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-app-text-primary">
            {copy.matchDiagnosticTitle}
          </p>
          <p className="mt-1 max-w-3xl text-[12px] leading-5 text-app-text-secondary">
            {copy.matchDiagnosticSubtitle}
          </p>
        </div>
        <div className="grid shrink-0 gap-2 sm:grid-cols-3 xl:min-w-[430px]">
          <ResumeMatchMetric
            label={copy.keywordCoverage}
            tone={getScoreTone(insights.keywordCoverage)}
            value={`${insights.keywordCoverage}%`}
          />
          <ResumeMatchMetric
            label={copy.skillCoverage}
            tone={getScoreTone(insights.skillCoverage)}
            value={`${insights.skillCoverage}%`}
          />
          <ResumeMatchMetric
            label={copy.evidenceStrength}
            tone={getScoreTone(insights.evidenceStrength)}
            value={`${insights.evidenceStrength}%`}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-app-info-border bg-app-info-soft p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-app-accent">
            {copy.firstFixTitle}
          </p>
          <p className="mt-2 text-[15px] font-semibold leading-6 text-app-text-primary">
            {insights.firstFix}
          </p>
          <p className="mt-2 text-[12px] leading-5 text-app-text-secondary">
            {insights.firstFixDetail}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <ResumeKeywordCluster
            emptyLabel={copy.noCoveredKeywords}
            language={language}
            title={copy.coveredKeywords}
            values={insights.coveredKeywords}
          />
          <ResumeKeywordCluster
            emptyLabel={copy.noMissingKeywords}
            language={language}
            tone="warning"
            title={copy.missingKeywords}
            values={insights.missingKeywords}
          />
        </div>
      </div>
    </div>
  );
}

function ResumeMatchMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone: "danger" | "success" | "warning";
  value: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-app-success-border bg-app-success-soft text-app-success"
      : tone === "warning"
        ? "border-app-warning-border bg-app-warning-soft text-app-warning"
        : "border-app-danger-border bg-app-danger-soft text-app-danger";

  return (
    <div className={cn("rounded-app border px-3 py-2", toneClass)}>
      <p className="text-[11px] font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-[16px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ResumeKeywordCluster({
  emptyLabel,
  language,
  title,
  tone = "neutral",
  values
}: {
  emptyLabel: string;
  language: "en" | "zh";
  title: string;
  tone?: "neutral" | "warning";
  values: string[];
}) {
  return (
    <div className="rounded-lg border border-app-border-soft bg-app-surface p-3 shadow-app-card">
      <p className="text-[12px] font-semibold text-app-text-primary">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.length ? (
          values.slice(0, 8).map((value) => (
            <Badge
              className={
                tone === "warning"
                  ? "border-app-warning-border bg-app-warning-soft text-app-warning"
                  : undefined
              }
              key={value}
            >
              {localizeKeyword(value, language)}
            </Badge>
          ))
        ) : (
          <p className="text-[12px] text-app-text-secondary">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

function EditableDraftBlock({
  copyLabel = "Copy",
  helper,
  label,
  onChange,
  onCopy,
  rows,
  value,
}: {
  copyLabel?: string;
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  onCopy: () => void;
  rows: number;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-app-border-soft bg-app-surface p-3.5 shadow-app-card backdrop-blur-xl transition duration-200 hover:border-app-border hover:bg-app-surface-hover">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-app-text-primary">
            {label}
          </p>
          {helper ? (
            <p className="mt-0.5 text-[12px] leading-5 text-app-text-tertiary">
              {helper}
            </p>
          ) : null}
        </div>
        <button
          className="shrink-0 rounded-app px-2 py-1 text-[12px] font-semibold text-app-accent transition-colors hover:bg-app-surface-hover"
          onClick={onCopy}
          type="button"
        >
          {copyLabel}
        </button>
      </div>
      <textarea
        className="mt-3 w-full resize-y rounded-app border border-app-border-soft bg-app-surface px-3 py-2.5 text-[13px] leading-6 text-app-text-primary shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)] outline-none transition focus:border-app-accent focus:bg-app-surface-solid focus:shadow-app-focus"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </div>
  );
}

function ResumeOptionalFieldsPanel({
  copy,
  keywords,
  onChangeKeywords,
  onChangeRisks,
  resumeKeywordsLabel,
  riskNotes
}: {
  copy: ReturnType<typeof getResumeDraftCopy>;
  keywords: string;
  onChangeKeywords: (value: string) => void;
  onChangeRisks: (value: string) => void;
  resumeKeywordsLabel: string;
  riskNotes: string;
}) {
  return (
    <details className="group rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-app-text-primary">
            {copy.optionalFieldsTitle}
          </p>
          <p className="mt-0.5 text-[12px] leading-5 text-app-text-tertiary">
            {copy.optionalFieldsSubtitle}
          </p>
        </div>
        <span className="shrink-0 text-[16px] font-semibold text-app-accent transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <div className="mt-4 grid gap-4">
        <label className="block">
          <span className="text-[12px] font-semibold text-app-text-primary">
            {resumeKeywordsLabel}
          </span>
          <span className="mt-0.5 block text-[12px] leading-5 text-app-text-tertiary">
            {copy.keywordsHelper}
          </span>
          <textarea
            className="mt-2 w-full resize-y rounded-app border border-app-border-soft bg-app-surface px-3 py-2.5 text-[13px] leading-6 text-app-text-primary shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)] outline-none transition focus:border-app-accent focus:bg-app-surface-solid focus:shadow-app-focus"
            onChange={(event) => onChangeKeywords(event.target.value)}
            rows={2}
            value={keywords}
          />
        </label>

        <label className="block">
          <span className="text-[12px] font-semibold text-app-text-primary">
            {copy.risks}
          </span>
          <span className="mt-0.5 block text-[12px] leading-5 text-app-text-tertiary">
            {copy.risksHelper}
          </span>
          <textarea
            className="mt-2 w-full resize-y rounded-app border border-app-border-soft bg-app-surface px-3 py-2.5 text-[13px] leading-6 text-app-text-primary shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)] outline-none transition focus:border-app-accent focus:bg-app-surface-solid focus:shadow-app-focus"
            onChange={(event) => onChangeRisks(event.target.value)}
            rows={2}
            value={riskNotes}
          />
        </label>
      </div>
    </details>
  );
}

function ResumeChecklistPanel({
  checklist,
  completeCount,
  copy
}: {
  checklist: Array<{ complete: boolean; label: string }>;
  completeCount: number;
  copy: ReturnType<typeof getResumeDraftCopy>;
}) {
  const complete = completeCount === checklist.length;

  return (
    <section className="rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-app-text-primary">
            {copy.checklistTitle}
          </p>
          <p className="mt-0.5 text-[12px] leading-5 text-app-text-tertiary">
            {completeCount}/{checklist.length} {copy.checklistReady}
          </p>
        </div>
        <ResumeReadinessPill
          label={complete ? copy.ready : copy.needsWork}
          ready={complete}
        />
      </div>
      <div className="mt-3 grid gap-1.5">
        {checklist.map((item) => (
          <div
            className="flex items-start gap-2 text-[12px] leading-5"
            key={item.label}
          >
            <span
              className={cn(
                "mt-1 h-2 w-2 shrink-0 rounded-full",
                item.complete ? "bg-app-success" : "bg-app-warning"
              )}
            />
            <span className="text-app-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResumePolishDialog({
  copy,
  currentDraft,
  error,
  instruction,
  isPolishing,
  onApply,
  onChangeInstruction,
  onClose,
  onGenerate,
  result
}: {
  copy: ReturnType<typeof getResumeDraftCopy>;
  currentDraft: ResumeTailoringDraft;
  error: string;
  instruction: string;
  isPolishing: boolean;
  onApply: () => void;
  onChangeInstruction: (value: string) => void;
  onClose: () => void;
  onGenerate: () => void;
  result: ResumeTailoringDraft | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay px-4 py-6 backdrop-blur-sm">
      <div
        aria-modal="true"
        className="max-h-[min(760px,calc(100vh-48px))] w-full max-w-5xl overflow-y-auto rounded-lg border border-app-border-soft bg-app-paper p-5 shadow-app-floating sm:p-6"
        role="dialog"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeading
            subtitle={copy.polishSubtitle}
            title={copy.polishTitle}
          />
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-app border border-app-border-soft bg-app-surface text-[18px] leading-none text-app-text-secondary shadow-app-card transition-colors hover:bg-app-surface-hover hover:text-app-text-primary"
            aria-label={copy.polishCloseLabel}
            onClick={onClose}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-app-warning-border bg-app-warning-soft px-3 py-2 text-[12px] leading-5 text-app-warning">
          {copy.polishSafetyNote}
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] font-semibold text-app-text-secondary">
            {copy.polishInstructionLabel}
          </span>
          <textarea
            className="mt-2 w-full resize-y rounded-app border border-app-border-soft bg-app-surface px-3 py-2.5 text-[13px] leading-6 text-app-text-primary shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)] outline-none transition focus:border-app-accent focus:bg-app-surface-solid focus:shadow-app-focus"
            onChange={(event) => onChangeInstruction(event.target.value)}
            placeholder={copy.polishInstructionPlaceholder}
            rows={3}
            value={instruction}
          />
        </label>

        {error ? (
          <p className="mt-3 rounded-app border border-app-danger-border bg-app-danger-soft px-3 py-2 text-[12px] font-medium text-app-danger">
            {error}
          </p>
        ) : null}

        {result ? (
          <div className="mt-5">
            <p className="text-[13px] font-semibold text-app-text-primary">
              {copy.polishResultTitle}
            </p>
            <InlineDiffView
              copy={copy}
              current={currentDraft}
              result={result}
            />
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} type="button" variant="ghost">
            {copy.polishCancel}
          </Button>
          <Button
            disabled={isPolishing}
            onClick={onGenerate}
            type="button"
            variant="secondary"
          >
            {isPolishing ? copy.polishGenerating : copy.polishGenerate}
          </Button>
          <Button
            disabled={!result || isPolishing}
            onClick={onApply}
            type="button"
          >
            {copy.polishApply}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline diff view — shows what was added, removed, and kept from the AI polish.
 * Uses word-level diffing for text fields and set operations for arrays.
 */
function InlineDiffView({
  copy,
  current,
  result
}: {
  copy: ReturnType<typeof getResumeDraftCopy>;
  current: ResumeTailoringDraft;
  result: ResumeTailoringDraft;
}) {
  return (
    <div className="mt-3 rounded-lg border border-app-border-soft bg-app-paper-muted p-5 shadow-app-card">
      <div className="flex items-center gap-4 mb-4 pb-3 border-b border-app-border-soft">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-app-text-secondary">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-app-success-soft ring-1 ring-app-success-border" />
          <span>{copy.polishDiffAdded}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-app-text-secondary">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-app-danger-soft ring-1 ring-app-danger-border" />
          <span>{copy.polishDiffRemoved}</span>
        </div>
      </div>

      <div className="space-y-4 text-[13px] leading-6">
        {/* Summary diff */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary mb-1.5">
            {copy.summary}
          </p>
          <div className="rounded-lg border border-app-border-soft bg-app-surface p-3 shadow-app-card">
            {renderTextDiff(current.summary_en, result.summary_en)}
          </div>
        </div>

        {/* Bullets diff */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary mb-1.5">
            {copy.bullets}
          </p>
          <div className="space-y-1.5 rounded-lg border border-app-border-soft bg-app-surface p-3 shadow-app-card">
            {renderListDiff(current.bullets_en, result.bullets_en)}
          </div>
        </div>

        {/* Keywords diff */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary mb-1.5">
            {copy.packageKeywords}
          </p>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-app-border-soft bg-app-surface p-3 shadow-app-card">
            {renderKeywordsDiff(current.keywords, result.keywords)}
          </div>
        </div>

        {/* Risk notes diff */}
        {result.risk_notes_zh.length > 0 || current.risk_notes_zh.length > 0 ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary mb-1.5">
              {copy.risks}
            </p>
            <div className="space-y-1.5 rounded-lg border border-app-border-soft bg-app-surface p-3 shadow-app-card">
              {renderListDiff(current.risk_notes_zh, result.risk_notes_zh)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Simple word-level diff between two strings.
 * Returns an array of segments with type: "added" | "removed" | "unchanged".
 */
function computeTextDiff(oldText: string, newText: string): Array<{ text: string; type: "added" | "removed" | "unchanged" }> {
  if (!oldText.trim() && !newText.trim()) {
    return [{ text: "—", type: "unchanged" }];
  }
  if (!oldText.trim()) {
    return [{ text: newText, type: "added" }];
  }
  if (!newText.trim()) {
    return [{ text: oldText, type: "removed" }];
  }

  // Simple LCS-based word diff
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: Array<{ text: string; type: "added" | "removed" | "unchanged" }> = [];
  let i = m, j = n;
  const temp: Array<{ text: string; type: "added" | "removed" | "unchanged" }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      temp.push({ text: oldWords[i - 1], type: "unchanged" });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ text: newWords[j - 1], type: "added" });
      j--;
    } else {
      temp.push({ text: oldWords[i - 1], type: "removed" });
      i--;
    }
  }

  // Reverse and merge consecutive same-type segments
  temp.reverse();
  for (const segment of temp) {
    const last = result[result.length - 1];
    if (last && last.type === segment.type) {
      last.text += segment.text;
    } else {
      result.push({ ...segment });
    }
  }

  return result;
}

function renderTextDiff(oldText: string, newText: string) {
  const segments = computeTextDiff(oldText, newText);

  return (
    <p className="text-[13px] leading-6">
      {segments.map((seg, i) => (
        <span
          className={
            seg.type === "added"
              ? "diff-added"
              : seg.type === "removed"
                ? "diff-removed"
                : "diff-unchanged"
          }
          key={i}
        >
          {seg.text}
        </span>
      ))}
    </p>
  );
}

function renderListDiff(oldItems: string[], newItems: string[]) {
  const oldSet = new Set(oldItems);
  const newSet = new Set(newItems);

  // Items in new but not in old = added
  const added = newItems.filter((item) => !oldSet.has(item));
  // Items in old but not in new = removed
  const removed = oldItems.filter((item) => !newSet.has(item));
  // Items in both = unchanged
  const unchanged = newItems.filter((item) => oldSet.has(item));

  const allItems = [
    ...added.map((item) => ({ item, type: "added" as const })),
    ...removed.map((item) => ({ item, type: "removed" as const })),
    ...unchanged.map((item) => ({ item, type: "unchanged" as const })),
  ];

  if (allItems.length === 0) {
    return <p className="text-[13px] text-app-text-tertiary">—</p>;
  }

  return allItems.map(({ item, type }, i) => (
    <div className="flex items-start gap-2" key={`${item}-${i}`}>
      <span
        className={cn(
          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
          type === "added" ? "bg-app-success" : type === "removed" ? "bg-app-danger" : "bg-app-text-tertiary"
        )}
      />
      <span
        className={cn(
          "text-[13px] leading-5",
          type === "added" ? "diff-added" : type === "removed" ? "diff-removed" : "diff-unchanged"
        )}
      >
        {item}
      </span>
    </div>
  ));
}

function renderKeywordsDiff(oldKeywords: string[], newKeywords: string[]) {
  const oldSet = new Set(oldKeywords);
  const newSet = new Set(newKeywords);

  const added = newKeywords.filter((k) => !oldSet.has(k));
  const removed = oldKeywords.filter((k) => !newSet.has(k));
  const unchanged = newKeywords.filter((k) => oldSet.has(k));

  if (added.length === 0 && removed.length === 0 && unchanged.length === 0) {
    return <span className="text-[13px] text-app-text-tertiary">—</span>;
  }

  return (
    <>
      {added.map((kw) => (
        <span className="rounded-full border border-app-success-border bg-app-success-soft px-2 py-0.5 text-[11px] font-medium text-app-success" key={`add-${kw}`}>
          +{kw}
        </span>
      ))}
      {removed.map((kw) => (
        <span className="rounded-full border border-app-danger-border bg-app-danger-soft px-2 py-0.5 text-[11px] font-medium text-app-danger line-through" key={`del-${kw}`}>
          {kw}
        </span>
      ))}
      {unchanged.map((kw) => (
        <span className="rounded-full border border-app-border-soft bg-app-surface px-2 py-0.5 text-[11px] font-medium text-app-text-secondary" key={`keep-${kw}`}>
          {kw}
        </span>
      ))}
    </>
  );
}

type ResumePreviewMetrics = {
  estimatedLines: number;
  keywordCount: number;
  bulletCount: number;
  densityPercent: number;
  tone: "ready" | "tight" | "long";
};

type ResumeMatchInsights = {
  coveredKeywords: string[];
  evidenceStrength: number;
  firstFix: string;
  firstFixDetail: string;
  keywordCoverage: number;
  missingKeywords: string[];
  skillCoverage: number;
};

function ResumePreviewPanel({
  copy,
  draft,
  job,
  language,
  metrics
}: {
  copy: ReturnType<typeof getResumeDraftCopy>;
  draft: ResumeTailoringDraft;
  job: JobRecord;
  language: "en" | "zh";
  metrics: ResumePreviewMetrics;
}) {
  const status = getResumePreviewStatus(metrics, copy);
  const title = getJobTitle(job, language);
  const summary = draft.summary_en.trim();
  const bullets = draft.bullets_en.filter(Boolean);
  const keywords = draft.keywords.filter(Boolean);
  const riskNotes = draft.risk_notes_zh.filter(Boolean);

  return (
    <section className="rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-app-text-primary">
            {copy.previewTitle}
          </p>
          <p className="mt-0.5 text-[12px] leading-5 text-app-text-tertiary">
            {copy.previewSubtitle}
          </p>
        </div>
        <span
          className={cn(
            "w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold",
            status.className
          )}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-app-border-soft bg-app-surface p-3 shadow-app-card">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold text-app-text-primary">
            {copy.previewDensity}
          </p>
          <p className="text-[11px] text-app-text-tertiary">
            {metrics.estimatedLines} {copy.previewEstimatedLines}
          </p>
        </div>
        <ProgressBar
          className="mt-2"
          tone={metrics.tone === "ready" ? "success" : metrics.tone === "tight" ? "warning" : "danger"}
          value={metrics.densityPercent}
        />
        <p className="mt-2 text-[12px] leading-5 text-app-text-secondary">
          {status.helper}
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-app-border-soft bg-app-paper-muted p-3 shadow-inner">
        <div className="mx-auto max-w-[430px] rounded-xs border border-app-border-soft bg-app-paper px-5 py-6 text-app-text-primary shadow-app-panel">
          <div className="border-b border-app-border-soft pb-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-app-accent">
              {copy.previewEyebrow}
            </p>
            <h3 className="mt-1 text-[18px] font-semibold leading-tight text-app-text-primary">
              {title}
            </h3>
            <p className="mt-0.5 text-[12px] text-app-text-tertiary">
              {job.company}
            </p>
          </div>

          <div className="mt-4 space-y-4">
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                {copy.previewSummary}
              </h4>
              <p className="mt-1.5 text-[12px] leading-5 text-app-text-secondary">
                {summary || copy.previewEmpty}
              </p>
            </section>

            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                {copy.previewBullets}
              </h4>
              {bullets.length ? (
                <ul className="mt-1.5 space-y-1.5 text-[12px] leading-5 text-app-text-secondary">
                  {bullets.slice(0, 4).map((item) => (
                    <li className="flex gap-2" key={item}>
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-app-text-tertiary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[12px] leading-5 text-app-text-tertiary">
                  {copy.previewEmpty}
                </p>
              )}
            </section>

            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                {copy.previewKeywords}
              </h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(keywords.length ? keywords : [copy.previewEmpty]).slice(0, 10).map((item) => (
                  <span
                    className="rounded-full border border-app-border-soft bg-app-surface px-2 py-0.5 text-[10px] font-medium text-app-text-secondary shadow-app-card"
                    key={item}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>

            {riskNotes.length ? (
              <section className="rounded-xs border border-app-warning-border bg-app-warning-soft px-3 py-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-app-warning">
                  {copy.previewGuardrails}
                </h4>
                <p className="mt-1 text-[11px] leading-4 text-app-warning">
                  {riskNotes[0]}
                </p>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function createResumeTailoringVersion(
  draft: ResumeTailoringDraft,
  options: { count: number; reviewed: boolean }
): ResumeTailoringVersion {
  const createdAt = new Date().toISOString();

  return {
    id: createClientId(),
    created_at: createdAt,
    label: `Version ${options.count + 1}`,
    draft,
    reviewed: options.reviewed
  };
}

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `version-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

async function copyTextToClipboard(value: string) {
  if (copyTextWithTextarea(value)) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  throw new Error("Copy command failed");
}

function copyTextWithTextarea(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

function createFallbackResumeDraft(job: JobRecord): ResumeTailoringDraft {
  return {
    summary_en:
      job.resume_tailoring_draft?.summary_en ||
      job.resume_tailoring_advice_en[0] ||
      job.ai_summary_en,
    bullets_en:
      job.resume_tailoring_draft?.bullets_en?.length
        ? job.resume_tailoring_draft.bullets_en
        : job.resume_tailoring_advice_en.slice(0, 3),
    keywords:
      job.resume_tailoring_draft?.keywords?.length
        ? job.resume_tailoring_draft.keywords
        : job.resume_keywords.slice(0, 10),
    explanation_zh:
      job.resume_tailoring_draft?.explanation_zh ||
      job.resume_tailoring_advice_zh[0] ||
      job.ai_summary_zh,
    risk_notes_zh:
      job.resume_tailoring_draft?.risk_notes_zh?.length
        ? job.resume_tailoring_draft.risk_notes_zh
        : job.red_flags_zh.slice(0, 3)
  };
}

function buildResumePolishJobContext(job: JobRecord) {
  return {
    company: job.company,
    important_tools: job.important_tools,
    job_title_en: job.job_title_en,
    job_title_original: job.job_title_original,
    job_title_zh: job.job_title_zh,
    key_strengths_en: job.key_strengths_en,
    key_strengths_zh: job.key_strengths_zh,
    main_gaps_en: job.main_gaps_en,
    main_gaps_zh: job.main_gaps_zh,
    match_score: job.match_score,
    matched_skills: job.matched_skills,
    missing_skills: job.missing_skills,
    positive_signals_en: job.positive_signals_en,
    positive_signals_zh: job.positive_signals_zh,
    raw_jd: job.raw_jd,
    red_flags_en: job.red_flags_en,
    red_flags_zh: job.red_flags_zh,
    resume_focus_points: job.recommended_next_action.resume_focus_points,
    resume_keywords: job.resume_keywords,
    resume_tailoring_advice_en: job.resume_tailoring_advice_en,
    resume_tailoring_advice_zh: job.resume_tailoring_advice_zh,
    skills: job.skills,
    tools: job.tools
  };
}

function normalizeDraftForm(draft: ResumeTailoringDraft): ResumeTailoringDraft {
  return {
    summary_en: draft.summary_en.trim(),
    bullets_en: draft.bullets_en.map((item) => item.trim()).filter(Boolean),
    keywords: draft.keywords.map((item) => item.trim()).filter(Boolean),
    explanation_zh: draft.explanation_zh.trim(),
    risk_notes_zh: draft.risk_notes_zh.map((item) => item.trim()).filter(Boolean)
  };
}

function getResumeChecklist(
  draft: ResumeTailoringDraft,
  job: JobRecord,
  copy: ReturnType<typeof getResumeDraftCopy>
) {
  const hasRelevantKeyword = draft.keywords.some((keyword) =>
    job.resume_keywords.some(
      (sourceKeyword) =>
        sourceKeyword.toLowerCase() === keyword.toLowerCase()
    )
  );

  return [
    {
      complete: draft.summary_en.length >= 60,
      label: copy.checklistSummary
    },
    {
      complete: draft.bullets_en.length >= 2,
      label: copy.checklistBullets
    },
    {
      complete: draft.keywords.length >= 4 && hasRelevantKeyword,
      label: copy.checklistKeywords
    }
  ];
}

function formatResumeDraftPackage(
  draft: ResumeTailoringDraft,
  job: JobRecord,
  copy: ReturnType<typeof getResumeDraftCopy>
) {
  return [
    `${copy.packageRole}: ${job.job_title_en || job.job_title_original}`,
    `${copy.packageCompany}: ${job.company}`,
    "",
    copy.summary,
    draft.summary_en,
    "",
    copy.bullets,
    ...draft.bullets_en.map((item) => `- ${item}`),
    "",
    copy.packageKeywords,
    draft.keywords.join(", "),
    "",
    copy.risks,
    ...draft.risk_notes_zh.map((item) => `- ${item}`)
  ]
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n");
}

function getResumeMatchInsights(
  draft: ResumeTailoringDraft,
  job: JobRecord,
  language: "en" | "zh",
  copy: ReturnType<typeof getResumeDraftCopy>
): ResumeMatchInsights {
  const targetKeywords = uniqueStrings([
    ...job.resume_keywords,
    ...job.skills,
    ...job.important_tools
  ]);
  const draftText = getDraftSearchText(draft);
  const coveredKeywords = targetKeywords.filter((keyword) =>
    hasDraftKeyword(draftText, keyword)
  );
  const missingKeywords = targetKeywords.filter(
    (keyword) => !coveredKeywords.includes(keyword)
  );
  const keywordCoverage = getCoveragePercent(
    coveredKeywords.length,
    targetKeywords.length
  );
  const skillCoverage = getCoveragePercent(
    job.matched_skills.length,
    job.matched_skills.length + job.missing_skills.length
  );
  const evidenceStrength = getResumeEvidenceStrength(
    draft,
    coveredKeywords.length,
    targetKeywords.length
  );
  const priorityGap = sortMissingSkillDetails(job.missing_skill_details)[0];
  const primaryMissingKeyword = missingKeywords[0];
  const primaryFocus = job.recommended_next_action.resume_focus_points
    .map((item) => localizeDisplayValue(item, language))
    .find(isUsefulValue);

  if (priorityGap) {
    const skill = localizeKeyword(priorityGap.skill, language);
    return {
      coveredKeywords: coveredKeywords.slice(0, 8),
      evidenceStrength,
      firstFix: copy.firstFixSkill(skill),
      firstFixDetail: localizedText(
        priorityGap.why_it_matters_en,
        priorityGap.why_it_matters_zh,
        language
      ),
      keywordCoverage,
      missingKeywords: missingKeywords.slice(0, 8),
      skillCoverage
    };
  }

  if (primaryMissingKeyword) {
    const keyword = localizeKeyword(primaryMissingKeyword, language);
    return {
      coveredKeywords: coveredKeywords.slice(0, 8),
      evidenceStrength,
      firstFix: copy.firstFixKeyword(keyword),
      firstFixDetail: copy.firstFixKeywordDetail,
      keywordCoverage,
      missingKeywords: missingKeywords.slice(0, 8),
      skillCoverage,
    };
  }

  return {
    coveredKeywords: coveredKeywords.slice(0, 8),
    evidenceStrength,
    firstFix: primaryFocus || copy.firstFixGeneric,
    firstFixDetail: copy.firstFixGenericDetail,
    keywordCoverage,
    missingKeywords: missingKeywords.slice(0, 8),
    skillCoverage,
  };
}

function getResumeEvidenceStrength(
  draft: ResumeTailoringDraft,
  coveredKeywordCount: number,
  totalKeywordCount: number
) {
  const summaryPoints = draft.summary_en.trim().length >= 60 ? 22 : 8;
  const bulletPoints = Math.min(3, draft.bullets_en.filter(Boolean).length) * 16;
  const keywordPoints = totalKeywordCount
    ? Math.round((coveredKeywordCount / totalKeywordCount) * 34)
    : 0;
  const riskPoints = draft.risk_notes_zh.some(isUsefulValue) ? 10 : 0;

  return Math.min(100, summaryPoints + bulletPoints + keywordPoints + riskPoints);
}

function getResumePreviewMetrics(draft: ResumeTailoringDraft): ResumePreviewMetrics {
  const summaryLines = estimateTextLines(draft.summary_en, 86);
  const bulletLines = draft.bullets_en.reduce(
    (sum, item) => sum + Math.max(1, estimateTextLines(item, 74)),
    0
  );
  const keywordLines = estimateTextLines(draft.keywords.join(", "), 92);
  const riskLines = draft.risk_notes_zh.reduce(
    (sum, item) => sum + Math.max(1, estimateTextLines(item, 58)),
    0
  );
  const estimatedLines = 8 + summaryLines + bulletLines + keywordLines + riskLines;
  const tone =
    estimatedLines <= 24 ? "ready" : estimatedLines <= 32 ? "tight" : "long";

  return {
    bulletCount: draft.bullets_en.length,
    densityPercent: Math.min(100, Math.round((estimatedLines / 34) * 100)),
    estimatedLines,
    keywordCount: draft.keywords.length,
    tone
  };
}

function estimateTextLines(value: string, charactersPerLine: number) {
  const length = value.trim().length;
  if (!length) return 1;
  return Math.ceil(length / charactersPerLine);
}

function getResumePreviewStatus(
  metrics: ResumePreviewMetrics,
  copy: ReturnType<typeof getResumeDraftCopy>
) {
  if (metrics.tone === "ready") {
    return {
      className: "border border-app-success-border bg-app-success-soft text-app-success",
      helper: copy.previewReadyHelper,
      label: copy.previewReady
    };
  }

  if (metrics.tone === "tight") {
    return {
      className: "border border-app-warning-border bg-app-warning-soft text-app-warning",
      helper: copy.previewTightHelper,
      label: copy.previewTight
    };
  }

  return {
    className: "border border-app-danger-border bg-app-danger-soft text-app-danger",
    helper: copy.previewLongHelper,
    label: copy.previewLong,
  };
}

function sortMissingSkillDetails(details: JobRecord["missing_skill_details"]) {
  return [...details].sort(
    (a, b) => getPriorityRank(a.priority) - getPriorityRank(b.priority)
  );
}

function getPriorityRank(priority: PriorityLevel) {
  const ranks: Record<PriorityLevel, number> = {
    High: 0,
    Medium: 1,
    Low: 2
  };

  return ranks[priority];
}

function getDraftSearchText(draft: ResumeTailoringDraft) {
  return [
    draft.summary_en,
    draft.bullets_en.join(" "),
    draft.keywords.join(" ")
  ].join(" ").toLowerCase();
}

function hasDraftKeyword(draftText: string, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return false;
  }

  return draftText.includes(normalizedKeyword);
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
