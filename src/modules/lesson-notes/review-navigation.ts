import { prisma } from "@/src/lib/db";
import type { AuthorizationPrincipal } from "@/src/modules/authorization/policy";

/**
 * Navigation is only a hint, never authorization to read or decide.
 * Still, do not offer a dead reviewer link to ungranted or cross-stage staff.
 */
export async function hasLessonReviewWorkspace(
  principal: AuthorizationPrincipal | null,
): Promise<boolean> {
  const membership = principal?.membership;
  if (!principal || !membership || !membership.isActive) return false;
  const stage =
    membership.role === "HEAD_OF_SECTION"
      ? "PRIMARY"
      : membership.role === "PRINCIPAL"
        ? "SECONDARY"
        : null;
  if (!stage) return false;
  const scopedIds = membership.scopes
    .filter((scope) => scope.type === "SECTION" && scope.verified)
    .map((scope) => scope.scopeId);
  if (scopedIds.length === 0) return false;

  const section = await prisma.schoolSection.findFirst({
    where: {
      schoolId: membership.schoolId,
      id: { in: scopedIds },
      isActive: true,
      stage,
      school: {
        isActive: true,
        memberships: {
          some: {
            schoolId: membership.schoolId,
            userId: principal.userId,
            isActive: true,
            role: membership.role,
            scopes: {
              some: {
                type: "SECTION",
                verified: true,
                scopeId: { in: scopedIds },
              },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  return Boolean(section);
}
