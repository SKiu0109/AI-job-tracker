"use client";

import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircularScore } from "@/components/ui/circular-score";
import { JobRecord, PriorityLevel } from "@/types/job";
import { UserFacingNextStep } from "@/lib/jobs/user-facing-next-step";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  localizedArray,
  localizeDisplayValue,
  localizeKeyword,
  formatOptionalDate,
  formatWorkMode,
  getReportSummary,
  getFirstUseful,
  getScoreTone,
  getVerdict,
} from "@/lib/jobs/job-detail-utils";
import { PanelRow, ReportSignalPill } from "@/components/jobs/ui/report-components";

export default function DecisionBriefSection({
  copy,
  job,
  language,
  locale,
  nextStep,
  onOpenActions,
  onOpenResume,
  priorities,
  recommendationLabel,
  statusLabel,
  t,
  verdict
}: {
  copy: DetailCopy;
  job: JobRecord;
  language: "en" | "zh";
  locale: string;
  nextStep: UserFacingNextStep;
  onOpenActions: () => void;
  onOpenResume: () => void;
  priorities: Record<PriorityLevel, string>;
  recommendationLabel: string;
  statusLabel: string;
  t: Record<string, string>;
  verdict: ReturnType<typeof getVerdict>;
}) {
  const strengths = localizedArray(
    job.key_strengths_en,
    job.key_strengths_zh,
    language
  );
  const gaps = localizedArray(job.main_gaps_en, job.main_gaps_zh, language);
  const focusPoints = job.recommended_next_action.resume_focus_points.map((item) =>
    localizeDisplayValue(item, language)
  );
  const primaryFocus = getFirstUseful(focusPoints, copy.noSignalYet);
  const decisionReason = nextStep.body;
  const resumeIsPrimary =
    nextStep.stage === "tailor_resume" || nextStep.stage === "ready_to_apply";

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <AppCard className="overflow-hidden p-0" variant="elevated">
        <div className="border-b border-app-border-soft bg-app-surface px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                {copy.decisionBrief}
              </p>
              <h2 className={cn("mt-2 text-[24px] font-semibold tracking-tight", verdict.className)}>
                {verdict.label}
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-7 text-app-text-secondary">
                {decisionReason || getReportSummary(job, language)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-app-border-soft bg-app-surface px-4 py-3 shadow-app-card">
              <CircularScore
                label={copy.match}
                showMax
                size={88}
                strokeWidth={8}
                tone={getScoreTone(job.match_score)}
                value={job.match_score}
              />
              <div>
                <p className="text-[12px] font-semibold text-app-text-tertiary">
                  {recommendationLabel}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-app-text-primary">
                  {nextStep.label}
                </p>
                <p className="mt-1 text-[12px] text-app-text-secondary">
                  {priorities[job.recommended_next_action.urgency]}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
          <ReportSignalPill
            label={copy.strongestSignal}
            tone="success"
            value={getFirstUseful(strengths, copy.noSignalYet)}
          />
          <ReportSignalPill
            label={copy.watchOut}
            tone="warning"
            value={getFirstUseful(gaps, copy.noSignalYet)}
          />
          <ReportSignalPill
            label={copy.resumeFocus}
            tone="success"
            value={primaryFocus}
          />
        </div>

        <div className="border-t border-app-border-soft bg-app-surface px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] leading-5 text-app-text-secondary">
              {copy.decisionBriefHelper}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                className="min-h-9 px-3 text-[13px]"
                onClick={onOpenActions}
                variant={resumeIsPrimary ? "secondary" : "primary"}
              >
                {copy.viewActionPlan}
              </Button>
              <Button
                className="min-h-9 px-3 text-[13px]"
                onClick={onOpenResume}
                variant={resumeIsPrimary ? "primary" : "secondary"}
              >
                {copy.tailorResume}
              </Button>
            </div>
          </div>
        </div>
      </AppCard>

      <AppCard as="aside" className="p-5 sm:p-6" variant="elevated">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-app-text-tertiary">
          {copy.applicationSnapshot}
        </p>
        <h2 className="mt-2 text-[18px] font-semibold tracking-tight text-app-text-primary">
          {copy.currentState}
        </h2>
        <dl className="mt-4 space-y-3">
          <PanelRow label={t.status} value={statusLabel} />
          <PanelRow
            label={t.deadline}
            value={formatOptionalDate(job.application_deadline, locale, t.noDeadline)}
          />
          <PanelRow label={t.workMode} value={formatWorkMode(job.work_mode, language)} />
          <PanelRow
            label={t.createdDate}
            value={formatOptionalDate(job.created_at, locale, t.notProvided)}
          />
        </dl>
        {job.skills.length ? (
          <div className="mt-5 border-t border-app-border-soft pt-4">
            <p className="text-[12px] font-semibold text-app-text-secondary">
              {t.keySkills}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.skills.slice(0, 6).map((skill) => (
                <Badge key={skill}>{localizeKeyword(skill, language)}</Badge>
              ))}
            </div>
          </div>
        ) : null}
        {job.source_url ? (
          <a
            className="mt-5 inline-flex text-[12px] font-semibold text-app-accent hover:text-app-accent-hover"
            href={job.source_url}
            rel="noreferrer"
            target="_blank"
          >
            {t.sourceUrl}
          </a>
        ) : null}
      </AppCard>
    </section>
  );
}
