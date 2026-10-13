import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AssessmentError,
  assessmentUserId,
} from "@/src/modules/assessments/question-service";

const id = z.string().min(1).max(128).refine((value) => value.trim() === value);
const reason = z.string().trim().min(5).max(500);
const eventInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("VERIFY"),
    studentId: id,
    guardianMembershipId: id,
    relationshipEvidenceReviewed: z.literal(true),
    reason,
  }).strict(),
  z.object({
    action: z.literal("REVOKE"),
    studentId: id,
    guardianMembershipId: id,
    reason,
  }).strict(),
]);
const diagnosticInput = z.object({
  compositionId: id,
  studentId: id,
  recipientMembershipId: id,
}).strict();

function mapError(error: unknown): never {
  if (error instanceof AssessmentError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    if (["P2002", "P2004", "P2010", "P2034"].includes(String(error.code))) {
      throw new AssessmentError("CONFLICT");
    }
    if (error.code === "P2003") throw new AssessmentError("NOT_FOUND");
  }
  throw new AssessmentError("INTERNAL");
}
async function currentOwner(schoolId: string) {
  if (!id.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
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
  return { userId, ownerId: owner.id };
}

/** Immutable current-school owner evidence; never a parent report access grant.
 * No identity inference, family-name matching or automatic relationship
 * verification. Only school-owner explicit human-reviewed evidence is valid.
 */
export async function recordGuardianRelationshipEvent(
  schoolId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
  const parsed = eventInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const userId = await assessmentUserId();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "School"
        WHERE "id"=${schoolId} AND "isActive"=true FOR UPDATE`;
      const owner = await tx.membership.findFirst({
        where: {
          schoolId, userId, role: "SCHOOL_SUPER_ADMIN",
          isActive: true, school: { isActive: true },
        },
        select: { id: true },
      });
      if (!owner) throw new AssessmentError("NOT_FOUND");
      // SQL repeats owner, guardian identity, enrollment and transition checks,
      // and derives audit ordinal, timestamp, reviewed flag itself.
      return tx.guardianStudentRelationshipEvent.create({
        data: {
          id: randomUUID(),
          schoolId,
          studentId: parsed.data.studentId,
          guardianMembershipId: parsed.data.guardianMembershipId,
          action: parsed.data.action,
          reason: parsed.data.reason,
          actorMembershipId: owner.id,
          actorUserId: userId,
        },
        select: {
          id: true, studentId: true, guardianMembershipId: true,
          action: true, ordinal: true, evidenceReviewed: true,
          recordedAt: true,
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { mapError(error); }
}

/** Private, bounded administrative relationship history; never grades. */
export async function listGuardianRelationshipEvents(schoolId: string) {
  const { userId } = await currentOwner(schoolId);
  return prisma.$queryRaw<Array<{
    id: string; studentId: string; guardianMembershipId: string;
    action: string; ordinal: number; evidenceReviewed: boolean; recordedAt: Date;
  }>>(Prisma.sql`
    SELECT e."id",e."studentId",e."guardianMembershipId",
      e."action",e."ordinal",e."evidenceReviewed",e."recordedAt"
    FROM "GuardianStudentRelationshipEvent" e
    JOIN "School" school ON school."id"=e."schoolId"
      AND school."isActive"=true
    JOIN "Membership" owner ON owner."schoolId"=school."id"
      AND owner."userId"=${userId}
      AND owner."role"='SCHOOL_SUPER_ADMIN'
      AND owner."isActive"=true
    WHERE e."schoolId"=${schoolId}
    ORDER BY e."recordedAt" DESC,e."id" DESC LIMIT 100
  `);
}

/** Report-specific, internal diagnostic ONLY. Its status is never a token
 * and MUST NOT be used to authorize any future student/guardian result read.
 */
export async function inspectPrivateReportRecipientRelationship(
  schoolId: string,
  input: unknown,
) {
  if (!id.safeParse(schoolId).success) throw new AssessmentError("INVALID_INPUT");
  const parsed = diagnosticInput.safeParse(input);
  if (!parsed.success) throw new AssessmentError("INVALID_INPUT");
  const { userId, ownerId } = await currentOwner(schoolId);
  try {
    const rows = await prisma.$queryRaw<Array<{ relationshipStatus: string }>>`
      SELECT "inspect_private_report_recipient_relationship"(
        ${schoolId},${parsed.data.compositionId},
        ${parsed.data.studentId},${parsed.data.recipientMembershipId},
        ${ownerId},${userId}) AS "relationshipStatus"`;
    return {
      status: rows[0]?.relationshipStatus === "RELATIONSHIP_VERIFIED_NOT_RELEASED"
        ? "RELATIONSHIP_VERIFIED_NOT_RELEASED"
        : "NO_VERIFIED_RELATIONSHIP_OR_POLICY",
      authorizedForReports: false,
    } as const;
  } catch (error) { mapError(error); }
}
