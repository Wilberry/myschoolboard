import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => ctx.headers,
}));

import { POST as roomRoute } from "@/app/api/schools/[schoolId]/timetable/rooms/route";
import { POST as slotRoute } from "@/app/api/schools/[schoolId]/timetable/slots/route";
import { POST as cancelRoute } from "@/app/api/schools/[schoolId]/timetable/slots/[slotId]/cancel/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const schoolA = `timetable-school-a-${tag}`;
const schoolB = `timetable-school-b-${tag}`;
const sessionA = `timetable-session-a-${tag}`;
const termA = `timetable-term-a-${tag}`;
const termB = `timetable-term-b-${tag}`;
const classA = `timetable-class-a-${tag}`;
const classB = `timetable-class-b-${tag}`;
const subjectA = `timetable-subject-a-${tag}`;
const memberA = `timetable-member-a-${tag}`;
const memberB = `timetable-member-b-${tag}`;
const assignments = {
  base: `timetable-assignment-base-${tag}`,
  sameTeacher: `timetable-assignment-teacher-${tag}`,
  sameClass: `timetable-assignment-class-${tag}`,
  separate: `timetable-assignment-separate-${tag}`,
};
const password = "synthetic-timetable-password-42";
const emails = {
  admin: `timetable-admin-${tag}@example.test`,
  teacherA: `timetable-teacher-a-${tag}@example.test`,
  teacherB: `timetable-teacher-b-${tag}@example.test`,
  otherAdmin: `timetable-other-admin-${tag}@example.test`,
} as const;
const users: Record<string, string> = {};
let adminCookie = "";
let teacherCookie = "";
let foreignCookie = "";
let roomId = "";
let foreignRoomId = "";
let baseSlotId = "";

async function signIn(email: string) {
  const res = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = res.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Synthetic cookie missing");
  return cookie;
}

function post(cookie: string, path: string, body: unknown) {
  ctx.headers = new Headers(cookie ? { cookie } : {});
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function createRoom(cookie: string, name: string, schoolId = schoolA) {
  return roomRoute(
    post(cookie, `/api/schools/${schoolId}/timetable/rooms`, {
      name,
      reason: "Synthetic room configuration",
    }),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function schedule(
  cookie: string,
  options: Record<string, unknown>,
  schoolId = schoolA,
) {
  return slotRoute(
    post(cookie, `/api/schools/${schoolId}/timetable/slots`, {
      termId: termA,
      assignmentId: assignments.base,
      weekday: 1,
      startMinute: 540,
      endMinute: 600,
      reason: "Synthetic lesson scheduling",
      ...options,
    }),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function cancel(cookie: string, slotId: string, schoolId = schoolA) {
  return cancelRoute(
    post(cookie, `/api/schools/${schoolId}/timetable/slots/${slotId}/cancel`, {
      reason: "Synthetic timetable cancellation",
    }),
    { params: Promise.resolve({ schoolId, slotId }) },
  );
}

describe("school-owned timetable overlap and history", () => {
  beforeAll(async () => {
    for (const [kind, email] of Object.entries(emails)) {
      const result = await auth.api.signUpEmail({
        body: { name: `Synthetic ${kind}`, email, password },
      });
      users[kind] = result.user.id;
    }
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Timetable School A", slug: schoolA },
        { id: schoolB, name: "Timetable School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { userId: users.admin, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        {
          id: memberA,
          userId: users.teacherA,
          schoolId: schoolA,
          role: "TEACHER",
        },
        {
          id: memberB,
          userId: users.teacherB,
          schoolId: schoolA,
          role: "TEACHER",
        },
        { userId: users.otherAdmin, schoolId: schoolB, role: "SCHOOL_ADMIN" },
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
    await prisma.academicSession.create({
      data: {
        id: `other-session-${tag}`,
        schoolId: schoolB,
        name: "2026/2027",
        status: "ACTIVE",
        startsOn: new Date("2026-09-01T00:00:00.000Z"),
        endsOn: new Date("2027-07-31T00:00:00.000Z"),
      },
    });
    await prisma.academicTerm.create({
      data: {
        id: termB,
        sessionId: `other-session-${tag}`,
        schoolId: schoolB,
        name: "First Term",
        position: 1,
        status: "ACTIVE",
        startsOn: new Date("2026-09-01T00:00:00.000Z"),
        endsOn: new Date("2026-12-18T00:00:00.000Z"),
      },
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: schoolA, name: "Alpha Class" },
        { id: classB, schoolId: schoolA, name: "Beta Class" },
      ],
    });
    await prisma.subject.create({
      data: { id: subjectA, schoolId: schoolA, name: "Mathematics" },
    });
    await prisma.teacherClassSubjectAssignment.createMany({
      data: [
        {
          id: assignments.base,
          schoolId: schoolA,
          sessionId: sessionA,
          membershipId: memberA,
          classId: classA,
          subjectId: subjectA,
        },
        {
          id: assignments.sameTeacher,
          schoolId: schoolA,
          sessionId: sessionA,
          membershipId: memberA,
          classId: classB,
          subjectId: subjectA,
        },
        {
          id: assignments.sameClass,
          schoolId: schoolA,
          sessionId: sessionA,
          membershipId: memberB,
          classId: classA,
          subjectId: subjectA,
        },
        {
          id: assignments.separate,
          schoolId: schoolA,
          sessionId: sessionA,
          membershipId: memberB,
          classId: classB,
          subjectId: subjectA,
        },
      ],
    });
    const foreignRoom = await prisma.timetableRoom.create({
      data: { schoolId: schoolB, name: "ROOM B" },
    });
    foreignRoomId = foreignRoom.id;
    adminCookie = await signIn(emails.admin);
    teacherCookie = await signIn(emails.teacherA);
    foreignCookie = await signIn(emails.otherAdmin);
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    const ids = Object.values(users);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("conceals non-administrator or other-school scheduling requests", async () => {
    for (const cookie of ["", teacherCookie, foreignCookie]) {
      const expected = cookie ? 404 : 401;
      expect((await createRoom(cookie, "ROOM X")).status).toBe(expected);
      expect((await schedule(cookie, {})).status).toBe(expected);
    }
    expect((await createRoom(adminCookie, "ROOM X", schoolB)).status).toBe(404);
    expect((await schedule(adminCookie, { termId: termB })).status).toBe(404);
    expect(
      (
        await schedule(adminCookie, {
          assignmentId: "another-school-assignment",
        })
      ).status,
    ).toBe(404);
    expect(
      await prisma.timetableEvent.count({ where: { schoolId: schoolA } }),
    ).toBe(0);
  });

  it("normalizes and audits room creation without duplicate rooms", async () => {
    const created = await createRoom(adminCookie, " room a ");
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    const room = (await created.json()).room;
    roomId = room.id;
    expect(room).toMatchObject({ schoolId: schoolA, name: "ROOM A" });
    expect((await createRoom(adminCookie, "Room A")).status).toBe(409);
    const events = await prisma.schoolConfigurationEvent.findMany({
      where: { schoolId: schoolA, eventType: "TIMETABLE_ROOM_CREATED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].resourceId).toBe(roomId);
  });

  it("rejects teacher, class and room collisions but allows adjacent slots", async () => {
    const first = await schedule(adminCookie, { roomId });
    expect(first.status).toBe(201);
    const slot = (await first.json()).slot;
    baseSlotId = slot.id;
    expect(slot).toMatchObject({
      schoolId: schoolA,
      sessionId: sessionA,
      termId: termA,
      weekday: 1,
      startMinute: 540,
      endMinute: 600,
    });
    for (const change of [
      {
        assignmentId: assignments.sameTeacher,
        startMinute: 550,
        endMinute: 600,
      },
      { assignmentId: assignments.sameClass, startMinute: 550, endMinute: 600 },
      {
        assignmentId: assignments.separate,
        roomId,
        startMinute: 550,
        endMinute: 600,
      },
    ]) {
      const response = await schedule(adminCookie, change);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "Conflict" });
    }
    // A different teacher/class in the same room begins exactly as the first ends.
    const adjacent = await schedule(adminCookie, {
      assignmentId: assignments.separate,
      roomId,
      startMinute: 600,
      endMinute: 660,
    });
    expect(adjacent.status).toBe(201);
    const otherDay = await schedule(adminCookie, {
      assignmentId: assignments.separate,
      roomId,
      weekday: 2,
      startMinute: 540,
      endMinute: 600,
    });
    expect(otherDay.status).toBe(201);
    expect(
      (await schedule(adminCookie, { roomId: foreignRoomId })).status,
    ).toBe(404);
    expect((await schedule(adminCookie, { weekday: 8 })).status).toBe(400);
    expect(
      (
        await schedule(adminCookie, {
          startMinute: 600,
          endMinute: 600,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await schedule(adminCookie, {
          startMinute: 1400,
          endMinute: 1500,
        })
      ).status,
    ).toBe(400);
  });

  it("cancellation preserves history and releases time for a new booking", async () => {
    const cancelled = await cancel(adminCookie, baseSlotId);
    expect(cancelled.status).toBe(200);
    expect((await cancelled.json()).slot.status).toBe("CANCELLED");
    expect((await cancel(adminCookie, baseSlotId)).status).toBe(409);
    expect((await cancel(foreignCookie, baseSlotId)).status).toBe(404);

    const replacement = await schedule(adminCookie, {
      roomId,
      assignmentId: assignments.separate,
      startMinute: 550,
      endMinute: 590,
    });
    expect(replacement.status).toBe(201);
    const events = await prisma.timetableEvent.findMany({
      where: { schoolId: schoolA, slotId: baseSlotId },
    });
    expect(events.map((e) => e.eventType).sort()).toEqual([
      "CANCELLED",
      "CREATED",
    ]);
    expect(events.every((e) => e.reason.length > 4)).toBe(true);
    expect(
      await prisma.teacherClassSubjectAssignmentEvent.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
  });

  it("protects timetable event history from update and delete", async () => {
    const event = await prisma.timetableEvent.findFirstOrThrow({
      where: { schoolId: schoolA },
    });
    await expect(
      prisma.timetableEvent.update({
        where: { id: event.id },
        data: { reason: "tampered audit reason" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.timetableEvent.delete({
        where: { id: event.id },
      }),
    ).rejects.toThrow();
  });

  it("does not schedule after the academic term is closed", async () => {
    await prisma.academicTerm.update({
      where: { id: termA },
      data: { status: "CLOSED" },
    });
    const result = await schedule(adminCookie, {
      assignmentId: assignments.sameClass,
      weekday: 3,
    });
    expect(result.status).toBe(404);
  });
});
