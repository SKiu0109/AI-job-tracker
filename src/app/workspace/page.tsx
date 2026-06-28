"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { Input, Select } from "@/components/ui/form-controls";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusSelect } from "@/components/jobs/status-select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { MS_PER_DAY } from "@/lib/constants";
import { loadJobs, saveJobs, updateStoredJobStatus } from "@/lib/storage/jobs";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { useDragOrder } from "@/hooks/use-drag-order";
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  JobRecord
} from "@/types/job";

type DeadlineFilter = "all" | "overdue" | "next7" | "next30" | "none";
type MatchFilter = "all" | "high" | "medium" | "low";
type SortMode =
  | "score-desc"
  | "score-asc"
  | "deadline-asc"
  | "deadline-desc"
  | "created-desc"
  | "created-asc";

type TrackerAnalytics = {
  totalJobs: number;
  averageMatchScore: number;
  interviewCount: number;
  offerCount: number;
  distribution: Array<{
    label: string;
    count: number;
    percent: number;
  }>;
};

export default function JobListPage() {
  const router = useRouter();
  const { language, t, statuses, recommendations, nextActions } = useLanguage();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">(
    "all"
  );
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
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
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setJobs(loadJobs());
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

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
          matchesHighMatch &&
          matchesNeedsAction &&
          matchesDeadlineApproaching
        );
      })
      .sort((a, b) => compareJobs(a, b, sortMode));
  }, [
    deadlineApproachingOnly,
    deadlineFilter,
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
  const snapshotOrder = useDragOrder("snapshot-metric-order", [
    "applications",
    "averageMatchScore",
    "interviewCount",
    "offers",
  ] as const);

  const snapshotMetrics = useMemo(
    () => ({
      applications: { label: t.applications, value: analytics.totalJobs },
      averageMatchScore: { label: t.averageMatchScore, value: `${analytics.averageMatchScore}%` },
      interviewCount: { label: t.interviewCount, value: analytics.interviewCount },
      offers: { label: t.offers, value: analytics.offerCount },
    }),
    [t, analytics],
  );

  const handleStatusChange = (jobId: string, status: ApplicationStatus) => {
    const updatedJob = updateStoredJobStatus(jobId, status);
    setJobs(loadJobs());
    if (updatedJob) {
    }
    setMessage(t.updateSuccess);
  };

  const handleLoadSampleData = () => {
    saveJobs(SAMPLE_JOBS);
    setJobs(loadJobs());
    setMessage(t.sampleDataLoaded);
  };

  const handleToggleJob = (jobId: string, checked: boolean) => {
    setSelectedJobIds((current) =>
      checked ? Array.from(new Set([...current, jobId])) : current.filter((id) => id !== jobId)
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
    selectedJobIds.forEach((jobId) => updateStoredJobStatus(jobId, batchStatus));
    const nextJobs = loadJobs();
    setJobs(nextJobs);
    setSelectedJobIds([]);
    setMessage(t.updateSuccess);
  };

  const handleBatchDelete = () => {
    if (!window.confirm(t.batchDeleteConfirm)) {
      return;
    }

    const selectedSet = new Set(selectedJobIds);
    const nextJobs = jobs.filter((job) => !selectedSet.has(job.id));
    saveJobs(nextJobs);
    setJobs(loadJobs());
    setSelectedJobIds([]);
    setMessage(t.deleteSuccess);
  };

  const handleExportCsv = () => {
    const exportJobs = selectedJobs.length ? selectedJobs : filteredJobs;
    exportJobsToCsv(exportJobs);
    setMessage(t.exportSuccess);
  };

  const handleAnalyzeJdClick = () => {};

  const handleOpenJobDetail = (job: JobRecord) => {
    router.push(`/jobs/${job.id}`);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMatchFilter("all");
    setJobTypeFilter("all");
    setDeadlineFilter("all");
    setSortMode("score-desc");
    setHighMatchOnly(false);
    setNeedsActionOnly(false);
    setDeadlineApproachingOnly(false);
  };

  const locale = language === "zh" ? "zh-CN" : "en-AU";

  if (!isLoaded) {
    return (
      <div className="rounded-xl border bg-tertiary p-6 text-sm text-secondary">
        {t.analyzing}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ─── Compact header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {t.jobList}
          </h1>
          <p className="mt-1 text-sm text-secondary">
            {jobs.length
              ? `${analytics.totalJobs} ${t.totalJobs.toLowerCase()}, ${analytics.averageMatchScore}% ${t.averageMatchScore.toLowerCase()}`
              : t.trackerHeroSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {jobs.length === 0 ? (
            <Button variant="secondary" onClick={handleLoadSampleData}>
              {t.loadSampleData}
            </Button>
          ) : null}
          <ButtonLink href="/add" onClick={handleAnalyzeJdClick}>
            {t.emptyAction}
          </ButtonLink>
        </div>
      </div>

      {/* ─── Dashboard snapshot ─── */}
      {analytics.totalJobs > 0 ? (
        <div className="rounded-xl border border-black/[0.04] bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {snapshotOrder.items.map((key) => {
              const m = snapshotMetrics[key];
              const isActive = snapshotOrder.activeId === key;
              return (
                <div
                  key={key}
                  draggable
                  onDragStart={() => snapshotOrder.onDragStart(key)}
                  onDragEnter={() => snapshotOrder.onDragEnter(key)}
                  onDragEnd={snapshotOrder.onDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onTouchStart={(e) =>
                    snapshotOrder.onTouchStart(key, e.currentTarget)
                  }
                  onTouchEnd={snapshotOrder.onTouchEnd}
                  className={`group cursor-grab rounded-xl border border-black/[0.04] bg-[#FAFAFA] p-4 transition-all active:cursor-grabbing ${
                    isActive
                      ? "z-10 scale-[1.03] border-accent/30 shadow-md opacity-80"
                      : "hover:border-black/[0.08] hover:shadow-sm"
                  }`}
                >
                  <p className="text-[12px] font-medium text-secondary/70">{m.label}</p>
                  <p className="mt-1 text-[24px] font-semibold tracking-tight text-primary">
                    {m.value}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px]">
            <Link href="/dashboard" className="font-medium text-accent transition-colors hover:text-accent-hover">
              {t.viewFullDashboard} →
            </Link>
            <span className="text-secondary/40">{t.dashboardSnapshot}</span>
          </div>
        </div>
      ) : null}

      {/* ─── Success message ─── */}
      {message ? (
        <div className="rounded-lg border border-score-high-border bg-score-high-bg px-4 py-3 text-[13px] font-medium text-score-high">
          {message}
        </div>
      ) : null}

      {/* ─── Job count + batch actions header ─── */}
      {jobs.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-secondary">
            {filteredJobs.length} {t.totalJobs.toLowerCase()}
          </p>
          {selectedJobIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/10 bg-accent-subtle/30 px-3 py-2">
              <span className="text-[12px] font-medium text-accent">{selectedJobIds.length} {t.selectedJobs.toLowerCase()}</span>
              <Select
                value={batchStatus}
                onChange={(event) => setBatchStatus(event.target.value as ApplicationStatus)}
                className="w-32"
                aria-label={t.batchStatus}
              >
                {APPLICATION_STATUSES.map((status) => (<option key={status} value={status}>{statuses[status]}</option>))}
              </Select>
              <Button variant="secondary" onClick={handleBatchStatusUpdate}>{t.applyBatchStatus}</Button>
              <Button variant="secondary" onClick={handleBatchDelete}>{t.batchDelete}</Button>
              <button type="button" onClick={() => setSelectedJobIds([])} className="text-[12px] text-secondary/50 hover:text-secondary ml-1">✕</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={handleExportCsv}>{t.exportCsv}</Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Sticky filter toolbar ─── */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="rounded-xl border border-black/[0.06] bg-white/80 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 space-y-1.5">
              <span className="text-xs font-medium text-secondary">{t.search}</span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </label>

            <label className="w-36 space-y-1.5">
              <span className="text-xs font-medium text-secondary">{t.status}</span>
              <Select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as ApplicationStatus | "all")
                }
                className="w-full"
              >
                <option value="all">{t.allStatuses}</option>
                {APPLICATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statuses[status]}
                  </option>
                ))}
              </Select>
            </label>

            <label className="w-36 space-y-1.5">
              <span className="text-xs font-medium text-secondary">{t.matchFilter}</span>
              <Select
                value={matchFilter}
                onChange={(event) => setMatchFilter(event.target.value as MatchFilter)}
                className="w-full"
              >
                <option value="all">{t.allMatches}</option>
                <option value="high">{t.highMatch}</option>
                <option value="medium">{t.mediumMatch}</option>
                <option value="low">{t.lowMatch}</option>
              </Select>
            </label>

            <label className="w-36 space-y-1.5">
              <span className="text-xs font-medium text-secondary">{t.deadlineFilter}</span>
              <Select
                value={deadlineFilter}
                onChange={(event) => setDeadlineFilter(event.target.value as DeadlineFilter)}
                className="w-full"
              >
                <option value="all">{t.allDeadlines}</option>
                <option value="overdue">{t.overdue}</option>
                <option value="next7">{t.dueNext7}</option>
                <option value="next30">{t.dueNext30}</option>
                <option value="none">{t.noDeadline}</option>
              </Select>
            </label>

            <Button
              variant="ghost"
              onClick={() => setShowAdvancedFilters((cur) => !cur)}
            >
              {t.moreFilters}
            </Button>
          </div>

          {showAdvancedFilters ? (
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-black/[0.06] pt-4">
              <label className="w-40 space-y-1.5">
                <span className="text-xs font-medium text-secondary">{t.jobType}</span>
                <Select
                  value={jobTypeFilter}
                  onChange={(event) => setJobTypeFilter(event.target.value)}
                  className="w-full"
                >
                  <option value="all">{t.allJobTypes}</option>
                  {jobTypes.map((jt) => (
                    <option key={jt} value={jt}>{jt}</option>
                  ))}
                </Select>
              </label>

              <label className="w-44 space-y-1.5">
                <span className="text-xs font-medium text-secondary">{t.dateAdded}</span>
                <Select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="w-full"
                >
                  <option value="score-desc">{t.scoreHighToLow}</option>
                  <option value="score-asc">{t.scoreLowToHigh}</option>
                  <option value="deadline-asc">{t.deadlineSoonest}</option>
                  <option value="deadline-desc">{t.deadlineLatest}</option>
                  <option value="created-desc">{t.createdNewest}</option>
                  <option value="created-asc">{t.createdOldest}</option>
                </Select>
              </label>

              <ToggleFilter checked={highMatchOnly} onChange={setHighMatchOnly} label={t.highMatchOnly} />
              <ToggleFilter checked={needsActionOnly} onChange={setNeedsActionOnly} label={t.needsActionOnly} />
              <ToggleFilter checked={deadlineApproachingOnly} onChange={setDeadlineApproachingOnly} label={t.deadlineApproachingOnly} />

              <Button variant="ghost" onClick={resetFilters}>
                {t.resetFilters}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── Table ─── */}
      <section className="-mx-4 overflow-hidden rounded-xl border border-black/[0.06] bg-tertiary shadow-sm sm:-mx-6 sm:mx-0">
        {jobs.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl border bg-hover text-lg font-bold text-accent shadow-sm">
              AI
            </div>
            <h2 className="text-xl font-semibold text-primary">{t.emptyTitle}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-secondary">
              {t.emptyBody}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/add" onClick={handleAnalyzeJdClick}>
                {t.emptyAction}
              </ButtonLink>
              <Button variant="secondary" onClick={handleLoadSampleData}>
                {t.loadSampleData}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Batch bar */}
            <div className="flex items-center gap-3 border-b border-black/[0.06] bg-hover/50 px-5 py-2.5">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => handleToggleAllVisible(event.target.checked)}
                aria-label={t.selectedJobs}
                className="h-4 w-4 rounded border accent-[#0066CC]"
              />
              <span className="text-xs font-medium text-secondary">
                {selectedJobIds.length > 0
                  ? `${selectedJobIds.length} ${t.selectedJobs.toLowerCase()}`
                  : t.clickRowsHint}
              </span>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 p-4 md:hidden">
              {filteredJobs.length === 0 ? (
                <div className="rounded-lg border border-black/[0.05] bg-hover px-4 py-8 text-center text-sm text-secondary">
                  {t.noMatches}
                </div>
              ) : (
                filteredJobs.map((job) => (
                  <MobileJobCard
                    key={job.id}
                    job={job}
                    locale={locale}
                    checked={selectedJobIds.includes(job.id)}
                    onCheckedChange={(checked) => handleToggleJob(job.id, checked)}
                    onOpen={() => handleOpenJobDetail(job)}
                    labels={{
                      matchScore: t.matchScore,
                      recommendation: t.recommendation,
                      status: t.status,
                      deadline: t.deadline,
                      nextAction: t.recommendedNextAction,
                      noDeadline: t.noDeadline
                    }}
                    statusLabel={statuses[job.application_status]}
                    recommendationLabel={recommendations[job.application_recommendation]}
                    recommendation={job.application_recommendation}
                    nextActionLabel={nextActions[job.recommended_next_action.action]}
                  />
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-black/[0.04] bg-[#FAFAFA] text-[11px] font-medium uppercase tracking-wider text-secondary/50">
                    <th className="w-10 px-5 py-3"> </th>
                    <th className="px-4 py-3">{t.roleCompany}</th>
                    <th className="px-4 py-3">{t.matchScore}</th>
                    <th className="px-4 py-3">{t.recommendation}</th>
                    <th className="px-4 py-3">{t.status}</th>
                    <th className="px-4 py-3">{t.nextAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-[13px] text-secondary">
                        {t.noMatches}
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((job) => (
                      <tr
                        key={job.id}
                        onClick={() => handleOpenJobDetail(job)}
                        className="group cursor-pointer border-b border-black/[0.02] transition-colors last:border-b-0 hover:bg-accent-subtle/20"
                      >
                        <td className="px-5 py-3.5" onClick={(event) => event.stopPropagation()}>
                          <input type="checkbox" checked={selectedJobIds.includes(job.id)} onChange={(event) => handleToggleJob(job.id, event.target.checked)} aria-label={`${t.company}: ${job.company}`} className="h-4 w-4 rounded border accent-[#0066CC]" />
                        </td>
                        <td className="max-w-72 px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <CompanyLogo company={job.company} />
                            <div className="min-w-0">
                              <span className="line-clamp-1 text-[13px] font-semibold text-primary group-hover:text-accent">
                                {language === "zh" && job.job_title_zh ? job.job_title_zh : job.job_title_en && job.job_title_en !== "Not specified" ? job.job_title_en : job.job_title_original}
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-secondary">{job.company}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5"><MatchScoreCell score={job.match_score} recommendation={job.application_recommendation} /></td>
                        <td className="px-4 py-3.5">
                          <RecommendationBadge recommendation={job.application_recommendation} label={recommendations[job.application_recommendation]} />
                        </td>
                        <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                          <StatusSelect value={job.application_status} onChange={(status) => handleStatusChange(job.id, status)} compact />
                        </td>
                        <td className="max-w-56 px-4 py-3.5">
                          <span className="text-[12px] font-medium text-accent">{nextActions[job.recommended_next_action.action]}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ──────────── Sub-components ──────────── */

function MatchScoreCell({ score, recommendation }: { score: number; recommendation: string }) {
  const tone =
    recommendation.includes("Strongly") || recommendation.includes("强烈") ? "bg-score-high"
    : recommendation.includes("Worth") || recommendation.includes("值得") ? "bg-accent"
    : recommendation.includes("Low") || recommendation.includes("低") ? "bg-score-mid"
    : "bg-score-low";

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${tone}`} aria-hidden="true" />
      <ScoreBadge score={score} recommendation={recommendation} />
    </span>
  );
}


function MobileJobCard({
  job, locale, checked, onCheckedChange, onOpen,
  labels, statusLabel, recommendationLabel, recommendation, nextActionLabel
}: {
  job: JobRecord; locale: string; checked: boolean;
  onCheckedChange: (checked: boolean) => void; onOpen: () => void;
  labels: { matchScore: string; recommendation: string; status: string;
    deadline: string; nextAction: string; noDeadline: string; };
  statusLabel: string; recommendationLabel: string; recommendation: string; nextActionLabel: string;
}) {
  const isChinese = locale.toLowerCase().startsWith("zh");
  const title = isChinese && job.job_title_zh ? job.job_title_zh : job.job_title_en && job.job_title_en !== "Not specified" ? job.job_title_en : job.job_title_original;

  return (
    <article className="rounded-xl border border-black/[0.06] bg-tertiary p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-label={`${job.company} ${job.job_title_original}`}
          className="mt-1 h-5 w-5 rounded border accent-[#0066CC]"
        />
        <button type="button" onClick={onOpen}
          className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none">
          <CompanyLogo company={job.company} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="line-clamp-2 text-[15px] font-semibold leading-snug text-primary">
                  {title}
                </h2>
                <p className="mt-1 truncate text-[13px] text-secondary">{job.company}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-secondary">
                  {labels.matchScore}
                </p>
                <ScoreBadge score={job.match_score} recommendation={recommendation} />
              </div>
            </div>
            <dl className="mt-4 grid gap-2.5 border-t border-black/[0.05] pt-4 text-sm">
              <MobileMetaItem label={labels.recommendation} value={recommendationLabel} />
              <MobileMetaItem label={labels.status} value={statusLabel} />
              <MobileMetaItem label={labels.deadline}
                value={formatOptionalDate(job.application_deadline, locale, labels.noDeadline)} />
              <MobileMetaItem label={labels.nextAction} value={nextActionLabel} />
            </dl>
          </div>
        </button>
      </div>
    </article>
  );
}

function MobileMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-secondary">{label}</dt>
      <dd className="break-words text-[13px] font-medium text-primary">{value}</dd>
    </div>
  );
}

function ToggleFilter({ checked, onChange, label }: {
  checked: boolean; onChange: (c: boolean) => void; label: string;
}) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-tertiary px-3 py-2 text-[13px] font-medium text-primary transition-colors hover:border-strong hover:bg-hover">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border accent-[#0066CC]"
      />
      {label}
    </label>
  );
}

/* ──────────── Analytics & helpers ──────────── */

function compareJobs(a: JobRecord, b: JobRecord, sortMode: SortMode) {
  switch (sortMode) {
    case "score-asc": return a.match_score - b.match_score;
    case "deadline-asc": return compareOptionalDates(a.application_deadline, b.application_deadline);
    case "deadline-desc": return compareOptionalDates(b.application_deadline, a.application_deadline);
    case "created-desc": return getDateTime(b.created_at) - getDateTime(a.created_at);
    case "created-asc": return getDateTime(a.created_at) - getDateTime(b.created_at);
    case "score-desc":
    default: return b.match_score - a.match_score;
  }
}

function matchesDeadlineFilter(deadline: string | undefined, filter: DeadlineFilter, todayStart: number) {
  const dl = getDateOnlyTime(deadline);
  if (filter === "all") return true;
  if (filter === "none") return dl === null;
  if (dl === null) return false;
  if (filter === "overdue") return dl < todayStart;
  const end = filter === "next7" ? addDays(todayStart, 7) : addDays(todayStart, 30);
  return dl >= todayStart && dl <= end;
}

function jobNeedsAction(job: JobRecord) {
  if (job.application_status === "Rejected" || job.application_status === "Offer") return false;
  return ["Apply now", "Tailor resume first", "Improve skills before applying"].includes(
    job.recommended_next_action.action);
}

function deadlineIsApproaching(deadline: string | undefined, todayStart: number) {
  const dl = getDateOnlyTime(deadline);
  if (dl === null) return false;
  return dl >= todayStart && dl <= addDays(todayStart, 7);
}

function matchesMatchFilter(score: number, filter: MatchFilter) {
  if (filter === "all") return true;
  if (filter === "high") return score >= 80;
  if (filter === "medium") return score >= 60 && score < 80;
  return score < 60;
}

function buildTrackerAnalytics(jobs: JobRecord[]): TrackerAnalytics {
  const totalJobs = jobs.length;
  const avg = totalJobs ? Math.round(jobs.reduce((s, j) => s + j.match_score, 0) / totalJobs) : 0;
  const buckets = [
    { label: "90-100%", min: 90, max: 100 },
    { label: "70-89%", min: 70, max: 89 },
    { label: "50-69%", min: 50, max: 69 },
    { label: "0-49%", min: 0, max: 49 }
  ];
  return {
    totalJobs,
    averageMatchScore: avg,
    interviewCount: jobs.filter((j) => j.application_status === "Interview").length,
    offerCount: jobs.filter((j) => j.application_status === "Offer").length,
    distribution: buckets.map((b) => {
      const count = jobs.filter((j) => j.match_score >= b.min && j.match_score <= b.max).length;
      return { label: b.label, count, percent: totalJobs ? Math.round((count / totalJobs) * 100) : 0 };
    })
  };
}

function compareOptionalDates(a: string | undefined, b: string | undefined) {
  const ta = getDateOnlyTime(a), tb = getDateOnlyTime(b);
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return ta - tb;
}

function formatOptionalDate(v: string | undefined, locale: string, fallback: string) {
  const t = getDateOnlyTime(v);
  if (t === null) return fallback;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(t));
}

function getDateOnlyTime(v: string | undefined) {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`).getTime();
  return Number.isNaN(d) ? null : d;
}

function getDateTime(v: string) {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function getTodayStartTime() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

function addDays(v: number, d: number) { return v + d * MS_PER_DAY; }

function exportJobsToCsv(jobs: JobRecord[]) {
  const rows = jobs.map((j) => [
    j.company, j.job_title_original, j.location, j.job_type_en,
    j.match_score, j.application_status, j.application_recommendation,
    j.application_deadline || "", j.source_url, j.created_at,
    j.skills.join("; "), j.missing_skills.join("; ")
  ]);
  const header = ["company","job title","location","job type","match score","status",
    "recommendation","deadline","source URL","created date","key skills","missing skills"];
  const csv = [header, ...rows].map((r) => r.map(escapeCsvValue).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `job-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(v: string | number) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function RecommendationBadge({ recommendation, label }: { recommendation: string; label: string }) {
  const tone = recommendation.includes("Strongly") || recommendation.includes("强烈")
    ? "border-green-200 bg-green-50/70 text-green-700"
    : recommendation.includes("Worth") || recommendation.includes("值得")
    ? "border-accent/15 bg-accent-subtle/40 text-accent"
    : recommendation.includes("Low") || recommendation.includes("低")
    ? "border-amber-200 bg-amber-50/60 text-amber-700"
    : "border-red-100 bg-red-50/50 text-red-600";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone}`}>
      {label}
    </span>
  );
}
