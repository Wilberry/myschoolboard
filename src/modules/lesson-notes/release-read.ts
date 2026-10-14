import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { LessonNoteError } from "./service";

interface ReleaseRow {
  id: string;
  topic: string;
  kind: "LESSON_NOTE" | "SCHEME_OF_WORK";
  weekStart: number | null;
  weekEnd: number | null;
  className: string;
  sectionName: string;
  termName: string;
  currentRevision: number;
  released: boolean;
  withdrawn: boolean;
}

/** No pupil data. A single SQL statement combines authenticated reviewer,
 * exact stored school/class/section, approved note and immutable audit.
 */
export async function readLessonReleaseQueue(schoolId: string) {
  if (!schoolId || schoolId.trim() !== schoolId || schoolId.length > 128) {
    throw new LessonNoteError("INVALID_INPUT");
  }
  const login = await auth.api.getSession({ headers: await headers() });
  if (!login) throw new LessonNoteError("UNAUTHENTICATED");
  const actorUserId = login.user.id;
  const rows = await prisma.$queryRaw<ReleaseRow[]>(Prisma.sql`
    SELECT n."id", n."topic", n."kind", n."weekStart", n."weekEnd", c."name" AS "className",
      section."name" AS "sectionName", term."name" AS "termName",
      n."currentRevision",
      EXISTS (SELECT 1 FROM "LessonReleaseEvent" e
        WHERE e."schoolId" = n."schoolId" AND e."noteId" = n."id"
          AND e."revisionNumber" = n."currentRevision"
          AND e."eventType" = 'RELEASED') AS "released",
      EXISTS (SELECT 1 FROM "LessonReleaseEvent" e
        WHERE e."schoolId" = n."schoolId" AND e."noteId" = n."id"
          AND e."revisionNumber" = n."currentRevision"
          AND e."eventType" = 'WITHDRAWN') AS "withdrawn"
    FROM "LessonNote" n
    JOIN "School" school ON school."id" = n."schoolId"
      AND school."isActive" = true
    JOIN "AcademicSession" session ON session."id" = n."sessionId"
      AND session."schoolId" = n."schoolId" AND session."status" = 'ACTIVE'
    JOIN "AcademicTerm" term ON term."id" = n."termId"
      AND term."schoolId" = n."schoolId"
      AND term."sessionId" = n."sessionId" AND term."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = n."classId"
      AND c."schoolId" = n."schoolId" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = c."schoolId" AND section."isActive" = true
    JOIN "Subject" subject ON subject."id" = n."subjectId"
      AND subject."schoolId" = n."schoolId" AND subject."isActive" = true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."id" = n."assignmentId"
      AND assignment."schoolId" = n."schoolId"
      AND assignment."membershipId" = n."teacherMembershipId"
      AND assignment."classId" = n."classId"
      AND assignment."subjectId" = n."subjectId"
      AND assignment."sessionId" = n."sessionId"
      AND assignment."status" = 'ACTIVE'
    JOIN "Membership" teacher ON teacher."id" = n."teacherMembershipId"
      AND teacher."schoolId" = n."schoolId" AND teacher."isActive" = true
      AND teacher."role" = 'TEACHER'
    JOIN "Membership" reviewer ON reviewer."schoolId" = n."schoolId"
      AND reviewer."userId" = ${actorUserId} AND reviewer."isActive" = true
      AND reviewer."role" IN ('HEAD_OF_SECTION', 'PRINCIPAL')
    JOIN "ScopeGrant" grant ON grant."membershipId" = reviewer."id"
      AND grant."type" = 'SECTION' AND grant."scopeId" = section."id"
      AND grant."verified" = true
    WHERE n."schoolId" = ${schoolId} AND n."status" = 'APPROVED'
      AND EXISTS (SELECT 1 FROM "LessonNoteEvent" approval
        WHERE approval."schoolId" = n."schoolId"
          AND approval."noteId" = n."id"
          AND approval."revisionNumber" = n."currentRevision"
          AND approval."eventType" = 'APPROVED')
      AND ((reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
        OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY'))
    ORDER BY n."id" ASC LIMIT 100
  `);
  // Unrelated actor must not receive an authorized empty queue.
  if (rows.length === 0) {
    const allowed = await prisma.$queryRaw<
      Array<{ allowed: boolean }>
    >(Prisma.sql`
      SELECT true AS "allowed" FROM "School" school
      JOIN "Membership" reviewer ON reviewer."schoolId" = school."id"
        AND reviewer."userId" = ${actorUserId} AND reviewer."isActive" = true
        AND reviewer."role" IN ('HEAD_OF_SECTION','PRINCIPAL')
      JOIN "ScopeGrant" grant ON grant."membershipId" = reviewer."id"
        AND grant."type" = 'SECTION' AND grant."verified" = true
      JOIN "SchoolSection" section ON section."schoolId" = school."id"
        AND section."id" = grant."scopeId" AND section."isActive" = true
      WHERE school."id" = ${schoolId} AND school."isActive" = true
        AND ((reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
          OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY'))
      LIMIT 1
    `);
    if (allowed.length === 0) throw new LessonNoteError("NOT_FOUND");
  }
  return rows;
}
