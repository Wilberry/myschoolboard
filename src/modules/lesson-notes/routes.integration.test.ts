import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => ctx.headers,
}));

import {
  GET as listRoute,
  POST as createRoute,
} from "@/app/api/schools/[schoolId]/lesson-notes/route";
import { GET as detailRoute } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/route";
import { POST as reviseRoute } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/revisions/route";
import { POST as submitRoute } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/submit/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const schoolA = `lessons-a-${tag}`;
const schoolB = `lessons-b-${tag}`;
const sessionA = `lessons-session-a-${tag}`;
const termA = `lessons-term-a-${tag}`;
const termB = `lessons-term-b-${tag}`;
const classA = `lessons-class-a-${tag}`;
const subjectA = `lessons-subject-a-${tag}`;
const teacherMembershipA = `lessons-teacher-a-${tag}`;
const teacherMembershipB = `lessons-teacher-b-${tag}`;
const assignmentA = `lessons-assignment-a-${tag}`;
const assignmentB = `lessons-assignment-b-${tag}`;
const password = "synthetic-lesson-note-password-42";
const emails = {
  teacherA: `lessons-teacher-a-${tag}@example.test`,
  teacherB: `lessons-teacher-b-${tag}@example.test`,
  admin: `lessons-admin-${tag}@example.test`,
  foreign: `lessons-foreign-${tag}@example.test`,
};
const users: Record<string, string> = {};
let teacherCookie = "";
let otherTeacherCookie = "";
let adminCookie = "";
let foreignCookie = "";
let noteId = "";

const draft = {
  topic: "Introduction to Fractions",
  objectives: "Learners identify halves and quarters",
  content: "Use paper-folding examples to explain equal parts.",
};

async function signIn(email: string) {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = result.headers
    .getSetCookie()
    .map((item) => item.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Synthetic session cookie missing");
  return cookie;
}

function request(
  cookie: string,
  method: "GET" | "POST",
  path: string,
  data?: unknown,
) {
  ctx.headers = new Headers(cookie ? { cookie } : {});
  return new Request(`http://localhost${path}`, {
    method,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}

async function create(cookie: string, body: unknown, schoolId = schoolA) {
  return createRoute(
    request(cookie, "POST", `/api/schools/${schoolId}/lesson-notes`, body),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function list(cookie: string, schoolId = schoolA) {
  return listRoute(
    request(cookie, "GET", `/api/schools/${schoolId}/lesson-notes`),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function detail(cookie: string, id = noteId, schoolId = schoolA) {
  return detailRoute(
    request(cookie, "GET", `/api/schools/${schoolId}/lesson-notes/${id}`),
    { params: Promise.resolve({ schoolId, noteId: id }) },
  );
}

async function revise(cookie: string, body: unknown, id = noteId) {
  return reviseRoute(
    request(
      cookie,
      "POST",
      `/api/schools/${schoolA}/lesson-notes/${id}/revisions`,
      body,
    ),
    { params: Promise.resolve({ schoolId: schoolA, noteId: id }) },
  );
}

async function submit(cookie: string, body: unknown, id = noteId) {
  return submitRoute(
    request(
      cookie,
      "POST",
      `/api/schools/${schoolA}/lesson-notes/${id}/submit`,
      body,
    ),
    { params: Promise.resolve({ schoolId: schoolA, noteId: id }) },
  );
}

describe("lesson-note draft, revision and submission isolation", () => {
  beforeAll(async () => {
    for (const [role, email] of Object.entries(emails)) {
      const signedUp = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${role}`, password },
      });
      users[role] = signedUp.user.id;
    }
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Lessons School A", slug: schoolA },
        { id: schoolB, name: "Lessons School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        {
          id: teacherMembershipA,
          schoolId: schoolA,
          userId: users.teacherA,
          role: "TEACHER",
        },
        {
          id: teacherMembershipB,
          schoolId: schoolA,
          userId: users.teacherB,
          role: "TEACHER",
        },
        { schoolId: schoolA, userId: users.admin, role: "SCHOOL_ADMIN" },
        { schoolId: schoolB, userId: users.foreign, role: "TEACHER" },
      ],
    });
    const dates = {
      startsOn: new Date("2026-09-01T00:00:00.000Z"),
      endsOn: new Date("2027-07-31T00:00:00.000Z"),
    };
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
          id: `foreign-session-${tag}`,
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
          schoolId: schoolA,
          sessionId: sessionA,
          name: "First Term",
          position: 1,
          status: "ACTIVE",
          startsOn: dates.startsOn,
          endsOn: new Date("2026-12-18T00:00:00.000Z"),
        },
        {
          id: termB,
          schoolId: schoolB,
          sessionId: `foreign-session-${tag}`,
          name: "First Term",
          position: 1,
          status: "ACTIVE",
          startsOn: dates.startsOn,
          endsOn: new Date("2026-12-18T00:00:00.000Z"),
        },
      ],
    });
    await prisma.schoolClass.create({
      data: { id: classA, schoolId: schoolA, name: "Primary One" },
    });
    await prisma.subject.create({
      data: { id: subjectA, schoolId: schoolA, name: "Mathematics" },
    });
    await prisma.teacherClassSubjectAssignment.createMany({
      data: [
        {
          id: assignmentA,
          schoolId: schoolA,
          sessionId: sessionA,
          membershipId: teacherMembershipA,
          classId: classA,
          subjectId: subjectA,
        },
        {
          id: assignmentB,
          schoolId: schoolA,
          sessionId: sessionA,
          membershipId: teacherMembershipB,
          classId: classA,
          subjectId: subjectA,
        },
      ],
    });
    teacherCookie = await signIn(emails.teacherA);
    otherTeacherCookie = await signIn(emails.teacherB);
    adminCookie = await signIn(emails.admin);
    foreignCookie = await signIn(emails.foreign);
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: Object.values(users) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
  });

  it("conceals lesson writes from anonymous, administrators and foreign teachers", async () => {
    for (const [cookie, status] of [
      ["", 401],
      [adminCookie, 404],
      [foreignCookie, 404],
    ] as const) {
      const result = await create(cookie, {
        termId: termA,
        assignmentId: assignmentA,
        ...draft,
      });
      expect(result.status).toBe(status);
      expect(result.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(
      (
        await create(teacherCookie, {
          termId: termB,
          assignmentId: assignmentA,
          ...draft,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await create(teacherCookie, {
          termId: termA,
          assignmentId: assignmentB,
          ...draft,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await create(teacherCookie, {
          termId: termA,
          assignmentId: assignmentA,
          ...draft,
          schoolId: schoolB,
        })
      ).status,
    ).toBe(400);
    expect(
      await prisma.lessonNote.count({ where: { schoolId: schoolA } }),
    ).toBe(0);
  });

  it("creates an unpublished DRAFT bound to the exact active teaching assignment", async () => {
    const created = await create(teacherCookie, {
      termId: termA,
      assignmentId: assignmentA,
      ...draft,
    });
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    const body = (await created.json()).note;
    noteId = body.id;
    expect(body).toMatchObject({
      schoolId: schoolA,
      sessionId: sessionA,
      termId: termA,
      assignmentId: assignmentA,
      classId: classA,
      subjectId: subjectA,
      currentRevision: 1,
      status: "DRAFT",
      submittedAt: null,
    });
    expect((await list(teacherCookie)).status).toBe(200);
    const own = await detail(teacherCookie);
    expect(own.status).toBe(200);
    const note = (await own.json()).note;
    expect(note.revisions).toHaveLength(1);
    expect(note.revisions[0]).toMatchObject({
      revisionNumber: 1,
      ...draft,
    });
    expect(note.events.map((e: { eventType: string }) => e.eventType)).toEqual([
      "CREATED",
    ]);
    expect((await detail(otherTeacherCookie)).status).toBe(404);
    expect((await detail(adminCookie)).status).toBe(404);
    expect((await detail(foreignCookie, noteId, schoolB)).status).toBe(404);
    expect((await list(otherTeacherCookie)).status).toBe(200);
    expect((await (await list(otherTeacherCookie)).json()).notes).toEqual([]);
  });

  it("revises without overwriting history and rejects stale edits", async () => {
    const revised = await revise(teacherCookie, {
      expectedRevision: 1,
      topic: "Equivalent Fractions",
      objectives: "Learners identify equivalent fractions",
      content: "Compare shaded models and explain equivalent fractions.",
    });
    expect(revised.status).toBe(200);
    expect((await revised.json()).note.currentRevision).toBe(2);
    expect(
      (
        await revise(teacherCookie, {
          expectedRevision: 1,
          ...draft,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await revise(otherTeacherCookie, {
          expectedRevision: 2,
          ...draft,
        })
      ).status,
    ).toBe(404);

    const note = (await (await detail(teacherCookie)).json()).note;
    expect(
      note.revisions.map((x: { revisionNumber: number }) => x.revisionNumber),
    ).toEqual([2, 1]);
    expect(note.revisions[1].content).toBe(draft.content);
    expect(note.events.map((x: { eventType: string }) => x.eventType)).toEqual([
      "CREATED",
      "REVISED",
    ]);
  });

  it("submits an immutable version to review without publishing it", async () => {
    expect((await submit(teacherCookie, { expectedRevision: 1 })).status).toBe(
      409,
    );
    const submitted = await submit(teacherCookie, { expectedRevision: 2 });
    expect(submitted.status).toBe(200);
    expect((await submitted.json()).note).toMatchObject({
      status: "SUBMITTED",
      currentRevision: 2,
    });
    expect((await submit(teacherCookie, { expectedRevision: 2 })).status).toBe(
      409,
    );
    expect(
      (
        await revise(teacherCookie, {
          expectedRevision: 2,
          ...draft,
        })
      ).status,
    ).toBe(409);
    const events = await prisma.lessonNoteEvent.findMany({
      where: { schoolId: schoolA, noteId },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.eventType)).toEqual([
      "CREATED",
      "REVISED",
      "SUBMITTED",
    ]);
    expect(events.every((e) => e.actorUserId === users.teacherA)).toBe(true);
    expect(
      events.every((e) => e.actorMembershipId === teacherMembershipA),
    ).toBe(true);
    expect(events[2].revisionNumber).toBe(2);
  });

  it("rejects tampering with revisions and event history", async () => {
    const revision = await prisma.lessonNoteRevision.findFirstOrThrow({
      where: { schoolId: schoolA, noteId },
    });
    await expect(
      prisma.lessonNoteRevision.update({
        where: { id: revision.id },
        data: { content: "Forcibly altered revision" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.lessonNoteRevision.delete({
        where: { id: revision.id },
      }),
    ).rejects.toThrow();

    const event = await prisma.lessonNoteEvent.findFirstOrThrow({
      where: { schoolId: schoolA, noteId },
    });
    await expect(
      prisma.lessonNoteEvent.update({
        where: { id: event.id },
        data: { revisionNumber: 77 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.lessonNoteEvent.delete({
        where: { id: event.id },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.lessonNoteRevision.count({
        where: { schoolId: schoolA, noteId },
      }),
    ).toBe(2);
  });

  it("disallows reads after assignment revocation or term closure", async () => {
    await prisma.teacherClassSubjectAssignment.update({
      where: { id: assignmentA },
      data: { status: "REVOKED" },
    });
    try {
      expect((await detail(teacherCookie)).status).toBe(404);
      expect((await (await list(teacherCookie)).json()).notes).toEqual([]);
    } finally {
      await prisma.teacherClassSubjectAssignment.update({
        where: { id: assignmentA },
        data: { status: "ACTIVE" },
      });
    }

    await prisma.academicTerm.update({
      where: { id: termA },
      data: { status: "CLOSED" },
    });
    expect((await detail(teacherCookie)).status).toBe(404);
    expect(
      (
        await create(teacherCookie, {
          termId: termA,
          assignmentId: assignmentA,
          ...draft,
        })
      ).status,
    ).toBe(404);
    expect(
      await prisma.lessonNoteRevision.count({
        where: { schoolId: schoolA, noteId },
      }),
    ).toBe(2);
  });
});
