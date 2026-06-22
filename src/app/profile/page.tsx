"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form-controls";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  loadCandidateProfile,
  resetCandidateProfile,
  saveCandidateProfile
} from "@/lib/storage/candidate-profile";
import { CandidateProfile } from "@/types/job";

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

export default function CandidateProfilePage() {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [message, setMessage] = useState("");

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

  if (!profile) {
    return <div className="rounded-md border border-line bg-white p-6">{t.analyzing}</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{t.candidateProfile}</h1>
        <p className="mt-1 text-sm text-muted">{t.profileIntro}</p>
      </div>

      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-md border border-line bg-white p-4 shadow-soft sm:p-5"
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
