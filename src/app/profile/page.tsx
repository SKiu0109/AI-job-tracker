"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/form-controls";
import { useAuth } from "@/lib/auth/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  hydrateCandidateProfileFromCloud,
  upsertCloudCandidateProfile
} from "@/lib/storage/cloud-sync";
import {
  loadCandidateProfile,
  resetCandidateProfile,
  saveCandidateProfile
} from "@/lib/storage/candidate-profile";
import type { CandidateProfile, ResumeProfileAnalysis } from "@/types/job";

type ProfileField = keyof CandidateProfile;

type TabKey = "basic" | "skills" | "experience";

/* ---- Tab / Section Definitions ---- */
const TAB_SECTIONS: { key: TabKey; fields: ProfileField[] }[] = [
  {
    key: "basic",
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

type ResumeAnalysisResponse = {
  analysis?: ResumeProfileAnalysis;
  file_name?: string;
  extracted_text_preview?: string;
  was_truncated?: boolean;
  error?: string;
};

export default function CandidateProfilePage() {
  const { session } = useAuth();
  const { t, confidences, language } = useLanguage();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [message, setMessage] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeProfileAnalysis | null>(null);
  const [resumePreview, setResumePreview] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeWasTruncated, setResumeWasTruncated] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [aiFilledFields, setAiFilledFields] = useState<Set<ProfileField>>(new Set());
  const [resumeExpanded, setResumeExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      hydrateCandidateProfileFromCloud(session).then(setProfile);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session]);

  const updateField = (field: ProfileField, value: string) => {
    setProfile((cur) => (cur ? { ...cur, [field]: value } : cur));
    setMessage("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    saveCandidateProfile(profile);
    setProfile(loadCandidateProfile());
    void upsertCloudCandidateProfile(session, profile);
    setMessage(t.profileSaved);
  };

  const handleReset = () => {
    const nextProfile = resetCandidateProfile();
    setProfile(nextProfile);
    setAiFilledFields(new Set());
    void upsertCloudCandidateProfile(session, nextProfile);
    setMessage(t.profileReset);
  };

  const handleResumeFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setResumeFile(file); setResumeAnalysis(null);
    setResumePreview(""); setResumeFileName(file?.name || "");
    setResumeWasTruncated(false); setResumeError(""); setMessage("");
    setResumeExpanded(false);
  };

  const handleAnalyzeResume = async () => {
    if (!profile || !resumeFile) { setResumeError(t.resumeFileRequired); return; }
    setIsAnalyzingResume(true); setResumeError(""); setMessage("");
    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("current_profile", JSON.stringify(profile));
      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: session?.access_token
          ? { authorization: `Bearer ${session.access_token}` }
          : undefined,
        body: formData
      });
      const payload = (await response.json().catch(() => ({}))) as ResumeAnalysisResponse;
      if (!response.ok || !payload.analysis) throw new Error(payload.error || t.resumeAnalysisFailed);
      setResumeAnalysis(payload.analysis);
      setResumePreview(payload.extracted_text_preview || "");
      setResumeFileName(payload.file_name || resumeFile.name);
      setResumeWasTruncated(Boolean(payload.was_truncated));
      setMessage(t.resumeAnalysisReady);
    } catch (error) {
      setResumeError(error instanceof Error ? error.message : t.resumeAnalysisFailed);
    } finally { setIsAnalyzingResume(false); }
  };

  const handleApplyResumeProfile = () => {
    if (!resumeAnalysis || !profile) return;

    // Track which fields were changed by resume analysis
    const updated: Set<ProfileField> = new Set();
    for (const field of Object.keys(resumeAnalysis.candidate_profile) as ProfileField[]) {
      if (resumeAnalysis.candidate_profile[field] !== profile[field]) {
        updated.add(field);
      }
    }
    setAiFilledFields(updated);

    saveCandidateProfile(resumeAnalysis.candidate_profile);
    setProfile(loadCandidateProfile());
    void upsertCloudCandidateProfile(session, resumeAnalysis.candidate_profile);
    setMessage(t.resumeProfileApplied);
    setResumeError("");
    setResumeExpanded(false);
  };

  /* ---- Derived data ---- */
  const activeSection = TAB_SECTIONS.find((s) => s.key === activeTab)!;

  const totalFields = useMemo(() => {
    let count = 0;
    for (const section of TAB_SECTIONS) {
      for (const field of section.fields) {
        if (profile?.[field]?.trim()) count++;
      }
    }
    return count;
  }, [profile]);

  const totalFieldCount = TAB_SECTIONS.reduce((sum, s) => sum + s.fields.length, 0);
  const completionPercent = Math.round((totalFields / totalFieldCount) * 100);

  const sectionCount = (key: TabKey) => {
    const sec = TAB_SECTIONS.find((s) => s.key === key)!;
    return sec.fields.filter((f) => profile?.[f]?.trim()).length;
  };

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-sm text-secondary">{t.analyzing}</p>
      </div>
    );
  }

  const tabLabels: Record<TabKey, string> = {
    basic: t.basicInfo,
    skills: t.skillsEducation,
    experience: t.experienceGoals
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ── Header + Completeness ── */}
      <div className="rounded-xl border border-black/[0.04] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-[22px] font-semibold tracking-tight text-primary">{t.candidateProfile}</h1>
            <p className="mt-1 text-[14px] text-secondary">{t.profileIntro}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                language === "zh" ? "用于匹配评分" : "Match scoring",
                language === "zh" ? "用于技能差距" : "Skill gaps",
                language === "zh" ? "用于签证风险" : "Visa risk",
                language === "zh" ? "用于行动建议" : "Next actions",
              ].map((chip) => (
                <span key={chip} className="rounded-full border border-accent/[0.08] bg-accent-subtle/30 px-2.5 py-1 text-[11px] font-medium text-accent/80">{chip}</span>
              ))}
            </div>
          </div>
          {/* Completeness card */}
          <div className="shrink-0 rounded-xl border border-black/[0.04] bg-[#FAFAFA] px-5 py-4 sm:min-w-[160px] sm:text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-secondary/50">{t.profileCompletion}</p>
            <p className="mt-1 text-[28px] font-semibold tracking-tight text-primary">{completionPercent}%</p>
            <p className="text-[12px] text-secondary/60">
              {completionPercent === 100
                ? (language === "zh" ? "可用于精准匹配" : "Ready for matching")
                : (language === "zh" ? `${totalFields}/${totalFieldCount} 项已完成` : `${totalFields}/${totalFieldCount} completed`)}
            </p>
            <div className="mt-3 flex flex-col gap-1 text-[11px]">
              {TAB_SECTIONS.map((s) => {
                const filled = sectionCount(s.key);
                const done = filled === s.fields.length;
                return (
                  <span key={s.key} className={`inline-flex items-center gap-1.5 ${done ? "text-green-600" : "text-secondary/40"}`}>
                    {done ? "✓" : "—"} {tabLabels[s.key]}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Message ── */}
      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50/60 px-4 py-3 text-[13px] text-green-700">{message}</div>
      ) : null}

      {/* ── Resume Upload ── */}
      <section className="rounded-xl border border-black/[0.04] bg-white p-5 shadow-sm">
        <h2 className="text-[16px] font-semibold text-primary">{t.generateProfileFromResume}</h2>
        <p className="mt-1 text-[13px] text-secondary">{t.resumeUploadIntro}</p>

        {/* Custom upload area */}
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-black/[0.06] bg-[#FAFAFA] px-6 py-10 text-center transition-colors hover:border-accent/20 hover:bg-accent-subtle/10">
          <svg className="h-8 w-8 text-black/[0.12]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M12 16V4M8 8l4-4 4 4M20 16v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3" />
          </svg>
          <p className="mt-3 text-[14px] font-medium text-secondary">
            {resumeFileName
              ? resumeFileName
              : (language === "zh" ? "拖拽简历到这里，或点击选择文件" : "Drop resume here or click to browse")}
          </p>
          <p className="mt-1 text-[12px] text-secondary/40">
            {language === "zh" ? "支持 .docx 和可复制文字的 PDF；暂不支持扫描版 PDF。" : "Supports .docx and text-based PDF."}
          </p>
          <input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeFileChange} className="sr-only" />
        </label>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-secondary/35">{language === "zh" ? "文件仅用于本次分析，不会保存原始文件。" : "Files are analyzed server-side. Originals are not saved."}</p>
          <Button type="button" onClick={handleAnalyzeResume} disabled={!resumeFile || isAnalyzingResume}>
            {isAnalyzingResume ? t.analyzingResume : t.analyzeResume}
          </Button>
        </div>

        {resumeError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-[13px] text-red-700">{resumeError}</div>
        ) : null}

        {resumeAnalysis ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-black/[0.04] bg-[#FAFAFA]">
            <button type="button" onClick={() => setResumeExpanded((v) => !v)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 16 16"><path d="M5 8.5l2 2 4-5M13.5 8a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0z"/></svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-primary">
                  {t.resumeAppliedFields.replace("{count}", String(Object.keys(resumeAnalysis.candidate_profile).filter(k => resumeAnalysis.candidate_profile[k as ProfileField]?.trim()).length))}
                </p>
                {resumeFileName ? <p className="truncate text-[12px] text-secondary">{resumeFileName}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-black/[0.06] bg-white px-2 py-0.5 text-[11px] text-secondary">{t.confidence}: {confidences[resumeAnalysis.confidence]}</span>
                <svg className={`h-4 w-4 shrink-0 text-secondary/40 transition-transform ${resumeExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3"/></svg>
              </div>
            </button>
            {resumeExpanded ? (
              <div className="space-y-4 border-t border-black/[0.04] px-5 py-4">
                <div className="rounded-lg border border-black/[0.04] bg-white p-3">
                  <p className="text-[11px] font-medium text-secondary/60 uppercase tracking-wide">{t.profileSummary}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-primary">{language === "zh" ? resumeAnalysis.profile_summary_zh : resumeAnalysis.profile_summary_en}</p>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <ListPanel title={t.extractedStrengths} items={resumeAnalysis.extracted_strengths} />
                  <ListPanel title={t.missingOrUnclearInfo} items={resumeAnalysis.missing_or_unclear_information} />
                </div>
                {resumeWasTruncated ? <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-[13px] text-amber-700">{t.resumeWasTruncated}</div> : null}
                {resumePreview ? (
                  <details className="rounded-lg border border-black/[0.04] bg-white p-3">
                    <summary className="cursor-pointer text-[13px] font-semibold text-primary">{t.resumeTextPreview}</summary>
                    <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-5 text-secondary">{resumePreview}</pre>
                  </details>
                ) : null}
                <div className="flex justify-end">
                  <Button type="button" onClick={handleApplyResumeProfile}>{t.applyResumeProfile}</Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ── Manual adjust header ── */}
      <div>
        <h2 className="text-[16px] font-semibold text-primary">{language === "zh" ? "手动调整画像" : "Refine Manually"}</h2>
        <p className="mt-1 text-[13px] text-secondary">{language === "zh" ? "检查或修改 AI 生成的画像，让后续分析更符合你的真实目标。" : "Review or adjust the profile so analysis aligns with your actual goals."}</p>
      </div>

      {/* ── Tabbed Profile Form ── */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-black/[0.04] bg-white shadow-sm">
        <div className="flex border-b border-black/[0.04]">
          {TAB_SECTIONS.map((section) => {
            const filled = sectionCount(section.key);
            const count = section.fields.length;
            const done = filled === count;
            return (
              <button key={section.key} type="button" onClick={() => setActiveTab(section.key)}
                className={`relative flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium transition-colors duration-150 ${
                  activeTab === section.key ? "text-accent" : "text-secondary hover:text-primary"
                }`}>
                {tabLabels[section.key]}
                {done ? (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[9px] font-bold text-green-600">✓</span>
                ) : (
                  <span className="text-[11px] text-secondary/40">{filled}/{count}</span>
                )}
                {activeTab === section.key ? <span className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-accent" /> : null}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          <div className="grid gap-x-5 gap-y-6 lg:grid-cols-2">
            {activeSection.fields.map((field) => {
              const isAiField = aiFilledFields.has(field);
              return (
                <div key={field} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{getProfileFieldLabel(field, t)}</Label>
                    {isAiField ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50/60 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 10 10"><path d="M1 5l3 3 5-6"/></svg>
                        {t.aiFilled}
                      </span>
                    ) : null}
                  </div>
                  <Textarea
                    value={profile[field]}
                    onChange={(event) => updateField(field, event.target.value)}
                    rows={field === "career_goals" || field === "work_experience" ? 4 : 3}
                    className={isAiField ? "border-green-200 bg-green-50/20" : undefined}
                  />
                  <p className="text-[12px] leading-relaxed text-secondary/45">{getFieldHelper(field, language)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-black/[0.04] px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={handleReset}>{t.resetProfile}</Button>
          <Button type="submit">{t.saveProfile}</Button>
        </div>
      </form>
    </div>
  );
}

/* ---- Helper Components ---- */

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-tertiary p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary">
        {title}
      </p>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-primary">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-secondary">-</p>
      )}
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
    technical_skills: t.technicalSkills,
    business_skills: t.businessSkills,
    work_experience: t.workExperience,
    work_rights: t.workRights,
    preferred_industries: t.preferredIndustries,
    preferred_language: t.preferredLanguage,
    career_goals: t.careerGoals
  };
  return labels[field];
}

function getFieldHelper(field: ProfileField, language: "en" | "zh") {
  if (language === "zh") {
    const helpers: Record<ProfileField, string> = {
      target_regions: "用于判断地点匹配和目标市场优先级。",
      target_roles: "用于判断岗位方向是否与你的求职目标一致。",
      preferred_industries: "用于判断行业背景匹配度和推荐优先级。",
      preferred_language: "用于识别双语优势和英文 JD 解释方式。",
      work_rights: "用于识别 sponsorship、local experience、work rights 等风险信号。",
      education_background: "用于匹配学历要求，如 Bachelor/Master 等。",
      technical_skills: "用于技能匹配分析，如 SQL、Python、Dashboarding 等。",
      business_skills: "用于商业/沟通能力匹配，如 Stakeholder communication 等。",
      work_experience: "用于经验年限和项目背景匹配。",
      career_goals: "用于职业方向匹配和长期适配度判断。",
    };
    return helpers[field];
  }
  const helpers: Record<ProfileField, string> = {
    target_regions: "Used for location matching and market priority.",
    target_roles: "Used for role direction matching against your career goals.",
    preferred_industries: "Used for industry background fit and recommendation priority.",
    preferred_language: "Used for bilingual advantage detection and JD interpretation.",
    work_rights: "Used for sponsorship, local experience, and work rights risk signals.",
    education_background: "Used for education requirement matching (e.g., Bachelor/Master).",
    technical_skills: "Used for technical skill gap analysis (e.g., SQL, Python, Dashboarding).",
    business_skills: "Used for business/communication fit (e.g., Stakeholder communication).",
    work_experience: "Used for years of experience and project background matching.",
    career_goals: "Used for career direction fit and long-term alignment.",
  };
  return helpers[field];
}
