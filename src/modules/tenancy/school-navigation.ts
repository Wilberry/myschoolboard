import {
  authorize,
  type AuthorizationPrincipal,
  type MembershipRole,
} from "@/src/modules/authorization/policy";

/**
 * Presentation-only hint for the existing school detail route.
 * The actual page independently resolves the current membership on the server.
 * This deliberately supplies no class-subject pair, matching the route's
 * school-level academic:read request.
 */
export function canShowSchoolDetailLink(
  userId: string,
  schoolId: string,
  role: MembershipRole,
): boolean {
  if (!userId || !schoolId) return false;

  const principal: AuthorizationPrincipal = {
    userId,
    platformRole: "NONE",
    membership: {
      schoolId,
      role,
      isActive: true,
      scopes: [],
      teacherAssignments: [],
    },
  };
  return authorize(principal, "academic:read", { schoolId }).allowed;
}
