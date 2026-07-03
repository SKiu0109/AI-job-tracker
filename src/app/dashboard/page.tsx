"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  DASHBOARD_REFRESH_INTERVAL_MS,
  MS_PER_DAY,
  MS_PER_MINUTE
} from "@/lib/constants";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { hydrateJobsFromCloud, upsertCloudJobs } from "@/lib/storage/cloud-sync";
import { loadJobs, prependMissingJobs, saveJobs } from "@/lib/storage/jobs";
import { createStorageScope } from "@/lib/storage/scope";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { cn } from "@/lib/utils";
import {
  ACTION_STAGES,
  APPLICATION_STATUSES,
  type ActionStage,
  type ApplicationStatus,
  type JobRecord
} from "@/types/job";

type DashboardCopy = ReturnType<typeof getDashboardCopy>;
type RiskTone = "green" | "amber" | "red" | "blue";

type DashboardInsights = {
  activeJobs: number;
  averageMatchScore: number;
  highMatchJobs: number;
  pipelineMomentum: number;
  scoreBands: Array<{
    count: number;
    helper: string;
    key: "strong" | "solid" | "weak";
    label: string;
    percent: number;
  }>;
  stageRows: Array<{
    count: number;
    label: string;
    percent: number;
    stage: ActionStage;
  }>;
  statusRows: Array<{
    count: number;
    label: string;
    percent: number;
    status: ApplicationStatus;
  }>;
  totalJobs: number;
};

type RiskSignal = {
  body: string;
  count: number;
  href: string;
  label: string;
  tone: RiskTone;
};

export default function DashboardPage() {
  const { session } = useAuth();
  const { language, t } = useLanguage();
  const userId = session?.user.id ?? null;
  const sessionRef = useRef(session);
  const storageScope = useMemo(() => createStorageScope(userId), [userId]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const loadDashboardJobs = useCallback(() => {
    setIsLoaded(false);
    void hydrateJobsFromCloud(sessionRef.current)
      .then((loadedJobs) => {
        setJobs(loadedJobs);
        setLastRefreshedAt(Date.now());
      })
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboardJobs, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboardJobs, userId]);

  const copy = getDashboardCopy(language);
  const insights = useMemo(
    () => buildDashboardInsights(jobs, copy),
    [copy, jobs]
  );
  const riskSignals = useMemo(
    () => buildRiskSignals(jobs, copy),
    [copy, jobs]
  );
  const portfolioBrief = useMemo(
    () => buildPortfolioBrief(jobs, copy),
    [copy, jobs]
  );

  const handleLoadSampleData = () => {
    const nextJobs = prependMissingJobs(loadJobs(storageScope), SAMPLE_JOBS);
    saveJobs(nextJobs, storageScope);
    setJobs(nextJobs);
    void upsertCloudJobs(sessionRef.current, nextJobs);
    setLastRefreshedAt(Date.now());
  };

  if (!isLoaded) {
    return (
      <AppCard className="p-6 text-[14px] text-app-text-secondary" variant="elevated">
        {t.analyzing}
      </AppCard>
    );
  }

  return (
    <div className="app-stagger space-y-6 pb-8">
      <PageHeader
        actions={
          <>
            {jobs.length ? (
              <FreshnessIndicator
                timestamp={lastRefreshedAt}
                onRefresh={loadDashboardJobs}
                t={t}
              />
            ) : null}
            {jobs.length ? (
              <ButtonLink href="/workspace">{copy.openWorkspace}</ButtonLink>
            ) : (
              <Button onClick={handleLoadSampleData} variant="secondary">
                {t.loadSampleData}
              </Button>
            )}
          </>
        }
        metadata={
          jobs.length ? (
            <>
              <Badge>{insights.totalJobs} {copy.trackedRoles}</Badge>
              <Badge>{insights.averageMatchScore}% {copy.averageMatch}</Badge>
              <Badge>{riskSignals.reduce((sum, item) => sum + item.count, 0)} {copy.riskItems}</Badge>
            </>
          ) : null
        }
        subtitle={copy.subtitle}
        title={copy.title}
      />

      {jobs.length === 0 ? (
        <AppCard as="section" className="px-6 py-16 text-center" variant="elevated">
          <h2 className="text-[18px] font-semibold text-app-text-primary">
            {copy.emptyTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-app-text-secondary">
            {copy.emptyBody}
          </p>
          <Button onClick={handleLoadSampleData} className="mt-6">
            {t.loadSampleData}
          </Button>
        </AppCard>
      ) : (
        <>
          <div className="space-y-5 rounded-xl border border-app-border-soft bg-app-surface-subtle p-4 shadow-app-card ring-1 ring-black/[0.015] backdrop-blur-xl sm:p-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricTile
                helper={copy.totalHelper}
                label={copy.totalRoles}
                value={insights.totalJobs}
              />
              <MetricTile
                helper={copy.averageHelper}
                label={copy.averageMatch}
                value={`${insights.averageMatchScore}%`}
              />
              <MetricTile
                helper={copy.highMatchHelper}
                label={copy.highMatch}
                value={insights.highMatchJobs}
              />
              <MetricTile
                helper={copy.momentumHelper}
                label={copy.pipelineMomentum}
                value={`${insights.pipelineMomentum}%`}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
              <PortfolioBriefCard brief={portfolioBrief} copy={copy} />
              <RiskWatchCard copy={copy} risks={riskSignals} />
            </section>
          </div>

          <div className="my-6 border-t border-app-border-soft" />

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <DistributionCard
              caption={copy.pipelineCaption}
              copy={copy}
              rows={insights.statusRows}
              title={copy.pipelineHealth}
            />
            <DistributionCard
              caption={copy.workloadCaption}
              copy={copy}
              rows={insights.stageRows}
              title={copy.workloadShape}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <QualityBandsCard bands={insights.scoreBands} copy={copy} />
            <ProductMapCard copy={copy} />
          </section>
        </>
      )}
    </div>
  );
}

function MetricTile({
  helper,
  label,
  value
}: {
  helper: string;
  label: string;
  value: number | string;
}) {
  return (
    <AppCard className="p-4" variant="elevated">
      <p className="text-[12px] font-medium text-app-text-tertiary">{label}</p>
      <p className="mt-2 text-[30px] font-semibold tracking-tight text-app-text-primary">
        {value}
      </p>
      <p className="mt-1 text-[12px] leading-5 text-app-text-secondary">
        {helper}
      </p>
    </AppCard>
  );
}

function PortfolioBriefCard({
  brief,
  copy
}: {
  brief: Array<{ body: string; label: string; value: string }>;
  copy: DashboardCopy;
}) {
  return (
    <AppCard as="section" className="h-fit min-w-0 p-5 sm:p-6" variant="elevated">
      <PanelHeader
        actionHref="/workspace"
        actionLabel={copy.resolveInWorkspace}
        subtitle={copy.briefSubtitle}
        title={copy.briefTitle}
      />
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {brief.map((item) => (
          <div
            className="rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl"
            key={item.label}
          >
            <p className="text-[12px] font-semibold text-app-accent">
              {item.label}
            </p>
            <p className="mt-2 text-[24px] font-semibold tracking-tight text-app-text-primary">
              {item.value}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </AppCard>
  );
}

function RiskWatchCard({
  copy,
  risks
}: {
  copy: DashboardCopy;
  risks: RiskSignal[];
}) {
  return (
    <AppCard as="section" className="min-w-0 p-5 sm:p-6" variant="elevated">
      <PanelHeader
        actionHref="/follow-up"
        actionLabel={copy.openFollowUp}
        subtitle={copy.riskSubtitle}
        title={copy.riskWatch}
      />
      <div className="mt-4 space-y-3">
        {risks.map((risk) => (
          <Link
            className="group block rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card transition duration-300 ease-[var(--app-motion-standard)] hover:-translate-y-px hover:border-app-border hover:bg-app-surface-hover hover:shadow-app-card"
            href={risk.href}
            key={risk.label}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-app-text-primary">
                  {risk.label}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-app-text-secondary">
                  {risk.body}
                </p>
              </div>
              <span
                className={cn(
                  "flex h-9 min-w-9 items-center justify-center rounded-app border px-2 text-[14px] font-semibold",
                  getRiskToneClass(risk.tone)
                )}
              >
                {risk.count}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </AppCard>
  );
}

function DistributionCard<T extends { count: number; label: string; percent: number }>({
  caption,
  copy,
  rows,
  title
}: {
  caption: string;
  copy: DashboardCopy;
  rows: T[];
  title: string;
}) {
  return (
    <AppCard as="section" className="min-w-0 p-5 sm:p-6" variant="elevated">
      <PanelHeader subtitle={caption} title={title} />
      <div className="mt-5 space-y-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-app-text-primary">
                {row.label}
              </span>
              <span className="text-[12px] text-app-text-secondary">
                {row.count} {copy.rolesUnit}
              </span>
            </div>
            <ProgressBar value={row.percent} />
          </div>
        ))}
      </div>
    </AppCard>
  );
}

function QualityBandsCard({
  bands,
  copy
}: {
  bands: DashboardInsights["scoreBands"];
  copy: DashboardCopy;
}) {
  return (
    <AppCard as="section" className="min-w-0 p-5 sm:p-6" variant="elevated">
      <PanelHeader subtitle={copy.qualitySubtitle} title={copy.qualityTitle} />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {bands.map((band) => (
          <div
            className="rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card"
            key={band.key}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-app-text-primary">
                {band.label}
              </p>
              <p className="text-[18px] font-semibold text-app-text-primary">
                {band.count}
              </p>
            </div>
            <div className="mt-3">
              <ProgressBar value={band.percent} />
            </div>
            <p className="mt-3 text-[12px] leading-5 text-app-text-secondary">
              {band.helper}
            </p>
          </div>
        ))}
      </div>
    </AppCard>
  );
}

function ProductMapCard({ copy }: { copy: DashboardCopy }) {
  return (
    <AppCard as="section" className="min-w-0 p-5 sm:p-6" variant="elevated">
      <PanelHeader subtitle={copy.productMapSubtitle} title={copy.productMapTitle} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {copy.destinations.map((destination) => (
          <Link
            className="rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card transition duration-300 ease-[var(--app-motion-standard)] hover:-translate-y-px hover:border-app-border hover:bg-app-surface-hover hover:shadow-app-card"
            href={destination.href}
            key={destination.href}
          >
            <p className="text-[14px] font-semibold text-app-text-primary">
              {destination.title}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-app-text-secondary">
              {destination.body}
            </p>
          </Link>
        ))}
      </div>
    </AppCard>
  );
}

function PanelHeader({
  actionHref,
  actionLabel,
  subtitle,
  title
}: {
  actionHref?: string;
  actionLabel?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-app-text-primary">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          className="shrink-0 text-[12px] font-semibold text-blue-700 hover:text-blue-800"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function FreshnessIndicator({
  timestamp,
  onRefresh,
  t
}: {
  timestamp: number;
  onRefresh: () => void;
  t: Record<string, string>;
}) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function update() {
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / MS_PER_MINUTE);

      if (mins < 1) {
        setLabel(t.dataJustNow);
      } else if (mins < 60) {
        setLabel(t.dataUpdated.replace("{time}", `${mins}m ago`));
      } else {
        setLabel(t.dataUpdated.replace("{time}", `${Math.floor(mins / 60)}h ago`));
      }
    }

    update();
    const interval = setInterval(update, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [timestamp, t]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-app-text-tertiary">{label}</span>
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-app border border-app-border-soft bg-app-surface text-app-text-tertiary transition-colors hover:bg-app-surface-hover hover:text-app-text-primary"
        onClick={onRefresh}
        title={t.refreshData}
        type="button"
      >
        ↻
      </button>
    </div>
  );
}

function buildDashboardInsights(
  jobs: JobRecord[],
  copy: DashboardCopy
): DashboardInsights {
  const totalJobs = jobs.length;
  const averageMatchScore = totalJobs
    ? Math.round(jobs.reduce((sum, job) => sum + job.match_score, 0) / totalJobs)
    : 0;
  const activeJobs = jobs.filter(
    (job) => job.application_status !== "Rejected" && job.action_stage !== "parked"
  ).length;
  const pipelineMomentum = totalJobs ? Math.round((activeJobs / totalJobs) * 100) : 0;
  const highMatchJobs = jobs.filter((job) => job.match_score >= 80).length;
  const scoreBands = [
    {
      count: highMatchJobs,
      helper: copy.scoreBandHelpers.strong,
      key: "strong" as const,
      label: copy.scoreBandLabels.strong,
      percent: getPercent(highMatchJobs, totalJobs)
    },
    {
      count: jobs.filter((job) => job.match_score >= 60 && job.match_score < 80).length,
      helper: copy.scoreBandHelpers.solid,
      key: "solid" as const,
      label: copy.scoreBandLabels.solid,
      percent: getPercent(
        jobs.filter((job) => job.match_score >= 60 && job.match_score < 80).length,
        totalJobs
      )
    },
    {
      count: jobs.filter((job) => job.match_score < 60).length,
      helper: copy.scoreBandHelpers.weak,
      key: "weak" as const,
      label: copy.scoreBandLabels.weak,
      percent: getPercent(jobs.filter((job) => job.match_score < 60).length, totalJobs)
    }
  ];
  const statusRows = APPLICATION_STATUSES.map((status) => {
    const count = jobs.filter((job) => job.application_status === status).length;
    return {
      count,
      label: copy.statusLabels[status],
      percent: getPercent(count, totalJobs),
      status
    };
  });
  const stageRows = ACTION_STAGES.map((stage) => {
    const count = jobs.filter((job) => getSafeActionStage(job.action_stage) === stage).length;
    return {
      count,
      label: copy.stageLabels[stage],
      percent: getPercent(count, totalJobs),
      stage
    };
  });

  return {
    activeJobs,
    averageMatchScore,
    highMatchJobs,
    pipelineMomentum,
    scoreBands,
    stageRows,
    statusRows,
    totalJobs
  };
}

function buildRiskSignals(jobs: JobRecord[], copy: DashboardCopy): RiskSignal[] {
  const today = startOfToday();
  const deadlineCutoff = today + 3 * MS_PER_DAY;
  const staleCutoff = Date.now() - 10 * MS_PER_DAY;
  const deadlineSoon = jobs.filter((job) => {
    if (!job.application_deadline || job.application_status !== "Not Applied") {
      return false;
    }

    const time = new Date(job.application_deadline).getTime();
    return !Number.isNaN(time) && time >= today && time <= deadlineCutoff;
  }).length;
  const overdueFollowUps = jobs.filter((job) => {
    if (!job.follow_up_date) return false;
    const time = new Date(job.follow_up_date).getTime();
    return !Number.isNaN(time) && time < today;
  }).length;
  const highMatchUnreviewed = jobs.filter(
    (job) => job.match_score >= 80 && getSafeActionStage(job.action_stage) === "needs_review"
  ).length;
  const staleOpen = jobs.filter((job) => {
    const updated = new Date(job.updated_at).getTime();
    return (
      !Number.isNaN(updated) &&
      updated < staleCutoff &&
      job.application_status !== "Rejected" &&
      job.application_status !== "Offer"
    );
  }).length;

  return [
    {
      body: copy.riskBodies.deadlineSoon,
      count: deadlineSoon,
      href: "/workspace",
      label: copy.riskLabels.deadlineSoon,
      tone: deadlineSoon > 0 ? "red" : "green"
    },
    {
      body: copy.riskBodies.overdueFollowUps,
      count: overdueFollowUps,
      href: "/follow-up",
      label: copy.riskLabels.overdueFollowUps,
      tone: overdueFollowUps > 0 ? "red" : "green"
    },
    {
      body: copy.riskBodies.highMatchUnreviewed,
      count: highMatchUnreviewed,
      href: "/workspace",
      label: copy.riskLabels.highMatchUnreviewed,
      tone: highMatchUnreviewed > 0 ? "amber" : "green"
    },
    {
      body: copy.riskBodies.staleOpen,
      count: staleOpen,
      href: "/follow-up",
      label: copy.riskLabels.staleOpen,
      tone: staleOpen > 0 ? "blue" : "green"
    }
  ];
}

function buildPortfolioBrief(jobs: JobRecord[], copy: DashboardCopy) {
  const bestJob = [...jobs].sort((a, b) => b.match_score - a.match_score)[0];
  const needsDecision = jobs.filter(
    (job) => getSafeActionStage(job.action_stage) === "needs_review"
  ).length;
  const resumeDrafts = jobs.filter(
    (job) => job.action_stage === "tailor_resume" || job.tailoring_status === "draft_ready"
  ).length;
  const activeFollowUps = jobs.filter(
    (job) => job.action_stage === "follow_up" || Boolean(job.follow_up_date)
  ).length;

  return [
    {
      body: copy.briefBodies.bestMatch,
      label: copy.briefLabels.bestMatch,
      value: bestJob ? `${bestJob.match_score}%` : "0%"
    },
    {
      body: copy.briefBodies.decisions,
      label: copy.briefLabels.decisions,
      value: String(needsDecision)
    },
    {
      body: copy.briefBodies.execution,
      label: copy.briefLabels.execution,
      value: `${resumeDrafts} / ${activeFollowUps}`
    }
  ];
}

function getRiskToneClass(tone: RiskTone) {
  if (tone === "red") return "border-red-200/80 bg-red-50/70 text-red-700";
  if (tone === "amber") return "border-amber-200/80 bg-amber-50/70 text-amber-700";
  if (tone === "blue") return "border-blue-200/80 bg-blue-50/70 text-blue-700";
  return "border-green-200/80 bg-green-50/70 text-green-700";
}

function getSafeActionStage(stage: unknown): ActionStage {
  const value = typeof stage === "string" ? stage : "";
  return ACTION_STAGES.includes(value as ActionStage)
    ? (value as ActionStage)
    : "needs_review";
}

function getPercent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getDashboardCopy(language: "en" | "zh") {
  const zh = language === "zh";

  return {
    averageHelper: zh ? "已保存机会的平均匹配水平" : "Average match across saved roles",
    averageMatch: zh ? "平均匹配" : "Avg match",
    briefBodies: {
      bestMatch: zh ? "用于判断当前机会池上限。" : "Shows the current ceiling of the saved role pool.",
      decisions: zh ? "需要回到工作台决定推进、暂缓或跳过。" : "Return to the workspace to move, park, or skip these.",
      execution: zh ? "左侧是待改简历，右侧是待跟进。" : "Resume tailoring on the left, follow-ups on the right."
    },
    briefLabels: {
      bestMatch: zh ? "最高匹配" : "Best match",
      decisions: zh ? "待判断" : "Needs decision",
      execution: zh ? "改简历 / 跟进" : "Tailor / follow"
    },
    briefSubtitle: zh
      ? "只保留组合层面的判断，不在这里展开任务清单。"
      : "Portfolio-level signals only; task lists live in the workspace.",
    briefTitle: zh ? "机会组合摘要" : "Portfolio Brief",
    destinations: [
      {
        body: zh ? "处理今日行动队列、筛选机会、进入职位详情。" : "Work through today's queue, filters, and job details.",
        href: "/workspace",
        title: zh ? "工作台" : "Workspace"
      },
      {
        body: zh ? "上传简历、维护候选人画像、查看待定制岗位。" : "Upload resumes, maintain the profile, and review tailoring targets.",
        href: "/resume-hub",
        title: zh ? "简历中心" : "Resume Hub"
      },
      {
        body: zh ? "集中处理申请后跟进、截止日期和面试节奏。" : "Manage follow-ups, deadlines, and interview rhythm.",
        href: "/follow-up",
        title: zh ? "待跟进" : "Follow Up"
      },
      {
        body: zh ? "粘贴 JD、保存草稿、再进入正式分析。" : "Paste JDs, save drafts, then move into analysis.",
        href: "/add",
        title: zh ? "导入收件箱" : "Import Inbox"
      }
    ],
    emptyBody: zh
      ? "载入示例数据或分析一个 JD，就可以看到管道健康、匹配质量和跟进风险。"
      : "Load sample data or analyze a JD to see pipeline health, match quality, and follow-up risk.",
    emptyTitle: zh ? "还没有可观察的数据" : "No insights yet",
    highMatch: zh ? "高匹配职位" : "High-match roles",
    highMatchHelper: zh ? "匹配度 80 分以上" : "Roles at 80+ match",
    momentumHelper: zh ? "非拒绝、非暂缓的机会占比" : "Share of roles still in play",
    openFollowUp: zh ? "处理跟进" : "Open follow-up",
    openWorkspace: zh ? "打开工作台" : "Open workspace",
    pipelineCaption: zh
      ? "这里只看申请状态分布，具体任务回到工作台处理。"
      : "Application status distribution only; execution stays in the workspace.",
    pipelineHealth: zh ? "申请管道健康" : "Pipeline Health",
    pipelineMomentum: zh ? "活跃管道" : "Active pipeline",
    productMapSubtitle: zh
      ? "洞察页负责观察，其他页面负责执行。"
      : "Insights observe; the other pages execute.",
    productMapTitle: zh ? "下一步去哪里处理" : "Where Work Happens",
    qualitySubtitle: zh
      ? "按匹配分把机会池分层，避免把低价值岗位挤进行动队列。"
      : "Group roles by match strength so low-value work stays out of the queue.",
    qualityTitle: zh ? "机会质量分层" : "Opportunity Quality",
    resolveInWorkspace: zh ? "去工作台处理" : "Resolve in workspace",
    riskBodies: {
      deadlineSoon: zh ? "未申请且 3 天内截止。" : "Not applied and due within 3 days.",
      highMatchUnreviewed: zh ? "高匹配但还没做推进判断。" : "High-match roles still waiting for a decision.",
      overdueFollowUps: zh ? "跟进日期已经过去。" : "Follow-up dates that have already passed.",
      staleOpen: zh ? "10 天以上没有更新的活跃机会。" : "Active opportunities untouched for 10+ days."
    },
    riskItems: zh ? "风险项" : "risk items",
    riskLabels: {
      deadlineSoon: zh ? "截止临近" : "Deadline soon",
      highMatchUnreviewed: zh ? "高匹配未判断" : "High-match undecided",
      overdueFollowUps: zh ? "逾期跟进" : "Overdue follow-ups",
      staleOpen: zh ? "长期未更新" : "Stale open roles"
    },
    riskSubtitle: zh
      ? "只暴露需要注意的模式，点击后去对应工作流处理。"
      : "Only patterns worth attention; click through to the right workflow.",
    riskWatch: zh ? "风险观察" : "Risk Watch",
    rolesUnit: zh ? "个" : "roles",
    scoreBandHelpers: {
      solid: zh ? "可保留，但不应挤占高匹配任务。" : "Keep visible, but do not crowd out high-fit work.",
      strong: zh ? "优先进入定制简历或投递检查。" : "Move these toward resume tailoring or final checks.",
      weak: zh ? "适合暂缓、补技能或删除。" : "Good candidates to park, improve for, or remove."
    },
    scoreBandLabels: {
      solid: zh ? "60-79 分" : "60-79",
      strong: zh ? "80+ 分" : "80+",
      weak: zh ? "低于 60" : "Below 60"
    },
    stageLabels: {
      needs_review: zh ? "待判断" : "Needs review",
      tailor_resume: zh ? "改简历" : "Tailor resume",
      ready_to_apply: zh ? "可投递" : "Ready to apply",
      follow_up: zh ? "待跟进" : "Follow up",
      parked: zh ? "暂缓" : "Parked"
    } satisfies Record<ActionStage, string>,
    statusLabels: {
      "Not Applied": zh ? "未申请" : "Not applied",
      Applied: zh ? "已申请" : "Applied",
      Interview: zh ? "面试中" : "Interview",
      Rejected: zh ? "已拒绝" : "Rejected",
      Offer: "Offer"
    } satisfies Record<ApplicationStatus, string>,
    subtitle: zh
      ? "观察机会池是否健康；具体推进动作回到工作台完成。"
      : "Observe whether the opportunity pool is healthy; move work in the workspace.",
    title: zh ? "申请洞察" : "Application Insights",
    totalHelper: zh ? "当前保存的全部职位" : "All saved roles",
    totalRoles: zh ? "职位总数" : "Total roles",
    trackedRoles: zh ? "已追踪职位" : "tracked roles",
    workloadCaption: zh
      ? "显示任务负载分布，帮助判断是否需要收敛或清理。"
      : "Shows workload shape so you can decide whether to narrow or clean up.",
    workloadShape: zh ? "工作负载分布" : "Workload Shape"
  };
}
