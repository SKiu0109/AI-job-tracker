"use client";

import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/app-card";
import { JobRecord } from "@/types/job";
import { localizeDisplayValue, formatDateTime } from "@/lib/jobs/job-detail-utils";
import { SectionHeading, InsightStat } from "@/components/jobs/ui/detail-widgets";
import { TextCard, PanelBox } from "@/components/jobs/ui/report-components";

export function TrackingTab({
  job,
  language,
  locale,
  t,
  timelineStatuses
}: {
  job: JobRecord;
  language: "en" | "zh";
  locale: string;
  t: Record<string, string>;
  timelineStatuses: Record<string, string>;
}) {
  return (
    <>
      <ApplicationProgressPanel
        job={job}
        language={language}
        locale={locale}
        t={t}
        timelineStatuses={timelineStatuses}
      />

      <AppCard className="p-5 sm:p-6">
        <SectionHeading title={t.applicationDetails} />
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <PanelBox label={t.applicationChannel} value={job.application_channel ? localizeDisplayValue(job.application_channel, language) : t.notProvided} />
          <PanelBox label={t.contactPerson} value={job.contact_person || t.notProvided} />
          <PanelBox label={t.interviewDate} value={formatDateTime(job.interview_date, locale, t.notProvided)} />
          <PanelBox label={t.sourceUrl} value={job.source_url || t.notProvided} />
        </dl>
        {job.source_url ? (
          <a
            className="mt-4 block break-all text-sm font-medium text-app-accent hover:underline"
            href={job.source_url}
            rel="noreferrer"
            target="_blank"
          >
            {job.source_url}
          </a>
        ) : null}
      </AppCard>

      <AppCard className="p-5 sm:p-6">
        <SectionHeading title={t.statusTimeline} />
        {job.status_history.length ? (
          <ol className="relative mt-5 ml-5 border-l-2 border-app-border-soft pl-6 space-y-6">
            {job.status_history.map((item, index) => (
              <li className="relative" key={item.id}>
                <span
                  className={cn(
                    "absolute -left-[29px] mt-1 h-3 w-3 rounded-full border-2 ring-4 ring-app-border-soft",
                    index === 0
                      ? "border-app-accent bg-app-accent-soft"
                      : "border-app-border-soft bg-app-surface"
                  )}
                />
                <p className="text-sm font-semibold text-app-text-primary">
                  {timelineStatuses[item.status]}
                </p>
                <p className="mt-0.5 text-xs text-app-text-tertiary">
                  {formatDateTime(item.created_at, locale, item.created_at)}
                </p>
                {item.note ? (
                  <p className="mt-2 text-sm leading-6 text-app-text-secondary">
                    {localizeDisplayValue(item.note, language)}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 text-sm text-app-text-secondary">{t.notProvided}</p>
        )}
      </AppCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <TextCard title={t.notes} value={job.notes ? localizeDisplayValue(job.notes, language) : t.notProvided} />
        <TextCard title={t.followUpNotes} value={job.follow_up_notes ? localizeDisplayValue(job.follow_up_notes, language) : t.notProvided} />
      </div>
    </>
  );
}

export function ApplicationProgressPanel({
  job,
  language,
  locale,
  t,
  timelineStatuses
}: {
  job: JobRecord;
  language: "en" | "zh";
  locale: string;
  t: Record<string, string>;
  timelineStatuses: Record<string, string>;
}) {
  const milestones = getApplicationMilestones(job, language, locale, t, timelineStatuses);
  const completeCount = milestones.filter((item) => item.complete).length;

  return (
    <AppCard className="overflow-hidden p-0" variant="elevated">
      <div className="border-b border-app-border-soft bg-app-surface px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <SectionHeading
            subtitle={language === "zh" ? "把申请从保存职位推进到投递、面试和跟进。" : "Move the role from saved to submitted, interview, and follow-up."}
            title={language === "zh" ? "申请进度" : "Application progress"}
          />
          <InsightStat
            label={language === "zh" ? "已完成节点" : "Milestones done"}
            tone={completeCount >= 3 ? "success" : "warning"}
            value={`${completeCount}/${milestones.length}`}
          />
        </div>
      </div>
      <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
        {milestones.map((item, index) => (
          <div
            className={cn(
              "relative border-app-border-soft p-4 sm:p-5",
              index > 0 ? "border-t md:border-t-0 md:border-l" : "",
              index === 2 ? "md:border-l-0 md:border-t xl:border-l xl:border-t-0" : "",
              index === 3 ? "md:border-t xl:border-t-0" : ""
            )}
            key={item.title}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[12px] font-semibold shadow-app-card",
                  item.complete
                    ? "border-app-success-border bg-app-success-soft text-app-success"
                    : "border-app-warning-border bg-app-warning-soft text-app-warning"
                )}
              >
                {item.complete ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-app-text-primary">
                  {item.title}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-app-text-secondary">
                  {item.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppCard>
  );
}
function getApplicationMilestones(
  job: JobRecord,
  language: "en" | "zh",
  locale: string,
  t: Record<string, string>,
  timelineStatuses: Record<string, string>
) {
  const latestStatus = timelineStatuses[job.application_status] ?? job.application_status;
  const addedAt = job.status_history.find((item) => item.status === "Job added")?.created_at || job.created_at;
  const resumeReady = job.tailoring_status === "draft_ready" || job.tailoring_status === "reviewed";
  const applied = job.application_status !== "Not Applied";
  const followUpReady = Boolean(job.interview_date || job.follow_up_date || job.application_status === "Interview" || job.application_status === "Offer");

  return [
    {
      body: formatDateTime(addedAt, locale, addedAt),
      complete: true,
      title: language === "zh" ? "职位已保存" : "Role saved"
    },
    {
      body: getTailoringStatusLabel(job.tailoring_status, language),
      complete: resumeReady,
      title: language === "zh" ? "简历素材" : "Resume materials"
    },
    {
      body: latestStatus,
      complete: applied,
      title: language === "zh" ? "申请状态" : "Application status"
    },
    {
      body:
        job.interview_date
          ? formatDateTime(job.interview_date, locale, job.interview_date)
          : job.follow_up_date
            ? formatDateTime(job.follow_up_date, locale, job.follow_up_date)
            : t.notProvided,
      complete: followUpReady,
      title: language === "zh" ? "面试 / 跟进" : "Interview / follow-up"
    }
  ];
}

function getTailoringStatusLabel(status: string, language: "en" | "zh") {
  const labels: Record<string, { en: string; zh: string }> = {
    draft_ready: { en: "Draft ready", zh: "草稿已准备" },
    not_started: { en: "Not started", zh: "未开始" },
    reviewed: { en: "Reviewed", zh: "已复核" }
  };
  const label = labels[status] ?? labels.not_started;
  return language === "zh" ? label.zh : label.en;
}
