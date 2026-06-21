export const APPLICATION_STATUSES = [
  "Not Applied",
  "Applied",
  "Interview",
  "Rejected",
  "Offer"
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const WORK_MODES = [
  "Remote",
  "Hybrid",
  "Onsite",
  "Not specified"
] as const;

export type WorkMode = (typeof WORK_MODES)[number];

export type JobAnalysis = {
  company: string;
  job_title_original: string;
  job_title_zh: string;
  location: string;
  work_mode: WorkMode;
  job_type_en: string;
  job_type_zh: string;
  education_requirement_en: string;
  education_requirement_zh: string;
  experience_requirement_en: string;
  experience_requirement_zh: string;
  skills: string[];
  tools: string[];
  responsibilities_en: string[];
  responsibilities_zh: string[];
  requirements_en: string[];
  requirements_zh: string[];
  nice_to_have_en: string[];
  nice_to_have_zh: string[];
  match_score: number;
  ai_summary_en: string;
  ai_summary_zh: string;
  resume_keywords: string[];
};

export type JobRecord = JobAnalysis & {
  id: string;
  application_status: ApplicationStatus;
  source_url: string;
  raw_jd: string;
  notes: string;
  created_at: string;
  updated_at: string;
};
