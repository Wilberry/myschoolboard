import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentFailure, assessmentUserId } from "./question-service";

const id = z.string().min(1).max(128).refine(v => v.trim() === v);
const requestInput = z.object({
  proposalId: id,
  proposedPoints: z.number().int().min(0).max(100),
  reason: z.string().trim().min(5).max(500),
}).strict();
const decisionInput = z.object({
  action: z.enum(["APPROVED","RETURNED"]),
  reason: z.string().trim().min(5).max(500),
}).strict();
function checkId(value: string) {
  if (!id.safeParse(value).success) throw new AssessmentError("INVALID_INPUT");
}
/** Single append-only revision, never UPDATE original or prior approved score.
 * Exact school/teacher/enrollment/initial approval/current effective mark and
 * no pending correction are enforced again in the SQL INSERT trigger. */
export async function requestManualMarkCorrection(schoolId: string, input: unknown) {
  checkId(schoolId);
  const parsed = requestInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
      const proposal = await tx.assessmentManualMarkProposal.findFirst({
        where: {
          schoolId, id: parsed.data.proposalId,
          component: {
            teacherUserId: userId,
            teacher: { userId, role: "TEACHER", isActive: true },
            assignment: { status: "ACTIVE" },
            session: { status: "ACTIVE" }, term: { status: "ACTIVE" },
            schoolClass: { isActive: true, section: { isActive: true } },
            subject: { isActive: true },
          },
          decision: { isNot: null },
          student: { status: "ENROLLED" },
          enrollment: { status: "ACTIVE" },
        },
        select: { id: true, component: { select: {
          maxPoints: true, teacherMembershipId: true,
        } } },
      });
      if (!proposal || parsed.data.proposedPoints > proposal.component.maxPoints)
        throw new AssessmentError("NOT_FOUND");
      return tx.assessmentManualCorrectionRequest.create({
        data: { id: randomUUID(), schoolId, proposalId: proposal.id,
          proposedPoints: parsed.data.proposedPoints,
          reason: parsed.data.reason,
          requesterMembershipId: proposal.component.teacherMembershipId,
          requesterUserId: userId },
        select: { id: true, proposalId: true, revision: true,
          proposedPoints: true, reason: true, createdAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch(error) { assessmentFailure(error); }
}
export async function decideManualMarkCorrection(
  schoolId: string, requestId: string, input: unknown,
) {
  checkId(schoolId); checkId(requestId);
  const parsed = decisionInput.safeParse(input);
  if(!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const actor = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
      const reviewer = await tx.membership.findFirst({
        where: { schoolId, userId: actor, isActive: true,
          role: { in: ["HEAD_OF_SECTION","PRINCIPAL"] },
          school: { isActive: true } },
        select: { id: true },
      });
      if(!reviewer) throw new AssessmentError("NOT_FOUND");
      return tx.assessmentManualCorrectionDecision.create({
        data: { id: randomUUID(), schoolId, requestId,
          reviewerMembershipId: reviewer.id, reviewerUserId: actor,
          action: parsed.data.action, reason: parsed.data.reason },
        select: { id: true, requestId: true, action: true, reason: true,
          decidedAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch(error) {
    if(error && typeof error === "object" && "code" in error &&
      error.code === "P2003") throw new AssessmentError("NOT_FOUND");
    if(error && typeof error === "object" && "code" in error &&
      error.code === "P2010" && "meta" in error && error.meta &&
      typeof error.meta === "object" && "code" in error.meta &&
      error.meta.code === "23503") throw new AssessmentError("NOT_FOUND");
    assessmentFailure(error);
  }
}
/** Metadata for original teacher, not general student grades or solutions. */
export async function listOwnManualMarkCorrectionContext(schoolId: string) {
  checkId(schoolId);
  const userId = await assessmentUserId();
  const own = await prisma.membership.findFirst({
    where: { schoolId, userId, role: "TEACHER", isActive: true,
      school: { isActive: true } },
    select: { id: true },
  });
  if (!own) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    proposalId: string; componentTitle: string; studentAdmission: string;
    originalPoints: number; approvedPoints: number | null;
    maxPoints: number; latestRevision: number; pending: boolean;
  }>>(Prisma.sql`
    SELECT mark."id" AS "proposalId", component."title" AS "componentTitle",
      pupil."admissionNumber" AS "studentAdmission",
      mark."earnedPoints" AS "originalPoints",
      COALESCE(approved."proposedPoints",
        CASE WHEN initial."action"='APPROVED'
          THEN mark."earnedPoints" ELSE NULL END) AS "approvedPoints",
      component."maxPoints",
      COALESCE(latest."revision",0)::int AS "latestRevision",
      COALESCE(latest."pending",false) AS "pending"
    FROM "AssessmentManualMarkProposal" mark
    JOIN "AssessmentManualMarkDecision" initial
      ON initial."schoolId"=mark."schoolId"
      AND initial."proposalId"=mark."id"
    JOIN "AssessmentManualComponent" component
      ON component."schoolId"=mark."schoolId"
      AND component."id"=mark."componentId"
    JOIN "School" school ON school."id"=mark."schoolId"
      AND school."isActive"=true
    JOIN "Membership" teacher ON teacher."schoolId"=component."schoolId"
      AND teacher."id"=component."teacherMembershipId"
      AND teacher."userId"=${userId}
      AND teacher."role"='TEACHER' AND teacher."isActive"=true
    JOIN "TeacherClassSubjectAssignment" assignment
      ON assignment."schoolId"=component."schoolId"
      AND assignment."id"=component."assignmentId"
      AND assignment."membershipId"=teacher."id"
      AND assignment."classId"=component."classId"
      AND assignment."subjectId"=component."subjectId"
      AND assignment."sessionId"=component."sessionId"
      AND assignment."status"='ACTIVE'
    JOIN "AcademicSession" period ON period."schoolId"=component."schoolId"
      AND period."id"=component."sessionId" AND period."status"='ACTIVE'
    JOIN "AcademicTerm" term ON term."schoolId"=component."schoolId"
      AND term."sessionId"=period."id"
      AND term."id"=component."termId" AND term."status"='ACTIVE'
    JOIN "SchoolClass" room ON room."schoolId"=component."schoolId"
      AND room."id"=component."classId" AND room."isActive"=true
    JOIN "SchoolSection" section ON section."schoolId"=component."schoolId"
      AND section."id"=room."sectionId" AND section."isActive"=true
    JOIN "Subject" subject ON subject."schoolId"=component."schoolId"
      AND subject."id"=component."subjectId" AND subject."isActive"=true
    JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=mark."schoolId"
      AND enrollment."id"=mark."enrollmentId"
      AND enrollment."studentId"=mark."studentId"
      AND enrollment."classId"=component."classId"
      AND enrollment."sessionId"=component."sessionId"
      AND enrollment."status"='ACTIVE'
    JOIN "StudentRecord" pupil ON pupil."schoolId"=mark."schoolId"
      AND pupil."id"=mark."studentId" AND pupil."status"='ENROLLED'
    LEFT JOIN LATERAL (
      SELECT request."proposedPoints"
      FROM "AssessmentManualCorrectionRequest" request
      JOIN "AssessmentManualCorrectionDecision" decision
        ON decision."schoolId"=request."schoolId"
        AND decision."requestId"=request."id"
        AND decision."action"='APPROVED'
      WHERE request."schoolId"=mark."schoolId"
        AND request."proposalId"=mark."id"
      ORDER BY request."revision" DESC LIMIT 1
    ) approved ON true
    LEFT JOIN LATERAL (
      SELECT request."revision",
        (decision."id" IS NULL) AS "pending"
      FROM "AssessmentManualCorrectionRequest" request
      LEFT JOIN "AssessmentManualCorrectionDecision" decision
        ON decision."schoolId"=request."schoolId"
        AND decision."requestId"=request."id"
      WHERE request."schoolId"=mark."schoolId"
        AND request."proposalId"=mark."id"
      ORDER BY request."revision" DESC LIMIT 1
    ) latest ON true
    WHERE mark."schoolId"=${schoolId}
    ORDER BY component."title",pupil."admissionNumber" LIMIT 100
  `);
}
/** Reviewer queue final SQL repeats current same-school verified section and
 * stage. Uses only pending correction requests (not approved marks broadly). */
export async function listManualCorrectionReviewQueue(schoolId: string) {
  checkId(schoolId);
  const actor=await assessmentUserId();
  const accessible=await prisma.$queryRaw<Array<{ allowed: boolean }>>(Prisma.sql`
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
  if(!accessible.length)throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    requestId:string; proposalId:string; studentAdmission:string;
    componentTitle:string; originalPoints:number; proposedPoints:number;
    maxPoints:number; revision:number; reason:string;
  }>>(Prisma.sql`
    SELECT request."id" AS "requestId",mark."id" AS "proposalId",
      pupil."admissionNumber" AS "studentAdmission",
      component."title" AS "componentTitle",
      mark."earnedPoints" AS "originalPoints",
      request."proposedPoints",component."maxPoints",
      request."revision",request."reason"
    FROM "AssessmentManualCorrectionRequest" request
    JOIN "AssessmentManualMarkProposal" mark
      ON mark."schoolId"=request."schoolId"
      AND mark."id"=request."proposalId"
    JOIN "AssessmentManualMarkDecision" initial
      ON initial."schoolId"=mark."schoolId"
      AND initial."proposalId"=mark."id" AND initial."action"='APPROVED'
    JOIN "AssessmentManualComponent" component
      ON component."schoolId"=mark."schoolId"
      AND component."id"=mark."componentId"
    JOIN "School" school ON school."id"=component."schoolId"
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
      AND term."sessionId"=period."id"
      AND term."id"=component."termId" AND term."status"='ACTIVE'
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
    JOIN "StudentEnrollment" enrollment ON enrollment."schoolId"=mark."schoolId"
      AND enrollment."id"=mark."enrollmentId"
      AND enrollment."studentId"=mark."studentId"
      AND enrollment."classId"=component."classId"
      AND enrollment."sessionId"=component."sessionId"
      AND enrollment."status"='ACTIVE'
    JOIN "StudentRecord" pupil ON pupil."schoolId"=mark."schoolId"
      AND pupil."id"=mark."studentId" AND pupil."status"='ENROLLED'
    JOIN "Membership" reviewer ON reviewer."schoolId"=school."id"
      AND reviewer."userId"=${actor} AND reviewer."isActive"=true
    JOIN "ScopeGrant" scope ON scope."membershipId"=reviewer."id"
      AND scope."type"='SECTION' AND scope."verified"=true
      AND scope."scopeId"=section."id"
    WHERE request."schoolId"=${schoolId}
      AND NOT EXISTS (
        SELECT 1 FROM "AssessmentManualCorrectionDecision" previous
        WHERE previous."schoolId"=request."schoolId"
          AND previous."requestId"=request."id"
      )
      AND ((reviewer."role"='HEAD_OF_SECTION' AND section."stage"='PRIMARY')
        OR (reviewer."role"='PRINCIPAL' AND section."stage"='SECONDARY'))
    ORDER BY request."createdAt",request."id" LIMIT 100
  `);
}
