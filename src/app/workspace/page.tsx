"use client";

import { SVGProps, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusSelect } from "@/components/jobs/status-select";
import { AppCard } from "@/components/ui/app-card";
import { AppSpotlightCard } from "@/components/ui/app-spotlight-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageHeaderMetric } from "@/components/ui/page-header";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useToast } from "@/components/ui/toast";
import { getUserFacingNextStepText } from "@/lib/jobs/user-facing-next-step";
import { trackProductEvent } from "@/lib/product/analytics";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import {
  deleteCloudJobs,
  GUEST_WORKSPACE_IMPORTED_EVENT,
  hydrateJobsFromCloud,
  upsertCloudJobs
} from "@/lib/storage/cloud-sync";
import {
  loadJobs,
  prependMissingJobs,
  saveJobs,
  updateStoredJobStatus
} from "@/lib/storage/jobs";
import { createStorageScope } from "@/lib/storage/scope";
import { cn } from "@/lib/utils";
import { formatOptionalDate, getJobTitle } from "@/lib/jobs/job-detail-utils";
import { getWorkspaceCopy } from "@/app/workspace/_lib/workspace-copy";
import {
  buildActionQueue,
  buildTrackerAnalytics,
  compareJobs,
  deadlineIsApproaching,
  exportJobsToCsv,
  getActionStageTone,
  getNextFocusItem,
  getTodayStartTime,
  jobNeedsAction,
  matchesDeadlineFilter,
  matchesMatchFilter,
  type ActionQueueItem,
  type ActionStageFilter,
  type DeadlineFilter,
  type MatchFilter,
  type SortMode
} from "@/app/workspace/_lib/workspace-utils";
import { TrackerToolbar } from "@/app/workspace/_components/tracker-toolbar";
import {
  ActionStage,
  ApplicationRecommendation,
  ApplicationStatus,
  JobRecord
} from "@/types/job";

export default function JobListPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { language, t, statuses, recommendations } = useLanguage();
  const { addToast } = useToast();
  const userId = session?.user.id ?? null;
  const sessionRef = useRef(session);
  const storageScope = useMemo(() => createStorageScope(userId), [userId]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">(
    "all"
  );
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [actionStageFilter, setActionStageFilter] =
    useState<ActionStageFilter>("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("score-desc");
  const [highMatchOnly, setHighMatchOnly] = useState(false);
  const [needsActionOnly, setNeedsActionOnly] = useState(false);
  const [deadlineApproachingOnly, setDeadlineApproachingOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] =
    useState<ApplicationStatus>("Not Applied");
  const [guideExpanded, setGuideExpanded] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      hydrateJobsFromCloud(sessionRef.current)
        .then(setJobs)
        .finally(() => setIsLoaded(true));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    const reloadImportedGuestData = () => {
      void hydrateJobsFromCloud(sessionRef.current).then(setJobs);
    };

    window.addEventListener(
      GUEST_WORKSPACE_IMPORTED_EVENT,
      reloadImportedGuestData
    );

    return () =>
      window.removeEventListener(
        GUEST_WORKSPACE_IMPORTED_EVENT,
        reloadImportedGuestData
      );
  }, [userId]);

  const locale = language === "zh" ? "zh-CN" : "en-AU";
  const copy = getWorkspaceCopy(language);

  const jobTypes = useMemo(() => {
    return Array.from(
      new Set(jobs.map((job) => job.job_type_en).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const todayStart = getTodayStartTime();

    return jobs
      .filter((job) => {
        const matchesSearch =
          !query ||
          job.company.toLowerCase().includes(query) ||
          job.job_title_original.toLowerCase().includes(query) ||
          (job.job_title_en && job.job_title_en.toLowerCase().includes(query));
        const matchesStatus =
          statusFilter === "all" || job.application_status === statusFilter;
        const matchesJobType =
          jobTypeFilter === "all" || job.job_type_en === jobTypeFilter;
        const matchesDeadline = matchesDeadlineFilter(
          job.application_deadline,
          deadlineFilter,
          todayStart
        );
        const matchesMatch = matchesMatchFilter(job.match_score, matchFilter);
        const matchesActionStage =
          actionStageFilter === "all" || job.action_stage === actionStageFilter;
        const matchesHighMatch = !highMatchOnly || job.match_score >= 80;
        const matchesNeedsAction = !needsActionOnly || jobNeedsAction(job);
        const matchesDeadlineApproaching =
          !deadlineApproachingOnly ||
          deadlineIsApproaching(job.application_deadline, todayStart);

        return (
          matchesSearch &&
          matchesStatus &&
          matchesJobType &&
          matchesDeadline &&
          matchesMatch &&
          matchesActionStage &&
          matchesHighMatch &&
          matchesNeedsAction &&
          matchesDeadlineApproaching
        );
      })
      .sort((a, b) => compareJobs(a, b, sortMode));
  }, [
    deadlineApproachingOnly,
    deadlineFilter,
    actionStageFilter,
    highMatchOnly,
    jobTypeFilter,
    matchFilter,
    jobs,
    needsActionOnly,
    search,
    sortMode,
    statusFilter
  ]);

  const filteredJobIds = useMemo(
    () => filteredJobs.map((job) => job.id),
    [filteredJobs]
  );
  const selectedJobs = useMemo(
    () => jobs.filter((job) => selectedJobIds.includes(job.id)),
    [jobs, selectedJobIds]
  );
  const selectedVisibleCount = selectedJobIds.filter((jobId) =>
    filteredJobIds.includes(jobId)
  ).length;
  const allVisibleSelected =
    filteredJobIds.length > 0 && selectedVisibleCount === filteredJobIds.length;
  const analytics = useMemo(() => buildTrackerAnalytics(jobs), [jobs]);
  const actionQueue = useMemo(
    () => buildActionQueue(jobs, copy, language, locale),
    [copy, jobs, language, locale]
  );
  const nextFocus = useMemo(() => getNextFocusItem(actionQueue), [actionQueue]);
  const handleStatusChange = (jobId: string, status: ApplicationStatus) => {
    const updatedJob = updateStoredJobStatus(jobId, status, "", storageScope);
    setJobs(loadJobs(storageScope));
    if (updatedJob) {
      void upsertCloudJobs(sessionRef.current, [updatedJob]);
    }
    addToast(t.updateSuccess);
  };

  const handleLoadSampleData = () => {
    const nextJobs = prependMissingJobs(loadJobs(storageScope), SAMPLE_JOBS);
    saveJobs(nextJobs, storageScope);
    setJobs(nextJobs);
    void upsertCloudJobs(sessionRef.current, nextJobs);
    addToast(t.sampleDataLoaded, "info");
    trackProductEvent("demo_sample_loaded", {
      jobCount: SAMPLE_JOBS.length,
      source: "tracker"
    });
  };

  const handleToggleJob = (jobId: string, checked: boolean) => {
    setSelectedJobIds((current) =>
      checked
        ? Array.from(new Set([...current, jobId]))
        : current.filter((id) => id !== jobId)
    );
  };

  const handleToggleAllVisible = (checked: boolean) => {
    setSelectedJobIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...filteredJobIds]));
      }

      return current.filter((id) => !filteredJobIds.includes(id));
    });
  };

  const handleBatchStatusUpdate = () => {
    const updatedJobs = selectedJobIds
      .map((jobId) =>
        updateStoredJobStatus(jobId, batchStatus, "", storageScope)
      )
      .filter(Boolean) as JobRecord[];
    const nextJobs = loadJobs(storageScope);
    setJobs(nextJobs);
    void upsertCloudJobs(sessionRef.current, updatedJobs);
    setSelectedJobIds([]);
    addToast(t.updateSuccess);
  };

  const handleBatchDelete = () => {
    if (!window.confirm(t.batchDeleteConfirm)) {
      return;
    }

    const selectedSet = new Set(selectedJobIds);
    const nextJobs = jobs.filter((job) => !selectedSet.has(job.id));
    saveJobs(nextJobs, storageScope);
    setJobs(loadJobs(storageScope));
    void deleteCloudJobs(sessionRef.current, selectedJobIds);
    setSelectedJobIds([]);
    addToast(t.deleteSuccess);
  };

  const handleExportCsv = () => {
    const exportJobs = selectedJobs.length ? selectedJobs : filteredJobs;
    exportJobsToCsv(exportJobs);
    addToast(t.exportSuccess);
    trackProductEvent("csv_exported", {
      jobCount: exportJobs.length,
      selectedOnly: selectedJobs.length > 0
    });
  };

  const handleOpenJobDetail = (
    job: JobRecord,
    targetTab?: "actions" | "resume" | "tracking"
  ) => {
    trackProductEvent("job_detail_opened", {
      jobId: job.id,
      matchScore: job.match_score,
      source: targetTab ? "next_focus" : "tracker",
      status: job.application_status
    });
    router.push(`/jobs/${job.id}${targetTab ? `?tab=${targetTab}` : ""}`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMatchFilter("all");
    setActionStageFilter("all");
    setJobTypeFilter("all");
    setDeadlineFilter("all");
    setSortMode("score-desc");
    setHighMatchOnly(false);
    setNeedsActionOnly(false);
    setDeadlineApproachingOnly(false);
  };

  const handleActionStageFilterChange = (stage: ActionStageFilter) => {
    setActionStageFilter(stage);
    window.setTimeout(() => {
      const results = document.getElementById("opportunity-results");
      results?.scrollIntoView({ behavior: "smooth", block: "start" });
      results?.focus({ preventScroll: true });
    }, 80);
  };

  if (!isLoaded) {
    return (
      <AppCard className="p-6 text-sm text-app-text-secondary">
        {t.analyzing}
      </AppCard>
    );
  }

  return (
    <div className="app-stagger space-y-8 pb-8">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/add" variant="primary">
              {copy.importJob}
            </ButtonLink>
            {jobs.length === 0 ? (
              <Button variant="secondary" onClick={handleLoadSampleData}>
                {t.loadSampleData}
              </Button>
            ) : null}
          </div>
        }
        metadata={
          jobs.length ? (
            <>
              <PageHeaderMetric>
                {analytics.totalJobs} {t.totalJobs.toLowerCase()}
              </PageHeaderMetric>
              <PageHeaderMetric tone="success">
                {analytics.highMatchCount} {t.highMatch.toLowerCase()}
              </PageHeaderMetric>
              <PageHeaderMetric tone="warning">
                {analytics.needsActionCount} {copy.needAction}
              </PageHeaderMetric>
            </>
          ) : null
        }
        subtitle={copy.subtitle}
        title={t.jobList}
      />

      {jobs.length > 0 ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="xl:order-2">
            <NextFocusPanel
              copy={copy}
              focusItem={nextFocus}
              locale={locale}
              onFocusStage={handleActionStageFilterChange}
              onOpenJobTab={handleOpenJobDetail}
              recommendationLabels={recommendations}
              statusLabels={statuses}
            />
          </div>

          <div className="space-y-4 xl:order-1">
            <div className="grid gap-3 md:grid-cols-3">
              <WorkspaceMetricTile
                label={copy.rolesTracked}
                value={analytics.totalJobs}
              />
              <WorkspaceMetricTile
                label={copy.highMatchTitle}
                tone="success"
                value={analytics.highMatchCount}
              />
              <WorkspaceMetricTile
                label={copy.needActionTitle}
                tone="warning"
                value={analytics.needsActionCount}
              />
            </div>

            <button
              className="flex w-full items-center gap-2 rounded-lg border border-app-border-soft bg-app-surface px-4 py-2.5 text-[13px] font-semibold text-app-text-secondary shadow-app-card backdrop-blur-xl transition-colors hover:border-app-border hover:bg-app-surface-hover hover:text-app-text-primary"
              onClick={() => setGuideExpanded((v) => !v)}
              type="button"
            >
              <svg
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${guideExpanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span>{copy.workflowGuideToggle}</span>
              <span className="ml-auto text-[11px] font-medium text-app-text-tertiary">
                {copy.stepOneLabel} · {copy.stepTwoLabel} · {copy.stepThreeLabel}
              </span>
            </button>

            {guideExpanded ? (
              <AppCard className="p-5 sm:p-6" variant="elevated">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                      {copy.commandEyebrow}
                    </p>
                    <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-app-text-primary">
                      {copy.commandTitle}
                    </h2>
                    <p className="mt-2 max-w-2xl text-[13px] leading-6 text-app-text-secondary">
                      {copy.commandSubtitle}
                    </p>
                  </div>
                  <ButtonLink className="shrink-0" href="/add" variant="secondary">
                    {copy.captureAndAnalyze}
                  </ButtonLink>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <WorkflowToolCard
                    body={copy.importToolBody}
                    cta={copy.openImportInbox}
                    href="/add"
                    icon="plus"
                    label={copy.stepOneLabel}
                    title={copy.importToolTitle}
                  />
                  <WorkflowToolCard
                    body={copy.resumeToolBody}
                    cta={copy.openResumeHub}
                    href="/resume-hub"
                    icon="profile"
                    label={copy.stepTwoLabel}
                    title={copy.resumeToolTitle}
                  />
                  <WorkflowToolCard
                    body={copy.followUpToolBody}
                    cta={copy.openFollowUp}
                    href="/follow-up"
                    icon="chat"
                    label={copy.stepThreeLabel}
                    title={copy.followUpToolTitle}
                  />
                </div>
              </AppCard>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.82fr)]">
          <AppCard className="p-5 sm:p-6" variant="elevated">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                  {copy.commandEyebrow}
                </p>
                <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-app-text-primary">
                  {copy.commandTitle}
                </h2>
                <p className="mt-2 max-w-2xl text-[13px] leading-6 text-app-text-secondary">
                  {copy.commandSubtitle}
                </p>
              </div>
              <ButtonLink className="shrink-0" href="/add" variant="secondary">
                {copy.captureAndAnalyze}
              </ButtonLink>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <WorkflowToolCard
                body={copy.importToolBody}
                cta={copy.openImportInbox}
                href="/add"
                icon="plus"
                label={copy.stepOneLabel}
                title={copy.importToolTitle}
              />
              <WorkflowToolCard
                body={copy.resumeToolBody}
                cta={copy.openResumeHub}
                href="/resume-hub"
                icon="profile"
                label={copy.stepTwoLabel}
                title={copy.resumeToolTitle}
              />
              <WorkflowToolCard
                body={copy.followUpToolBody}
                cta={copy.openFollowUp}
                href="/follow-up"
                icon="chat"
                label={copy.stepThreeLabel}
                title={copy.followUpToolTitle}
              />
            </div>
          </AppCard>

        <NextFocusPanel
          copy={copy}
          focusItem={nextFocus}
          locale={locale}
          onFocusStage={handleActionStageFilterChange}
          onOpenJobTab={handleOpenJobDetail}
          recommendationLabels={recommendations}
          statusLabels={statuses}
        />
      </section>
      )}

      <section className="space-y-4" id="opportunity-tracker">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight text-app-text-primary">
              {copy.trackerTitle}
            </h2>
            <p className="mt-1 text-[13px] text-app-text-secondary">
              {copy.trackerSubtitle}
            </p>
          </div>
          {jobs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-app-text-secondary">
                {filteredJobs.length} {t.totalJobs.toLowerCase()}
              </span>
              <Button variant="secondary" onClick={handleExportCsv}>
                {t.exportCsv}
              </Button>
            </div>
          ) : null}
        </div>

        {jobs.length > 0 ? (
          <>
            <button
              className="mb-3 flex w-full items-center gap-2 rounded-lg border border-app-border-soft bg-app-surface px-4 py-2.5 text-[13px] font-semibold text-app-text-secondary shadow-app-card backdrop-blur-xl transition-colors hover:bg-app-surface-hover hover:text-app-text-primary"
              onClick={() => setQueueExpanded((v) => !v)}
              type="button"
            >
              <svg
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${queueExpanded ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
              <span>{copy.actionQueueToggle}</span>
              <span className="ml-auto rounded-full bg-app-surface px-2.5 py-0.5 text-[11px] font-semibold text-app-text-tertiary">
                {actionQueue.filter(i => i.count > 0).length}/{actionQueue.length} {copy.activeStages}
              </span>
            </button>
            {queueExpanded ? (
              <ActionQueueBoard
                copy={copy}
                filteredCount={filteredJobs.length}
                items={actionQueue}
                language={language}
                onStageChange={handleActionStageFilterChange}
                selectedStage={actionStageFilter}
                totalCount={jobs.length}
              />
            ) : null}
          </>
        ) : null}

        {jobs.length > 0 ? (
          <TrackerToolbar
            batchStatus={batchStatus}
            deadlineApproachingOnly={deadlineApproachingOnly}
            deadlineFilter={deadlineFilter}
            highMatchOnly={highMatchOnly}
            jobTypeFilter={jobTypeFilter}
            jobTypes={jobTypes}
            matchFilter={matchFilter}
            needsActionOnly={needsActionOnly}
            onBatchDelete={handleBatchDelete}
            onBatchStatusChange={setBatchStatus}
            onBatchStatusUpdate={handleBatchStatusUpdate}
            onDeadlineApproachingOnlyChange={setDeadlineApproachingOnly}
            onDeadlineFilterChange={setDeadlineFilter}
            onHighMatchOnlyChange={setHighMatchOnly}
            onJobTypeFilterChange={setJobTypeFilter}
            onMatchFilterChange={setMatchFilter}
            onNeedsActionOnlyChange={setNeedsActionOnly}
            onResetFilters={resetFilters}
            onSearchChange={setSearch}
            onShowAdvancedFiltersChange={setShowAdvancedFilters}
            onSortModeChange={setSortMode}
            onStatusFilterChange={setStatusFilter}
            search={search}
            selectedCount={selectedJobIds.length}
            showAdvancedFilters={showAdvancedFilters}
            sortMode={sortMode}
            statusFilter={statusFilter}
            t={t}
            statuses={statuses}
          />
        ) : null}

        <AppCard
          aria-live="polite"
          className="scroll-mt-24 overflow-hidden focus:outline-none"
          id="opportunity-results"
          tabIndex={-1}
          variant="elevated"
        >
          {jobs.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-app-border-soft bg-app-surface text-app-accent shadow-app-card">
                <WorkspaceIcon name="spark" />
              </div>
              <h2 className="text-xl font-semibold text-app-text-primary">
                {t.emptyTitle}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-app-text-secondary">
                {t.emptyBody}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/add">
                  {copy.importJob}
                </ButtonLink>
                <Button variant="secondary" onClick={handleLoadSampleData}>
                  {t.loadSampleData}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-app-border-soft bg-app-surface px-5 py-3 backdrop-blur-xl">
                <input
                  aria-label={t.selectedJobs}
                  checked={allVisibleSelected}
                  className="app-checkbox h-4 w-4 rounded border border-app-border-soft"
                  onChange={(event) =>
                    handleToggleAllVisible(event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="text-xs font-medium text-app-text-secondary">
                  {selectedJobIds.length > 0
                    ? `${selectedJobIds.length} ${t.selectedJobs.toLowerCase()}`
                    : t.clickRowsHint}
                </span>
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                {filteredJobs.length === 0 ? (
                  <div className="rounded-lg border border-app-border-soft bg-app-surface px-4 py-8 text-center text-sm text-app-text-secondary shadow-app-card">
                    {t.noMatches}
                  </div>
                ) : (
                  filteredJobs.map((job, index) => (
                    <div
                      className="layout-reorder-enter"
                      key={job.id}
                      style={{ animationDelay: `${Math.min(index * 40, 200)}ms` }}
                    >
                      <MobileJobCard
                        checked={selectedJobIds.includes(job.id)}
                        job={job}
                        labels={{
                          deadline: t.deadline,
                          matchScore: t.matchScore,
                          nextStep: copy.nextStep,
                          noDeadline: t.noDeadline,
                          openDetails: t.openDetails,
                          recommendation: t.recommendation,
                          status: t.status
                        }}
                        locale={locale}
                        nextStepNote={getUserFacingNextStepText(job, language)}
                        onCheckedChange={(checked) =>
                          handleToggleJob(job.id, checked)
                        }
                        onOpen={() => handleOpenJobDetail(job)}
                        recommendation={job.application_recommendation}
                        recommendationLabel={
                          recommendations[job.application_recommendation]
                        }
                        statusLabel={statuses[job.application_status]}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto bg-app-surface-subtle md:block">
                <table className="w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-app-surface-muted text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary shadow-app-card backdrop-blur-xl">
                      <th className="w-10 px-5 py-3"> </th>
                      <th className="w-[26%] px-4 py-3">{t.roleCompany}</th>
                      <th className="w-[12%] px-4 py-3">{t.matchScore}</th>
                      <th className="w-[15%] px-4 py-3">{t.recommendation}</th>
                      <th className="w-[18%] px-4 py-3">{t.status}</th>
                      <th className="w-[29%] px-4 py-3">{t.nextAction}</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child_td]:border-b-0">
                    {filteredJobs.length === 0 ? (
                      <tr>
                        <td
                          className="px-5 py-12 text-center text-[13px] text-app-text-secondary"
                          colSpan={6}
                        >
                          {t.noMatches}
                        </td>
                      </tr>
                    ) : (
                      filteredJobs.map((job, index) => (
                        <tr
                          className="group cursor-pointer transition-[background-color,box-shadow] duration-200 hover:bg-app-surface-hover hover:shadow-app-card"
                          key={job.id}
                          onClick={() => handleOpenJobDetail(job)}
                          style={{
                            animation: `layout-reorder 320ms var(--app-motion-standard) both`,
                            animationDelay: `${Math.min(index * 30, 180)}ms`,
                          }}
                        >
                          <td
                            className="border-b border-app-border-soft px-5 py-3.5"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              aria-label={`${t.company}: ${job.company}`}
                              checked={selectedJobIds.includes(job.id)}
                              className="app-checkbox h-4 w-4 rounded border border-app-border-soft"
                              onChange={(event) =>
                                handleToggleJob(job.id, event.target.checked)
                              }
                              type="checkbox"
                            />
                          </td>
                          <td className="max-w-72 border-b border-app-border-soft px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <CompanyLogo company={job.company} logoUrl={job.company_logo_url} />
                              <div className="min-w-0">
                                <span className="line-clamp-1 text-[13px] font-semibold text-app-text-primary transition-colors group-hover:text-app-text-primary">
                                  {getJobTitle(job, language)}
                                </span>
                                <span className="mt-0.5 block truncate text-[12px] text-app-text-secondary">
                                  {job.company}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-app-border-soft px-4 py-3.5">
                            <MatchScoreCell
                              recommendation={job.application_recommendation}
                              score={job.match_score}
                            />
                          </td>
                          <td className="border-b border-app-border-soft px-4 py-3.5">
                            <RecommendationBadge
                              label={recommendations[job.application_recommendation]}
                              recommendation={job.application_recommendation}
                            />
                          </td>
                          <td
                            className="border-b border-app-border-soft px-4 py-3.5"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <StatusSelect
                              compact
                              onChange={(status) =>
                                handleStatusChange(job.id, status)
                              }
                              value={job.application_status}
                            />
                          </td>
                          <td className="max-w-[360px] border-b border-app-border-soft px-4 py-3.5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="line-clamp-2 min-w-0 text-[12px] font-medium leading-5 text-app-text-secondary">
                                {getUserFacingNextStepText(job, language)}
                              </p>
                              <button
                                className="shrink-0 rounded-full border border-app-border-soft bg-app-surface-solid px-3 py-1.5 text-[12px] font-semibold text-app-accent shadow-app-card transition-colors hover:border-app-border hover:bg-app-surface-hover"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenJobDetail(job);
                                }}
                                type="button"
                              >
                                {t.openDetails}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </AppCard>
      </section>
    </div>
  );
}

function SectionHeading({
  action,
  subtitle,
  title
}: {
  action?: React.ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-[16px] font-semibold text-app-text-primary">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function WorkflowToolCard({
  body,
  cta,
  href,
  icon,
  label,
  title
}: {
  body: string;
  cta: string;
  href: string;
  icon: WorkspaceIconName;
  label: string;
  title: string;
}) {
  return (
    <Link
      className="app-hover-lift group rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl hover:border-app-border hover:bg-app-surface-hover hover:shadow-app-card"
      href={href}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-accent-soft text-app-accent shadow-app-card transition-colors duration-300 ease-[var(--app-motion-standard)] group-hover:bg-app-accent group-hover:text-white">
          <WorkspaceIcon name={icon} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
            {label}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-app-text-primary">
            {title}
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
            {body}
          </p>
          <span className="mt-3 inline-flex text-[12px] font-semibold text-app-accent group-hover:text-app-accent-hover">
            {cta}
          </span>
        </div>
      </div>
    </Link>
  );
}

function WorkspaceMetricTile({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "neutral" | "success" | "warning";
  value: number;
}) {
  const toneClass =
    tone === "success"
      ? "text-app-success"
      : tone === "warning"
        ? "text-app-warning"
        : "text-app-text-primary";

  return (
    <AppCard className="px-4 py-3.5" variant="muted">
      <div className="flex items-end justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
          {label}
        </p>
        <p className={cn("text-2xl font-semibold leading-none", toneClass)}>
          {value}
        </p>
      </div>
    </AppCard>
  );
}

function NextFocusPanel({
  copy,
  focusItem,
  locale,
  onFocusStage,
  onOpenJobTab,
  recommendationLabels,
  statusLabels
}: {
  copy: ReturnType<typeof getWorkspaceCopy>;
  focusItem: ActionQueueItem | null;
  locale: string;
  onFocusStage: (stage: ActionStageFilter) => void;
  onOpenJobTab: (
    job: JobRecord,
    targetTab?: "actions" | "resume" | "tracking"
  ) => void;
  recommendationLabels: Record<ApplicationRecommendation, string>;
  statusLabels: Record<ApplicationStatus, string>;
}) {
  const job = focusItem?.nextJob ?? null;
  const focusActionTab = focusItem
    ? getFocusActionTab(focusItem.stage)
    : "actions";

  return (
    <AppCard as="aside" className="p-5 sm:p-6" variant="elevated">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
        {copy.nextFocusEyebrow}
      </p>
      <h2 className="mt-2 text-[18px] font-semibold tracking-tight text-app-text-primary">
        {copy.nextFocusTitle}
      </h2>
      <p className="mt-2 text-[13px] leading-6 text-app-text-secondary">
        {copy.nextFocusSubtitle}
      </p>

      {job && focusItem ? (
        <div className="mt-5 rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card">
          <div className="flex items-start gap-3">
            <CompanyLogo company={job.company} logoUrl={job.company_logo_url} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ActionStagePill
                  label={copy.stages[focusItem.stage]}
                  stage={focusItem.stage}
                />
                <RecommendationBadge
                  label={recommendationLabels[job.application_recommendation]}
                  recommendation={job.application_recommendation}
                />
              </div>
              <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug text-app-text-primary">
                {getJobTitle(job, locale.toLowerCase().startsWith("zh") ? "zh" : "en")}
              </h3>
              <p className="mt-1 text-[13px] text-app-text-secondary">
                {job.company} · {statusLabels[job.application_status]}
              </p>
            </div>
            <ScoreBadge
              recommendation={job.application_recommendation}
              score={job.match_score}
            />
          </div>
          <p className="mt-4 rounded-app border border-app-border-soft bg-app-surface px-3 py-2 text-[13px] leading-5 text-app-text-secondary">
            {focusItem.helper}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="min-h-9 px-3 text-[12px]"
              onClick={() => onOpenJobTab(job, focusActionTab)}
            >
              {copy.stageCtas[focusItem.stage]}
            </Button>
            <Button
              className="min-h-9 px-3 text-[12px]"
              onClick={() => onFocusStage(focusItem.stage)}
              variant="secondary"
            >
              {copy.focusQueue}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-app-border-soft bg-app-surface px-4 py-6 shadow-app-card">
          <h3 className="text-[14px] font-semibold text-app-text-primary">
            {copy.nextFocusEmptyTitle}
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
            {copy.nextFocusEmptyBody}
          </p>
          <ButtonLink className="mt-4 min-h-9 px-3 text-[12px]" href="/add">
            {copy.importJob}
          </ButtonLink>
        </div>
      )}
    </AppCard>
  );
}

function getFocusActionTab(stage: ActionStage): "actions" | "resume" | "tracking" {
  if (stage === "tailor_resume" || stage === "ready_to_apply") {
    return "resume";
  }

  if (stage === "follow_up") {
    return "tracking";
  }

  return "actions";
}

function ActionQueueBoard({
  copy,
  filteredCount,
  items,
  language,
  onStageChange,
  selectedStage,
  totalCount
}: {
  copy: ReturnType<typeof getWorkspaceCopy>;
  filteredCount: number;
  items: ActionQueueItem[];
  language: "en" | "zh";
  onStageChange: (stage: ActionStageFilter) => void;
  selectedStage: ActionStageFilter;
  totalCount: number;
}) {
  const selectedItem =
    selectedStage === "all"
      ? null
      : items.find((item) => item.stage === selectedStage) ?? null;

  return (
    <AppCard className="p-4 sm:p-5" variant="default">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          subtitle={copy.actionQueueSubtitle}
          title={copy.actionQueueTitle}
        />
        <button
          aria-pressed={selectedStage === "all"}
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold shadow-app-card transition-colors focus-visible:outline-none focus-visible:shadow-app-focus",
            selectedStage === "all"
              ? "border-app-accent bg-app-accent text-white"
              : "border-app-border-soft bg-app-surface text-app-text-secondary hover:bg-app-surface-hover"
          )}
          onClick={() => onStageChange("all")}
          type="button"
        >
          {copy.allStages}
          <span className={selectedStage === "all" ? "text-white/85" : "text-app-text-tertiary"}>
            {totalCount}
          </span>
        </button>
      </div>
      <div className="app-stagger mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => {
          const selected = selectedStage === item.stage;
          return (
            <AppSpotlightCard
              as="button"
              aria-pressed={selected}
              className={cn(
                "app-hover-lift min-h-[132px] rounded-lg border p-3 text-left shadow-app-card backdrop-blur-xl focus-visible:outline-none focus-visible:shadow-app-focus",
                selected
                  ? "border-app-info-border bg-app-surface shadow-app-panel"
                  : "border-app-border-soft bg-app-surface hover:bg-app-surface-hover hover:shadow-app-card",
                item.count === 0 && !selected && "opacity-75"
              )}
              key={item.stage}
              onClick={() => onStageChange(item.stage)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <ActionStagePill
                    label={copy.stages[item.stage]}
                    stage={item.stage}
                  />
                  <span
                    className={cn(
                      "w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      selected
                        ? "bg-app-accent text-white shadow-app-card"
                        : "bg-app-surface text-app-text-tertiary"
                    )}
                  >
                    {selected ? copy.inFocus : item.count > 0 ? copy.filterStage : copy.emptyStage}
                  </span>
                </div>
                <span className="rounded-full bg-app-surface px-2.5 py-1 text-[12px] font-semibold text-app-text-primary shadow-app-card">
                  {item.count}
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-app-text-secondary">
                {item.helper}
              </p>
              <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-5 text-app-text-primary">
                {item.nextJob
                  ? `${item.nextJob.company} · ${getJobTitle(item.nextJob, language)}`
                  : copy.noQueueJob}
              </p>
            </AppSpotlightCard>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-lg border border-app-border-soft bg-app-surface px-3 py-3 text-[13px] text-app-text-secondary shadow-app-card sm:flex-row sm:items-center sm:justify-between">
        <span>
          {selectedItem
            ? copy.stageFilterSummary(copy.stages[selectedItem.stage], filteredCount)
            : copy.allStageSummary(totalCount)}
        </span>
        {selectedItem ? (
          <button
            className="w-fit rounded-full border border-app-border-soft bg-app-surface px-3 py-1.5 text-[12px] font-semibold text-app-accent shadow-app-card transition-colors hover:bg-app-surface-hover focus-visible:outline-none focus-visible:shadow-app-focus"
            onClick={() => onStageChange("all")}
            type="button"
          >
            {copy.clearStageFilter}
          </button>
        ) : null}
      </div>
    </AppCard>
  );
}


function MatchScoreCell({
  recommendation,
  score
}: {
  recommendation: ApplicationRecommendation;
  score: number;
}) {
  const tone =
    recommendation === "Strongly apply"
      ? "bg-score-high"
      : recommendation === "Worth trying"
        ? "bg-app-accent"
        : recommendation === "Low priority"
          ? "bg-score-mid"
          : "bg-score-low";

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${tone}`} />
      <ScoreBadge score={score} recommendation={recommendation} />
    </span>
  );
}

function MobileJobCard({
  checked,
  job,
  labels,
  locale,
  nextStepNote,
  onCheckedChange,
  onOpen,
  recommendation,
  recommendationLabel,
  statusLabel
}: {
  checked: boolean;
  job: JobRecord;
  labels: {
    deadline: string;
    matchScore: string;
    nextStep: string;
    noDeadline: string;
    openDetails: string;
    recommendation: string;
    status: string;
  };
  locale: string;
  nextStepNote: string;
  onCheckedChange: (checked: boolean) => void;
  onOpen: () => void;
  recommendation: ApplicationRecommendation;
  recommendationLabel: string;
  statusLabel: string;
}) {
  return (
    <article className="app-hover-lift relative overflow-hidden rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl hover:border-app-border hover:bg-app-surface-hover hover:shadow-app-card">
      <div className="flex items-start gap-3">
        <input
          aria-label={`${job.company} ${job.job_title_original}`}
          checked={checked}
          className="app-checkbox mt-1 h-5 w-5 rounded border border-app-border-soft"
          onChange={(event) => onCheckedChange(event.target.checked)}
          type="checkbox"
        />
        <button
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none"
          onClick={onOpen}
          type="button"
        >
          <CompanyLogo company={job.company} logoUrl={job.company_logo_url} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-app-text-primary">
                  {getJobTitle(job, locale.toLowerCase().startsWith("zh") ? "zh" : "en")}
                </h2>
                <p className="mt-1 truncate text-[13px] text-app-text-secondary">
                  {job.company}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-app-text-secondary">
                  {labels.matchScore}
                </p>
                <ScoreBadge score={job.match_score} recommendation={recommendation} />
              </div>
            </div>
            <dl className="mt-4 grid gap-2 rounded-lg border border-app-border-soft bg-app-surface-muted p-3 text-sm shadow-app-card">
              <MobileMetaItem label={labels.recommendation} value={recommendationLabel} />
              <MobileMetaItem label={labels.status} value={statusLabel} />
              <MobileMetaItem
                label={labels.deadline}
                value={formatOptionalDate(
                  job.application_deadline,
                  locale,
                  labels.noDeadline
                )}
              />
              <MobileMetaItem label={labels.nextStep} value={nextStepNote} />
            </dl>
          </div>
        </button>
      </div>
      <div className="mt-4 flex justify-end border-t border-app-border-soft pt-4">
        <button
          className="rounded-app bg-app-accent px-3.5 py-2 text-[12px] font-semibold text-white shadow-app-card transition-colors hover:bg-app-accent-hover"
          onClick={onOpen}
          type="button"
        >
          {labels.openDetails}
        </button>
      </div>
    </article>
  );
}

function MobileMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-app-text-secondary">
        {label}
      </dt>
      <dd className="break-words text-[13px] font-medium text-app-text-primary">
        {value}
      </dd>
    </div>
  );
}

function RecommendationBadge({
  label,
  recommendation
}: {
  label: string;
  recommendation: ApplicationRecommendation;
}) {
  const tone =
    recommendation === "Strongly apply"
      ? "border-app-success-border bg-app-success-soft text-app-success"
      : recommendation === "Worth trying"
        ? "border-app-info-border bg-app-info-soft text-app-info shadow-app-card"
      : recommendation === "Low priority"
          ? "border-app-warning-border bg-app-warning-soft text-app-warning"
          : "border-app-danger-border bg-app-danger-soft text-app-danger";

  return (
    <span className={`inline-flex w-fit whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

function ActionStagePill({
  label,
  stage
}: {
  label: string;
  stage: ActionStage;
}) {
  const tone = getActionStageTone(stage);

  return (
    <span
      className={cn(
        "inline-flex w-fit min-w-[56px] items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-center text-[11px] font-semibold",
        tone
      )}
    >
      {label}
    </span>
  );
}

type WorkspaceIconName =
  | "briefcase"
  | "chart"
  | "chat"
  | "plus"
  | "profile"
  | "spark"
  | "target";

function WorkspaceIcon({
  className,
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: WorkspaceIconName }) {
  const baseProps: SVGProps<SVGSVGElement> = {
    className: cn("h-4 w-4", className),
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    ...props
  };

  if (name === "briefcase") {
    return (
      <svg {...baseProps}>
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
        <path d="M4 11.5h16" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg {...baseProps}>
        <path d="M4 19h16" />
        <path d="M7 16v-4" />
        <path d="M12 16V7" />
        <path d="M17 16v-7" />
      </svg>
    );
  }

  if (name === "chat") {
    return (
      <svg {...baseProps}>
        <path d="M5 18.5V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H9l-4 3.5Z" />
        <path d="M8.5 8.5h7" />
        <path d="M8.5 11.5H13" />
      </svg>
    );
  }

  if (name === "plus") {
    return (
      <svg {...baseProps}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg {...baseProps}>
        <path d="M20 20a8 8 0 0 0-16 0" />
        <circle cx="12" cy="8" r="4" />
      </svg>
    );
  }

  if (name === "target") {
    return (
      <svg {...baseProps}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
      </svg>
    );
  }

  return (
    <svg {...baseProps}>
      <path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18l-1.7-5.6L5 10.7 10.3 9 12 3.5Z" />
      <path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17l.5-1.5Z" />
    </svg>
  );
}
