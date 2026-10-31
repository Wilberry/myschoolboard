import { describe, expect, it } from "vitest";
import {
  assignSchoolSubscriptionInput,
  createPlanRevisionInput,
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
      expect(assignSchoolSubscriptionInput.safeParse(input).success).toBe(false);
    }
  });

  it("derives current/upcoming/ended without mutating school state", () => {
    const start = new Date("2026-11-01T00:00:00.000Z");
    const end = new Date("2027-01-01T00:00:00.000Z");
    expect(subscriptionPeriodView(start, end, new Date("2026-10-31T00:00:00Z"))).toBe("UPCOMING");
    expect(subscriptionPeriodView(start, end, start)).toBe("CURRENT");
    expect(subscriptionPeriodView(start, end, new Date("2026-12-01T00:00:00Z"))).toBe("CURRENT");
    expect(subscriptionPeriodView(start, end, end)).toBe("ENDED");
  });
});
