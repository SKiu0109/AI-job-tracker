"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { useLanguage } from "@/lib/i18n/language-provider";
import { loadJobs, saveJobs } from "@/lib/storage/jobs";
import { SAMPLE_JOBS } from "@/lib/sample-jobs";
import { APPLICATION_STATUSES, JobRecord } from "@/types/job";
import { DASHBOARD_REFRESH_INTERVAL_MS, MS_PER_MINUTE } from "@/lib/constants";

export default function DashboardPage() {
  const { language, t, statuses } = useLanguage();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(0);

  const handleRefresh = useCallback(() => {
    setIsLoaded(false);
    setLastRefreshedAt(Date.now());
    const timer = window.setTimeout(() => {
      setJobs(loadJobs());
      setIsLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setJobs(loadJobs());
      setLastRefreshedAt(Date.now());
      setIsLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const analytics = useMemo(() => buildAnalytics(jobs, language), [jobs, language]);
  const insights = useMemo(() => buildInsights(analytics, jobs, t, language), [analytics, jobs, t, language]);

  const handleLoadSampleData = () => {
    saveJobs(SAMPLE_JOBS);
    setJobs(loadJobs());
    setLastRefreshedAt(Date.now());
  };

  if (!isLoaded) return <div className="rounded-xl border border-black/[0.04] bg-white p-6 text-[14px] text-secondary">{t.analyzing}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-primary">{t.dashboard}</h1>
          <p className="mt-1 text-[14px] text-secondary">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {jobs.length > 0 && <FreshnessIndicator timestamp={lastRefreshedAt} onRefresh={handleRefresh} t={t} />}
          {jobs.length === 0 ? <button onClick={handleLoadSampleData} className="rounded-lg border border-black/[0.06] bg-white px-4 py-2 text-[13px] font-medium text-secondary transition-colors hover:bg-[#FAFAFA]">{t.loadSampleData}</button> : null}
        </div>
      </div>

      {jobs.length === 0 ? (
        <section className="rounded-xl border border-black/[0.04] bg-white px-6 py-16 text-center">
          <h2 className="text-[18px] font-semibold text-primary">{t.noAnalyticsYet}</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-secondary">{t.emptyBody}</p>
          <button onClick={handleLoadSampleData} className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:bg-accent-hover">{t.loadSampleData}</button>
        </section>
      ) : (
        <>
          {/* ─── Top Metric Cards ─── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={t.totalJobs} value={analytics.totalJobs} helper={language === "zh" ? `过去 7 天新增 ${analytics.recentJobsCount} 个` : `${analytics.recentJobsCount} added in 7 days`} />
            <MetricCard label={t.averageMatchScore} value={`${analytics.averageMatchScore}%`} helper={language === "zh" ? "整体机会质量较高" : "Overall match quality"} ring={analytics.averageMatchScore} accent="score" />
            <MetricCard label={t.highMatchJobs} value={analytics.highMatchJobs} helper={language === "zh" ? "建议优先处理" : "Review first"} accent="good" />
            <MetricCard label={language === "zh" ? "面试中" : "Interviewing"} value={analytics.statusCounts.Interview} helper={language === "zh" ? "需要跟进" : "Need follow-up"} accent="info" />
          </div>

          {/* ─── Action Center ─── */}
          {insights.length > 0 && (
            <section className="rounded-xl border border-black/[0.04] bg-white p-5 shadow-sm">
              <h2 className="text-[16px] font-semibold text-primary">{language === "zh" ? "行动中心" : "Action Center"}</h2>
              <p className="mt-1 text-[13px] text-secondary">{t.insightsSubtitle}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {insights.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-black/[0.04] bg-[#FAFAFA] p-4 transition-all hover:border-black/[0.08] hover:shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-subtle text-[10px] font-bold text-accent">{idx + 1}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary/60">{item.label}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-primary">{item.text}</p>
                    <p className="mt-2 text-[12px] text-accent">{item.action}</p>
                    {item.link ? (
                      <Link href={item.link} className="mt-2 inline-block text-[12px] font-medium text-accent transition-colors hover:text-accent-hover">{item.linkLabel} →</Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── High Priority Jobs ─── */}
          {analytics.highPriorityJobsList.length > 0 && (
            <section className="rounded-xl border border-black/[0.04] bg-white p-5 shadow-sm">
              <h2 className="text-[16px] font-semibold text-primary">{t.highPriorityJobs}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {analytics.highPriorityJobsList.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="group rounded-lg border border-black/[0.04] bg-[#FAFAFA] p-4 transition-all hover:-translate-y-0.5 hover:border-black/[0.08] hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <CompanyLogo company={job.company} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[13px] font-semibold text-primary group-hover:text-accent">{language === "zh" && job.job_title_zh ? job.job_title_zh : job.job_title_en && job.job_title_en !== "Not specified" ? job.job_title_en : job.job_title_original}</p>
                        <p className="mt-0.5 text-[12px] text-secondary">{job.company}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <ScoreBadge score={job.match_score} recommendation={job.application_recommendation} />
                      <span className="text-[11px] text-secondary">{statuses[job.application_status]}</span>
                    </div>
                    {job.key_strengths_en?.[0] ? (
                      <p className="mt-2 text-[11px] text-secondary/60">{(language === "zh" ? "强项" : "Strength")}: {language === "zh" ? (job.key_strengths_zh?.[0] ?? job.key_strengths_en[0]) : job.key_strengths_en[0]}</p>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ─── Funnel + Role Scores ─── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <InsightPanel title={t.applicationFunnel} insight={language === "zh" ? `未申请职位占 ${analytics.statusCounts["Not Applied"]}/${analytics.totalJobs}` : `Not Applied: ${analytics.statusCounts["Not Applied"]}/${analytics.totalJobs}`}>
              <FunnelBarList values={APPLICATION_STATUSES.map((s) => ({ label: statuses[s], count: analytics.statusCounts[s] }))} total={analytics.totalJobs} />
            </InsightPanel>
            <InsightPanel title={t.averageMatchByRole} insight={language === "zh" ? "实习岗位平均匹配度与全职接近" : "Internship and full-time scores are close"}>
              <ScoreList values={analytics.averageMatchByRole} />
            </InsightPanel>
          </div>

          {/* ─── Detail Panels ─── */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <InsightPanel title={t.jobsByRoleType} insight={analytics.jobsByRoleType.length ? (language === "zh" ? `${analytics.jobsByRoleType[0]?.label} 类职位最多` : `${analytics.jobsByRoleType[0]?.label} roles lead`) : ""}>
              <BarList values={analytics.jobsByRoleType} total={analytics.totalJobs} />
            </InsightPanel>

            <InsightPanel title={t.topSkills} insight={analytics.topSkills.length ? (language === "zh" ? `${analytics.topSkills[0]?.label} 最常见` : `${analytics.topSkills[0]?.label} is most common`) : ""}>
              <BarList values={analytics.topSkills} total={analytics.topSkills.reduce((s, v) => s + v.count, 0)} compact />
            </InsightPanel>

            <InsightPanel title={t.topMissingSkills} insight={analytics.topMissingSkills.length ? (language === "zh" ? "建议优先补强高频率缺失技能" : "Prioritize frequent gaps") : ""}>
              <MissingSkillsList values={analytics.topMissingSkills} language={language} />
            </InsightPanel>

            <InsightPanel title={t.topRequiredTools} insight={analytics.topRequiredTools.length ? (language === "zh" ? `${analytics.topRequiredTools[0]?.label} 和 ${analytics.topRequiredTools[1]?.label ?? "SQL"} 最常见` : `${analytics.topRequiredTools[0]?.label} and ${analytics.topRequiredTools[1]?.label ?? "SQL"} lead`) : ""}>
              <BarList values={analytics.topRequiredTools} total={analytics.topRequiredTools.reduce((s, v) => s + v.count, 0)} compact />
            </InsightPanel>

            <InsightPanel title={t.regionBreakdown} className="sm:col-span-2 lg:col-span-2" insight={language === "zh" ? "各区域机会数量接近，可并行申请" : "Region counts are close — apply across them"}>
              <RegionList values={analytics.regionBreakdown} jobs={jobs} language={language} />
            </InsightPanel>
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────── Sub-components ──────────── */

function MetricCard({ label, value, helper, ring, accent = "neutral" }: { label: string; value: string | number; helper?: string; ring?: number; accent?: "neutral" | "good" | "score" | "info" }) {
  const dotColor = { neutral: "bg-accent/40", good: "bg-green-500/50", score: "bg-amber-400/50", info: "bg-accent/50" }[accent];
  return (
    <div className="group rounded-xl border border-black/[0.04] bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
        <p className="text-[12px] font-medium text-secondary/60">{label}</p>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[28px] font-semibold tracking-tight text-primary">{value}</span>
        {ring !== undefined ? <RingProgress percent={ring} size={40} strokeWidth={3} /> : null}
      </div>
      {helper ? <p className="mt-1.5 text-[12px] text-secondary/45">{helper}</p> : null}
    </div>
  );
}

function RingProgress({ percent, size = 40, strokeWidth = 3 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const color = percent >= 80 ? "#1AAE4A" : percent >= 60 ? "#DD8A00" : "#CC3B3B";
  const bgColor = percent >= 80 ? "rgba(26,174,74,0.08)" : percent >= 60 ? "rgba(221,138,0,0.08)" : "rgba(204,59,59,0.08)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-label={`${percent}%`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.6s ease-out" }} />
    </svg>
  );
}

function InsightPanel({ title, insight, children, className = "" }: { title: string; insight?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-black/[0.04] bg-white p-5 shadow-sm ${className}`}>
      <h2 className="text-[14px] font-semibold text-primary">{title}</h2>
      {insight ? <p className="mt-0.5 text-[12px] text-secondary/50">{insight}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FreshnessIndicator({ timestamp, onRefresh, t }: { timestamp: number; onRefresh: () => void; t: Record<string, string> }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    function update() {
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / MS_PER_MINUTE);
      if (mins < 1) setLabel(t.dataJustNow);
      else if (mins < 60) setLabel(t.dataUpdated.replace("{time}", `${mins}m ago`));
      else setLabel(t.dataUpdated.replace("{time}", `${Math.floor(mins / 60)}h ago`));
    }
    update(); const interval = setInterval(update, DASHBOARD_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [timestamp, t]);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-secondary/40">{label}</span>
      <button onClick={onRefresh} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-secondary/40 transition-colors hover:bg-[#FAFAFA] hover:text-secondary" title={t.refreshData}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 7a6 6 0 0 1 10.25-4.25L13 4.5"/><path d="M13 7a6 6 0 0 1-10.25 4.25L1 9.5"/><path d="M13 1v3.5H9.5"/><path d="M1 13V9.5h3.5"/></svg>
      </button>
    </div>
  );
}

function BarList({ values, total, compact = false }: { values: Array<{ label: string; count: number }>; total: number; compact?: boolean }) {
  if (!values.length) return <p className="text-[13px] text-secondary/50">&mdash;</p>;
  const maxCount = Math.max(...values.map((v) => v.count), 1);
  const denominator = Math.max(total, maxCount, 1);
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {values.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-primary">{item.label}</span>
            <span className="shrink-0 tabular-nums text-[12px] text-secondary">{item.count}</span>
          </div>
          <div className={compact ? "mt-1 h-1 overflow-hidden rounded-full bg-black/[0.04]" : "mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.04]"}>
            <div className="h-full rounded-full bg-accent/60" style={{ width: `${Math.max(compact ? 8 : 6, Math.round((item.count / denominator) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FunnelBarList({ values, total }: { values: Array<{ label: string; count: number }>; total: number }) {
  const colors = ["#0066CC", "#3388DD", "#66AADD", "#D5D2CD", "#1AAE4A"];
  if (!values.length) return <p className="text-[13px] text-secondary/50">&mdash;</p>;
  const maxCount = Math.max(...values.map((v) => v.count), 1);
  const denominator = Math.max(total, maxCount, 1);
  return (
    <div className="space-y-3">
      {values.map((item, idx) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-primary">{item.label}</span>
            <span className="shrink-0 tabular-nums text-[12px] text-secondary">{item.count}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.04]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(6, Math.round((item.count / denominator) * 100))}%`, backgroundColor: colors[idx] ?? colors[3] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreList({ values }: { values: Array<{ label: string; score: number; count: number }> }) {
  if (!values.length) return <p className="text-[13px] text-secondary/50">&mdash;</p>;
  return (
    <div className="space-y-3">
      {values.map((item) => (
        <div key={item.label}>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-primary">{item.label}</span>
            <span className="shrink-0 tabular-nums text-[12px] text-secondary">{item.score}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.04]">
            <div className={`h-full rounded-full ${item.score >= 80 ? "bg-green-500/60" : item.score >= 60 ? "bg-amber-400/60" : "bg-red-400/60"}`} style={{ width: `${Math.max(6, item.score)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MissingSkillsList({ values, language }: { values: Array<{ label: string; count: number }>; language: "en" | "zh" }) {
  if (!values.length) return <p className="text-[13px] text-secondary/50">&mdash;</p>;
  const getSeverity = (count: number) => count >= 3 ? { label: language === "zh" ? "高" : "High", color: "text-red-600 bg-red-50/60" } : count >= 2 ? { label: language === "zh" ? "中" : "Med", color: "text-amber-600 bg-amber-50/60" } : { label: language === "zh" ? "低" : "Low", color: "text-secondary/60 bg-black/[0.03]" };
  return (
    <div className="space-y-2.5">
      {values.slice(0, 6).map((item) => {
        const sev = getSeverity(item.count);
        return (
          <div key={item.label} className="rounded-lg border border-black/[0.03] bg-[#FAFAFA] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-mono font-medium text-primary">{item.label}</span>
              <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${sev.color}`}>{sev.label}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-secondary/50">
              {language === "zh" ? `出现 ${item.count} 次${sev.label === "高" ? " · 建议优先补强" : ""}` : `Appears ${item.count}x${sev.label === "High" ? " · Prioritize" : ""}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function RegionList({ values, jobs, language }: { values: Array<{ label: string; count: number }>; jobs: JobRecord[]; language: "en" | "zh" }) {
  if (!values.length) return <p className="text-[13px] text-secondary/50">&mdash;</p>;
  const regionScores = new Map<string, { total: number; count: number }>();
  jobs.forEach((j) => { const r = getRegionLabel(j.location, language); const cur = regionScores.get(r) ?? { total: 0, count: 0 }; regionScores.set(r, { total: cur.total + j.match_score, count: cur.count + 1 }); });
  const maxCount = Math.max(...values.map((v) => v.count), 1);
  return (
    <div className="space-y-3">
      {values.map((item) => {
        const stats = regionScores.get(item.label);
        const avg = stats ? Math.round(stats.total / stats.count) : 0;
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="truncate font-medium text-primary">{item.label}</span>
              <span className="shrink-0 text-[12px] text-secondary">{item.count} {language === "zh" ? "个" : ""} · {language === "zh" ? "平均" : "avg"} {avg}%</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.04]">
              <div className="h-full rounded-full bg-accent/50" style={{ width: `${Math.max(6, Math.round((item.count / maxCount) * 100))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────── Analytics Engine ──────────── */

function buildAnalytics(jobs: JobRecord[], language: "en" | "zh") {
  const totalJobs = jobs.length;
  const statusCounts = APPLICATION_STATUSES.reduce((c, s) => { c[s] = jobs.filter((j) => j.application_status === s).length; return c; }, {} as Record<string, number>);
  const avg = totalJobs ? Math.round(jobs.reduce((sum, j) => sum + j.match_score, 0) / totalJobs) : 0;
  return {
    totalJobs, statusCounts, averageMatchScore: avg,
    highMatchJobs: jobs.filter((j) => j.match_score >= 80).length,
    highMatchUnapplied: jobs.filter((j) => j.match_score >= 80 && j.application_status === "Not Applied").length,
    recentJobsCount: jobs.filter((j) => Date.now() - new Date(j.created_at).getTime() < 7 * 86400000).length,
    jobsByRoleType: countValues(jobs.map((j) => language === "zh" ? j.job_type_zh : j.job_type_en)),
    averageMatchByRole: averageScoresByGroup(jobs, (j) => language === "zh" ? j.job_type_zh : j.job_type_en),
    topSkills: countValues(jobs.flatMap((j) => j.skills)).slice(0, 8),
    topMissingSkills: countValues(jobs.flatMap((j) => j.missing_skills)).slice(0, 8),
    topRequiredTools: countValues(jobs.flatMap((j) => j.important_tools)).slice(0, 8),
    regionBreakdown: countValues(jobs.map((j) => getRegionLabel(j.location, language))),
    highPriorityJobsList: [...jobs].filter(isHighPriority).sort((a, b) => b.match_score - a.match_score).slice(0, 6),
  };
}

type Analytics = ReturnType<typeof buildAnalytics>;

interface InsightItem { label: string; text: string; action: string; link?: string; linkLabel?: string; }

function buildInsights(a: Analytics, jobs: JobRecord[], t: Record<string, string>, language: "en" | "zh"): InsightItem[] {
  const items: InsightItem[] = [];
  const zh = language === "zh";

  if (a.highMatchUnapplied > 0) {
    items.push({
      label: zh ? "高优先级" : "High Priority",
      text: zh ? `你有 ${a.highMatchUnapplied} 个高匹配职位尚未申请` : `${a.highMatchUnapplied} high-match jobs not applied`,
      action: zh ? "今天优先完成简历调整并申请" : "Finish resume tweaks and apply today",
      link: "/workspace", linkLabel: zh ? "查看职位" : "View jobs"
    });
  } else if (a.highMatchJobs > 0) {
    items.push({
      label: zh ? "全部已跟进" : "All Followed",
      text: zh ? "所有高匹配职位已完成申请或已标记" : "All high-match jobs applied or tagged",
      action: zh ? "继续保持筛选节奏" : "Keep screening pace"
    });
  }

  if (a.topMissingSkills.length > 0) {
    const top = a.topMissingSkills[0];
    items.push({
      label: zh ? "技能差距" : "Skill Gap",
      text: zh ? `${top.label} 出现在 ${top.count} 个目标职位中` : `${top.label} appears in ${top.count} target jobs`,
      action: zh ? "补充相关案例或简历关键词" : "Add related project or resume keyword",
    });
  }

  if (a.recentJobsCount > 0) {
    items.push({
      label: zh ? "节奏提醒" : "Pace",
      text: zh ? `过去 7 天新增 ${a.recentJobsCount} 个职位` : `${a.recentJobsCount} jobs added this week`,
      action: zh ? "保持筛选节奏，优先 85+ 匹配职位" : "Keep screening, prioritize 85+",
      link: "/workspace", linkLabel: zh ? "查看高匹配职位" : "View high-match"
    });
  } else {
    items.push({
      label: zh ? "节奏提醒" : "Pace",
      text: zh ? "过去 7 天没有新增职位" : "No new jobs in 7 days",
      action: zh ? "刷新求职渠道，扩大筛选范围" : "Refresh search channels"
    });
  }

  return items.slice(0, 3);
}

/* ──────────── Helpers ──────────── */

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  values.map((v) => v.trim()).filter(Boolean).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
function averageScoresByGroup(jobs: JobRecord[], getGroup: (j: JobRecord) => string) {
  const groups = new Map<string, { total: number; count: number }>();
  jobs.forEach((j) => { const l = (getGroup(j).trim() || "Not specified"); const c = groups.get(l) ?? { total: 0, count: 0 }; groups.set(l, { total: c.total + j.match_score, count: c.count + 1 }); });
  return Array.from(groups, ([label, v]) => ({ label, score: Math.round(v.total / v.count), count: v.count })).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}
function getRegionLabel(location: string, language: "en" | "zh") {
  const n = location.toLowerCase();
  if (n.includes("australia") || n.includes("sydney") || n.includes("melbourne") || n.includes("brisbane") || n.includes("perth")) return language === "zh" ? "澳大利亚" : "Australia";
  if (n.includes("singapore")) return language === "zh" ? "新加坡" : "Singapore";
  if (n.includes("china") || n.includes("shanghai") || n.includes("beijing") || n.includes("shenzhen") || n.includes("guangzhou")) return language === "zh" ? "中国" : "China";
  return language === "zh" ? "其他" : "Other";
}
function isHighPriority(job: JobRecord) { return job.match_score >= 80 || job.recommended_next_action.urgency === "High" || job.recommended_next_action.action === "Apply now"; }
