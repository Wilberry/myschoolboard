import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { AssessmentError, assessmentUserId } from "@/src/modules/assessments/question-service";

const identifier = z.string().min(1).max(128).refine(value => value.trim() === value);
const inputSchema = z.object({
  sourcePacketId: identifier,
  aggregationRuleId: identifier,
  gradeScaleId: identifier,
  reason: z.string().trim().min(5).max(500),
}).strict();
function compositionError(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code)))
      throw new AssessmentError("CONFLICT");
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}

/** Private immutable official-result composition EVIDENCE only.
 * SQL computes ALL marks and classifications from the frozen source packet
 * after revalidating current school/owner/independent academic review under
 * school lock. The client never submits grade points, students, or outputs.
 */
export async function preparePrivateOfficialReportComposition(
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
      const packet = await tx.resultReportCardSourcePacket.findFirst({
        where: { schoolId, id: parsed.data.sourcePacketId },
        select: {
          id: true, finalDecisionId: true, evidenceId: true,
          adoptionId: true, sessionId: true, termId: true,
          classId: true, subjectId: true, evidenceRevision: true,
        },
      });
      if (!packet) throw new AssessmentError("NOT_FOUND");
      // User-selected *policy IDs*, but DB requires current exact same-school
      // revisions and overwrites all grade, count and version fields itself.
      return tx.privateOfficialReportComposition.create({
        data: {
          id: randomUUID(), schoolId, sourcePacketId: packet.id,
          finalDecisionId: packet.finalDecisionId,
          evidenceId: packet.evidenceId, adoptionId: packet.adoptionId,
          sessionId: packet.sessionId, termId: packet.termId,
          classId: packet.classId, subjectId: packet.subjectId,
          evidenceRevision: packet.evidenceRevision,
          aggregationRuleId: parsed.data.aggregationRuleId,
          gradeScaleId: parsed.data.gradeScaleId,
          reason: parsed.data.reason,
          actorMembershipId: owner.id, actorUserId: userId,
        },
        select: {
          id: true, schoolId: true, sourcePacketId: true,
          finalDecisionId: true, evidenceId: true,
          adoptionId: true, sessionId: true, termId: true,
          classId: true, subjectId: true, evidenceRevision: true,
          aggregationRuleId: true, aggregationRuleVersion: true,
          gradeScaleId: true, gradeScaleVersion: true,
          studentCount: true, status: true, composedAt: true,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { compositionError(error); }
}

/** No student IDs, labels, grades or source JSON may leave this reader. */
export async function listPrivateOfficialReportCompositions(schoolId: string) {
  if (!identifier.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: { schoolId, userId, role: "SCHOOL_SUPER_ADMIN",
      isActive: true, school: { isActive: true } }, select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<Array<{
    id: string; sourcePacketId: string; finalDecisionId: string;
    evidenceId: string; adoptionId: string; sessionId: string; termId: string;
    classId: string; subjectId: string; evidenceRevision: number;
    aggregationRuleId: string; aggregationRuleVersion: number;
    gradeScaleId: string; gradeScaleVersion: number;
    studentCount: number; status: string; composedAt: Date;
  }>>(Prisma.sql`
    SELECT composition."id",composition."sourcePacketId",
      composition."finalDecisionId",composition."evidenceId",
      composition."adoptionId",composition."sessionId",composition."termId",
      composition."classId",composition."subjectId",
      composition."evidenceRevision",composition."aggregationRuleId",
      composition."aggregationRuleVersion",composition."gradeScaleId",
      composition."gradeScaleVersion",composition."studentCount",
      composition."status",composition."composedAt"
    FROM "PrivateOfficialReportComposition" composition
    JOIN "School" school ON school."id"=composition."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId}
      AND owner."role"='SCHOOL_SUPER_ADMIN'
      AND owner."isActive"=true
    WHERE composition."schoolId"=${schoolId}
    ORDER BY composition."composedAt" DESC,composition."id" DESC LIMIT 100
  `);
}
