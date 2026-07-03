import { describe, expect, it } from "vitest";
import {
  buildFeedbackBrief,
  FEEDBACK_BRIEF_MAX_LENGTH
} from "./feedback-brief";

describe("buildFeedbackBrief", () => {
  it("formats feedback as an internal product brief", () => {
    const brief = buildFeedbackBrief({
      areaLabel: "AI analysis",
      evidence: "The generated skills stayed in English on the Chinese page.",
      expectedChange: "Generate display skills in the selected page language.",
      feedbackTypeLabel: "Language issue",
      goal: "Understand whether a JD is worth applying to.",
      language: "en",
      priorityLabel: "High",
      rating: 3,
      role: "Job seeker"
    });

    expect(brief).toContain("# Offerwise feedback brief");
    expect(brief).toContain("Area: AI analysis");
    expect(brief).toContain("Expected improvement:");
  });

  it("keeps the stored brief within the API limit", () => {
    const brief = buildFeedbackBrief({
      areaLabel: "Job report",
      evidence: "x".repeat(FEEDBACK_BRIEF_MAX_LENGTH),
      expectedChange: "y".repeat(800),
      feedbackTypeLabel: "Too much work",
      goal: "Compare job fit quickly.",
      language: "en",
      priorityLabel: "Medium",
      rating: 4,
      role: "Student"
    });

    expect(brief.length).toBeLessThanOrEqual(FEEDBACK_BRIEF_MAX_LENGTH);
  });

  it("localizes the generated brief labels for Chinese feedback", () => {
    const brief = buildFeedbackBrief({
      areaLabel: "AI 分析",
      evidence: "中文页面里技能标签仍然是英文。",
      expectedChange: "按页面语言生成展示字段。",
      feedbackTypeLabel: "语言问题",
      goal: "快速判断岗位是否值得投递。",
      language: "zh",
      priorityLabel: "高",
      rating: 4,
      role: ""
    });

    expect(brief).toContain("# Offerwise 反馈优化摘要");
    expect(brief).toContain("区域: AI 分析");
    expect(brief).toContain("用户背景: 未提供");
  });
});
