import { describe, expect, it } from "vitest";
import {
  canShowSchoolDetailLink,
  canShowStudentLessonsLink,
} from "./school-navigation";
import type { MembershipRole } from "@/src/modules/authorization/policy";

describe("school detail navigation hint", () => {
  it.each([
    "SCHOOL_SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "HEAD_OF_SECTION",
    "PRINCIPAL",
    "FORM_TEACHER",
  ] satisfies MembershipRole[])(
    "offers the existing school detail route to %s",
    (role) => {
      expect(canShowSchoolDetailLink("user-a", "school-a", role)).toBe(true);
    },
  );

  it.each(["TEACHER", "PARENT", "STUDENT"] satisfies MembershipRole[])(
    "does not offer inaccessible school details to %s",
    (role) => {
      expect(canShowSchoolDetailLink("user-a", "school-a", role)).toBe(false);
    },
  );

  it("does not offer a link without authenticated user or school identity", () => {
    expect(canShowSchoolDetailLink("", "school-a", "SCHOOL_ADMIN")).toBe(false);
    expect(canShowSchoolDetailLink("user-a", "", "SCHOOL_ADMIN")).toBe(false);
  });
});

describe("student released-lesson navigation hint", () => {
  const linkedStudent = {
    schoolId: "school-a",
    revocation: null,
    student: {
      status: "ENROLLED",
      enrollments: [{ schoolId: "school-a" }],
    },
  };

  it("offers only the exact actively attested enrolled pupil link", () => {
    expect(
      canShowStudentLessonsLink("school-a", "STUDENT", linkedStudent),
    ).toBe(true);
    expect(canShowSchoolDetailLink("user-a", "school-a", "STUDENT")).toBe(
      false,
    );
  });

  it.each([
    "SCHOOL_ADMIN",
    "SCHOOL_SUPER_ADMIN",
    "TEACHER",
    "PARENT",
    "PRINCIPAL",
    "HEAD_OF_SECTION",
  ] satisfies MembershipRole[])("never offers pupil link to %s", (role) => {
    expect(canShowStudentLessonsLink("school-a", role, linkedStudent)).toBe(
      false,
    );
  });

  it("denies unlinked, revoked or unenrolled identities", () => {
    expect(canShowStudentLessonsLink("school-a", "STUDENT", null)).toBe(false);
    expect(
      canShowStudentLessonsLink("school-a", "STUDENT", {
        ...linkedStudent,
        revocation: { id: "revoked" },
      }),
    ).toBe(false);
    expect(
      canShowStudentLessonsLink("school-a", "STUDENT", {
        ...linkedStudent,
        student: { ...linkedStudent.student, status: "WITHDRAWN" },
      }),
    ).toBe(false);
    expect(
      canShowStudentLessonsLink("school-a", "STUDENT", {
        ...linkedStudent,
        student: { ...linkedStudent.student, enrollments: [] },
      }),
    ).toBe(false);
  });

  it("conceals foreign-school or missing-school navigation", () => {
    expect(
      canShowStudentLessonsLink("school-b", "STUDENT", linkedStudent),
    ).toBe(false);
    expect(canShowStudentLessonsLink("", "STUDENT", linkedStudent)).toBe(false);
    expect(
      canShowStudentLessonsLink("school-a", "STUDENT", {
        ...linkedStudent,
        student: {
          ...linkedStudent.student,
          enrollments: [{ schoolId: "school-b" }],
        },
      }),
    ).toBe(false);
  });
});
