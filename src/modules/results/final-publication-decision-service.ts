import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError, assessmentFailure, assessmentUserId,
} from "@/src/modules/assessments/question-service";

const identifier = z.string().min(1).max(128).refine(value => value.trim() === value);
const inputSchema = z.object({
  evidenceId: identifier,
  reason: z.string().trim().min(5).max(500),
}).strict();

/**
 * School owner's final audited academic release AUTHORIZATION, never public
 * release or calculation. The trusted SQL BEFORE INSERT trigger calls the
 * school-locked complete readiness predicate AGAIN in this transaction.
 */
export async function recordInternalFinalPublicationDecision(
  schoolId: string, input: unknown,
) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
      const owner = await tx.membership.findFirst({
        where: { schoolId, userId, role: "SCHOOL_SUPER_ADMIN",
          isActive: true, school: { isActive: true } },
        select: { id: true },
      });
      if (!owner) throw new AssessmentError("NOT_FOUND");
      const evidence = await tx.resultSheetEvidence.findFirst({
        where: { schoolId, id: parsed.data.evidenceId },
        select: { id: true, sessionId: true, termId: true,
          classId: true, subjectId: true, adoptionId: true, revision: true },
      });
      if (!evidence) throw new AssessmentError("NOT_FOUND");
      // No browser-derived actor, policy, marks, timestamps or version.
      // The DB recomputes and checks all context/authorities/frozen evidence.
      return tx.resultFinalPublicationDecision.create({
        data: {
          id: randomUUID(), schoolId, evidenceId: evidence.id,
          sessionId: evidence.sessionId, termId: evidence.termId,
          classId: evidence.classId, subjectId: evidence.subjectId,
          adoptionId: evidence.adoptionId, evidenceRevision: evidence.revision,
          actorMembershipId: owner.id, actorUserId: userId,
          reason: parsed.data.reason,
        },
        select: { id: true, evidenceId: true, sessionId: true, termId: true,
          classId: true, subjectId: true, adoptionId: true,
          evidenceRevision: true, ordinal: true, status: true,
          reason: true, decidedAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { assessmentFailure(error); }
}

/** Current school owner sees only bounded non-pupil audit metadata. */
export async function listOwnFinalPublicationDecisions(schoolId: string) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: { schoolId, userId, role: "SCHOOL_SUPER_ADMIN",
      isActive: true, school: { isActive: true } },
    select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");

  return prisma.$queryRaw<Array<{
    id: string; evidenceId: string; sessionId: string; termId: string;
    classId: string; subjectId: string; className: string; subjectName: string;
    ordinal: number; evidenceRevision: number; adoptionId: string;
    status: string; reason: string; decidedAt: Date;
  }>>(Prisma.sql`
    SELECT decision."id", decision."evidenceId", decision."sessionId",
      decision."termId", decision."classId", decision."subjectId",
      classroom."name" AS "className", subject."name" AS "subjectName",
      decision."ordinal", decision."evidenceRevision",
      decision."adoptionId", decision."status",
      decision."reason", decision."decidedAt"
    FROM "ResultFinalPublicationDecision" decision
    JOIN "School" school ON school."id"=decision."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId} AND owner."isActive"=true
      AND owner."role"='SCHOOL_SUPER_ADMIN'
    JOIN "SchoolClass" classroom ON classroom."schoolId"=decision."schoolId"
      AND classroom."id"=decision."classId"
    JOIN "Subject" subject ON subject."schoolId"=decision."schoolId"
      AND subject."id"=decision."subjectId"
    WHERE decision."schoolId"=${schoolId}
    ORDER BY decision."decidedAt" DESC, decision."id" DESC LIMIT 100
  `);
}
