import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
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
  .refine((v) => v === v.trim());
const attest = z
  .object({
    studentId: id,
    studentMembershipId: id,
    reason: z.string().trim().min(5).max(500),
    // Explicit accountable administrator affirmation, never inferred identity.
    identityVerified: z.literal(true),
  })
  .strict();
const revoke = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
const requireId = (value: string) => {
  if (!id.safeParse(value).success)
    throw new AcademicConfigError("INVALID_INPUT");
};

/** A school admin explicitly attests a pre-existing STUDENT membership to
 * an enrolled StudentRecord. No email/name/admission-number matching or
 * bulk retroactive links. The one-to-one link is permanent and revocable.
 */
export async function attestStudentAccount(schoolId: string, payload: unknown) {
  requireId(schoolId);
  const data = attest.safeParse(payload);
  if (!data.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const admin = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId"=${schoolId} AND "id"=${data.data.studentMembershipId}
        FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "StudentRecord"
        WHERE "schoolId"=${schoolId} AND "id"=${data.data.studentId} FOR UPDATE`;
        const [member, pupil] = await Promise.all([
          tx.membership.findFirst({
            where: {
              id: data.data.studentMembershipId,
              schoolId,
              isActive: true,
              role: "STUDENT",
            },
            select: { id: true },
          }),
          tx.studentRecord.findFirst({
            where: {
              id: data.data.studentId,
              schoolId,
              status: "ENROLLED",
              enrollments: { some: { schoolId, status: "ACTIVE" } },
            },
            select: { id: true },
          }),
        ]);
        if (!member || !pupil) throw new AcademicConfigError("NOT_FOUND");
        return tx.studentAccountLink.create({
          data: {
            schoolId,
            studentId: pupil.id,
            studentMembershipId: member.id,
            attestedByMembershipId: admin.membershipId,
            attestedByUserId: userId,
            attestationReason: data.data.reason,
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

export async function revokeStudentAccountLink(
  schoolId: string,
  linkId: string,
  payload: unknown,
) {
  requireId(schoolId);
  requireId(linkId);
  const data = revoke.safeParse(payload);
  if (!data.success) throw new AcademicConfigError("INVALID_INPUT");
  const userId = await actorId();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const admin = await requireSchoolConfigActor(tx, userId, schoolId);
        await tx.$queryRaw`SELECT "id" FROM "StudentAccountLink"
        WHERE "schoolId"=${schoolId} AND "id"=${linkId} FOR UPDATE`;
        const link = await tx.studentAccountLink.findFirst({
          where: { schoolId, id: linkId, revocation: null },
          select: { id: true },
        });
        if (!link) throw new AcademicConfigError("NOT_FOUND");
        return tx.studentAccountLinkRevocation.create({
          data: {
            schoolId,
            linkId: link.id,
            actorMembershipId: admin.membershipId,
            actorUserId: userId,
            reason: data.data.reason,
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

/** School administration may only view link IDs for its own school. */
export async function readStudentLinksForAdmin(schoolId: string) {
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
      studentAccountLinks: {
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          studentId: true,
          studentMembershipId: true,
          createdAt: true,
          revocation: { select: { createdAt: true } },
        },
      },
    },
  });
  if (!school) throw new AcademicConfigError("NOT_FOUND");
  return school.studentAccountLinks;
}
