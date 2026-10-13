import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

const identifier = z.string().min(1).max(128).refine((value) => value.trim() === value);
const inputSchema = z
  .object({
    compositionId: identifier,
    visibilityPolicyId: identifier,
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

function fail(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code))) {
      throw new AssessmentError("CONFLICT");
    }
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}

/** Verified owner may record a fresh PRIVATE readiness attestation ONLY.
 * The SQL INSERT trigger locks school and independently validates all
 * academic, policy and exact grade recalculation inputs. No grade data is
 * selected by or returned from this mutation.
 * Attestation MUST NOT be used as a substitute for publication authorization.
 */
export async function recordInternalReportReleasePreflight(
  schoolId: string,
  input: unknown,
) {
  if (!identifier.safeParse(schoolId).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
  const parsed = inputSchema.safeParse(input);
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
        // SQL owns all evidence metadata, policy mode/version and status.
        // No user-submitted recipients, score JSON or publication option.
        return tx.resultReleasePreflightAttestation.create({
          data: {
            id: randomUUID(),
            schoolId,
            compositionId: parsed.data.compositionId,
            visibilityPolicyId: parsed.data.visibilityPolicyId,
            reason: parsed.data.reason,
            actorMembershipId: owner.id,
            actorUserId: userId,
            evidenceId: "",
            finalDecisionId: "",
            sourcePacketId: "",
            recipientMode: "ASSESSMENT_ONLY",
          },
          select: {
            id: true,
            compositionId: true,
            visibilityPolicyId: true,
            visibilityPolicyVersion: true,
            recipientMode: true,
            evidenceId: true,
            finalDecisionId: true,
            sourcePacketId: true,
            studentCount: true,
            status: true,
            checkedAt: true,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    fail(error);
  }
}

/** Bound current-owner policy/attestation metadata; no student detail. */
export async function listInternalReportReleasePreflights(schoolId: string) {
  if (!identifier.safeParse(schoolId).success) {
    throw new AssessmentError("INVALID_INPUT");
  }
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
      compositionId: string;
      visibilityPolicyId: string;
      visibilityPolicyVersion: number;
      recipientMode: string;
      evidenceId: string;
      finalDecisionId: string;
      sourcePacketId: string;
      studentCount: number;
      status: string;
      checkedAt: Date;
    }>
  >(Prisma.sql`
    SELECT att."id",att."compositionId",att."visibilityPolicyId",
      att."visibilityPolicyVersion",att."recipientMode",
      att."evidenceId",att."finalDecisionId",att."sourcePacketId",
      att."studentCount",att."status",att."checkedAt"
    FROM "ResultReleasePreflightAttestation" att
    JOIN "School" school ON school."id"=att."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId}
      AND owner."role"='SCHOOL_SUPER_ADMIN'
      AND owner."isActive"=true
    WHERE att."schoolId"=${schoolId}
    ORDER BY att."checkedAt" DESC,att."id" DESC LIMIT 100
  `);
}
