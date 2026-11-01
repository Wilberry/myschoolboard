import { z } from "zod";
import { prisma } from "@/src/lib/db";
import {
  AcademicConfigError,
  actorId,
  mapError,
  requireSchoolConfigActor,
} from "@/src/modules/academics/config-service";

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value === value.trim());
const reason = z.string().trim().min(5).max(500);
const attest = z
  .object({
    studentId: id,
    guardianMembershipId: id,
    relationshipVerified: z.literal(true),
    reason,
  })
  .strict();
const revoke = z.object({ reason }).strict();

function requireId(value: string) {
  if (!id.safeParse(value).success) {
    throw new AcademicConfigError("INVALID_INPUT");
  }
}

/** Only a verified school administrator can attest an EXISTING PARENT member
 * to an ENROLLED student. Neither names nor account emails are compared.
 * This private ledger does not grant parent/guardian read permissions.
 */
export async function attestGuardianStudentLink(
  schoolId: string,
  payload: unknown,
) {
  requireId(schoolId);
  const parsed = attest.safeParse(payload);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "Membership"
          WHERE "schoolId"=${schoolId} AND "id"=${parsed.data.guardianMembershipId}
          FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "StudentRecord"
          WHERE "schoolId"=${schoolId} AND "id"=${parsed.data.studentId}
          FOR UPDATE`;

        const [guardian, student] = await Promise.all([
          tx.membership.findFirst({
            where: {
              id: parsed.data.guardianMembershipId,
              schoolId,
              role: "PARENT",
              isActive: true,
            },
            select: { id: true },
          }),
          tx.studentRecord.findFirst({
            where: {
              id: parsed.data.studentId,
              schoolId,
              status: "ENROLLED",
              enrollments: {
                some: {
                  schoolId,
                  status: "ACTIVE",
                  session: { schoolId, status: "ACTIVE" },
                  schoolClass: {
                    schoolId,
                    isActive: true,
                    section: { schoolId, isActive: true },
                  },
                },
              },
            },
            select: { id: true },
          }),
        ]);
        if (!guardian || !student) {
          throw new AcademicConfigError("NOT_FOUND");
        }

        return tx.guardianStudentLink.create({
          data: {
            schoolId,
            studentId: student.id,
            guardianMembershipId: guardian.id,
            attestedByMembershipId: actor.membershipId,
            attestedByUserId: userId,
            attestationReason: parsed.data.reason,
          },
          select: { id: true, schoolId: true, createdAt: true },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

/** Revocation is terminal for this exact guardian/student pair and audited.
 * Historic links are never rewritten or silently reactivated.
 */
export async function revokeGuardianStudentLink(
  schoolId: string,
  linkId: string,
  payload: unknown,
) {
  requireId(schoolId);
  requireId(linkId);
  const parsed = revoke.safeParse(payload);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const actor = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "GuardianStudentLink"
          WHERE "schoolId"=${schoolId} AND "id"=${linkId} FOR UPDATE`;
        const link = await tx.guardianStudentLink.findFirst({
          where: { schoolId, id: linkId, revocation: null },
          select: { id: true },
        });
        if (!link) throw new AcademicConfigError("NOT_FOUND");

        return tx.guardianStudentLinkRevocation.create({
          data: {
            schoolId,
            linkId: link.id,
            actorMembershipId: actor.membershipId,
            actorUserId: userId,
            reason: parsed.data.reason,
          },
          select: { id: true, linkId: true, createdAt: true },
        });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    mapError(error);
  }
}

/** Auditable link metadata only; never a parent or student route.
 * Rechecks current school-administrator membership in the final query.
 */
export async function listGuardianStudentLinksForAdmin(schoolId: string) {
  requireId(schoolId);
  const userId = await actorId();
  const school = await prisma.school.findFirst({
    where: {
      id: schoolId,
      isActive: true,
      memberships: {
        some: {
          userId,
          isActive: true,
          role: { in: ["SCHOOL_ADMIN", "SCHOOL_SUPER_ADMIN"] },
        },
      },
    },
    select: {
      guardianStudentLinks: {
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          studentId: true,
          guardianMembershipId: true,
          createdAt: true,
          revocation: { select: { createdAt: true } },
        },
      },
    },
  });
  if (!school) throw new AcademicConfigError("NOT_FOUND");
  return school.guardianStudentLinks;
}
