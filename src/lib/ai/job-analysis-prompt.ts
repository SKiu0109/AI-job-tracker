import {
  DEFAULT_CANDIDATE_PROFILE,
  formatCandidateProfile
} from "@/lib/candidate-profile";

export function buildJobAnalysisMessages(input: {
  rawJd: string;
  sourceUrl?: string;
  candidateProfile?: string;
  language?: "en" | "zh";
}) {
  const hasProfile = input.candidateProfile?.trim();
  const uiLanguage = input.language === "zh" ? "Simplified Chinese" : "English";
  // Use provided profile, or fall back to defaults only for guest/demo entries
  const profileNote = hasProfile
    ? ""
    : " Note: The candidate profile below is a built-in demo. Scores may not reflect a real user.";

  const effectiveProfile = hasProfile
    ? input.candidateProfile
    : formatCandidateProfile(DEFAULT_CANDIDATE_PROFILE);

  const schema = `{
  "company": "string",
  "job_title_original": "string",
  "job_title_zh": "string",
  "job_title_en": "string",
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
  "match_score_breakdown": {
    "education_fit": { "score": 0, "explanation_en": "string", "explanation_zh": "string", "evidence_from_jd": "string", "candidate_gap_en": "string", "candidate_gap_zh": "string", "confidence": "High | Medium | Low" },
    "technical_skills_fit": { "score": 0, "explanation_en": "string", "explanation_zh": "string", "evidence_from_jd": "string", "candidate_gap_en": "string", "candidate_gap_zh": "string", "confidence": "High | Medium | Low" },
    "business_communication_fit": { "score": 0, "explanation_en": "string", "explanation_zh": "string", "evidence_from_jd": "string", "candidate_gap_en": "string", "candidate_gap_zh": "string", "confidence": "High | Medium | Low" },
    "experience_fit": { "score": 0, "explanation_en": "string", "explanation_zh": "string", "evidence_from_jd": "string", "candidate_gap_en": "string", "candidate_gap_zh": "string", "confidence": "High | Medium | Low" }
  },
  "key_strengths_en": ["string"],
  "key_strengths_zh": ["string"],
  "main_gaps_en": ["string"],
  "main_gaps_zh": ["string"],
  "application_recommendation": "Strongly apply | Worth trying | Low priority | Not recommended",
  "recommended_next_action": {
    "action": "Apply now | Tailor resume first | Save for later | Skip | Improve skills before applying",
    "reason_en": "string",
    "reason_zh": "string",
    "urgency": "High | Medium | Low",
    "suggested_deadline": "string",
    "resume_focus_points": ["string"]
  },
  "red_flags_en": ["string"],
  "red_flags_zh": ["string"],
  "positive_signals_en": ["string"],
  "positive_signals_zh": ["string"],
  "assumptions_en": ["string"],
  "assumptions_zh": ["string"],
  "missing_information_en": ["string"],
  "missing_information_zh": ["string"],
  "resume_tailoring_advice_en": ["string"],
  "resume_tailoring_advice_zh": ["string"],
  "skills_to_improve_en": ["string"],
  "skills_to_improve_zh": ["string"],
  "matched_skills": ["string"],
  "missing_skills": ["string"],
  "missing_skill_details": [
    {
      "skill": "string",
      "priority": "High | Medium | Low",
      "why_it_matters_en": "string",
      "why_it_matters_zh": "string",
      "impact_on_match_score": "string",
      "suggested_resource_type": "project | short course | practice task | documentation | portfolio task"
    }
  ],
  "important_tools": ["string"],
  "suggested_learning_actions_en": ["string"],
  "suggested_learning_actions_zh": ["string"],
  "ai_summary_en": "string",
  "ai_summary_zh": "string",
  "resume_keywords": ["string"]
}`;

  return [
    {
      role: "system" as const,
      content:
        "You are a bilingual career analyst. Return valid JSON only. Do not include markdown, comments, or extra text."
    },
    {
      role: "user" as const,
      content: [
        "Analyze the pasted job description for a job application tracker.",
        "Always preserve the original company name and original job title wording when available.",
        "Always provide the English job title in job_title_en — translate from the original title if the JD is in Chinese, or copy the original if the JD is already in English.",
        "Always provide both English and Simplified Chinese fields where the schema asks for both.",
        `Selected UI language: ${uiLanguage}.`,
        "For single-language display fields, write descriptive concepts in the selected UI language. This includes skills, tools, matched_skills, missing_skills, missing_skill_details.skill, important_tools, match_score_breakdown.*.evidence_from_jd, recommended_next_action.suggested_deadline, recommended_next_action.resume_focus_points, and missing_skill_details.impact_on_match_score.",
        "Keep proper nouns, product names, company names, programming languages, credentials, acronyms, and exact tool names in their standard form when translating would reduce clarity.",
        "Keep resume_keywords mainly in English because they are intended for English resumes and ATS matching.",
        "Keep every summary and list concise.",
        "For match_score_breakdown, each dimension score must be from 0 to 100 and explanations must be short.",
        "For evidence_from_jd, quote or closely paraphrase concrete JD wording, but translate/paraphrase it into the selected UI language when needed for readability. If the JD is vague, say what is missing.",
        "For candidate_gap, compare the JD against the candidate profile, not a generic candidate. If the profile is missing a relevant dimension (e.g. no work experience provided), mark the gap as 'Unknown — profile does not specify' rather than inventing information.",
        "Confidence must be High, Medium, or Low depending on how clearly the JD supports the judgment.",
        "Recommended next action must be exactly one of: Apply now, Tailor resume first, Save for later, Skip, Improve skills before applying.",
        "For missing_skill_details, include why it matters, approximate impact on match, priority, and a learning resource type without external links.",
        "Recommended application decision must be exactly one of: Strongly apply, Worth trying, Low priority, Not recommended.",
        "",
        "Candidate profile:",
        effectiveProfile,
        profileNote,
        "",
        `Source URL reference only: ${input.sourceUrl?.trim() || "Not provided"}`,
        "",
        "Return valid JSON only using this exact schema:",
        schema,
        "",
        "Match score rules:",
        "- Score from 0 to 100.",
        "- Higher score means the JD fits the candidate profile better.",
        "- Consider education, technical skills, business skills, communication, experience level, and role requirements.",
        "- Do not use job location, target region, relocation preference, career-goal wording, or broad career direction as scoring factors.",
        "- Do not include positive_signals, red_flags, assumptions, gaps, or recommendation reasons that describe location/target-region/career-direction alignment or mismatch.",
        "- Mention location only as factual job metadata, or as a concrete work-rights/sponsorship risk when the JD itself makes that risk relevant.",
        "- If the JD asks for many years of experience beyond the profile level, reduce the score.",
        "- If the candidate profile has gaps (missing dimensions), note uncertainty in the explanation but still score based on what IS known.",
        "",
        "Raw job description:",
        input.rawJd
      ].join("\n")
    }
  ];
}
