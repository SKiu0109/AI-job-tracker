import { MS_PER_DAY } from "@/lib/constants";
import { formatOptionalDate } from "@/lib/jobs/job-detail-utils";
import { getUserFacingNextStepText } from "@/lib/jobs/user-facing-next-step";
import { ACTION_STAGES, type ActionStage, type JobRecord } from "@/types/job";
import { getWorkspaceCopy } from "@/app/workspace/_lib/workspace-copy";

export type ActionStageFilter = ActionStage | "all";
export type DeadlineFilter = "all" | "overdue" | "next7" | "next30" | "none";
export type MatchFilter = "all" | "high" | "medium" | "low";
export type SortMode =
  | "score-desc"
  | "score-asc"
  | "deadline-asc"
  | "deadline-desc"
  | "created-desc"
  | "created-asc";

export type TrackerAnalytics = {
  totalJobs: number;
  highMatchCount: number;
  needsActionCount: number;
};

export type ActionQueueItem = {
  count: number;
  helper: string;
  nextJob: JobRecord | null;
  stage: ActionStage;
};

export function buildTrackerAnalytics(jobs: JobRecord[]): TrackerAnalytics {
  const totalJobs = jobs.length;

  return {
    highMatchCount: jobs.filter((job) => job.match_score >= 80).length,
    needsActionCount: jobs.filter(jobNeedsAction).length,
    totalJobs
  };
}

export function buildActionQueue(
  jobs: JobRecord[],
  copy: ReturnType<typeof getWorkspaceCopy>,
  language: "en" | "zh",
  locale: string
): ActionQueueItem[] {
  return ACTION_STAGES.map((stage) => {
    const stageJobs = jobs
      .filter((job) => getSafeActionStage(job.action_stage) === stage)
      .sort(compareActionQueueJobs);
    const nextJob = stageJobs[0] ?? null;

    return {
      count: stageJobs.length,
      helper: getActionStageHelper(stage, copy, nextJob, language, locale),
      nextJob,
      stage
    };
  });
}

export function getNextFocusItem(items: ActionQueueItem[]) {
  return items.find((item) => item.count > 0 && item.nextJob) ?? null;
}

export function getSafeActionStage(stage: unknown): ActionStage {
  const value = typeof stage === "string" ? stage : "";
  return ACTION_STAGES.includes(value as ActionStage)
    ? (value as ActionStage)
    : "needs_review";
}

export function getActionStageTone(stage: unknown) {
  const safeStage = getSafeActionStage(stage);

  if (safeStage === "ready_to_apply") {
    return "border-app-success-border bg-app-success-soft text-app-success";
  }

  if (safeStage === "tailor_resume") {
    return "border-app-info-border bg-app-info-soft text-app-info shadow-app-card";
  }

  if (safeStage === "follow_up") {
    return "border-app-info-border bg-app-info-soft text-app-info";
  }

  if (safeStage === "parked") {
    return "border-app-border-soft bg-app-surface-subtle text-app-text-tertiary shadow-app-card";
  }

  return "border-app-warning-border bg-app-warning-soft text-app-warning";
}

export function compareJobs(a: JobRecord, b: JobRecord, sortMode: SortMode) {
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

export function matchesDeadlineFilter(
  deadline: string | undefined,
  filter: DeadlineFilter,
  todayStart: number
) {
  const deadlineTime = getDateOnlyTime(deadline);
  if (filter === "all") return true;
  if (filter === "none") return deadlineTime === null;
  if (deadlineTime === null) return false;
  if (filter === "overdue") return deadlineTime < todayStart;
  const end = filter === "next7" ? addDays(todayStart, 7) : addDays(todayStart, 30);
  return deadlineTime >= todayStart && deadlineTime <= end;
}

export function jobNeedsAction(job: JobRecord) {
  if (job.application_status === "Rejected" || job.application_status === "Offer") {
    return false;
  }

  return getSafeActionStage(job.action_stage) !== "parked";
}

export function deadlineIsApproaching(
  deadline: string | undefined,
  todayStart: number
) {
  const deadlineTime = getDateOnlyTime(deadline);
  if (deadlineTime === null) return false;
  return deadlineTime >= todayStart && deadlineTime <= addDays(todayStart, 7);
}

export function matchesMatchFilter(score: number, filter: MatchFilter) {
  if (filter === "all") return true;
  if (filter === "high") return score >= 80;
  if (filter === "medium") return score >= 60 && score < 80;
  return score < 60;
}

export function getTodayStartTime() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function exportJobsToCsv(jobs: JobRecord[]) {
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
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `job-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function compareActionQueueJobs(a: JobRecord, b: JobRecord) {
  const deadlineComparison = compareOptionalDates(
    a.application_deadline,
    b.application_deadline
  );

  if (deadlineComparison !== 0) {
    return deadlineComparison;
  }

  return b.match_score - a.match_score || getDateTime(b.updated_at) - getDateTime(a.updated_at);
}

function getActionStageHelper(
  stage: ActionStage,
  copy: ReturnType<typeof getWorkspaceCopy>,
  job: JobRecord | null,
  language: "en" | "zh",
  locale: string
) {
  if (!job) {
    return copy.stageEmptyHelpers[stage];
  }

  if (stage === "follow_up" && job.follow_up_date) {
    return copy.followUpDue(formatOptionalDate(job.follow_up_date, locale, job.follow_up_date));
  }

  if (stage === "tailor_resume" && job.tailoring_status === "reviewed") {
    return copy.stageHelpers.ready_to_apply;
  }

  if (stage === "ready_to_apply" && job.application_deadline) {
    return copy.deadlineDue(formatOptionalDate(job.application_deadline, locale, job.application_deadline));
  }

  return getUserFacingNextStepText(job, language) || copy.stageHelpers[stage];
}

function compareOptionalDates(a: string | undefined, b: string | undefined) {
  const timeA = getDateOnlyTime(a);
  const timeB = getDateOnlyTime(b);
  if (timeA === null && timeB === null) return 0;
  if (timeA === null) return 1;
  if (timeB === null) return -1;
  return timeA - timeB;
}

function getDateOnlyTime(value: string | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(date) ? null : date;
}

function getDateTime(value: string | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function addDays(value: number, days: number) {
  return value + days * MS_PER_DAY;
}

function escapeCsvValue(value: string | number) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
