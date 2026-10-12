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
  if (!membership) {
    return {
      userId: user.id,
      platformRole: user.platformRole,
      membership: null,
    };
  }

  // ScopeGrant stores an untyped resource ID rather than a foreign key.
  // Resolve class/subject grants against active resources in this school,
  // so even a verified ID belonging to another tenant is not authority.
  const classIds = membership.scopes
    .filter((scope) => scope.type === "CLASS")
    .map((scope) => scope.scopeId);
  const subjectIds = membership.scopes
    .filter((scope) => scope.type === "SUBJECT")
    .map((scope) => scope.scopeId);

  const [classes, subjects] = await Promise.all([
    classIds.length
      ? prisma.schoolClass.findMany({
          where: {
            schoolId: requestedSchoolId,
            id: { in: classIds },
            isActive: true,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
    subjectIds.length
      ? prisma.subject.findMany({
          where: {
            schoolId: requestedSchoolId,
            id: { in: subjectIds },
            isActive: true,
          },
          select: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const allowedClassIds = new Set(classes.map((schoolClass) => schoolClass.id));
  const allowedSubjectIds = new Set(subjects.map((subject) => subject.id));
  const scopes = membership.scopes.filter((scope) => {
    if (scope.type === "CLASS") return allowedClassIds.has(scope.scopeId);
    if (scope.type === "SUBJECT") return allowedSubjectIds.has(scope.scopeId);
    // SECTION and CHILD are governed by separate, not-yet-implemented
    // resource models. No new authorization is granted here.
    return true;
  });

  return {
    userId: user.id,
    platformRole: user.platformRole,
    membership: {
      schoolId: membership.schoolId,
      role: membership.role,
      isActive: membership.isActive,
      scopes,
      teacherAssignments: membership.teacherClassSubjectAssignments,
    },
  };
}
