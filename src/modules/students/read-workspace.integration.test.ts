import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/src/lib/db";
import { readStudentWorkspace } from "./read-workspace";

const tag = randomUUID();
const schoolA = `student-view-a-${tag}`;
const schoolB = `student-view-b-${tag}`;
const admin = `student-view-admin-${tag}`;
const foreign = `student-view-foreign-${tag}`;
const teacher = `student-view-teacher-${tag}`;

describe("student administration workspace tenant and role barriers", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: admin, name: "Synthetic Admin", email: `${admin}@example.test` },
        {
          id: foreign,
          name: "Synthetic Foreign",
          email: `${foreign}@example.test`,
        },
        {
          id: teacher,
          name: "Synthetic Teacher",
          email: `${teacher}@example.test`,
        },
      ],
    });
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Synthetic School A", slug: schoolA },
        { id: schoolB, name: "Synthetic School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { schoolId: schoolA, userId: admin, role: "SCHOOL_ADMIN" },
        { schoolId: schoolB, userId: foreign, role: "SCHOOL_ADMIN" },
        { schoolId: schoolA, userId: teacher, role: "TEACHER" },
      ],
    });
    await prisma.studentRecord.createMany({
      data: [
        {
          schoolId: schoolA,
          admissionNumber: `A/${tag.slice(0, 8)}`.toUpperCase(),
          givenName: "Synthetic",
          familyName: "Student",
          status: "REGISTERED",
        },
        {
          schoolId: schoolB,
          admissionNumber: `B/${tag.slice(0, 8)}`.toUpperCase(),
          givenName: "Foreign",
          familyName: "Hidden",
          status: "REGISTERED",
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [admin, foreign, teacher] } },
    });
    await prisma.$disconnect();
  });

  it("returns minimal same-school administrative records only", async () => {
    const result = await readStudentWorkspace(admin, schoolA);
    expect(result?.students).toHaveLength(1);
    expect(result?.students[0]).toMatchObject({
      givenName: "Synthetic",
      status: "REGISTERED",
    });
    expect(JSON.stringify(result)).not.toContain("Foreign");
    expect(JSON.stringify(result)).not.toContain(schoolB);
  });

  it("conceals records from foreign administrators, teachers and unauthenticated users", async () => {
    expect(await readStudentWorkspace(foreign, schoolA)).toBeNull();
    expect(await readStudentWorkspace(teacher, schoolA)).toBeNull();
    expect(await readStudentWorkspace("", schoolA)).toBeNull();
  });

  it("rechecks membership and school lifecycle for denied reads", async () => {
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { schoolId_userId: { schoolId: schoolA, userId: admin } },
    });
    await prisma.membership.update({
      where: { id: membership.id },
      data: { isActive: false },
    });
    expect(await readStudentWorkspace(admin, schoolA)).toBeNull();
    await prisma.membership.update({
      where: { id: membership.id },
      data: { isActive: true },
    });
    await prisma.school.update({
      where: { id: schoolA },
      data: { isActive: false },
    });
    expect(await readStudentWorkspace(admin, schoolA)).toBeNull();
  });
});
