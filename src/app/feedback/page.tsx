"use client";

import { FormEvent, useCallback, useState } from "react";
import { AppCard } from "@/components/ui/app-card";
import { Button } from "@/components/ui/button";
import { CompletionSpark } from "@/components/ui/completion-spark";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { StarRating } from "@/components/ui/star-rating";
import { useLanguage } from "@/lib/i18n/language-provider";
import { trackProductEvent } from "@/lib/product/analytics";
import { cn } from "@/lib/utils";
import type { FeedbackResponse } from "@/types/product-validation";

type FeedbackOption = {
  id: string;
  label: string;
  helper?: string;
};

const GOAL_MAX_LENGTH = 280;
const EVIDENCE_MAX_LENGTH = 900;
const EXPECTED_CHANGE_MAX_LENGTH = 360;

export default function FeedbackPage() {
  const { language, t } = useLanguage();
  const copy = getFeedbackFlowCopy(language);
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [area, setArea] = useState(copy.areaOptions[0].id);
  const [feedbackType, setFeedbackType] = useState(copy.typeOptions[0].id);
  const [priority, setPriority] = useState(copy.priorityOptions[1].id);
  const [evidence, setEvidence] = useState("");
  const [expectedChange, setExpectedChange] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(4);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const markTouched = useCallback(
    (field: string) => {
      if (touched.has(field)) return;
      setTouched((prev) => new Set(prev).add(field));
    },
    [touched]
  );

  const selectedArea = getSelectedOption(copy.areaOptions, area);
  const selectedType = getSelectedOption(copy.typeOptions, feedbackType);
  const selectedPriority = getSelectedOption(copy.priorityOptions, priority);

  const goalValid = goal.trim().length >= 8;
  const goalShowError = touched.has("goal") && goal.trim().length > 0 && !goalValid;
  const evidenceValid = evidence.trim().length >= 20;
  const evidenceShowError =
    touched.has("evidence") && evidence.trim().length > 0 && !evidenceValid;
  const expectedChangeValid = expectedChange.trim().length >= 8;
  const expectedChangeShowError =
    touched.has("expectedChange") &&
    expectedChange.trim().length > 0 &&
    !expectedChangeValid;
  const emailValid =
    !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailShowError =
    touched.has("email") && email.trim().length > 0 && !emailValid;

  const canSubmit =
    goalValid &&
    evidenceValid &&
    expectedChangeValid &&
    emailValid &&
    status !== "submitting";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaLabel: selectedArea.label,
          evidence,
          expectedChange,
          feedbackTypeLabel: selectedType.label,
          role,
          goal,
          email,
          rating,
          language,
          path: "/feedback",
          priorityLabel: selectedPriority.label
        })
      });
      const payload = (await response.json()) as FeedbackResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || t.feedbackError);
      }
      trackProductEvent("feedback_submitted", {
        area,
        feedbackType,
        hasEmail: Boolean(email.trim()),
        priority,
        rating
      });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.feedbackError);
    }
  };

  const ratingLabels = [
    t.feedbackRating1,
    t.feedbackRating2,
    t.feedbackRating3,
    t.feedbackRating4,
    t.feedbackRating5
  ];

  if (status === "success") {
    return (
      <div className="mx-auto max-w-lg app-page-enter">
        <CompletionSpark className="rounded-lg" sparkOnMount>
          <AppCard className="space-y-6 p-10 text-center sm:p-12" variant="elevated">
            <div className="flex flex-col gap-5 text-center sm:items-center">
              <svg
                className="mx-auto checkmark-draw"
                width="64"
                height="64"
                viewBox="0 0 64 64"
                fill="none"
              >
                <circle
                  cx="32"
                  cy="32"
                  r="29"
                  stroke="#3B6D11"
                  strokeWidth="3"
                  fill="#EAF3DE"
                  className="checkmark-circle"
                />
                <path
                  d="M20 32l8 8 16-16"
                  stroke="#3B6D11"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  className="checkmark-path"
                />
              </svg>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-app-text-primary">
                  {copy.successTitle}
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-app-text-secondary">
                  {copy.successSubtitle}
                </p>
              </div>
            </div>
          </AppCard>
        </CompletionSpark>
      </div>
    );
  }

  return (
    <div className="app-stagger mx-auto max-w-3xl space-y-6">
      <div className="max-w-3xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-text-tertiary">
          {copy.eyebrow}
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight text-app-text-primary">
          {copy.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-secondary">
          {copy.intro}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="app-stagger space-y-4">
          <AppCard as="section" className="space-y-5 p-5 sm:p-6" variant="elevated">
            <SectionHeading
              accentClassName="bg-blue-50/55 text-blue-700 ring-blue-100/80"
              icon="01"
              title={copy.contextTitle}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="feedback-role">{copy.roleLabel}</Label>
                <Input
                  id="feedback-role"
                  value={role}
                  maxLength={120}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder={copy.rolePlaceholder}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback-goal">{copy.goalLabel}</Label>
                <Textarea
                  id="feedback-goal"
                  value={goal}
                  minLength={8}
                  maxLength={GOAL_MAX_LENGTH}
                  rows={3}
                  required
                  onChange={(event) => setGoal(event.target.value)}
                  onBlur={() => markTouched("goal")}
                  placeholder={copy.goalPlaceholder}
                  className={goalShowError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}
                />
                <FieldHint
                  current={goal.trim().length}
                  error={goalShowError ? copy.goalMin : ""}
                  limit={GOAL_MAX_LENGTH}
                  minimum={copy.goalMin}
                  unit={copy.charCount}
                  valid={goal.trim().length > 0 && goalValid}
                />
              </div>
            </div>

            <SelectionGroup
              label={copy.areaLabel}
              onChange={setArea}
              options={copy.areaOptions}
              value={area}
            />
          </AppCard>

          <AppCard as="section" className="space-y-5 p-5 sm:p-6" variant="elevated">
            <SectionHeading
              accentClassName="bg-teal-50/55 text-teal-700 ring-teal-100/80"
              icon="02"
              title={copy.signalTitle}
            />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <SelectionGroup
                label={copy.typeLabel}
                onChange={setFeedbackType}
                options={copy.typeOptions}
                value={feedbackType}
              />

              <div className="space-y-2">
                <Label>{copy.ratingLabel}</Label>
                <StarRating
                  ariaLabel={copy.ratingLabel}
                  labels={ratingLabels}
                  onChange={setRating}
                  value={rating}
                />
              </div>
            </div>

            <SelectionGroup
              compact
              label={copy.priorityLabel}
              onChange={setPriority}
              options={copy.priorityOptions}
              value={priority}
            />

            <div className="space-y-2">
              <Label htmlFor="feedback-evidence">{copy.evidenceLabel}</Label>
              <Textarea
                id="feedback-evidence"
                value={evidence}
                minLength={20}
                maxLength={EVIDENCE_MAX_LENGTH}
                rows={5}
                required
                onChange={(event) => setEvidence(event.target.value)}
                onBlur={() => markTouched("evidence")}
                placeholder={copy.evidencePlaceholder}
                className={evidenceShowError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}
              />
              <FieldHint
                current={evidence.trim().length}
                error={evidenceShowError ? copy.evidenceMin : ""}
                limit={EVIDENCE_MAX_LENGTH}
                minimum={copy.evidenceMin}
                unit={copy.charCount}
                valid={evidence.trim().length > 0 && evidenceValid}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-expected-change">
                {copy.expectedChangeLabel}
              </Label>
              <Textarea
                id="feedback-expected-change"
                value={expectedChange}
                minLength={8}
                maxLength={EXPECTED_CHANGE_MAX_LENGTH}
                rows={3}
                required
                onChange={(event) => setExpectedChange(event.target.value)}
                onBlur={() => markTouched("expectedChange")}
                placeholder={copy.expectedChangePlaceholder}
                className={expectedChangeShowError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}
              />
              <FieldHint
                current={expectedChange.trim().length}
                error={expectedChangeShowError ? copy.expectedChangeMin : ""}
                limit={EXPECTED_CHANGE_MAX_LENGTH}
                minimum={copy.expectedChangeMin}
                unit={copy.charCount}
                valid={expectedChange.trim().length > 0 && expectedChangeValid}
              />
            </div>
          </AppCard>

          <AppCard as="section" className="space-y-4 p-5 sm:p-6" variant="elevated">
            <SectionHeading
              accentClassName="bg-amber-50/55 text-amber-700 ring-amber-100/80"
              icon="03"
              title={copy.contactTitle}
            />

            <div className="space-y-2">
              <Label htmlFor="feedback-email">{copy.emailLabel}</Label>
              <Input
                id="feedback-email"
                type="email"
                value={email}
                maxLength={160}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => markTouched("email")}
                placeholder={copy.emailPlaceholder}
                className={emailShowError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}
              />
              {emailShowError ? (
                <p className="text-xs text-red-500">{copy.emailInvalid}</p>
              ) : null}
            </div>

            <div className="rounded-app border border-app-border-soft bg-app-surface px-3 py-2.5 text-xs leading-5 text-app-text-secondary shadow-app-card">
              {copy.privacyBadge}
            </div>
          </AppCard>

          {message ? (
            <div className="app-sheet-enter rounded-lg border border-red-100/80 bg-red-50/45 px-4 py-3 text-sm font-medium text-score-low shadow-app-card">
              {message}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-app-text-tertiary">
              {copy.submitHint}
            </p>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="min-h-11 px-6 sm:min-w-[180px]"
            >
              {status === "submitting" ? copy.submitting : copy.submit}
            </Button>
          </div>
      </form>
    </div>
  );
}

function SectionHeading({
  accentClassName,
  icon,
  title
}: {
  accentClassName: string;
  icon: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold shadow-app-card ring-1",
          accentClassName
        )}
      >
        {icon}
      </span>
      <h2 className="text-sm font-semibold text-app-text-primary">{title}</h2>
    </div>
  );
}

function SelectionGroup({
  compact,
  label,
  onChange,
  options,
  value
}: {
  compact?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: FeedbackOption[];
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          "grid gap-2",
          compact ? "sm:grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {options.map((option) => {
          const selected = option.id === value;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "min-h-11 rounded-app border px-3 py-2 text-left text-sm transition duration-200",
                selected
                  ? "border-app-accent bg-app-accent-soft text-app-accent shadow-app-card"
                  : "border-app-border-soft bg-app-surface text-app-text-secondary hover:border-app-border hover:bg-app-surface-hover"
              )}
              aria-pressed={selected}
            >
              <span className="block font-semibold">{option.label}</span>
              {option.helper ? (
                <span className="mt-1 block text-xs leading-4 opacity-80">
                  {option.helper}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FieldHint({
  current,
  error,
  limit,
  minimum,
  unit,
  valid
}: {
  current: number;
  error: string;
  limit: number;
  minimum: string;
  unit: string;
  valid: boolean;
}) {
  return (
    <div className="flex min-h-5 items-center justify-between text-xs">
      {error ? (
        <span className="text-red-500">{error}</span>
      ) : valid ? (
        <span className="text-green-600">{current}/{limit} {unit}</span>
      ) : (
        <span className="text-app-text-tertiary">{minimum}</span>
      )}
      <span className="tabular-nums text-app-text-tertiary">
        {current} / {limit}
      </span>
    </div>
  );
}

function getSelectedOption(options: FeedbackOption[], value: string) {
  return options.find((option) => option.id === value) ?? options[0];
}

function getFeedbackFlowCopy(language: "en" | "zh") {
  if (language === "zh") {
    return {
      areaLabel: "反馈属于哪个区域？",
      areaOptions: [
        { id: "ai_analysis", label: "AI 分析", helper: "JD 解析、匹配度、语言输出" },
        { id: "job_report", label: "职位报告", helper: "详情页、技能诊断、作战板" },
        { id: "resume", label: "简历工具", helper: "改写建议、关键词、素材" },
        { id: "tracker", label: "机会追踪", helper: "工作台、状态、跟进流程" },
        { id: "import_sync", label: "导入 / 同步", helper: "批量导入、云同步、账户" },
        { id: "other", label: "其他", helper: "不确定归类也可以放这里" }
      ],
      charCount: "字",
      contactTitle: "联系与隐私",
      contextTitle: "使用场景",
      emailInvalid: "邮箱格式不正确",
      emailLabel: "邮箱（可选）",
      emailPlaceholder: "you@example.com",
      evidenceLabel: "发生了什么？",
      evidenceMin: "至少 20 个字符",
      evidencePlaceholder: "例如：中文页面下技能仍显示 Data Analysis；匹配度拆解里证据太长；作战板重复展示同一句话。",
      expectedChangeLabel: "你希望它怎么改？",
      expectedChangeMin: "至少 8 个字符",
      expectedChangePlaceholder: "例如：AI 分析时直接按页面语言输出技能，并把证据拆成更短的要点。",
      eyebrow: "产品反馈",
      goalLabel: "用户当时想完成什么？",
      goalMin: "至少 8 个字符",
      goalPlaceholder: "例如：判断这个 JD 是否值得投递，并快速知道该改哪几条简历。",
      intro: "把真实使用反馈整理成后续可执行的优化素材。越具体，下一轮产品调整越省力。",
      privacyBadge: "请不要填写私人简历细节、身份证件、完整联系方式或公司内部信息。",
      priorityLabel: "优先级",
      priorityOptions: [
        { id: "low", label: "低", helper: "体验优化" },
        { id: "medium", label: "中", helper: "影响判断或效率" },
        { id: "high", label: "高", helper: "阻碍继续使用" }
      ],
      ratingLabel: "当前有用程度",
      roleLabel: "用户背景（可选）",
      rolePlaceholder: "求职者、职场新人、转行者、招聘顾问...",
      signalTitle: "问题信号",
      submit: "提交反馈",
      submitHint: "提交后会保存为结构化反馈，方便产品团队后续统一处理。",
      submitting: "提交中...",
      successSubtitle: "反馈已经保存，产品团队会结合更多使用信号继续优化。",
      successTitle: "感谢，反馈已记录",
      title: "把反馈变成可执行优化",
      typeLabel: "它更像哪类问题？",
      typeOptions: [
        { id: "wrong_result", label: "结果不准", helper: "分析、分数、建议偏差" },
        { id: "language", label: "语言问题", helper: "翻译、双语、术语" },
        { id: "missing_info", label: "信息缺失", helper: "缺少解释、证据、入口" },
        { id: "too_much_work", label: "操作费力", helper: "步骤多、来回找" },
        { id: "visual_layout", label: "视觉布局", helper: "太窄、拥挤、难扫读" },
        { id: "other", label: "其他", helper: "暂时不好归类" }
      ]
    };
  }

  return {
    areaLabel: "Which area is this about?",
    areaOptions: [
      { id: "ai_analysis", label: "AI analysis", helper: "JD parsing, fit score, language output" },
      { id: "job_report", label: "Job report", helper: "Detail page, skill diagnosis, prep board" },
      { id: "resume", label: "Resume tools", helper: "Tailoring advice, keywords, materials" },
      { id: "tracker", label: "Opportunity tracker", helper: "Workspace, status, follow-up flow" },
      { id: "import_sync", label: "Import / sync", helper: "Bulk import, cloud sync, account" },
      { id: "other", label: "Other", helper: "Use this when it is hard to classify" }
    ],
    charCount: "characters",
    contactTitle: "Contact and privacy",
    contextTitle: "Use context",
    emailInvalid: "Invalid email format",
    emailLabel: "Email (optional)",
    emailPlaceholder: "you@example.com",
    evidenceLabel: "What happened?",
    evidenceMin: "At least 20 characters",
    evidencePlaceholder: "Example: On the Chinese page, skills still show as Data Analysis; the match breakdown evidence is too long; the prep board repeats one sentence.",
    expectedChangeLabel: "What should change?",
    expectedChangeMin: "At least 8 characters",
    expectedChangePlaceholder: "Example: Generate display skills in the selected page language and split evidence into shorter points.",
    eyebrow: "Product feedback",
    goalLabel: "What was the user trying to do?",
    goalMin: "At least 8 characters",
    goalPlaceholder: "Example: Decide whether a JD is worth applying to and see which resume bullets to improve.",
    intro: "Turn real user feedback into structured product input for the next optimization pass.",
    privacyBadge: "Do not include private resume details, ID documents, full contact details, or internal company information.",
    priorityLabel: "Priority",
    priorityOptions: [
      { id: "low", label: "Low", helper: "Nice-to-have polish" },
      { id: "medium", label: "Medium", helper: "Affects judgment or speed" },
      { id: "high", label: "High", helper: "Blocks continued use" }
    ],
    ratingLabel: "Current usefulness",
    roleLabel: "User background (optional)",
    rolePlaceholder: "Job seeker, new grad, career switcher, recruiter...",
    signalTitle: "Feedback signal",
    submit: "Submit feedback",
    submitHint: "After submission, this is saved as structured product feedback for the team to review.",
    submitting: "Submitting...",
    successSubtitle: "Your feedback was saved and will be reviewed with other product signals.",
    successTitle: "Feedback recorded",
    title: "Turn feedback into useful product input",
    typeLabel: "What kind of issue is it?",
    typeOptions: [
      { id: "wrong_result", label: "Wrong result", helper: "Analysis, score, or advice feels off" },
      { id: "language", label: "Language issue", helper: "Translation, bilingual copy, terminology" },
      { id: "missing_info", label: "Missing info", helper: "Lacks explanation, evidence, or entry point" },
      { id: "too_much_work", label: "Too much work", helper: "Too many steps or too much searching" },
      { id: "visual_layout", label: "Visual layout", helper: "Too narrow, crowded, hard to scan" },
      { id: "other", label: "Other", helper: "Hard to classify for now" }
    ]
  };
}
