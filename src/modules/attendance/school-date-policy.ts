/** School calendar policy used by attendance submissions and corrections.
 * No client-provided timezone or policy values authorize writes. The same
 * bounds are independently checked by PostgreSQL insertion triggers. */
export interface AttendanceDatePolicy {
  timeZone: string;
  submissionBackdateDays: number;
  correctionWindowDays: number;
}

export const DEFAULT_ATTENDANCE_DATE_POLICY: Readonly<AttendanceDatePolicy> =
  Object.freeze({
    timeZone: "Etc/UTC",
    submissionBackdateDays: 7,
    correctionWindowDays: 30,
  });

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function ordinal(value: string): number | null {
  if (!datePattern.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }
  return Math.floor(date.getTime() / 86_400_000);
}

/** Return calendar date in an IANA timezone using year/month/day components.
 * Avoid adding elapsed milliseconds, which fails across DST transitions. */
export function dateInSchoolTimeZone(now: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const pick = (key: "year" | "month" | "day") =>
    parts.find((part) => part.type === key)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function isSupportedTimeZone(timeZone: string): boolean {
  if (
    timeZone.length < 3 ||
    timeZone.length > 64 ||
    timeZone !== timeZone.trim()
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Strictly narrower than the earlier SQL UTC nonfuture check. */
export function isAttendanceDateAllowed(
  attendanceDate: string,
  policy: AttendanceDatePolicy,
  action: "SUBMIT" | "CORRECT",
  now: Date = new Date(),
): boolean {
  const submittedOrdinal = ordinal(attendanceDate);
  if (submittedOrdinal === null || !Number.isFinite(now.getTime()))
    return false;
  if (!isSupportedTimeZone(policy.timeZone)) return false;
  const windowDays =
    action === "SUBMIT"
      ? policy.submissionBackdateDays
      : policy.correctionWindowDays;
  if (
    !Number.isInteger(windowDays) ||
    windowDays < 0 ||
    windowDays > (action === "SUBMIT" ? 30 : 365)
  )
    return false;
  const local = ordinal(dateInSchoolTimeZone(now, policy.timeZone));
  const utc = ordinal(now.toISOString().slice(0, 10));
  if (local === null || utc === null) return false;
  const age = local - submittedOrdinal;
  return (
    age >= 0 &&
    age <= windowDays &&
    (action !== "SUBMIT" || submittedOrdinal <= utc)
  );
}
