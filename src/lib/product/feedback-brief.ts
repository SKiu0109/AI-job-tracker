export const FEEDBACK_BRIEF_MAX_LENGTH = 2000;

export type FeedbackBriefInput = {
  areaLabel: string;
  email?: string;
  evidence: string;
  expectedChange: string;
  feedbackTypeLabel: string;
  goal: string;
  language: "en" | "zh";
  priorityLabel: string;
  rating: number;
  role: string;
};

export function buildFeedbackBrief(input: FeedbackBriefInput) {
  const labels = getBriefLabels(input.language);

  const lines = [
    labels.title,
    `${labels.language}: ${labels.languageValue}`,
    `${labels.area}: ${input.areaLabel}`,
    `${labels.issueType}: ${input.feedbackTypeLabel}`,
    `${labels.priority}: ${input.priorityLabel}`,
    `${labels.rating}: ${input.rating}/5`,
    `${labels.role}: ${optionalValue(input.role, labels.notProvided)}`,
    "",
    `${labels.goal}:`,
    input.goal.trim(),
    "",
    `${labels.evidence}:`,
    input.evidence.trim(),
    "",
    `${labels.expectedChange}:`,
    input.expectedChange.trim(),
    "",
    `${labels.contact}:`,
    optionalValue(input.email, labels.notProvided)
  ];

  return limitFeedbackBrief(lines.join("\n"));
}

function optionalValue(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function limitFeedbackBrief(value: string) {
  if (value.length <= FEEDBACK_BRIEF_MAX_LENGTH) {
    return value;
  }

  const suffix = "\n[Trimmed to fit feedback storage limit]";
  return `${value.slice(0, FEEDBACK_BRIEF_MAX_LENGTH - suffix.length).trim()}${suffix}`;
}

function getBriefLabels(language: "en" | "zh") {
  if (language === "zh") {
    return {
      area: "区域",
      contact: "后续联系",
      evidence: "观察到的问题或证据",
      expectedChange: "期望改法",
      goal: "用户目标",
      issueType: "问题类型",
      language: "页面语言",
      languageValue: "中文",
      notProvided: "未提供",
      priority: "优先级",
      rating: "当前有用程度",
      role: "用户背景",
      title: "# Offerwise 反馈优化摘要"
    };
  }

  return {
    area: "Area",
    contact: "Follow-up contact",
    evidence: "Observed issue or evidence",
    expectedChange: "Expected improvement",
    goal: "User goal",
    issueType: "Issue type",
    language: "Language",
    languageValue: "English",
    notProvided: "Not provided",
    priority: "Priority",
    rating: "Usefulness rating",
    role: "User background",
    title: "# Offerwise feedback brief"
  };
}
