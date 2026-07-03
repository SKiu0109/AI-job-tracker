import { describe, it, expect } from "vitest";
import { dictionary, Language } from "./dictionary";

/**
 * 验证中英文词典的 key 一致性：
 * 每个英文 key 都应该在中文词典中有对应的翻译，反之亦然。
 */
describe("dictionary", () => {
  const languages: Language[] = ["en", "zh"];

  function getDeepKeys(value: unknown, prefix = ""): string[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [prefix];
    }

    return Object.entries(value).flatMap(([key, child]) =>
      getDeepKeys(child, prefix ? `${prefix}.${key}` : key)
    );
  }

  it("has entries for all languages", () => {
    for (const lang of languages) {
      expect(dictionary[lang]).toBeDefined();
      expect(typeof dictionary[lang]).toBe("object");
    }
  });

  it("has identical top-level keys across all languages", () => {
    const enKeys = Object.keys(dictionary.en).sort();
    const zhKeys = Object.keys(dictionary.zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("has identical nested keys across all languages", () => {
    const enKeys = getDeepKeys(dictionary.en).sort();
    const zhKeys = getDeepKeys(dictionary.zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("has no empty translation values", () => {
    function assertNoEmptyValues(value: unknown, lang: Language, keyPath = "") {
      if (typeof value === "string") {
        expect(
          value.trim(),
          `Empty translation for key "${keyPath}" in ${lang}`
        ).not.toBe("");
        return;
      }

      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return;
      }

      for (const [key, child] of Object.entries(value)) {
        assertNoEmptyValues(child, lang, keyPath ? `${keyPath}.${key}` : key);
      }
    }

    for (const lang of languages) {
      assertNoEmptyValues(dictionary[lang], lang);
    }
  });

  it("has consistent simple placeholder count per key (not ICU plural)", () => {
    // ICU plural forms (like {count, plural, ...}) are allowed to differ across
    // languages because zh uses simple {count} while en uses complex forms.
    // This test only checks simple {name} placeholders, and skips keys where
    // either side uses ICU plural syntax (contains "plural").
    const enEntries = Object.entries(dictionary.en) as [string, string][];
    for (const [key, enValue] of enEntries) {
      if (typeof enValue !== "string") continue;

      const zhValue = dictionary.zh[key as keyof typeof dictionary.zh];
      if (typeof zhValue !== "string") continue;

      // Skip keys that use ICU plural syntax
      if (enValue.includes("plural") || zhValue.includes("plural")) continue;

      const simplePattern = /\{(\w+)\}/g;

      const enCount = [...(enValue.match(simplePattern) || [])].length;
      const zhCount = [...(zhValue.match(simplePattern) || [])].length;

      expect(
        zhCount,
        `Simple placeholder count mismatch for key "${key}": en=${enCount}, zh=${zhCount}\nEN: ${enValue}\nZH: ${zhValue}`
      ).toBe(enCount);
    }
  });

  it("has a reasonable number of translation entries (≥ 50)", () => {
    const enCount = Object.keys(dictionary.en).length;
    expect(enCount).toBeGreaterThanOrEqual(50);
  });
});
