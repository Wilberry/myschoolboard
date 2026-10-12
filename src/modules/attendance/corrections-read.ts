import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import {
  readAttendanceReviewerOptions,
  readFormTeacherAttendanceOptions,
} from "./navigation";
import { AttendanceError } from "./service";

const id = z.string().min(1).max(128).refine(v => v.trim() === v);
function checkId(value: string) {
  if (!id.safeParse(value).success) throw new AttendanceError("INVALID_INPUT");
}
async function actorId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AttendanceError("UNAUTHENTICATED");
  return session.user.id;
}
interface RegisterRow {
  id: string;
  className: string;
  sessionName: string;
  attendanceDate: Date;
}
interface CorrectionEntry {
  entryId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  originalMark: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  effectiveMark: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  pending: boolean;
}
interface ApprovedRegisterRow {
  id: string;
  className: string;
  sessionName: string;
  attendanceDate: Date;
  entries: CorrectionEntry[];
}

/** Enumerate only approved registers for exact currently active PRIMARY Form
 * Teacher responsibility. Empty permission is denied; no teacher-wide roster
 * or an unconstrained parent/student read is created.
 */
export async function readCorrectableRegisters(schoolId: string) {
  checkId(schoolId);
  const userId = await actorId();
  if (!await readFormTeacherAttendanceOptions(userId, schoolId)) {
    throw new AttendanceError("NOT_FOUND");
  }
  const rows = await prisma.$queryRaw<RegisterRow[]>(Prisma.sql`
    SELECT register."id", c."name" AS "className",
      period."name" AS "sessionName", register."attendanceDate"
    FROM "AttendanceRegister" register
    JOIN "School" school ON school."id" = register."schoolId"
      AND school."isActive" = true
    JOIN "Membership" teacher ON teacher."schoolId" = school."id"
      AND teacher."userId" = ${userId} AND teacher."isActive" = true
      AND teacher."role" IN ('FORM_TEACHER', 'TEACHER')
    JOIN "FormTeacherResponsibility" responsibility
      ON responsibility."schoolId" = register."schoolId"
      AND responsibility."membershipId" = teacher."id"
      AND responsibility."classId" = register."classId"
      AND responsibility."sessionId" = register."sessionId"
      AND responsibility."kind" = 'PRIMARY'
      AND responsibility."status" = 'ACTIVE'
    JOIN "AcademicSession" period ON period."id" = register."sessionId"
      AND period."schoolId" = register."schoolId" AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = register."classId"
      AND c."schoolId" = register."schoolId" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = c."schoolId" AND section."isActive" = true
    WHERE register."schoolId" = ${schoolId}
      AND register."status" = 'APPROVED'
    ORDER BY register."attendanceDate" DESC, register."id" ASC
    LIMIT 100
  `);
  return rows.map(row => ({
    ...row, attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
  }));
}

/** The submitted original mark remains visible alongside the effective mark;
 * returned/pending requests NEVER contribute to effectiveMark. The historical
 * pupil identity is constrained by the existing immutable exact-enrollment
 * entry and by the Form Teacher's CURRENT class/session responsibility.
 */
export async function readCorrectableEntryDetail(schoolId: string, registerId: string) {
  checkId(schoolId);
  checkId(registerId);
  const userId = await actorId();
  const rows = await prisma.$queryRaw<ApprovedRegisterRow[]>(Prisma.sql`
    SELECT register."id", c."name" AS "className",
      period."name" AS "sessionName", register."attendanceDate",
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'entryId', marks."entryId",
          'admissionNumber', marks."admissionNumber",
          'givenName', marks."givenName",
          'familyName', marks."familyName",
          'originalMark', marks."originalMark",
          'effectiveMark', marks."effectiveMark",
          'pending', marks."pending"
        ) ORDER BY marks."admissionNumber", marks."entryId")
        FROM (
          SELECT mark."id" AS "entryId",
            pupil."admissionNumber", pupil."givenName", pupil."familyName",
            mark."mark" AS "originalMark",
            COALESCE((
              SELECT approved."proposedMark"
              FROM "AttendanceCorrectionRequest" approved
              JOIN "AttendanceCorrectionDecision" decided
                ON decided."schoolId" = approved."schoolId"
                AND decided."requestId" = approved."id"
                AND decided."approved" = true
              WHERE approved."schoolId" = mark."schoolId"
                AND approved."entryId" = mark."id"
              ORDER BY approved."revision" DESC
              LIMIT 1
            ), mark."mark") AS "effectiveMark",
            EXISTS (
              SELECT 1 FROM "AttendanceCorrectionRequest" pending
              LEFT JOIN "AttendanceCorrectionDecision" resolution
                ON resolution."schoolId" = pending."schoolId"
                AND resolution."requestId" = pending."id"
              WHERE pending."schoolId" = mark."schoolId"
                AND pending."entryId" = mark."id"
                AND resolution."id" IS NULL
            ) AS "pending"
          FROM "AttendanceEntry" mark
          JOIN "StudentEnrollment" enroll
            ON enroll."id" = mark."enrollmentId"
            AND enroll."schoolId" = mark."schoolId"
            AND enroll."studentId" = mark."studentId"
            AND enroll."sessionId" = mark."sessionId"
            AND enroll."classId" = mark."classId"
          JOIN "StudentRecord" pupil
            ON pupil."id" = enroll."studentId"
            AND pupil."schoolId" = enroll."schoolId"
          WHERE mark."registerId" = register."id"
            AND mark."schoolId" = register."schoolId"
          ORDER BY pupil."admissionNumber", mark."id"
          LIMIT 501
        ) marks
      ), '[]'::jsonb) AS "entries"
    FROM "AttendanceRegister" register
    JOIN "School" school ON school."id" = register."schoolId"
      AND school."isActive" = true
    JOIN "Membership" teacher ON teacher."schoolId" = school."id"
      AND teacher."userId" = ${userId} AND teacher."isActive" = true
      AND teacher."role" IN ('TEACHER', 'FORM_TEACHER')
    JOIN "FormTeacherResponsibility" responsibility
      ON responsibility."schoolId" = register."schoolId"
      AND responsibility."membershipId" = teacher."id"
      AND responsibility."classId" = register."classId"
      AND responsibility."sessionId" = register."sessionId"
      AND responsibility."kind" = 'PRIMARY'
      AND responsibility."status" = 'ACTIVE'
    JOIN "AcademicSession" period ON period."id" = register."sessionId"
      AND period."schoolId" = register."schoolId" AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = register."classId"
      AND c."schoolId" = register."schoolId" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = c."schoolId" AND section."isActive" = true
    WHERE register."schoolId" = ${schoolId}
      AND register."id" = ${registerId} AND register."status" = 'APPROVED'
    LIMIT 1
  `);
  if (rows.length !== 1) throw new AttendanceError("NOT_FOUND");
  if (rows[0].entries.length > 500) throw new AttendanceError("CONFLICT");
  return {
    ...rows[0],
    attendanceDate: rows[0].attendanceDate.toISOString().slice(0, 10),
  };
}

interface QueueRow {
  id: string;
  registerId: string;
  className: string;
  sectionName: string;
  attendanceDate: Date;
  createdAt: Date;
}
interface CorrectionDetailRow extends QueueRow {
  revision: number;
  entryId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  originalMark: string;
  expectedMark: string;
  proposedMark: string;
  requestReason: string;
}

/** A pending queue deliberately excludes pupil IDs, names, and marks. Every
 * resulting row binds the actor to the request's REGISTERED class.sectionId.
 */
export async function readPendingCorrectionQueue(schoolId: string) {
  checkId(schoolId);
  const userId = await actorId();
  if (!await readAttendanceReviewerOptions(userId, schoolId)) {
    throw new AttendanceError("NOT_FOUND");
  }
  const rows = await prisma.$queryRaw<QueueRow[]>(Prisma.sql`
    SELECT correction."id", correction."registerId",
      c."name" AS "className", section."name" AS "sectionName",
      register."attendanceDate", correction."createdAt"
    FROM "AttendanceCorrectionRequest" correction
    LEFT JOIN "AttendanceCorrectionDecision" decision
      ON decision."schoolId" = correction."schoolId"
      AND decision."requestId" = correction."id"
    JOIN "AttendanceRegister" register
      ON register."schoolId" = correction."schoolId"
      AND register."id" = correction."registerId"
      AND register."status" = 'APPROVED'
    JOIN "School" school ON school."id" = register."schoolId"
      AND school."isActive" = true
    JOIN "AcademicSession" period ON period."id" = register."sessionId"
      AND period."schoolId" = register."schoolId" AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = register."classId"
      AND c."schoolId" = register."schoolId" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = c."schoolId" AND section."isActive" = true
    JOIN "Membership" reviewer
      ON reviewer."schoolId" = register."schoolId"
      AND reviewer."userId" = ${userId} AND reviewer."isActive" = true
      AND reviewer."role" IN ('HEAD_OF_SECTION', 'PRINCIPAL')
    JOIN "ScopeGrant" grant
      ON grant."membershipId" = reviewer."id"
      AND grant."scopeId" = section."id"
      AND grant."type" = 'SECTION' AND grant."verified" = true
    WHERE correction."schoolId" = ${schoolId} AND decision."id" IS NULL
      AND (
        (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
        OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
      )
    ORDER BY correction."createdAt" ASC, correction."id" ASC
    LIMIT 100
  `);
  return rows.map(row => ({
    ...row,
    attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Opening one queued request independently repeats the full exact grant,
 * active role and stored class.stage join before projecting pupil mark detail.
 */
export async function readPendingCorrectionDetail(schoolId: string, requestId: string) {
  checkId(schoolId);
  checkId(requestId);
  const userId = await actorId();
  const rows = await prisma.$queryRaw<CorrectionDetailRow[]>(Prisma.sql`
    SELECT correction."id", correction."registerId",
      c."name" AS "className", section."name" AS "sectionName",
      register."attendanceDate", correction."createdAt",
      correction."entryId", correction."revision",
      correction."expectedMark", correction."proposedMark",
      correction."reason" AS "requestReason",
      mark."mark" AS "originalMark",
      pupil."admissionNumber", pupil."givenName", pupil."familyName"
    FROM "AttendanceCorrectionRequest" correction
    LEFT JOIN "AttendanceCorrectionDecision" decision
      ON decision."schoolId" = correction."schoolId"
      AND decision."requestId" = correction."id"
    JOIN "AttendanceEntry" mark ON mark."id" = correction."entryId"
      AND mark."schoolId" = correction."schoolId"
      AND mark."registerId" = correction."registerId"
    JOIN "StudentEnrollment" enroll
      ON enroll."id" = mark."enrollmentId"
      AND enroll."schoolId" = mark."schoolId"
      AND enroll."studentId" = mark."studentId"
      AND enroll."classId" = mark."classId"
      AND enroll."sessionId" = mark."sessionId"
    JOIN "StudentRecord" pupil ON pupil."id" = enroll."studentId"
      AND pupil."schoolId" = enroll."schoolId"
    JOIN "AttendanceRegister" register
      ON register."schoolId" = correction."schoolId"
      AND register."id" = correction."registerId"
      AND register."status" = 'APPROVED'
    JOIN "School" school ON school."id" = register."schoolId"
      AND school."isActive" = true
    JOIN "AcademicSession" period ON period."id" = register."sessionId"
      AND period."schoolId" = register."schoolId" AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = register."classId"
      AND c."schoolId" = register."schoolId" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = c."schoolId" AND section."isActive" = true
    JOIN "Membership" reviewer
      ON reviewer."schoolId" = register."schoolId"
      AND reviewer."userId" = ${userId} AND reviewer."isActive" = true
      AND reviewer."role" IN ('HEAD_OF_SECTION', 'PRINCIPAL')
    JOIN "ScopeGrant" grant
      ON grant."membershipId" = reviewer."id"
      AND grant."scopeId" = section."id"
      AND grant."type" = 'SECTION' AND grant."verified" = true
    WHERE correction."schoolId" = ${schoolId} AND correction."id" = ${requestId}
      AND decision."id" IS NULL
      AND (
        (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
        OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
      )
    LIMIT 1
  `);
  if (rows.length !== 1) throw new AttendanceError("NOT_FOUND");
  return {
    ...rows[0],
    attendanceDate: rows[0].attendanceDate.toISOString().slice(0, 10),
    createdAt: rows[0].createdAt.toISOString(),
  };
}
