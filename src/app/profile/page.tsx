"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form-controls";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  loadCandidateProfile,
  resetCandidateProfile,
  saveCandidateProfile
} from "@/lib/storage/candidate-profile";
import { CandidateProfile, ResumeProfileAnalysis } from "@/types/job";

type ProfileField = keyof CandidateProfile;

const PROFILE_FIELDS: ProfileField[] = [
  "target_regions",
  "target_roles",
  "education_background",
  "degree_direction",
  "technical_skills",
  "business_skills",
  "tools",
  "work_experience",
  "work_rights",
  "preferred_industries",
  "preferred_language",
  "career_goals"
];

type ResumeAnalysisResponse = {
  analysis?: ResumeProfileAnalysis;
  file_name?: string;
  extracted_text_preview?: string;
  was_truncated?: boolean;
  error?: string;
};

export default function CandidateProfilePage() {
  const { t, confidences, language } = useLanguage();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [message, setMessage] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeAnalysis, setResumeAnalysis] =
    useState<ResumeProfileAnalysis | null>(null);
  const [resumePreview, setResumePreview] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeWasTruncated, setResumeWasTruncated] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProfile(loadCandidateProfile());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const updateField = (field: ProfileField, value: string) => {
    setProfile((current) => (current ? { ...current, [field]: value } : current));
    setMessage("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      return;
    }

    saveCandidateProfile(profile);
    setProfile(loadCandidateProfile());
    setMessage(t.profileSaved);
  };

  const handleReset = () => {
    const nextProfile = resetCandidateProfile();
    setProfile(nextProfile);
    setMessage(t.profileReset);
  };

  const handleResumeFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setResumeFile(file);
    setResumeAnalysis(null);
    setResumePreview("");
    setResumeFileName(file?.name || "");
    setResumeWasTruncated(false);
    setResumeError("");
    setMessage("");
  };

  const handleAnalyzeResume = async () => {
    if (!profile || !resumeFile) {
      setResumeError(t.resumeFileRequired);
      return;
    }

    setIsAnalyzingResume(true);
    setResumeError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("current_profile", JSON.stringify(profile));

      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as ResumeAnalysisResponse;

      if (!response.ok || !payload.analysis) {
        throw new Error(payload.error || t.resumeAnalysisFailed);
      }

      setResumeAnalysis(payload.analysis);
      setResumePreview(payload.extracted_text_preview || "");
      setResumeFileName(payload.file_name || resumeFile.name);
      setResumeWasTruncated(Boolean(payload.was_truncated));
      setMessage(t.resumeAnalysisReady);
    } catch (error) {
      setResumeError(
        error instanceof Error ? error.message : t.resumeAnalysisFailed
      );
    } finally {
      setIsAnalyzingResume(false);
    }
  };

  const handleApplyResumeProfile = () => {
    if (!resumeAnalysis) {
      return;
    }

    saveCandidateProfile(resumeAnalysis.candidate_profile);
    setProfile(loadCandidateProfile());
    setMessage(t.resumeProfileApplied);
    setResumeError("");
  };

  if (!profile) {
    return (
      <div className="rounded-panel border border-line bg-white p-6 shadow-soft">
        {t.analyzing}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t.candidateProfile}</h1>
        <p className="mt-1 text-sm text-muted">{t.profileIntro}</p>
      </div>

      {message ? (
        <div className="rounded-app border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="space-y-4 rounded-panel border border-line bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {t.generateProfileFromResume}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {t.resumeUploadIntro}
            </p>
          </div>
          <Badge>{t.supportedResumeFormats}</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Field label={t.resumeFile}>
            <Input
              type="file"
              accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleResumeFileChange}
            />
          </Field>
          <Button
            type="button"
            onClick={handleAnalyzeResume}
            disabled={!resumeFile || isAnalyzingResume}
          >
            {isAnalyzingResume ? t.analyzingResume : t.analyzeResume}
          </Button>
        </div>

        {resumeError ? (
          <div className="rounded-app border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {resumeError}
          </div>
        ) : null}

        {resumeAnalysis ? (
          <div className="space-y-4 rounded-panel border border-line bg-surface-muted p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  {t.resumeProfileDraft}
                </h3>
                {resumeFileName ? (
                  <p className="mt-1 text-sm text-muted">{resumeFileName}</p>
                ) : null}
              </div>
              <Badge>
                {t.confidence}: {confidences[resumeAnalysis.confidence]}
              </Badge>
            </div>

            <div className="rounded-panel border border-line bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t.profileSummary}
              </p>
              <p className="mt-2 text-sm leading-6 text-ink">
                {language === "zh"
                  ? resumeAnalysis.profile_summary_zh
                  : resumeAnalysis.profile_summary_en}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <ListPanel
                title={t.extractedStrengths}
                items={resumeAnalysis.extracted_strengths}
              />
              <ListPanel
                title={t.missingOrUnclearInfo}
                items={resumeAnalysis.missing_or_unclear_information}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {PROFILE_FIELDS.map((field) => (
                <div
                  key={field}
                  className="rounded-panel border border-line bg-white p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {getProfileFieldLabel(field, t)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-ink">
                    {resumeAnalysis.candidate_profile[field]}
                  </p>
                </div>
              ))}
            </div>

            {resumeWasTruncated ? (
              <div className="rounded-app border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t.resumeWasTruncated}
              </div>
            ) : null}

            {resumePreview ? (
              <details className="rounded-panel border border-line bg-white p-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink">
                  {t.resumeTextPreview}
                </summary>
                <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted">
                  {resumePreview}
                </pre>
              </details>
            ) : null}

            <div className="flex justify-end">
              <Button type="button" onClick={handleApplyResumeProfile}>
                {t.applyResumeProfile}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-panel border border-line bg-white p-4 shadow-soft sm:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {PROFILE_FIELDS.map((field) => (
            <Field key={field} label={getProfileFieldLabel(field, t)}>
              <Textarea
                value={profile[field]}
                onChange={(event) => updateField(field, event.target.value)}
                rows={field === "career_goals" || field === "work_experience" ? 4 : 3}
              />
            </Field>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={handleReset}>
            {t.resetProfile}
          </Button>
          <Button type="submit">{t.saveProfile}</Button>
        </div>
      </form>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-panel border border-line bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-ink">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">-</p>
      )}
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function getProfileFieldLabel(
  field: ProfileField,
  t: ReturnType<typeof useLanguage>["t"]
) {
  const labels: Record<ProfileField, string> = {
    target_regions: t.targetRegions,
    target_roles: t.targetRoles,
    education_background: t.educationBackground,
    degree_direction: t.degreeDirection,
    technical_skills: t.technicalSkills,
    business_skills: t.businessSkills,
    tools: t.tools,
    work_experience: t.workExperience,
    work_rights: t.workRights,
    preferred_industries: t.preferredIndustries,
    preferred_language: t.preferredLanguage,
    career_goals: t.careerGoals
  };

  return labels[field];
}
