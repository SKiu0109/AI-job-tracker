import { JobRecord, MatchScoreDimensionKey } from "@/types/job";

export function localizedText(en: string, zh: string, language: "en" | "zh") {
  if (language === "zh" && isUsefulValue(zh)) return zh;
  return en;
}

export function isUsefulValue(value: string | undefined) {
  return (
    Boolean(value?.trim()) &&
    value !== "Not specified" &&
    value !== "未指定" &&
    value !== "未注明"
  );
}

export function localizedArray(en: string[], zh: string[], language: "en" | "zh") {
  if (language === "zh" && zh.some(isUsefulValue)) return zh.filter(isUsefulValue);
  return en.filter(isUsefulValue);
}

export function getFirstUseful(values: string[], fallback: string) {
  return values.find(isUsefulValue) ?? fallback;
}

export function getReportSummary(job: JobRecord, language: "en" | "zh") {
  const summary = localizedText(job.ai_summary_en, job.ai_summary_zh, language);

  if (isUsefulValue(summary)) {
    return summary;
  }

  const action = localizedText(
    job.recommended_next_action.action,
    localizeAction(job.recommended_next_action.action),
    language
  );
  const reason = localizedText(
    job.recommended_next_action.reason_en,
    job.recommended_next_action.reason_zh,
    language
  );
  const strengths = localizedArray(job.key_strengths_en, job.key_strengths_zh, language);
  const gaps = localizedArray(job.main_gaps_en, job.main_gaps_zh, language);
  const firstStrength = strengths[0];
  const firstGap = gaps[0];

  if (language === "zh") {
    return [
      `匹配度 ${job.match_score}/100，建议「${action}」。`,
      reason ? `原因：${reason}` : "",
      firstStrength ? `主要优势：${firstStrength}` : "",
      firstGap ? `优先补强：${firstGap}` : ""
    ].filter(Boolean).join(" ");
  }

  return [
    `${job.match_score}/100 match with a recommended next step: ${action}.`,
    reason ? `Reason: ${reason}` : "",
    firstStrength ? `Main strength: ${firstStrength}` : "",
    firstGap ? `Priority gap: ${firstGap}` : ""
  ].filter(Boolean).join(" ");
}

export function localizeAction(action: string) {
  const labels: Record<string, string> = {
    "Apply now": "立即申请",
    "Improve skills before applying": "先补强技能再申请",
    "Save for later": "稍后保存",
    Skip: "跳过",
    "Tailor resume first": "先优化简历"
  };
  return labels[action] ?? action;
}

const displayTranslationsZh: Record<string, string> = {
  "Company website": "公司官网",
  "Within 3 days": "3 天内",
  "This week": "本周内",
  "Medium impact": "中等影响",
  "Low to medium impact": "低到中等影响",
  "JD asks for statistics, analytics, finance, economics, or related fields.":
    "JD 要求统计、分析、金融、经济或相关背景。",
  "JD mentions SQL, Python, Excel, dashboards, or reporting.":
    "JD 提到 SQL、Python、Excel、仪表盘或报告分析。",
  "JD expects communication with business stakeholders.":
    "JD 要求能与业务利益相关者沟通。",
  "JD uses junior, internship, associate, or 0-2 years language.":
    "JD 面向初级、实习、助理或 0-2 年经验候选人。",
  "Not specified": "未指定",
  Parked: "暂存",
  follow_up: "等待 / 跟进",
  needs_review: "待判断",
  parked: "暂存",
  ready_to_apply: "准备投递",
  tailor_resume: "先优化简历",
  "未注明": "未指定",
  documentation: "文档学习",
  project: "项目",
  "portfolio project": "作品集项目",
  "portfolio task": "作品集任务",
  "practice task": "练习任务",
  "short course": "短课程"
};

const keywordTranslationsZh: Record<string, string> = {
  "A/B testing": "A/B 测试",
  "CRM operations": "CRM 运营",
  "Business analysis": "商业分析",
  "Business Understanding": "业务理解",
  "Case interview framing": "案例面试框架",
  "Credit risk": "信用风险",
  "Data Analysis": "数据分析",
  "Data Governance": "数据治理",
  "Data Modeling": "数据建模",
  "Data Product Management": "数据产品管理",
  "Data Warehouse Concepts": "数据仓库概念",
  Dashboarding: "仪表盘搭建",
  BI: "商业智能（BI）",
  "AI Product Awareness": "AI 产品认知",
  "consulting research": "咨询研究",
  "customer analysis": "客户分析",
  dashboarding: "仪表盘搭建",
  "Experiment design": "实验设计",
  "Fraud operations": "反欺诈运营",
  "Market research": "市场研究",
  "Market sizing": "市场规模测算",
  "Operations analysis": "运营分析",
  "Payment products": "支付产品",
  "Payment reconciliation": "支付对账",
  Presentation: "演示汇报",
  "Problem Decomposition": "问题拆解",
  "Problem solving": "问题解决",
  "Process mapping": "流程梳理",
  "Product analytics": "产品分析",
  "Quantitative research": "定量研究",
  Reporting: "报告分析",
  "Requirements documentation": "需求文档",
  "Scorecard modelling": "评分卡建模",
  "Stakeholder communication": "利益相关者沟通",
  "Structured Communication": "结构化沟通",
  "Logical Thinking": "逻辑思维",
  Statistics: "统计学",
  statistics: "统计学",
  "User research": "用户研究",
  "understanding of LLM, Agent, knowledge engineering basic concepts and technical boundaries":
    "LLM、Agent 与知识工程基础理解",
  "ability to design gameplay based on AI capabilities and judge applicable scenarios":
    "基于 AI 能力设计玩法并判断适用场景",
  "design thinking for AI-driven content": "AI 驱动内容设计思维",
  "collaboration with engineering and art teams": "工程与美术团队协作",
  "prototyping of AI-centered gameplay and interaction": "AI 玩法与交互原型设计",
  "evaluation of AI model capabilities and limitations": "AI 模型能力与边界评估",
  "design of experience measurement for AI-driven content": "AI 驱动内容体验度量设计",
  "LLM / Agent frameworks (e.g., LangChain, AutoGPT, or similar)":
    "LLM / Agent 框架（如 LangChain、AutoGPT 等）",
  "knowledge engineering tools (e.g., Neo4j, RDF, or similar)":
    "知识工程工具（如 Neo4j、RDF 等）",
  "AI narrative tools (e.g., Ink, ChatGPT, or similar)":
    "AI 叙事工具（如 Ink、ChatGPT 等）",
  "prototyping tools (e.g., Unity, Unreal, or similar)":
    "原型工具（如 Unity、Unreal 等）"
};

const normalizedKeywordTranslationsZh = Object.fromEntries(
  Object.entries(keywordTranslationsZh).map(([key, label]) => [
    normalizeKeyword(key),
    label
  ])
);

export function localizeDisplayValue(value: string, language: "en" | "zh") {
  if (language === "en") return value;
  return displayTranslationsZh[value] ?? value;
}

export function localizeEvidenceText(value: string, language: "en" | "zh") {
  if (language === "en") return value;
  return displayTranslationsZh[value] ?? value;
}

export function localizeKeyword(value: string, language: "en" | "zh") {
  if (language === "en") return value;
  return keywordTranslationsZh[value] ?? normalizedKeywordTranslationsZh[normalizeKeyword(value)] ?? value;
}

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getDimensionLabel(
  dimension: MatchScoreDimensionKey,
  t: Record<string, string>
) {
  const labels: Record<MatchScoreDimensionKey, string> = {
    business_communication_fit: t.businessCommunicationFit,
    education_fit: t.educationFit,
    experience_fit: t.experienceFit,
    technical_skills_fit: t.technicalSkillsFit
  };
  return labels[dimension];
}

export function getVerdict(score: number, language: "en" | "zh") {
  if (score >= 85) {
    return {
      className: "text-score-high",
      label: language === "zh" ? "高度匹配" : "Strong fit"
    };
  }
  if (score >= 70) {
    return {
      className: "text-app-accent",
      label: language === "zh" ? "值得推进" : "Good potential"
    };
  }
  if (score >= 55) {
    return {
      className: "text-score-mid",
      label: language === "zh" ? "中等匹配" : "Moderate fit"
    };
  }
  return {
    className: "text-score-low",
    label: language === "zh" ? "匹配较低" : "Low fit"
  };
}

export function getScoreTone(score: number) {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

export function getCoveragePercent(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

export function formatOptionalDate(value: string | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatDateTime(value: string | undefined, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatWorkMode(mode: string, language: "en" | "zh") {
  if (language === "en") return mode;
  const labels: Record<string, string> = {
    Hybrid: "混合",
    "Not specified": "未指定",
    Onsite: "现场",
    Remote: "远程"
  };
  return labels[mode] ?? mode;
}

export function safeText(value: string | undefined, fallback: string) {
  if (!isUsefulValue(value)) return fallback;
  return value?.trim() ?? fallback;
}

export function getJobTitle(job: JobRecord, language: "en" | "zh") {
  if (language === "zh" && isUsefulValue(job.job_title_zh)) return job.job_title_zh;
  if (isUsefulValue(job.job_title_en)) return job.job_title_en;
  return job.job_title_original;
}

export function getSimilarJobs(job: JobRecord, jobs: JobRecord[]) {
  const currentSkills = new Set(job.skills.map((skill) => skill.toLowerCase()));
  return jobs
    .filter((item) => item.id !== job.id)
    .map((item) => ({
      item,
      score:
        (item.job_type_en && item.job_type_en === job.job_type_en ? 3 : 0) +
        item.skills.filter((skill) => currentSkills.has(skill.toLowerCase())).length
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.item.match_score - a.item.match_score)
    .slice(0, 4)
    .map(({ item }) => item);
}

export function getActionStageLabel(stage: string, language: "en" | "zh") {
  const labels: Record<string, { en: string; zh: string }> = {
    evaluate: { en: "Evaluate", zh: "评估" },
    needs_review: { en: "Needs review", zh: "待判断" },
    apply: { en: "Apply", zh: "投递" },
    ready_to_apply: { en: "Ready to apply", zh: "准备投递" },
    tailor_resume: { en: "Tailor resume", zh: "先优化简历" },
    follow_up: { en: "Follow up", zh: "等待 / 跟进" },
    interview: { en: "Interview", zh: "面试" },
    negotiate: { en: "Negotiate", zh: "谈判" },
    parked: { en: "Parked", zh: "暂存" },
    decide: { en: "Decide", zh: "决定" },
    closed: { en: "Closed", zh: "已关闭" }
  };
  return labels[stage]?.[language] ?? stage;
}

export function getActionStageTone(stage: string) {
  const tones: Record<string, string> = {
    evaluate: "border-app-info-border bg-app-info-soft text-app-info",
    needs_review: "border-app-warning-border bg-app-warning-soft text-app-warning",
    apply: "border-app-info-border bg-app-info-soft text-app-info",
    ready_to_apply: "border-app-success-border bg-app-success-soft text-app-success",
    tailor_resume: "border-app-info-border bg-app-info-soft text-app-info",
    follow_up: "border-app-info-border bg-app-info-soft text-app-info",
    interview: "border-app-info-border bg-app-info-soft text-app-info",
    negotiate: "border-app-warning-border bg-app-warning-soft text-app-warning",
    parked: "border-app-border-soft bg-app-surface-subtle text-app-text-tertiary",
    decide: "border-app-success-border bg-app-success-soft text-app-success",
    closed: "border-app-border-soft bg-app-surface-subtle text-app-text-tertiary"
  };
  return tones[stage] ?? "";
}

export function getActionStageToneName(stage: string) {
  const names: Record<string, "success" | "warning" | "danger" | "neutral"> = {
    evaluate: "warning",
    needs_review: "warning",
    apply: "success",
    ready_to_apply: "success",
    tailor_resume: "warning",
    follow_up: "success",
    interview: "success",
    negotiate: "warning",
    parked: "neutral",
    decide: "success",
    closed: "neutral"
  };
  return names[stage] ?? "neutral";
}

export function getInsightToneClass(tone: "danger" | "neutral" | "success" | "warning") {
  const classes: Record<string, string> = {
    danger: "border-app-danger-border bg-app-danger-soft",
    neutral: "border-app-border-soft bg-app-surface-subtle",
    success: "border-app-success-border bg-app-success-soft",
    warning: "border-app-warning-border bg-app-warning-soft"
  };
  return classes[tone] ?? classes.neutral;
}

export function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const lower = value.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
