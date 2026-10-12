import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { loadAttendanceDatePolicy } from "./policy-service";
import { isAttendanceDateAllowed } from "./school-date-policy";
import { canApproveRegister, type AttendanceActor } from "./eligibility";
import { AttendanceError } from "./service";

const id = z.string().min(1).max(128).refine(value => value === value.trim());
const reason = z.string().trim().min(5).max(500);
const mark = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
const requestSchema = z.object({
  entryId: id,
  expectedMark: mark,
  proposedMark: mark,
  reason,
}).strict();
const decisionSchema = z.object({
  action: z.enum(["APPROVE", "RETURN"]),
  reason,
}).strict();

function requireId(value: string) {
  if (!id.safeParse(value).success) throw new AttendanceError("INVALID_INPUT");
}
async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AttendanceError("UNAUTHENTICATED");
  return session.user.id;
}
function mapError(error: unknown): never {
  if (error instanceof AttendanceError) throw error;
  if (error && typeof error === "object" && "code" in error &&
    (error.code === "P2002" || error.code === "P2034")) {
    throw new AttendanceError("CONFLICT");
  }
  throw new AttendanceError("INTERNAL");
}

/** Submit an immutable, reasoned correction request to an APPROVED register.
 * The student's original AttendanceEntry is never changed. A current PRIMARY
 * Form Teacher can request correction for an exact historic entry even if the
 * student's enrollment subsequently ended, but only while the session remains
 * ACTIVE and the Form Teacher has current exact school/class responsibility.
 */
export async function requestAttendanceCorrection(
  schoolId: string, registerId: string, input: unknown,
) {
  requireId(schoolId);
  requireId(registerId);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success || parsed.data.expectedMark === parsed.data.proposedMark) {
    throw new AttendanceError("INVALID_INPUT");
  }
  const value = parsed.data;
  const userId = await currentUserId();
  try {
    return await prisma.$transaction(async tx => {
      // Same global lock order as attendance submit and review.
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id" = ${schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId" = ${schoolId} AND "userId" = ${userId} FOR UPDATE`;
      const actor = await tx.membership.findFirst({
        where: {
          schoolId, userId, isActive: true,
          role: { in: ["FORM_TEACHER", "TEACHER"] },
          school: { isActive: true },
        },
        select: { id: true, role: true },
      });
      if (!actor) throw new AttendanceError("FORBIDDEN");
      await tx.$queryRaw`SELECT "id" FROM "AttendanceRegister"
        WHERE "schoolId" = ${schoolId} AND "id" = ${registerId} FOR UPDATE`;
      const register = await tx.attendanceRegister.findFirst({
        where: {
          id: registerId, schoolId, status: "APPROVED",
          session: { status: "ACTIVE" },
          schoolClass: {
            isActive: true,
            section: { isActive: true, schoolId },
          },
        },
        select: { id: true, classId: true, sessionId: true, attendanceDate: true },
      });
      if (!register) throw new AttendanceError("NOT_FOUND");
      const datePolicy = await loadAttendanceDatePolicy(tx, schoolId);
      if (!isAttendanceDateAllowed(register.attendanceDate.toISOString().slice(0, 10), datePolicy, "CORRECT")) {
        throw new AttendanceError("CONFLICT");
      }

      await tx.$queryRaw`SELECT "id" FROM "AcademicSession"
        WHERE "schoolId" = ${schoolId} AND "id" = ${register.sessionId}
        FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "SchoolClass"
        WHERE "schoolId" = ${schoolId} AND "id" = ${register.classId}
        FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "FormTeacherResponsibility"
        WHERE "schoolId" = ${schoolId} AND "membershipId" = ${actor.id}
          AND "classId" = ${register.classId}
          AND "sessionId" = ${register.sessionId}
        FOR UPDATE`;
      const responsibility = await tx.formTeacherResponsibility.findFirst({
        where: {
          schoolId, classId: register.classId, sessionId: register.sessionId,
          membershipId: actor.id, kind: "PRIMARY", status: "ACTIVE",
        },
        select: { id: true },
      });
      if (!responsibility) throw new AttendanceError("NOT_FOUND");

      await tx.$queryRaw`SELECT "id" FROM "AttendanceEntry"
        WHERE "schoolId" = ${schoolId} AND "registerId" = ${registerId}
          AND "id" = ${value.entryId} FOR UPDATE`;
      const entry = await tx.attendanceEntry.findFirst({
        where: {
          id: value.entryId, schoolId, registerId,
          register: { classId: register.classId, sessionId: register.sessionId },
        },
        select: { id: true, mark: true },
      });
      if (!entry) throw new AttendanceError("NOT_FOUND");

      const [latest, latestApproved] = await Promise.all([
        tx.attendanceCorrectionRequest.findFirst({
          where: { schoolId, entryId: entry.id },
          orderBy: { revision: "desc" },
          select: { revision: true, decision: { select: { id: true } } },
        }),
        tx.attendanceCorrectionRequest.findFirst({
          where: { schoolId, entryId: entry.id, decision: { is: { approved: true } } },
          orderBy: { revision: "desc" },
          select: { proposedMark: true },
        }),
      ]);
      if (latest && !latest.decision) throw new AttendanceError("CONFLICT");
      const effective = latestApproved?.proposedMark ?? entry.mark;
      if (effective !== value.expectedMark) throw new AttendanceError("CONFLICT");

      // The database INSERT trigger independently revalidates actor identity,
      // current PRIMARY responsibility, exact entry and expected revision/mark.
      return await tx.attendanceCorrectionRequest.create({
        data: {
          schoolId, registerId, entryId: entry.id,
          revision: (latest?.revision ?? 0) + 1,
          expectedMark: value.expectedMark,
          proposedMark: value.proposedMark,
          reason: value.reason,
          requestedByUserId: userId,
          requestedByMembershipId: actor.id,
        },
        select: {
          id: true, registerId: true, entryId: true,
          revision: true, expectedMark: true, proposedMark: true,
          createdAt: true,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    mapError(error);
  }
}

/** A second, section-authorized human decides one pending correction.
 * The decision is an immutable row, NOT an UPDATE to AttendanceEntry, request,
 * original attendance author history or earlier approved revisions.
 */
export async function decideAttendanceCorrection(
  schoolId: string, requestId: string, input: unknown,
) {
  requireId(schoolId);
  requireId(requestId);
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) throw new AttendanceError("INVALID_INPUT");
  const userId = await currentUserId();
  try {
    return await prisma.$transaction(async tx => {
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
      // Request ID is not trusted for tenant lookup: school scope in every lock.
      const provisional = await tx.attendanceCorrectionRequest.findFirst({
        where: { id: requestId, schoolId },
        select: { registerId: true, entryId: true },
      });
      if (!provisional) throw new AttendanceError("NOT_FOUND");
      await tx.$queryRaw`SELECT "id" FROM "AttendanceRegister"
        WHERE "schoolId" = ${schoolId} AND "id" = ${provisional.registerId}
        FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "AttendanceEntry"
        WHERE "schoolId" = ${schoolId} AND "id" = ${provisional.entryId}
        AND "registerId" = ${provisional.registerId} FOR UPDATE`;
      const correction = await tx.attendanceCorrectionRequest.findFirst({
        where: { id: requestId, schoolId, registerId: provisional.registerId },
        select: {
          id: true, registerId: true, requestedByMembershipId: true,
          decision: { select: { id: true } },
          entry: {
            select: {
              register: {
                select: {
                  status: true, classId: true, sessionId: true,
                  session: { select: { status: true } },
                  schoolClass: { select: { isActive: true, sectionId: true } },
                },
              },
            },
          },
        },
      });
      const register = correction?.entry.register;
      if (!correction || !register || correction.decision ||
          register.status !== "APPROVED" || register.session.status !== "ACTIVE" ||
          !register.schoolClass.isActive || !register.schoolClass.sectionId) {
        throw new AttendanceError("NOT_FOUND");
      }
      if (correction.requestedByMembershipId === reviewer.id) {
        throw new AttendanceError("FORBIDDEN");
      }
      const sectionId = register.schoolClass.sectionId;
      await tx.$queryRaw`SELECT "id" FROM "SchoolSection"
        WHERE "schoolId" = ${schoolId} AND "id" = ${sectionId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ScopeGrant"
        WHERE "membershipId" = ${reviewer.id}
          AND "type" = 'SECTION' AND "scopeId" = ${sectionId} FOR UPDATE`;
      const [section, grant] = await Promise.all([
        tx.schoolSection.findFirst({
          where: { id: sectionId, schoolId, isActive: true },
          select: { id: true, schoolId: true, stage: true, isActive: true },
        }),
        tx.scopeGrant.findFirst({
          where: { membershipId: reviewer.id, type: "SECTION",
            scopeId: sectionId, verified: true },
          select: { id: true },
        }),
      ]);
      if (!section || !grant) throw new AttendanceError("NOT_FOUND");
      const acting: AttendanceActor = {
        schoolId, active: true, role: reviewer.role,
        membershipId: reviewer.id, verifiedSectionIds: [section.id],
        formTeacherResponsibilities: [],
      };
      if (!canApproveRegister(acting, {
        schoolId, classId: register.classId, sessionId: register.sessionId,
        schoolActive: true, classActive: true, sessionActive: true,
        section: {
          id: section.id, schoolId: section.schoolId, stage: section.stage,
          active: section.isActive,
        },
      })) throw new AttendanceError("NOT_FOUND");
      // Composite FK and database actor trigger prevent alternate register,
      // actor spoofing, unverified grant, and duplicate reviewer decisions.
      return await tx.attendanceCorrectionDecision.create({
        data: {
          schoolId, registerId: correction.registerId, requestId: correction.id,
          reviewerUserId: userId, reviewerMembershipId: reviewer.id,
          approved: parsed.data.action === "APPROVE",
          reason: parsed.data.reason,
        },
        select: { id: true, requestId: true, approved: true, createdAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    mapError(error);
  }
}
