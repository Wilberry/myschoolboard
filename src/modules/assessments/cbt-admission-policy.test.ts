import { describe, expect, it } from "vitest";
import {
  computeAttemptDeadline, evaluateAttemptAdmission,
} from "./cbt-admission-policy";

const at = (value: string) => new Date(value);
const schedule = {
  startsAt: at("2026-10-14T08:00:00.000Z"),
  endsAt: at("2026-10-14T10:00:00.000Z"),
  durationMinutes: 60, maxAttempts: 2,
};
describe("CBT attempt deadline planning — no executable attempt API", () => {
  it("rejects before opening, at exact close and after close", () => {
    expect(evaluateAttemptAdmission(schedule, at("2026-10-14T07:59:59.999Z"), []))
      .toEqual({ allowed: false, reason: "NOT_OPEN" });
    expect(evaluateAttemptAdmission(schedule, schedule.endsAt, []))
      .toEqual({ allowed: false, reason: "CLOSED" });
  });
  it("caps a late-starting attempt at examination close, never after", () => {
    const now = at("2026-10-14T09:50:00.000Z");
    expect(computeAttemptDeadline(now, schedule.endsAt, 60))
      .toEqual(schedule.endsAt);
    expect(evaluateAttemptAdmission(schedule, now, []))
      .toEqual({ allowed: true, deadline: schedule.endsAt, attemptNumber: 1 });
  });
  it("uses elapsed minutes for duration, not daylight-saving local date arithmetic", () => {
    const now = at("2026-10-14T08:30:00.000Z");
    expect(evaluateAttemptAdmission(schedule, now, []))
      .toEqual({
        allowed: true, deadline: at("2026-10-14T09:30:00.000Z"),
        attemptNumber: 1,
      });
  });
  it("counts all attempts and denies concurrent active attempt", () => {
    const active = { startedAt: at("2026-10-14T08:05:00.000Z"), submittedAt: null };
    expect(evaluateAttemptAdmission(schedule, at("2026-10-14T08:40:00.000Z"), [active]))
      .toEqual({ allowed: false, reason: "ACTIVE_ATTEMPT" });
    const finished = { ...active, submittedAt: at("2026-10-14T08:55:00.000Z") };
    expect(evaluateAttemptAdmission(schedule, at("2026-10-14T09:00:00.000Z"), [finished]))
      .toEqual({
        allowed: true, deadline: at("2026-10-14T10:00:00.000Z"),
        attemptNumber: 2,
      });
    expect(evaluateAttemptAdmission(schedule, at("2026-10-14T09:10:00.000Z"),
      [finished, finished])).toEqual({ allowed: false, reason: "ATTEMPT_LIMIT" });
  });
  it("denies malformed dates, reversed windows and invalid policy", () => {
    expect(evaluateAttemptAdmission({ ...schedule, maxAttempts: 4 },
      at("2026-10-14T09:00:00.000Z"), []))
      .toEqual({ allowed: false, reason: "INVALID" });
    expect(evaluateAttemptAdmission({ ...schedule, durationMinutes: 0 },
      at("2026-10-14T09:00:00.000Z"), []))
      .toEqual({ allowed: false, reason: "INVALID" });
    expect(evaluateAttemptAdmission(schedule, new Date(NaN), []))
      .toEqual({ allowed: false, reason: "INVALID" });
  });
});
