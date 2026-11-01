import { describe, expect, it } from "vitest";
import {
  assignSchoolSubscriptionInput,
  createPlanRevisionInput,
  observedSubscriptionStatus,
  quotaObservation,
  subscriptionPeriodView,
} from "./subscription-policy";

const basePlan = {
  code: "school-essentials",
  name: "School essentials",
  features: ["LESSONS", "ATTENDANCE"],
  maxStudents: 250,
  maxStaff: null,
  reason: "Synthetic platform catalog revision",
};

const period = {
  planRevisionId: "synthetic-revision",
  startsAt: "2026-11-01T00:00:00Z",
  endsAt: "2027-01-01T00:00:00Z",
  reason: "Synthetic operator-approved period",
};

describe("platform subscription validation and temporal visibility", () => {
  it("accepts a bounded plan with explicit features and nullable quota", () => {
    expect(createPlanRevisionInput.safeParse(basePlan).success).toBe(true);
  });

  it("refuses unknown permissions, duplicate features and ambiguous code", () => {
    for (const input of [
      { ...basePlan, features: ["LESSONS", "LESSONS"] },
      { ...basePlan, features: ["ACADEMIC_ADMIN"] },
      { ...basePlan, code: "school/foreign" },
      { ...basePlan, maxStudents: 0 },
      { ...basePlan, extraPrivilege: "platform:manage" },
      { ...basePlan, reason: "x" },
    ]) {
      expect(createPlanRevisionInput.safeParse(input).success).toBe(false);
    }
  });

  it("requires an offset-aware, bounded, non-empty subscription window", () => {
    expect(assignSchoolSubscriptionInput.safeParse(period).success).toBe(true);
    for (const input of [
      { ...period, endsAt: period.startsAt },
      { ...period, startsAt: period.endsAt },
      { ...period, startsAt: "2026-11-01" },
      { ...period, endsAt: "2040-01-01T00:00:00Z" },
      { ...period, schoolId: "other-school" },
      { ...period, planRevisionId: "" },
    ]) {
      expect(assignSchoolSubscriptionInput.safeParse(input).success).toBe(
        false,
      );
    }
  });

  it("derives current/upcoming/ended without mutating school state", () => {
    const start = new Date("2026-11-01T00:00:00.000Z");
    const end = new Date("2027-01-01T00:00:00.000Z");
    expect(
      subscriptionPeriodView(start, end, new Date("2026-10-31T00:00:00Z")),
    ).toBe("UPCOMING");
    expect(subscriptionPeriodView(start, end, start)).toBe("CURRENT");
    expect(
      subscriptionPeriodView(start, end, new Date("2026-12-01T00:00:00Z")),
    ).toBe("CURRENT");
    expect(subscriptionPeriodView(start, end, end)).toBe("ENDED");
  });
  it("treats advisory quota state as observation, not an access decision", () => {
    expect(quotaObservation(2, 2)).toEqual({
      used: 2,
      limit: 2,
      exceedsLimit: false,
    });
    expect(quotaObservation(3, 2)).toEqual({
      used: 3,
      limit: 2,
      exceedsLimit: true,
    });
    expect(quotaObservation(200, null)).toEqual({
      used: 200,
      limit: null,
      exceedsLimit: null,
    });
    for (const used of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => quotaObservation(used, 1)).toThrow();
    }
    expect(() => quotaObservation(1, 0)).toThrow();
    expect(() => quotaObservation(1, 2.5)).toThrow();
  });

  it("recognizes no plan, upcoming, current and ended intervals", () => {
    const now = new Date("2026-12-01T00:00:00Z");
    const earlier = new Date("2026-11-01T00:00:00Z");
    const later = new Date("2027-01-01T00:00:00Z");
    expect(observedSubscriptionStatus(null, null, now)).toBe("NONE");
    expect(
      observedSubscriptionStatus(later, new Date("2027-02-01T00:00:00Z"), now),
    ).toBe("UPCOMING");
    expect(observedSubscriptionStatus(earlier, later, now)).toBe("CURRENT");
    expect(observedSubscriptionStatus(earlier, now, now)).toBe("ENDED");
  });
});
