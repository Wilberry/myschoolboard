import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "./context";
import { requireSchoolAccess } from "./school-access";

const testId = randomUUID();
const userA = `tenant-test-a-${testId}`;
const userB = `tenant-test-b-${testId}`;
const schoolA = `tenant-test-school-a-${testId}`;
const schoolB = `tenant-test-school-b-${testId}`;
const classA = `tenant-class-a-${testId}`;
const classB = `tenant-class-b-${testId}`;
const subjectA = `tenant-subject-a-${testId}`;
const subjectB = `tenant-subject-b-${testId}`;

describe("database-backed tenant context", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: userA,
          name: "Synthetic Teacher A",
          email: `${userA}@example.test`,
        },
        {
          id: userB,
          name: "Synthetic Teacher B",
          email: `${userB}@example.test`,
        },
      ],
    });
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Synthetic School A", slug: `${schoolA}-slug` },
        { id: schoolB, name: "Synthetic School B", slug: `${schoolB}-slug` },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { userId: userA, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        { userId: userB, schoolId: schoolB, role: "SCHOOL_ADMIN" },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: schoolA, name: "Scoped Class A" },
        { id: classB, schoolId: schoolB, name: "Scoped Class B" },
      ],
    });
    await prisma.subject.createMany({
      data: [
        { id: subjectA, schoolId: schoolA, name: "Scoped Subject A" },
        { id: subjectB, schoolId: schoolB, name: "Scoped Subject B" },
      ],
    });

    const memberA = await prisma.membership.findUniqueOrThrow({
      where: { schoolId_userId: { schoolId: schoolA, userId: userA } },
      select: { id: true },
    });
    await prisma.scopeGrant.createMany({
      data: [
        {
          membershipId: memberA.id,
          type: "CLASS",
          scopeId: classA,
          verified: true,
        },
        {
          membershipId: memberA.id,
          type: "CLASS",
          scopeId: classB,
          verified: true,
        },
        {
          membershipId: memberA.id,
          type: "SUBJECT",
          scopeId: subjectA,
          verified: true,
        },
        {
          membershipId: memberA.id,
          type: "SUBJECT",
          scopeId: subjectB,
          verified: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.$disconnect();
  });

  it("does not reuse tenant context between users or requests", async () => {
    const contextA = await resolveSchoolPrincipal(userA, schoolA);
    const contextB = await resolveSchoolPrincipal(userB, schoolB);
    const tamperedContext = await resolveSchoolPrincipal(userA, schoolB);

    expect(
      authorize(contextA, "academic:read", { schoolId: schoolA }).allowed,
    ).toBe(true);
    expect(
      authorize(contextB, "academic:read", { schoolId: schoolB }).allowed,
    ).toBe(true);
    expect(
      authorize(tamperedContext, "academic:read", { schoolId: schoolB })
        .allowed,
    ).toBe(false);
  });

  it("keeps verified class and subject grants within their owning school", async () => {
    const principal = await resolveSchoolPrincipal(userA, schoolA);
    const scopes = principal?.membership?.scopes ?? [];

    expect(scopes).toEqual(
      expect.arrayContaining([
        { type: "CLASS", scopeId: classA, verified: true },
        { type: "SUBJECT", scopeId: subjectA, verified: true },
      ]),
    );
    expect(scopes.some((scope) => scope.scopeId === classB)).toBe(false);
    expect(scopes.some((scope) => scope.scopeId === subjectB)).toBe(false);

    expect(
      authorize(principal, "academic:read", {
        schoolId: schoolA,
        classId: classA,
        subjectId: subjectA,
      }).allowed,
    ).toBe(true);
    expect(
      authorize(principal, "academic:read", {
        schoolId: schoolA,
        classId: classB,
      }).allowed,
    ).toBe(false);
    expect(
      authorize(principal, "academic:read", {
        schoolId: schoolA,
        subjectId: subjectB,
      }).allowed,
    ).toBe(false);
  });

  it("does not authorize stale scope IDs when scoped resources are inactive", async () => {
    try {
      await prisma.schoolClass.update({
        where: { id: classA },
        data: { isActive: false },
      });
      await prisma.subject.update({
        where: { id: subjectA },
        data: { isActive: false },
      });

      const principal = await resolveSchoolPrincipal(userA, schoolA);
      expect(principal?.membership?.scopes).toEqual([]);
      expect(
        authorize(principal, "academic:read", {
          schoolId: schoolA,
          classId: classA,
        }).allowed,
      ).toBe(false);
      expect(
        authorize(principal, "academic:read", {
          schoolId: schoolA,
          subjectId: subjectA,
        }).allowed,
      ).toBe(false);
    } finally {
      await prisma.schoolClass.update({
        where: { id: classA },
        data: { isActive: true },
      });
      await prisma.subject.update({
        where: { id: subjectA },
        data: { isActive: true },
      });
    }
  });

  it("revokes access when membership becomes inactive", async () => {
    await prisma.membership.updateMany({
      where: { userId: userA, schoolId: schoolA },
      data: { isActive: false },
    });
    const principal = await resolveSchoolPrincipal(userA, schoolA);
    expect(
      authorize(principal, "academic:read", { schoolId: schoolA }).allowed,
    ).toBe(false);
  });

  it("blocks cross-school access and missing or revoked membership at the school boundary", async () => {
    await prisma.membership.updateMany({
      where: { userId: userA, schoolId: schoolA },
      data: { isActive: true },
    });

    await expect(requireSchoolAccess(userA, schoolA)).resolves.toMatchObject({
      school: { id: schoolA },
    });
    await expect(requireSchoolAccess(userA, schoolB)).resolves.toBeNull();
    await expect(requireSchoolAccess(userB, schoolA)).resolves.toBeNull();

    await prisma.membership.updateMany({
      where: { userId: userA, schoolId: schoolA },
      data: { isActive: false },
    });
    await expect(requireSchoolAccess(userA, schoolA)).resolves.toBeNull();
  });
});
