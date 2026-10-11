import { prisma } from "@/src/lib/db";
import type { AuthorizationPrincipal } from "@/src/modules/authorization/policy";

export async function resolveSchoolPrincipal(
  userId: string,
  requestedSchoolId: string,
): Promise<AuthorizationPrincipal | null> {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true },
    }),
    prisma.membership.findFirst({
      where: {
        userId,
        schoolId: requestedSchoolId,
        isActive: true,
        school: { isActive: true },
      },
      select: {
        schoolId: true,
        role: true,
        isActive: true,
        scopes: { select: { type: true, scopeId: true, verified: true } },
        teacherClassSubjectAssignments: {
          where: {
            status: "ACTIVE",
            schoolId: requestedSchoolId,
            schoolClass: { isActive: true },
            subject: { isActive: true },
          },
          select: { classId: true, subjectId: true },
        },
      },
    }),
  ]);

  if (!user) return null;

  return {
    userId: user.id,
    platformRole: user.platformRole,
    membership: membership
      ? {
          schoolId: membership.schoolId,
          role: membership.role,
          isActive: membership.isActive,
          scopes: membership.scopes,
          teacherAssignments: membership.teacherClassSubjectAssignments,
        }
      : null,
  };
}
