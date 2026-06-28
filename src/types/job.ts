export const APPLICATION_STATUSES = [
  "Not Applied",
  "Applied",
  "Interview",
  "Rejected",
  "Offer"
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_TIMELINE_STATUSES = ["Job added", ...APPLICATION_STATUSES] as const;

export type StatusTimelineStatus = (typeof STATUS_TIMELINE_STATUSES)[number];

export const APPLICATION_RECOMMENDATIONS = [
  "Strongly apply",
  "Worth trying",
  "Low priority",
  "Not recommended"
] as const;

export type ApplicationRecommendation =
  (typeof APPLICATION_RECOMMENDATIONS)[number];

export const NEXT_ACTIONS = [
  "Apply now",
  "Tailor resume first",
  "Save for later",
  "Skip",
  "Improve skills before applying"
] as const;

export type NextActionLabel = (typeof NEXT_ACTIONS)[number];

export const PRIORITY_LEVELS = ["High", "Medium", "Low"] as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const CONFIDENCE_LEVELS = ["High", "Medium", "Low"] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const MATCH_SCORE_DIMENSIONS = [
  "education_fit",
  "technical_skills_fit",
  "business_communication_fit",
  "experience_fit",
  "career_direction_fit",
  "location_fit"
] as const;

export type MatchScoreDimensionKey = (typeof MATCH_SCORE_DIMENSIONS)[number];

export const WORK_MODES = [
  "Remote",
  "Hybrid",
  "Onsite",
  "Not specified"
] as const;

export type WorkMode = (typeof WORK_MODES)[number];

export type ScoreDimension = {
  score: number;
  explanation_en: string;
  explanation_zh: string;
  evidence_from_jd: string;
  candidate_gap_en: string;
  candidate_gap_zh: string;
  confidence: ConfidenceLevel;
};

export type MatchScoreBreakdown = Record<
  MatchScoreDimensionKey,
  ScoreDimension
>;

export type RecommendedNextAction = {
  action: NextActionLabel;
  reason_en: string;
  reason_zh: string;
  urgency: PriorityLevel;
  suggested_deadline: string;
  resume_focus_points: string[];
};

export type MissingSkillDetail = {
  skill: string;
  priority: PriorityLevel;
  why_it_matters_en: string;
  why_it_matters_zh: string;
  impact_on_match_score: string;
  suggested_resource_type: string;
};

export type JobAnalysis = {
  company: string;
  job_title_original: string;
  job_title_zh: string;
  job_title_en: string;
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
  match_score_breakdown: MatchScoreBreakdown;
  key_strengths_en: string[];
  key_strengths_zh: string[];
  main_gaps_en: string[];
  main_gaps_zh: string[];
  application_recommendation: ApplicationRecommendation;
  recommended_next_action: RecommendedNextAction;
  red_flags_en: string[];
  red_flags_zh: string[];
  positive_signals_en: string[];
  positive_signals_zh: string[];
  assumptions_en: string[];
  assumptions_zh: string[];
  missing_information_en: string[];
  missing_information_zh: string[];
  resume_tailoring_advice_en: string[];
  resume_tailoring_advice_zh: string[];
  skills_to_improve_en: string[];
  skills_to_improve_zh: string[];
  matched_skills: string[];
  missing_skills: string[];
  missing_skill_details: MissingSkillDetail[];
  important_tools: string[];
  suggested_learning_actions_en: string[];
  suggested_learning_actions_zh: string[];
  ai_summary_en: string;
  ai_summary_zh: string;
  resume_keywords: string[];
};

export type StatusTimelineItem = {
  id: string;
  status: StatusTimelineStatus;
  created_at: string;
  note?: string;
};

export type JobRecord = JobAnalysis & {
  id: string;
  application_status: ApplicationStatus;
  application_deadline?: string;
  application_channel?: string;
  contact_person?: string;
  interview_date?: string;
  follow_up_notes?: string;
  status_history: StatusTimelineItem[];
  source_url: string;
  raw_jd: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CandidateProfile = {
  target_regions: string;
  target_roles: string;
  education_background: string;
  technical_skills: string;
  business_skills: string;
  work_experience: string;
  work_rights: string;
  preferred_industries: string;
  preferred_language: string;
  career_goals: string;
};

/** Legacy fields from v1 profile — used only for migration. */
export type CandidateProfileV1 = CandidateProfile & {
  degree_direction?: string;
  tools?: string;
};

export type ResumeProfileAnalysis = {
  candidate_profile: CandidateProfile;
  profile_summary_en: string;
  profile_summary_zh: string;
  extracted_strengths: string[];
  missing_or_unclear_information: string[];
  confidence: ConfidenceLevel;
};
