import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { AcademicConfigError, requireSchoolConfigActor } from "@/src/modules/academics/config-service";

const id = z.string().min(1).max(128).refine(v => v.trim() === v);
const payloadSchema = z.object({
  membershipId: id,
  studentId: id,
  action: z.enum(["LINK", "REVOKE"]),
  reason: z.string().trim().min(5).max(500),
  identityConfirmed: z.literal(true),
}).strict();

/** Manual, explicit school admin attestation; never auto-match identity from
 * email/admission number, nor create student/guardian memberships implicitly.
 * The SQL trigger independently checks every identity and serializes school.
 */
export async function changeStudentIdentityLink(schoolId: string, payload: unknown) {
  if (!id.safeParse(schoolId).success) throw new AcademicConfigError("INVALID_INPUT");
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new AcademicConfigError("INVALID_INPUT");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AcademicConfigError("UNAUTHENTICATED");
  const { membershipId, studentId, action, reason } = parsed.data;
  try {
    return await prisma.$transaction(async tx => {
      const admin = await requireSchoolConfigActor(tx, session.user.id, schoolId);
      await tx.$queryRaw`SELECT "id" FROM "Membership"
        WHERE "schoolId" = ${schoolId} AND "id" = ${membershipId} FOR UPDATE`;
      const subject = await tx.membership.findFirst({
        where: { schoolId, id: membershipId, isActive: true, role: "STUDENT" },
        select: { id: true },
      });
      const student = await tx.studentRecord.findFirst({
        where: {
          id: studentId, schoolId,
          ...(action === "LINK" ? { status: "ENROLLED" as const } : {}),
        },
        select: { id: true },
      });
      if (!subject || !student) throw new AcademicConfigError("NOT_FOUND");
      const prior = await tx.studentIdentityLinkEvent.findFirst({
        where: { schoolId, membershipId },
        orderBy: { sequence: "desc" },
        select: { sequence: true, studentId: true, eventType: true },
      });
      if (action === "LINK" && prior?.eventType === "LINKED") {
        throw new AcademicConfigError("CONFLICT");
      }
      if (action === "REVOKE" && (prior?.eventType !== "LINKED" ||
          prior.studentId !== studentId)) {
        throw new AcademicConfigError("CONFLICT");
      }
      if (action === "LINK") {
        const others = await tx.$queryRaw<Array<{ membershipId: string }>>(Prisma.sql`
          SELECT other."id" AS "membershipId" FROM "Membership" other
          JOIN LATERAL (
            SELECT link."studentId", link."eventType"
            FROM "StudentIdentityLinkEvent" link
            WHERE link."schoolId" = other."schoolId"
              AND link."membershipId" = other."id"
            ORDER BY link."sequence" DESC LIMIT 1
          ) current_link ON true
          WHERE other."schoolId" = ${schoolId}
            AND other."id" <> ${membershipId}
            AND current_link."studentId" = ${studentId}
            AND current_link."eventType" = 'LINKED'
          LIMIT 1
        `);
        if (others.length) throw new AcademicConfigError("CONFLICT");
      }
      const created = await tx.studentIdentityLinkEvent.create({
        data: {
          schoolId, membershipId, studentId,
          sequence: (prior?.sequence ?? 0) + 1,
          eventType: action === "LINK" ? "LINKED" : "REVOKED",
          reason, actorUserId: session.user.id,
          actorMembershipId: admin.membershipId,
        },
        select: {
          id: true, sequence: true, eventType: true, createdAt: true,
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof AcademicConfigError) throw error;
    if (error && typeof error === "object" && "code" in error &&
        (error.code === "P2002" || error.code === "P2034")) {
      throw new AcademicConfigError("CONFLICT");
    }
    throw new AcademicConfigError("INTERNAL");
  }
}
