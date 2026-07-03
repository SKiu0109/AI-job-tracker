import { describe, expect, it } from "vitest";
import { localizeKeyword } from "./job-detail-utils";

describe("job-detail-utils keyword localization", () => {
  it("localizes dynamic English skill labels in Chinese mode", () => {
    expect(localizeKeyword("Data Analysis", "zh")).toBe("数据分析");
    expect(localizeKeyword("Data Product Management", "zh")).toBe("数据产品管理");
    expect(localizeKeyword("AI Product Awareness", "zh")).toBe("AI 产品认知");
    expect(localizeKeyword("Logical Thinking", "zh")).toBe("逻辑思维");
    expect(localizeKeyword("Structured Communication", "zh")).toBe("结构化沟通");
    expect(localizeKeyword("Data Warehouse Concepts", "zh")).toBe("数据仓库概念");
    expect(localizeKeyword("Business Understanding", "zh")).toBe("业务理解");
    expect(localizeKeyword("Problem Decomposition", "zh")).toBe("问题拆解");
  });

  it("matches skill labels case-insensitively after whitespace normalization", () => {
    expect(localizeKeyword("  data   modeling  ", "zh")).toBe("数据建模");
  });
});
