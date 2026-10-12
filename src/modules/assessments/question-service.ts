import { headers } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";

const identifier = z.string().min(1).max(128).refine(value => value === value.trim());
const choices = z.array(z.string().trim().min(1).max(500))
  .min(2).max(6)
  .refine(values => new Set(values.map(value => value.toLowerCase())).size === values.length);
const questionInput = z.object({
  termId: identifier,
  assignmentId: identifier,
  prompt: z.string().trim().min(5).max(2000),
  options: choices,
  correctIndex: z.number().int().min(0).max(5),
}).strict().refine(value => value.correctIndex < value.options.length);

export type AssessmentErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT" |
  "CONFLICT" | "INTERNAL";
export class AssessmentError extends Error {
  constructor(readonly code: AssessmentErrorCode) {
    super(code);
    this.name = "AssessmentError";
  }
}
export function assessmentFailure(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "P2002" || error.code === "P2034") throw new AssessmentError("CONFLICT");
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}
function checkId(value: string) {
  if (!identifier.safeParse(value).success) throw new AssessmentError("INVALID_INPUT");
}
export async function assessmentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AssessmentError("UNAUTHENTICATED");
  return session.user.id;
}

/** Repeated inside every creation transaction. No role-only, class-only, or
 * independently combined subject grant can replace the exact assignment. */
export async function exactAssessmentTeacher(
  tx: Prisma.TransactionClient,
  schoolId: string,
  userId: string,
  assignmentId: string,
  termId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "School"
    WHERE "id" = ${schoolId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Membership"
    WHERE "schoolId" = ${schoolId} AND "userId" = ${userId} FOR UPDATE`;
  const teacher = await tx.membership.findFirst({
    where: { schoolId, userId, role: "TEACHER", isActive: true,
      school: { isActive: true } },
    select: { id: true },
  });
  if (!teacher) throw new AssessmentError("FORBIDDEN");
  await tx.$queryRaw`SELECT "id" FROM "AcademicTerm"
    WHERE "schoolId" = ${schoolId} AND "id" = ${termId} FOR UPDATE`;
  const term = await tx.academicTerm.findFirst({
    where: { id: termId, schoolId, status: "ACTIVE",
      session: { status: "ACTIVE" } },
    select: { id: true, sessionId: true },
  });
  if (!term) throw new AssessmentError("NOT_FOUND");
  await tx.$queryRaw`SELECT "id" FROM "TeacherClassSubjectAssignment"
    WHERE "schoolId" = ${schoolId} AND "id" = ${assignmentId} FOR UPDATE`;
  const assignment = await tx.teacherClassSubjectAssignment.findFirst({
    where: {
      schoolId, id: assignmentId, membershipId: teacher.id, status: "ACTIVE",
      sessionId: term.sessionId,
      schoolClass: { isActive: true, section: { isActive: true, schoolId } },
      subject: { isActive: true },
    },
    select: { id: true, classId: true, subjectId: true, sessionId: true },
  });
  if (!assignment || !assignment.sessionId) throw new AssessmentError("NOT_FOUND");
  const allowed = authorize({
    userId, platformRole: "NONE",
    membership: {
      schoolId, role: "TEACHER", isActive: true, scopes: [],
      teacherAssignments: [{ classId: assignment.classId,
        subjectId: assignment.subjectId, sessionId: assignment.sessionId }],
    },
  }, "academic:edit", {
    schoolId, classId: assignment.classId,
    subjectId: assignment.subjectId, sessionId: assignment.sessionId,
  }).allowed;
  if (!allowed) throw new AssessmentError("FORBIDDEN");
  return { teacherId: teacher.id, term, assignment };
}

/** New immutable question and secret key are created atomically. No correct
 * answer index or key row appears in any successful response. */
export async function createAssessmentQuestion(schoolId: string, input: unknown) {
  checkId(schoolId);
  const parsed = questionInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      const source = await exactAssessmentTeacher(
        tx, schoolId, userId, parsed.data.assignmentId, parsed.data.termId,
      );
      const question = await tx.assessmentQuestion.create({
        data: {
          schoolId, sessionId: source.term.sessionId, termId: source.term.id,
          classId: source.assignment.classId, subjectId: source.assignment.subjectId,
          assignmentId: source.assignment.id, teacherMembershipId: source.teacherId,
          teacherUserId: userId, prompt: parsed.data.prompt, options: parsed.data.options,
        },
        select: { id: true, schoolId: true, classId: true, subjectId: true,
          sessionId: true, termId: true, prompt: true, options: true, createdAt: true },
      });
      await tx.assessmentQuestionKey.create({
        data: {
          schoolId, questionId: question.id,
          correctIndex: parsed.data.correctIndex,
        },
      });
      return question;
    }, { isolationLevel: "Serializable" });
  } catch (error) { assessmentFailure(error); }
}

/** Staff-only, metadata-only list. No keys, scoring, student release or export.
 * The same current actor + exact assignment + active period relationships are
 * repeated in the final query, not inferred from authenticated school role. */
export async function listOwnAssessmentQuestions(schoolId: string) {
  checkId(schoolId);
  const userId = await assessmentUserId();
  const allowed = await prisma.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
    SELECT true AS "allowed" FROM "School" school
    JOIN "Membership" teacher ON teacher."schoolId"=school."id"
      AND teacher."userId"=${userId} AND teacher."role"='TEACHER'
      AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=school."id"
      AND assignment."membershipId"=teacher."id"
      AND assignment."status"='ACTIVE' AND assignment."sessionId" IS NOT NULL
    JOIN "AcademicSession" session ON session."schoolId"=school."id"
      AND session."id"=assignment."sessionId" AND session."status"='ACTIVE'
    JOIN "SchoolClass" c ON c."schoolId"=school."id"
      AND c."id"=assignment."classId" AND c."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=school."id"
      AND section."id"=c."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=school."id"
      AND subject."id"=assignment."subjectId" AND subject."isActive"=true
    WHERE school."id"=${schoolId} AND school."isActive"=true LIMIT 1
  `);
  if (!allowed.length) throw new AssessmentError("NOT_FOUND");
  const rows = await prisma.$queryRaw<Array<{
    id: string; assignmentId: string; classId: string; subjectId: string; sessionId: string;
    termId: string; prompt: string; options: unknown; createdAt: Date;
  }>>(Prisma.sql`
    SELECT q."id", q."assignmentId", q."classId", q."subjectId", q."sessionId", q."termId",
      q."prompt", q."options", q."createdAt"
    FROM "AssessmentQuestion" q
    JOIN "School" school ON school."id"=q."schoolId" AND school."isActive"=true
    JOIN "Membership" teacher ON teacher."schoolId"=q."schoolId"
      AND teacher."id"=q."teacherMembershipId"
      AND teacher."userId"=${userId}
      AND teacher."isActive"=true AND teacher."role"='TEACHER'
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=q."schoolId"
      AND assignment."id"=q."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=q."classId"
      AND assignment."subjectId"=q."subjectId"
      AND assignment."sessionId"=q."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" session ON session."schoolId"=q."schoolId"
      AND session."id"=q."sessionId" AND session."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=q."schoolId"
      AND term."sessionId"=q."sessionId"
      AND term."id"=q."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" c ON c."schoolId"=q."schoolId"
      AND c."id"=q."classId" AND c."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=c."schoolId"
      AND section."id"=c."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=q."schoolId"
      AND subject."id"=q."subjectId" AND subject."isActive"=true
    WHERE q."schoolId"=${schoolId}
    ORDER BY q."createdAt" DESC, q."id" DESC LIMIT 100
  `);
  return rows;
}
