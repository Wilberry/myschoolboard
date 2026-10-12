import { describe, expect, it } from "vitest";
import {
  changeSchoolStatusInput,
  lifecycleTransitions,
  onboardSchoolInput,
  transitionEvent,
} from "./school-lifecycle-policy";

describe("platform school lifecycle transitions", () => {
  it("starts onboarding as a restricted pending school", () => {
    expect(
      onboardSchoolInput.safeParse({
        name: "Synthetic Combined School",
        slug: "synthetic-combined-school",
      }).success,
    ).toBe(true);
    expect(
      onboardSchoolInput.safeParse({
        name: "A",
        slug: "unsafe/other-school",
      }).success,
    ).toBe(false);
  });

  it("has no automatic reopening of closed schools", () => {
    expect(lifecycleTransitions.CLOSED).toEqual([]);
    for (const status of lifecycleTransitions.ACTIVE) {
      expect(status).not.toBe("PENDING");
    }
    expect(transitionEvent("CLOSED", "ACTIVE")).toBeNull();
  });

  it.each([
    ["PENDING", "ACTIVE", "ACTIVATED"],
    ["PENDING", "CLOSED", "CLOSED"],
    ["ACTIVE", "SUSPENDED", "SUSPENDED"],
    ["ACTIVE", "EXPIRED", "EXPIRED"],
    ["SUSPENDED", "ACTIVE", "REACTIVATED"],
    ["EXPIRED", "ACTIVE", "REACTIVATED"],
  ] as const)("transitions %s to %s as %s", (from, to, event) => {
    expect(transitionEvent(from, to)).toBe(event);
  });

  it("rejects repeating states and missing justifications", () => {
    expect(transitionEvent("ACTIVE", "ACTIVE")).toBeNull();
    expect(transitionEvent("PENDING", "EXPIRED")).toBeNull();
    expect(
      changeSchoolStatusInput.safeParse({
        status: "SUSPENDED",
        reason: " ",
      }).success,
    ).toBe(false);
    expect(
      changeSchoolStatusInput.safeParse({
        status: "SUSPENDED",
        reason: "Platform operator suspension for testing",
      }).success,
    ).toBe(true);
  });
});
