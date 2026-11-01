import { describe, expect, it } from "vitest";
import {
  canApproveAttendance,
  canApproveRegister,
  canSubmitAttendance,
  hasExactActiveEnrollment,
  type AttendanceActor,
  type AttendanceContext,
} from "./eligibility";

const context: AttendanceContext = {
  schoolId: "school-a",
  studentId: "student-a",
  classId: "class-a",
  sessionId: "year-a",
  schoolActive: true,
  classActive: true,
  sessionActive: true,
  section: {
    id: "primary-a",
    schoolId: "school-a",
    stage: "PRIMARY",
    active: true,
  },
  enrollment: {
    schoolId: "school-a",
    studentId: "student-a",
    classId: "class-a",
    sessionId: "year-a",
    status: "ACTIVE",
  },
};
const actor: AttendanceActor = {
  schoolId: "school-a",
  active: true,
  membershipId: "member-a",
  role: "FORM_TEACHER",
  verifiedSectionIds: [],
  formTeacherResponsibilities: [
    {
      schoolId: "school-a",
      membershipId: "member-a",
      classId: "class-a",
      sessionId: "year-a",
      kind: "PRIMARY",
      status: "ACTIVE",
    },
  ],
};
const hm: AttendanceActor = {
  ...actor,
  role: "HEAD_OF_SECTION",
  verifiedSectionIds: ["primary-a"],
  formTeacherResponsibilities: [],
};
describe("attendance exact-relationship deny-by-default kernel", () => {
  it("allows only exact active enrollment and primary responsibility", () => {
    expect(hasExactActiveEnrollment(context)).toBe(true);
    expect(canSubmitAttendance(actor, context)).toBe(true);
    expect(canSubmitAttendance({ ...actor, role: "TEACHER" }, context)).toBe(
      true,
    );
    expect(
      canSubmitAttendance(
        {
          ...actor,
          formTeacherResponsibilities: [
            { ...actor.formTeacherResponsibilities[0], kind: "SUPPORT" },
          ],
        },
        context,
      ),
    ).toBe(false);
    expect(canSubmitAttendance({ ...actor, active: false }, context)).toBe(
      false,
    );
    expect(
      canSubmitAttendance({ ...actor, role: "SCHOOL_ADMIN" }, context),
    ).toBe(false);
  });
  it.each(["schoolId", "studentId", "classId", "sessionId"] as const)(
    "denies mismatching enrollment %s",
    (field) => {
      expect(
        canSubmitAttendance(actor, {
          ...context,
          enrollment: { ...context.enrollment!, [field]: "foreign" },
        }),
      ).toBe(false);
    },
  );
  it("denies inactive or cross-tenant section and enrolled history", () => {
    expect(hasExactActiveEnrollment({ ...context, enrollment: null })).toBe(
      false,
    );
    expect(
      hasExactActiveEnrollment({
        ...context,
        enrollment: { ...context.enrollment!, status: "ENDED" },
      }),
    ).toBe(false);
    expect(
      hasExactActiveEnrollment({
        ...context,
        section: { ...context.section!, schoolId: "school-b" },
      }),
    ).toBe(false);
    expect(hasExactActiveEnrollment({ ...context, classActive: false })).toBe(
      false,
    );
    expect(hasExactActiveEnrollment({ ...context, sessionActive: false })).toBe(
      false,
    );
    expect(hasExactActiveEnrollment({ ...context, schoolActive: false })).toBe(
      false,
    );
  });
  it("requires active exact-section authority for register-only review", () => {
    const { enrollment, studentId, ...register } = context;
    expect(enrollment).toBeDefined();
    expect(studentId).toBeDefined();
    expect(canApproveRegister(hm, register)).toBe(true);
    expect(
      canApproveRegister({ ...hm, verifiedSectionIds: ["other"] }, register),
    ).toBe(false);
    expect(canApproveRegister(hm, { ...register, section: null })).toBe(false);
    expect(
      canApproveRegister(hm, {
        ...register,
        section: { ...register.section!, schoolId: "foreign" },
      }),
    ).toBe(false);
    expect(canApproveRegister(hm, { ...register, schoolActive: false })).toBe(
      false,
    );
  });

  it("approves PRIMARY only with exact verified HM scope, SECONDARY only Principal", () => {
    expect(canApproveAttendance(hm, context)).toBe(true);
    expect(
      canApproveAttendance({ ...hm, verifiedSectionIds: ["other"] }, context),
    ).toBe(false);
    expect(canApproveAttendance({ ...hm, role: "PRINCIPAL" }, context)).toBe(
      false,
    );
    const secondary = {
      ...context,
      section: { ...context.section!, stage: "SECONDARY" as const },
    };
    expect(canApproveAttendance({ ...hm, role: "PRINCIPAL" }, secondary)).toBe(
      true,
    );
    expect(canApproveAttendance(hm, secondary)).toBe(false);
    expect(canApproveAttendance({ ...hm, active: false }, context)).toBe(false);
    expect(canApproveAttendance({ ...hm, schoolId: "school-b" }, context)).toBe(
      false,
    );
    expect(canApproveAttendance(actor, context)).toBe(false);
  });
});
