"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ScoreBadge } from "@/components/jobs/score-badge";
import { JobRecord, MATCH_SCORE_DIMENSIONS, PriorityLevel } from "@/types/job";
import { DetailCopy } from "@/lib/jobs/job-detail-copy";
import {
  localizedText,
  localizeDisplayValue,
  localizeEvidenceText,
  localizeKeyword,
  isUsefulValue,
  getScoreTone,
  getDimensionLabel,
  getCoveragePercent,
  uniqueStrings,
} from "@/lib/jobs/job-detail-utils";
import { SectionHeading } from "@/components/jobs/ui/detail-widgets";
import { DetailRow, EmptyReportState } from "@/components/jobs/ui/report-components";

export type SkillFitInsights = {
  priorityGaps: JobRecord["missing_skill_details"];
  skillCoverage: number;
  weakestDimension: {
    key: import("@/types/job").MatchScoreDimensionKey;
    score: number;
  };
};

export function SkillsTab({
  confidences,
  copy,
  job,
  language,
  priorities,
  t
}: {
  confidences: Record<string, string>;
  copy: DetailCopy;
  job: JobRecord;
  language: "en" | "zh";
  priorities: Record<PriorityLevel, string>;
  t: Record<string, string>;
}) {
  const skillInsights = getSkillFitInsights(job);

  return (
    <>
      <SkillCoachPanel
        copy={copy}
        insights={skillInsights}
        job={job}
        language={language}
        priorities={priorities}
        t={t}
      />

      <AppCard className="p-5 sm:p-6">
        <SectionHeading subtitle={copy.skillsSubtitle} title={t.matchBreakdown} />
        <div className="mt-5 grid gap-3">
          {MATCH_SCORE_DIMENSIONS.map((dimension) => {
            const item = job.match_score_breakdown[dimension];
            const tone = getScoreTone(item.score);
            return (
              <div
                className={cn(
                  "rounded-lg border bg-app-surface p-4 shadow-app-card sm:p-5",
                  tone === "success"
                    ? "border-app-success-border"
                    : tone === "warning"
                      ? "border-app-warning-border"
                      : "border-app-danger-border"
                )}
                key={dimension}
              >
                <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                  <div>
                    <div className="flex items-start justify-between gap-3 lg:block">
                      <h3 className="text-[15px] font-semibold text-app-text-primary">
                        {getDimensionLabel(dimension, t)}
                      </h3>
                      <div className="lg:mt-3">
                        <ScoreBadge score={item.score} />
                      </div>
                    </div>
                    <ProgressBar className="mt-3" value={item.score} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] leading-6 text-app-text-secondary">
                      {localizedText(item.explanation_en, item.explanation_zh, language)}
                    </p>
                    <dl className="mt-4 grid gap-3 border-t border-app-border-soft pt-4 text-[12px] leading-5 sm:grid-cols-2">
                      <DetailRow label={t.evidenceFromJd} value={localizeEvidenceText(item.evidence_from_jd, language)} />
                      <DetailRow label={t.candidateGap} value={localizedText(item.candidate_gap_en, item.candidate_gap_zh, language)} />
                      <DetailRow label={t.confidence} value={confidences[item.confidence]} />
                    </dl>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AppCard>

      <SkillSignalBoard
        copy={copy}
        job={job}
        language={language}
        t={t}
      />

      <AppCard className="p-5 sm:p-6">
        <SectionHeading title={t.missingSkillDetails} />
        {job.missing_skill_details.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {job.missing_skill_details.map((item) => (
              <AppCard className="p-4" key={item.skill} variant="muted">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-app-text-primary">
                    {localizeKeyword(item.skill, language)}
                  </p>
                  <Badge>{priorities[item.priority]}</Badge>
                </div>
                <dl className="mt-3 space-y-2 text-[13px] leading-6">
                  <DetailRow label={t.whyItMatters} value={localizedText(item.why_it_matters_en, item.why_it_matters_zh, language)} />
                  <DetailRow label={t.matchImpact} value={localizeDisplayValue(item.impact_on_match_score, language)} />
                  <DetailRow label={t.learningResourceType} value={localizeDisplayValue(item.suggested_resource_type, language)} />
                </dl>
              </AppCard>
            ))}
          </div>
        ) : (
          <EmptyReportState body={copy.noMissingSkillDetailsBody} icon="target" title={copy.noMissingSkillDetails} />
        )}
      </AppCard>
    </>
  );
}

export function SkillCoachPanel({
  copy,
  insights,
  job,
  language,
  priorities,
  t
}: {
  copy: DetailCopy;
  insights: SkillFitInsights;
  job: JobRecord;
  language: "en" | "zh";
  priorities: Record<PriorityLevel, string>;
  t: Record<string, string>;
}) {
  const topGap = insights.priorityGaps[0];
  const focusPoints = job.recommended_next_action.resume_focus_points
    .map((item) => localizeDisplayValue(item, language))
    .filter(isUsefulValue);
  const evidenceChips = uniqueStrings([...job.matched_skills, ...focusPoints]);

  return (
    <AppCard className="overflow-hidden p-0" variant="elevated">
      <div className="border-b border-app-border-soft bg-app-surface px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            subtitle={copy.skillCoachSubtitle}
            title={copy.skillCoachTitle}
          />
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[430px]">
            <SkillMiniMetric
              label={copy.provenSkills}
              tone="success"
              value={`${job.matched_skills.length}`}
            />
            <SkillMiniMetric
              label={copy.gapSkills}
              tone={job.missing_skills.length ? "warning" : "success"}
              value={`${job.missing_skills.length}`}
            />
            <SkillMiniMetric
              label={copy.weakestSignal}
              tone={insights.weakestDimension.score >= 75 ? "success" : "warning"}
              value={`${insights.weakestDimension.score}/100`}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-5 sm:p-6">
          <div className="rounded-lg border border-app-warning-border bg-app-warning-soft p-4 shadow-app-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-app-warning">
                  {copy.skillPriorityFix}
                </p>
                <h3 className="mt-1 text-[18px] font-semibold tracking-tight text-app-text-primary">
                  {topGap
                    ? localizeKeyword(topGap.skill, language)
                    : copy.noPriorityGap}
                </h3>
              </div>
              {topGap ? <Badge>{priorities[topGap.priority]}</Badge> : null}
            </div>
            <p className="mt-3 text-[13px] leading-6 text-app-text-secondary">
              {topGap
                ? localizedText(
                    topGap.why_it_matters_en,
                    topGap.why_it_matters_zh,
                    language
                  )
                : copy.noPriorityGapBody}
            </p>
            {topGap ? (
              <dl className="mt-4 grid gap-3 border-t border-amber-200/70 pt-4 sm:grid-cols-2">
                <DetailRow
                  label={t.matchImpact}
                  value={localizeDisplayValue(topGap.impact_on_match_score, language)}
                />
                <DetailRow
                  label={t.learningResourceType}
                  value={localizeDisplayValue(topGap.suggested_resource_type, language)}
                />
              </dl>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ProgressBar
              label={copy.skillCoverage}
              showValue
              size="lg"
              tone={getScoreTone(insights.skillCoverage)}
              value={insights.skillCoverage}
            />
            <ProgressBar
              label={getDimensionLabel(insights.weakestDimension.key, t)}
              showValue
              size="lg"
              tone={getScoreTone(insights.weakestDimension.score)}
              value={insights.weakestDimension.score}
            />
          </div>
        </div>

        <aside className="border-t border-app-border-soft bg-app-surface p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="text-[12px] font-semibold text-app-text-primary">
            {copy.skillEvidenceTitle}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-app-text-secondary">
            {copy.skillEvidenceBody}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {evidenceChips.slice(0, 10).map((item) => (
              <Badge key={item}>{localizeKeyword(item, language)}</Badge>
            ))}
          </div>
        </aside>
      </div>
    </AppCard>
  );
}

export function SkillMiniMetric({
  label,
  tone,
  value
}: {
  label: string;
  tone: "success" | "warning";
  value: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 shadow-app-card",
        tone === "success"
          ? "border-app-success-border bg-app-success-soft"
          : "border-app-warning-border bg-app-warning-soft"
      )}
    >
      <p className="text-[11px] font-semibold text-app-text-tertiary">
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold text-app-text-primary">
        {value}
      </p>
    </div>
  );
}

export function SkillSignalBoard({
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
  return (
    <AppCard className="p-5 sm:p-6">
      <SectionHeading
        subtitle={copy.skillSignalsSubtitle}
        title={copy.skillSignalsTitle}
      />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SkillSignalColumn
          language={language}
          title={t.matchedSkills}
          tone="success"
          values={job.matched_skills}
        />
        <SkillSignalColumn
          language={language}
          title={t.missingSkills}
          tone="warning"
          values={job.missing_skills}
        />
        <SkillSignalColumn
          language={language}
          title={copy.roleKeywords}
          values={job.skills}
        />
        <SkillSignalColumn
          language={language}
          title={t.importantTools}
          values={job.important_tools}
        />
      </div>
    </AppCard>
  );
}

export function SkillSignalColumn({
  language,
  title,
  tone = "neutral",
  values
}: {
  language: "en" | "zh";
  title: string;
  tone?: "neutral" | "success" | "warning";
  values: string[];
}) {
  const { t } = useLanguage();

  const headerBg = tone === "success"
    ? "border-b border-app-success-border bg-app-success-soft"
    : tone === "warning"
      ? "border-b border-app-warning-border bg-app-warning-soft"
      : "border-b border-app-info-border bg-app-info-soft";

  const headerText = tone === "success"
    ? "text-app-success"
    : tone === "warning"
      ? "text-app-warning"
      : "text-app-text-primary";

  const badgeClass = tone === "success"
    ? "border-app-success-border bg-app-success-soft text-app-success"
    : tone === "warning"
      ? "border-app-warning-border bg-app-warning-soft text-app-warning"
      : undefined;

  return (
    <div className="overflow-hidden rounded-lg border border-app-border-soft bg-app-surface shadow-app-card">
      <div className={cn("px-3 py-2", headerBg)}>
        <p className={cn("text-[12px] font-semibold", headerText)}>
          {title}
        </p>
      </div>
      <div className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {values.length ? (
            values.slice(0, 10).map((value) => (
              <Badge className={badgeClass} key={value}>
                {localizeKeyword(value, language)}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-app-text-secondary">{t.notSpecified}</p>
          )}
        </div>
      </div>
    </div>
  );
}
export function getSkillFitInsights(job: JobRecord): SkillFitInsights {
  const weakestDimension = MATCH_SCORE_DIMENSIONS.map((key) => ({
    key,
    score: job.match_score_breakdown[key].score
  })).sort((a, b) => a.score - b.score)[0];

  return {
    priorityGaps: sortMissingSkillDetails(job.missing_skill_details),
    skillCoverage: getCoveragePercent(
      job.matched_skills.length,
      job.matched_skills.length + job.missing_skills.length
    ),
    weakestDimension
  };
}
function sortMissingSkillDetails(details: JobRecord["missing_skill_details"]) {
  return [...details].sort(
    (a, b) => getPriorityRank(a.priority) - getPriorityRank(b.priority)
  );
}

function getPriorityRank(priority: PriorityLevel) {
  const ranks: Record<PriorityLevel, number> = {
    High: 0,
    Medium: 1,
    Low: 2
  };

  return ranks[priority];
}
