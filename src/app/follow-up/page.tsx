"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { StatusSelect } from "@/components/jobs/status-select";
import { AppCard } from "@/components/ui/app-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageHeaderMetric } from "@/components/ui/page-header";
import { MS_PER_DAY } from "@/lib/constants";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { getJobTitle, formatOptionalDate } from "@/lib/jobs/job-detail-utils";
import {
  hydrateJobsFromCloud,
  upsertCloudJobs
} from "@/lib/storage/cloud-sync";
import {
  loadJobs,
  prependMissingJobs,
  saveJobs,
  updateStoredJob,
  updateStoredJobStatus
} from "@/lib/storage/jobs";
import { createStorageScope } from "@/lib/storage/scope";
import { cn } from "@/lib/utils";
import type { ApplicationStatus, JobRecord } from "@/types/job";

type FollowUpBucket = "overdue" | "today" | "upcoming" | "later";
type FollowUpKind = "deadline" | "follow_up";

type FollowUpItem = {
  bucket: FollowUpBucket;
  date: string;
  daysUntil: number | null;
  job: JobRecord;
  kind: FollowUpKind;
};

type FollowUpCopy = ReturnType<typeof getFollowUpCopy>;

export default function FollowUpPage() {
  const { session } = useAuth();
  const { language, statuses, t } = useLanguage();
  const userId = session?.user.id ?? null;
  const sessionRef = useRef(session);
  const storageScope = useMemo(() => createStorageScope(userId), [userId]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [message, setMessage] = useState("");

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

  const copy = getFollowUpCopy(language);
  const locale = language === "zh" ? "zh-CN" : "en-AU";
  const today = useMemo(() => getTodayDateString(), []);
  const items = useMemo(() => buildFollowUpItems(jobs, today), [jobs, today]);
  const groupedItems = useMemo(() => groupFollowUpItems(items), [items]);
  const stats = useMemo(() => buildFollowUpStats(items), [items]);
  const visibleBuckets = useMemo(
    () => FOLLOW_UP_BUCKETS.filter((bucket) => groupedItems[bucket].length > 0),
    [groupedItems]
  );
  const focusItem = items[0] ?? null;

  const refreshJobs = () => {
    setJobs(loadJobs(storageScope));
  };

  const persistJob = (job: JobRecord | undefined, successMessage: string) => {
    if (!job) return;
    refreshJobs();
    void upsertCloudJobs(sessionRef.current, [job]);
    setMessage(successMessage);
  };

  const handleLoadSampleData = () => {
    const nextJobs = prependMissingJobs(loadJobs(storageScope), SAMPLE_JOBS);
    saveJobs(nextJobs, storageScope);
    setJobs(nextJobs);
    void upsertCloudJobs(sessionRef.current, nextJobs);
    setMessage(t.sampleDataLoaded);
  };

  const handleStatusChange = (jobId: string, status: ApplicationStatus) => {
    const updatedJob = updateStoredJobStatus(jobId, status, "", storageScope);
    persistJob(updatedJob, t.updateSuccess);
  };

  const handleSnooze = (job: JobRecord, days: number) => {
    const nextDate = addDaysToDate(today, days);
    const updatedJob = updateStoredJob(
      job.id,
      {
        action_stage: "follow_up",
        follow_up_date: nextDate,
        next_step_note: copy.snoozedNote(formatOptionalDate(nextDate, locale, nextDate))
      },
      "",
      storageScope
    );
    persistJob(updatedJob, copy.snoozedMessage(formatOptionalDate(nextDate, locale, nextDate)));
  };

  const handleMarkFollowedUp = (job: JobRecord) => {
    const nextDate = addDaysToDate(today, 7);
    const note = copy.followedNote(
      formatOptionalDate(today, locale, today),
      formatOptionalDate(nextDate, locale, nextDate)
    );
    const updatedJob = updateStoredJob(
      job.id,
      {
        action_stage: "follow_up",
        follow_up_date: nextDate,
        follow_up_notes: appendFollowUpNote(job.follow_up_notes, note),
        next_step_note: copy.followedNextStep(formatOptionalDate(nextDate, locale, nextDate))
      },
      "",
      storageScope
    );
    persistJob(updatedJob, copy.followedMessage(formatOptionalDate(nextDate, locale, nextDate)));
  };

  if (!isLoaded) {
    return (
      <AppCard className="p-6 text-sm text-app-text-secondary">
        {t.analyzing}
      </AppCard>
    );
  }

  return (
    <div className="app-stagger space-y-6 pb-8">
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-2">
            {jobs.length === 0 ? (
              <Button onClick={handleLoadSampleData} variant="secondary">
                {t.loadSampleData}
              </Button>
            ) : null}
            <ButtonLink href="/workspace" variant="secondary">
              {copy.workspace}
            </ButtonLink>
          </div>
        }
        metadata={
          jobs.length ? (
            <>
              <PageHeaderMetric>
                {stats.total} {copy.total}
              </PageHeaderMetric>
              <PageHeaderMetric tone={stats.overdue ? "danger" : "neutral"}>
                {stats.overdue} {copy.overdue.toLowerCase()}
              </PageHeaderMetric>
              <PageHeaderMetric tone={stats.today ? "warning" : "neutral"}>
                {stats.today} {copy.today.toLowerCase()}
              </PageHeaderMetric>
            </>
          ) : null
        }
        subtitle={copy.subtitle}
        title={copy.title}
      />

      {message ? (
        <div className="app-sheet-enter rounded-lg border border-app-border-soft bg-app-surface px-4 py-3 text-[13px] font-medium text-score-high shadow-app-card backdrop-blur-xl">
          {message}
        </div>
      ) : null}

      <section className="app-stagger grid gap-4 md:grid-cols-3">
        <FollowUpMetric
          label={copy.now}
          tone={stats.overdue ? "red" : "amber"}
          value={stats.overdue + stats.today}
        />
        <FollowUpMetric label={copy.nextSeven} tone="blue" value={stats.upcoming} />
        <FollowUpMetric label={copy.later} tone="slate" value={stats.later} />
      </section>

      {items.length ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="app-stagger space-y-5">
            {visibleBuckets.map((bucket) => (
              <FollowUpBucketSection
                bucket={bucket}
                copy={copy}
                items={groupedItems[bucket]}
                key={bucket}
                language={language}
                locale={locale}
                onMarkFollowedUp={handleMarkFollowedUp}
                onSnooze={handleSnooze}
                onStatusChange={handleStatusChange}
                statuses={statuses}
              />
            ))}
          </div>
          <FollowUpFocusCard
            copy={copy}
            item={focusItem}
            language={language}
            locale={locale}
          />
        </section>
      ) : (
        <AppCard className="px-6 py-16 text-center" variant="elevated">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-app-border-soft bg-app-surface text-app-accent shadow-app-card">
            <FollowUpIcon />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-app-text-primary">
            {copy.emptyTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-app-text-secondary">
            {copy.emptyBody}
          </p>
          <ButtonLink href="/workspace" className="mt-6" variant="secondary">
            {copy.workspace}
          </ButtonLink>
        </AppCard>
      )}
    </div>
  );
}

const FOLLOW_UP_BUCKETS: FollowUpBucket[] = [
  "overdue",
  "today",
  "upcoming",
  "later"
];

function FollowUpBucketSection({
  bucket,
  copy,
  items,
  language,
  locale,
  onMarkFollowedUp,
  onSnooze,
  onStatusChange,
  statuses
}: {
  bucket: FollowUpBucket;
  copy: FollowUpCopy;
  items: FollowUpItem[];
  language: "en" | "zh";
  locale: string;
  onMarkFollowedUp: (job: JobRecord) => void;
  onSnooze: (job: JobRecord, days: number) => void;
  onStatusChange: (jobId: string, status: ApplicationStatus) => void;
  statuses: Record<ApplicationStatus, string>;
}) {
  return (
    <AppCard as="section" className="overflow-hidden" variant="elevated">
      <div className="flex items-center justify-between gap-3 border-b border-app-border-soft bg-app-surface px-5 py-4 backdrop-blur-xl">
        <div>
          <h2 className="text-[16px] font-semibold text-app-text-primary">
            {copy.bucketLabels[bucket]}
          </h2>
          <p className="mt-1 text-[12px] text-app-text-secondary">
            {copy.bucketDescriptions[bucket]}
          </p>
        </div>
        <span className="rounded-full bg-app-surface px-3 py-1 text-[12px] font-semibold text-app-text-secondary shadow-app-card">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <div className="app-stagger space-y-3 bg-app-surface-subtle p-3">
          {items.map((item) => (
            <FollowUpRow
              copy={copy}
              item={item}
              key={`${item.kind}-${item.job.id}`}
              language={language}
              locale={locale}
              onMarkFollowedUp={onMarkFollowedUp}
              onSnooze={onSnooze}
              onStatusChange={onStatusChange}
              statusLabel={statuses[item.job.application_status]}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-8 text-sm text-app-text-secondary">
          {copy.bucketEmpty[bucket]}
        </div>
      )}
    </AppCard>
  );
}

function FollowUpFocusCard({
  copy,
  item,
  language,
  locale
}: {
  copy: FollowUpCopy;
  item: FollowUpItem | null;
  language: "en" | "zh";
  locale: string;
}) {
  const title = item
    ? getJobTitle(item.job, locale.startsWith("zh") ? "zh" : "en")
    : copy.emptyTitle;
  const dueLabel = item?.date ? formatOptionalDate(item.date, locale, item.date) : copy.noDate;

  return (
    <AppCard className="h-fit p-5" variant="elevated">
      <h2 className="text-[16px] font-semibold text-app-text-primary">
        {copy.focusTitle}
      </h2>
      <p className="mt-2 text-[13px] leading-5 text-app-text-secondary">
        {copy.focusSubtitle}
      </p>

      {item ? (
        <div className="mt-4 border-y border-app-border-soft py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden="true"
              className={cn("h-2.5 w-2.5 rounded-full", getFollowUpAccentClass(item.bucket))}
            />
            <FollowUpKindBadge copy={copy} kind={item.kind} />
            <span className="rounded-full bg-app-surface px-2.5 py-1 text-[11px] font-semibold text-app-text-secondary shadow-app-card">
              {getRelativeDateLabel(item, copy)}
            </span>
          </div>
          <h3 className="mt-3 text-[15px] font-semibold leading-6 text-app-text-primary">
            {title}
          </h3>
          <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
            {item.job.company} · {dueLabel}
          </p>
          <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-app-text-secondary">
            {getFollowUpNote(item.job, copy, language)}
          </p>
          <ButtonLink
            className="mt-4 w-full justify-center"
            href={`/jobs/${item.job.id}`}
            variant="secondary"
          >
            {copy.openJob}
          </ButtonLink>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-app-text-tertiary">
          {copy.rhythmTitle}
        </p>
        <ul className="mt-3 space-y-2">
          {copy.rhythmSteps.map((step) => (
            <li
              className="flex gap-2 text-[13px] leading-5 text-app-text-secondary"
              key={step}
            >
              <span
                aria-hidden="true"
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-accent/65"
              />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </AppCard>
  );
}

function FollowUpRow({
  copy,
  item,
  language,
  locale,
  onMarkFollowedUp,
  onSnooze,
  onStatusChange,
  statusLabel
}: {
  copy: FollowUpCopy;
  item: FollowUpItem;
  language: "en" | "zh";
  locale: string;
  onMarkFollowedUp: (job: JobRecord) => void;
  onSnooze: (job: JobRecord, days: number) => void;
  onStatusChange: (jobId: string, status: ApplicationStatus) => void;
  statusLabel: string;
}) {
  const { job } = item;
  const dueLabel = item.date ? formatOptionalDate(item.date, locale, item.date) : copy.noDate;
  const title = getJobTitle(job, locale.startsWith("zh") ? "zh" : "en");

  return (
    <article className="app-hover-lift relative grid gap-4 overflow-hidden rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl transition duration-300 ease-[var(--app-motion-standard)] hover:border-app-border hover:bg-app-surface-hover lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <CompanyLogo company={job.company} logoUrl={job.company_logo_url} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden="true"
                className={cn("h-2.5 w-2.5 rounded-full", getFollowUpAccentClass(item.bucket))}
              />
              <FollowUpKindBadge copy={copy} kind={item.kind} />
              <span className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                item.bucket === "overdue" && "bg-red-50/50 text-red-600",
                item.bucket === "today" && "bg-amber-50/55 text-amber-700",
                item.bucket === "upcoming" && "bg-blue-50/55 text-blue-700",
                item.bucket === "later" && "bg-app-surface text-app-text-tertiary shadow-app-card"
              )}>
                {getRelativeDateLabel(item, copy)}
              </span>
            </div>
            <h3 className="mt-2 text-[15px] font-semibold text-app-text-primary">
              <Link className="hover:text-app-accent" href={`/jobs/${job.id}`}>
                {title}
              </Link>
            </h3>
            <p className="mt-1 text-[13px] text-app-text-secondary">
              {job.company} · {statusLabel} · {dueLabel}
            </p>
            <p className="mt-3 line-clamp-2 rounded-app border border-app-border-soft bg-app-surface px-3 py-2 text-[13px] leading-6 text-app-text-secondary shadow-app-card">
              {getFollowUpNote(job, copy, language)}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:items-end">
        <StatusSelect
          compact
          onChange={(status) => onStatusChange(job.id, status)}
          value={job.application_status}
        />
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {item.kind === "follow_up" ? (
            <Button
              className="min-h-9 px-3 text-[12px]"
              onClick={() => onMarkFollowedUp(job)}
            >
              {copy.markFollowed}
            </Button>
          ) : (
            <ButtonLink
              className="min-h-9 px-3 text-[12px]"
              href={`/jobs/${job.id}`}
            >
              {copy.finalCheck}
            </ButtonLink>
          )}
          <Button
            className="min-h-9 px-3 text-[12px]"
            onClick={() => onSnooze(job, 3)}
            variant="secondary"
          >
            {copy.snooze}
          </Button>
        </div>
      </div>
    </article>
  );
}

function FollowUpMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone: "amber" | "blue" | "red" | "slate";
  value: number;
}) {
  return (
    <AppCard className="app-hover-lift p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn("h-2 w-2 rounded-full", getFollowUpMetricAccentClass(tone))}
        />
        <p className="text-[12px] font-semibold uppercase tracking-wide text-app-text-tertiary">
          {label}
        </p>
      </div>
      <p className={cn(
        "mt-2 text-[28px] font-semibold tracking-tight",
        tone === "red" && "text-red-600",
        tone === "amber" && "text-amber-700",
        tone === "blue" && "text-blue-700",
        tone === "slate" && "text-app-text-primary"
      )}>
        {value}
      </p>
    </AppCard>
  );
}

function getFollowUpAccentClass(bucket: FollowUpBucket) {
  if (bucket === "overdue") return "bg-red-500/70 shadow-[0_0_0_3px_rgba(239,68,68,0.10)]";
  if (bucket === "today") return "bg-amber-500/70 shadow-[0_0_0_3px_rgba(245,158,11,0.10)]";
  if (bucket === "upcoming") return "bg-blue-500/70 shadow-[0_0_0_3px_rgba(59,130,246,0.10)]";
  return "bg-slate-400/70";
}

function getFollowUpMetricAccentClass(tone: "amber" | "blue" | "red" | "slate") {
  if (tone === "red") return "bg-red-500/70 shadow-[0_0_0_3px_rgba(239,68,68,0.10)]";
  if (tone === "amber") return "bg-amber-500/70 shadow-[0_0_0_3px_rgba(245,158,11,0.10)]";
  if (tone === "blue") return "bg-blue-500/70 shadow-[0_0_0_3px_rgba(59,130,246,0.10)]";
  return "bg-slate-400/70";
}

function FollowUpKindBadge({
  copy,
  kind
}: {
  copy: FollowUpCopy;
  kind: FollowUpKind;
}) {
  return (
    <span className={cn(
      "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
      kind === "follow_up"
        ? "border-blue-200/70 bg-blue-50/55 text-blue-700"
        : "border-amber-200/70 bg-amber-50/55 text-amber-700"
    )}>
      {copy.kindLabels[kind]}
    </span>
  );
}

function FollowUpIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M5 18.5V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H9l-4 3.5Z" />
      <path d="M8.5 8.5h7" />
      <path d="M8.5 11.5H13" />
    </svg>
  );
}

function buildFollowUpItems(jobs: JobRecord[], today: string): FollowUpItem[] {
  const todayTime = dateOnlyTime(today);
  const nextWeekTime = todayTime + 7 * MS_PER_DAY;

  return jobs.flatMap((job) => {
    const items: FollowUpItem[] = [];

    if (job.follow_up_date || job.action_stage === "follow_up") {
      const date = job.follow_up_date || "";
      items.push({
        bucket: getFollowUpBucket(date, todayTime),
        date,
        daysUntil: date ? Math.round((dateOnlyTime(date) - todayTime) / MS_PER_DAY) : null,
        job,
        kind: "follow_up"
      });
      return items;
    }

    if (job.application_status === "Not Applied" && job.application_deadline) {
      const deadlineTime = dateOnlyTime(job.application_deadline);
      if (deadlineTime >= todayTime && deadlineTime <= nextWeekTime) {
        items.push({
          bucket: getFollowUpBucket(job.application_deadline, todayTime),
          date: job.application_deadline,
          daysUntil: Math.round((deadlineTime - todayTime) / MS_PER_DAY),
          job,
          kind: "deadline"
        });
      }
    }

    return items;
  }).sort(compareFollowUpItems);
}

function groupFollowUpItems(items: FollowUpItem[]) {
  return FOLLOW_UP_BUCKETS.reduce((groups, bucket) => {
    groups[bucket] = items.filter((item) => item.bucket === bucket);
    return groups;
  }, {} as Record<FollowUpBucket, FollowUpItem[]>);
}

function buildFollowUpStats(items: FollowUpItem[]) {
  return {
    later: items.filter((item) => item.bucket === "later").length,
    overdue: items.filter((item) => item.bucket === "overdue").length,
    today: items.filter((item) => item.bucket === "today").length,
    total: items.length,
    upcoming: items.filter((item) => item.bucket === "upcoming").length
  };
}

function compareFollowUpItems(a: FollowUpItem, b: FollowUpItem) {
  const bucketRank: Record<FollowUpBucket, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
    later: 3
  };

  return (
    bucketRank[a.bucket] - bucketRank[b.bucket] ||
    getSortTime(a.date) - getSortTime(b.date) ||
    b.job.match_score - a.job.match_score
  );
}

function getFollowUpBucket(date: string, todayTime: number): FollowUpBucket {
  if (!date) return "later";
  const time = dateOnlyTime(date);
  if (time < todayTime) return "overdue";
  if (time === todayTime) return "today";
  if (time <= todayTime + 7 * MS_PER_DAY) return "upcoming";
  return "later";
}

function getRelativeDateLabel(item: FollowUpItem, copy: FollowUpCopy) {
  if (item.daysUntil === null) return copy.noDate;
  if (item.daysUntil < 0) return copy.daysOverdue(Math.abs(item.daysUntil));
  if (item.daysUntil === 0) return copy.dueToday;
  if (item.daysUntil === 1) return copy.dueTomorrow;
  return copy.daysLeft(item.daysUntil);
}

function getFollowUpNote(
  job: JobRecord,
  copy: FollowUpCopy,
  language: "en" | "zh"
) {
  const note = job.next_step_note?.trim() || job.follow_up_notes?.trim();
  if (!note) return copy.defaultNextStep;
  if (language === "zh" && !containsCjk(note)) return copy.defaultNextStep;
  return note;
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function appendFollowUpNote(existing: string | undefined, note: string) {
  return [existing?.trim(), note].filter(Boolean).join("\n");
}

function getTodayDateString() {
  return toDateInputValue(new Date());
}

function addDaysToDate(value: string, days: number) {
  const date = new Date(dateOnlyTime(value));
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function dateOnlyTime(value: string) {
  return new Date(`${value}T00:00:00`).getTime();
}

function getSortTime(value: string) {
  return value ? dateOnlyTime(value) : Number.MAX_SAFE_INTEGER;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFollowUpCopy(language: "en" | "zh") {
  if (language === "zh") {
    return {
      bucketDescriptions: {
        later: "未来日期或尚未设置日期的跟进。",
        overdue: "已经错过日期，需要优先处理。",
        today: "今天应该完成的跟进。",
        upcoming: "未来 7 天内需要处理。"
      },
      bucketEmpty: {
        later: "暂时没有稍后的跟进。",
        overdue: "没有逾期项。",
        today: "今天没有必须处理的跟进。",
        upcoming: "未来 7 天没有临近项。"
      },
      bucketLabels: {
        later: "稍后",
        overdue: "已逾期",
        today: "今天",
        upcoming: "未来 7 天"
      },
      daysLeft: (days: number) => `${days} 天后`,
      daysOverdue: (days: number) => `逾期 ${days} 天`,
      defaultNextStep: "检查当前状态，决定是否需要发跟进信息。",
      dueToday: "今天到期",
      dueTomorrow: "明天到期",
      emptyBody: "当职位进入 Applied / Interview，或未投递职位临近截止日期时，会出现在这里。",
      emptyTitle: "当前没有需要跟进的机会",
      finalCheck: "投递检查",
      focusSubtitle: "先处理最紧急的一项，然后顺延下一次检查。",
      focusTitle: "当前重点",
      followedMessage: (date: string) => `已记录跟进，下次检查：${date}`,
      followedNextStep: (date: string) => `已完成本次跟进。下次检查日期：${date}`,
      followedNote: (today: string, next: string) => `已于 ${today} 完成跟进。下次检查：${next}。`,
      kindLabels: {
        deadline: "截止提醒",
        follow_up: "跟进"
      },
      later: "稍后",
      markFollowed: "已跟进",
      nextSeven: "未来 7 天",
      noDate: "未设日期",
      now: "现在处理",
      openJob: "打开职位",
      overdue: "已逾期",
      rhythmSteps: [
        "处理逾期和今天到期的项。",
        "完成后记录结果，并顺延下一次提醒。",
        "临近截止但未投递的职位，回详情页做最终检查。"
      ],
      rhythmTitle: "处理节奏",
      snooze: "3 天后提醒",
      snoozedMessage: (date: string) => `已顺延到 ${date}`,
      snoozedNote: (date: string) => `稍后处理。新的跟进日期：${date}`,
      subtitle: "集中处理投递后跟进、面试感谢信，以及临近截止的机会。",
      title: "待跟进",
      today: "今天",
      total: "待处理",
      workspace: "回到工作台"
    };
  }

  return {
    bucketDescriptions: {
      later: "Future or unscheduled follow-ups.",
      overdue: "Past-due items that should be handled first.",
      today: "Follow-ups that should happen today.",
      upcoming: "Items due in the next 7 days."
    },
    bucketEmpty: {
      later: "No later follow-ups.",
      overdue: "Nothing is overdue.",
      today: "No follow-ups are due today.",
      upcoming: "No upcoming items in the next 7 days."
    },
    bucketLabels: {
      later: "Later",
      overdue: "Overdue",
      today: "Today",
      upcoming: "Next 7 days"
    },
    daysLeft: (days: number) => `${days} days left`,
    daysOverdue: (days: number) => `${days} days overdue`,
    defaultNextStep: "Check the current status and decide whether to send a follow-up.",
    dueToday: "Due today",
    dueTomorrow: "Due tomorrow",
    emptyBody: "Applied or interview roles, plus not-applied roles near deadline, will appear here.",
    emptyTitle: "No follow-ups need attention",
    finalCheck: "Final check",
    focusSubtitle: "Handle the most urgent item first, then push the next check forward.",
    focusTitle: "Current focus",
    followedMessage: (date: string) => `Follow-up recorded. Next check: ${date}`,
    followedNextStep: (date: string) => `This follow-up is done. Next check: ${date}`,
    followedNote: (today: string, next: string) => `Followed up on ${today}. Next check: ${next}.`,
    kindLabels: {
      deadline: "Deadline",
      follow_up: "Follow-up"
    },
    later: "Later",
    markFollowed: "Followed up",
    nextSeven: "Next 7 days",
    noDate: "No date",
    now: "Handle now",
    openJob: "Open job",
    overdue: "Overdue",
    rhythmSteps: [
      "Start with overdue and due-today items.",
      "Record the outcome, then push the next reminder forward.",
      "For near-deadline roles, open the job detail and do a final check."
    ],
    rhythmTitle: "Handling rhythm",
    snooze: "Remind in 3d",
    snoozedMessage: (date: string) => `Snoozed until ${date}`,
    snoozedNote: (date: string) => `Handle later. New follow-up date: ${date}`,
    subtitle: "Handle post-application follow-ups, interview thank-you notes, and near-deadline roles.",
    title: "Follow Up",
    today: "Today",
    total: "open items",
    workspace: "Back to workspace"
  };
}
