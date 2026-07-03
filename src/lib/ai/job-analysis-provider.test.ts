import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getAiProvider,
  getAiProviderConfigStatus
} from "./job-analysis-provider";

const ORIGINAL_ENV = { ...process.env };

function resetAiEnv() {
  for (const key of [
    "ADMIN_AI_MODEL",
    "ADMIN_AI_PROVIDER",
    "ADMIN_DEEPSEEK_API_KEY",
    "ADMIN_OPENAI_API_KEY",
    "AI_MODEL",
    "AI_PROVIDER",
    "DEEPSEEK_API_KEY",
    "OPENAI_API_KEY"
  ]) {
    delete process.env[key];
  }
}

describe("job-analysis-provider", () => {
  beforeEach(() => {
    resetAiEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("defaults to OpenAI and reports missing key as unconfigured", () => {
    expect(getAiProviderConfigStatus()).toEqual({
      apiKeyEnvName: "OPENAI_API_KEY",
      configured: false,
      provider: "OpenAI"
    });
  });

  it("supports DeepSeek configuration", () => {
    process.env.AI_PROVIDER = "deepseek";
    process.env.DEEPSEEK_API_KEY = "real-looking-key";

    expect(getAiProviderConfigStatus()).toEqual({
      apiKeyEnvName: "DEEPSEEK_API_KEY",
      configured: true,
      provider: "DeepSeek"
    });
  });

  it("uses admin provider credentials when requested", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "regular-key";
    process.env.ADMIN_AI_PROVIDER = "deepseek";
    process.env.ADMIN_DEEPSEEK_API_KEY = "admin-key";

    expect(getAiProviderConfigStatus({ useAdminConfig: true })).toEqual({
      apiKeyEnvName: "ADMIN_DEEPSEEK_API_KEY",
      configured: true,
      provider: "DeepSeek"
    });
  });

  it("throws for unsupported providers", () => {
    process.env.AI_PROVIDER = "unknown";

    expect(() => getAiProvider()).toThrow("Unsupported AI_PROVIDER: unknown");
  });

  it("fails before network calls when the API key is missing", async () => {
    await expect(
      getAiProvider().analyzeJob({ rawJd: "Senior frontend engineer" })
    ).rejects.toThrow("OPENAI_API_KEY is not configured.");
  });
});
