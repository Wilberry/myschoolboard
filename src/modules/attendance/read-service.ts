import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { AttendanceError } from "./service";

const identifier = z.string().min(1).max(128).refine(v => v.trim() === v);
function validateId(value: string) {
  if (!identifier.safeParse(value).success) throw new AttendanceError("INVALID_INPUT");
}
async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AttendanceError("UNAUTHENTICATED");
  return session.user.id;
}

interface RosterMember {
  enrollmentId: string;
  studentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
}
interface RosterRow {
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
  roster: RosterMember[];
}

/** Every selected pupil belongs to the exact active school/class/session, and
 * the acting TEACHER/FORM_TEACHER owns ACTIVE PRIMARY Form Teacher responsibility.
 * The access grant and pupil projection are resolved inside ONE SQL statement:
 * absence of students does not bypass permission verification.
 */
export async function readFormTeacherRoster(
  schoolId: string,
  classId: string,
  sessionId: string,
) {
  validateId(schoolId);
  validateId(classId);
  validateId(sessionId);
  const userId = await currentUser();
  const rows = await prisma.$queryRaw<RosterRow[]>(Prisma.sql`
    SELECT c."id" AS "classId", c."name" AS "className",
      period."id" AS "sessionId", period."name" AS "sessionName",
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'enrollmentId', active."enrollmentId",
            'studentId', active."studentId",
            'admissionNumber', active."admissionNumber",
            'givenName', active."givenName",
            'familyName', active."familyName"
          ) ORDER BY active."admissionNumber", active."enrollmentId"
        )
        FROM (
          SELECT enrollment."id" AS "enrollmentId", enrollment."studentId",
            pupil."admissionNumber", pupil."givenName", pupil."familyName"
          FROM "StudentEnrollment" enrollment
          JOIN "StudentRecord" pupil ON pupil."id" = enrollment."studentId"
            AND pupil."schoolId" = enrollment."schoolId"
            AND pupil."status" = 'ENROLLED'
          WHERE enrollment."schoolId" = school."id"
            AND enrollment."sessionId" = period."id"
            AND enrollment."classId" = c."id"
            AND enrollment."status" = 'ACTIVE'
          ORDER BY pupil."admissionNumber", enrollment."id"
          LIMIT 501
        ) active
      ), '[]'::jsonb) AS "roster"
    FROM "School" school
    JOIN "Membership" actor ON actor."schoolId" = school."id"
      AND actor."userId" = ${userId}
      AND actor."isActive" = true
      AND actor."role" IN ('TEACHER', 'FORM_TEACHER')
    JOIN "AcademicSession" period ON period."schoolId" = school."id"
      AND period."id" = ${sessionId} AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."schoolId" = school."id"
      AND c."id" = ${classId} AND c."isActive" = true
    JOIN "SchoolSection" section ON section."schoolId" = c."schoolId"
      AND section."id" = c."sectionId" AND section."isActive" = true
    JOIN "FormTeacherResponsibility" responsibility
      ON responsibility."schoolId" = school."id"
      AND responsibility."membershipId" = actor."id"
      AND responsibility."classId" = c."id"
      AND responsibility."sessionId" = period."id"
      AND responsibility."status" = 'ACTIVE'
      AND responsibility."kind" = 'PRIMARY'
    WHERE school."id" = ${schoolId} AND school."isActive" = true
    LIMIT 1
  `);
  if (rows.length !== 1) throw new AttendanceError("NOT_FOUND");
  if (rows[0].roster.length > 500) throw new AttendanceError("CONFLICT");
  return rows[0];
}

interface ReviewEntry {
  enrollmentId: string;
  admissionNumber: string;
  givenName: string;
  familyName: string;
  mark: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
}
interface ReviewRow {
  id: string;
  schoolId: string;
  classId: string;
  className: string;
  sectionName: string;
  sessionId: string;
  sessionName: string;
  attendanceDate: Date;
  submittedAt: Date;
  status: "SUBMITTED";
  entries: ReviewEntry[];
}

/** Reviewer queue and detail share the identical final-query authority:
 * exact persisted class.sectionId equals an active, verified SECTION grant,
 * HEAD_OF_SECTION maps to PRIMARY, PRINCIPAL maps to SECONDARY.
 * Queue mode never projects minor identities or marks.
 */
export async function readPendingAttendanceReviews(
  schoolId: string,
  registerId?: string,
) {
  validateId(schoolId);
  if (registerId !== undefined) validateId(registerId);
  const userId = await currentUser();
  const rows = await prisma.$queryRaw<ReviewRow[]>(Prisma.sql`
    SELECT register."id", register."schoolId", register."classId",
      c."name" AS "className", section."name" AS "sectionName",
      period."id" AS "sessionId", period."name" AS "sessionName",
      register."attendanceDate", register."submittedAt", register."status",
      CASE WHEN ${registerId !== undefined} THEN COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'enrollmentId', entries."enrollmentId",
            'admissionNumber', entries."admissionNumber",
            'givenName', entries."givenName",
            'familyName', entries."familyName",
            'mark', entries."mark"
          ) ORDER BY entries."admissionNumber", entries."enrollmentId"
        )
        FROM (
          SELECT mark."enrollmentId", mark."mark",
            pupil."admissionNumber", pupil."givenName", pupil."familyName"
          FROM "AttendanceEntry" mark
          JOIN "StudentEnrollment" enroll ON enroll."id" = mark."enrollmentId"
            AND enroll."schoolId" = mark."schoolId"
            AND enroll."studentId" = mark."studentId"
            AND enroll."sessionId" = mark."sessionId"
            AND enroll."classId" = mark."classId"
          JOIN "StudentRecord" pupil ON pupil."id" = enroll."studentId"
            AND pupil."schoolId" = enroll."schoolId"
          WHERE mark."schoolId" = register."schoolId"
            AND mark."registerId" = register."id"
          ORDER BY pupil."admissionNumber", mark."enrollmentId"
          LIMIT 501
        ) entries
      ), '[]'::jsonb) ELSE '[]'::jsonb END AS "entries"
    FROM "AttendanceRegister" register
    JOIN "School" school ON school."id" = register."schoolId"
      AND school."isActive" = true
    JOIN "AcademicSession" period ON period."id" = register."sessionId"
      AND period."schoolId" = register."schoolId"
      AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = register."classId"
      AND c."schoolId" = register."schoolId" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = c."schoolId" AND section."isActive" = true
    JOIN "Membership" reviewer ON reviewer."schoolId" = register."schoolId"
      AND reviewer."userId" = ${userId} AND reviewer."isActive" = true
      AND reviewer."role" IN ('HEAD_OF_SECTION', 'PRINCIPAL')
    JOIN "ScopeGrant" grant ON grant."membershipId" = reviewer."id"
      AND grant."type" = 'SECTION'
      AND grant."scopeId" = section."id"
      AND grant."verified" = true
    WHERE register."schoolId" = ${schoolId}
      AND register."status" = 'SUBMITTED'
      AND (
        (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
        OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
      )
      AND (${registerId ?? null}::text IS NULL
        OR register."id" = ${registerId ?? null})
    ORDER BY register."attendanceDate" DESC, register."id" ASC
    LIMIT ${registerId ? 1 : 100}
  `);
  if (registerId && rows.length === 0) throw new AttendanceError("NOT_FOUND");
  if (rows.some(row => row.entries.length > 500)) throw new AttendanceError("CONFLICT");
  return rows.map(row => ({
    ...row,
    attendanceDate: row.attendanceDate.toISOString().slice(0, 10),
    submittedAt: row.submittedAt.toISOString(),
  }));
}
