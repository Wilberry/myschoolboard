import { prisma } from "@/src/lib/db";

interface ClassOption {
  schoolName: string;
  classId: string;
  className: string;
  sessionId: string;
  sessionName: string;
}

/** Attendance navigation does not trust a school-level academic:read flag:
 * Form Teacher class/session options require the exact active PRIMARY
 * responsibility, current active school and class classification.
 */
export async function readFormTeacherAttendanceOptions(userId: string, schoolId: string) {
  if (!userId || !schoolId) return null;
  const classes = await prisma.$queryRaw<ClassOption[]>`
    SELECT school."name" AS "schoolName", c."id" AS "classId",
      c."name" AS "className", period."id" AS "sessionId",
      period."name" AS "sessionName"
    FROM "School" school
    JOIN "Membership" actor ON actor."schoolId" = school."id"
      AND actor."userId" = ${userId} AND actor."isActive" = true
      AND actor."role" IN ('TEACHER', 'FORM_TEACHER')
    JOIN "FormTeacherResponsibility" responsibility
      ON responsibility."schoolId" = school."id"
      AND responsibility."membershipId" = actor."id"
      AND responsibility."kind" = 'PRIMARY'
      AND responsibility."status" = 'ACTIVE'
    JOIN "AcademicSession" period ON period."id" = responsibility."sessionId"
      AND period."schoolId" = school."id" AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = responsibility."classId"
      AND c."schoolId" = school."id" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = school."id" AND section."isActive" = true
    WHERE school."id" = ${schoolId} AND school."isActive" = true
    ORDER BY period."name" DESC, c."name" ASC, c."id" ASC
    LIMIT 100
  `;
  if (classes.length === 0) return null;
  return {
    schoolName: classes[0].schoolName,
    classes: classes.map(({ classId, className, sessionId, sessionName }) => ({
      classId, className, sessionId, sessionName,
    })),
  };
}

interface ReviewerSectionRow {
  schoolName: string;
  sectionName: string;
}

/** Separate reviewer navigation; the pending-reader and decision service both
 * repeat authorization over exact current section resources independently.
 */
export async function readAttendanceReviewerOptions(userId: string, schoolId: string) {
  if (!userId || !schoolId) return null;
  const sections = await prisma.$queryRaw<ReviewerSectionRow[]>`
    SELECT school."name" AS "schoolName", section."name" AS "sectionName"
    FROM "School" school
    JOIN "Membership" reviewer ON reviewer."schoolId" = school."id"
      AND reviewer."userId" = ${userId} AND reviewer."isActive" = true
      AND reviewer."role" IN ('HEAD_OF_SECTION', 'PRINCIPAL')
    JOIN "ScopeGrant" grant ON grant."membershipId" = reviewer."id"
      AND grant."type" = 'SECTION' AND grant."verified" = true
    JOIN "SchoolSection" section ON section."schoolId" = school."id"
      AND section."id" = grant."scopeId" AND section."isActive" = true
    WHERE school."id" = ${schoolId} AND school."isActive" = true
      AND (
        (reviewer."role" = 'HEAD_OF_SECTION' AND section."stage" = 'PRIMARY')
        OR (reviewer."role" = 'PRINCIPAL' AND section."stage" = 'SECONDARY')
      )
    ORDER BY section."name" ASC
    LIMIT 30
  `;
  if (sections.length === 0) return null;
  return { schoolName: sections[0].schoolName, sectionNames: sections.map(x => x.sectionName) };
}
