import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { LessonNoteError } from "./service";

interface ReleasedLessonRow {
  id: string;
  topic: string;
  className: string;
  subjectName: string;
  termName: string;
  revisionNumber: number;
  objectives: string;
  content: string;
}

/** No search parameters or client asserted pupil/class/session/term. This
 * query derives the STUDENT actor, most recent verified identity link, exact
 * ACTIVE StudentEnrollment and current approved+released immutable revision
 * in one SQL statement. With no explicit LINKED event, it yields no content.
 */
export async function readReleasedLessonsForStudent(schoolId: string) {
  if (!schoolId || schoolId.trim() !== schoolId || schoolId.length > 128) {
    throw new LessonNoteError("INVALID_INPUT");
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new LessonNoteError("UNAUTHENTICATED");
  const userId = session.user.id;
  const eligible = await prisma.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
    SELECT true AS "allowed"
    FROM "Membership" learner
    JOIN "School" school ON school."id" = learner."schoolId"
      AND school."isActive" = true
    JOIN LATERAL (
      SELECT link."studentId", link."eventType"
      FROM "StudentIdentityLinkEvent" link
      WHERE link."schoolId" = learner."schoolId"
        AND link."membershipId" = learner."id"
      ORDER BY link."sequence" DESC LIMIT 1
    ) identity ON identity."eventType" = 'LINKED'
    JOIN "StudentRecord" pupil ON pupil."id" = identity."studentId"
      AND pupil."schoolId" = learner."schoolId"
      AND pupil."status" = 'ENROLLED'
    WHERE learner."schoolId" = ${schoolId}
      AND learner."userId" = ${userId}
      AND learner."role" = 'STUDENT' AND learner."isActive" = true
      AND EXISTS (
        SELECT 1 FROM "StudentEnrollment" enrollment
        WHERE enrollment."studentId" = pupil."id"
          AND enrollment."schoolId" = pupil."schoolId"
          AND enrollment."status" = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM "AcademicSession" sess
            WHERE sess."id" = enrollment."sessionId"
              AND sess."schoolId" = enrollment."schoolId"
              AND sess."status" = 'ACTIVE'
          )
      )
    LIMIT 1
  `);
  if (!eligible.length) throw new LessonNoteError("NOT_FOUND");

  const notes = await prisma.$queryRaw<ReleasedLessonRow[]>(Prisma.sql`
    SELECT DISTINCT n."id", n."topic", c."name" AS "className",
      subject."name" AS "subjectName", term."name" AS "termName",
      n."currentRevision" AS "revisionNumber",
      content."objectives", content."content"
    FROM "School" school
    JOIN "Membership" learner ON learner."schoolId" = school."id"
      AND learner."userId" = ${userId} AND learner."isActive" = true
      AND learner."role" = 'STUDENT'
    JOIN LATERAL (
      SELECT link."studentId", link."eventType"
      FROM "StudentIdentityLinkEvent" link
      WHERE link."schoolId" = learner."schoolId"
        AND link."membershipId" = learner."id"
      ORDER BY link."sequence" DESC LIMIT 1
    ) identity ON identity."eventType" = 'LINKED'
    JOIN "StudentRecord" pupil ON pupil."id" = identity."studentId"
      AND pupil."schoolId" = school."id" AND pupil."status" = 'ENROLLED'
    JOIN "StudentEnrollment" enrollment
      ON enrollment."schoolId" = school."id"
      AND enrollment."studentId" = pupil."id"
      AND enrollment."status" = 'ACTIVE'
    JOIN "AcademicSession" sess ON sess."id" = enrollment."sessionId"
      AND sess."schoolId" = school."id" AND sess."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = enrollment."classId"
      AND c."schoolId" = school."id" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = school."id" AND section."isActive" = true
    JOIN "LessonNote" n ON n."schoolId" = school."id"
      AND n."classId" = enrollment."classId"
      AND n."sessionId" = enrollment."sessionId"
      AND n."status" = 'APPROVED'
    JOIN "AcademicTerm" term ON term."id" = n."termId"
      AND term."schoolId" = school."id"
      AND term."sessionId" = n."sessionId"
      AND term."status" = 'ACTIVE'
    JOIN "Subject" subject ON subject."id" = n."subjectId"
      AND subject."schoolId" = school."id" AND subject."isActive" = true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."id" = n."assignmentId"
      AND assignment."schoolId" = school."id"
      AND assignment."membershipId" = n."teacherMembershipId"
      AND assignment."classId" = n."classId"
      AND assignment."subjectId" = n."subjectId"
      AND assignment."sessionId" = n."sessionId"
      AND assignment."status" = 'ACTIVE'
    JOIN "Membership" teacher ON teacher."id" = n."teacherMembershipId"
      AND teacher."schoolId" = school."id"
      AND teacher."role" = 'TEACHER' AND teacher."isActive" = true
    JOIN "LessonNoteRevision" content
      ON content."schoolId" = n."schoolId"
      AND content."noteId" = n."id"
      AND content."revisionNumber" = n."currentRevision"
    WHERE school."id" = ${schoolId} AND school."isActive" = true
      AND EXISTS (
        SELECT 1 FROM "LessonNoteEvent" review
        WHERE review."schoolId" = n."schoolId"
          AND review."noteId" = n."id"
          AND review."revisionNumber" = n."currentRevision"
          AND review."eventType" = 'APPROVED'
      )
      AND EXISTS (
        SELECT 1 FROM "LessonReleaseEvent" released
        WHERE released."schoolId" = n."schoolId"
          AND released."noteId" = n."id"
          AND released."revisionNumber" = n."currentRevision"
          AND released."eventType" = 'RELEASED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "LessonReleaseEvent" withdrawn
        WHERE withdrawn."schoolId" = n."schoolId"
          AND withdrawn."noteId" = n."id"
          AND withdrawn."revisionNumber" = n."currentRevision"
          AND withdrawn."eventType" = 'WITHDRAWN'
      )
    ORDER BY n."id" ASC LIMIT 100
  `);
  return notes;
}
