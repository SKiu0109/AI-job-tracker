import { CandidateProfile, CandidateProfileV1 } from "@/types/job";

/** Default example profile — used only for demo JD analysis fallback */
export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  target_regions: "Australia, Singapore, China",
  target_roles:
    "Data Analyst, Business Analyst, Product Operations, Risk Strategy, Consulting, FinTech",
  education_background:
    "Bachelor background in Statistics; Master direction in Business Analytics and FinTech",
  technical_skills:
    "SQL, Python, Excel, Power BI, Tableau, Looker Studio, data analysis",
  business_skills:
    "report writing, questionnaire analysis, consulting research, stakeholder communication",
  work_experience:
    "FMCG quantitative research, consulting project work, transcript cleaning, insight memo writing",
  work_rights: "",
  preferred_industries:
    "FinTech, consulting, banking, FMCG, technology, product-led businesses",
  preferred_language: "English-speaking roles with Chinese bilingual advantage",
  career_goals:
    "Build an early-career analytics, consulting, product operations, risk strategy, or FinTech path"
};

/** Empty profile — new users start here */
export const EMPTY_CANDIDATE_PROFILE: CandidateProfile = {
  target_regions: "",
  target_roles: "",
  education_background: "",
  technical_skills: "",
  business_skills: "",
  work_experience: "",
  work_rights: "",
  preferred_industries: "",
  preferred_language: "",
  career_goals: ""
};

export function isProfileEmpty(profile: CandidateProfile) {
  return !Object.values(profile).some((v) => v.trim().length > 0);
}

export function formatCandidateProfile(profile: CandidateProfile) {
  if (isProfileEmpty(profile)) return "";

  const fields: [string, string][] = [
    ["Target regions", profile.target_regions],
    ["Target roles", profile.target_roles],
    ["Education background (degree, major, direction)", profile.education_background],
    ["Technical skills & tools", profile.technical_skills],
    ["Business skills", profile.business_skills],
    ["Work experience", profile.work_experience],
    ["Work rights / visa status", profile.work_rights],
    ["Preferred industries", profile.preferred_industries],
    ["Preferred language", profile.preferred_language],
    ["Career goals", profile.career_goals]
  ];

  return fields
    .filter(([, value]) => value.trim().length > 0)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

export function normalizeCandidateProfile(
  value: Partial<CandidateProfileV1> | null | undefined
): CandidateProfile {
  // No saved profile → return empty (not defaults)
  if (!value) return { ...EMPTY_CANDIDATE_PROFILE };
  const mergedEducation = [value?.education_background, (value as CandidateProfileV1)?.degree_direction]
    .filter(Boolean)
    .join("; ");
  const mergedTech = [(value as CandidateProfileV1)?.technical_skills, (value as CandidateProfileV1)?.tools]
    .filter(Boolean)
    .join(", ");

  return {
    target_regions: value?.target_regions || "",
    target_roles: value?.target_roles || "",
    education_background: mergedEducation || "",
    technical_skills: mergedTech || "",
    business_skills: value?.business_skills || "",
    work_experience: value?.work_experience || "",
    work_rights: value?.work_rights || "",
    preferred_industries: value?.preferred_industries || "",
    preferred_language: value?.preferred_language || "",
    career_goals: value?.career_goals || ""
  };
}
