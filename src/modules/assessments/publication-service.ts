import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentFailure, assessmentUserId } from "./question-service";

const id = z.string().min(1).max(128).refine(v => v === v.trim());
const actionSchema = z.object({
  action: z.enum(["PUBLISHED", "WITHDRAWN"]),
  reason: z.string().trim().min(5).max(500),
}).strict();
const checkId = (v: string) => {
  if (!id.safeParse(v).success) throw new AssessmentError("INVALID_INPUT");
};

/** Publication is a second actor with stricter authority than an academic
 * reviewer. The existing section APPROVED event NEVER publishes by itself.
 * This cannot yet activate student CBT because no attempt/delivery API exists.
 */
export async function decideAssessmentPublication(
  schoolId: string, draftId: string, body: unknown,
) {
  checkId(schoolId); checkId(draftId);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId"=${schoolId} AND "userId"=${userId} FOR UPDATE`;
      const actor = await tx.membership.findFirst({
        where: {
          userId, schoolId, isActive: true,
          role: "SCHOOL_SUPER_ADMIN",
          school: { isActive: true },
        },
        select: { id: true },
      });
      if (!actor) throw new AssessmentError("FORBIDDEN");
      await tx.$queryRaw`SELECT "id" FROM "AssessmentDraft"
        WHERE "schoolId"=${schoolId} AND "id"=${draftId} FOR UPDATE`;
      const prior = await tx.assessmentPublicationEvent.findMany({
        where: { schoolId, draftId },
        select: { action: true },
      });
      if (parsed.data.action === "PUBLISHED") {
        if (prior.length) throw new AssessmentError("CONFLICT");
        const draft = await tx.assessmentDraft.findFirst({
          where: {
            schoolId, id: draftId,
            seal: { isNot: null },
            reviews: { some: { decision: "APPROVED" } },
            session: { status: "ACTIVE" },
            term: { status: "ACTIVE" },
            schoolClass: { isActive: true,
              section: { isActive: true, schoolId } },
            subject: { isActive: true },
            assignment: { status: "ACTIVE", membership: {
              role: "TEACHER", isActive: true },
            },
            questions: { some: {} },
          },
          select: { id: true },
        });
        if (!draft) throw new AssessmentError("NOT_FOUND");
      } else {
        if (!prior.some(event => event.action === "PUBLISHED") ||
            prior.some(event => event.action === "WITHDRAWN")) {
          throw new AssessmentError("CONFLICT");
        }
      }
      return tx.assessmentPublicationEvent.create({
        data: {
          schoolId, draftId, action: parsed.data.action,
          reason: parsed.data.reason, actorMembershipId: actor.id,
          actorUserId: userId,
        },
        select: { id: true, draftId: true, action: true, createdAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { assessmentFailure(error); }
}

/** School super admin may read ONLY sealed, separately approved assessment
 * configuration summary. No question body, secret, student or score. */
export async function listAssessmentPublications(schoolId: string) {
  checkId(schoolId);
  const userId = await assessmentUserId();
  const actor = await prisma.membership.findFirst({
    where: { schoolId, userId, isActive: true,
      role: "SCHOOL_SUPER_ADMIN", school: { isActive: true } },
    select: { id: true },
  });
  if (!actor) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; title: string; kind: "QUIZ" | "TEST" | "EXAM";
    startsAt: Date; endsAt: Date; durationMinutes: number;
    maxAttempts: number; passPercent: number;
    className: string; subjectName: string;
    published: boolean; withdrawn: boolean;
  }>>(Prisma.sql`
    SELECT draft."id", draft."title", draft."kind",
      draft."startsAt", draft."endsAt", draft."durationMinutes",
      draft."maxAttempts", draft."passPercent",
      classroom."name" AS "className", subject."name" AS "subjectName",
      EXISTS (SELECT 1 FROM "AssessmentPublicationEvent" publication
        WHERE publication."schoolId"=draft."schoolId"
          AND publication."draftId"=draft."id"
          AND publication."action"='PUBLISHED') AS "published",
      EXISTS (SELECT 1 FROM "AssessmentPublicationEvent" withdrawal
        WHERE withdrawal."schoolId"=draft."schoolId"
          AND withdrawal."draftId"=draft."id"
          AND withdrawal."action"='WITHDRAWN') AS "withdrawn"
    FROM "AssessmentDraft" draft
    JOIN "School" school ON school."id"=draft."schoolId" AND school."isActive"=true
    JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=draft."schoolId"
      AND seal."draftId"=draft."id"
    JOIN "AssessmentReviewEvent" review ON review."schoolId"=draft."schoolId"
      AND review."draftId"=draft."id" AND review."decision"='APPROVED'
    JOIN "AcademicSession" period ON period."schoolId"=draft."schoolId"
      AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=draft."sessionId"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" classroom ON classroom."schoolId"=draft."schoolId"
      AND classroom."id"=draft."classId" AND classroom."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=classroom."schoolId"
      AND section."id"=classroom."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=draft."schoolId"
      AND subject."id"=draft."subjectId" AND subject."isActive"=true
    JOIN "Membership" teacher ON teacher."schoolId"=draft."schoolId"
      AND teacher."id"=draft."teacherMembershipId"
      AND teacher."userId"=draft."teacherUserId"
      AND teacher."isActive"=true AND teacher."role"='TEACHER'
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=draft."schoolId"
      AND assignment."id"=draft."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=draft."classId"
      AND assignment."subjectId"=draft."subjectId"
      AND assignment."sessionId"=draft."sessionId"
      AND assignment."status"='ACTIVE'
    WHERE draft."schoolId"=${schoolId}
      AND EXISTS (SELECT 1 FROM "Membership" actor
        WHERE actor."schoolId"=draft."schoolId"
          AND actor."userId"=${userId} AND actor."isActive"=true
          AND actor."role"='SCHOOL_SUPER_ADMIN')
    ORDER BY draft."createdAt" DESC, draft."id" DESC LIMIT 100
  `);
}
