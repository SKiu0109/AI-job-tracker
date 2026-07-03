import type { ActionStage, JobRecord } from "@/types/job";

type Language = "en" | "zh";

export type UserFacingNextStep = {
  body: string;
  label: string;
  stage: ActionStage;
};

export function getUserFacingNextStep(
  job: JobRecord,
  language: Language
): UserFacingNextStep {
  const stage = getSafeActionStage(job.action_stage);

  if (job.application_status === "Rejected") {
    return getClosedStep(language, stage);
  }

  if (job.application_status === "Offer") {
    return getOfferStep(language, stage);
  }

  if (job.application_status === "Interview") {
    return getInterviewStep(job, language, stage);
  }

  if (job.application_status === "Applied") {
    return getAppliedStep(job, language, stage);
  }

  const savedNote = getUsefulSavedNote(job, language);

  if (savedNote) {
    return {
      body: savedNote,
      label: getStageLabel(stage, language),
      stage
    };
  }

  return getNotAppliedStep(job, language, stage);
}

export function getUserFacingNextStepText(
  job: JobRecord,
  language: Language
) {
  return getUserFacingNextStep(job, language).body;
}

export function getUserFacingNextStepLabel(
  job: JobRecord,
  language: Language
) {
  return getUserFacingNextStep(job, language).label;
}

export function getStageLabel(stage: ActionStage, language: Language) {
  const labels: Record<ActionStage, Record<Language, string>> = {
    follow_up: {
      en: "Follow up",
      zh: "跟进"
    },
    needs_review: {
      en: "Review fit",
      zh: "判断机会"
    },
    parked: {
      en: "Parked",
      zh: "暂存"
    },
    ready_to_apply: {
      en: "Ready to apply",
      zh: "准备申请"
    },
    tailor_resume: {
      en: "Tailor resume",
      zh: "定制简历"
    }
  };

  return labels[stage][language];
}

function getClosedStep(language: Language, stage: ActionStage) {
  return {
    body:
      language === "zh"
        ? "这个机会已结束。保留记录即可，后续可复盘原因或对比类似岗位。"
        : "This role is closed out. Keep the record for later review or comparison with similar roles.",
    label: getStageLabel(stage, language),
    stage
  };
}

function getOfferStep(language: Language, stage: ActionStage) {
  return {
    body:
      language === "zh"
        ? "已进入 offer 阶段。下一步对比薪资、签证、地点和截止回复时间。"
        : "This is in offer territory. Compare compensation, work rights, location, and response timing next.",
    label: language === "zh" ? "处理 Offer" : "Review offer",
    stage
  };
}

function getInterviewStep(
  job: JobRecord,
  language: Language,
  stage: ActionStage
) {
  const date = job.interview_date || job.follow_up_date;

  return {
    body:
      language === "zh"
        ? date
          ? `准备面试材料，并在 ${date.slice(0, 10)} 前确认面试重点和 STAR 案例。`
          : "准备面试材料：整理项目证据、岗位动机和可能被追问的风险点。"
        : date
          ? `Prepare interview notes and confirm STAR evidence before ${date.slice(0, 10)}.`
          : "Prepare interview notes: project evidence, role motivation, and likely risk follow-ups.",
    label: language === "zh" ? "准备面试" : "Prepare interview",
    stage
  };
}

function getAppliedStep(
  job: JobRecord,
  language: Language,
  stage: ActionStage
) {
  return {
    body:
      language === "zh"
        ? job.follow_up_date
          ? `已投递。等待反馈，并在 ${job.follow_up_date} 前后跟进一次。`
          : "已投递。记录渠道和联系人，并设置 5 天后的跟进提醒。"
        : job.follow_up_date
          ? `Application sent. Wait for a response and follow up around ${job.follow_up_date}.`
          : "Application sent. Record the channel and set a follow-up reminder for about five days out.",
    label: language === "zh" ? "等待 / 跟进" : "Wait / follow up",
    stage
  };
}

function getNotAppliedStep(
  job: JobRecord,
  language: Language,
  stage: ActionStage
) {
  if (stage === "ready_to_apply") {
    return {
      body:
        language === "zh"
          ? "匹配度较高。先完成简历关键词和申请材料检查，然后投递。"
          : "Fit looks strong. Finish the resume keyword and application-material check, then apply.",
      label: getStageLabel(stage, language),
      stage
    };
  }

  if (stage === "tailor_resume") {
    return {
      body:
        language === "zh"
          ? "先定制简历摘要和 2-3 条项目要点，再决定是否投递。"
          : "Tailor the resume summary and 2-3 project bullets before deciding whether to apply.",
      label: getStageLabel(stage, language),
      stage
    };
  }

  if (stage === "parked") {
    return {
      body:
        language === "zh"
          ? "暂存为低优先级。除非截止日期、匹配度或岗位信息变化，否则先处理更高优先级机会。"
          : "Keep this parked unless timing, fit, or role details change. Prioritize stronger opportunities first.",
      label: getStageLabel(stage, language),
      stage
    };
  }

  return {
    body:
      language === "zh"
        ? "先查看匹配证据和主要风险，再决定是否值得投入申请时间。"
        : "Review the fit evidence and main risks before deciding whether this deserves application time.",
    label: getStageLabel(stage, language),
    stage
  };
}

function getUsefulSavedNote(job: JobRecord, language: Language) {
  const note = job.next_step_note?.trim();

  if (!note) {
    return "";
  }

  if (language === "zh" && !containsCjk(note)) {
    return "";
  }

  return note;
}

function getSafeActionStage(stage: unknown): ActionStage {
  return stage === "follow_up" ||
    stage === "needs_review" ||
    stage === "parked" ||
    stage === "ready_to_apply" ||
    stage === "tailor_resume"
    ? stage
    : "needs_review";
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}
