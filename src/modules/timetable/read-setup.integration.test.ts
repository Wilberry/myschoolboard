import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/src/lib/db";
import { readTimetableSetup } from "./read-setup";

const tag = randomUUID();
const schoolA = `timetable-read-a-${tag}`;
const schoolB = `timetable-read-b-${tag}`;
const adminA = `timetable-reader-a-${tag}`;
const adminB = `timetable-reader-b-${tag}`;
const teacher = `timetable-reader-teacher-${tag}`;
const memberTeacher = `timetable-reader-member-${tag}`;
const sessionA = `timetable-reader-session-${tag}`;
const termA = `timetable-reader-term-${tag}`;
const classA = `timetable-reader-class-${tag}`;
const subjectA = `timetable-reader-subject-${tag}`;
const assignmentA = `timetable-reader-assignment-${tag}`;
const legacy = `timetable-reader-legacy-${tag}`;
let roomA = "";
let slotA = "";

describe("administrative timetable view tenant isolation", () => {
  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: adminA, email: `${adminA}@example.test`, name: "School A Admin" },
        { id: adminB, email: `${adminB}@example.test`, name: "School B Admin" },
        { id: teacher, email: `${teacher}@example.test`, name: "Synthetic Teacher" },
      ],
    });
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Reader School A", slug: schoolA },
        { id: schoolB, name: "Reader School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { userId: adminA, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        { userId: adminB, schoolId: schoolB, role: "SCHOOL_ADMIN" },
        { id: memberTeacher, userId: teacher, schoolId: schoolA, role: "TEACHER" },
      ],
    });
    await prisma.academicSession.create({
      data: {
        id: sessionA,
        schoolId: schoolA,
        name: "2026/2027",
        status: "ACTIVE",
        startsOn: new Date("2026-09-01T00:00:00.000Z"),
        endsOn: new Date("2027-07-31T00:00:00.000Z"),
      },
    });
    await prisma.academicTerm.create({
      data: {
        id: termA,
        sessionId: sessionA,
        schoolId: schoolA,
        name: "First Term",
        position: 1,
        status: "ACTIVE",
        startsOn: new Date("2026-09-01T00:00:00.000Z"),
        endsOn: new Date("2026-12-18T00:00:00.000Z"),
      },
    });
    await prisma.schoolClass.create({
      data: { id: classA, schoolId: schoolA, name: "Primary A" },
    });
    await prisma.subject.create({
      data: { id: subjectA, schoolId: schoolA, name: "Mathematics" },
    });
    await prisma.teacherClassSubjectAssignment.createMany({
      data: [
        { id: assignmentA, schoolId: schoolA, sessionId: sessionA,
          membershipId: memberTeacher, classId: classA, subjectId: subjectA },
        { id: legacy, schoolId: schoolA, sessionId: null,
          membershipId: memberTeacher, classId: classA, subjectId: subjectA },
      ],
    });
    const room = await prisma.timetableRoom.create({
      data: { schoolId: schoolA, name: "ROOM A" },
    });
    roomA = room.id;
    await prisma.timetableRoom.create({
      data: { schoolId: schoolB, name: "FOREIGN ROOM" },
    });
    const slot = await prisma.timetableSlot.create({
      data: {
        schoolId: schoolA, sessionId: sessionA, termId: termA,
        assignmentId: assignmentA, membershipId: memberTeacher,
        classId: classA, roomId: roomA,
        weekday: 1, startMinute: 540, endMinute: 600,
      },
    });
    slotA = slot.id;
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminA, adminB, teacher] } },
    });
    await prisma.$disconnect();
  });

  it("shows only the administrator's active school configuration", async () => {
    const result = await readTimetableSetup(adminA, schoolA);
    expect(result?.school.id).toBe(schoolA);
    expect(result?.terms).toHaveLength(1);
    expect(result?.rooms).toEqual([{ id: roomA, name: "ROOM A" }]);
    expect(result?.assignments).toHaveLength(1);
    expect(result?.assignments[0]).toMatchObject({
      id: assignmentA, sessionId: sessionA,
    });
    expect(result?.slots).toEqual([{
      id: slotA,
      termId: termA,
      assignmentId: assignmentA,
      roomId: roomA,
      weekday: 1,
      startMinute: 540,
      endMinute: 600,
    }]);
    expect(JSON.stringify(result)).not.toContain("FOREIGN ROOM");
    expect(JSON.stringify(result)).not.toContain(legacy);
  });

  it("denies foreign-school, teacher, and empty principals", async () => {
    expect(await readTimetableSetup(adminA, schoolB)).toBeNull();
    expect(await readTimetableSetup(adminB, schoolA)).toBeNull();
    expect(await readTimetableSetup(teacher, schoolA)).toBeNull();
    expect(await readTimetableSetup("", schoolA)).toBeNull();
  });

  it("requires an active school membership even after sign-in", async () => {
    const member = await prisma.membership.findUniqueOrThrow({
      where: { schoolId_userId: { schoolId: schoolA, userId: adminA } },
    });
    await prisma.membership.update({
      where: { id: member.id },
      data: { isActive: false },
    });
    try {
      expect(await readTimetableSetup(adminA, schoolA)).toBeNull();
    } finally {
      await prisma.membership.update({
        where: { id: member.id },
        data: { isActive: true },
      });
    }
  });

  it("repeats tenant and membership predicates on the final slot query", async () => {
    const spy = vi.spyOn(prisma.timetableSlot, "findMany");
    try {
      expect(await readTimetableSetup(adminA, schoolA)).not.toBeNull();
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: schoolA,
            school: {
              isActive: true,
              memberships: {
                some: {
                  userId: adminA,
                  isActive: true,
                  role: "SCHOOL_ADMIN",
                },
              },
            },
            status: "ACTIVE",
          }),
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("excludes cancelled bookings without erasing their history", async () => {
    await prisma.timetableSlot.update({
      where: { id: slotA },
      data: { status: "CANCELLED" },
    });
    try {
      const data = await readTimetableSetup(adminA, schoolA);
      expect(data?.slots).toHaveLength(0);
      expect(data?.rooms).toHaveLength(1);
    } finally {
      await prisma.timetableSlot.update({
        where: { id: slotA },
        data: { status: "ACTIVE" },
      });
    }
  });
});
