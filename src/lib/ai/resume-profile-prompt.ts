import {
  DEFAULT_CANDIDATE_PROFILE,
  formatCandidateProfile
} from "@/lib/candidate-profile";
import type { CandidateProfile } from "@/types/job";

export function buildResumeProfileMessages(input: {
  resumeText: string;
  currentProfile?: CandidateProfile;
}) {
  const currentProfile = formatCandidateProfile(
    input.currentProfile || DEFAULT_CANDIDATE_PROFILE
  );

  const schema = `{
  "candidate_profile": {
    "target_regions": "string",
    "target_roles": "string",
    "education_background": "string (degree level, major, field of study, and academic direction)",
    "technical_skills": "string (technical skills and tools — SQL, Python, Excel, BI tools, analysis platforms, etc.)",
    "business_skills": "string (soft skills — communication, reporting, consulting, research, stakeholder management, etc.)",
    "work_experience": "string",
    "work_rights": "string",
    "preferred_industries": "string",
    "preferred_language": "string",
    "career_goals": "string"
  },
  "profile_summary_en": "string",
  "profile_summary_zh": "string",
  "extracted_strengths": ["string"],
  "missing_or_unclear_information": ["string"],
  "confidence": "High | Medium | Low"
}`;

  return [
    {
      role: "system" as const,
      content:
        "You are a bilingual career profile analyst. Return valid JSON only. Do not include markdown, comments, or extra text."
    },
    {
      role: "user" as const,
      content: [
        "Analyze the uploaded resume text and generate a candidate profile for an AI job search analytics app.",
        "The user is likely a Chinese-speaking international student applying for English-speaking roles in Australia, Singapore, and China.",
        "Use the resume as the primary evidence. Do not invent degrees, employers, skills, tools, work rights, or industries.",
        "If a preference field is not clear from the resume, keep the current saved profile value and mention the uncertainty in missing_or_unclear_information.",
        "Keep each candidate_profile field concise but useful for job matching.",
        "For education_background: include degree level, major, field of study, and academic direction (e.g. \"Bachelor in Statistics; Master in Business Analytics and FinTech\").",
        "For technical_skills: include both technical skills AND tools (e.g. SQL, Python, Excel, Power BI, Tableau). Do not split them.",
        "Keep technical skills, target roles, and resume-relevant keywords mostly in English.",
        "Provide profile summaries in both English and Simplified Chinese.",
        "Confidence must be High, Medium, or Low depending on how complete and clear the resume text is.",
        "",
        "Current saved profile for reference:",
        currentProfile,
        "",
        "Return valid JSON only using this exact schema:",
        schema,
        "",
        "Extracted resume text:",
        input.resumeText
      ].join("\n")
    }
  ];
}
