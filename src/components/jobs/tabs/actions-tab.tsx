"use client";

import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { JobRecord, PriorityLevel } from "@/types/job";
import { UserFacingNextStep } from "@/lib/jobs/user-facing-next-step";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  localizeDisplayValue,
  getReportSummary,
  getActionStageTone,
  getActionStageLabel,
  localizedArray,
  formatOptionalDate,
} from "@/lib/jobs/job-detail-utils";
import { SectionHeading } from "@/components/jobs/ui/detail-widgets";
import { ReportListCard, PanelBox } from "@/components/jobs/ui/report-components";

export function ActionsTab({
  copy,
  job,
  language,
  nextStep,
  priorities,
  t
}: {
  copy: DetailCopy;
  job: JobRecord;
  language: "en" | "zh";
  nextStep: UserFacingNextStep;
  priorities: Record<PriorityLevel, string>;
  t: Record<string, string>;
}) {
  const actionCards = getActionPlanCards(
    job,
    language,
    copy,
    t,
    priorities,
    nextStep
  );

  return (
    <div className="grid gap-5">
      <ActionCommandCenter
        copy={copy}
        job={job}
        language={language}
        nextStep={nextStep}
        priorityLabel={priorities[job.recommended_next_action.urgency]}
        t={t}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {actionCards.map((action, index) => (
          <ActionPlanCard
            action={action}
            index={index}
            key={action.title}
          />
        ))}
      </div>

      <ReportListCard
        icon="resume"
        title={t.resumeFocusPoints}
        values={job.recommended_next_action.resume_focus_points.map((item) =>
          localizeDisplayValue(item, language)
        )}
      />
    </div>
  );
}

export function ActionCommandCenter({
  copy,
  job,
  language,
  nextStep,
  priorityLabel,
  t
}: {
  copy: DetailCopy;
  job: JobRecord;
  language: "en" | "zh";
  nextStep: UserFacingNextStep;
  priorityLabel: string;
  t: Record<string, string>;
}) {
  const decisionReason = nextStep.body;
  const stageTone = getActionStageTone(job.action_stage);
  const stageLabel = getActionStageLabel(job.action_stage, language);

  return (
    <AppCard className="overflow-hidden p-0" variant="elevated">
      <div className="border-b border-app-border-soft bg-app-surface px-5 py-5 sm:px-6">
        <SectionHeading
          subtitle={copy.actionCommandSubtitle}
          title={copy.actionCommandTitle}
        />
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={stageTone}>{stageLabel}</Badge>
            <Badge>{priorityLabel}</Badge>
          </div>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-app-text-tertiary">
            {copy.actionPrimary}
          </p>
          <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-app-text-primary">
            {nextStep.label}
          </h3>
          <p className="mt-3 text-[14px] leading-7 text-app-text-secondary">
            {decisionReason || getReportSummary(job, language)}
          </p>
        </div>
        <aside className="border-t border-app-border-soft bg-app-surface p-5 sm:p-6 lg:border-l lg:border-t-0">
          <dl className="grid gap-3">
            <PanelBox
              label={copy.actionDeadline}
              value={localizeDisplayValue(job.recommended_next_action.suggested_deadline, language)}
            />
            <PanelBox
              label={t.status}
              value={stageLabel}
            />
          </dl>
          {job.application_deadline ? (
            <div className="mt-3 rounded-lg border border-app-warning-border bg-app-warning-soft px-3 py-2 text-[12px] font-medium text-app-warning shadow-app-card">
              {language === "zh" ? "⏰ 截止日期：" : "⏰ Deadline: "}
              {formatOptionalDate(job.application_deadline, language === "zh" ? "zh-CN" : "en-AU", t.noDeadline)}
            </div>
          ) : null}
        </aside>
      </div>
    </AppCard>
  );
}

export function ActionPlanCard({
  action,
  index
}: {
  action: {
    body: string;
    label: string;
    title: string;
    tone: "accent" | "success" | "warning";
    cta?: { label: string; tab: string };
  };
  index: number;
}) {
  const handleClick = () => {
    if (action.cta) {
      const params = new URLSearchParams(window.location.search);
      params.set("tab", action.cta.tab);
      window.history.replaceState(null, "", `?${params.toString()}`);
      window.dispatchEvent(new CustomEvent("tab-change", { detail: { tab: action.cta.tab } }));
    }
  };

  return (
    <AppCard className="flex flex-col p-4" variant="interactive">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold shadow-app-card",
            action.tone === "success"
              ? "border border-app-success-border bg-app-success-soft text-app-success"
              : action.tone === "warning"
                ? "border border-app-warning-border bg-app-warning-soft text-app-warning"
                : "border border-app-info-border bg-app-info-soft text-app-info"
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-app-text-primary">
              {action.title}
            </p>
            <Badge>{action.label}</Badge>
          </div>
          <p className="mt-2 text-[13px] leading-6 text-app-text-secondary">
            {action.body}
          </p>
        </div>
      </div>
      {action.cta ? (
        <div className="mt-3 border-t border-app-border-soft pt-3">
          <button
            className="rounded-full bg-app-accent px-3 py-1.5 text-[12px] font-semibold text-white shadow-app-card transition-colors hover:bg-app-accent-hover"
            onClick={handleClick}
            type="button"
          >
            {action.cta.label}
          </button>
        </div>
      ) : null}
    </AppCard>
  );
}
export function getActionPlanCards(
  job: JobRecord,
  language: "en" | "zh",
  copy: DetailCopy,
  t: Record<string, string>,
  priorities: Record<PriorityLevel, string>,
  nextStep: UserFacingNextStep
) {
  const resumeAdvice = localizedArray(
    job.resume_tailoring_advice_en,
    job.resume_tailoring_advice_zh,
    language
  );
  const learningActions = localizedArray(
    job.suggested_learning_actions_en,
    job.suggested_learning_actions_zh,
    language
  );
  return [
    {
      body: resumeAdvice[0] ?? copy.noActionDetail,
      label: priorities[job.recommended_next_action.urgency],
      title: copy.actionStepResume,
      tone: "accent" as const,
      cta: { label: language === "zh" ? "定制简历" : "Tailor resume", tab: "resume" }
    },
    {
      body: learningActions[0] ?? copy.noActionDetail,
      label: t.skillGapAnalysis,
      title: copy.actionStepSkill,
      tone: "warning" as const,
      cta: { label: language === "zh" ? "查看技能缺口" : "View skill gaps", tab: "skills" }
    },
    {
      body: nextStep.body || copy.noActionDetail,
      label: nextStep.label,
      title: copy.actionStepFollowUp,
      tone: job.action_stage === "ready_to_apply" ? "success" as const : "accent" as const,
      cta: { label: language === "zh" ? "更新申请状态" : "Update status", tab: "tracking" }
    }
  ];
}
