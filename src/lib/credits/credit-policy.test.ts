import { describe, expect, it } from "vitest";
import {
  shouldAutoMigrateGuestCreditsToUser,
  shouldFetchCreditsStatus
} from "./credit-policy";

describe("credit policy", () => {
  it("does not automatically migrate guest credits into authenticated accounts", () => {
    expect(shouldAutoMigrateGuestCreditsToUser()).toBe(false);
  });

  it("waits for auth initialization before fetching credit status", () => {
    expect(shouldFetchCreditsStatus(true)).toBe(false);
    expect(shouldFetchCreditsStatus(false)).toBe(true);
  });
});
