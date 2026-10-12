import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/src/lib/db";
import { readSchoolSetup } from "./read-setup";

const tag = randomUUID();
const schoolA = `setup-a-${tag}`;
const schoolB = `setup-b-${tag}`;
const adminA = `setup-admin-a-${tag}`;
const adminB = `setup-admin-b-${tag}`;
const principal = `setup-principal-${tag}`;
const sectionA = `setup-section-a-${tag}`;
const sectionB = `setup-section-b-${tag}`;

describe("school setup view data tenant isolation", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: adminA, email: `${adminA}@example.test`, name: "Synthetic A" },
        { id: adminB, email: `${adminB}@example.test`, name: "Synthetic B" },
        {
          id: principal,
          email: `${principal}@example.test`,
          name: "Synthetic Principal",
        },
      ],
    });
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Setup School A", slug: schoolA },
        { id: schoolB, name: "Setup School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { schoolId: schoolA, userId: adminA, role: "SCHOOL_ADMIN" },
        { schoolId: schoolB, userId: adminB, role: "SCHOOL_ADMIN" },
        { schoolId: schoolA, userId: principal, role: "PRINCIPAL" },
      ],
    });
    await prisma.academicSession.createMany({
      data: [
        {
          id: `session-a-${tag}`,
          schoolId: schoolA,
          name: "2026/2027",
          startsOn: new Date("2026-09-01T00:00:00.000Z"),
          endsOn: new Date("2027-07-31T00:00:00.000Z"),
        },
        {
          id: `session-b-${tag}`,
          schoolId: schoolB,
          name: "2026/2027",
          startsOn: new Date("2026-09-01T00:00:00.000Z"),
          endsOn: new Date("2027-07-31T00:00:00.000Z"),
        },
      ],
    });
    await prisma.academicTerm.create({
      data: {
        schoolId: schoolA,
        sessionId: `session-a-${tag}`,
        name: "First Term",
        position: 1,
        startsOn: new Date("2026-09-01T00:00:00.000Z"),
        endsOn: new Date("2026-12-18T00:00:00.000Z"),
      },
    });
    await prisma.schoolSection.createMany({
      data: [
        { id: sectionA, schoolId: schoolA, name: "Primary", stage: "PRIMARY" },
        { id: sectionB, schoolId: schoolB, name: "Foreign Secondary", stage: "SECONDARY" },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { schoolId: schoolA, name: "Class 1", sectionId: sectionA },
        { schoolId: schoolB, name: "Foreign Class 1", sectionId: sectionB },
      ],
    });
    await prisma.subject.createMany({
      data: [
        { schoolId: schoolA, name: "Mathematics" },
        { schoolId: schoolB, name: "Foreign Biology" },
      ],
    });
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminA, adminB, principal] } },
    });
    await prisma.$disconnect();
  });

  it("returns only the authenticated administrator's school configuration", async () => {
    const snapshot = await readSchoolSetup(adminA, schoolA);
    expect(snapshot?.school).toMatchObject({ id: schoolA });
    expect(snapshot?.sessions).toHaveLength(1);
    expect(snapshot?.sessions[0]).toMatchObject({
      name: "2026/2027",
      startsOn: "2026-09-01",
    });
    expect(snapshot?.terms).toHaveLength(1);
    expect(snapshot?.classes.map((c) => c.name)).toContain("Class 1");
    expect(snapshot?.subjects.map((s) => s.name)).toContain("Mathematics");
    expect(JSON.stringify(snapshot)).not.toContain("Foreign");
    expect(JSON.stringify(snapshot)).not.toContain(schoolB);
  });

  it("conceals foreign schools and academic-only memberships", async () => {
    expect(await readSchoolSetup(adminA, schoolB)).toBeNull();
    expect(await readSchoolSetup(adminB, schoolA)).toBeNull();
    expect(await readSchoolSetup(principal, schoolA)).toBeNull();
  });

  it("rechecks active membership before returning a setup workspace", async () => {
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { schoolId_userId: { schoolId: schoolA, userId: adminA } },
    });
    await prisma.membership.update({
      where: { id: membership.id },
      data: { isActive: false },
    });
    try {
      expect(await readSchoolSetup(adminA, schoolA)).toBeNull();
    } finally {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { isActive: true },
      });
    }
  });

  it("includes only own school section and class-to-section mapping", async () => {
    const snapshot = await readSchoolSetup(adminA, schoolA);
    expect(snapshot?.sections).toEqual([{
      id: sectionA,
      name: "Primary",
      stage: "PRIMARY",
      isActive: true,
    }]);
    expect(snapshot?.classes[0].sectionId).toBe(sectionA);
    expect(JSON.stringify(snapshot)).not.toContain(sectionB);
  });

  it("rechecks active school-administrator identity in the final section query", async () => {
    const spy = vi.spyOn(prisma.schoolSection, "findMany");
    try {
      expect(await readSchoolSetup(adminA, schoolA)).not.toBeNull();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            schoolId: schoolA,
            school: {
              isActive: true,
              memberships: {
                some: {
                  userId: adminA,
                  role: "SCHOOL_ADMIN",
                  isActive: true,
                },
              },
            },
          },
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("includes the active school membership in final collection queries", async () => {
    const spy = vi.spyOn(prisma.academicSession, "findMany");
    try {
      expect(await readSchoolSetup(adminA, schoolA)).not.toBeNull();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            schoolId: schoolA,
            school: {
              isActive: true,
              memberships: {
                some: {
                  userId: adminA,
                  role: "SCHOOL_ADMIN",
                  isActive: true,
                },
              },
            },
          },
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
