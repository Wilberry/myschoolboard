import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";

const fixtureId = randomUUID();
const schoolA = `assignment-school-a-${fixtureId}`;
const schoolB = `assignment-school-b-${fixtureId}`;
const userA = `assignment-user-a-${fixtureId}`;
const userB = `assignment-user-b-${fixtureId}`;
const membershipA = `assignment-membership-a-${fixtureId}`;
const membershipB = `assignment-membership-b-${fixtureId}`;
const classA = `assignment-class-a-${fixtureId}`;
const classA2 = `assignment-class-a2-${fixtureId}`;
const classB = `assignment-class-b-${fixtureId}`;
const subjectA = `assignment-subject-a-${fixtureId}`;
const subjectA2 = `assignment-subject-a2-${fixtureId}`;
const subjectB = `assignment-subject-b-${fixtureId}`;
const assignmentId = `assignment-pair-${fixtureId}`;

const assignmentData = (
  overrides: {
    membershipId?: string;
    classId?: string;
    subjectId?: string;
    status?: "ACTIVE" | "INACTIVE" | "REVOKED";
  } = {},
) => ({
  schoolId: schoolA,
  membershipId: membershipA,
  classId: classA,
  subjectId: subjectA,
  ...overrides,
});

describe("teacher class-subject assignment database integrity", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: userA,
          name: "Assignment Teacher A",
          email: `${userA}@example.test`,
        },
        {
          id: userB,
          name: "Assignment Teacher B",
          email: `${userB}@example.test`,
        },
      ],
    });
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Assignment School A", slug: `${schoolA}-slug` },
        { id: schoolB, name: "Assignment School B", slug: `${schoolB}-slug` },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { id: membershipA, userId: userA, schoolId: schoolA, role: "TEACHER" },
        { id: membershipB, userId: userB, schoolId: schoolB, role: "TEACHER" },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: schoolA, name: "Class A" },
        { id: classA2, schoolId: schoolA, name: "Class A2" },
        { id: classB, schoolId: schoolB, name: "Class B" },
      ],
    });
    await prisma.subject.createMany({
      data: [
        { id: subjectA, schoolId: schoolA, name: "Subject A" },
        { id: subjectA2, schoolId: schoolA, name: "Subject A2" },
        { id: subjectB, schoolId: schoolB, name: "Subject B" },
      ],
    });
    await prisma.scopeGrant.createMany({
      data: [
        { membershipId: membershipA, type: "CLASS", scopeId: classA },
        { membershipId: membershipA, type: "SUBJECT", scopeId: subjectA },
      ],
    });
    await prisma.teacherClassSubjectAssignment.create({
      data: { id: assignmentId, ...assignmentData({}) },
    });
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await prisma.$disconnect();
  });

  it("accepts valid same-school references and distinct assignment tuples", async () => {
    const second = await prisma.teacherClassSubjectAssignment.create({
      data: {
        id: `assignment-distinct-${fixtureId}`,
        ...assignmentData({ classId: classA2, subjectId: subjectA }),
      },
    });
    expect(second.schoolId).toBe(schoolA);
    expect(second.membershipId).toBe(membershipA);
    expect(second.classId).toBe(classA2);
    expect(second.subjectId).toBe(subjectA);
    await prisma.teacherClassSubjectAssignment.delete({
      where: { id: second.id },
    });
  });

  it("rejects a membership, class, or subject from another school", async () => {
    for (const overrides of [
      { membershipId: membershipB },
      { classId: classB },
      { subjectId: subjectB },
    ]) {
      await expect(
        prisma.teacherClassSubjectAssignment.create({
          data: {
            id: `assignment-cross-${randomUUID()}`,
            ...assignmentData(overrides),
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    }
  });

  it("rejects a duplicate tuple regardless of assignment status", async () => {
    await expect(
      prisma.teacherClassSubjectAssignment.create({
        data: {
          id: `assignment-duplicate-${fixtureId}`,
          ...assignmentData({ status: "REVOKED" }),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("uses the same row for active, inactive, and revoked lifecycle transitions", async () => {
    for (const status of ["INACTIVE", "REVOKED", "ACTIVE"] as const) {
      await prisma.teacherClassSubjectAssignment.update({
        where: { id: assignmentId },
        data: { status },
      });
      const rows = await prisma.teacherClassSubjectAssignment.findMany({
        where: assignmentData({}),
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: assignmentId, status });
    }
  });

  it("blocks deletion of referenced memberships, classes, and subjects", async () => {
    await expect(
      prisma.membership.delete({ where: { id: membershipA } }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.schoolClass.delete({ where: { id: classA } }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      prisma.subject.delete({ where: { id: subjectA } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("authorizes only an active exact assignment, not independent scopes", async () => {
    const activePrincipal = await resolveSchoolPrincipal(userA, schoolA);
    const resource = {
      schoolId: schoolA,
      classId: classA,
      subjectId: subjectA,
    };
    expect(authorize(activePrincipal, "academic:edit", resource).allowed).toBe(
      true,
    );

    await prisma.membership.update({
      where: { id: membershipA },
      data: { isActive: false },
    });
    const inactiveMembershipPrincipal = await resolveSchoolPrincipal(
      userA,
      schoolA,
    );
    expect(
      authorize(inactiveMembershipPrincipal, "academic:edit", resource).allowed,
    ).toBe(false);
    await prisma.membership.update({
      where: { id: membershipA },
      data: { isActive: true },
    });

    await prisma.teacherClassSubjectAssignment.update({
      where: { id: assignmentId },
      data: { status: "INACTIVE" },
    });
    const inactivePrincipal = await resolveSchoolPrincipal(userA, schoolA);
    expect(
      authorize(inactivePrincipal, "academic:edit", resource).allowed,
    ).toBe(false);

    await prisma.teacherClassSubjectAssignment.update({
      where: { id: assignmentId },
      data: { status: "REVOKED" },
    });
    const revokedPrincipal = await resolveSchoolPrincipal(userA, schoolA);
    expect(authorize(revokedPrincipal, "academic:edit", resource).allowed).toBe(
      false,
    );
  });

  it("preserves school-level cascade deletion for tenant cleanup", async () => {
    await prisma.school.delete({ where: { id: schoolA } });
    await expect(
      prisma.teacherClassSubjectAssignment.findUnique({
        where: { id: assignmentId },
      }),
    ).resolves.toBeNull();
  });
});
