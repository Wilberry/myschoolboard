import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value.trim() === value);
const request = z
  .object({
    finalDecisionId: id,
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

function packetFailure(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code)))
      throw new AssessmentError("CONFLICT");
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}

/** Internal owner preparation. Never returns frozen student source cards.
 * The BEFORE INSERT trigger repeats locked final-readiness checks and
 * derives the packet from trusted frozen SQL source, never request JSON.
 * Not a grade or a publish action.
 */
export async function preparePrivateReportCardSourcePacket(
  schoolId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const parsed = request.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
        const owner = await tx.membership.findFirst({
          where: {
            schoolId,
            userId,
            role: "SCHOOL_SUPER_ADMIN",
            isActive: true,
            school: { isActive: true },
          },
          select: { id: true },
        });
        if (!owner) throw new AssessmentError("NOT_FOUND");
        const decision = await tx.resultFinalPublicationDecision.findFirst({
          where: { id: parsed.data.finalDecisionId, schoolId },
          select: {
            id: true,
            evidenceId: true,
            adoptionId: true,
            sessionId: true,
            termId: true,
            classId: true,
            subjectId: true,
            evidenceRevision: true,
            ordinal: true,
          },
        });
        if (!decision) throw new AssessmentError("NOT_FOUND");
        return tx.resultReportCardSourcePacket.create({
          data: {
            id: randomUUID(),
            schoolId,
            finalDecisionId: decision.id,
            evidenceId: decision.evidenceId,
            adoptionId: decision.adoptionId,
            sessionId: decision.sessionId,
            termId: decision.termId,
            classId: decision.classId,
            subjectId: decision.subjectId,
            evidenceRevision: decision.evidenceRevision,
            finalDecisionOrdinal: decision.ordinal,
            reason: parsed.data.reason,
            actorMembershipId: owner.id,
            actorUserId: userId,
          },
          select: {
            id: true,
            finalDecisionId: true,
            evidenceId: true,
            adoptionId: true,
            evidenceRevision: true,
            finalDecisionOrdinal: true,
            classId: true,
            subjectId: true,
            sessionId: true,
            termId: true,
            studentCount: true,
            preparedAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    packetFailure(error);
  }
}

/** Owner-only internal evidence packet metadata; not a student report-card
 * endpoint. The final SQL reader repeats active same-tenant owner access.
 */
export async function listPrivateReportCardSourcePackets(schoolId: string) {
  if (!id.safeParse(schoolId).success)
    throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  const owner = await prisma.membership.findFirst({
    where: {
      schoolId,
      userId,
      role: "SCHOOL_SUPER_ADMIN",
      isActive: true,
      school: { isActive: true },
    },
    select: { id: true },
  });
  if (!owner) throw new AssessmentError("NOT_FOUND");
  return prisma.$queryRaw<
    Array<{
      id: string;
      finalDecisionId: string;
      evidenceId: string;
      adoptionId: string;
      evidenceRevision: number;
      finalDecisionOrdinal: number;
      classId: string;
      subjectId: string;
      termId: string;
      sessionId: string;
      studentCount: number;
      preparedAt: Date;
    }>
  >(Prisma.sql`
    SELECT packet."id",packet."finalDecisionId",packet."evidenceId",
      packet."adoptionId",packet."evidenceRevision",packet."finalDecisionOrdinal",
      packet."classId",packet."subjectId",packet."termId",packet."sessionId",
      packet."studentCount",packet."preparedAt"
    FROM "ResultReportCardSourcePacket" packet
    JOIN "School" school ON school."id"=packet."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId} AND owner."role"='SCHOOL_SUPER_ADMIN'
      AND owner."isActive"=true
    WHERE packet."schoolId"=${schoolId}
    ORDER BY packet."preparedAt" DESC,packet."id" DESC LIMIT 100
  `);
}
