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
import { trackProductEvent } from "@/lib/product/analytics";
import { formatDate } from "@/lib/utils";
import { loadJobs, saveJobs, updateStoredJobStatus } from "@/lib/storage/jobs";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
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
          job.job_title_original.toLowerCase().includes(query);
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

  const handleStatusChange = (jobId: string, status: ApplicationStatus) => {
    updateStoredJobStatus(jobId, status);
    setJobs(loadJobs());
    setMessage(t.updateSuccess);
  };

  const handleLoadSampleData = () => {
    saveJobs(SAMPLE_JOBS);
    setJobs(loadJobs());
    setMessage(t.sampleDataLoaded);
    trackProductEvent("demo_sample_loaded", {
      jobCount: SAMPLE_JOBS.length,
      source: "tracker"
    });
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
    setJobs(loadJobs());
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
    trackProductEvent("csv_exported", {
      jobCount: exportJobs.length,
      selectedOnly: selectedJobs.length > 0
    });
  };

  const handleAnalyzeJdClick = () => {
    trackProductEvent("analyze_jd_clicked", { source: "tracker" });
  };

  const handleOpenJobDetail = (job: JobRecord) => {
    trackProductEvent("job_detail_opened", {
      jobId: job.id,
      matchScore: job.match_score,
      status: job.application_status
    });
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

  return (
    <div className="space-y-5">
      <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-panel border border-line bg-white shadow-panel">
          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-normal text-ink sm:text-5xl">
              {t.trackerHeroTitle}
              </h1>
              <p className="mt-3 max-w-xl text-lg leading-7 text-ink">
                {t.trackerHeroSubtitle}
              </p>
              <p className="mt-2 max-w-2xl text-base leading-7 text-muted">
                {t.trackerHeroBody}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button variant="secondary" onClick={handleLoadSampleData}>
                  {t.tryDemo}
                </Button>
                <ButtonLink href="/add" onClick={handleAnalyzeJdClick}>
                  {t.analyzeAJd}
                </ButtonLink>
              </div>
              <p className="mt-5 text-sm font-semibold text-muted">
                {t.productTrustLine}
              </p>
            </div>
            <HeroAnalysisPreview
              jobDescriptionLabel={t.jobDescriptionPreview}
              matchScoreLabel={t.matchScore}
              greatFitLabel={t.heroGreatFit}
              skillLabels={[t.skills, t.experience, t.businessCommunicationFit]}
            />
          </div>
        </div>
        <div className="grid gap-5">
          <DashboardSnapshot
            analytics={analytics}
            hasJobs={jobs.length > 0}
            labels={{
              dashboard: t.dashboardSnapshot,
              snapshot: t.snapshotLabel,
              viewFullDashboard: t.viewFullDashboard,
              applications: t.applications,
              averageMatchScore: t.averageMatchScore,
              interviews: t.interviewCount,
              offers: t.offers,
              matchScoreDistribution: t.matchScoreDistribution,
              empty: t.demoSnapshotEmpty,
              tryDemo: t.tryDemo
            }}
            onTryDemo={handleLoadSampleData}
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">{t.jobList}</h2>
          <p className="mt-1 text-sm font-medium text-muted">
            {t.clickRowsHint}
          </p>
        </div>
        <ButtonLink
          href="/add"
          variant="secondary"
          onClick={handleAnalyzeJdClick}
        >
          {t.emptyAction}
        </ButtonLink>
      </div>

      {message ? (
        <div className="rounded-app border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="rounded-panel border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_150px_150px_160px_auto_auto] lg:items-end">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">{t.search}</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchPlaceholder}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">{t.status}</span>
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

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">
              {t.matchFilter}
            </span>
            <Select
              value={matchFilter}
              onChange={(event) =>
                setMatchFilter(event.target.value as MatchFilter)
              }
              className="w-full"
            >
              <option value="all">{t.allMatches}</option>
              <option value="high">{t.highMatch}</option>
              <option value="medium">{t.mediumMatch}</option>
              <option value="low">{t.lowMatch}</option>
            </Select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">
              {t.deadlineFilter}
            </span>
            <Select
              value={deadlineFilter}
              onChange={(event) =>
                setDeadlineFilter(event.target.value as DeadlineFilter)
              }
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
            variant="secondary"
            onClick={() => setShowAdvancedFilters((current) => !current)}
            className="w-full lg:w-auto"
          >
            {t.moreFilters}
          </Button>
          <Button variant="secondary" onClick={handleExportCsv}>
            {t.exportCsv}
          </Button>
          <ButtonLink
            href="/add"
            className="w-full lg:w-auto"
            onClick={handleAnalyzeJdClick}
          >
            {t.addJobAction}
          </ButtonLink>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid flex-1 gap-3 md:grid-cols-[180px_190px_210px_210px_210px]">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-ink">
                  {t.jobType}
                </span>
                <Select
                  value={jobTypeFilter}
                  onChange={(event) => setJobTypeFilter(event.target.value)}
                  className="w-full"
                >
                  <option value="all">{t.allJobTypes}</option>
                  {jobTypes.map((jobType) => (
                    <option key={jobType} value={jobType}>
                      {jobType}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-ink">
                  {t.dateAdded}
                </span>
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
              <ToggleFilter
                checked={highMatchOnly}
                onChange={setHighMatchOnly}
                label={t.highMatchOnly}
              />
              <ToggleFilter
                checked={needsActionOnly}
                onChange={setNeedsActionOnly}
                label={t.needsActionOnly}
              />
              <ToggleFilter
                checked={deadlineApproachingOnly}
                onChange={setDeadlineApproachingOnly}
                label={t.deadlineApproachingOnly}
              />
            </div>
            <Button variant="ghost" onClick={resetFilters}>
              {t.resetFilters}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-panel border border-line bg-white shadow-panel">
        {!isLoaded ? (
          <div className="p-8 text-sm text-muted">{t.analyzing}</div>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-panel border border-line bg-surface-muted text-sm font-bold text-accent">
              AI
            </div>
            <h2 className="text-xl font-semibold text-ink">{t.emptyTitle}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted">
              {t.emptyBody}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
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
            <div className="flex flex-col gap-3 border-b border-line bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-muted">
                {selectedJobIds.length} {t.selectedJobs}
              </p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={batchStatus}
                  onChange={(event) =>
                    setBatchStatus(event.target.value as ApplicationStatus)
                  }
                  className="w-full sm:w-44"
                  aria-label={t.batchStatus}
                >
                  {APPLICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statuses[status]}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  onClick={handleBatchStatusUpdate}
                  disabled={selectedJobIds.length === 0}
                >
                  {t.applyBatchStatus}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleBatchDelete}
                  disabled={selectedJobIds.length === 0}
                >
                  {t.batchDelete}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 p-3 md:hidden">
              {filteredJobs.length === 0 ? (
                <div className="rounded-panel border border-line bg-surface-muted px-4 py-8 text-center text-sm text-muted">
                  {t.noMatches}
                </div>
              ) : (
                filteredJobs.map((job) => (
                  <MobileJobCard
                    key={job.id}
                    job={job}
                    locale={locale}
                    checked={selectedJobIds.includes(job.id)}
                    onCheckedChange={(checked) =>
                      handleToggleJob(job.id, checked)
                    }
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
                    recommendationLabel={
                      recommendations[job.application_recommendation]
                    }
                    nextActionLabel={
                      nextActions[job.recommended_next_action.action]
                    }
                  />
                ))
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-10 px-4 py-3.5 font-semibold">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) =>
                        handleToggleAllVisible(event.target.checked)
                      }
                      aria-label={t.selectedJobs}
                      className="h-4 w-4 rounded border-line accent-teal-700"
                    />
                  </th>
                  <th className="px-4 py-3.5 font-semibold">{t.roleCompany}</th>
                  <th className="px-4 py-3.5 font-semibold">{t.recommendation}</th>
                  <th className="px-4 py-3.5 font-semibold">{t.status}</th>
                  <th className="px-4 py-3.5 font-semibold">{t.matchScore}</th>
                  <th className="px-4 py-3.5 font-semibold">{t.location}</th>
                  <th className="px-4 py-3.5 font-semibold">{t.deadline}</th>
                  <th className="px-4 py-3.5 font-semibold">{t.nextAction}</th>
                  <th className="px-4 py-3.5 font-semibold">{t.createdDate}</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-muted">
                      {t.noMatches}
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => handleOpenJobDetail(job)}
                      className="group cursor-pointer border-b border-line transition duration-200 last:border-b-0 hover:bg-surface-muted"
                    >
                      <td
                        className="px-4 py-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedJobIds.includes(job.id)}
                          onChange={(event) =>
                            handleToggleJob(job.id, event.target.checked)
                          }
                          aria-label={`${t.company}: ${job.company}`}
                          className="h-4 w-4 rounded border-line accent-teal-700"
                        />
                      </td>
                      <td className="max-w-80 px-4 py-4 text-ink">
                        <div className="flex items-center gap-3">
                          <CompanyLogo company={job.company} />
                          <div className="min-w-0">
                            <span className="line-clamp-2 font-semibold group-hover:text-accent">
                              {language === "zh" && job.job_title_zh
                                ? job.job_title_zh
                                : job.job_title_original}
                            </span>
                            <span className="mt-1 block truncate text-xs font-medium text-muted">
                              {job.company} ·{" "}
                              {language === "zh" ? job.job_type_zh : job.job_type_en}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full border border-line bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted">
                          {recommendations[job.application_recommendation]}
                        </span>
                      </td>
                      <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}>
                        <StatusSelect
                          value={job.application_status}
                          onChange={(status) => handleStatusChange(job.id, status)}
                          compact
                        />
                      </td>
                      <td className="px-4 py-4">
                        <MatchScoreCell score={job.match_score} />
                      </td>
                      <td className="max-w-44 px-4 py-4 text-muted">
                        <span className="line-clamp-2">{job.location}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted">
                        {formatOptionalDate(
                          job.application_deadline,
                          locale,
                          t.noDeadline
                        )}
                      </td>
                      <td className="max-w-44 px-4 py-4 text-muted">
                        <span className="line-clamp-2">
                          {nextActions[job.recommended_next_action.action]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted">
                        {formatDate(job.created_at, locale)}
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

function HeroAnalysisPreview({
  jobDescriptionLabel,
  matchScoreLabel,
  greatFitLabel,
  skillLabels
}: {
  jobDescriptionLabel: string;
  matchScoreLabel: string;
  greatFitLabel: string;
  skillLabels: string[];
}) {
  return (
    <div className="relative hidden min-h-52 lg:block" aria-hidden="true">
      <div className="absolute left-0 top-3 w-72 rounded-panel border border-line bg-white p-4 shadow-soft">
        <p className="text-xs font-semibold text-ink">{jobDescriptionLabel}</p>
        <div className="mt-4 space-y-2">
          <span className="block h-2 rounded-full bg-line" />
          <span className="block h-2 w-4/5 rounded-full bg-line" />
          <span className="block h-2 w-2/3 rounded-full bg-line" />
          <span className="mt-4 block h-2 w-11/12 rounded-full bg-line" />
          <span className="block h-2 w-3/5 rounded-full bg-line" />
          <span className="mt-4 block h-2 w-10/12 rounded-full bg-line" />
          <span className="block h-2 w-7/12 rounded-full bg-line" />
        </div>
      </div>
      <div className="absolute right-2 top-14 w-40 rounded-panel border border-line bg-white p-3 shadow-panel">
        <p className="text-xs font-semibold text-ink">{matchScoreLabel}</p>
        <p className="mt-2 text-3xl font-semibold tracking-normal text-ink">
          92%
        </p>
        <p className="mt-1 text-xs font-semibold text-accent">{greatFitLabel}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
          <span className="block h-full w-[92%] rounded-full bg-accent" />
        </div>
      </div>
      <div className="absolute bottom-3 left-4 flex flex-wrap gap-2">
        {skillLabels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-soft"
          >
            <span className="h-2 w-2 rounded-full bg-accent" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DashboardSnapshot({
  analytics,
  hasJobs,
  labels,
  onTryDemo
}: {
  analytics: TrackerAnalytics;
  hasJobs: boolean;
  labels: {
    dashboard: string;
    snapshot: string;
    viewFullDashboard: string;
    applications: string;
    averageMatchScore: string;
    interviews: string;
    offers: string;
    matchScoreDistribution: string;
    empty: string;
    tryDemo: string;
  };
  onTryDemo: () => void;
}) {
  return (
    <aside className="rounded-panel border border-line bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold text-ink">{labels.dashboard}</h2>
          <span className="text-xs font-medium text-muted">
            ({labels.snapshot})
          </span>
        </div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-muted transition duration-200 hover:text-accent"
        >
          {labels.viewFullDashboard}
        </Link>
      </div>

      {!hasJobs ? (
        <div className="mt-5 rounded-panel border border-line bg-surface-muted p-4">
          <p className="text-sm leading-6 text-muted">{labels.empty}</p>
          <Button className="mt-4" variant="secondary" onClick={onTryDemo}>
            {labels.tryDemo}
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SnapshotMetric label={labels.applications} value={analytics.totalJobs} />
            <SnapshotMetric
              label={labels.averageMatchScore}
              value={`${analytics.averageMatchScore}%`}
            />
            <SnapshotMetric
              label={labels.interviews}
              value={analytics.interviewCount}
            />
            <SnapshotMetric label={labels.offers} value={analytics.offerCount} />
          </div>
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-ink">
              {labels.matchScoreDistribution}
            </h3>
            <div className="mt-3 space-y-3">
              {analytics.distribution.map((bucket) => (
                <div key={bucket.label} className="grid grid-cols-[58px_1fr_48px] items-center gap-3 text-xs">
                  <span className="font-medium text-muted">{bucket.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(8, bucket.percent)}%` }}
                    />
                  </span>
                  <span className="text-right font-medium text-muted">
                    {bucket.count} ({bucket.percent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function SnapshotMetric({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-panel border border-line bg-white p-3 shadow-soft">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal text-ink">
        {value}
      </p>
    </div>
  );
}

function MatchScoreCell({ score }: { score: number }) {
  const tone =
    score >= 80 ? "bg-accent" : score >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${tone}`} aria-hidden="true" />
      <ScoreBadge score={score} />
    </span>
  );
}

function MobileJobCard({
  job,
  locale,
  checked,
  onCheckedChange,
  onOpen,
  labels,
  statusLabel,
  recommendationLabel,
  nextActionLabel
}: {
  job: JobRecord;
  locale: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onOpen: () => void;
  labels: {
    matchScore: string;
    recommendation: string;
    status: string;
    deadline: string;
    nextAction: string;
    noDeadline: string;
  };
  statusLabel: string;
  recommendationLabel: string;
  nextActionLabel: string;
}) {
  const isChinese = locale.toLowerCase().startsWith("zh");
  const title =
    isChinese && job.job_title_zh ? job.job_title_zh : job.job_title_original;

  return (
    <article className="rounded-panel border border-line bg-white shadow-soft transition duration-200 hover:border-accent hover:shadow-panel">
      <div className="flex items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-label={`${job.company} ${job.job_title_original}`}
          className="mt-1 h-5 w-5 rounded border-line accent-teal-700"
        />
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-accent-soft"
        >
          <CompanyLogo company={job.company} size="sm" />
          <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-base font-semibold leading-6 text-ink">
                {title}
              </h2>
              <p className="mt-1 truncate text-sm font-medium text-muted">
                {job.company}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {labels.matchScore}
              </p>
              <ScoreBadge score={job.match_score} />
            </div>
          </div>

          <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm">
            <MobileMetaItem
              label={labels.recommendation}
              value={recommendationLabel}
            />
            <MobileMetaItem label={labels.status} value={statusLabel} />
            <MobileMetaItem
              label={labels.deadline}
              value={formatOptionalDate(
                job.application_deadline,
                locale,
                labels.noDeadline
              )}
            />
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
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="break-words font-medium text-ink">{value}</dd>
    </div>
  );
}

function ToggleFilter({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex min-h-10 items-center gap-2 rounded-app border border-line bg-white px-3 py-2 text-sm font-semibold text-ink shadow-soft transition duration-200 hover:border-line-strong hover:bg-surface-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-line accent-teal-700"
      />
      {label}
    </label>
  );
}

function compareJobs(a: JobRecord, b: JobRecord, sortMode: SortMode) {
  switch (sortMode) {
    case "score-asc":
      return a.match_score - b.match_score;
    case "deadline-asc":
      return compareOptionalDates(a.application_deadline, b.application_deadline);
    case "deadline-desc":
      return compareOptionalDates(b.application_deadline, a.application_deadline);
    case "created-desc":
      return getDateTime(b.created_at) - getDateTime(a.created_at);
    case "created-asc":
      return getDateTime(a.created_at) - getDateTime(b.created_at);
    case "score-desc":
    default:
      return b.match_score - a.match_score;
  }
}

function matchesDeadlineFilter(
  deadline: string | undefined,
  filter: DeadlineFilter,
  todayStart: number
) {
  const deadlineTime = getDateOnlyTime(deadline);

  if (filter === "all") {
    return true;
  }

  if (filter === "none") {
    return deadlineTime === null;
  }

  if (deadlineTime === null) {
    return false;
  }

  if (filter === "overdue") {
    return deadlineTime < todayStart;
  }

  const endTime =
    filter === "next7" ? addDays(todayStart, 7) : addDays(todayStart, 30);

  return deadlineTime >= todayStart && deadlineTime <= endTime;
}

function jobNeedsAction(job: JobRecord) {
  if (job.application_status === "Rejected" || job.application_status === "Offer") {
    return false;
  }

  return ["Apply now", "Tailor resume first", "Improve skills before applying"].includes(
    job.recommended_next_action.action
  );
}

function deadlineIsApproaching(deadline: string | undefined, todayStart: number) {
  const deadlineTime = getDateOnlyTime(deadline);

  if (deadlineTime === null) {
    return false;
  }

  return deadlineTime >= todayStart && deadlineTime <= addDays(todayStart, 7);
}

function matchesMatchFilter(score: number, filter: MatchFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "high") {
    return score >= 80;
  }

  if (filter === "medium") {
    return score >= 60 && score < 80;
  }

  return score < 60;
}

function buildTrackerAnalytics(jobs: JobRecord[]): TrackerAnalytics {
  const totalJobs = jobs.length;
  const averageMatchScore = totalJobs
    ? Math.round(jobs.reduce((sum, job) => sum + job.match_score, 0) / totalJobs)
    : 0;
  const buckets = [
    { label: "90-100%", min: 90, max: 100 },
    { label: "70-89%", min: 70, max: 89 },
    { label: "50-69%", min: 50, max: 69 },
    { label: "0-49%", min: 0, max: 49 }
  ];

  return {
    totalJobs,
    averageMatchScore,
    interviewCount: jobs.filter((job) => job.application_status === "Interview").length,
    offerCount: jobs.filter((job) => job.application_status === "Offer").length,
    distribution: buckets.map((bucket) => {
      const count = jobs.filter(
        (job) => job.match_score >= bucket.min && job.match_score <= bucket.max
      ).length;

      return {
        label: bucket.label,
        count,
        percent: totalJobs ? Math.round((count / totalJobs) * 100) : 0
      };
    })
  };
}

function compareOptionalDates(
  leftDate: string | undefined,
  rightDate: string | undefined
) {
  const leftTime = getDateOnlyTime(leftDate);
  const rightTime = getDateOnlyTime(rightDate);

  if (leftTime === null && rightTime === null) {
    return 0;
  }

  if (leftTime === null) {
    return 1;
  }

  if (rightTime === null) {
    return -1;
  }

  return leftTime - rightTime;
}

function formatOptionalDate(
  value: string | undefined,
  locale: string,
  fallback: string
) {
  const dateTime = getDateOnlyTime(value);

  if (dateTime === null) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(dateTime));
}

function getDateOnlyTime(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  const time = date.getTime();

  return Number.isNaN(time) ? null : time;
}

function getDateTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getTodayStartTime() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function addDays(value: number, days: number) {
  return value + days * 24 * 60 * 60 * 1000;
}

function exportJobsToCsv(jobs: JobRecord[]) {
  const rows = jobs.map((job) => [
    job.company,
    job.job_title_original,
    job.location,
    job.job_type_en,
    job.match_score,
    job.application_status,
    job.application_recommendation,
    job.application_deadline || "",
    job.source_url,
    job.created_at,
    job.skills.join("; "),
    job.missing_skills.join("; ")
  ]);
  const header = [
    "company",
    "job title",
    "location",
    "job type",
    "match score",
    "status",
    "recommendation",
    "deadline",
    "source URL",
    "created date",
    "key skills",
    "missing skills"
  ];
  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `job-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
