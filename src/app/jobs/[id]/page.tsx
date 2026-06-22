"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { DetailSection } from "@/components/jobs/detail-section";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { StatusSelect } from "@/components/jobs/status-select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { formatDate } from "@/lib/utils";
import {
  deleteStoredJob,
  getStoredJob,
  updateStoredJobStatus
} from "@/lib/storage/jobs";
import {
  ApplicationStatus,
  JobRecord,
  MATCH_SCORE_DIMENSIONS,
  MatchScoreDimensionKey
} from "@/types/job";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { language, t, recommendations, nextActions, priorities } =
    useLanguage();
  const [job, setJob] = useState<JobRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setJob(getStoredJob(params.id) ?? null);
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [params.id]);

  const handleStatusChange = (status: ApplicationStatus) => {
    const updatedJob = updateStoredJobStatus(params.id, status);
    if (updatedJob) {
      setJob(updatedJob);
    }
  };

  const handleDelete = () => {
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }

    deleteStoredJob(params.id);
    router.push("/");
  };

  if (!isLoaded) {
    return <div className="rounded-md border border-line bg-white p-6">{t.analyzing}</div>;
  }

  if (!job) {
    return (
      <div className="rounded-md border border-line bg-white p-8 text-center shadow-soft">
        <h1 className="text-xl font-semibold text-ink">{t.notFound}</h1>
        <p className="mt-2 text-sm text-muted">{t.notFoundBody}</p>
        <ButtonLink href="/" className="mt-5">
          {t.backToList}
        </ButtonLink>
      </div>
    );
  }

  const locale = language === "zh" ? "zh-CN" : "en-AU";
  const primaryTitle =
    language === "zh" && isUsefulValue(job.job_title_zh)
      ? job.job_title_zh
      : job.job_title_original;
  const secondaryTitle =
    language === "zh" && primaryTitle !== job.job_title_original
      ? job.job_title_original
      : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold text-accent hover:underline">
          {t.backToList}
        </Link>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/jobs/${job.id}/edit`} variant="secondary">
            {t.edit}
          </ButtonLink>
          <Button variant="secondary" onClick={handleDelete}>
            {t.deleteJob}
          </Button>
        </div>
      </div>

      <section className="rounded-md border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{job.company}</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">
              {primaryTitle}
            </h1>
            {secondaryTitle ? (
              <p className="mt-2 text-base text-muted">{secondaryTitle}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ScoreBadge score={job.match_score} />
            <StatusSelect
              value={job.application_status}
              onChange={handleStatusChange}
            />
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetaItem label={t.location} value={job.location} />
          <MetaItem
            label={t.workMode}
            value={formatWorkMode(job.work_mode, language)}
          />
          <MetaItem
            label={t.jobType}
            value={language === "zh" ? job.job_type_zh : job.job_type_en}
          />
          <MetaItem
            label={t.deadline}
            value={formatOptionalDate(
              job.application_deadline,
              locale,
              t.noDeadline
            )}
          />
          <MetaItem
            label={t.createdDate}
            value={formatDate(job.created_at, locale)}
          />
        </dl>
      </section>

      <section className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="rounded-md border border-line bg-white p-4 shadow-soft">
          <p className="text-sm font-semibold text-muted">{t.applicationDecision}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted">{t.matchScore}</p>
              <div className="mt-2">
                <ScoreBadge score={job.match_score} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-muted">{t.recommendation}</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {recommendations[job.application_recommendation]}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-ink">
            {localizedText(job.ai_summary_en, job.ai_summary_zh, language)}
          </p>
        </div>

        <DetailSection title={t.recommendedNextAction}>
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{nextActions[job.recommended_next_action.action]}</Badge>
                <Badge>{priorities[job.recommended_next_action.urgency]}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-ink">
                {localizedText(
                  job.recommended_next_action.reason_en,
                  job.recommended_next_action.reason_zh,
                  language
                )}
              </p>
              <div className="mt-4">
                <TagGroup
                  title={t.resumeFocusPoints}
                  values={job.recommended_next_action.resume_focus_points}
                />
              </div>
            </div>
            <MetaItem
              label={t.suggestedDeadline}
              value={job.recommended_next_action.suggested_deadline}
            />
          </div>
        </DetailSection>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t.redFlags}>
          <ExpandableListBlock
            values={localizedArray(job.red_flags_en, job.red_flags_zh, language)}
          />
        </DetailSection>

        <DetailSection title={t.positiveSignals}>
          <ExpandableListBlock
            values={localizedArray(
              job.positive_signals_en,
              job.positive_signals_zh,
              language
            )}
          />
        </DetailSection>

        <DetailSection title={t.keyStrengths}>
          <ExpandableListBlock
            values={localizedArray(job.key_strengths_en, job.key_strengths_zh, language)}
          />
        </DetailSection>

        <DetailSection title={t.mainGaps}>
          <ExpandableListBlock
            values={localizedArray(job.main_gaps_en, job.main_gaps_zh, language)}
          />
        </DetailSection>

        <DetailSection title={t.resumeTailoringAdvice}>
          <ExpandableListBlock
            values={localizedArray(
              job.resume_tailoring_advice_en,
              job.resume_tailoring_advice_zh,
              language
            )}
          />
        </DetailSection>

        <DetailSection title={t.skillsToImprove}>
          <ExpandableListBlock
            values={localizedArray(
              job.skills_to_improve_en,
              job.skills_to_improve_zh,
              language
            )}
          />
        </DetailSection>
      </div>

      <DetailSection title={t.matchBreakdown}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MATCH_SCORE_DIMENSIONS.map((dimension) => (
            <BreakdownCard
              key={dimension}
              dimension={dimension}
              job={job}
              language={language}
            />
          ))}
        </div>
      </DetailSection>

      <DetailSection title={t.skillGapAnalysis}>
        <div className="grid gap-5 lg:grid-cols-2">
          <TagGroup title={t.matchedSkills} values={job.matched_skills} />
          <TagGroup title={t.missingSkills} values={job.missing_skills} />
          <TagGroup title={t.importantTools} values={job.important_tools} />
          <TagGroup title={t.resumeKeywords} values={job.resume_keywords} />
        </div>
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-muted">
            {t.suggestedLearningActions}
          </h3>
          <div className="mt-2">
            <ExpandableListBlock
              values={localizedArray(
                job.suggested_learning_actions_en,
                job.suggested_learning_actions_zh,
                language
              )}
            />
          </div>
        </div>
        {job.missing_skill_details.length ? (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-muted">
              {t.missingSkillDetails}
            </h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {job.missing_skill_details.map((item) => (
                <div
                  key={item.skill}
                  className="rounded-md border border-line bg-paper p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-ink">{item.skill}</p>
                    <Badge>{priorities[item.priority]}</Badge>
                  </div>
                  <dl className="mt-3 space-y-2 text-sm leading-6">
                    <DetailRow
                      label={t.whyItMatters}
                      value={localizedText(
                        item.why_it_matters_en,
                        item.why_it_matters_zh,
                        language
                      )}
                    />
                    <DetailRow
                      label={t.matchImpact}
                      value={item.impact_on_match_score}
                    />
                    <DetailRow
                      label={t.learningResourceType}
                      value={item.suggested_resource_type}
                    />
                  </dl>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </DetailSection>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t.assumptions}>
          <ExpandableListBlock
            values={localizedArray(job.assumptions_en, job.assumptions_zh, language)}
          />
        </DetailSection>

        <DetailSection title={t.missingInformation}>
          <ExpandableListBlock
            values={localizedArray(
              job.missing_information_en,
              job.missing_information_zh,
              language
            )}
          />
        </DetailSection>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t.applicationDetails}>
          <dl className="grid gap-3 sm:grid-cols-2">
            <MetaItem
              label={t.applicationChannel}
              value={job.application_channel || t.notProvided}
            />
            <MetaItem
              label={t.contactPerson}
              value={job.contact_person || t.notProvided}
            />
            <MetaItem
              label={t.interviewDate}
              value={formatDateTime(job.interview_date, locale, t.notProvided)}
            />
            <MetaItem
              label={t.sourceUrl}
              value={job.source_url || t.notProvided}
            />
          </dl>
          {job.source_url ? (
            <a
              href={job.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block break-all text-sm font-semibold text-accent hover:underline"
            >
              {job.source_url}
            </a>
          ) : null}
        </DetailSection>

        <DetailSection title={t.statusTimeline}>
          <Timeline job={job} locale={locale} />
        </DetailSection>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t.notes}>
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
            {job.notes || t.notProvided}
          </p>
        </DetailSection>

        <DetailSection title={t.followUpNotes}>
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">
            {job.follow_up_notes || t.notProvided}
          </p>
        </DetailSection>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailSection title={t.education}>
          <LocalizedText en={job.education_requirement_en} zh={job.education_requirement_zh} />
        </DetailSection>

        <DetailSection title={t.experience}>
          <LocalizedText
            en={job.experience_requirement_en}
            zh={job.experience_requirement_zh}
          />
        </DetailSection>

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
      </div>

      <details className="rounded-md border border-line bg-white p-4 shadow-soft">
        <summary className="cursor-pointer text-base font-semibold text-ink">
          {t.rawJdToggle}
        </summary>
        <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-paper p-4 text-sm leading-6 text-ink">
          {job.raw_jd}
        </pre>
      </details>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-paper px-3 py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function BreakdownCard({
  dimension,
  job,
  language
}: {
  dimension: MatchScoreDimensionKey;
  job: JobRecord;
  language: "en" | "zh";
}) {
  const { t, confidences } = useLanguage();
  const item = job.match_score_breakdown[dimension];

  return (
    <div className="rounded-md border border-line bg-paper p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink">
          {getDimensionLabel(dimension, t)}
        </h3>
        <ScoreBadge score={item.score} />
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        {localizedText(item.explanation_en, item.explanation_zh, language)}
      </p>
      <dl className="mt-3 space-y-2 border-t border-line pt-3 text-xs leading-5">
        <DetailRow label={t.evidenceFromJd} value={item.evidence_from_jd} />
        <DetailRow
          label={t.candidateGap}
          value={localizedText(item.candidate_gap_en, item.candidate_gap_zh, language)}
        />
        <DetailRow label={t.confidence} value={confidences[item.confidence]} />
      </dl>
    </div>
  );
}

function LocalizedText({ en, zh }: { en: string; zh: string }) {
  const { language, t } = useLanguage();
  const value = localizedText(en, zh, language);

  return (
    <p className="text-sm leading-6 text-ink">
      {isUsefulValue(value) ? value : t.notSpecified}
    </p>
  );
}

function LocalizedList({ en, zh }: { en: string[]; zh: string[] }) {
  const { language } = useLanguage();
  return <ExpandableListBlock values={localizedArray(en, zh, language)} />;
}

function ListBlock({ values }: { values: string[] }) {
  const { t } = useLanguage();

  return values.length ? (
    <ul className="space-y-2 text-sm leading-6 text-ink">
      {values.map((value) => (
        <li key={value} className="rounded-md bg-paper px-3 py-2">
          {value}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted">{t.notSpecified}</p>
  );
}

function ExpandableListBlock({
  values,
  initialCount = 3
}: {
  values: string[];
  initialCount?: number;
}) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleValues = isExpanded ? values : values.slice(0, initialCount);

  if (!values.length) {
    return <p className="text-sm text-muted">{t.notSpecified}</p>;
  }

  return (
    <div className="space-y-3">
      <ListBlock values={visibleValues} />
      {values.length > initialCount ? (
        <Button variant="ghost" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? t.showLess : t.showMore}
        </Button>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}

function TagGroup({ title, values }: { title: string; values: string[] }) {
  const { t } = useLanguage();

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? (
          values.map((value) => <Badge key={value}>{value}</Badge>)
        ) : (
          <p className="text-sm text-muted">{t.notSpecified}</p>
        )}
      </div>
    </div>
  );
}

function Timeline({ job, locale }: { job: JobRecord; locale: string }) {
  const { timelineStatuses, t } = useLanguage();

  return (
    <ol className="space-y-3">
      {job.status_history.map((item) => (
        <li key={item.id} className="rounded-md border border-line bg-paper p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">
              {timelineStatuses[item.status]}
            </p>
            <p className="text-xs font-medium text-muted">
              {formatDateTime(item.created_at, locale, item.created_at)}
            </p>
          </div>
          {item.note ? (
            <p className="mt-2 text-sm leading-6 text-muted">{item.note}</p>
          ) : null}
        </li>
      ))}
      {job.status_history.length === 0 ? (
        <li className="text-sm text-muted">{t.notProvided}</li>
      ) : null}
    </ol>
  );
}

function localizedText(en: string, zh: string, language: "en" | "zh") {
  return language === "zh" ? zh : en;
}

function localizedArray(en: string[], zh: string[], language: "en" | "zh") {
  return language === "zh" ? zh : en;
}

function getDimensionLabel(
  dimension: MatchScoreDimensionKey,
  t: ReturnType<typeof useLanguage>["t"]
) {
  const labels: Record<MatchScoreDimensionKey, string> = {
    education_fit: t.educationFit,
    technical_skills_fit: t.technicalSkillsFit,
    business_communication_fit: t.businessCommunicationFit,
    experience_fit: t.experienceFit,
    career_direction_fit: t.careerDirectionFit,
    location_fit: t.locationFit
  };

  return labels[dimension];
}

function formatOptionalDate(
  value: string | undefined,
  locale: string,
  fallback: string
) {
  const dateTime = getDateOnlyTime(value);

  if (dateTime === null) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(dateTime));
}

function formatDateTime(
  value: string | undefined,
  locale: string,
  fallback: string
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getDateOnlyTime(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  const time = date.getTime();

  return Number.isNaN(time) ? null : time;
}

function formatWorkMode(mode: string, language: "en" | "zh") {
  if (language === "en") {
    return mode;
  }

  const labels: Record<string, string> = {
    Remote: "远程",
    Hybrid: "混合",
    Onsite: "现场",
    "Not specified": "未注明"
  };

  return labels[mode] ?? mode;
}

function isUsefulValue(value: string | undefined) {
  return Boolean(value?.trim()) && value !== "Not specified" && value !== "未注明";
}
