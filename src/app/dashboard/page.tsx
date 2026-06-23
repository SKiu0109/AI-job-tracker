"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { useLanguage } from "@/lib/i18n/language-provider";
import { loadJobs, saveJobs } from "@/lib/storage/jobs";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { APPLICATION_STATUSES, JobRecord } from "@/types/job";

export default function DashboardPage() {
  const { language, t, statuses } = useLanguage();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setJobs(loadJobs());
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const analytics = useMemo(() => buildAnalytics(jobs, language), [jobs, language]);

  const handleLoadSampleData = () => {
    saveJobs(SAMPLE_JOBS);
    setJobs(loadJobs());
  };

  if (!isLoaded) {
    return (
      <div className="rounded-panel border border-line bg-white p-6 shadow-soft">
        {t.analyzing}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal text-ink">
            {t.dashboard}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">{t.subtitle}</p>
        </div>
        {jobs.length === 0 ? (
          <Button variant="secondary" onClick={handleLoadSampleData}>
            {t.loadSampleData}
          </Button>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <section className="rounded-panel border border-line bg-white px-6 py-12 text-center shadow-panel">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-panel border border-line bg-surface-muted text-sm font-bold text-accent">
            AI
          </div>
          <h2 className="text-xl font-semibold text-ink">{t.noAnalyticsYet}</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
            {t.emptyBody}
          </p>
          <Button className="mt-5" onClick={handleLoadSampleData}>
            {t.loadSampleData}
          </Button>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={t.totalJobs} value={analytics.totalJobs} />
            <MetricCard
              label={t.averageMatchScore}
              value={<ScoreBadge score={analytics.averageMatchScore} />}
            />
            <MetricCard label={t.highMatchJobs} value={analytics.highMatchJobs} />
            <MetricCard label={t.interviewCount} value={analytics.statusCounts.Interview} />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {APPLICATION_STATUSES.map((status) => (
              <MetricCard
                key={status}
                label={statuses[status]}
                value={analytics.statusCounts[status]}
                compact
              />
            ))}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={t.applicationFunnel}>
              <BarList
                values={APPLICATION_STATUSES.map((status) => ({
                  label: statuses[status],
                  count: analytics.statusCounts[status]
                }))}
                total={analytics.totalJobs}
              />
            </Panel>

            <Panel title={t.jobsByRoleType}>
              <BarList values={analytics.jobsByRoleType} total={analytics.totalJobs} />
            </Panel>

            <Panel title={t.averageMatchByRole}>
              <ScoreList values={analytics.averageMatchByRole} />
            </Panel>

            <Panel title={t.topSkills}>
              <BadgeCloud values={analytics.topSkills} fallback={t.notProvided} />
            </Panel>

            <Panel title={t.topMissingSkills}>
              <BadgeCloud values={analytics.topMissingSkills} fallback={t.notProvided} />
            </Panel>

            <Panel title={t.topRequiredTools}>
              <BadgeCloud values={analytics.topRequiredTools} fallback={t.notProvided} />
            </Panel>

            <Panel title={t.regionBreakdown}>
              <BarList values={analytics.regionBreakdown} total={analytics.totalJobs} />
            </Panel>

            <Panel title={t.highPriorityJobs}>
              <HighPriorityJobs jobs={analytics.highPriorityJobsList} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  compact = false
}: {
  label: string;
  value: number | ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-panel border border-line bg-white p-4 shadow-soft transition duration-200 hover:border-line-strong hover:shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <div
        className={
          compact
            ? "mt-2 text-2xl font-semibold tracking-normal text-ink"
            : "mt-3 text-3xl font-semibold tracking-normal text-ink"
        }
      >
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-panel border border-line bg-white p-4 shadow-soft">
      <h2 className="text-base font-semibold tracking-normal text-ink">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BarList({
  values,
  total
}: {
  values: Array<{ label: string; count: number }>;
  total: number;
}) {
  if (!values.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {values.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{item.label}</span>
            <span className="text-muted">{item.count}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${Math.max(8, Math.round((item.count / total) * 100))}%`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreList({
  values
}: {
  values: Array<{ label: string; score: number; count: number }>;
}) {
  if (!values.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      {values.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{item.label}</span>
            <span className="text-muted">
              {item.score} / {item.count}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={getScoreBarClassName(item.score)}
              style={{ width: `${Math.max(8, item.score)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function BadgeCloud({
  values,
  fallback
}: {
  values: Array<{ label: string; count: number }>;
  fallback: string;
}) {
  return values.length ? (
    <div className="flex flex-wrap gap-2">
      {values.map((item) => (
        <Badge key={item.label}>
          {item.label} - {item.count}
        </Badge>
      ))}
    </div>
  ) : (
    <p className="text-sm text-muted">{fallback}</p>
  );
}

function HighPriorityJobs({ jobs }: { jobs: JobRecord[] }) {
  const { language, t } = useLanguage();

  if (!jobs.length) {
    return <p className="text-sm text-muted">{t.notProvided}</p>;
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/jobs/${job.id}`}
          className="block rounded-panel border border-line bg-surface-muted p-3 transition duration-200 hover:border-accent hover:bg-white hover:shadow-soft"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <CompanyLogo company={job.company} size="sm" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-ink">
                  {language === "zh" && job.job_title_zh
                    ? job.job_title_zh
                    : job.job_title_original}
                </p>
                <p className="mt-1 truncate text-xs font-medium text-muted">
                  {job.company}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {language === "zh" ? job.job_type_zh : job.job_type_en}
                </p>
              </div>
            </div>
            <ScoreBadge score={job.match_score} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function buildAnalytics(jobs: JobRecord[], language: "en" | "zh") {
  const totalJobs = jobs.length;
  const statusCounts = APPLICATION_STATUSES.reduce((counts, status) => {
    counts[status] = jobs.filter((job) => job.application_status === status).length;
    return counts;
  }, {} as Record<JobRecord["application_status"], number>);
  const averageMatchScore = totalJobs
    ? Math.round(
        jobs.reduce((sum, job) => sum + job.match_score, 0) / totalJobs
      )
    : 0;
  const highMatchJobs = jobs.filter((job) => job.match_score >= 80).length;

  return {
    totalJobs,
    statusCounts,
    averageMatchScore,
    highMatchJobs,
    jobsByRoleType: countValues(
      jobs.map((job) => (language === "zh" ? job.job_type_zh : job.job_type_en))
    ),
    averageMatchByRole: averageScoresByGroup(jobs, (job) =>
      language === "zh" ? job.job_type_zh : job.job_type_en
    ),
    topSkills: countValues(jobs.flatMap((job) => job.skills)).slice(0, 10),
    topMissingSkills: countValues(jobs.flatMap((job) => job.missing_skills)).slice(0, 10),
    topRequiredTools: countValues(jobs.flatMap((job) => job.important_tools)).slice(0, 10),
    regionBreakdown: countValues(
      jobs.map((job) => getRegionLabel(job.location, language))
    ),
    highPriorityJobsList: [...jobs]
      .filter(isHighPriorityJob)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 6)
  };
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();

  values
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));

  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );
}

function averageScoresByGroup(
  jobs: JobRecord[],
  getGroup: (job: JobRecord) => string
) {
  const groups = new Map<string, { total: number; count: number }>();

  jobs.forEach((job) => {
    const label = getGroup(job).trim() || "Not specified";
    const current = groups.get(label) ?? { total: 0, count: 0 };
    groups.set(label, {
      total: current.total + job.match_score,
      count: current.count + 1
    });
  });

  return Array.from(groups, ([label, value]) => ({
    label,
    score: Math.round(value.total / value.count),
    count: value.count
  })).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

function getRegionLabel(location: string, language: "en" | "zh") {
  const normalized = location.toLowerCase();

  if (
    normalized.includes("australia") ||
    normalized.includes("sydney") ||
    normalized.includes("melbourne") ||
    normalized.includes("brisbane") ||
    normalized.includes("perth")
  ) {
    return language === "zh" ? "澳大利亚" : "Australia";
  }

  if (normalized.includes("singapore")) {
    return language === "zh" ? "新加坡" : "Singapore";
  }

  if (
    normalized.includes("china") ||
    normalized.includes("shanghai") ||
    normalized.includes("beijing") ||
    normalized.includes("shenzhen") ||
    normalized.includes("guangzhou")
  ) {
    return language === "zh" ? "中国" : "China";
  }

  return language === "zh" ? "其他 / 未注明" : "Other / Not specified";
}

function isHighPriorityJob(job: JobRecord) {
  return (
    job.match_score >= 80 ||
    job.recommended_next_action.urgency === "High" ||
    job.recommended_next_action.action === "Apply now"
  );
}

function getScoreBarClassName(score: number) {
  const tone =
    score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";

  return `h-full rounded-full ${tone}`;
}
