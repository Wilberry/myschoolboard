import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentFailure,
  assessmentUserId,
  exactAssessmentTeacher,
} from "./question-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((v) => v === v.trim());
const isoUtc = z
  .string()
  .refine(
    (v) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v) &&
      Number.isFinite(Date.parse(v)),
    { message: "UTC ISO date-time required" },
  );
const item = z
  .object({
    questionId: id,
    points: z.number().int().min(1).max(20),
  })
  .strict();
const draftSchema = z
  .object({
    assignmentId: id,
    termId: id,
    kind: z.enum(["QUIZ", "TEST", "EXAM"]),
    title: z.string().trim().min(5).max(180),
    startsAt: isoUtc,
    endsAt: isoUtc,
    durationMinutes: z.number().int().min(5).max(180),
    maxAttempts: z.number().int().min(1).max(3),
    passPercent: z.number().int().min(0).max(100),
    questions: z.array(item).min(1).max(50),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.questions.map((q) => q.questionId)).size === v.questions.length,
    { message: "Repeated question" },
  );

function requireSchoolId(schoolId: string) {
  if (!id.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
}
function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Draft only: not available for learner delivery, scoring, key revelation,
 * attempt creation, exam publication or official class record sheets. */
export async function createAssessmentDraft(schoolId: string, input: unknown) {
  requireSchoolId(schoolId);
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const value = parsed.data;
  const startsAt = new Date(value.startsAt);
  const endsAt = new Date(value.endsAt);
  if (
    startsAt >= endsAt ||
    endsAt.getTime() - startsAt.getTime() < value.durationMinutes * 60_000
  ) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const actorId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const { teacherId, assignment, term } = await exactAssessmentTeacher(
          tx,
          schoolId,
          actorId,
          value.assignmentId,
          value.termId,
        );
        const dates = await tx.academicTerm.findFirst({
          where: {
            id: term.id,
            schoolId,
            sessionId: term.sessionId,
            status: "ACTIVE",
          },
          select: { startsOn: true, endsOn: true },
        });
        if (
          !dates ||
          utcDay(startsAt) < utcDay(dates.startsOn) ||
          utcDay(endsAt) > utcDay(dates.endsOn)
        ) {
          throw new AssessmentError("INVALID_INPUT");
        }
        const ids = value.questions.map((q) => q.questionId);
        // A selected question must have a key and EXACT original ownership,
        // class, subject, period and teacher assignment. Do not return keys.
        const candidates = await tx.assessmentQuestion.findMany({
          where: {
            schoolId,
            id: { in: ids },
            teacherMembershipId: teacherId,
            assignmentId: assignment.id,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            sessionId: term.sessionId,
            termId: term.id,
            answerKey: { isNot: null },
          },
          select: { id: true },
        });
        if (candidates.length !== ids.length)
          throw new AssessmentError("NOT_FOUND");
        const draft = await tx.assessmentDraft.create({
          data: {
            schoolId,
            sessionId: term.sessionId,
            termId: term.id,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            assignmentId: assignment.id,
            teacherMembershipId: teacherId,
            teacherUserId: actorId,
            kind: value.kind,
            title: value.title,
            startsAt,
            endsAt,
            durationMinutes: value.durationMinutes,
            maxAttempts: value.maxAttempts,
            passPercent: value.passPercent,
          },
          select: {
            id: true,
            schoolId: true,
            classId: true,
            subjectId: true,
            sessionId: true,
            termId: true,
            kind: true,
            title: true,
            startsAt: true,
            endsAt: true,
            durationMinutes: true,
            maxAttempts: true,
            passPercent: true,
            createdAt: true,
          },
        });
        await tx.assessmentDraftQuestion.createMany({
          data: value.questions.map((question, i) => ({
            schoolId,
            draftId: draft.id,
            questionId: question.questionId,
            position: i + 1,
            points: question.points,
          })),
        });
        // A separate immutable seal makes direct SQL additions impossible once
        // the committed draft is complete. Staff lists include only sealed rows.
        await tx.assessmentDraftSeal.create({
          data: { schoolId, draftId: draft.id },
        });
        return {
          ...draft,
          questionCount: value.questions.length,
          maxScore: value.questions.reduce((sum, q) => sum + q.points, 0),
        };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    assessmentFailure(error);
  }
}

/** Private teacher-only configuration metadata. No selected secret key,
 * answer index, learner attempt, marking decision or official result. */
export async function listOwnAssessmentDrafts(schoolId: string) {
  requireSchoolId(schoolId);
  const userId = await assessmentUserId();
  const accessible = await prisma.$queryRaw<
    Array<{ allowed: boolean }>
  >(Prisma.sql`
    SELECT true AS "allowed" FROM "School" school
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."userId"=${userId} AND teacher."isActive"=true
      AND teacher."role"='TEACHER'
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=school."id"
      AND assignment."membershipId"=teacher."id"
      AND assignment."status"='ACTIVE' AND assignment."sessionId" IS NOT NULL
    JOIN "AcademicSession" period ON period."schoolId"=assignment."schoolId"
      AND period."id"=assignment."sessionId" AND period."status"='ACTIVE'
    JOIN "SchoolClass" c ON c."schoolId"=assignment."schoolId"
      AND c."id"=assignment."classId" AND c."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=c."schoolId"
      AND section."id"=c."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=assignment."schoolId"
      AND subject."id"=assignment."subjectId" AND subject."isActive"=true
    WHERE school."id"=${schoolId} AND school."isActive"=true LIMIT 1
  `);
  if (!accessible.length) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<
    Array<{
      id: string;
      kind: string;
      title: string;
      startsAt: Date;
      endsAt: Date;
      durationMinutes: number;
      maxAttempts: number;
      passPercent: number;
      questionCount: number;
      maxScore: number;
      classId: string;
      subjectId: string;
    }>
  >(Prisma.sql`
    SELECT draft."id", draft."kind", draft."title", draft."startsAt",
      draft."endsAt", draft."durationMinutes", draft."maxAttempts",
      draft."passPercent", draft."classId", draft."subjectId",
      COUNT(item."id")::int AS "questionCount",
      COALESCE(SUM(item."points"),0)::int AS "maxScore"
    FROM "AssessmentDraft" draft
    JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=draft."schoolId"
      AND seal."draftId"=draft."id"
    JOIN "School" school ON school."id"=draft."schoolId"
      AND school."isActive"=true
    JOIN "Membership" author ON author."schoolId"=draft."schoolId"
      AND author."id"=draft."teacherMembershipId"
      AND author."userId"=${userId}
      AND author."role"='TEACHER' AND author."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=draft."schoolId"
      AND assignment."id"=draft."assignmentId"
      AND assignment."membershipId"=author."id"
      AND assignment."classId"=draft."classId"
      AND assignment."subjectId"=draft."subjectId"
      AND assignment."sessionId"=draft."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" period ON period."schoolId"=draft."schoolId"
      AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=draft."sessionId"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" c ON c."schoolId"=draft."schoolId"
      AND c."id"=draft."classId" AND c."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=c."schoolId"
      AND section."id"=c."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=draft."schoolId"
      AND subject."id"=draft."subjectId" AND subject."isActive"=true
    LEFT JOIN "AssessmentDraftQuestion" item ON item."schoolId"=draft."schoolId"
      AND item."draftId"=draft."id"
    WHERE draft."schoolId"=${schoolId}
    GROUP BY draft."id"
    ORDER BY draft."createdAt" DESC, draft."id" DESC LIMIT 100
  `);
}
