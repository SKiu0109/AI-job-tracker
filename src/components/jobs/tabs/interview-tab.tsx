"use client";

import { cn } from "@/lib/utils";
import { AppCard } from "@/components/ui/app-card";
import { JobRecord } from "@/types/job";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  getFirstUseful,
  getReportSummary,
  isUsefulValue,
  localizedArray,
  uniqueStrings,
} from "@/lib/jobs/job-detail-utils";
import { SectionHeading } from "@/components/jobs/ui/detail-widgets";
import { ReportListCard, TextCard } from "@/components/jobs/ui/report-components";

export function InterviewTab({
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
  const prepItems = getInterviewPrepItems(job, language, copy);

  return (
    <>
      <InterviewPrepBoard
        copy={copy}
        items={prepItems}
        language={language}
      />

      <ReportListCard
        icon="chat"
        title={copy.interviewFocus}
        values={[
          ...localizedArray(job.key_strengths_en, job.key_strengths_zh, language).slice(0, 3),
          ...localizedArray(job.main_gaps_en, job.main_gaps_zh, language).slice(0, 3)
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportListCard
          title={t.skillsToImprove}
          values={localizedArray(job.skills_to_improve_en, job.skills_to_improve_zh, language)}
        />
        <ReportListCard
          title={t.suggestedLearningActions}
          values={localizedArray(job.suggested_learning_actions_en, job.suggested_learning_actions_zh, language)}
        />
      </div>

      <AppCard className="p-5 sm:p-6">
        <SectionHeading
          subtitle={language === "zh" ? "根据岗位要求生成的潜在面试问题，用于模拟练习。" : "Potential interview questions based on job requirements for practice."}
          title={language === "zh" ? "常见面试问题" : "Common interview questions"}
        />
        <div className="mt-4 grid gap-3">
          {getInterviewQuestions(job, language).map((q, idx) => (
            <details className="group rounded-lg border border-app-border-soft bg-app-surface shadow-app-card backdrop-blur-xl" key={idx}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-app-surface-hover focus:outline-none focus-visible:bg-app-surface-hover focus-visible:shadow-app-focus">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-app-text-primary">{q.question}</p>
                  <p className="mt-1 text-[11px] text-app-text-tertiary">{q.category}</p>
                </div>
                <span className="mt-0.5 shrink-0 text-[14px] text-app-text-tertiary transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="border-t border-app-border-soft px-4 py-3">
                <p className="text-[12px] font-semibold text-app-accent">
                  {language === "zh" ? "回答提示" : "Answer tip"}
                </p>
                <p className="mt-1 text-[13px] leading-6 text-app-text-secondary">{q.tip}</p>
              </div>
            </details>
          ))}
        </div>
      </AppCard>

      <TextCard
        title={copy.interviewNoteTitle}
        value={copy.interviewNoteBody}
      />
    </>
  );
}

export function InterviewPrepBoard({
  copy,
  items,
  language
}: {
  copy: DetailCopy;
  items: Array<{
    detailItems: string[];
    label: string;
    summary: string;
    title: string;
    tone: "accent" | "success" | "warning";
  }>;
  language: "en" | "zh";
}) {
  return (
    <AppCard className="overflow-hidden p-0" variant="elevated">
      <div className="border-b border-app-border-soft bg-app-surface px-5 py-5 sm:px-6">
        <SectionHeading
          subtitle={copy.interviewBoardSubtitle}
          title={copy.interviewBoardTitle}
        />
      </div>
      <div className="space-y-0">
        {items.map((item) => (
          <details className="group border-b border-app-border-soft last:border-b-0" key={item.title}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5 transition-colors hover:bg-app-surface-hover focus:outline-none focus-visible:bg-app-surface-hover focus-visible:shadow-app-focus sm:p-6">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                  {item.label}
                </p>
                <h3 className="mt-1 text-[16px] font-semibold text-app-text-primary">
                  {item.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-app-text-secondary">
                  {item.summary}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    item.tone === "success"
                      ? "bg-app-success"
                      : item.tone === "warning"
                        ? "bg-app-warning"
                        : "bg-app-accent"
                  )}
                />
                <span className="text-[14px] text-app-text-tertiary transition-transform group-open:rotate-180">▾</span>
              </div>
            </summary>
            <div className="border-t border-app-border-soft bg-app-surface px-5 pb-5 sm:px-6 sm:pb-6">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-app-text-tertiary">
                {language === "zh" ? "准备要点" : "Prep points"}
              </p>
              <ul className="mt-3 grid gap-2">
                {item.detailItems.map((detail) => (
                  <li className="flex gap-2 text-[13px] leading-6 text-app-text-secondary" key={detail}>
                    <span
                      className={cn(
                        "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                        item.tone === "success"
                          ? "bg-app-success"
                          : item.tone === "warning"
                            ? "bg-app-warning"
                            : "bg-app-accent"
                      )}
                    />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </AppCard>
  );
}
function getInterviewPrepItems(
  job: JobRecord,
  language: "en" | "zh",
  copy: DetailCopy
) {
  const strengths = localizedArray(job.key_strengths_en, job.key_strengths_zh, language);
  const gaps = [
    ...localizedArray(job.main_gaps_en, job.main_gaps_zh, language),
    ...localizedArray(job.red_flags_en, job.red_flags_zh, language)
  ];
  const requirements = localizedArray(job.requirements_en, job.requirements_zh, language);
  const responsibilities = localizedArray(job.responsibilities_en, job.responsibilities_zh, language);
  const positiveSignals = localizedArray(job.positive_signals_en, job.positive_signals_zh, language);
  const missingInfo = localizedArray(job.missing_information_en, job.missing_information_zh, language);
  const reportSummary = getReportSummary(job, language);
  const proofSummary = getFirstUseful(strengths, reportSummary);
  const riskSummary = getFirstUseful(gaps, copy.noSignalYet);
  const storySummary = getFirstUseful(requirements, copy.interviewStoryFallback);
  const questionSummary = getFirstUseful([...missingInfo, ...positiveSignals], copy.interviewQuestionFallback);

  return [
    {
      detailItems: buildInterviewDetailItems(
        proofSummary,
        [...strengths, ...positiveSignals, reportSummary],
        language === "zh"
          ? "把这条信号改写成 30 秒开场：背景、你的动作、结果各一句。"
          : "Turn this signal into a 30-second opener: context, your action, and result."
      ),
      label: copy.interviewProofLabel,
      summary: proofSummary,
      title: copy.interviewProofTitle,
      tone: "success" as const
    },
    {
      detailItems: buildInterviewDetailItems(
        riskSummary,
        [...gaps, ...missingInfo],
        language === "zh"
          ? "准备一个诚实补强说法：当前差距、正在补的动作、预计如何快速上手。"
          : "Prepare an honest gap answer: current gap, active learning, and ramp-up plan."
      ),
      label: copy.interviewRiskLabel,
      summary: riskSummary,
      title: copy.interviewRiskTitle,
      tone: "warning" as const
    },
    {
      detailItems: buildInterviewDetailItems(
        storySummary,
        [...requirements, ...responsibilities],
        language === "zh"
          ? "选一个最相关经历，按 STAR 拆成情境、任务、行动、结果，不要只复述 JD。"
          : "Choose one relevant experience and structure it as situation, task, action, and result."
      ),
      label: copy.interviewStoryLabel,
      summary: storySummary,
      title: copy.interviewStoryTitle,
      tone: "accent" as const
    },
    {
      detailItems: buildInterviewDetailItems(
        questionSummary,
        [...missingInfo, ...positiveSignals],
        language === "zh"
          ? "优先问成功标准、团队协作方式和前 90 天最重要的产出。"
          : "Prioritize success criteria, team collaboration, and the most important first-90-day output."
      ),
      label: copy.interviewQuestionLabel,
      summary: questionSummary,
      title: copy.interviewQuestionTitle,
      tone: "accent" as const
    }
  ];
}

function buildInterviewDetailItems(summary: string, values: string[], fallback: string) {
  const details = uniqueStrings(values.filter(isUsefulValue))
    .filter((value) => value !== summary)
    .slice(0, 3);

  if (details.length) return details;
  return [fallback];
}

function getInterviewQuestions(job: JobRecord, language: "en" | "zh") {
  const strengths = localizedArray(job.key_strengths_en, job.key_strengths_zh, language);
  const gaps = localizedArray(job.main_gaps_en, job.main_gaps_zh, language);
  const requirements = localizedArray(job.requirements_en, job.requirements_zh, language);

  const questions: Array<{ question: string; category: string; tip: string }> = [];

  if (strengths[0]) {
    questions.push({
      question: language === "zh"
        ? `请分享一个体现你"${strengths[0].slice(0, 20)}"能力的实际案例。`
        : `Share a real example that demonstrates your "${strengths[0].slice(0, 30)}" ability.`,
      category: language === "zh" ? "行为面试" : "Behavioral",
      tip: language === "zh"
        ? "使用 STAR 法则：情境 → 任务 → 行动 → 结果。用量化数据支撑你的回答。"
        : "Use STAR method: Situation → Task → Action → Result. Back it up with metrics."
    });
  }

  if (gaps[0]) {
    questions.push({
      question: language === "zh"
        ? `JD 中提到了"${gaps[0].slice(0, 20)}"，你在这方面有什么经验或学习计划？`
        : `The JD mentions "${gaps[0].slice(0, 30)}" — what experience or learning plan do you have?`,
      category: language === "zh" ? "技能差距" : "Skill gap",
      tip: language === "zh"
        ? "诚实承认差距，展示你正在学习的行动和进度，表达快速上手的信心。"
        : "Acknowledge the gap honestly, show your learning progress, and express confidence in ramping up quickly."
    });
  }

  if (requirements[0]) {
    questions.push({
      question: language === "zh"
        ? `这个岗位要求"${requirements[0].slice(0, 20)}"，你如何证明自己符合这个要求？`
        : `This role requires "${requirements[0].slice(0, 30)}" — how would you prove you meet it?`,
      category: language === "zh" ? "岗位匹配" : "Role fit",
      tip: language === "zh"
        ? "把要求拆解成具体的能力点，逐一用过往经历证明。"
        : "Break down the requirement into concrete capabilities and prove each with past experience."
    });
  }

  questions.push({
    question: language === "zh"
      ? `你在前 90 天会如何规划工作重点，以最快创造价值？`
      : `How would you prioritize your first 90 days to create value quickly?`,
    category: language === "zh" ? "工作计划" : "Planning",
    tip: language === "zh"
      ? "分阶段回答：前30天了解团队和业务，30-60天建立流程，60-90天产出结果。"
      : "Phase your answer: first 30 days understand team & business, 30-60 days establish processes, 60-90 days deliver results."
  });

  return questions;
}
