import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AcademicConfigError, actorId, requireSchoolConfigActor,
} from "@/src/modules/academics/config-service";

const id = z.string().min(1).max(128).refine(v => v === v.trim());
const reason = z.string().trim().min(5).max(500);
const attestation = z.object({
  studentId: id,
  guardianMembershipId: id,
  identityVerified: z.literal(true),
  reason,
}).strict();
const revocation = z.object({ reason }).strict();

function requireId(value: string) {
  if (!id.safeParse(value).success)
    throw new AcademicConfigError("INVALID_INPUT");
}
function fail(error: unknown): never {
  if (error instanceof AcademicConfigError) throw error;
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (["P2002", "P2004", "P2010", "P2034"].includes(code))
      throw new AcademicConfigError("CONFLICT");
    if (code === "P2003") throw new AcademicConfigError("NOT_FOUND");
  }
  throw new AcademicConfigError("INTERNAL");
}

/**
 * School administration attests a pre-existing PARENT member to one exact
 * enrolled pupil. Link is identity evidence only: NO guardian report access,
 * access grant, inferred family relationship, release or result export.
 */
export async function attestGuardianStudentLink(schoolId: string, input: unknown) {
  requireId(schoolId);
  const parsed = attestation.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();
  try {
    return await prisma.$transaction(async tx => {
      const admin = await requireSchoolConfigActor(tx, userId, schoolId);
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId"=${schoolId}
          AND "id"=${parsed.data.guardianMembershipId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "StudentRecord"
        WHERE "schoolId"=${schoolId}
          AND "id"=${parsed.data.studentId} FOR UPDATE`;
      const [guardian, student] = await Promise.all([
        tx.membership.findFirst({
          where: {
            id: parsed.data.guardianMembershipId, schoolId,
            isActive: true, role: "PARENT",
            userId: { not: userId },
          },
          select: { id: true },
        }),
        tx.studentRecord.findFirst({
          where: {
            schoolId, id: parsed.data.studentId, status: "ENROLLED",
            enrollments: { some: { schoolId, status: "ACTIVE" } },
          },
          select: { id: true },
        }),
      ]);
      if (!guardian || !student) throw new AcademicConfigError("NOT_FOUND");
      return tx.guardianStudentLink.create({
        data: {
          schoolId, studentId: student.id,
          guardianMembershipId: guardian.id,
          attestedByMembershipId: admin.membershipId,
          attestedByUserId: userId,
          attestationReason: parsed.data.reason,
        },
        select: { id: true, schoolId: true, createdAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { fail(error); }
}

/** Terminal revocation; reattestation never edits or erases audit history. */
export async function revokeGuardianStudentLink(
  schoolId: string, linkId: string, input: unknown,
) {
  requireId(schoolId); requireId(linkId);
  const parsed = revocation.safeParse(input);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();
  try {
    return await prisma.$transaction(async tx => {
      const admin = await requireSchoolConfigActor(tx, userId, schoolId);
      await tx.$queryRaw`SELECT "id" FROM "GuardianStudentLink"
        WHERE "schoolId"=${schoolId} AND "id"=${linkId} FOR UPDATE`;
      const link = await tx.guardianStudentLink.findFirst({
        where: { schoolId, id: linkId, revocation: null },
        select: { id: true },
      });
      if (!link) throw new AcademicConfigError("NOT_FOUND");
      return tx.guardianStudentLinkRevocation.create({
        data: {
          schoolId, linkId: link.id, actorMembershipId: admin.membershipId,
          actorUserId: userId, reason: parsed.data.reason,
        },
        select: { id: true, linkId: true, createdAt: true },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) { fail(error); }
}

/** Minimal metadata-only history for current exact school administrators.
 * Authorization lives in this final SQL query, not a stale earlier check.
 */
export async function listGuardianStudentLinksForAdmin(schoolId: string) {
  requireId(schoolId);
  const userId = await actorId();
  return prisma.$queryRaw<Array<{
    id: string; studentId: string; guardianMembershipId: string;
    createdAt: Date; revokedAt: Date | null;
  }>>(Prisma.sql`
    SELECT link."id",link."studentId",link."guardianMembershipId",
      link."createdAt",revocation."createdAt" AS "revokedAt"
    FROM "GuardianStudentLink" link
    JOIN "School" school ON school."id"=link."schoolId"
      AND school."isActive"=true
    LEFT JOIN "GuardianStudentLinkRevocation" revocation
      ON revocation."schoolId"=link."schoolId"
      AND revocation."linkId"=link."id"
    WHERE link."schoolId"=${schoolId}
      AND EXISTS (
        SELECT 1 FROM "Membership" admin
        WHERE admin."schoolId"=school."id"
          AND admin."userId"=${userId}
          AND admin."isActive"=true
          AND admin."role" IN ('SCHOOL_ADMIN','SCHOOL_SUPER_ADMIN')
      )
    ORDER BY link."createdAt" DESC,link."id" DESC
    LIMIT 100
  `);
}
