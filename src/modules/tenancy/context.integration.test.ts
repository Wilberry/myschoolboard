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
