import { describe, expect, it } from "vitest";
import { buildJobAnalysisMessages } from "./job-analysis-prompt";

function getUserPrompt(language: "en" | "zh") {
  const messages = buildJobAnalysisMessages({
    rawJd: "We need data analysis, stakeholder communication, SQL, and Python.",
    candidateProfile: "Candidate has data analysis and SQL experience.",
    language
  });

  return messages[1].content;
}

describe("buildJobAnalysisMessages", () => {
  it("asks the model to write display-only analysis fields in Chinese for Chinese UI", () => {
    const prompt = getUserPrompt("zh");

    expect(prompt).toContain("Selected UI language: Simplified Chinese.");
    expect(prompt).toContain("single-language display fields");
    expect(prompt).toContain("matched_skills");
    expect(prompt).toContain("match_score_breakdown.*.evidence_from_jd");
  });

  it("keeps resume keywords English while localizing display fields", () => {
    const prompt = getUserPrompt("zh");

    expect(prompt).toContain(
      "Keep resume_keywords mainly in English because they are intended for English resumes and ATS matching."
    );
    expect(prompt).not.toContain(
      "For matched_skills, missing_skills, important_tools, and resume_keywords, keep terms mainly in English"
    );
  });

  it("uses English as the default UI language", () => {
    const messages = buildJobAnalysisMessages({
      rawJd: "A role requiring SQL.",
      candidateProfile: "Candidate knows SQL."
    });

    expect(messages[1].content).toContain("Selected UI language: English.");
  });
});
