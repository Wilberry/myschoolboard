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
  section: {
    id: string;
    schoolId: string;
    stage: "PRIMARY" | "SECONDARY";
    active: boolean;
  } | null;
  enrollment: {
    schoolId: string;
    studentId: string;
    classId: string;
    sessionId: string;
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
    schoolId: string;
    membershipId: string;
    classId: string;
    sessionId: string;
    kind: "PRIMARY" | "SUPPORT";
    status: "ACTIVE" | "ENDED";
  }>;
}

export function hasExactActiveEnrollment(context: AttendanceContext): boolean {
  const e = context.enrollment;
  const s = context.section;
  return Boolean(
    context.schoolId &&
    context.classId &&
    context.sessionId &&
    context.studentId &&
    context.schoolActive &&
    context.sessionActive &&
    context.classActive &&
    s &&
    s.id &&
    s.schoolId === context.schoolId &&
    s.active &&
    e &&
    e.status === "ACTIVE" &&
    e.schoolId === context.schoolId &&
    e.studentId === context.studentId &&
    e.classId === context.classId &&
    e.sessionId === context.sessionId,
  );
}

export function canSubmitAttendance(
  actor: AttendanceActor,
  context: AttendanceContext,
): boolean {
  return (
    hasExactActiveEnrollment(context) &&
    actor.active &&
    actor.schoolId === context.schoolId &&
    (actor.role === "FORM_TEACHER" || actor.role === "TEACHER") &&
    actor.formTeacherResponsibilities.some(
      (r) =>
        r.schoolId === context.schoolId &&
        r.membershipId === actor.membershipId &&
        r.classId === context.classId &&
        r.sessionId === context.sessionId &&
        r.kind === "PRIMARY" &&
        r.status === "ACTIVE",
    )
  );
}

export type AttendanceRegisterContext = Omit<
  AttendanceContext,
  "studentId" | "enrollment"
>;

/** Register-level approval checks the stored class section independently
 * of student-level eligibility, never fabricating an enrollment relationship.
 */
export function canApproveRegister(
  actor: AttendanceActor,
  context: AttendanceRegisterContext,
): boolean {
  const section = context.section;
  if (
    !actor.active ||
    !context.schoolId ||
    !context.classId ||
    !context.sessionId ||
    !context.schoolActive ||
    !context.sessionActive ||
    !context.classActive ||
    actor.schoolId !== context.schoolId ||
    !section ||
    !section.id ||
    !section.active ||
    section.schoolId !== context.schoolId
  )
    return false;
  return (
    ((actor.role === "HEAD_OF_SECTION" && section.stage === "PRIMARY") ||
      (actor.role === "PRINCIPAL" && section.stage === "SECONDARY")) &&
    actor.verifiedSectionIds.includes(section.id)
  );
}

export function canApproveAttendance(
  actor: AttendanceActor,
  context: AttendanceContext,
): boolean {
  return (
    hasExactActiveEnrollment(context) && canApproveRegister(actor, context)
  );
}
