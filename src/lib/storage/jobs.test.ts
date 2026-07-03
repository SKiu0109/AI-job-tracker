import { describe, it, expect, beforeEach } from "vitest";
import { createAnalysisCacheKey, normalizeStoredJob } from "./jobs";
import type { JobRecord } from "@/types/job";

/**
 * normalizeStoredJob 的单元测试
 * 验证数据归一化逻辑：默认值填充、类型强制、边界值处理
 */
describe("normalizeStoredJob", () => {
  /** 最小有效输入 —— 只提供 id */
  function minimalJob(overrides: Partial<JobRecord> = {}): JobRecord {
    return {
      id: "test-1",
      company: "",
      job_title_original: "",
      job_title_zh: "",
      job_title_en: "",
      location: "",
      work_mode: "Not specified" as const,
      job_type_en: "",
      job_type_zh: "",
      education_requirement_en: "",
      education_requirement_zh: "",
      experience_requirement_en: "",
      experience_requirement_zh: "",
      skills: [],
      tools: [],
      responsibilities_en: [],
      responsibilities_zh: [],
      requirements_en: [],
      requirements_zh: [],
      nice_to_have_en: [],
      nice_to_have_zh: [],
      match_score: 0,
      match_score_breakdown: {} as JobRecord["match_score_breakdown"],
      key_strengths_en: [],
      key_strengths_zh: [],
      main_gaps_en: [],
      main_gaps_zh: [],
      application_recommendation: "Low priority" as const,
      recommended_next_action: {
        action: "Skip" as const,
        reason_en: "",
        reason_zh: "",
        urgency: "Low" as const,
        suggested_deadline: "",
        resume_focus_points: [],
      },
      red_flags_en: [],
      red_flags_zh: [],
      positive_signals_en: [],
      positive_signals_zh: [],
      assumptions_en: [],
      assumptions_zh: [],
      missing_information_en: [],
      missing_information_zh: [],
      resume_tailoring_advice_en: [],
      resume_tailoring_advice_zh: [],
      skills_to_improve_en: [],
      skills_to_improve_zh: [],
      matched_skills: [],
      missing_skills: [],
      missing_skill_details: [],
      important_tools: [],
      suggested_learning_actions_en: [],
      suggested_learning_actions_zh: [],
      ai_summary_en: "",
      ai_summary_zh: "",
      resume_keywords: [],
      resume_tailoring_draft: undefined,
      application_status: "Not Applied" as const,
      application_deadline: "",
      application_channel: "",
      contact_person: "",
      interview_date: "",
      follow_up_date: "",
      next_step_note: "",
      action_stage: "needs_review" as const,
      tailoring_status: "not_started" as const,
      follow_up_notes: "",
      status_history: [],
      company_domain: undefined,
      company_logo_url: undefined,
      source_url: "",
      raw_jd: "",
      notes: "",
      resume_tailoring_versions: [],
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  beforeEach(() => {
    // Ensure clean state
  });

  describe("default value filling", () => {
    it("fills company default when empty", () => {
      const job = minimalJob({ company: "" });
      const result = normalizeStoredJob(job);
      expect(result.company).toBe("Not specified");
    });

    it("fills location default when empty", () => {
      const job = minimalJob({ location: "" });
      const result = normalizeStoredJob(job);
      expect(result.location).toBe("Not specified");
    });

    it("fills job_title_original default when empty", () => {
      const job = minimalJob({ job_title_original: "" });
      const result = normalizeStoredJob(job);
      expect(result.job_title_original).toBe("Not specified");
    });

    it("fills job_title_en default when empty", () => {
      const job = minimalJob({ job_title_en: "" });
      const result = normalizeStoredJob(job);
      expect(result.job_title_en).toBe("Not specified");
    });

    it("fills job_title_zh default when empty", () => {
      const job = minimalJob({ job_title_zh: "" });
      const result = normalizeStoredJob(job);
      expect(result.job_title_zh).toBe("Not specified");
    });

    it("fills ai_summary_en default when empty", () => {
      const job = minimalJob({ ai_summary_en: "" });
      const result = normalizeStoredJob(job);
      expect(result.ai_summary_en).toBe("Not specified");
    });

    it("fills ai_summary_zh default when empty", () => {
      const job = minimalJob({ ai_summary_zh: "" });
      const result = normalizeStoredJob(job);
      expect(result.ai_summary_zh).toBe("Not specified");
    });
  });

  describe("array coercion", () => {
    it("converts null skills to empty array", () => {
      const job = minimalJob({ skills: null as unknown as string[] });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.skills)).toBe(true);
      expect(result.skills).toEqual([]);
    });

    it("converts undefined skills to empty array", () => {
      const job = minimalJob({ skills: undefined as unknown as string[] });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.skills)).toBe(true);
    });

    it("preserves valid skills array", () => {
      const job = minimalJob({ skills: ["React", "TypeScript"] });
      const result = normalizeStoredJob(job);
      expect(result.skills).toEqual(["React", "TypeScript"]);
    });

    it("converts null tools to empty array", () => {
      const job = minimalJob({ tools: null as unknown as string[] });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.tools)).toBe(true);
    });

    it("converts null responsibilities to empty arrays", () => {
      const job = minimalJob({
        responsibilities_en: null as unknown as string[],
        responsibilities_zh: null as unknown as string[],
      });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.responsibilities_en)).toBe(true);
      expect(Array.isArray(result.responsibilities_zh)).toBe(true);
    });

    it("converts null matched_skills to empty array", () => {
      const job = minimalJob({ matched_skills: null as unknown as string[] });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.matched_skills)).toBe(true);
    });

    it("converts null missing_skills to empty array", () => {
      const job = minimalJob({ missing_skills: null as unknown as string[] });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.missing_skills)).toBe(true);
    });

    it("converts null missing_skill_details to empty array", () => {
      const job = minimalJob({ missing_skill_details: null as unknown as [] });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.missing_skill_details)).toBe(true);
    });

    it("converts null resume_keywords to empty array", () => {
      const job = minimalJob({ resume_keywords: null as unknown as string[] });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.resume_keywords)).toBe(true);
    });

    it("converts null status_history to a valid initial history", () => {
      const job = minimalJob({
        status_history: null as unknown as [],
        application_status: "Applied" as const,
        created_at: "2024-06-01T00:00:00.000Z",
      });
      const result = normalizeStoredJob(job);
      expect(Array.isArray(result.status_history)).toBe(true);
      expect(result.status_history.length).toBeGreaterThan(0);
    });
  });

  describe("match_score clamping", () => {
    it("clamps scores above 100 to 100", () => {
      const job = minimalJob({ match_score: 150 });
      const result = normalizeStoredJob(job);
      expect(result.match_score).toBe(100);
    });

    it("clamps negative scores to 0", () => {
      const job = minimalJob({ match_score: -10 });
      const result = normalizeStoredJob(job);
      expect(result.match_score).toBe(0);
    });

    it("rounds floating point scores", () => {
      const job = minimalJob({ match_score: 85.6789 });
      const result = normalizeStoredJob(job);
      expect(result.match_score).toBe(86);
    });

    it("preserves valid scores", () => {
      const job = minimalJob({ match_score: 75 });
      const result = normalizeStoredJob(job);
      expect(result.match_score).toBe(75);
    });
  });

  describe("application_status normalization", () => {
    it("replaces invalid status with Not Applied", () => {
      const job = minimalJob({
        application_status: "InvalidStatus" as unknown as "Not Applied",
      });
      const result = normalizeStoredJob(job);
      expect(result.application_status).toBe("Not Applied");
    });

    it("preserves valid status", () => {
      const job = minimalJob({ application_status: "Interview" as const });
      const result = normalizeStoredJob(job);
      expect(result.application_status).toBe("Interview");
    });
  });

  describe("work_mode normalization", () => {
    it("defaults to Not specified for invalid work mode", () => {
      const job = minimalJob({
        work_mode: "Invalid" as unknown as "Not specified",
      });
      const result = normalizeStoredJob(job);
      expect(result.work_mode).toBe("Not specified");
    });
  });

  describe("idempotency", () => {
    it("normalizing twice produces the same result", () => {
      const job = minimalJob({
        company: "",
        match_score: 150,
        skills: null as unknown as string[],
      });
      const first = normalizeStoredJob(job);
      const second = normalizeStoredJob(first);
      // Dates will differ because normalizeStoredJob uses new Date()
      // So we compare a subset of stable fields
      expect(second.company).toBe(first.company);
      expect(second.match_score).toBe(first.match_score);
      expect(second.skills).toEqual(first.skills);
    });
  });

  describe("id preservation", () => {
    it("generates an id if missing", () => {
      const job = minimalJob({ id: "" });
      const result = normalizeStoredJob(job);
      expect(result.id).toBeTruthy();
      expect(typeof result.id).toBe("string");
    });

    it("preserves existing id", () => {
      const job = minimalJob({ id: "my-custom-id" });
      const result = normalizeStoredJob(job);
      expect(result.id).toBe("my-custom-id");
    });
  });

  describe("timestamps", () => {
    it("sets created_at to now if missing", () => {
      const job = minimalJob({ created_at: "" });
      const result = normalizeStoredJob(job);
      expect(result.created_at).toBeTruthy();
      expect(() => new Date(result.created_at)).not.toThrow();
    });

    it("uses created_at as updated_at fallback", () => {
      const job = minimalJob({
        created_at: "2024-03-01T00:00:00.000Z",
        updated_at: "",
      });
      const result = normalizeStoredJob(job);
      expect(result.updated_at).toBe("2024-03-01T00:00:00.000Z");
    });
  });
});

describe("createAnalysisCacheKey", () => {
  it("separates cached analyses by UI language", () => {
    const rawJd = "Data analyst role requiring SQL and stakeholder updates.";
    const profile = "Candidate has SQL and reporting experience.";

    expect(createAnalysisCacheKey(rawJd, profile, "en")).not.toBe(
      createAnalysisCacheKey(rawJd, profile, "zh")
    );
  });
});
