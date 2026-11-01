import { describe, expect, it } from "vitest";
import {
  DEFAULT_ATTENDANCE_DATE_POLICY,
  dateInSchoolTimeZone,
  isAttendanceDateAllowed,
  isSupportedTimeZone,
} from "./school-date-policy";

const utc = DEFAULT_ATTENDANCE_DATE_POLICY;
describe("attendance school-local calendar limits", () => {
  it("defaults to an explicit, conservative UTC policy", () => {
    expect(utc).toEqual({
      timeZone: "Etc/UTC",
      submissionBackdateDays: 7,
      correctionWindowDays: 30,
    });
    expect(
      isAttendanceDateAllowed(
        "2026-10-12",
        utc,
        "SUBMIT",
        new Date("2026-10-12T11:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isAttendanceDateAllowed(
        "2026-10-05",
        utc,
        "SUBMIT",
        new Date("2026-10-12T11:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isAttendanceDateAllowed(
        "2026-10-04",
        utc,
        "SUBMIT",
        new Date("2026-10-12T11:00:00.000Z"),
      ),
    ).toBe(false);
  });
  it("counts calendar days across DST, not elapsed-hour duration", () => {
    const policy = {
      timeZone: "America/New_York",
      submissionBackdateDays: 1,
      correctionWindowDays: 1,
    };
    const now = new Date("2026-11-02T05:10:00.000Z");
    expect(dateInSchoolTimeZone(now, policy.timeZone)).toBe("2026-11-02");
    expect(isAttendanceDateAllowed("2026-11-01", policy, "SUBMIT", now)).toBe(
      true,
    );
    expect(isAttendanceDateAllowed("2026-10-31", policy, "SUBMIT", now)).toBe(
      false,
    );
  });
  it("never permits a date after UTC today, even if timezone is ahead", () => {
    const policy = {
      timeZone: "Pacific/Auckland",
      submissionBackdateDays: 7,
      correctionWindowDays: 30,
    };
    const now = new Date("2026-10-12T15:00:00.000Z"); // local October 13
    expect(dateInSchoolTimeZone(now, policy.timeZone)).toBe("2026-10-13");
    expect(isAttendanceDateAllowed("2026-10-13", policy, "SUBMIT", now)).toBe(
      false,
    );
    expect(isAttendanceDateAllowed("2026-10-12", policy, "SUBMIT", now)).toBe(
      true,
    );
  });
  it("denies a future local day in timezones behind UTC", () => {
    const policy = {
      timeZone: "America/Los_Angeles",
      submissionBackdateDays: 7,
      correctionWindowDays: 30,
    };
    const now = new Date("2026-10-12T02:00:00.000Z");
    expect(dateInSchoolTimeZone(now, policy.timeZone)).toBe("2026-10-11");
    expect(isAttendanceDateAllowed("2026-10-12", policy, "SUBMIT", now)).toBe(
      false,
    );
  });
  it("enforces separate correction-window limits without rewriting records", () => {
    const policy = {
      timeZone: "Africa/Lagos",
      submissionBackdateDays: 0,
      correctionWindowDays: 2,
    };
    const now = new Date("2026-10-12T15:00:00.000Z");
    expect(isAttendanceDateAllowed("2026-10-11", policy, "SUBMIT", now)).toBe(
      false,
    );
    expect(isAttendanceDateAllowed("2026-10-10", policy, "CORRECT", now)).toBe(
      true,
    );
    expect(isAttendanceDateAllowed("2026-10-09", policy, "CORRECT", now)).toBe(
      false,
    );
  });
  it("denies invalid dates, invalid timezone and out-of-bounds policy", () => {
    expect(isSupportedTimeZone("Africa/Lagos")).toBe(true);
    expect(isSupportedTimeZone("invalid/unknown-zone")).toBe(false);
    const now = new Date("2026-10-12T11:00:00.000Z");
    expect(isAttendanceDateAllowed("2026-02-30", utc, "SUBMIT", now)).toBe(
      false,
    );
    expect(isAttendanceDateAllowed("2026-10-13", utc, "SUBMIT", now)).toBe(
      false,
    );
    expect(
      isAttendanceDateAllowed(
        "2026-10-12",
        {
          ...utc,
          timeZone: "not-real",
        },
        "SUBMIT",
        now,
      ),
    ).toBe(false);
    expect(
      isAttendanceDateAllowed(
        "2026-10-12",
        {
          ...utc,
          submissionBackdateDays: 31,
        },
        "SUBMIT",
        now,
      ),
    ).toBe(false);
    expect(
      isAttendanceDateAllowed(
        "2026-10-12",
        {
          ...utc,
          correctionWindowDays: 366,
        },
        "CORRECT",
        now,
      ),
    ).toBe(false);
  });
});
