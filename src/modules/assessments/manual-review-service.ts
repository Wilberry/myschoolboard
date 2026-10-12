import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentFailure, assessmentUserId } from "./question-service";
const id = z.string().min(1).max(128).refine(x => x.trim() === x);
const choice = z.object({
  action: z.enum(["APPROVED", "RETURNED"]),
  reason: z.string().trim().min(5).max(500),
}).strict();
export interface ManualMarkReviewRow {
  proposalId: string; componentId: string; title: string; kind: "QUIZ" | "TEST" | "EXAM";
  sectionName: string; className: string; subjectName: string;
  admissionNumber: string; givenName: string; familyName: string;
  earnedPoints: number; maxPoints: number; proposedAt: Date;
}
/** Restricted, key-free initial manual mark review queue. Both the
 * allowed-role check and FINAL data query require verified exact SECTION. */
export async function listManualMarkReviewQueue(schoolId: string): Promise<ManualMarkReviewRow[]> {
  if (!id.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
  const actor = await assessmentUserId();
  const allowed = await prisma.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
    SELECT true AS "allowed" FROM "School" school
    JOIN "Membership" reviewer ON reviewer."schoolId"=school."id"
      AND reviewer."userId"=${actor} AND reviewer."isActive"=true
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
  return prisma.$queryRaw<ManualMarkReviewRow[]>(Prisma.sql`
    SELECT proposal."id" AS "proposalId", component."id" AS "componentId",
      component."title", component."kind",
      section."name" AS "sectionName", room."name" AS "className",
      subject."name" AS "subjectName",
      pupil."admissionNumber", pupil."givenName", pupil."familyName",
      proposal."earnedPoints", component."maxPoints",
      proposal."createdAt" AS "proposedAt"
    FROM "AssessmentManualMarkProposal" proposal
    JOIN "AssessmentManualComponent" component
      ON component."schoolId"=proposal."schoolId"
      AND component."id"=proposal."componentId"
      AND component."classId"=proposal."classId"
      AND component."sessionId"=proposal."sessionId"
    JOIN "School" school ON school."id"=proposal."schoolId"
      AND school."isActive"=true
    JOIN "SchoolClass" room ON room."schoolId"=component."schoolId"
      AND room."id"=component."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=room."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=component."schoolId"
      AND subject."id"=component."subjectId" AND subject."isActive"=true
    JOIN "AcademicSession" period ON period."schoolId"=component."schoolId"
      AND period."id"=component."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=component."schoolId"
      AND term."sessionId"=period."id" AND term."id"=component."termId"
      AND term."status"='ACTIVE'
    JOIN "Membership" teacher ON teacher."schoolId"=component."schoolId"
      AND teacher."id"=component."teacherMembershipId"
      AND teacher."userId"=component."teacherUserId"
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=component."schoolId"
      AND assignment."id"=component."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=component."classId"
      AND assignment."subjectId"=component."subjectId"
      AND assignment."sessionId"=component."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=proposal."schoolId"
      AND enrollment."id"=proposal."enrollmentId"
      AND enrollment."studentId"=proposal."studentId"
      AND enrollment."classId"=component."classId"
      AND enrollment."sessionId"=component."sessionId"
      AND enrollment."status"='ACTIVE'
    JOIN "StudentRecord" pupil ON pupil."schoolId"=proposal."schoolId"
      AND pupil."id"=proposal."studentId" AND pupil."status"='ENROLLED'
    JOIN "Membership" reviewer ON reviewer."schoolId"=proposal."schoolId"
      AND reviewer."userId"=${actor} AND reviewer."isActive"=true
    JOIN "ScopeGrant" scope ON scope."membershipId"=reviewer."id"
      AND scope."type"='SECTION' AND scope."verified"=true
      AND scope."scopeId"=section."id"
    WHERE proposal."schoolId"=${schoolId}
      AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
        OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentManualMarkDecision" previous
        WHERE previous."schoolId"=proposal."schoolId"
          AND previous."proposalId"=proposal."id"
      )
    ORDER BY proposal."createdAt", proposal."id" LIMIT 100
  `);
}
export async function decideInitialManualMark(
  schoolId: string, proposalId: string, input: unknown,
) {
  if (!id.safeParse(schoolId).success || !id.safeParse(proposalId).success)
    throw new AssessmentError("INVALID_INPUT");
  const parsed = choice.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const actor = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School" WHERE "id"=${schoolId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId"=${schoolId} AND "userId"=${actor} FOR UPDATE`;
      const reviewer = await tx.membership.findFirst({
        where: { schoolId, userId: actor, isActive: true,
          role: { in: ["HEAD_OF_SECTION", "PRINCIPAL"] },
          school: { isActive: true } },
        select: { id: true },
      });
      if (!reviewer) throw new AssessmentError("NOT_FOUND");
      // The INSERT trigger, not broad role membership, is authoritative
      // for Primary/Secondary verified-section and pupil/teacher relation.
      return tx.assessmentManualMarkDecision.create({
        data: { id: randomUUID(), schoolId, proposalId,
          reviewerMembershipId: reviewer.id, reviewerUserId: actor,
          action: parsed.data.action, reason: parsed.data.reason },
        select: { id: true, proposalId: true, action: true, reason: true,
          decidedAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2003")
      throw new AssessmentError("NOT_FOUND");
    if (e && typeof e === "object" && "code" in e && e.code === "P2010" &&
      "meta" in e && e.meta && typeof e.meta === "object" && "code" in e.meta &&
      e.meta.code === "23503") throw new AssessmentError("NOT_FOUND");
    assessmentFailure(e);
  }
}
