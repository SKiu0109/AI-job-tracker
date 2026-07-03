"use client";

import { ChangeEvent, FormEvent, SVGProps, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useResumeAnalyzer } from "@/components/resume/use-resume-analyzer";
import { AppCard } from "@/components/ui/app-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form-controls";
import { PageHeader, PageHeaderMetric } from "@/components/ui/page-header";
import { TabNav } from "@/components/ui/tab-nav";
import { useAuth } from "@/lib/auth/auth-provider";
import { useGuestCredits } from "@/lib/credits/guest-credits-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { useToast } from "@/components/ui/toast";
import {
  GUEST_WORKSPACE_IMPORTED_EVENT,
  hydrateCandidateProfileFromCloud,
  hydrateJobsFromCloud,
  upsertCloudCandidateProfile
} from "@/lib/storage/cloud-sync";
import {
  loadCandidateProfile,
  resetCandidateProfile,
  saveCandidateProfile
} from "@/lib/storage/candidate-profile";
import { createStorageScope } from "@/lib/storage/scope";
import { cn, formatDate } from "@/lib/utils";
import { getJobTitle } from "@/lib/jobs/job-detail-utils";
import type { CandidateProfile, JobRecord } from "@/types/job";

type ProfileField = keyof CandidateProfile;

const PROFILE_FIELDS: ProfileField[] = [
  "target_regions",
  "target_roles",
  "preferred_industries",
  "preferred_language",
  "work_rights",
  "education_background",
  "technical_skills",
  "business_skills",
  "work_experience",
  "career_goals"
];

const PROFILE_SECTIONS: Array<{
  key: "basics" | "skills" | "experience";
  fields: ProfileField[];
}> = [
  {
    key: "basics",
    fields: ["target_regions", "target_roles", "preferred_industries", "preferred_language", "work_rights"]
  },
  {
    key: "skills",
    fields: ["education_background", "technical_skills", "business_skills"]
  },
  {
    key: "experience",
    fields: ["work_experience", "career_goals"]
  }
];

export default function ResumeHubPage() {
  const { session } = useAuth();
  const { status: creditsStatus, updateCredits } = useGuestCredits();
  const { confidences, language, t } = useLanguage();
  const { addToast } = useToast();
  const copy = getResumeHubCopy(language);
  const locale = language === "zh" ? "zh-CN" : "en-AU";
  const userId = session?.user.id ?? null;
  const sessionRef = useRef(session);
  const storageScope = useMemo(() => createStorageScope(userId), [userId]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [activeProfileSection, setActiveProfileSection] =
    useState<"basics" | "skills" | "experience">("basics");
  const {
    analysis: resumeAnalysis,
    analyzeResume,
    analyzedAt,
    error: resumeError,
    file: resumeFile,
    fileName: resumeFileName,
    handleFileChange: handleSharedResumeFileChange,
    isAnalyzing: isAnalyzingResume,
    preview: resumePreview,
    setError: setResumeError,
    wasTruncated: resumeWasTruncated
  } = useResumeAnalyzer({
    accessToken: session?.access_token,
    currentProfile: profile,
    language,
    messages: {
      analysisFailed: t.resumeAnalysisFailed,
      fileRequired: t.resumeFileRequired
    },
    onAnalysisReady: () => addToast(t.resumeAnalysisReady),
    onCreditsUpdated: updateCredits
  });

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void hydrateCandidateProfileFromCloud(sessionRef.current).then(setProfile);
      void hydrateJobsFromCloud(sessionRef.current).then(setJobs);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [userId]);

  useEffect(() => {
    const reloadImportedGuestData = () => {
      void hydrateCandidateProfileFromCloud(sessionRef.current).then(setProfile);
      void hydrateJobsFromCloud(sessionRef.current).then(setJobs);
    };

    window.addEventListener(
      GUEST_WORKSPACE_IMPORTED_EVENT,
      reloadImportedGuestData
    );

    return () =>
      window.removeEventListener(
        GUEST_WORKSPACE_IMPORTED_EVENT,
        reloadImportedGuestData
      );
  }, [userId]);

  const profileCompletion = useMemo(() => {
    if (!profile) {
      return 0;
    }

    const completed = PROFILE_FIELDS.filter((field) => profile[field]?.trim()).length;
    return Math.round((completed / PROFILE_FIELDS.length) * 100);
  }, [profile]);

  const profileCoverage = useMemo(() => {
    const source = resumeAnalysis?.candidate_profile ?? profile;

    if (!source) {
      return [];
    }

    return PROFILE_SECTIONS.map((section) => {
      const completed = section.fields.filter((field) => source[field]?.trim()).length;
      return {
        completed,
        key: section.key,
        label: copy.profileSectionLabels[section.key],
        percent: Math.round((completed / section.fields.length) * 100),
        total: section.fields.length
      };
    });
  }, [copy, profile, resumeAnalysis]);

  const profileAssets = useMemo(() => {
    const source = resumeAnalysis?.candidate_profile ?? profile;

    if (!source) {
      return [];
    }

    return PROFILE_FIELDS.map((field) => ({
      field,
      label: getProfileFieldLabel(field, copy),
      value: source[field]
    })).filter((item) => item.value.trim());
  }, [copy, profile, resumeAnalysis]);

  const profileFieldCounts = useMemo(() => {
    return PROFILE_SECTIONS.reduce(
      (counts, section) => {
        counts[section.key] = section.fields.filter((field) =>
          profile?.[field]?.trim()
        ).length;
        return counts;
      },
      {} as Record<"basics" | "skills" | "experience", number>
    );
  }, [profile]);

  const activeProfileFields =
    PROFILE_SECTIONS.find((section) => section.key === activeProfileSection)
      ?.fields ?? PROFILE_SECTIONS[0].fields;

  const tailoringJobs = useMemo(() => {
    return [...jobs]
      .filter(jobHasTailoringSignal)
      .sort(compareTailoringJobs)
      .slice(0, 6);
  }, [jobs]);

  const suggestionCount =
    (resumeAnalysis?.extracted_strengths.length ?? 0) +
    (resumeAnalysis?.missing_or_unclear_information.length ?? 0);

  const handleResumeFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleSharedResumeFileChange(event);
  };

  const handleAnalyzeResume = async () => {
    await analyzeResume();
  };

  const handleApplyResumeProfile = () => {
    if (!resumeAnalysis) {
      return;
    }

    saveCandidateProfile(resumeAnalysis.candidate_profile, storageScope);
    const nextProfile = loadCandidateProfile(storageScope);
    setProfile(nextProfile);
    void upsertCloudCandidateProfile(sessionRef.current, nextProfile);
    addToast(t.resumeProfileApplied);
    setResumeError("");
  };

  const updateProfileField = (field: ProfileField, value: string) => {
    setProfile((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      return;
    }

    saveCandidateProfile(profile, storageScope);
    const nextProfile = loadCandidateProfile(storageScope);
    setProfile(nextProfile);
    void upsertCloudCandidateProfile(sessionRef.current, nextProfile);
    addToast(t.profileSaved);
  };

  const handleResetProfile = () => {
    const nextProfile = resetCandidateProfile(storageScope);
    setProfile(nextProfile);
    void upsertCloudCandidateProfile(sessionRef.current, nextProfile);
    addToast(t.profileReset);
  };

  if (!profile) {
    return (
      <AppCard className="p-6 text-sm text-app-text-secondary">
        {t.analyzing}
      </AppCard>
    );
  }

  return (
    <div className="app-stagger space-y-8 pb-8">
      <PageHeader
        actions={
          <>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              {copy.uploadResume}
            </Button>
            <Button
              onClick={() =>
                document
                  .getElementById("candidate-profile")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              variant="secondary"
            >
              {copy.reviewProfile}
            </Button>
          </>
        }
        metadata={
          <>
            <PageHeaderMetric tone="success">
              {copy.profileCompletion}: {profileCompletion}%
            </PageHeaderMetric>
            <PageHeaderMetric>
              {jobs.length} {copy.trackedRoles}
            </PageHeaderMetric>
          </>
        }
        subtitle={copy.subtitle}
        title={copy.title}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
        <AppCard className="h-fit p-5 sm:p-6" variant="elevated">
          <SectionHeading subtitle={copy.heroSubtitle} title={copy.heroTitle} />

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <AssetSignal
              helper={copy.profileReadinessHelper}
              label={copy.profileReadiness}
              value={`${profileCompletion}%`}
            />
            <AssetSignal
              helper={resumeAnalysis ? copy.analysisReadyDescription : copy.noResumeDescription}
              label={copy.resumeStatus}
              value={resumeAnalysis ? copy.analysisReady : copy.noResumeAnalyzed}
            />
            <AssetSignal
              helper={copy.tailoringSubtitle}
              label={copy.tailoringTitle}
              value={tailoringJobs.length}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-app-text-primary">
                {resumeFileName || copy.chooseResume}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
                {creditsStatus
                  ? copy.creditNotice.replace(
                      "{cost}",
                      String(creditsStatus.credits.costPerAnalysis)
                    )
                  : copy.uploadDescription}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => fileInputRef.current?.click()} variant="secondary">
                {copy.uploadResume}
              </Button>
              <Button
                disabled={!resumeFile || isAnalyzingResume}
                onClick={handleAnalyzeResume}
              >
                {isAnalyzingResume ? t.analyzingResume : t.analyzeResume}
              </Button>
            </div>
          </div>

          <input
            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={handleResumeFileChange}
            ref={fileInputRef}
            type="file"
          />

          {resumeError ? (
            <div className="mt-4 rounded-lg border border-red-100/80 bg-red-50/45 px-4 py-3 text-[13px] font-medium text-red-700 shadow-app-card">
              {resumeError}
            </div>
          ) : null}

          {resumeAnalysis ? (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{copy.confidence}: {confidences[resumeAnalysis.confidence]}</Badge>
                {analyzedAt ? <Badge>{formatDate(analyzedAt, locale)}</Badge> : null}
                <Badge>{suggestionCount} {copy.aiSuggestions}</Badge>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <ListPanel
                  items={resumeAnalysis.extracted_strengths}
                  tone="success"
                  title={copy.strengths}
                />
                <ListPanel
                  items={resumeAnalysis.missing_or_unclear_information}
                  tone="warning"
                  title={copy.needsClarification}
                />
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-app-text-primary">
                    {copy.applyToProfileTitle}
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
                    {copy.applyToProfileDescription}
                  </p>
                </div>
                <Button onClick={handleApplyResumeProfile}>{copy.applyToProfile}</Button>
              </div>
              {resumeWasTruncated ? (
                <p className="text-[12px] font-medium text-amber-700">
                  {t.resumeWasTruncated}
                </p>
              ) : null}
              {resumePreview ? (
                <details className="rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card">
                  <summary className="cursor-pointer text-[13px] font-semibold text-app-text-primary">
                    {t.resumeTextPreview}
                  </summary>
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-5 text-app-text-secondary">
                    {resumePreview}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </AppCard>

        <div className="grid gap-5">
          <AppCard className="p-5 sm:p-6" variant="elevated">
            <SectionHeading
              subtitle={copy.profileCoverageSubtitle}
              title={copy.profileCoverageTitle}
            />
            <div className="mt-5 space-y-3">
              {profileCoverage.map((section) => (
                <ProfileChecklistRow
                  copy={copy}
                  key={section.key}
                  onOpen={() => {
                    setActiveProfileSection(section.key);
                    document
                      .getElementById("candidate-profile")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  section={section}
                />
              ))}
            </div>
          </AppCard>

          <AppCard className="p-5 sm:p-6" variant="elevated">
            <SectionHeading
              subtitle={copy.tailoringSummarySubtitle}
              title={copy.tailoringSummaryTitle}
            />
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[34px] font-semibold tracking-tight text-app-text-primary">
                  {tailoringJobs.length}
                </p>
                <p className="text-[13px] leading-5 text-app-text-secondary">
                  {copy.tailoringSummaryBody}
                </p>
              </div>
              <Link
                className="rounded-app border border-blue-100 bg-app-surface px-3 py-2 text-[12px] font-semibold text-blue-700 shadow-app-card hover:bg-blue-50"
                href="#resume-tailoring-queue"
              >
                {copy.openResumeFit}
              </Link>
            </div>
          </AppCard>
        </div>
      </section>

      <section
        className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
        id="candidate-profile"
      >
        <form onSubmit={handleProfileSubmit}>
          <AppCard className="overflow-hidden" variant="elevated">
            <div className="border-b border-app-border-soft p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <SectionHeading
                  subtitle={copy.profileEditorSubtitle}
                  title={copy.profileEditorTitle}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{profileAssets.length}/{PROFILE_FIELDS.length} {copy.fieldsComplete}</Badge>
                  <TabNav
                    activeKey={activeProfileSection}
                    ariaLabel={copy.profileSections}
                    onChange={(key) =>
                      setActiveProfileSection(
                        key as "basics" | "skills" | "experience"
                      )
                    }
                    tabs={PROFILE_SECTIONS.map((section) => ({
                      badge: `${profileFieldCounts[section.key]}/${section.fields.length}`,
                      key: section.key,
                      label: copy.profileSectionLabels[section.key]
                    }))}
                  />
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="app-stagger grid gap-x-5 gap-y-6 lg:grid-cols-2">
                {activeProfileFields.map((field) => (
                  <div className="tab-panel-enter space-y-2" key={field}>
                    <Label className="text-app-text-primary">
                      {getProfileFieldLabel(field, copy)}
                    </Label>
                    <Textarea
                      className={cn(
                        "min-h-[96px] rounded-lg border-app-border-soft bg-app-surface text-app-text-primary shadow-[inset_0_1px_1px_rgba(15,23,42,0.03)] placeholder:text-app-text-tertiary hover:bg-app-surface-hover focus:border-app-accent focus:bg-app-surface focus:ring-app-accent-soft",
                        (field === "career_goals" || field === "work_experience") &&
                          "min-h-[132px]"
                      )}
                      onChange={(event) =>
                        updateProfileField(field, event.target.value)
                      }
                      rows={field === "career_goals" || field === "work_experience" ? 4 : 3}
                      value={profile[field]}
                    />
                    <p className="text-[12px] leading-5 text-app-text-tertiary">
                      {getFieldHelper(field, copy)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-app-border-soft bg-app-surface-subtle px-5 py-4 backdrop-blur-xl sm:flex-row sm:justify-end sm:px-6">
              <Button type="button" variant="secondary" onClick={handleResetProfile}>
                {copy.resetProfile}
              </Button>
              <Button type="submit">{copy.saveProfile}</Button>
            </div>
          </AppCard>
        </form>

        <AppCard className="scroll-mt-24 p-5 sm:p-6" id="resume-tailoring-queue">
          <SectionHeading
            subtitle={copy.tailoringSubtitle}
            title={copy.tailoringTitle}
          />
          {tailoringJobs.length ? (
            <div className="app-stagger mt-5 space-y-3">
              {tailoringJobs.map((job) => (
                <Link
                  className="app-hover-lift relative block overflow-hidden rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl hover:border-app-border hover:bg-app-surface-hover hover:shadow-app-card"
                  href={`/jobs/${job.id}?tab=resume`}
                  key={job.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", getTailoringAccentClass(job))}
                        />
                        <p className="truncate text-[14px] font-semibold text-app-text-primary">
                          {getJobTitle(job, language)}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-[13px] text-app-text-secondary">
                        {job.company}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Badge>{job.match_score}%</Badge>
                      <TailoringStatusBadge copy={copy} job={job} />
                    </div>
                  </div>
                  {getTailoringPreview(job, language) ? (
                    <p className="mt-3 line-clamp-2 rounded-app border border-app-border-soft bg-app-surface px-3 py-2 text-[13px] leading-5 text-app-text-secondary shadow-app-card">
                      {getTailoringPreview(job, language)}
                    </p>
                  ) : (
                    <p className="mt-3 text-[13px] leading-5 text-app-text-tertiary">
                      {copy.openJobForTailoring}
                    </p>
                  )}
                  {job.resume_tailoring_draft?.keywords.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {job.resume_tailoring_draft.keywords.slice(0, 5).map((keyword) => (
                        <span
                          className="rounded-full bg-app-surface px-2.5 py-1 text-[11px] font-semibold text-app-text-secondary shadow-app-card"
                          key={keyword}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-app-border-soft pt-3">
                    <p className="text-[12px] font-medium text-app-text-tertiary">
                      {getTailoringNextStep(job, copy)}
                    </p>
                    <span className="text-[12px] font-semibold text-app-accent">
                      {copy.openResumeFit}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              body={copy.tailoringEmptyBody}
              icon="briefcase"
              title={copy.tailoringEmptyTitle}
            />
          )}
        </AppCard>
      </section>
    </div>
  );
}

function SectionHeading({
  subtitle,
  title
}: {
  subtitle: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="text-[18px] font-semibold tracking-tight text-app-text-primary">
        {title}
      </h2>
      <p className="mt-1 text-[13px] leading-5 text-app-text-secondary">
        {subtitle}
      </p>
    </div>
  );
}

function AssetSignal({
  helper,
  label,
  value
}: {
  helper: string;
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-app-text-tertiary">
        {label}
      </p>
      <p className="mt-2 truncate text-[22px] font-semibold tracking-tight text-app-text-primary">
        {value}
      </p>
      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-app-text-secondary">
        {helper}
      </p>
    </div>
  );
}

function ProfileChecklistRow({
  copy,
  onOpen,
  section
}: {
  copy: ResumeHubCopy;
  onOpen: () => void;
  section: {
    completed: number;
    key: "basics" | "skills" | "experience";
    label: string;
    percent: number;
    total: number;
  };
}) {
  const missing = section.total - section.completed;
  const complete = missing === 0;

  return (
    <button
      aria-label={`${section.label}: ${section.completed}/${section.total}`}
      className="group w-full rounded-lg border border-app-border-soft bg-app-surface px-4 py-3 text-left shadow-app-card transition-[background-color,border-color,box-shadow] duration-300 ease-[var(--app-motion-standard)] hover:border-app-border hover:bg-app-surface-hover hover:shadow-app-card focus-visible:outline-none focus-visible:shadow-app-focus"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-app-text-primary">
            {section.label}
          </p>
          <p className="mt-1 text-[12px] text-app-text-secondary">
            {complete
              ? copy.profileTaskComplete
              : copy.profileTaskMissing(missing)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-app-card",
            complete
              ? "bg-app-success-soft text-app-success"
              : "bg-app-accent-soft text-app-accent"
          )}
        >
          {section.completed}/{section.total}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-app-surface-muted">
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-300 ease-[var(--app-motion-standard)]",
            complete ? "bg-app-success" : "bg-app-accent"
          )}
          style={{ width: `${section.percent}%` }}
        />
      </div>
    </button>
  );
}

function ListPanel({
  items,
  title,
  tone
}: {
  items: string[];
  title: string;
  tone: "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-app-border-soft bg-app-surface p-4 shadow-app-card backdrop-blur-xl">
      <p
        className={cn(
          "text-[13px] font-semibold",
          tone === "success" ? "text-score-high" : "text-score-mid"
        )}
      >
        {title}
      </p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-[13px] leading-5 text-app-text-primary">
          {items.map((item) => (
            <li className="flex gap-2" key={item}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-app-text-tertiary">-</p>
      )}
    </div>
  );
}

function EmptyState({
  body,
  icon,
  title
}: {
  body: string;
  icon: ResumeHubIconName;
  title: string;
}) {
  return (
    <div className="mt-5 rounded-lg border border-app-border-soft bg-app-surface px-5 py-8 text-center shadow-app-card backdrop-blur-xl">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-app-surface text-app-text-tertiary shadow-app-card">
        <ResumeHubIcon name={icon} />
      </span>
      <h3 className="mt-4 text-[14px] font-semibold text-app-text-primary">
        {title}
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-5 text-app-text-secondary">
        {body}
      </p>
    </div>
  );
}

function TailoringStatusBadge({
  copy,
  job
}: {
  copy: ResumeHubCopy;
  job: JobRecord;
}) {
  const label = getTailoringStatusLabel(job, copy);
  const tone =
    job.tailoring_status === "reviewed" || job.action_stage === "ready_to_apply"
      ? "border-green-200/70 bg-green-50/55 text-green-700"
      : job.tailoring_status === "draft_ready" || job.action_stage === "tailor_resume"
        ? "border-app-accent/15 bg-app-surface text-app-accent shadow-app-card"
        : "border-amber-200/70 bg-amber-50/55 text-amber-700";

  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone)}>
      {label}
    </span>
  );
}

type ResumeHubIconName =
  | "briefcase"
  | "document"
  | "download"
  | "history"
  | "profile"
  | "spark"
  | "target"
  | "upload";

function ResumeHubIcon({
  className,
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: ResumeHubIconName }) {
  const baseProps: SVGProps<SVGSVGElement> = {
    className: cn("h-4 w-4", className),
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    ...props
  };

  if (name === "upload") {
    return (
      <svg {...baseProps}>
        <path d="M12 16V4" />
        <path d="m8 8 4-4 4 4" />
        <path d="M5 17v1.5A2.5 2.5 0 0 0 7.5 21h9A2.5 2.5 0 0 0 19 18.5V17" />
      </svg>
    );
  }

  if (name === "document") {
    return (
      <svg {...baseProps}>
        <path d="M7 3.5h6l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20v-16.5Z" />
        <path d="M13 3.5V8h4" />
        <path d="M9.5 12h5" />
        <path d="M9.5 15h5" />
        <path d="M9.5 18h3" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg {...baseProps}>
        <path d="M20 20a8 8 0 0 0-16 0" />
        <circle cx="12" cy="8" r="4" />
      </svg>
    );
  }

  if (name === "briefcase") {
    return (
      <svg {...baseProps}>
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
        <path d="M4 11.5h16" />
      </svg>
    );
  }

  if (name === "target") {
    return (
      <svg {...baseProps}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
      </svg>
    );
  }

  if (name === "download") {
    return (
      <svg {...baseProps}>
        <path d="M12 4v12" />
        <path d="m8 12 4 4 4-4" />
        <path d="M5 20h14" />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg {...baseProps}>
        <path d="M4 12a8 8 0 1 0 2.3-5.6" />
        <path d="M4 5v4h4" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  return (
    <svg {...baseProps}>
      <path d="M12 3.5 13.7 9 19 10.7 13.7 12.4 12 18l-1.7-5.6L5 10.7 10.3 9 12 3.5Z" />
      <path d="M18.5 15.5 19 17l1.5.5L19 18l-.5 1.5L18 18l-1.5-.5L18 17l.5-1.5Z" />
    </svg>
  );
}

function getProfileFieldLabel(field: ProfileField, copy: ResumeHubCopy) {
  const labels: Record<ProfileField, string> = {
    business_skills: copy.businessSkills,
    career_goals: copy.careerGoals,
    education_background: copy.educationBackground,
    preferred_industries: copy.preferredIndustries,
    preferred_language: copy.preferredLanguage,
    target_regions: copy.targetRegions,
    target_roles: copy.targetRoles,
    technical_skills: copy.technicalSkills,
    work_experience: copy.workExperience,
    work_rights: copy.workRights
  };
  return labels[field];
}

function getFieldHelper(field: ProfileField, copy: ResumeHubCopy) {
  return copy.fieldHelpers[field];
}



function getFirstLocalizedItem(
  language: "en" | "zh",
  englishItems: string[],
  chineseItems: string[]
) {
  const items = language === "zh" ? chineseItems : englishItems;
  return items[0] || englishItems[0] || chineseItems[0] || "";
}

function getTailoringPreview(job: JobRecord, language: "en" | "zh") {
  if (language === "zh") {
    return (
      job.resume_tailoring_draft?.explanation_zh ||
      getFirstLocalizedItem(
        language,
        job.resume_tailoring_advice_en,
        job.resume_tailoring_advice_zh
      )
    );
  }

  return (
    job.resume_tailoring_draft?.summary_en ||
    getFirstLocalizedItem(
      language,
      job.resume_tailoring_advice_en,
      job.resume_tailoring_advice_zh
    )
  );
}

function jobHasTailoringSignal(job: JobRecord) {
  return (
    job.action_stage === "tailor_resume" ||
    job.action_stage === "ready_to_apply" ||
    job.tailoring_status === "draft_ready" ||
    job.tailoring_status === "reviewed" ||
    Boolean(job.resume_tailoring_draft) ||
    job.resume_tailoring_advice_en.length > 0 ||
    job.resume_tailoring_advice_zh.length > 0
  );
}

function compareTailoringJobs(a: JobRecord, b: JobRecord) {
  return (
    getTailoringRank(a) - getTailoringRank(b) ||
    b.match_score - a.match_score ||
    getTime(b.updated_at || b.created_at) - getTime(a.updated_at || a.created_at)
  );
}

function getTailoringRank(job: JobRecord) {
  if (job.action_stage === "tailor_resume") return 0;
  if (job.tailoring_status === "draft_ready") return 1;
  if (job.tailoring_status === "reviewed" || job.action_stage === "ready_to_apply") return 2;
  return 3;
}

function getTailoringStatusLabel(job: JobRecord, copy: ResumeHubCopy) {
  if (job.tailoring_status === "reviewed" || job.action_stage === "ready_to_apply") {
    return copy.tailoringReviewed;
  }

  if (job.tailoring_status === "draft_ready") {
    return copy.tailoringDraftReady;
  }

  if (job.action_stage === "tailor_resume") {
    return copy.tailoringNeeded;
  }

  return copy.tailoringReview;
}

function getTailoringNextStep(job: JobRecord, copy: ResumeHubCopy) {
  if (job.tailoring_status === "reviewed" || job.action_stage === "ready_to_apply") {
    return copy.tailoringNextReady;
  }

  if (job.resume_tailoring_draft) {
    return copy.tailoringNextReviewDraft;
  }

  return copy.tailoringNextCreateDraft;
}

function getTailoringAccentClass(job: JobRecord) {
  if (job.tailoring_status === "reviewed" || job.action_stage === "ready_to_apply") {
    return "bg-green-500";
  }

  if (job.tailoring_status === "draft_ready" || job.action_stage === "tailor_resume") {
    return "bg-app-accent";
  }

  return "bg-amber-500";
}

function getTime(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

type ResumeHubCopy = ReturnType<typeof getResumeHubCopy>;

function getResumeHubCopy(language: "en" | "zh") {
  if (language === "zh") {
    return {
      aiResumeWorkspace: "AI 简历工作台",
      aiSuggestions: "AI 建议",
      aiSuggestionsHelper: "来自本次真实简历分析",
      analysisReady: "简历分析已完成",
      analysisReadyDescription: "你可以查看提取到的优势、缺失信息，并选择是否应用到候选人画像。",
      analyzeJobsDescription: "返回工作台，从真实职位分析中查看简历优化方向。",
      analyzeRoles: "分析职位",
      analyzed: "已分析",
      applyToProfile: "应用到画像",
      applyToProfileDescription: "将本次简历分析生成的候选人画像保存到本地，并同步到云端账号。",
      applyToProfileTitle: "更新候选人画像",
      businessSkills: "商业与沟通能力",
      careerGoals: "职业目标",
      chooseResume: "选择简历文件",
      comingSoon: "暂未上线",
      confidence: "置信度",
      createResume: "创建简历",
      createResumeUnavailable: "当前没有独立简历编辑器，因此先保持禁用。",
      currentResume: "当前简历",
      currentSessionOnly: "这是当前会话中的真实上传文件。项目暂未提供持久化简历库。",
      creditNotice: "运行 AI 简历分析会消耗 {cost} 点。",
      educationBackground: "教育背景",
      exportResume: "导出简历",
      exportUnavailable: "当前没有真实导出流程，因此这里不会提供假按钮。",
      fieldsComplete: "项已完成",
      fieldHelpers: {
        business_skills: "用于判断商业理解、沟通协作和利益相关方管理能力。",
        career_goals: "用于生成建议和长期规划语境，不再计入匹配评分。",
        education_background: "用于匹配学历要求，例如 Bachelor、Master 或相关专业背景。",
        preferred_industries: "用于判断行业背景匹配度和推荐优先级。",
        preferred_language: "用于识别双语优势，以及英文 JD 的解释方式。",
        target_regions: "用于记录目标市场和工作权利相关风险，不再计入匹配评分。",
        target_roles: "用于生成求职建议和筛选语境，不再作为扣分维度。",
        technical_skills: "用于技能匹配和差距分析，例如 SQL、Python、Dashboarding。",
        work_experience: "用于判断经验年限、项目背景和职责范围匹配度。",
        work_rights: "用于识别 sponsorship、local experience、work rights 等风险信号。"
      },
      heroSubtitle: "上传 PDF 或 DOCX，Offerwise 会沿用现有简历分析接口和候选人画像同步逻辑。",
      heroTitle: "把简历变成可复用的求职资产",
      importProfile: "打开画像",
      libraryEmptyBody: "上传并分析一份简历后，当前会话中的文件会显示在这里。持久化简历库尚未实现。",
      libraryEmptyTitle: "暂无简历文件",
      librarySubtitle: "只显示真实上传或已保存的简历资产。",
      libraryTitle: "简历库",
      needsClarification: "缺失或不清晰的信息",
      noResumeAnalyzed: "尚未分析简历",
      noResumeDescription: "选择真实简历文件后，可以运行现有 AI 简历分析流程。",
      open: "打开",
      openJobForTailoring: "打开职位详情查看已有简历优化建议。",
      openResumeFit: "查看简历匹配",
      preferredIndustries: "偏好行业",
      preferredLanguage: "偏好语言",
      profileCompletion: "画像完整度",
      profileCoverageSubtitle: "补齐会直接影响匹配和简历定制质量的画像字段。",
      profileCoverageTitle: "画像补全清单",
      profileDescription: "继续编辑候选人画像，保持职位匹配输入准确。",
      profileEditorSubtitle: "画像就是经验资产库的结构化来源。保存后会用于后续 JD 分析和简历匹配。",
      profileEditorTitle: "候选人画像与经验资产",
      profileReadiness: "画像完整度",
      profileReadinessHelper: "基于真实候选人画像字段填写情况",
      profileSectionLabels: {
        basics: "基础方向",
        experience: "经历目标",
        skills: "技能背景"
      },
      profileSections: "画像分区",
      profileTaskComplete: "已完成",
      profileTaskMissing: (count: number) => `还差 ${count} 项`,
      resumeScoreDescription: "当前系统没有独立 ATS/Resume score 字段，因此不会展示虚构分数。",
      resumeScoreEmptyBody: "当后续有真实评分字段时，这里可以使用圆环分数展示。",
      resumeScoreEmptyTitle: "暂无真实简历分数",
      resumeScoreTitle: "简历评分",
      resumeStatus: "简历状态",
      resetProfile: "重置画像",
      reviewProfile: "编辑画像",
      saveProfile: "保存画像",
      strengths: "提取到的优势",
      suggestionsEmptyBody: "运行简历分析后，这里会显示 AI 从简历中提取的真实优势和缺失信息。",
      suggestionsEmptyTitle: "暂无 AI 建议",
      suggestionsSubtitle: "只来自现有简历分析接口返回的数据。",
      suggestionsTitle: "AI 建议",
      subtitle: "构建、改进并针对每个机会调整你的简历资产。",
      tailoringDraftReady: "草稿已生成",
      tailoringEmptyBody: "分析或保存职位后，这里会列出需要改简历、已有草稿或可投递检查的机会。",
      tailoringEmptyTitle: "暂无职位可用于定制",
      tailoringNeeded: "需要改简历",
      tailoringNextCreateDraft: "打开职位详情生成或整理定制草稿。",
      tailoringNextReady: "草稿已确认，可以做最终投递检查。",
      tailoringNextReviewDraft: "检查 summary、bullets 和关键词后标记 reviewed。",
      tailoringReview: "待检查",
      tailoringReviewed: "已 reviewed",
      tailoringSummaryBody: "这些岗位已经有简历优化方向，适合逐个进入职位详情确认。",
      tailoringSummarySubtitle: "这里只看待处理数量，具体修改在职位详情完成。",
      tailoringSummaryTitle: "待定制岗位",
      tailoringSubtitle: "优先显示需要改简历、草稿已生成或已进入投递检查的机会。",
      tailoringTitle: "岗位简历定制队列",
      targetRegions: "目标地区",
      targetRoles: "目标角色",
      technicalSkills: "技术技能",
      title: "简历中心",
      trackedRoles: "个职位",
      uploadDescription: "使用现有简历分析流程提取画像、优势和缺失信息。",
      uploadResume: "上传简历",
      vaultEmptyBody: "填写画像或分析简历后，经验、技能和目标会作为资产出现在这里。",
      vaultEmptyTitle: "暂无经验资产",
      vaultSubtitle: "复用候选人画像中的真实经历、技能和目标。",
      vaultTitle: "经验资产库",
      versionEmptyBody: "项目当前没有简历版本历史数据模型，因此这里保持为空。",
      versionEmptyTitle: "暂无版本记录",
      versionSubtitle: "只展示真实版本记录，不创建静态历史。",
      versionTitle: "版本历史",
      workExperience: "工作经历",
      workRights: "工作权利"
    };
  }

  return {
    aiResumeWorkspace: "AI resume workspace",
    aiSuggestions: "AI suggestions",
    aiSuggestionsHelper: "From the current real resume analysis",
    analysisReady: "Resume analysis ready",
    analysisReadyDescription: "Review extracted strengths, missing details, and apply them to your candidate profile when ready.",
    analyzeJobsDescription: "Return to the workspace and use real role analyses for resume focus areas.",
    analyzeRoles: "Analyze roles",
    analyzed: "Analyzed",
    applyToProfile: "Apply to profile",
    applyToProfileDescription: "Save the candidate profile generated by this analysis locally and sync it to your account.",
    applyToProfileTitle: "Update candidate profile",
    businessSkills: "Business skills",
    careerGoals: "Career goals",
    chooseResume: "Choose resume file",
    comingSoon: "Coming soon",
    confidence: "Confidence",
    createResume: "Create resume",
    createResumeUnavailable: "No dedicated resume editor exists yet, so this stays disabled.",
    currentResume: "Current resume",
    currentSessionOnly: "This is the real file uploaded in this session. A persistent resume library has not been implemented yet.",
    creditNotice: "Running AI resume analysis uses {cost} credit.",
    educationBackground: "Education background",
    exportResume: "Export resume",
    exportUnavailable: "No real export workflow exists yet, so this action is intentionally disabled.",
    fieldsComplete: "fields complete",
    fieldHelpers: {
      business_skills: "Used for business understanding, collaboration, and stakeholder communication fit.",
      career_goals: "Used for advice and long-term context; no longer counted in match scoring.",
      education_background: "Used for education requirement matching, such as Bachelor, Master, or relevant study background.",
      preferred_industries: "Used for industry background fit and recommendation priority.",
      preferred_language: "Used for bilingual advantage detection and English JD interpretation.",
      target_regions: "Used for target market context and work-rights risk; no longer counted in match scoring.",
      target_roles: "Used for search context and advice; no longer treated as a scoring dimension.",
      technical_skills: "Used for technical skill gap analysis, such as SQL, Python, and dashboarding.",
      work_experience: "Used for years of experience, project background, and responsibility fit.",
      work_rights: "Used for sponsorship, local experience, and work-rights risk signals."
    },
    heroSubtitle: "Upload a PDF or DOCX. Offerwise reuses the existing resume analysis API and candidate profile sync path.",
    heroTitle: "Turn your resume into a reusable career asset",
    importProfile: "Open profile",
    libraryEmptyBody: "After you upload and analyze a resume, the current session file appears here. Persistent resume storage is not implemented yet.",
    libraryEmptyTitle: "No resume files yet",
    librarySubtitle: "Shows only real uploaded or stored resume assets.",
    libraryTitle: "Resume library",
    needsClarification: "Missing or unclear information",
    noResumeAnalyzed: "No resume analyzed",
    noResumeDescription: "Choose a real resume file to run the existing AI resume analysis flow.",
    open: "Open",
    openJobForTailoring: "Open the job detail to review existing resume tailoring advice.",
    openResumeFit: "Open Resume Fit",
    preferredIndustries: "Preferred industries",
    preferredLanguage: "Preferred language",
    profileCompletion: "Profile completion",
    profileCoverageSubtitle: "Complete the fields that improve matching and resume tailoring quality.",
    profileCoverageTitle: "Profile checklist",
    profileDescription: "Continue editing your candidate profile so matching inputs stay accurate.",
    profileEditorSubtitle: "The candidate profile is now the structured source for experience assets. Saved fields power future JD analysis and resume matching.",
    profileEditorTitle: "Candidate profile and experience assets",
    profileReadiness: "Profile readiness",
    profileReadinessHelper: "Based on real candidate profile fields",
    profileSectionLabels: {
      basics: "Basics",
      experience: "Experience",
      skills: "Skills"
    },
    profileSections: "Profile sections",
    profileTaskComplete: "Ready",
    profileTaskMissing: (count: number) => `${count} ${count === 1 ? "field" : "fields"} left`,
    resumeScoreDescription: "The current system has no ATS/resume score field, so no invented score is shown.",
    resumeScoreEmptyBody: "When a real score field exists, this panel can use the circular score display.",
    resumeScoreEmptyTitle: "No real resume score yet",
    resumeScoreTitle: "Resume score",
    resumeStatus: "Resume status",
    resetProfile: "Reset profile",
    reviewProfile: "Edit profile",
    saveProfile: "Save profile",
    strengths: "Extracted strengths",
    suggestionsEmptyBody: "Run a resume analysis to show strengths and missing details returned by the existing AI flow.",
    suggestionsEmptyTitle: "No AI suggestions yet",
    suggestionsSubtitle: "Only data returned by the existing resume analysis endpoint.",
    suggestionsTitle: "AI suggestions",
    subtitle: "Build, improve, and tailor your resume for every opportunity.",
    tailoringDraftReady: "Draft ready",
    tailoringEmptyBody: "Analyze or save jobs and roles needing tailoring, draft review, or final checks will appear here.",
    tailoringEmptyTitle: "No jobs available for tailoring",
    tailoringNeeded: "Tailor resume",
    tailoringNextCreateDraft: "Open the job detail to create or refine a tailored draft.",
    tailoringNextReady: "Draft reviewed. Move into the final application check.",
    tailoringNextReviewDraft: "Review summary, bullets, and keywords, then mark reviewed.",
    tailoringReview: "Needs review",
    tailoringReviewed: "Reviewed",
    tailoringSummaryBody: "These roles already have resume focus areas ready for review in job details.",
    tailoringSummarySubtitle: "Shows only the workload count; edits happen in job details.",
    tailoringSummaryTitle: "Roles to tailor",
    tailoringSubtitle: "Prioritizes roles needing resume edits, draft review, or final application checks.",
    tailoringTitle: "Role tailoring queue",
    targetRegions: "Target regions",
    targetRoles: "Target roles",
    technicalSkills: "Technical skills",
    title: "Resume Hub",
    trackedRoles: "tracked roles",
    uploadDescription: "Use the existing resume analysis flow to extract profile, strengths, and missing details.",
    uploadResume: "Upload resume",
    vaultEmptyBody: "Fill your profile or analyze a resume and experience, skills, and goals will appear here as assets.",
    vaultEmptyTitle: "No experience assets yet",
    vaultSubtitle: "Reuses real experience, skills, and goals from the candidate profile.",
    vaultTitle: "Experience vault",
    versionEmptyBody: "The project currently has no resume version history data model, so this stays empty.",
    versionEmptyTitle: "No version records",
    versionSubtitle: "Shows only real version records, not static history.",
    versionTitle: "Version history",
    workExperience: "Work experience",
    workRights: "Work rights"
  };
}
