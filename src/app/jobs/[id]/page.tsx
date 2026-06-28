"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CompanyLogo } from "@/components/jobs/company-logo";
import { DetailSection } from "@/components/jobs/detail-section";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusSelect } from "@/components/jobs/status-select";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { formatDate } from "@/lib/utils";
import {
  deleteCloudJob,
  hydrateJobsFromCloud,
  upsertCloudJob
} from "@/lib/storage/cloud-sync";
import { deleteStoredJob, updateStoredJobStatus } from "@/lib/storage/jobs";
import {
  ApplicationStatus,
  JobRecord,
  MATCH_SCORE_DIMENSIONS,
  MatchScoreDimensionKey
} from "@/types/job";

type Tab = "overview" | "analysis" | "tracking";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { language, t, recommendations, nextActions, priorities } = useLanguage();
  const [job, setJob] = useState<JobRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      hydrateJobsFromCloud(session)
        .then((jobs) => {
          setJob(jobs.find((item) => item.id === params.id) ?? null);
        })
        .finally(() => setIsLoaded(true));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [params.id, session]);

  const handleStatusChange = (status: ApplicationStatus) => {
    const updatedJob = updateStoredJobStatus(params.id, status);
    if (updatedJob) { setJob(updatedJob); void upsertCloudJob(session, updatedJob); }
  };

  const handleDelete = () => {
    if (!window.confirm(t.deleteConfirm)) return;
    deleteStoredJob(params.id);
    void deleteCloudJob(session, params.id);
    router.push("/workspace");
  };

  if (!isLoaded) return <div className="rounded-xl border border-black/[0.06] bg-tertiary p-6 shadow-sm">{t.analyzing}</div>;

  if (!job) return (
    <div className="rounded-xl border bg-tertiary p-10 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-primary">{t.notFound}</h1>
      <p className="mt-2 text-sm text-secondary">{t.notFoundBody}</p>
      <ButtonLink href="/workspace" className="mt-5">{t.backToList}</ButtonLink>
    </div>
  );

  const locale = language === "zh" ? "zh-CN" : "en-AU";
  const primaryTitle = language === "zh" && isUsefulValue(job.job_title_zh) ? job.job_title_zh : isUsefulValue(job.job_title_en) ? job.job_title_en : job.job_title_original;
  const secondaryTitle = language === "zh" && primaryTitle !== job.job_title_original ? job.job_title_original : "";
  const decisionTone = getDecisionCardTone(job.application_recommendation);
  const decisionTextTone = getDecisionTextTone(job.application_recommendation);

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: language === "zh" ? "概览" : "Overview" },
    { key: "analysis", label: t.matchBreakdown },
    { key: "tracking", label: t.statusTimeline }
  ];

  return (
    <div className="space-y-5">
      {/* Breadcrumb + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/workspace" className="text-sm font-medium text-accent transition-colors hover:text-accent-hover">
          ← {t.backToList}
        </Link>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/jobs/${job.id}/edit`} variant="secondary">{t.edit}</ButtonLink>
          <Button variant="secondary" onClick={handleDelete}>{t.deleteJob}</Button>
        </div>
      </div>

      {/* ─── Header card ─── */}
      <section className="rounded-xl border border-black/[0.04] bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <CompanyLogo company={job.company} size="lg" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-secondary">{job.company}</p>
              <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-primary">
                {primaryTitle}
              </h1>
              {secondaryTitle ? (
                <p className="mt-1.5 text-[14px] text-secondary">{secondaryTitle}</p>
              ) : null}
              {/* Inline metadata chips */}
              <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                {job.location ? (
                  <span className="rounded-full border border-black/[0.05] bg-[#FAFAFA] px-2.5 py-1 text-secondary">{job.location}</span>
                ) : null}
                {job.job_type_en ? (
                  <span className="rounded-full border border-black/[0.05] bg-[#FAFAFA] px-2.5 py-1 text-secondary">{language === "zh" ? job.job_type_zh : job.job_type_en}</span>
                ) : null}
                {job.work_mode ? (
                  <span className="rounded-full border border-black/[0.05] bg-[#FAFAFA] px-2.5 py-1 text-secondary">{formatWorkMode(job.work_mode, language)}</span>
                ) : null}
                {job.application_deadline ? (
                  <span className="rounded-full border border-black/[0.05] bg-[#FAFAFA] px-2.5 py-1 text-secondary">
                    {language === "zh" ? "截止" : "Due"} {formatDate(job.application_deadline, locale)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ScoreBadge score={job.match_score} recommendation={job.application_recommendation} />
            <StatusSelect value={job.application_status} onChange={handleStatusChange} />
          </div>
        </div>

        {/* ─── Mobile decision card ─── */}
        <div className={`mt-5 rounded-xl border p-4 lg:hidden ${decisionTone}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-wider opacity-60 ${decisionTextTone}`}>
            {language === "zh" ? "申请决策" : "Decision"}
          </p>
          <p className={`mt-1.5 text-[16px] font-semibold ${decisionTextTone}`}>
            {recommendations[job.application_recommendation]}
          </p>
          <p className={`mt-1 text-[12px] ${decisionTextTone} opacity-70`}>
            {t.matchScore} {job.match_score} · {language === "zh" ? "置信度高" : "High confidence"}
          </p>
          <p className={`mt-2 text-[13px] leading-relaxed opacity-80 ${decisionTextTone}`}>
            {localizedText(job.ai_summary_en, job.ai_summary_zh, language)}
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 border-b border-black/[0.04] -mx-5 px-5 sm:-mx-6 sm:px-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-3 text-[13px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-accent after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Content: Decision card sidebar (desktop) + Tab content ─── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Left: Tab content */}
        <div className="space-y-5">
          {activeTab === "overview" && (
            <>
              {/* Recommendation */}
              <DetailSection title={t.recommendedNextAction}>
                <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{nextActions[job.recommended_next_action.action]}</Badge>
                      <Badge>{priorities[job.recommended_next_action.urgency]}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-primary">
                      {localizedText(job.recommended_next_action.reason_en, job.recommended_next_action.reason_zh, language)}
                    </p>
                    <div className="mt-4">
                      <TagGroup title={t.resumeFocusPoints} values={job.recommended_next_action.resume_focus_points} />
                    </div>
                  </div>
                  <MetaItem label={t.suggestedDeadline} value={localizeDisplayValue(job.recommended_next_action.suggested_deadline, language)} />
                </div>
              </DetailSection>

              {/* Key items grid */}
              <div className="grid gap-5 lg:grid-cols-2">
                <DetailSection title={t.redFlags}>
                  <ExpandableListBlock values={localizedArray(job.red_flags_en, job.red_flags_zh, language)} />
                </DetailSection>
                <DetailSection title={t.positiveSignals}>
                  <ExpandableListBlock values={localizedArray(job.positive_signals_en, job.positive_signals_zh, language)} />
                </DetailSection>
                <DetailSection title={t.keyStrengths}>
                  <ExpandableListBlock values={localizedArray(job.key_strengths_en, job.key_strengths_zh, language)} />
                </DetailSection>
                <DetailSection title={t.mainGaps}>
                  <ExpandableListBlock values={localizedArray(job.main_gaps_en, job.main_gaps_zh, language)} />
                </DetailSection>
                <DetailSection title={t.resumeTailoringAdvice}>
                  <ExpandableListBlock values={localizedArray(job.resume_tailoring_advice_en, job.resume_tailoring_advice_zh, language)} />
                </DetailSection>
                <DetailSection title={t.skillsToImprove}>
                  <ExpandableListBlock values={localizedArray(job.skills_to_improve_en, job.skills_to_improve_zh, language)} />
                </DetailSection>
              </div>

              {/* Job details */}
              <div className="grid gap-5 lg:grid-cols-2">
                <DetailSection title={t.responsibilities}>
                  <LocalizedList en={job.responsibilities_en} zh={job.responsibilities_zh} />
                </DetailSection>
                <DetailSection title={t.requirements}>
                  <LocalizedList en={job.requirements_en} zh={job.requirements_zh} />
                </DetailSection>
                <DetailSection title={t.niceToHave}>
                  <LocalizedList en={job.nice_to_have_en} zh={job.nice_to_have_zh} />
                </DetailSection>
                <DetailSection title={`${t.skills} / ${t.tools}`}>
                  <div className="space-y-4">
                    <TagGroup title={t.skills} values={job.skills} />
                    <TagGroup title={t.tools} values={job.tools} />
                  </div>
                </DetailSection>
                <DetailSection title={t.education}>
                  <LocalizedText en={job.education_requirement_en} zh={job.education_requirement_zh} />
                </DetailSection>
                <DetailSection title={t.experience}>
                  <LocalizedText en={job.experience_requirement_en} zh={job.experience_requirement_zh} />
                </DetailSection>
              </div>

              {/* Assumptions */}
              <div className="grid gap-5 lg:grid-cols-2">
                <DetailSection title={t.assumptions}>
                  <ExpandableListBlock values={localizedArray(job.assumptions_en, job.assumptions_zh, language)} />
                </DetailSection>
                <DetailSection title={t.missingInformation}>
                  <ExpandableListBlock values={localizedArray(job.missing_information_en, job.missing_information_zh, language)} />
                </DetailSection>
              </div>
            </>
          )}

          {activeTab === "analysis" && (
            <>
              {/* Match breakdown */}
              <DetailSection title={t.matchBreakdown}>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {MATCH_SCORE_DIMENSIONS.map((dimension) => (
                    <BreakdownCard key={dimension} dimension={dimension} job={job} language={language} />
                  ))}
                </div>
              </DetailSection>

              {/* Skill gap analysis */}
              <DetailSection title={t.skillGapAnalysis}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <TagGroup title={t.matchedSkills} values={job.matched_skills} />
                  <TagGroup title={t.missingSkills} values={job.missing_skills} />
                  <TagGroup title={t.importantTools} values={job.important_tools} />
                  <TagGroup title={t.resumeKeywords} values={job.resume_keywords} />
                </div>
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-secondary">{t.suggestedLearningActions}</h3>
                  <div className="mt-2">
                    <ExpandableListBlock values={localizedArray(job.suggested_learning_actions_en, job.suggested_learning_actions_zh, language)} />
                  </div>
                </div>
                {job.missing_skill_details.length ? (
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold text-secondary">{t.missingSkillDetails}</h3>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      {job.missing_skill_details.map((item) => (
                        <div key={item.skill} className="rounded-lg border border-black/[0.05] bg-hover p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-primary">{localizeKeyword(item.skill, language)}</p>
                            <Badge>{priorities[item.priority]}</Badge>
                          </div>
                          <dl className="mt-3 space-y-2 text-sm leading-6">
                            <DetailRow label={t.whyItMatters} value={localizedText(item.why_it_matters_en, item.why_it_matters_zh, language)} />
                            <DetailRow label={t.matchImpact} value={localizeDisplayValue(item.impact_on_match_score, language)} />
                            <DetailRow label={t.learningResourceType} value={localizeDisplayValue(item.suggested_resource_type, language)} />
                          </dl>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </DetailSection>
            </>
          )}

          {activeTab === "tracking" && (
            <>
              <DetailSection title={t.applicationDetails}>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <MetaItem label={t.applicationChannel} value={job.application_channel ? localizeDisplayValue(job.application_channel, language) : t.notProvided} />
                  <MetaItem label={t.contactPerson} value={job.contact_person || t.notProvided} />
                  <MetaItem label={t.interviewDate} value={formatDateTime(job.interview_date, locale, t.notProvided)} />
                  <MetaItem label={t.sourceUrl} value={job.source_url || t.notProvided} />
                </dl>
                {job.source_url ? (
                  <a href={job.source_url} target="_blank" rel="noreferrer"
                    className="mt-4 block break-all text-sm font-medium text-accent hover:underline">
                    {job.source_url}
                  </a>
                ) : null}
              </DetailSection>

              <DetailSection title={t.statusTimeline}>
                <Timeline job={job} locale={locale} />
              </DetailSection>

              <div className="grid gap-5 lg:grid-cols-2">
                <DetailSection title={t.notes}>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-primary">
                    {job.notes ? localizeDisplayValue(job.notes, language) : t.notProvided}
                  </p>
                </DetailSection>
                <DetailSection title={t.followUpNotes}>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-primary">
                    {job.follow_up_notes ? localizeDisplayValue(job.follow_up_notes, language) : t.notProvided}
                  </p>
                </DetailSection>
              </div>
            </>
          )}

          {/* Raw JD — always at bottom */}
          <details className="rounded-xl border bg-tertiary p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-primary">{t.rawJdToggle}</summary>
            <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-black/[0.05] bg-hover p-4 text-sm leading-6 text-primary">
              {job.raw_jd}
            </pre>
          </details>
        </div>

        {/* Right: Sticky decision card (desktop only) */}
        <aside className="hidden lg:sticky lg:top-24 lg:self-start lg:block w-[300px]">
          <div className={`rounded-xl border shadow-sm ${decisionTone} overflow-hidden`}>
            <div className="p-5">
              <p className={`text-[11px] font-semibold uppercase tracking-wider opacity-60 ${decisionTextTone}`}>
                {language === "zh" ? "申请决策" : "Decision"}
              </p>
              <p className={`mt-2 text-[18px] font-semibold ${decisionTextTone}`}>
                {recommendations[job.application_recommendation]}
              </p>
              <div className="mt-3 flex items-center gap-2 text-[12px]">
                <span className={`${decisionTextTone} opacity-70`}>{t.matchScore} {job.match_score}</span>
                <span className={`${decisionTextTone} opacity-30`}>·</span>
                <span className={`${decisionTextTone} opacity-70`}>{language === "zh" ? "置信度 高" : "Confidence High"}</span>
              </div>

              {job.ai_summary_en || job.ai_summary_zh ? (
                <p className={`mt-4 text-[13px] leading-relaxed opacity-80 ${decisionTextTone}`}>
                  {localizedText(job.ai_summary_en, job.ai_summary_zh, language)}
                </p>
              ) : null}

              {(job.red_flags_en?.[0] || job.red_flags_zh?.[0]) ? (
                <div className="mt-3 rounded-lg border border-red-100/50 bg-red-50/20 px-3 py-2">
                  <p className="text-[11px] font-medium text-red-600/70">{language === "zh" ? "风险提示" : "Risk"}</p>
                  <p className="mt-0.5 text-[12px] text-red-700/80">
                    {language === "zh" ? job.red_flags_zh?.[0] : job.red_flags_en?.[0]}
                  </p>
                </div>
              ) : null}
            </div>

            <div className={`border-t px-5 py-3 ${decisionTone} opacity-60`}>
              <div className="flex items-center justify-between text-[11px]">
                <span className={decisionTextTone}>{t.urgency}</span>
                <span className={`font-medium ${decisionTextTone}`}>{priorities[job.recommended_next_action.urgency]}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ──────────── Sub-components ──────────── */

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/[0.05] bg-hover px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-secondary">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-medium text-primary">{value}</dd>
    </div>
  );
}

function BreakdownCard({ dimension, job, language }: { dimension: MatchScoreDimensionKey; job: JobRecord; language: "en" | "zh" }) {
  const { t, confidences } = useLanguage();
  const item = job.match_score_breakdown[dimension];
  return (
    <div className="rounded-lg border border-black/[0.05] bg-hover p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-primary">{getDimensionLabel(dimension, t)}</h3>
        <ScoreBadge score={item.score} />
      </div>
      <p className="mt-2 text-sm leading-6 text-secondary">
        {localizedText(item.explanation_en, item.explanation_zh, language)}
      </p>
      <dl className="mt-3 space-y-2 border-t border pt-3 text-xs leading-5">
        <DetailRow label={t.evidenceFromJd} value={localizeEvidenceText(item.evidence_from_jd, language)} />
        <DetailRow label={t.candidateGap} value={localizedText(item.candidate_gap_en, item.candidate_gap_zh, language)} />
        <DetailRow label={t.confidence} value={confidences[item.confidence]} />
      </dl>
    </div>
  );
}

function LocalizedText({ en, zh }: { en: string; zh: string }) {
  const { language, t } = useLanguage();
  const value = localizedText(en, zh, language);
  return <p className="text-sm leading-6 text-primary">{isUsefulValue(value) ? value : t.notSpecified}</p>;
}

function LocalizedList({ en, zh }: { en: string[]; zh: string[] }) {
  const { language } = useLanguage();
  return <ExpandableListBlock values={localizedArray(en, zh, language)} />;
}

function ListBlock({ values }: { values: string[] }) {
  const { t } = useLanguage();
  return values.length ? (
    <ul className="space-y-2 text-sm leading-6 text-primary">
      {values.map((value, index) => (
        <li key={`${value}-${index}`} className="rounded-lg bg-hover px-3 py-2">{value}</li>
      ))}
    </ul>
  ) : <p className="text-sm text-secondary">{t.notSpecified}</p>;
}

function ExpandableListBlock({ values, initialCount = 3 }: { values: string[]; initialCount?: number }) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleValues = isExpanded ? values : values.slice(0, initialCount);
  if (!values.length) return <p className="text-sm text-secondary">{t.notSpecified}</p>;
  return (
    <div className="space-y-3">
      <ListBlock values={visibleValues} />
      {values.length > initialCount ? (
        <Button variant="ghost" onClick={() => setIsExpanded((cur) => !cur)}>
          {isExpanded ? t.showLess : t.showMore}
        </Button>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-secondary">{label}</dt>
      <dd className="mt-0.5 text-primary">{value}</dd>
    </div>
  );
}

function TagGroup({ title, values }: { title: string; values: string[] }) {
  const { language, t } = useLanguage();
  return (
    <div>
      <h3 className="text-sm font-semibold text-secondary">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {values.length ? values.map((v, i) => <Badge key={`${v}-${i}`}>{localizeKeyword(v, language)}</Badge>) : <p className="text-sm text-secondary">{t.notSpecified}</p>}
      </div>
    </div>
  );
}

function Timeline({ job, locale }: { job: JobRecord; locale: string }) {
  const { timelineStatuses, t } = useLanguage();
  return (
    <ol className="space-y-3">
      {job.status_history.map((item) => (
        <li key={item.id} className="rounded-lg border border-black/[0.05] bg-hover p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">{timelineStatuses[item.status]}</p>
            <p className="text-xs text-secondary">{formatDateTime(item.created_at, locale, item.created_at)}</p>
          </div>
          {item.note ? <p className="mt-2 text-sm leading-6 text-secondary">{localizeDisplayValue(item.note, locale.startsWith("zh") ? "zh" : "en")}</p> : null}
        </li>
      ))}
      {job.status_history.length === 0 ? <li className="text-sm text-secondary">{t.notProvided}</li> : null}
    </ol>
  );
}

/* ──────────── Translation helpers ──────────── */

function localizedText(en: string, zh: string, language: "en" | "zh") {
  if (language === "zh" && isUsefulValue(zh)) return zh;
  return en;
}
function localizedArray(en: string[], zh: string[], language: "en" | "zh") {
  if (language === "zh" && zh.some(isUsefulValue)) return zh.filter(isUsefulValue);
  return en;
}

const displayTranslationsZh: Record<string, string> = {
  "Company website": "公司官网", "Within 3 days": "3 天内", "This week": "本周内",
  "Medium impact": "中等影响", "Low to medium impact": "低到中等影响",
  project: "项目", "short course": "短课程", "practice task": "练习任务",
  documentation: "文档学习", "portfolio project": "作品集项目", "portfolio task": "作品集任务",
  "Not specified": "未注明",
  "Sample record. Replace with your own notes when applying.": "示例记录。正式申请时可替换为你自己的备注。",
  "Prepare analytics project walkthrough and role motivation.": "准备分析项目讲解和岗位动机说明。",
  "Recruiter screen scheduled.": "已安排招聘初筛。",
  "Sample job for portfolio demo mode.": "作品集演示模式的示例职位。"
};
const evidenceTranslationsZh: Record<string, string> = {
  "JD asks for statistics, analytics, finance, economics, or related fields.": "JD 要求统计、分析、金融、经济或相关领域背景。",
  "JD mentions SQL, Python, Excel, dashboards, or reporting.": "JD 提到 SQL、Python、Excel、仪表盘或报告能力。",
  "JD expects communication with business stakeholders.": "JD 要求与业务相关方沟通。",
  "JD uses junior, internship, associate, or 0-2 years language.": "JD 使用初级、实习、专员或 0-2 年经验等表述。",
  "JD responsibilities map to analytics and business decision support.": "JD 职责与分析和业务决策支持相关。"
};
const keywordTranslationsZh: Record<string, string> = {
  "A/B testing": "A/B 测试", "Scorecard modelling": "评分卡建模",
  "Experiment design": "实验设计", "CRM operations": "CRM 运营"
};

function localizeDisplayValue(value: string, language: "en" | "zh") {
  if (language === "en") return value;
  return displayTranslationsZh[value] ?? value;
}
function localizeEvidenceText(value: string, language: "en" | "zh") {
  if (language === "en") return value;
  const translated = evidenceTranslationsZh[value] ?? displayTranslationsZh[value];
  if (translated) return translated;
  const lm = value.match(/^JD location is (.+)\.$/);
  if (lm) return `JD 地点为${localizeRegionName(lm[1])}。`;
  return value;
}
function localizeKeyword(value: string, language: "en" | "zh") {
  if (language === "en") return value;
  return keywordTranslationsZh[value] ?? value;
}
function localizeRegionName(value: string) {
  const labels: Record<string, string> = { Australia: "澳大利亚", Singapore: "新加坡", China: "中国" };
  return labels[value] ?? value;
}

function getDimensionLabel(d: MatchScoreDimensionKey, t: ReturnType<typeof useLanguage>["t"]) {
  const labels: Record<MatchScoreDimensionKey, string> = {
    education_fit: t.educationFit, technical_skills_fit: t.technicalSkillsFit,
    business_communication_fit: t.businessCommunicationFit, experience_fit: t.experienceFit,
    career_direction_fit: t.careerDirectionFit, location_fit: t.locationFit
  };
  return labels[d];
}
function getDecisionCardTone(r: JobRecord["application_recommendation"]) {
  const tones: Record<JobRecord["application_recommendation"], string> = {
    "Strongly apply": "border-score-high-border bg-score-high-bg",
    "Worth trying": "border-accent-subtle bg-accent-subtle",
    "Low priority": "border-score-mid-border bg-score-mid-bg",
    "Not recommended": "border-score-low-border bg-score-low-bg"
  };
  return tones[r];
}
function getDecisionTextTone(r: JobRecord["application_recommendation"]) {
  const tones: Record<JobRecord["application_recommendation"], string> = {
    "Strongly apply": "text-score-high", "Worth trying": "text-accent",
    "Low priority": "text-score-mid", "Not recommended": "text-score-low"
  };
  return tones[r];
}

/* ──────────── Date helpers ──────────── */

function formatDateTime(v: string | undefined, locale: string, fallback: string) {
  if (!v) return fallback;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
function formatWorkMode(mode: string, language: "en" | "zh") {
  if (language === "en") return mode;
  const labels: Record<string, string> = { Remote: "远程", Hybrid: "混合", Onsite: "现场", "Not specified": "未注明" };
  return labels[mode] ?? mode;
}
function isUsefulValue(value: string | undefined) {
  return Boolean(value?.trim()) && value !== "Not specified" && value !== "未注明";
}
