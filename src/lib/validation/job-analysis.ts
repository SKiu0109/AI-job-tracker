export const MIN_JD_TEXT_LENGTH = 80;
export const MAX_JD_TEXT_LENGTH = 12000;

export type JobAnalysisValidationCode =
  | "empty_jd"
  | "jd_too_short"
  | "jd_too_long";

export type JobAnalysisValidationResult =
  | {
      ok: true;
      rawJd: string;
    }
  | {
      ok: false;
      code: JobAnalysisValidationCode;
    };

export function validateRawJd(value: string | undefined) {
  const rawJd = value?.trim() ?? "";

  if (!rawJd) {
    return {
      ok: false,
      code: "empty_jd"
    } satisfies JobAnalysisValidationResult;
  }

  if (rawJd.length < MIN_JD_TEXT_LENGTH) {
    return {
      ok: false,
      code: "jd_too_short"
    } satisfies JobAnalysisValidationResult;
  }

  if (rawJd.length > MAX_JD_TEXT_LENGTH) {
    return {
      ok: false,
      code: "jd_too_long"
    } satisfies JobAnalysisValidationResult;
  }

  return {
    ok: true,
    rawJd
  } satisfies JobAnalysisValidationResult;
}
