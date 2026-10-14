import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/src/lib/db";
import { readLessonWritingOptions } from "./read-options";

const tag = randomUUID();
const schoolA = `lesson-ui-a-${tag}`;
const schoolB = `lesson-ui-b-${tag}`;
const userA = `lesson-ui-teacher-a-${tag}`;
const userB = `lesson-ui-teacher-b-${tag}`;
const admin = `lesson-ui-admin-${tag}`;
const memberA = `lesson-ui-member-a-${tag}`;
const memberB = `lesson-ui-member-b-${tag}`;
const sessionA = `lesson-ui-session-a-${tag}`;
const sessionB = `lesson-ui-session-b-${tag}`;
const termA = `lesson-ui-term-a-${tag}`;
const termB = `lesson-ui-term-b-${tag}`;
const classA = `lesson-ui-class-a-${tag}`;
const classB = `lesson-ui-class-b-${tag}`;
const subjectA = `lesson-ui-subject-a-${tag}`;
const assignmentA = `lesson-ui-assignment-a-${tag}`;
const assignmentB = `lesson-ui-assignment-b-${tag}`;
const dates = {
  startsOn: new Date("2026-09-01T00:00:00.000Z"),
  endsOn: new Date("2027-07-31T00:00:00.000Z"),
};

describe("teacher lesson-note form options isolation", () => {
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
        { id: admin, name: "Synthetic Admin", email: `${admin}@example.test` },
      ],
    });
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Lesson UI School A", slug: schoolA },
        { id: schoolB, name: "Lesson UI School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { id: memberA, schoolId: schoolA, userId: userA, role: "TEACHER" },
        { id: memberB, schoolId: schoolB, userId: userB, role: "TEACHER" },
        { schoolId: schoolA, userId: admin, role: "SCHOOL_ADMIN" },
      ],
    });
    await prisma.academicSession.createMany({
      data: [
        {
          id: sessionA,
          schoolId: schoolA,
          name: "2026/2027",
          status: "ACTIVE",
          ...dates,
        },
        {
          id: sessionB,
          schoolId: schoolB,
          name: "2026/2027",
          status: "ACTIVE",
          ...dates,
        },
      ],
    });
    await prisma.academicTerm.createMany({
      data: [
        {
          id: termA,
          sessionId: sessionA,
          schoolId: schoolA,
          status: "ACTIVE",
          name: "First Term",
          position: 1,
          startsOn: dates.startsOn,
          endsOn: new Date("2026-12-18T00:00:00.000Z"),
        },
        {
          id: termB,
          sessionId: sessionB,
          schoolId: schoolB,
          status: "ACTIVE",
          name: "First Term",
          position: 1,
          startsOn: dates.startsOn,
          endsOn: new Date("2026-12-18T00:00:00.000Z"),
        },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: schoolA, name: "Primary One" },
        { id: classB, schoolId: schoolB, name: "Foreign Secondary" },
      ],
    });
    await prisma.subject.create({
      data: { id: subjectA, schoolId: schoolA, name: "Mathematics" },
    });
    const foreign = await prisma.subject.create({
      data: { schoolId: schoolB, name: "Foreign Biology" },
    });
    await prisma.teacherClassSubjectAssignment.createMany({
      data: [
        {
          id: assignmentA,
          schoolId: schoolA,
          sessionId: sessionA,
          membershipId: memberA,
          classId: classA,
          subjectId: subjectA,
        },
        {
          id: assignmentB,
          schoolId: schoolB,
          sessionId: sessionB,
          membershipId: memberB,
          classId: classB,
          subjectId: foreign.id,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA, userB, admin] } },
    });
    await prisma.$disconnect();
  });

  it("returns only the teacher's own active school terms and assignments", async () => {
    const options = await readLessonWritingOptions(userA, schoolA);
    expect(options?.school.id).toBe(schoolA);
    expect(options?.terms).toEqual([
      {
        id: termA,
        sessionId: sessionA,
        name: "2026/2027 · First Term",
      },
    ]);
    expect(options?.assignments).toEqual([
      {
        id: assignmentA,
        sessionId: sessionA,
        label: "Primary One · Mathematics",
      },
    ]);
    expect(JSON.stringify(options)).not.toContain("Foreign Biology");
    expect(JSON.stringify(options)).not.toContain(assignmentB);
  });

  it("hides foreign schools and denies non-teacher membership", async () => {
    expect(await readLessonWritingOptions(userA, schoolB)).toBeNull();
    expect(await readLessonWritingOptions(userB, schoolA)).toBeNull();
    expect(await readLessonWritingOptions(admin, schoolA)).toBeNull();
    expect(await readLessonWritingOptions("", schoolA)).toBeNull();
  });

  it("does not offer assignments after membership revocation", async () => {
    await prisma.membership.update({
      where: { id: memberA },
      data: { isActive: false },
    });
    try {
      expect(await readLessonWritingOptions(userA, schoolA)).toBeNull();
    } finally {
      await prisma.membership.update({
        where: { id: memberA },
        data: { isActive: true },
      });
    }
  });

  it("repeats teacher and tenant membership predicates in final queries", async () => {
    const assignments = vi.spyOn(
      prisma.teacherClassSubjectAssignment,
      "findMany",
    );
    const terms = vi.spyOn(prisma.academicTerm, "findMany");
    try {
      expect(await readLessonWritingOptions(userA, schoolA)).not.toBeNull();
      const expectedSchool = {
        isActive: true,
        memberships: {
          some: { userId: userA, isActive: true, role: "TEACHER" },
        },
      };
      for (const spy of [assignments, terms]) {
        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              schoolId: schoolA,
              school: expectedSchool,
            }),
          }),
        );
      }
    } finally {
      assignments.mockRestore();
      terms.mockRestore();
    }
  });
});
