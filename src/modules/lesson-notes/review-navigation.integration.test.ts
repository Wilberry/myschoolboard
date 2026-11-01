import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/lib/db";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";
import { hasLessonReviewWorkspace } from "./review-navigation";

const tag = randomUUID();
const schoolA = `review-nav-a-${tag}`;
const schoolB = `review-nav-b-${tag}`;
const headUser = `review-nav-head-${tag}`;
const principalUser = `review-nav-principal-${tag}`;
const teacherUser = `review-nav-teacher-${tag}`;
const headMember = `review-nav-head-member-${tag}`;
const principalMember = `review-nav-principal-member-${tag}`;
const sectionPrimary = `review-nav-primary-${tag}`;
const sectionSecondary = `review-nav-secondary-${tag}`;
const sectionForeign = `review-nav-foreign-${tag}`;
let headGrant = "";

describe("role/stage-aligned lesson-note reviewer navigation", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: headUser,
          name: "Synthetic Head",
          email: `${headUser}@example.test`,
        },
        {
          id: principalUser,
          name: "Synthetic Principal",
          email: `${principalUser}@example.test`,
        },
        {
          id: teacherUser,
          name: "Synthetic Teacher",
          email: `${teacherUser}@example.test`,
        },
      ],
    });
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Review Nav School A", slug: schoolA },
        { id: schoolB, name: "Review Nav School B", slug: schoolB },
      ],
    });
    await prisma.schoolSection.createMany({
      data: [
        {
          id: sectionPrimary,
          schoolId: schoolA,
          name: "Primary",
          stage: "PRIMARY",
        },
        {
          id: sectionSecondary,
          schoolId: schoolA,
          name: "Secondary",
          stage: "SECONDARY",
        },
        {
          id: sectionForeign,
          schoolId: schoolB,
          name: "Foreign",
          stage: "PRIMARY",
        },
      ],
    });
    await prisma.membership.createMany({
      data: [
        {
          id: headMember,
          schoolId: schoolA,
          userId: headUser,
          role: "HEAD_OF_SECTION",
        },
        {
          id: principalMember,
          schoolId: schoolA,
          userId: principalUser,
          role: "PRINCIPAL",
        },
        { schoolId: schoolA, userId: teacherUser, role: "TEACHER" },
      ],
    });
    const grant = await prisma.scopeGrant.create({
      data: {
        membershipId: headMember,
        type: "SECTION",
        scopeId: sectionPrimary,
        verified: true,
      },
    });
    headGrant = grant.id;
    await prisma.scopeGrant.createMany({
      data: [
        {
          membershipId: headMember,
          type: "SECTION",
          scopeId: sectionForeign,
          verified: true,
        },
        {
          membershipId: principalMember,
          type: "SECTION",
          scopeId: sectionSecondary,
          verified: true,
        },
        {
          membershipId: principalMember,
          type: "SECTION",
          scopeId: sectionPrimary,
          verified: false,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [headUser, principalUser, teacherUser] } },
    });
    await prisma.$disconnect();
  });

  it("offers reviewer entry to scoped primary HEAD and secondary PRINCIPAL", async () => {
    const head = await resolveSchoolPrincipal(headUser, schoolA);
    const principal = await resolveSchoolPrincipal(principalUser, schoolA);
    expect(await hasLessonReviewWorkspace(head)).toBe(true);
    expect(await hasLessonReviewWorkspace(principal)).toBe(true);
  });

  it("denies generic subject teachers and foreign-school principals", async () => {
    const teacher = await resolveSchoolPrincipal(teacherUser, schoolA);
    const foreign = await resolveSchoolPrincipal(headUser, schoolB);
    expect(await hasLessonReviewWorkspace(teacher)).toBe(false);
    expect(await hasLessonReviewWorkspace(foreign)).toBe(false);
    expect(await hasLessonReviewWorkspace(null)).toBe(false);
  });

  it("loses navigation permission when the only matching grant is unverified", async () => {
    await prisma.scopeGrant.update({
      where: { id: headGrant },
      data: { verified: false },
    });
    try {
      const head = await resolveSchoolPrincipal(headUser, schoolA);
      expect(await hasLessonReviewWorkspace(head)).toBe(false);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: headGrant },
        data: { verified: true },
      });
    }
  });

  it("rechecks active school membership and section in final navigation query", async () => {
    const principal = await resolveSchoolPrincipal(principalUser, schoolA);
    const spy = vi.spyOn(prisma.schoolSection, "findFirst");
    try {
      expect(await hasLessonReviewWorkspace(principal)).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: schoolA,
            isActive: true,
            stage: "SECONDARY",
            school: {
              isActive: true,
              memberships: {
                some: expect.objectContaining({
                  userId: principalUser,
                  isActive: true,
                  role: "PRINCIPAL",
                }),
              },
            },
          }),
        }),
      );
    } finally {
      spy.mockRestore();
    }
    await prisma.schoolSection.update({
      where: { id: sectionSecondary },
      data: { isActive: false },
    });
    try {
      const after = await resolveSchoolPrincipal(principalUser, schoolA);
      expect(await hasLessonReviewWorkspace(after)).toBe(false);
    } finally {
      await prisma.schoolSection.update({
        where: { id: sectionSecondary },
        data: { isActive: true },
      });
    }
  });
});
