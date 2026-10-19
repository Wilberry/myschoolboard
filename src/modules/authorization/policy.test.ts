import { describe, expect, it } from "vitest";
import {
  authorize,
  safeAuthorizationStatus,
  type AuthorizationPrincipal,
  type AuthorizationResource,
  type MembershipRole,
  type ScopeType,
} from "./policy";

function principal(
  role: MembershipRole,
  options: Partial<NonNullable<AuthorizationPrincipal["membership"]>> = {},
): AuthorizationPrincipal {
  return {
    userId: "user-a",
    platformRole: "NONE",
    membership: {
      schoolId: "school-a",
      role,
      isActive: true,
      scopes: [],
      teacherAssignments: [],
      ...options,
    },
  };
}

describe("server authorization policy", () => {
  it("blocks another school's records and a tampered school ID", () => {
    expect(
      authorize(principal("TEACHER"), "academic:read", { schoolId: "school-b" })
        .allowed,
    ).toBe(false);
  });

  it("requires a verified child grant for parent access", () => {
    const parent = principal("PARENT", {
      scopes: [{ type: "CHILD", scopeId: "child-a", verified: true }],
    });
    expect(
      authorize(parent, "child:read", {
        schoolId: "school-a",
        childUserId: "child-a",
      }).allowed,
    ).toBe(true);
    expect(
      authorize(parent, "child:read", {
        schoolId: "school-a",
        childUserId: "child-b",
      }).allowed,
    ).toBe(false);
    expect(
      authorize(parent, "child:read", { schoolId: "school-a" }).allowed,
    ).toBe(false);
  });

  it("requires an exact assignment pair and does not combine independent scopes", () => {
    const teacher = principal("TEACHER", {
      scopes: [
        { type: "CLASS", scopeId: "class-a", verified: false },
        { type: "SUBJECT", scopeId: "subject-a", verified: false },
      ],
    });
    expect(
      authorize(teacher, "academic:edit", {
        schoolId: "school-a",
        classId: "class-a",
        subjectId: "subject-a",
      }).allowed,
    ).toBe(false);

    const assignedTeacher = principal("TEACHER", {
      teacherAssignments: [{ classId: "class-a", subjectId: "subject-a" }],
    });
    expect(
      authorize(assignedTeacher, "academic:edit", {
        schoolId: "school-a",
        classId: "class-a",
        subjectId: "subject-a",
      }).allowed,
    ).toBe(true);
    expect(
      authorize(assignedTeacher, "academic:edit", {
        schoolId: "school-a",
        classId: "class-a",
        subjectId: "subject-b",
      }).allowed,
    ).toBe(false);
    expect(
      authorize(assignedTeacher, "academic:edit", { schoolId: "school-a" })
        .allowed,
    ).toBe(false);
  });

  it("requires the exact academic session for period-bound teaching", () => {
    const periodTeacher = principal("TEACHER", {
      teacherAssignments: [
        {
          classId: "class-a",
          subjectId: "subject-a",
          sessionId: "session-2026",
        },
      ],
    });
    const legacyTeacher = principal("TEACHER", {
      teacherAssignments: [
        { classId: "class-a", subjectId: "subject-a", sessionId: null },
      ],
    });
    const pair = {
      schoolId: "school-a",
      classId: "class-a",
      subjectId: "subject-a",
    };

    expect(
      authorize(periodTeacher, "academic:read", {
        ...pair,
        sessionId: "session-2026",
      }).allowed,
    ).toBe(true);
    expect(authorize(periodTeacher, "academic:read", pair).allowed).toBe(false);
    expect(
      authorize(periodTeacher, "academic:read", {
        ...pair,
        sessionId: "session-2027",
      }).allowed,
    ).toBe(false);
    expect(authorize(legacyTeacher, "academic:read", pair).allowed).toBe(true);
    expect(
      authorize(legacyTeacher, "academic:read", {
        ...pair,
        sessionId: "session-2026",
      }).allowed,
    ).toBe(false);
  });

  it.each([
    {
      type: "SECTION",
      scopeId: "section-a",
      resource: { sectionId: "section-a" },
    },
    {
      type: "CLASS",
      scopeId: "class-a",
      resource: { classId: "class-a" },
    },
    {
      type: "SUBJECT",
      scopeId: "subject-a",
      resource: { subjectId: "subject-a" },
    },
  ] satisfies {
    type: ScopeType;
    scopeId: string;
    resource: AuthorizationResource;
  }[])(
    "requires a verified $type scope grant for school academic access",
    ({ type, scopeId, resource }) => {
      const unverified = principal("SCHOOL_ADMIN", {
        scopes: [{ type, scopeId, verified: false }],
      });
      const verified = principal("SCHOOL_ADMIN", {
        scopes: [{ type, scopeId, verified: true }],
      });

      expect(
        authorize(unverified, "academic:read", {
          schoolId: "school-a",
          ...resource,
        }).allowed,
      ).toBe(false);
      expect(
        authorize(verified, "academic:read", {
          schoolId: "school-a",
          ...resource,
        }).allowed,
      ).toBe(true);
    },
  );

  it("does not treat a verified scope as a grant for a different resource", () => {
    const admin = principal("SCHOOL_ADMIN", {
      scopes: [{ type: "CLASS", scopeId: "class-a", verified: true }],
    });
    expect(
      authorize(admin, "academic:read", {
        schoolId: "school-a",
        classId: "class-b",
      }).allowed,
    ).toBe(false);
  });

  it("does not grant school administrators platform authority", () => {
    expect(
      authorize(principal("SCHOOL_ADMIN"), "platform:manage").allowed,
    ).toBe(false);
  });

  it("separates final publication from academic editing for school super admins", () => {
    const admin = principal("SCHOOL_SUPER_ADMIN");
    expect(
      authorize(admin, "academic:edit", { schoolId: "school-a" }).allowed,
    ).toBe(false);
    expect(
      authorize(admin, "report:publish", { schoolId: "school-a" }).allowed,
    ).toBe(true);
  });

  it("denies inactive memberships", () => {
    expect(
      authorize(principal("TEACHER", { isActive: false }), "academic:read", {
        schoolId: "school-a",
      }).allowed,
    ).toBe(false);
  });

  it("rejects unauthenticated access", () => {
    const result = authorize(null, "academic:read", { schoolId: "school-a" });
    expect(result).toEqual({ allowed: false, reason: "unauthenticated" });
    expect(safeAuthorizationStatus(result)).toBe(401);
  });

  it("uses a non-disclosing status for unauthorized resource access", () => {
    const result = authorize(principal("PARENT"), "child:read", {
      schoolId: "school-a",
      childUserId: "private-child",
    });
    expect(result).toEqual({ allowed: false, reason: "forbidden" });
    expect(safeAuthorizationStatus(result)).toBe(404);
  });

  it("resolves tenant access independently for each request", () => {
    const first = authorize(principal("SCHOOL_ADMIN"), "academic:read", {
      schoolId: "school-a",
    });
    const second = authorize(
      principal("SCHOOL_ADMIN", { schoolId: "school-b" }),
      "academic:read",
      { schoolId: "school-a" },
    );
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
  });
});
