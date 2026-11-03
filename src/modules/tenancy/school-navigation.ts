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

export function canShowResultPreparationLink(role: MembershipRole): boolean {
  return role === "TEACHER";
}

/** School-level academic:read is deliberately NOT granted to students.
 * This is only a server-rendered navigation hint. The student lesson page
 * and its private endpoints independently recheck school, pupil enrollment,
 * active attested account-link, revocation and release authorization.
 */
export function canShowStudentLessonsLink(
  schoolId: string,
  role: MembershipRole,
  binding: {
    schoolId: string;
    revocation: { id: string } | null;
    student: {
      status: string;
      enrollments: { schoolId: string }[];
    };
  } | null,
): boolean {
  return Boolean(
    schoolId &&
    role === "STUDENT" &&
    binding &&
    binding.schoolId === schoolId &&
    binding.revocation === null &&
    binding.student.status === "ENROLLED" &&
    binding.student.enrollments.some((item) => item.schoolId === schoolId),
  );
}
