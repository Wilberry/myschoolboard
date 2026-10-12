import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { loadAttendanceDatePolicy } from "./policy-service";
import { isAttendanceDateAllowed } from "./school-date-policy";
import {
  canApproveRegister,
  canSubmitAttendance,
  type AttendanceActor,
  type AttendanceContext,
} from "./eligibility";

const id = z.string().min(1).max(128).refine((v) => v === v.trim());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mark = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
const submitSchema = z.object({
  sessionId: id,
  classId: id,
  attendanceDate: date,
  marks: z.array(z.object({ enrollmentId: id, mark }).strict()).min(1).max(500),
}).strict();
const decisionSchema = z.object({
  action: z.enum(["APPROVE", "RETURN"]),
  reason: z.string().trim().min(5).max(500),
}).strict();

type Code = "UNAUTHENTICATED" | "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INTERNAL";
export class AttendanceError extends Error {
  constructor(readonly code: Code) {
    super(code);
    this.name = "AttendanceError";
  }
}

async function actorUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AttendanceError("UNAUTHENTICATED");
  return session.user.id;
}

function checkId(value: string) {
  if (!id.safeParse(value).success) throw new AttendanceError("INVALID_INPUT");
}

function parseDate(value: string): Date {
  const result = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(result.getTime()) ||
      result.toISOString().slice(0, 10) !== value) {
    throw new AttendanceError("INVALID_INPUT");
  }
  return result;
}

function mapAttendanceError(error: unknown): never {
  if (error instanceof AttendanceError) throw error;
  if (error && typeof error === "object" && "code" in error &&
      (error.code === "P2002" || error.code === "P2034")) {
    throw new AttendanceError("CONFLICT");
  }
  throw new AttendanceError("INTERNAL");
}

/** The complete submitted roster is a bounded snapshot of every currently
 * active student enrollment for EXACT school/class/session. No client-supplied
 * student ID, section ID, teacher relationship, or approval grant is accepted.
 */
export async function submitAttendance(schoolId: string, input: unknown) {
  checkId(schoolId);
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) throw new AttendanceError("INVALID_INPUT");
  const value = parsed.data;
  const attendanceDate = parseDate(value.attendanceDate);
  // Conservative UTC development default until a school timezone is configured.
  if (value.attendanceDate > new Date().toISOString().slice(0, 10)) {
    throw new AttendanceError("INVALID_INPUT");
  }
  const ids = value.marks.map((item) => item.enrollmentId);
  if (new Set(ids).size !== ids.length) {
    throw new AttendanceError("INVALID_INPUT");
  }
  const userId = await actorUserId();

  try {
    return await prisma.$transaction(async (tx) => {
      // Global lock order: school, acting membership, academic structure,
      // teacher responsibility, then sorted enrollment rows.
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id" = ${schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId" = ${schoolId} AND "userId" = ${userId} FOR UPDATE`;
      const datePolicy = await loadAttendanceDatePolicy(tx, schoolId);
      if (!isAttendanceDateAllowed(value.attendanceDate, datePolicy, "SUBMIT")) {
        throw new AttendanceError("INVALID_INPUT");
      }
      const actor = await tx.membership.findFirst({
        where: {
          schoolId, userId, isActive: true,
          role: { in: ["TEACHER", "FORM_TEACHER"] },
          school: { isActive: true },
        },
        select: { id: true, role: true },
      });
      if (!actor) throw new AttendanceError("FORBIDDEN");

      await tx.$queryRaw`SELECT "id" FROM "AcademicSession"
        WHERE "id" = ${value.sessionId} AND "schoolId" = ${schoolId}
        FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "SchoolClass"
        WHERE "id" = ${value.classId} AND "schoolId" = ${schoolId}
        FOR UPDATE`;
      const [period, schoolClass] = await Promise.all([
        tx.academicSession.findFirst({
          where: { id: value.sessionId, schoolId, status: "ACTIVE" },
          select: { startsOn: true, endsOn: true },
        }),
        tx.schoolClass.findFirst({
          where: {
            id: value.classId, schoolId, isActive: true,
            section: { schoolId, isActive: true },
          },
          select: { section: { select: { id: true, schoolId: true, stage: true, isActive: true } } },
        }),
      ]);
      if (!period || !schoolClass?.section ||
          attendanceDate < period.startsOn || attendanceDate > period.endsOn) {
        throw new AttendanceError("NOT_FOUND");
      }
      const section = schoolClass.section;
      await tx.$queryRaw`SELECT "id" FROM "SchoolSection"
        WHERE "id" = ${section.id} AND "schoolId" = ${schoolId}
        FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "FormTeacherResponsibility"
        WHERE "schoolId" = ${schoolId} AND "membershipId" = ${actor.id}
          AND "classId" = ${value.classId} AND "sessionId" = ${value.sessionId}
        FOR UPDATE`;
      const responsibility = await tx.formTeacherResponsibility.findFirst({
        where: {
          schoolId, sessionId: value.sessionId, classId: value.classId,
          membershipId: actor.id, status: "ACTIVE", kind: "PRIMARY",
        },
        select: { id: true, schoolId: true, classId: true, sessionId: true, membershipId: true, status: true, kind: true },
      });
      if (!responsibility) throw new AttendanceError("NOT_FOUND");

      await tx.$queryRaw`SELECT "id" FROM "StudentEnrollment"
        WHERE "schoolId" = ${schoolId} AND "classId" = ${value.classId}
          AND "sessionId" = ${value.sessionId} AND "status" = 'ACTIVE'
        ORDER BY "id" FOR UPDATE`;
      const roster = await tx.studentEnrollment.findMany({
        where: {
          schoolId, classId: value.classId, sessionId: value.sessionId,
          status: "ACTIVE", student: { status: "ENROLLED", schoolId },
        },
        select: {
          id: true, studentId: true, schoolId: true,
          classId: true, sessionId: true, status: true, startedAt: true,
        },
        take: 501,
        orderBy: { id: "asc" },
      });
      // Refuse partial or oversized registers: no silent absence defaults,
      // accidental omission of a student, or truncation of a full roster.
      if (roster.length === 0 || roster.length > 500 ||
          roster.length !== value.marks.length) {
        throw new AttendanceError("CONFLICT");
      }
      const byId = new Map(roster.map((row) => [row.id, row]));
      const acting: AttendanceActor = {
        active: true, schoolId, role: actor.role, membershipId: actor.id,
        verifiedSectionIds: [],
        formTeacherResponsibilities: [responsibility],
      };
      const marks = value.marks.map((item) => {
        const enrollment = byId.get(item.enrollmentId);
        if (!enrollment || value.attendanceDate < enrollment.startedAt.toISOString().slice(0, 10)) {
          throw new AttendanceError("CONFLICT");
        }
        const context: AttendanceContext = {
          schoolId, studentId: enrollment.studentId,
          classId: value.classId, sessionId: value.sessionId,
          schoolActive: true, sessionActive: true, classActive: true,
          section: { id: section.id, schoolId: section.schoolId, stage: section.stage, active: section.isActive },
          enrollment,
        };
        if (!canSubmitAttendance(acting, context)) throw new AttendanceError("NOT_FOUND");
        return {
          schoolId, enrollmentId: enrollment.id,
          studentId: enrollment.studentId, sessionId: value.sessionId,
          classId: value.classId, mark: item.mark,
        };
      });

      const register = await tx.attendanceRegister.create({
        data: {
          schoolId, sessionId: value.sessionId, classId: value.classId,
          attendanceDate,
          submittedByMembershipId: actor.id,
          formTeacherResponsibilityId: responsibility.id,
        },
        select: {
          id: true, schoolId: true, sessionId: true, classId: true,
          attendanceDate: true, status: true, submittedAt: true,
        },
      });
      await tx.attendanceEntry.createMany({
        data: marks.map((item) => ({ ...item, registerId: register.id })),
      });
      await tx.attendanceEvent.create({
        data: {
          schoolId, registerId: register.id,
          actorUserId: userId, actorMembershipId: actor.id,
          eventType: "SUBMITTED",
        },
      });
      return { ...register, entryCount: marks.length };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    mapAttendanceError(error);
  }
}

/** An HM may decide only their verified PRIMARY section; a Principal only
 * their verified SECONDARY section. The stored class.sectionId is authoritative.
 * A decision is terminal; future corrections need a separate audited model.
 */
export async function decideAttendance(schoolId: string, registerId: string, input: unknown) {
  checkId(schoolId);
  checkId(registerId);
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) throw new AttendanceError("INVALID_INPUT");
  const userId = await actorUserId();

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id" = ${schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId" = ${schoolId} AND "userId" = ${userId} FOR UPDATE`;
      const reviewer = await tx.membership.findFirst({
        where: {
          schoolId, userId, isActive: true,
          role: { in: ["HEAD_OF_SECTION", "PRINCIPAL"] },
          school: { isActive: true },
        },
        select: { id: true, role: true },
      });
      if (!reviewer) throw new AttendanceError("FORBIDDEN");
      await tx.$queryRaw`SELECT "id" FROM "AttendanceRegister"
        WHERE "id" = ${registerId} AND "schoolId" = ${schoolId} FOR UPDATE`;
      const register = await tx.attendanceRegister.findFirst({
        where: { id: registerId, schoolId, session: { status: "ACTIVE" } },
        select: {
          id: true, status: true, classId: true, sessionId: true,
          schoolClass: { select: { isActive: true, sectionId: true } },
        },
      });
      if (!register || !register.schoolClass.isActive ||
          !register.schoolClass.sectionId) throw new AttendanceError("NOT_FOUND");
      await tx.$queryRaw`SELECT "id" FROM "SchoolClass"
        WHERE "id" = ${register.classId} AND "schoolId" = ${schoolId} FOR UPDATE`;
      const sectionId = register.schoolClass.sectionId;
      await tx.$queryRaw`SELECT "id" FROM "SchoolSection"
        WHERE "id" = ${sectionId} AND "schoolId" = ${schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ScopeGrant"
        WHERE "membershipId" = ${reviewer.id} AND "type" = 'SECTION'
          AND "scopeId" = ${sectionId} FOR UPDATE`;
      const [section, grant] = await Promise.all([
        tx.schoolSection.findFirst({
          where: { id: sectionId, schoolId, isActive: true },
          select: { id: true, schoolId: true, stage: true, isActive: true },
        }),
        tx.scopeGrant.findFirst({
          where: {
            membershipId: reviewer.id, type: "SECTION",
            scopeId: sectionId, verified: true,
          },
          select: { id: true },
        }),
      ]);
      if (!section || !grant) throw new AttendanceError("NOT_FOUND");
      const acting: AttendanceActor = {
        active: true, schoolId, role: reviewer.role, membershipId: reviewer.id,
        verifiedSectionIds: [section.id], formTeacherResponsibilities: [],
      };
      const sectionAuthorized = canApproveRegister(acting, {
        schoolId, classId: register.classId, sessionId: register.sessionId,
        schoolActive: true, classActive: true, sessionActive: true,
        section: {
          id: section.id, schoolId: section.schoolId,
          stage: section.stage, active: section.isActive,
        },
      });
      if (!sectionAuthorized) throw new AttendanceError("NOT_FOUND");
      if (register.status !== "SUBMITTED") throw new AttendanceError("CONFLICT");
      // The immutable submitted entries must exist before a review.
      const entries = await tx.attendanceEntry.count({ where: { schoolId, registerId } });
      if (entries === 0) throw new AttendanceError("CONFLICT");

      const status = parsed.data.action === "APPROVE" ? "APPROVED" as const : "RETURNED" as const;
      const updated = await tx.attendanceRegister.update({
        where: { id: registerId },
        data: { status, reviewedAt: new Date() },
        select: {
          id: true, schoolId: true, classId: true, sessionId: true,
          attendanceDate: true, status: true, reviewedAt: true,
        },
      });
      await tx.attendanceEvent.create({
        data: {
          schoolId, registerId, actorUserId: userId,
          actorMembershipId: reviewer.id,
          eventType: status, reason: parsed.data.reason,
        },
      });
      return updated;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    mapAttendanceError(error);
  }
}
