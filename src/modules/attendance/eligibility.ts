/** Phase 6 fail-closed attendance authorization kernel.
 * Callers MUST supply server-verified rows from the SAME transaction/query;
 * browser-supplied booleans or IDs are never authority. No route uses this yet.
 */
export interface AttendanceContext {
  schoolId: string;
  classId: string;
  sessionId: string;
  studentId: string;
  schoolActive: boolean;
  sessionActive: boolean;
  classActive: boolean;
  section: { id: string; schoolId: string; stage: "PRIMARY" | "SECONDARY"; active: boolean } | null;
  enrollment: {
    schoolId: string; studentId: string; classId: string; sessionId: string;
    status: "ACTIVE" | "ENDED";
  } | null;
}

export interface AttendanceActor {
  schoolId: string;
  active: boolean;
  role: string;
  membershipId: string;
  verifiedSectionIds: readonly string[];
  formTeacherResponsibilities: ReadonlyArray<{
    schoolId: string; membershipId: string; classId: string; sessionId: string;
    kind: "PRIMARY" | "SUPPORT"; status: "ACTIVE" | "ENDED";
  }>;
}

export function hasExactActiveEnrollment(context: AttendanceContext): boolean {
  const e = context.enrollment;
  const s = context.section;
  return Boolean(
    context.schoolId && context.classId && context.sessionId && context.studentId &&
    context.schoolActive && context.sessionActive && context.classActive &&
    s && s.id && s.schoolId === context.schoolId && s.active &&
    e && e.status === "ACTIVE" && e.schoolId === context.schoolId &&
    e.studentId === context.studentId && e.classId === context.classId &&
    e.sessionId === context.sessionId,
  );
}

export function canSubmitAttendance(
  actor: AttendanceActor, context: AttendanceContext,
): boolean {
  return hasExactActiveEnrollment(context) &&
    actor.active && actor.schoolId === context.schoolId &&
    (actor.role === "FORM_TEACHER" || actor.role === "TEACHER") &&
    actor.formTeacherResponsibilities.some(r =>
      r.schoolId === context.schoolId &&
      r.membershipId === actor.membershipId &&
      r.classId === context.classId && r.sessionId === context.sessionId &&
      r.kind === "PRIMARY" && r.status === "ACTIVE");
}

export function canApproveAttendance(
  actor: AttendanceActor, context: AttendanceContext,
): boolean {
  if (!hasExactActiveEnrollment(context) || !actor.active ||
      actor.schoolId !== context.schoolId || !context.section) return false;
  return ((actor.role === "HEAD_OF_SECTION" && context.section.stage === "PRIMARY") ||
    (actor.role === "PRINCIPAL" && context.section.stage === "SECONDARY")) &&
    actor.verifiedSectionIds.includes(context.section.id);
}
