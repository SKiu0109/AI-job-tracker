"use client";

import { AppCard } from "@/components/ui/app-card";
import { JobRecord } from "@/types/job";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  localizedArray,
  localizedText,
  localizeDisplayValue,
  formatOptionalDate,
  getReportSummary,
  getFirstUseful,
  getScoreTone,
  getActionStageToneName,
  getActionStageLabel,
} from "@/lib/jobs/job-detail-utils";
import { SectionHeading, InsightStat, SignalBrief } from "@/components/jobs/ui/detail-widgets";
import { ReportListCard, TextCard } from "@/components/jobs/ui/report-components";

export function OverviewTab({
  copy,
  job,
  language,
  t
}: {
  copy: DetailCopy;
  job: JobRecord;
  language: "en" | "zh";
  t: Record<string, string>;
}) {
  return (
    <>
      <OverviewDecisionBoard
        copy={copy}
        job={job}
        language={language}
        t={t}
      />

      <AppCard className="p-5 sm:p-6">
        <SectionHeading subtitle={copy.overviewSubtitle} title={copy.overviewTitle} />
        <p className="mt-4 text-[14px] leading-7 text-app-text-secondary">
          {getReportSummary(job, language)}
        </p>
      </AppCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReportListCard
          icon="spark"
          title={copy.yourAdvantages}
          values={localizedArray(job.key_strengths_en, job.key_strengths_zh, language)}
        />
        <ReportListCard
          icon="target"
          title={copy.areasToImprove}
          values={localizedArray(job.main_gaps_en, job.main_gaps_zh, language)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReportListCard
          title={t.responsibilities}
          values={localizedArray(job.responsibilities_en, job.responsibilities_zh, language)}
        />
        <ReportListCard
          title={t.requirements}
          values={localizedArray(job.requirements_en, job.requirements_zh, language)}
        />
        <ReportListCard
          title={t.redFlags}
          values={localizedArray(job.red_flags_en, job.red_flags_zh, language)}
        />
        <ReportListCard
          title={t.positiveSignals}
          values={localizedArray(job.positive_signals_en, job.positive_signals_zh, language)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TextCard title={t.education} value={localizedText(job.education_requirement_en, job.education_requirement_zh, language)} />
        <TextCard title={t.experience} value={localizedText(job.experience_requirement_en, job.experience_requirement_zh, language)} />
      </div>
    </>
  );
}

export function OverviewDecisionBoard({
  copy,
  job,
  language,
  t
}: {
  copy: DetailCopy;
  job: JobRecord;
  language: "en" | "zh";
  t: Record<string, string>;
}) {
  const locale = language === "zh" ? "zh-CN" : "en-AU";
  const strengths = localizedArray(
    job.key_strengths_en,
    job.key_strengths_zh,
    language
  );
  const risks = [
    ...localizedArray(job.main_gaps_en, job.main_gaps_zh, language),
    ...localizedArray(job.red_flags_en, job.red_flags_zh, language)
  ];

  return (
    <AppCard className="overflow-hidden p-0" variant="elevated">
      <div className="border-b border-app-border-soft bg-app-surface px-5 py-5 sm:px-6">
        <div className="grid gap-4">
          <SectionHeading
            subtitle={copy.overviewDecisionSubtitle}
            title={copy.overviewDecisionTitle}
          />
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InsightStat
              label={copy.match}
              tone={getScoreTone(job.match_score)}
              value={`${job.match_score}/100`}
            />
            <InsightStat
              label={copy.decisionStage}
              tone={getActionStageToneName(job.action_stage)}
              value={getActionStageLabel(job.action_stage, language)}
            />
            <InsightStat
              label={t.deadline}
              tone={job.application_deadline ? "warning" : "neutral"}
              value={formatOptionalDate(job.application_deadline, locale, t.noDeadline)}
            />
            <InsightStat
              label={t.applicationChannel}
              tone={job.application_channel ? "success" : "warning"}
              value={job.application_channel ? localizeDisplayValue(job.application_channel, language) : t.notProvided}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 sm:p-6">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-app-text-tertiary">
            {copy.decisionRationale}
          </p>
          <p className="mt-2 text-[15px] leading-7 text-app-text-primary">
            {getReportSummary(job, language)}
          </p>
        </div>
        <aside className="border-t border-app-border-soft bg-app-surface p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="grid gap-3">
            <SignalBrief
              label={copy.topEvidence}
              tone="success"
              value={getFirstUseful(strengths, copy.noSignalYet)}
            />
            <SignalBrief
              label={copy.mainRisk}
              tone="warning"
              value={getFirstUseful(risks, copy.noSignalYet)}
            />
          </div>
        </aside>
      </div>
    </AppCard>
  );
}
