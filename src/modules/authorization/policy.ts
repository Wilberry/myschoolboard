export type PlatformRole = "NONE" | "SUPER_ADMIN";

export type MembershipRole =
  | "SCHOOL_SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "HEAD_OF_SECTION"
  | "PRINCIPAL"
  | "TEACHER"
  | "FORM_TEACHER"
  | "PARENT"
  | "STUDENT";

export type ScopeType = "SECTION" | "CLASS" | "SUBJECT" | "CHILD";

export type SchoolAction =
  | "school:configure"
  | "academic:read"
  | "academic:edit"
  | "academic:submit"
  | "academic:approve"
  | "report:publish"
  | "child:read"
  | "platform:manage";

export interface ScopeGrant {
  type: ScopeType;
  scopeId: string;
  verified: boolean;
}

export interface AuthorizationPrincipal {
  userId: string;
  platformRole: PlatformRole;
  membership: {
    schoolId: string;
    role: MembershipRole;
    isActive: boolean;
    scopes: ScopeGrant[];
    teacherAssignments: {
      classId: string;
      subjectId: string;
      sessionId?: string | null;
    }[];
  } | null;
}

export interface AuthorizationResource {
  schoolId?: string;
  sectionId?: string;
  classId?: string;
  subjectId?: string;
  sessionId?: string;
  childUserId?: string;
  ownerUserId?: string;
}

export type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: "unauthenticated" | "forbidden" };

const schoolRoles: Record<
  Exclude<SchoolAction, "platform:manage">,
  MembershipRole[]
> = {
  "school:configure": ["SCHOOL_SUPER_ADMIN", "SCHOOL_ADMIN"],
  "academic:read": [
    "SCHOOL_SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "HEAD_OF_SECTION",
    "PRINCIPAL",
    "TEACHER",
    "FORM_TEACHER",
  ],
  "academic:edit": ["HEAD_OF_SECTION", "PRINCIPAL", "TEACHER"],
  "academic:submit": [
    "HEAD_OF_SECTION",
    "PRINCIPAL",
    "TEACHER",
    "FORM_TEACHER",
  ],
  "academic:approve": ["HEAD_OF_SECTION", "PRINCIPAL"],
  "report:publish": ["SCHOOL_SUPER_ADMIN"],
  "child:read": ["PARENT", "STUDENT"],
};

export function authorize(
  principal: AuthorizationPrincipal | null,
  action: SchoolAction,
  resource: AuthorizationResource = {},
): AuthorizationResult {
  if (!principal) return { allowed: false, reason: "unauthenticated" };

  if (action === "platform:manage") {
    return principal.platformRole === "SUPER_ADMIN"
      ? { allowed: true }
      : { allowed: false, reason: "forbidden" };
  }

  const membership = principal.membership;
  if (
    !membership ||
    !membership.isActive ||
    !resource.schoolId ||
    membership.schoolId !== resource.schoolId ||
    !schoolRoles[action].includes(membership.role)
  ) {
    return { allowed: false, reason: "forbidden" };
  }

  if (action === "child:read" && !resource.childUserId) {
    return { allowed: false, reason: "forbidden" };
  }

  if (resource.ownerUserId && resource.ownerUserId !== principal.userId) {
    return { allowed: false, reason: "forbidden" };
  }

  const requiresTeacherAssignment =
    membership.role === "TEACHER" &&
    ["academic:read", "academic:edit", "academic:submit"].includes(action);

  if (
    requiresTeacherAssignment &&
    (!resource.classId ||
      !resource.subjectId ||
      !membership.teacherAssignments.some(
        (assignment) =>
          assignment.classId === resource.classId &&
          assignment.subjectId === resource.subjectId &&
          (assignment.sessionId ?? null) === (resource.sessionId ?? null),
      ))
  ) {
    return { allowed: false, reason: "forbidden" };
  }

  if (
    resource.sectionId &&
    !membership.scopes.some(
      (scope) =>
        scope.type === "SECTION" &&
        scope.scopeId === resource.sectionId &&
        scope.verified,
    )
  ) {
    return { allowed: false, reason: "forbidden" };
  }

  if (
    resource.classId &&
    !requiresTeacherAssignment &&
    !membership.scopes.some(
      (scope) =>
        scope.type === "CLASS" &&
        scope.scopeId === resource.classId &&
        scope.verified,
    )
  ) {
    return { allowed: false, reason: "forbidden" };
  }

  if (
    resource.subjectId &&
    !requiresTeacherAssignment &&
    !membership.scopes.some(
      (scope) =>
        scope.type === "SUBJECT" &&
        scope.scopeId === resource.subjectId &&
        scope.verified,
    )
  ) {
    return { allowed: false, reason: "forbidden" };
  }

  if (
    resource.childUserId &&
    (membership.role === "PARENT"
      ? !membership.scopes.some(
          (scope) =>
            scope.type === "CHILD" &&
            scope.scopeId === resource.childUserId &&
            scope.verified,
        )
      : membership.role === "STUDENT" &&
        resource.childUserId !== principal.userId)
  ) {
    return { allowed: false, reason: "forbidden" };
  }

  return { allowed: true };
}

export function safeAuthorizationStatus(result: AuthorizationResult): number {
  return result.allowed ? 200 : result.reason === "unauthenticated" ? 401 : 404;
}
