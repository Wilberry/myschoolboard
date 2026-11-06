import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { LessonNoteError } from "./service";

const validId = (v: string) => Boolean(v && v === v.trim() && v.length <= 128);
interface PupilLesson {
  id: string;
  topic: string;
  kind: "LESSON_NOTE" | "SCHEME_OF_WORK";
  weekStart: number | null;
  weekEnd: number | null;
  className: string;
  subjectName: string;
  termName: string;
  revisionNumber: number;
  objectives?: string;
  content?: string;
}
/** No general academic:read permission is used. Every projection comes from
 * a single SQL statement joining the signed-in STUDENT membership to an
 * unrevoked administrator-attested binding, active exact enrollment and
 * active class/session/term, then approved + released, not withdrawn, revision.
 */
export async function readPupilReleasedLessons(
  schoolId: string,
  noteId?: string,
): Promise<PupilLesson[]> {
  if (!validId(schoolId) || (noteId !== undefined && !validId(noteId))) {
    throw new LessonNoteError("INVALID_INPUT");
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new LessonNoteError("UNAUTHENTICATED");
  const userId = session.user.id;
  // Deny unauthorised *empty lists*, too; final SQL still revalidates every
  // sensitive row so a revoked identity cannot survive between queries.
  const linked = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "STUDENT",
      isActive: true,
      school: { isActive: true },
      studentAccountLink: {
        revocation: null,
        student: {
          schoolId,
          status: "ENROLLED",
          enrollments: {
            some: {
              schoolId,
              status: "ACTIVE",
              session: { status: "ACTIVE" },
              schoolClass: { isActive: true, section: { isActive: true } },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  if (!linked) throw new LessonNoteError("NOT_FOUND");
  const projection = noteId
    ? Prisma.sql`, revision."objectives", revision."content"`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<PupilLesson[]>(Prisma.sql`
    SELECT DISTINCT n."id", n."topic", n."kind", n."weekStart", n."weekEnd", c."name" AS "className",
      subject."name" AS "subjectName", term."name" AS "termName",
      n."currentRevision" AS "revisionNumber" ${projection}
    FROM "School" school
    JOIN "Membership" member ON member."schoolId" = school."id"
      AND member."userId" = ${userId}
      AND member."role" = 'STUDENT' AND member."isActive" = true
    JOIN "StudentAccountLink" binding
      ON binding."schoolId" = school."id"
      AND binding."studentMembershipId" = member."id"
    LEFT JOIN "StudentAccountLinkRevocation" revocation
      ON revocation."schoolId" = binding."schoolId"
      AND revocation."linkId" = binding."id"
    JOIN "StudentRecord" pupil ON pupil."id" = binding."studentId"
      AND pupil."schoolId" = school."id" AND pupil."status" = 'ENROLLED'
    JOIN "StudentEnrollment" enrollment
      ON enrollment."studentId" = pupil."id"
      AND enrollment."schoolId" = school."id"
      AND enrollment."status" = 'ACTIVE'
    JOIN "AcademicSession" period ON period."id" = enrollment."sessionId"
      AND period."schoolId" = school."id" AND period."status" = 'ACTIVE'
    JOIN "SchoolClass" c ON c."id" = enrollment."classId"
      AND c."schoolId" = school."id" AND c."isActive" = true
    JOIN "SchoolSection" section ON section."id" = c."sectionId"
      AND section."schoolId" = school."id" AND section."isActive" = true
    JOIN "LessonNote" n ON n."schoolId" = school."id"
      AND n."sessionId" = period."id" AND n."classId" = c."id"
      AND n."status" = 'APPROVED'
    JOIN "AcademicTerm" term ON term."id" = n."termId"
      AND term."schoolId" = n."schoolId"
      AND term."sessionId" = period."id" AND term."status" = 'ACTIVE'
    JOIN "Subject" subject ON subject."id" = n."subjectId"
      AND subject."schoolId" = school."id" AND subject."isActive" = true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."id" = n."assignmentId"
      AND assignment."schoolId" = n."schoolId"
      AND assignment."classId" = n."classId"
      AND assignment."sessionId" = n."sessionId"
      AND assignment."subjectId" = n."subjectId"
      AND assignment."membershipId" = n."teacherMembershipId"
      AND assignment."status" = 'ACTIVE'
    JOIN "Membership" teacher ON teacher."id" = n."teacherMembershipId"
      AND teacher."schoolId" = n."schoolId"
      AND teacher."role" = 'TEACHER' AND teacher."isActive" = true
    JOIN "LessonNoteRevision" revision ON revision."schoolId" = n."schoolId"
      AND revision."noteId" = n."id"
      AND revision."revisionNumber" = n."currentRevision"
    JOIN "LessonReleaseEvent" released ON released."schoolId" = n."schoolId"
      AND released."noteId" = n."id"
      AND released."revisionNumber" = n."currentRevision"
      AND released."eventType" = 'RELEASED'
    WHERE school."id" = ${schoolId} AND school."isActive" = true
      AND revocation."id" IS NULL
      AND (${noteId ?? null}::text IS NULL OR n."id" = ${noteId ?? null})
      AND EXISTS (
        SELECT 1 FROM "LessonNoteEvent" approval
        WHERE approval."schoolId" = n."schoolId"
          AND approval."noteId" = n."id"
          AND approval."revisionNumber" = n."currentRevision"
          AND approval."eventType" = 'APPROVED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM "LessonReleaseEvent" withdrawn
        WHERE withdrawn."schoolId" = n."schoolId"
          AND withdrawn."noteId" = n."id"
          AND withdrawn."revisionNumber" = n."currentRevision"
          AND withdrawn."eventType" = 'WITHDRAWN'
      )
    ORDER BY n."id" ASC LIMIT ${noteId ? 1 : 100}
  `);
  if (noteId && rows.length === 0) throw new LessonNoteError("NOT_FOUND");
  return rows;
}
