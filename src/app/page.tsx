"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusSelect } from "@/components/jobs/status-select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { formatDate } from "@/lib/utils";
import { loadJobs, saveJobs, updateStoredJobStatus } from "@/lib/storage/jobs";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import {
  APPLICATION_STATUSES,
  ApplicationStatus,
  JobRecord
} from "@/types/job";

type DeadlineFilter = "all" | "overdue" | "next7" | "next30" | "none";
type SortMode =
  | "score-desc"
  | "score-asc"
  | "deadline-asc"
  | "deadline-desc"
  | "created-desc"
  | "created-asc";

export default function JobListPage() {
  const router = useRouter();
  const { language, t, statuses } = useLanguage();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">(
    "all"
  );
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("score-desc");
  const [highMatchOnly, setHighMatchOnly] = useState(false);
  const [needsActionOnly, setNeedsActionOnly] = useState(false);
  const [deadlineApproachingOnly, setDeadlineApproachingOnly] = useState(false);
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

  const handleStatusChange = (jobId: string, status: ApplicationStatus) => {
    updateStoredJobStatus(jobId, status);
    setJobs(loadJobs());
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
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">{t.jobList}</h1>
          <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
          <p className="mt-1 text-xs font-medium text-muted">
            {t.clickRowsHint}
          </p>
        </div>
        <ButtonLink href="/add">{t.emptyAction}</ButtonLink>
      </div>

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="rounded-md border border-line bg-white p-4 shadow-soft">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_170px_210px]">
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
            <span className="text-sm font-semibold text-ink">{t.jobType}</span>
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

          <label className="space-y-1.5">
            <span className="text-sm font-semibold text-ink">{t.sortBy}</span>
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
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-3">
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
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={resetFilters}>
              {t.resetFilters}
            </Button>
            <Button variant="secondary" onClick={handleExportCsv}>
              {t.exportCsv}
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        {!isLoaded ? (
          <div className="p-8 text-sm text-muted">{t.analyzing}</div>
        ) : jobs.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <h2 className="text-xl font-semibold text-ink">{t.emptyTitle}</h2>
            <p className="mt-2 max-w-md text-sm text-muted">{t.emptyBody}</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/add">{t.emptyAction}</ButtonLink>
              <Button variant="secondary" onClick={handleLoadSampleData}>
                {t.loadSampleData}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-line bg-paper px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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

            <div className="overflow-x-auto">
            <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-10 px-4 py-3 font-semibold">
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
                  <th className="px-4 py-3 font-semibold">{t.company}</th>
                  <th className="px-4 py-3 font-semibold">{t.jobTitle}</th>
                  <th className="px-4 py-3 font-semibold">{t.location}</th>
                  <th className="px-4 py-3 font-semibold">{t.jobType}</th>
                  <th className="px-4 py-3 font-semibold">{t.matchScore}</th>
                  <th className="px-4 py-3 font-semibold">{t.status}</th>
                  <th className="px-4 py-3 font-semibold">{t.deadline}</th>
                  <th className="px-4 py-3 font-semibold">{t.createdDate}</th>
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
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="group cursor-pointer border-b border-line transition last:border-b-0 hover:bg-paper"
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
                      <td className="max-w-44 px-4 py-3 font-medium text-ink">
                        <span className="line-clamp-2">{job.company}</span>
                      </td>
                      <td className="max-w-72 px-4 py-3 text-ink">
                        <span className="line-clamp-2 font-medium group-hover:text-accent">
                          {job.job_title_original}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {t.openDetails}
                        </span>
                      </td>
                      <td className="max-w-44 px-4 py-3 text-muted">
                        <span className="line-clamp-2">{job.location}</span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {language === "zh" ? job.job_type_zh : job.job_type_en}
                      </td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={job.match_score} />
                      </td>
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <StatusSelect
                          value={job.application_status}
                          onChange={(status) => handleStatusChange(job.id, status)}
                          compact
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {formatOptionalDate(
                          job.application_deadline,
                          locale,
                          t.noDeadline
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
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
    <label className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-medium text-ink">
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
