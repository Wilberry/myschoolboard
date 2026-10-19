/** Pure policy planning functions for future CBT attempt execution.
 * NEVER authorize an attempt using only these helpers: server authentication,
 * explicit school publication, current attested pupil/enrollment/class/term,
 * and PostgreSQL locks/constraints will remain mandatory prerequisites. */
export interface CbtWindow {
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  maxAttempts: number;
}
export interface AttemptSnapshot {
  startedAt: Date;
  submittedAt: Date | null;
}
export type CbtAdmissionResult =
  | { allowed: true; deadline: Date; attemptNumber: number }
  | {
      allowed: false;
      reason:
        "INVALID" | "NOT_OPEN" | "CLOSED" | "ACTIVE_ATTEMPT" | "ATTEMPT_LIMIT";
    };

function isDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
export function computeAttemptDeadline(
  startedAt: Date,
  scheduledEnd: Date,
  durationMinutes: number,
): Date | null {
  if (
    !isDate(startedAt) ||
    !isDate(scheduledEnd) ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 5 ||
    durationMinutes > 180 ||
    scheduledEnd <= startedAt
  )
    return null;
  const maxElapsedEnd = startedAt.getTime() + durationMinutes * 60_000;
  return new Date(Math.min(maxElapsedEnd, scheduledEnd.getTime()));
}

/** Counting *all* started attempts prevents re-entry attempts being
 * reset by abandoned/disconnected browser sessions. A stored active attempt
 * must be resumed via a separately authorized idempotent endpoint. */
export function evaluateAttemptAdmission(
  window: CbtWindow,
  now: Date,
  attempts: readonly AttemptSnapshot[],
): CbtAdmissionResult {
  if (
    !isDate(now) ||
    !isDate(window.startsAt) ||
    !isDate(window.endsAt) ||
    !(window.startsAt < window.endsAt) ||
    !Number.isInteger(window.durationMinutes) ||
    window.durationMinutes < 5 ||
    window.durationMinutes > 180 ||
    !Number.isInteger(window.maxAttempts) ||
    window.maxAttempts < 1 ||
    window.maxAttempts > 3 ||
    attempts.some(
      (a) =>
        !isDate(a.startedAt) ||
        (a.submittedAt !== null &&
          (!isDate(a.submittedAt) || a.submittedAt < a.startedAt)),
    ) ||
    attempts.length > 3
  )
    return { allowed: false, reason: "INVALID" };
  if (now < window.startsAt) return { allowed: false, reason: "NOT_OPEN" };
  if (now >= window.endsAt) return { allowed: false, reason: "CLOSED" };
  if (attempts.some((a) => a.submittedAt === null)) {
    return { allowed: false, reason: "ACTIVE_ATTEMPT" };
  }
  if (attempts.length >= window.maxAttempts) {
    return { allowed: false, reason: "ATTEMPT_LIMIT" };
  }
  const deadline = computeAttemptDeadline(
    now,
    window.endsAt,
    window.durationMinutes,
  );
  if (!deadline) return { allowed: false, reason: "INVALID" };
  return { allowed: true, deadline, attemptNumber: attempts.length + 1 };
}
