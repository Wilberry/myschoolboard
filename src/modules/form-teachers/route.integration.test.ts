import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => ctx.headers,
}));

import { POST as assign } from "@/app/api/schools/[schoolId]/form-teachers/route";
import { POST as handover } from "@/app/api/schools/[schoolId]/form-teachers/[responsibilityId]/handover/route";
import { POST as endRoute } from "@/app/api/schools/[schoolId]/form-teachers/[responsibilityId]/end/route";
import { PATCH as policyRoute } from "@/app/api/schools/[schoolId]/settings/form-teachers/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";

const tag = randomUUID();
const schoolA = `form-school-a-${tag}`;
const schoolB = `form-school-b-${tag}`;
const sessionA = `form-session-a-${tag}`;
const classA = `form-class-a-${tag}`;
const subjectA = `form-subject-a-${tag}`;
const adminMember = `form-admin-member-${tag}`;
const teacherA = `form-teacher-a-${tag}`;
const teacherB = `form-teacher-b-${tag}`;
const userEmails = {
  admin: `form-admin-${tag}@example.test`,
  first: `form-first-${tag}@example.test`,
  second: `form-second-${tag}@example.test`,
  foreign: `form-foreign-${tag}@example.test`,
} as const;
const users: string[] = [];
const password = "synthetic-form-teacher-test-password-42";
let adminCookie = "";
let foreignCookie = "";
let primaryId = "";
let secondUserId = "";

async function signIn(email: string) {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = result.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("No synthetic auth cookie");
  return cookie;
}

function request(cookie: string, body: unknown) {
  ctx.headers = new Headers(cookie ? { cookie } : {});
  return new Request("http://localhost/api/form-teachers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function create(cookie: string, body: unknown, schoolId = schoolA) {
  return assign(request(cookie, body), {
    params: Promise.resolve({ schoolId }),
  });
}

async function transfer(cookie: string, responsibilityId: string, body: unknown) {
  return handover(request(cookie, body), {
    params: Promise.resolve({ schoolId: schoolA, responsibilityId }),
  });
}

async function end(cookie: string, responsibilityId: string, reason: string) {
  return endRoute(request(cookie, { reason }), {
    params: Promise.resolve({ schoolId: schoolA, responsibilityId }),
  });
}

async function changePolicy(cookie: string, enabled: boolean) {
  ctx.headers = new Headers(cookie ? { cookie } : {});
  return policyRoute(
    new Request("http://localhost/api/schools/policy", {
      method: "PATCH",
      body: JSON.stringify({
        allowCoFormTeachers: enabled,
        reason: "Synthetic school policy configuration change",
      }),
    }),
    { params: Promise.resolve({ schoolId: schoolA }) },
  );
}

describe("Form Teacher administration and handover", () => {
  beforeAll(async () => {
    for (const [name, email] of Object.entries(userEmails)) {
      const result = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${name}`, password },
      });
      users.push(result.user.id);
    }
    secondUserId = users[2];
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Form Teacher School A", slug: schoolA },
        { id: schoolB, name: "Form Teacher School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { id: adminMember, schoolId: schoolA, userId: users[0], role: "SCHOOL_ADMIN" },
        { id: teacherA, schoolId: schoolA, userId: users[1], role: "TEACHER" },
        { id: teacherB, schoolId: schoolA, userId: users[2], role: "TEACHER" },
        { schoolId: schoolB, userId: users[3], role: "SCHOOL_ADMIN" },
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
    await prisma.schoolClass.create({
      data: { id: classA, schoolId: schoolA, name: "Form Class" },
    });
    await prisma.subject.create({
      data: { id: subjectA, schoolId: schoolA, name: "Mathematics" },
    });
    adminCookie = await signIn(userEmails.admin);
    foreignCookie = await signIn(userEmails.foreign);
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.session.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  });

  it("rejects unauthorized, foreign-school and forged input", async () => {
    const body = {
      sessionId: sessionA,
      classId: classA,
      teacherMembershipId: teacherA,
      kind: "PRIMARY",
      reason: "Synthetic class coordination",
    };
    expect((await create("", body)).status).toBe(401);
    const teacherCookie = await signIn(userEmails.first);
    expect((await create(teacherCookie, body)).status).toBe(404);
    expect((await create(foreignCookie, body)).status).toBe(404);
    expect((await create(adminCookie, body, schoolB)).status).toBe(404);
    expect((await create(adminCookie, { ...body, classId: "foreign-class-id" })).status).toBe(404);
    expect((await create(adminCookie, { ...body, teacherMembershipId: "foreign-membership-id" })).status).toBe(404);
    expect((await create(adminCookie, { ...body, schoolId: schoolB })).status).toBe(400);
    expect(await prisma.formTeacherEvent.count({
      where: { schoolId: schoolA },
    })).toBe(0);
  });

  it("assigns a primary and atomically hands over responsibility", async () => {
    const assigned = await create(adminCookie, {
      sessionId: sessionA,
      classId: classA,
      teacherMembershipId: teacherA,
      kind: "PRIMARY",
      reason: "Synthetic primary teacher assignment",
    });
    expect(assigned.status).toBe(201);
    primaryId = (await assigned.json()).responsibility.id;
    expect((await create(adminCookie, {
      sessionId: sessionA,
      classId: classA,
      teacherMembershipId: teacherB,
      kind: "PRIMARY",
      reason: "Synthetic duplicate primary",
    })).status).toBe(409);

    const moved = await transfer(adminCookie, primaryId, {
      replacementMembershipId: teacherB,
      reason: "Synthetic staff handover",
    });
    expect(moved.status).toBe(200);
    const next = (await moved.json()).responsibility;
    expect(next).toMatchObject({
      schoolId: schoolA,
      classId: classA,
      sessionId: sessionA,
      membershipId: teacherB,
      kind: "PRIMARY",
      status: "ACTIVE",
    });
    const old = await prisma.formTeacherResponsibility.findUniqueOrThrow({
      where: { id: primaryId },
    });
    expect(old.status).toBe("ENDED");
    expect(old.endedAt).not.toBeNull();
    expect((await transfer(adminCookie, primaryId, {
      replacementMembershipId: teacherA,
      reason: "Repeat handover attempt",
    })).status).toBe(404);

    const events = await prisma.formTeacherEvent.findMany({
      where: { schoolId: schoolA },
    });
    expect(events.map((event) => event.eventType).sort()).toEqual([
      "ASSIGNED",
      "HANDOVER_IN",
      "HANDOVER_OUT",
    ]);
    expect(events.every((event) => event.reason?.length)).toBe(true);
    expect(events.every((event) => event.actorMembershipId === adminMember)).toBe(true);
  });

  it("requires explicit school configuration for co-responsibility", async () => {
    const input = {
      sessionId: sessionA,
      classId: classA,
      teacherMembershipId: teacherA,
      kind: "SUPPORT",
      reason: "Synthetic co responsibility",
    };
    expect((await create(adminCookie, input)).status).toBe(409);
    expect((await changePolicy(foreignCookie, true)).status).toBe(404);
    expect((await changePolicy(adminCookie, true)).status).toBe(200);
    const response = await create(adminCookie, input);
    expect(response.status).toBe(201);
    const support = (await response.json()).responsibility;
    expect(support.kind).toBe("SUPPORT");
    // Prevent silently orphaning an active support teacher.
    expect((await changePolicy(adminCookie, false)).status).toBe(409);
    // The active primary cannot be ended while support exists.
    const primary = await prisma.formTeacherResponsibility.findFirstOrThrow({
      where: {
        schoolId: schoolA,
        sessionId: sessionA,
        classId: classA,
        status: "ACTIVE",
        kind: "PRIMARY",
      },
    });
    expect((await end(adminCookie, primary.id, "Premature primary removal")).status)
      .toBe(409);
    expect((await end(foreignCookie, support.id, "Foreign staff removal")).status)
      .toBe(404);
    const ended = await end(adminCookie, support.id, "End support teaching period");
    expect(ended.status).toBe(200);
    expect((await ended.json()).responsibility.status).toBe("ENDED");
    expect((await changePolicy(adminCookie, false)).status).toBe(200);
    const events = await prisma.formTeacherEvent.findMany({
      where: { schoolId: schoolA, responsibilityId: support.id },
    });
    expect(events.map((event) => event.eventType).sort()).toEqual([
      "ASSIGNED",
      "ENDED",
    ]);
    const policyEvents = await prisma.schoolConfigurationEvent.findMany({
      where: { schoolId: schoolA, eventType: "FORM_TEACHER_POLICY_CHANGED" },
    });
    expect(policyEvents).toHaveLength(2);
    expect(policyEvents.every((event) => event.reason?.length)).toBe(true);
  });

  it("does not grant child access or subject teaching from a Form Teacher relation", async () => {
    const activeFormTeacher = await prisma.formTeacherResponsibility.findFirstOrThrow({
      where: {
        schoolId: schoolA,
        membershipId: teacherB,
        sessionId: sessionA,
        classId: classA,
        kind: "PRIMARY",
        status: "ACTIVE",
      },
    });
    expect(activeFormTeacher.id).toBeTruthy();
    const before = await resolveSchoolPrincipal(secondUserId, schoolA);
    const request = {
      schoolId: schoolA,
      classId: classA,
      subjectId: subjectA,
      sessionId: sessionA,
    };
    expect(authorize(before, "academic:edit", request).allowed).toBe(false);
    expect(authorize(before, "child:read", {
      schoolId: schoolA,
      childUserId: "synthetic-private-child",
    }).allowed).toBe(false);

    await prisma.teacherClassSubjectAssignment.create({
      data: {
        schoolId: schoolA,
        classId: classA,
        subjectId: subjectA,
        membershipId: teacherB,
        sessionId: sessionA,
        status: "ACTIVE",
      },
    });
    const after = await resolveSchoolPrincipal(secondUserId, schoolA);
    expect(authorize(after, "academic:edit", request).allowed).toBe(true);
  });

  it("protects historical Form Teacher events from direct editing", async () => {
    const event = await prisma.formTeacherEvent.findFirstOrThrow({
      where: { schoolId: schoolA },
    });
    await expect(prisma.formTeacherEvent.update({
      where: { id: event.id },
      data: { reason: "tampered" },
    })).rejects.toThrow();
    await expect(prisma.formTeacherEvent.delete({
      where: { id: event.id },
    })).rejects.toThrow();
  });

  it("rejects new responsibilities after the academic session is closed", async () => {
    await prisma.academicSession.update({
      where: { id: sessionA },
      data: { status: "CLOSED" },
    });
    const response = await create(adminCookie, {
      sessionId: sessionA,
      classId: classA,
      teacherMembershipId: teacherA,
      kind: "PRIMARY",
      reason: "Attempted post-session appointment",
    });
    expect(response.status).toBe(404);
  });
});
