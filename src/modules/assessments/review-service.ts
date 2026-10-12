import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError, assessmentFailure, assessmentUserId,
} from "./question-service";

const id = z.string().min(1).max(128).refine(v => v.trim() === v);
const moderationInput = z.object({
  decision: z.enum(["APPROVED", "RETURNED"]),
  reason: z.string().trim().min(5).max(500),
}).strict();

interface AssessmentReviewItem {
  id: string;
  title: string;
  kind: "QUIZ" | "TEST" | "EXAM";
  className: string;
  subjectName: string;
  termName: string;
  sectionName: string;
  questionCount: number;
  maxScore: number;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  maxAttempts: number;
  passPercent: number;
}

/** Reviewer listing validates the actual draft.class.section and verified
 * SECTION grant together in the query; it never exposes questions or keys.
 * An empty queue is NOT proof of an authorized reviewer. */
export async function listAssessmentReviewQueue(schoolId: string) {
  if (!id.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const allowed = await prisma.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
    SELECT true AS "allowed" FROM "School" school
    JOIN "Membership" reviewer ON reviewer."schoolId"=school."id"
      AND reviewer."userId"=${userId} AND reviewer."isActive"=true
      AND reviewer."role" IN ('HEAD_OF_SECTION','PRINCIPAL')
    JOIN "ScopeGrant" scope ON scope."membershipId"=reviewer."id"
      AND scope."type"='SECTION' AND scope."verified"=true
    JOIN "SchoolSection" section ON section."schoolId"=school."id"
      AND section."id"=scope."scopeId" AND section."isActive"=true
    WHERE school."id"=${schoolId} AND school."isActive"=true
      AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
        OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
    LIMIT 1
  `);
  if (!allowed.length) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<AssessmentReviewItem[]>(Prisma.sql`
    SELECT draft."id", draft."title", draft."kind",
      class."name" AS "className", subject."name" AS "subjectName",
      term."name" AS "termName", section."name" AS "sectionName",
      draft."startsAt", draft."endsAt", draft."durationMinutes",
      draft."maxAttempts", draft."passPercent",
      COUNT(item."id")::int AS "questionCount",
      COALESCE(SUM(item."points"),0)::int AS "maxScore"
    FROM "AssessmentDraft" draft
    JOIN "School" school ON school."id"=draft."schoolId" AND school."isActive"=true
    JOIN "AssessmentDraftSeal" seal ON seal."schoolId"=draft."schoolId"
      AND seal."draftId"=draft."id"
    JOIN "AcademicSession" period ON period."schoolId"=draft."schoolId"
      AND period."id"=draft."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=draft."schoolId"
      AND term."sessionId"=draft."sessionId"
      AND term."id"=draft."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" class ON class."schoolId"=draft."schoolId"
      AND class."id"=draft."classId" AND class."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=draft."schoolId"
      AND section."id"=class."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=draft."schoolId"
      AND subject."id"=draft."subjectId" AND subject."isActive"=true
    JOIN "Membership" author ON author."schoolId"=draft."schoolId"
      AND author."id"=draft."teacherMembershipId"
      AND author."userId"=draft."teacherUserId"
      AND author."role"='TEACHER' AND author."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=draft."schoolId"
      AND assignment."id"=draft."assignmentId"
      AND assignment."membershipId"=author."id"
      AND assignment."classId"=draft."classId"
      AND assignment."subjectId"=draft."subjectId"
      AND assignment."sessionId"=draft."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "Membership" reviewer ON reviewer."schoolId"=draft."schoolId"
      AND reviewer."userId"=${userId} AND reviewer."isActive"=true
      AND reviewer."role" IN ('HEAD_OF_SECTION','PRINCIPAL')
    JOIN "ScopeGrant" scope ON scope."membershipId"=reviewer."id"
      AND scope."type"='SECTION' AND scope."verified"=true
      AND scope."scopeId"=section."id"
    JOIN "AssessmentDraftQuestion" item ON item."schoolId"=draft."schoolId"
      AND item."draftId"=draft."id"
    WHERE draft."schoolId"=${schoolId}
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentReviewEvent" earlier
        WHERE earlier."schoolId"=draft."schoolId"
          AND earlier."draftId"=draft."id"
      )
      AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
        OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
    GROUP BY draft."id", class."name", subject."name",
      term."name", section."name"
    ORDER BY draft."startsAt" ASC, draft."id" ASC
    LIMIT 100
  `);
}

/** HM PRIMARY / Principal SECONDARY verified-section decision is terminal
 * for this immutable draft. It never publishes a CBT to students. */
export async function decideAssessmentReview(
  schoolId: string, draftId: string, input: unknown,
) {
  if (!id.safeParse(schoolId).success || !id.safeParse(draftId).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const parsed = moderationInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId"=${schoolId} AND "userId"=${userId} FOR UPDATE`;
      const reviewer = await tx.membership.findFirst({
        where: { schoolId, userId, isActive: true,
          role: { in: ["HEAD_OF_SECTION","PRINCIPAL"] },
          school: { isActive: true } },
        select: { id: true, role: true },
      });
      if (!reviewer) throw new AssessmentError("FORBIDDEN");
      await tx.$queryRaw`SELECT "id" FROM "AssessmentDraft"
        WHERE "schoolId"=${schoolId} AND "id"=${draftId} FOR UPDATE`;
      const draft = await tx.assessmentDraft.findFirst({
        where: {
          id: draftId, schoolId,
          seal: { isNot: null },
          reviews: { none: {} },
          session: { status: "ACTIVE" },
          term: { status: "ACTIVE" },
          schoolClass: { isActive: true, section: { isActive: true, schoolId } },
          subject: { isActive: true },
          assignment: { status: "ACTIVE",
            membership: { isActive: true, role: "TEACHER" } },
          questions: { some: {} },
        },
        select: {
          id: true, schoolClass: { select: { sectionId: true,
            section: { select: { stage: true } } } },
        },
      });
      if (!draft?.schoolClass.sectionId || !draft.schoolClass.section) {
        throw new AssessmentError("NOT_FOUND");
      }
      const sectionId = draft.schoolClass.sectionId;
      await tx.$queryRaw`SELECT "id" FROM "SchoolSection"
        WHERE "schoolId"=${schoolId} AND "id"=${sectionId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ScopeGrant"
        WHERE "membershipId"=${reviewer.id}
          AND "type"='SECTION' AND "scopeId"=${sectionId}
        FOR UPDATE`;
      if (!((reviewer.role === "HEAD_OF_SECTION" &&
               draft.schoolClass.section.stage === "PRIMARY") ||
            (reviewer.role === "PRINCIPAL" &&
               draft.schoolClass.section.stage === "SECONDARY"))) {
        throw new AssessmentError("NOT_FOUND");
      }
      const scope = await tx.scopeGrant.findFirst({
        where: { membershipId: reviewer.id, type: "SECTION",
          scopeId: sectionId, verified: true },
        select: { id: true },
      });
      if (!scope) throw new AssessmentError("NOT_FOUND");
      return tx.assessmentReviewEvent.create({
        data: {
          schoolId, draftId, decision: parsed.data.decision,
          reason: parsed.data.reason,
          reviewerMembershipId: reviewer.id, reviewerUserId: userId,
        },
        select: {
          id: true, draftId: true, decision: true, createdAt: true,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { assessmentFailure(error); }
}
