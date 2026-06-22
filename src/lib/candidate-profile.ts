import { CandidateProfile } from "@/types/job";

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  target_regions: "Australia, Singapore, China",
  target_roles:
    "Data Analyst, Business Analyst, Product Operations, Risk Strategy, Consulting, FinTech",
  education_background: "Bachelor background in Statistics",
  degree_direction: "Master direction in Business Analytics and FinTech",
  technical_skills: "SQL, Python, Excel, Power BI, data analysis",
  business_skills:
    "report writing, questionnaire analysis, consulting research, stakeholder communication",
  tools: "SQL, Python, Excel, Power BI, Tableau, Looker Studio",
  work_experience:
    "FMCG quantitative research, consulting project work, transcript cleaning, insight memo writing",
  work_rights: "Chinese-speaking international student",
  preferred_industries:
    "FinTech, consulting, banking, FMCG, technology, product-led businesses",
  preferred_language: "English-speaking roles with Chinese bilingual advantage",
  career_goals:
    "Build an early-career analytics, consulting, product operations, risk strategy, or FinTech path"
};

export function formatCandidateProfile(profile: CandidateProfile) {
  return [
    `Target regions: ${profile.target_regions}`,
    `Target roles: ${profile.target_roles}`,
    `Education background: ${profile.education_background}`,
    `Degree direction: ${profile.degree_direction}`,
    `Technical skills: ${profile.technical_skills}`,
    `Business skills: ${profile.business_skills}`,
    `Tools: ${profile.tools}`,
    `Work experience: ${profile.work_experience}`,
    `Work rights / visa status: ${profile.work_rights}`,
    `Preferred industries: ${profile.preferred_industries}`,
    `Preferred language: ${profile.preferred_language}`,
    `Career goals: ${profile.career_goals}`
  ].join("\n");
}

export function normalizeCandidateProfile(
  value: Partial<CandidateProfile> | null | undefined
): CandidateProfile {
  return {
    target_regions: value?.target_regions || DEFAULT_CANDIDATE_PROFILE.target_regions,
    target_roles: value?.target_roles || DEFAULT_CANDIDATE_PROFILE.target_roles,
    education_background:
      value?.education_background || DEFAULT_CANDIDATE_PROFILE.education_background,
    degree_direction:
      value?.degree_direction || DEFAULT_CANDIDATE_PROFILE.degree_direction,
    technical_skills:
      value?.technical_skills || DEFAULT_CANDIDATE_PROFILE.technical_skills,
    business_skills:
      value?.business_skills || DEFAULT_CANDIDATE_PROFILE.business_skills,
    tools: value?.tools || DEFAULT_CANDIDATE_PROFILE.tools,
    work_experience:
      value?.work_experience || DEFAULT_CANDIDATE_PROFILE.work_experience,
    work_rights: value?.work_rights || DEFAULT_CANDIDATE_PROFILE.work_rights,
    preferred_industries:
      value?.preferred_industries || DEFAULT_CANDIDATE_PROFILE.preferred_industries,
    preferred_language:
      value?.preferred_language || DEFAULT_CANDIDATE_PROFILE.preferred_language,
    career_goals: value?.career_goals || DEFAULT_CANDIDATE_PROFILE.career_goals
  };
}
