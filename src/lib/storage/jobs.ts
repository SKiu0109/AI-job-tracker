"use client";

import {
  APPLICATION_RECOMMENDATIONS,
  ApplicationRecommendation,
  ApplicationStatus,
  CONFIDENCE_LEVELS,
  ConfidenceLevel,
  JobAnalysis,
  JobRecord,
  MATCH_SCORE_DIMENSIONS,
  MatchScoreBreakdown,
  MissingSkillDetail,
  NEXT_ACTIONS,
  NextActionLabel,
  PRIORITY_LEVELS,
  PriorityLevel,
  RecommendedNextAction,
  ScoreDimension,
  StatusTimelineItem,
  WorkMode,
  WORK_MODES
} from "@/types/job";
import { clampScore } from "@/lib/utils";

const JOBS_STORAGE_KEY = "ai-bilingual-job-tracker.jobs.v1";
const ANALYSIS_CACHE_KEY = "ai-bilingual-job-tracker.analysis-cache.v1";

type AnalysisCache = Record<
  string,
  {
    analysis: JobAnalysis;
    createdAt: string;
  }
>;

export function loadJobs(): JobRecord[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(JOBS_STORAGE_KEY);
    const jobs = raw ? (JSON.parse(raw) as JobRecord[]) : [];
    return Array.isArray(jobs) ? jobs.map(normalizeStoredJob) : [];
  } catch {
    return [];
  }
}

export function getStoredJob(id: string) {
  return loadJobs().find((job) => job.id === id);
}

export function saveJob(job: JobRecord) {
  const jobs = loadJobs();
  const nextJobs = [
    normalizeStoredJob(job),
    ...jobs.filter((item) => item.id !== job.id)
  ];
  saveJobs(nextJobs);
}

export function updateStoredJobStatus(
  id: string,
  status: ApplicationStatus,
  note = ""
) {
  const jobs = loadJobs();
  const now = new Date().toISOString();
  const nextJobs = jobs.map((job) => {
    if (job.id !== id) {
      return job;
    }

    const statusChanged = job.application_status !== status;

    return normalizeStoredJob({
      ...job,
      application_status: status,
      updated_at: now,
      status_history:
        statusChanged || note.trim()
          ? createStatusHistorySnapshot(
              job.status_history,
              status,
              now,
              note,
              job.created_at
            )
          : job.status_history
    });
  });

  saveJobs(nextJobs);
  return nextJobs.find((job) => job.id === id);
}

export function updateStoredJob(
  id: string,
  updates: Partial<JobRecord>,
  statusNote = ""
) {
  const jobs = loadJobs();
  const now = new Date().toISOString();
  let updatedJob: JobRecord | undefined;

  const nextJobs = jobs.map((job) => {
    if (job.id !== id) {
      return job;
    }

    const nextStatus = updates.application_status ?? job.application_status;
    const statusChanged = nextStatus !== job.application_status;
    const nextJob = normalizeStoredJob({
      ...job,
      ...updates,
      application_status: nextStatus,
      updated_at: now,
      status_history:
        statusChanged || statusNote.trim()
          ? createStatusHistorySnapshot(
              job.status_history,
              nextStatus,
              now,
              statusNote,
              job.created_at
            )
          : job.status_history
    });

    updatedJob = nextJob;
    return nextJob;
  });

  saveJobs(nextJobs);
  return updatedJob;
}

export function deleteStoredJob(id: string) {
  saveJobs(loadJobs().filter((job) => job.id !== id));
}

export function saveJobs(jobs: JobRecord[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    JOBS_STORAGE_KEY,
    JSON.stringify(jobs.map(normalizeStoredJob))
  );
}

export function createAnalysisCacheKey(rawJd: string, candidateProfile = "") {
  const normalized = `${rawJd}\n${candidateProfile}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  let hash = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) | 0;
  }

  return `${normalized.length}:${Math.abs(hash).toString(36)}`;
}

export function readCachedAnalysis(cacheKey: string) {
  return readAnalysisCache()[cacheKey]?.analysis;
}

export function writeCachedAnalysis(cacheKey: string, analysis: JobAnalysis) {
  const cache = readAnalysisCache();
  cache[cacheKey] = {
    analysis,
    createdAt: new Date().toISOString()
  };

  if (canUseStorage()) {
    window.localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(cache));
  }
}

export function createInitialStatusHistory(
  createdAt: string,
  status: ApplicationStatus = "Not Applied"
): StatusTimelineItem[] {
  return [
    createTimelineItem(status, createdAt),
    createTimelineItem("Job added", createdAt)
  ];
}

function readAnalysisCache(): AnalysisCache {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(ANALYSIS_CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as AnalysisCache) : {};
    return cache && typeof cache === "object" ? cache : {};
  } catch {
    return {};
  }
}

function normalizeStoredJob(job: JobRecord): JobRecord {
  const now = new Date().toISOString();
  const matchScore = clampScore(job.match_score);
  const skills = asStringArray(job.skills);
  const tools = asStringArray(job.tools);
  const createdAt = asString(job.created_at, now);
  const updatedAt = asString(job.updated_at, createdAt);
  const status = asApplicationStatus(job.application_status);

  return {
    ...job,
    company: asString(job.company, "Not specified"),
    job_title_original: asString(job.job_title_original, "Not specified"),
    job_title_zh: asString(job.job_title_zh, "Not specified"),
    location: asString(job.location, "Not specified"),
    work_mode: asWorkMode(job.work_mode),
    job_type_en: asString(job.job_type_en, "Not specified"),
    job_type_zh: asString(job.job_type_zh, "Not specified"),
    education_requirement_en: asString(
      job.education_requirement_en,
      "Not specified"
    ),
    education_requirement_zh: asString(
      job.education_requirement_zh,
      "Not specified"
    ),
    experience_requirement_en: asString(
      job.experience_requirement_en,
      "Not specified"
    ),
    experience_requirement_zh: asString(
      job.experience_requirement_zh,
      "Not specified"
    ),
    skills,
    tools,
    responsibilities_en: asStringArray(job.responsibilities_en),
    responsibilities_zh: asStringArray(job.responsibilities_zh),
    requirements_en: asStringArray(job.requirements_en),
    requirements_zh: asStringArray(job.requirements_zh),
    nice_to_have_en: asStringArray(job.nice_to_have_en),
    nice_to_have_zh: asStringArray(job.nice_to_have_zh),
    match_score: matchScore,
    match_score_breakdown: normalizeMatchScoreBreakdown(
      job.match_score_breakdown,
      matchScore
    ),
    key_strengths_en: asStringArray(job.key_strengths_en),
    key_strengths_zh: asStringArray(job.key_strengths_zh),
    main_gaps_en: asStringArray(job.main_gaps_en),
    main_gaps_zh: asStringArray(job.main_gaps_zh),
    application_recommendation: asApplicationRecommendation(
      job.application_recommendation,
      matchScore
    ),
    recommended_next_action: normalizeNextAction(
      job.recommended_next_action,
      matchScore
    ),
    red_flags_en: asStringArray(job.red_flags_en),
    red_flags_zh: asStringArray(job.red_flags_zh),
    positive_signals_en: asStringArray(job.positive_signals_en),
    positive_signals_zh: asStringArray(job.positive_signals_zh),
    assumptions_en: asStringArray(job.assumptions_en),
    assumptions_zh: asStringArray(job.assumptions_zh),
    missing_information_en: asStringArray(job.missing_information_en),
    missing_information_zh: asStringArray(job.missing_information_zh),
    resume_tailoring_advice_en: asStringArray(job.resume_tailoring_advice_en),
    resume_tailoring_advice_zh: asStringArray(job.resume_tailoring_advice_zh),
    skills_to_improve_en: asStringArray(job.skills_to_improve_en),
    skills_to_improve_zh: asStringArray(job.skills_to_improve_zh),
    matched_skills: asStringArray(job.matched_skills, skills),
    missing_skills: asStringArray(job.missing_skills),
    missing_skill_details: normalizeMissingSkillDetails(job.missing_skill_details),
    important_tools: asStringArray(job.important_tools, tools),
    suggested_learning_actions_en: asStringArray(
      job.suggested_learning_actions_en
    ),
    suggested_learning_actions_zh: asStringArray(
      job.suggested_learning_actions_zh
    ),
    ai_summary_en: asString(job.ai_summary_en, "Not specified"),
    ai_summary_zh: asString(job.ai_summary_zh, "Not specified"),
    resume_keywords: asStringArray(job.resume_keywords),
    id: asString(job.id, createId()),
    application_status: status,
    application_deadline: job.application_deadline || "",
    application_channel: job.application_channel || "",
    contact_person: job.contact_person || "",
    interview_date: job.interview_date || "",
    follow_up_notes: job.follow_up_notes || "",
    status_history: normalizeStatusHistory(
      job.status_history,
      createdAt,
      status,
      updatedAt
    ),
    source_url: job.source_url || "",
    raw_jd: job.raw_jd || "",
    notes: job.notes || "",
    created_at: createdAt,
    updated_at: updatedAt
  };
}

function normalizeStatusHistory(
  history: StatusTimelineItem[] | undefined,
  createdAt?: string,
  status?: ApplicationStatus,
  updatedAt?: string
): StatusTimelineItem[] {
  const currentStatus = status || "Not Applied";
  const createdTime = createdAt || new Date().toISOString();
  const updatedTime = updatedAt || createdTime;

  if (Array.isArray(history) && history.length > 0) {
    const normalizedItems = history
      .map((item) => ({
        id: item.id || createId(),
        status: item.status,
        created_at: item.created_at || new Date().toISOString(),
        note: item.note || ""
      }))
      .filter((item) => item.status);

    return compactStatusHistory(normalizedItems, currentStatus, createdTime, updatedTime);
  }

  return createInitialStatusHistory(createdTime, currentStatus);
}

function createStatusHistorySnapshot(
  history: StatusTimelineItem[] | undefined,
  status: ApplicationStatus,
  changedAt: string,
  note: string,
  createdAt: string
) {
  const normalizedItems = normalizeStatusHistory(
    history,
    createdAt,
    status,
    changedAt
  );
  const preservedItems = normalizedItems.filter(
    (item) => item.status === "Job added" || item.note?.trim()
  );

  return sortStatusHistory([
    createTimelineItem(status, changedAt, note),
    ...preservedItems
  ]);
}

function compactStatusHistory(
  items: StatusTimelineItem[],
  currentStatus: ApplicationStatus,
  createdAt: string,
  updatedAt: string
) {
  const notedStatusItems = items.filter(
    (item) => item.status !== "Job added" && item.note?.trim()
  );
  const jobAddedItem =
    items
      .filter((item) => item.status === "Job added")
      .sort((a, b) => getTime(a.created_at) - getTime(b.created_at))[0] ||
    createTimelineItem("Job added", createdAt);
  const hasCurrentStatusNote = notedStatusItems.some(
    (item) => item.status === currentStatus
  );
  const currentStatusItem = hasCurrentStatusNote
    ? []
    : [
        items.find(
          (item) =>
            item.status === currentStatus &&
            !item.note?.trim()
        ) || createTimelineItem(currentStatus, updatedAt)
      ];

  return sortStatusHistory([
    ...currentStatusItem,
    ...notedStatusItems,
    jobAddedItem
  ]);
}

function sortStatusHistory(items: StatusTimelineItem[]) {
  return items.sort((a, b) => getTime(b.created_at) - getTime(a.created_at));
}

function normalizeMatchScoreBreakdown(
  value: unknown,
  fallbackScore: number
): MatchScoreBreakdown {
  const source = isRecord(value) ? value : {};

  return MATCH_SCORE_DIMENSIONS.reduce((breakdown, key) => {
    breakdown[key] = normalizeScoreDimension(source[key], fallbackScore);
    return breakdown;
  }, {} as MatchScoreBreakdown);
}

function normalizeScoreDimension(
  value: unknown,
  fallbackScore: number
): ScoreDimension {
  const source = isRecord(value) ? value : {};

  return {
    score: clampScore(source.score ?? fallbackScore),
    explanation_en: asString(source.explanation_en, "Not specified"),
    explanation_zh: asString(source.explanation_zh, "Not specified"),
    evidence_from_jd: asString(source.evidence_from_jd, "Not specified"),
    candidate_gap_en: asString(source.candidate_gap_en, "Not specified"),
    candidate_gap_zh: asString(source.candidate_gap_zh, "Not specified"),
    confidence: asConfidenceLevel(source.confidence)
  };
}

function normalizeNextAction(
  value: unknown,
  matchScore: number
): RecommendedNextAction {
  const source = isRecord(value) ? value : {};

  return {
    action: asNextAction(source.action, matchScore),
    reason_en: asString(source.reason_en, defaultNextActionReason(matchScore, "en")),
    reason_zh: asString(source.reason_zh, defaultNextActionReason(matchScore, "zh")),
    urgency: asPriorityLevel(source.urgency, matchScore >= 80 ? "High" : "Medium"),
    suggested_deadline: asString(
      source.suggested_deadline,
      matchScore >= 80 ? "Within 3 days" : "This week"
    ),
    resume_focus_points: asStringArray(source.resume_focus_points)
  };
}

function normalizeMissingSkillDetails(value: unknown): MissingSkillDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      skill: asString(item.skill, "Not specified"),
      priority: asPriorityLevel(item.priority),
      why_it_matters_en: asString(item.why_it_matters_en, "Not specified"),
      why_it_matters_zh: asString(item.why_it_matters_zh, "Not specified"),
      impact_on_match_score: asString(item.impact_on_match_score, "Not specified"),
      suggested_resource_type: asString(
        item.suggested_resource_type,
        "practice task"
      )
    }))
    .filter((item) => item.skill !== "Not specified");
}

function createTimelineItem(
  status: StatusTimelineItem["status"],
  createdAt: string,
  note = ""
): StatusTimelineItem {
  return {
    id: createId(),
    status,
    created_at: createdAt,
    note: note.trim()
  };
}

function asApplicationRecommendation(
  value: unknown,
  matchScore: number
): ApplicationRecommendation {
  const text = asString(value, "");

  if (APPLICATION_RECOMMENDATIONS.includes(text as ApplicationRecommendation)) {
    return text as ApplicationRecommendation;
  }

  if (matchScore >= 85) {
    return "Strongly apply";
  }

  if (matchScore >= 65) {
    return "Worth trying";
  }

  if (matchScore >= 45) {
    return "Low priority";
  }

  return "Not recommended";
}

function asNextAction(value: unknown, matchScore: number): NextActionLabel {
  const text = asString(value, "");

  if (NEXT_ACTIONS.includes(text as NextActionLabel)) {
    return text as NextActionLabel;
  }

  if (matchScore >= 85) {
    return "Apply now";
  }

  if (matchScore >= 65) {
    return "Tailor resume first";
  }

  if (matchScore >= 45) {
    return "Save for later";
  }

  return "Skip";
}

function asApplicationStatus(value: unknown): ApplicationStatus {
  const text = asString(value, "Not Applied");

  return ["Not Applied", "Applied", "Interview", "Rejected", "Offer"].includes(
    text
  )
    ? (text as ApplicationStatus)
    : "Not Applied";
}

function asWorkMode(value: unknown): WorkMode {
  const text = asString(value, "Not specified");
  return WORK_MODES.includes(text as WorkMode) ? (text as WorkMode) : "Not specified";
}

function asPriorityLevel(value: unknown, fallback: PriorityLevel = "Medium") {
  const text = asString(value, "");
  return PRIORITY_LEVELS.includes(text as PriorityLevel)
    ? (text as PriorityLevel)
    : fallback;
}

function asConfidenceLevel(value: unknown): ConfidenceLevel {
  const text = asString(value, "");
  return CONFIDENCE_LEVELS.includes(text as ConfidenceLevel)
    ? (text as ConfidenceLevel)
    : "Medium";
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item)))
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function defaultNextActionReason(matchScore: number, language: "en" | "zh") {
  if (language === "zh") {
    if (matchScore >= 85) {
      return "匹配度高，建议尽快申请。";
    }

    if (matchScore >= 65) {
      return "岗位值得尝试，但建议先优化简历。";
    }

    return "匹配度有限，建议先补强关键差距。";
  }

  if (matchScore >= 85) {
    return "The role is a strong fit, so apply promptly.";
  }

  if (matchScore >= 65) {
    return "The role is worth trying after tailoring the resume.";
  }

  return "The fit is limited, so address the main gaps first.";
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
