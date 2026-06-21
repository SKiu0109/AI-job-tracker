export const DEFAULT_CANDIDATE_PROFILE = [
  "Bachelor background in Statistics",
  "Master direction: Business Analytics and FinTech",
  "Interested in Data Analyst, Business Analyst, Product Operations, Risk Strategy, Consulting, and FinTech roles",
  "Experience in consulting, quantitative research, questionnaire analysis, data cleaning, Excel, Python, SQL, and report writing",
  "Chinese-speaking international student applying for English-speaking roles in Australia, Singapore, and China"
].join("\n");

export function buildJobAnalysisMessages(input: {
  rawJd: string;
  sourceUrl?: string;
  candidateProfile?: string;
}) {
  const candidateProfile =
    input.candidateProfile?.trim() || DEFAULT_CANDIDATE_PROFILE;

  const schema = `{
  "company": "string",
  "job_title_original": "string",
  "job_title_zh": "string",
  "location": "string",
  "work_mode": "Remote | Hybrid | Onsite | Not specified",
  "job_type_en": "string",
  "job_type_zh": "string",
  "education_requirement_en": "string",
  "education_requirement_zh": "string",
  "experience_requirement_en": "string",
  "experience_requirement_zh": "string",
  "skills": ["string"],
  "tools": ["string"],
  "responsibilities_en": ["string"],
  "responsibilities_zh": ["string"],
  "requirements_en": ["string"],
  "requirements_zh": ["string"],
  "nice_to_have_en": ["string"],
  "nice_to_have_zh": ["string"],
  "match_score": 0,
  "ai_summary_en": "string",
  "ai_summary_zh": "string",
  "resume_keywords": ["string"]
}`;

  return [
    {
      role: "system" as const,
      content:
        "You are a bilingual career analyst for Chinese-speaking international students. Return valid JSON only. Do not include markdown, comments, or extra text."
    },
    {
      role: "user" as const,
      content: [
        "Analyze the pasted job description for a job application tracker.",
        "Always preserve the original company name and original job title wording when available.",
        "Always provide both English and Simplified Chinese fields where the schema asks for both.",
        "Keep resume_keywords mainly in English because they are intended for English resumes.",
        "Keep every summary and list concise.",
        "",
        "Candidate profile:",
        candidateProfile,
        "",
        `Source URL reference only: ${input.sourceUrl?.trim() || "Not provided"}`,
        "",
        "Return valid JSON only using this exact schema:",
        schema,
        "",
        "Match score rules:",
        "- Score from 0 to 100.",
        "- Higher score means the JD fits the candidate profile better.",
        "- Consider education, technical skills, business skills, communication, domain fit, and early-career suitability.",
        "- If the JD asks for many years of experience, reduce the score.",
        "- If the role fits Business Analytics, Product Operations, Risk, Consulting, FinTech, or Data Analyst directions, increase the score.",
        "",
        "Raw job description:",
        input.rawJd
      ].join("\n")
    }
  ];
}
