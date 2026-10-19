import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));

import * as submitRoute from "@/app/api/schools/[schoolId]/attendance/route";
import * as decideRoute from "@/app/api/schools/[schoolId]/attendance/[registerId]/decision/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const a = `att-school-a-${tag}`;
const b = `att-school-b-${tag}`;
const session = `att-session-${tag}`;
const primary = `att-section-primary-${tag}`;
const secondary = `att-section-secondary-${tag}`;
const classA = `att-class-a-${tag}`;
const classC = `att-class-c-${tag}`;
const classSecondary = `att-class-s-${tag}`;
const personA = `att-student-a-${tag}`;
const personC = `att-student-c-${tag}`;
const personS = `att-student-s-${tag}`;
const personD = `att-student-d-${tag}`;
const enrollmentA = `att-enroll-a-${tag}`;
const enrollmentC = `att-enroll-c-${tag}`;
const enrollmentS = `att-enroll-s-${tag}`;
const enrollmentD = `att-enroll-d-${tag}`;
const responsibilityA = `att-form-a-${tag}`;
const responsibilityC = `att-form-c-${tag}`;
const responsibilityS = `att-form-s-${tag}`;
const members: Record<string, string> = {};
const users: Record<string, string> = {};
const cookies: Record<string, string> = {};
const email = (key: string) => `att-${key}-${tag}@example.test`;
const password = "synthetic-attendance-password-2026";
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000);
const nextMonth = new Date(Date.now() + 40 * 86400000);
const formData = (classId: string, enrollmentId: string) => ({
  sessionId: session,
  classId,
  attendanceDate: today,
  marks: [{ enrollmentId, mark: "PRESENT" }],
});
let primaryRegister = "";
let secondaryRegister = "";

function request(key: string, path: string, body: unknown) {
  context.headers = new Headers(cookies[key] ? { cookie: cookies[key] } : {});
  return new Request(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
async function submit(key: string, body: unknown, schoolId = a) {
  const path = `/api/schools/${schoolId}/attendance`;
  return submitRoute.POST(request(key, path, body), {
    params: Promise.resolve({ schoolId }),
  });
}
async function review(
  key: string,
  registerId: string,
  action: "APPROVE" | "RETURN",
  schoolId = a,
) {
  const path = `/api/schools/${schoolId}/attendance/${registerId}/decision`;
  return decideRoute.POST(
    request(key, path, {
      action,
      reason: "Synthetic section-scoped review decision",
    }),
    { params: Promise.resolve({ schoolId, registerId }) },
  );
}

describe("Phase 6 tenant-scoped attendance submission and review", () => {
  beforeAll(async () => {
    for (const key of [
      "form",
      "head",
      "principal",
      "foreign",
      "admin",
      "support",
    ]) {
      const user = await auth.api.signUpEmail({
        body: { name: `Synthetic ${key}`, email: email(key), password },
      });
      users[key] = user.user.id;
      const sessionResult = await auth.api.signInEmail({
        body: { email: email(key), password },
        headers: new Headers({ origin: env.BETTER_AUTH_URL }),
        returnHeaders: true,
      });
      cookies[key] = sessionResult.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      if (!cookies[key]) throw new Error("Synthetic test session unavailable");
    }
    await prisma.school.createMany({
      data: [
        {
          id: a,
          name: "Synthetic Attendance A",
          slug: a,
          allowCoFormTeachers: true,
        },
        { id: b, name: "Synthetic Attendance B", slug: b },
      ],
    });
    for (const [key, role, schoolId] of [
      ["form", "FORM_TEACHER", a],
      ["head", "HEAD_OF_SECTION", a],
      ["principal", "PRINCIPAL", a],
      ["foreign", "HEAD_OF_SECTION", b],
      ["admin", "SCHOOL_ADMIN", a],
      ["support", "FORM_TEACHER", a],
    ] as const) {
      const member = await prisma.membership.create({
        data: { userId: users[key], role, schoolId },
      });
      members[key] = member.id;
    }
    await prisma.schoolSection.createMany({
      data: [
        { id: primary, schoolId: a, stage: "PRIMARY", name: "Primary" },
        { id: secondary, schoolId: a, stage: "SECONDARY", name: "Secondary" },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: a, sectionId: primary, name: "A" },
        { id: classC, schoolId: a, sectionId: primary, name: "C" },
        { id: classSecondary, schoolId: a, sectionId: secondary, name: "S" },
      ],
    });
    await prisma.academicSession.create({
      data: {
        id: session,
        schoolId: a,
        name: "Current Synthetic Period",
        startsOn: yesterday,
        endsOn: nextMonth,
        status: "ACTIVE",
      },
    });
    await prisma.studentRecord.createMany({
      data: [
        {
          id: personA,
          schoolId: a,
          admissionNumber: "A-TEST",
          givenName: "Synthetic",
          familyName: "A",
          status: "ENROLLED",
        },
        {
          id: personC,
          schoolId: a,
          admissionNumber: "C-TEST",
          givenName: "Synthetic",
          familyName: "C",
          status: "ENROLLED",
        },
        {
          id: personD,
          schoolId: a,
          admissionNumber: "D-TEST",
          givenName: "Synthetic",
          familyName: "D",
          status: "ENROLLED",
        },
        {
          id: personS,
          schoolId: a,
          admissionNumber: "S-TEST",
          givenName: "Synthetic",
          familyName: "S",
          status: "ENROLLED",
        },
      ],
    });
    await prisma.studentEnrollment.createMany({
      data: [
        {
          id: enrollmentA,
          studentId: personA,
          schoolId: a,
          classId: classA,
          sessionId: session,
        },
        {
          id: enrollmentC,
          studentId: personC,
          schoolId: a,
          classId: classC,
          sessionId: session,
        },
        {
          id: enrollmentD,
          studentId: personD,
          schoolId: a,
          classId: classC,
          sessionId: session,
        },
        {
          id: enrollmentS,
          studentId: personS,
          schoolId: a,
          classId: classSecondary,
          sessionId: session,
        },
      ],
    });
    await prisma.formTeacherResponsibility.createMany({
      data: [
        {
          id: responsibilityA,
          schoolId: a,
          classId: classA,
          sessionId: session,
          membershipId: members.form,
          kind: "PRIMARY",
        },
        {
          id: responsibilityC,
          schoolId: a,
          classId: classC,
          sessionId: session,
          membershipId: members.form,
          kind: "PRIMARY",
        },
        {
          id: responsibilityS,
          schoolId: a,
          classId: classSecondary,
          sessionId: session,
          membershipId: members.form,
          kind: "PRIMARY",
        },
        {
          schoolId: a,
          classId: classA,
          sessionId: session,
          membershipId: members.support,
          kind: "SUPPORT",
        },
      ],
    });
    await prisma.scopeGrant.createMany({
      data: [
        {
          membershipId: members.head,
          type: "SECTION",
          scopeId: primary,
          verified: true,
        },
        {
          membershipId: members.principal,
          type: "SECTION",
          scopeId: secondary,
          verified: true,
        },
        {
          membershipId: members.head,
          type: "SECTION",
          scopeId: secondary,
          verified: true,
        },
        {
          membershipId: members.principal,
          type: "SECTION",
          scopeId: primary,
          verified: false,
        },
        {
          membershipId: members.foreign,
          type: "SECTION",
          scopeId: primary,
          verified: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.school.deleteMany({ where: { id: { in: [a, b] } } });
    await prisma.session.deleteMany({
      where: { userId: { in: Object.values(users) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
  });

  it("exposes no unauthenticated, foreign, support or admin attendance write", async () => {
    const data = formData(classA, enrollmentA);
    for (const [role, status] of [
      ["", 401],
      ["foreign", 404],
      ["admin", 404],
      ["head", 404],
      ["principal", 404],
      ["support", 404],
    ] as const) {
      const response = await submit(role, data);
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect((await submit("form", data, b)).status).toBe(404);
    expect("GET" in submitRoute).toBe(false);
    expect("GET" in decideRoute).toBe(false);
  });

  it("rejects missing marks, duplicate IDs, other-class enrollments and invalid dates", async () => {
    expect(
      (await submit("form", { ...formData(classA, enrollmentA), marks: [] }))
        .status,
    ).toBe(400);
    expect(
      (
        await submit("form", {
          ...formData(classA, enrollmentA),
          marks: [
            { enrollmentId: enrollmentA, mark: "PRESENT" },
            { enrollmentId: enrollmentA, mark: "ABSENT" },
          ],
        })
      ).status,
    ).toBe(400);
    expect((await submit("form", formData(classA, enrollmentS))).status).toBe(
      409,
    );
    expect(
      (
        await submit("form", {
          ...formData(classA, enrollmentA),
          attendanceDate: "2026-02-31",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await submit("form", {
          ...formData(classA, enrollmentA),
          attendanceDate: "1990-01-01",
        })
      ).status,
    ).toBe(404);
    const futureDate = new Date(Date.now() + 5 * 86400000)
      .toISOString()
      .slice(0, 10);
    expect(
      (
        await submit("form", {
          ...formData(classA, enrollmentA),
          attendanceDate: futureDate,
        })
      ).status,
    ).toBe(400);
  });

  it("rejects revoked Form Teacher membership before submission", async () => {
    await prisma.membership.update({
      where: { id: members.form },
      data: { isActive: false },
    });
    try {
      expect((await submit("form", formData(classA, enrollmentA))).status).toBe(
        404,
      );
      expect(
        await prisma.attendanceRegister.count({ where: { schoolId: a } }),
      ).toBe(0);
    } finally {
      await prisma.membership.update({
        where: { id: members.form },
        data: { isActive: true },
      });
    }
  });

  it("submits an exact class/date/session attendance snapshot and immutable author event", async () => {
    const response = await submit("form", formData(classA, enrollmentA));
    expect(response.status).toBe(201);
    const data = (await response.json()).register;
    primaryRegister = data.id;
    expect(data).toMatchObject({
      schoolId: a,
      classId: classA,
      sessionId: session,
      status: "SUBMITTED",
      entryCount: 1,
    });
    expect(JSON.stringify(data)).not.toContain("Synthetic");
    expect(
      (
        await prisma.attendanceEntry.findFirstOrThrow({
          where: { registerId: primaryRegister },
        })
      ).enrollmentId,
    ).toBe(enrollmentA);
    const events = await prisma.attendanceEvent.findMany({
      where: { schoolId: a, registerId: primaryRegister },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorUserId: users.form,
      actorMembershipId: members.form,
      eventType: "SUBMITTED",
    });
    expect((await submit("form", formData(classA, enrollmentA))).status).toBe(
      409,
    );
  });

  it("denies unverified grants, wrong stage and foreign reviewers", async () => {
    expect((await review("principal", primaryRegister, "APPROVE")).status).toBe(
      404,
    );
    expect((await review("foreign", primaryRegister, "APPROVE")).status).toBe(
      404,
    );
    expect((await review("form", primaryRegister, "APPROVE")).status).toBe(404);
    expect((await review("head", primaryRegister, "APPROVE", b)).status).toBe(
      404,
    );
    const grant = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, scopeId: primary },
    });
    await prisma.scopeGrant.update({
      where: { id: grant.id },
      data: { verified: false },
    });
    expect((await review("head", primaryRegister, "APPROVE")).status).toBe(404);
    await prisma.scopeGrant.update({
      where: { id: grant.id },
      data: { verified: true },
    });
  });

  it("approves only once and preserves the recorded marks", async () => {
    const response = await review("head", primaryRegister, "APPROVE");
    expect(response.status).toBe(200);
    expect((await response.json()).register.status).toBe("APPROVED");
    expect((await review("head", primaryRegister, "RETURN")).status).toBe(409);
    const history = await prisma.attendanceEvent.findMany({
      where: { registerId: primaryRegister },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((event) => event.eventType).sort()).toEqual([
      "APPROVED",
      "SUBMITTED",
    ]);
    await expect(
      prisma.attendanceEntry.update({
        where: {
          id: (
            await prisma.attendanceEntry.findFirstOrThrow({
              where: { registerId: primaryRegister },
            })
          ).id,
        },
        data: { mark: "ABSENT" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.attendanceEvent.delete({ where: { id: history[0].id } }),
    ).rejects.toThrow();
    await expect(
      prisma.attendanceEvent.create({
        data: {
          schoolId: a,
          registerId: primaryRegister,
          actorUserId: users.form,
          actorMembershipId: members.form,
          eventType: "RETURNED",
          reason: "Forged unauthorized decision",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.attendanceEntry.create({
        data: {
          schoolId: a,
          registerId: primaryRegister,
          sessionId: session,
          classId: classA,
          enrollmentId: enrollmentA,
          studentId: personA,
          mark: "PRESENT",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe('TRUNCATE TABLE "AttendanceEvent"'),
    ).rejects.toThrow();
  });

  it("permits only the scoped Principal to return a secondary register", async () => {
    const response = await submit(
      "form",
      formData(classSecondary, enrollmentS),
    );
    expect(response.status).toBe(201);
    secondaryRegister = (await response.json()).register.id;
    expect((await review("head", secondaryRegister, "APPROVE")).status).toBe(
      404,
    );
    const approved = await review("principal", secondaryRegister, "RETURN");
    expect(approved.status).toBe(200);
    expect((await approved.json()).register.status).toBe("RETURNED");
  });

  it("refuses a partial class roster rather than defaulting a missing pupil to absent", async () => {
    expect((await submit("form", formData(classC, enrollmentC))).status).toBe(
      409,
    );
    expect(
      await prisma.attendanceRegister.count({
        where: { schoolId: a, classId: classC },
      }),
    ).toBe(0);
  });

  it("rejects a forged SQL submission event with only one of two active pupils", async () => {
    const before = await prisma.attendanceRegister.count({
      where: { schoolId: a, classId: classC, sessionId: session },
    });
    expect(before).toBe(0);
    await expect(
      prisma.$transaction(async (tx) => {
        const register = await tx.attendanceRegister.create({
          data: {
            schoolId: a,
            sessionId: session,
            classId: classC,
            attendanceDate: new Date(`${today}T00:00:00.000Z`),
            submittedByMembershipId: members.form,
            formTeacherResponsibilityId: responsibilityC,
          },
        });
        // This single row is individually valid, but the full class contains
        // TWO active enrolled pupils. The submission audit must deny the
        // incomplete class roster even if a direct database writer skips HTTP.
        await tx.attendanceEntry.create({
          data: {
            schoolId: a,
            registerId: register.id,
            sessionId: session,
            classId: classC,
            enrollmentId: enrollmentC,
            studentId: personC,
            mark: "PRESENT",
          },
        });
        await tx.attendanceEvent.create({
          data: {
            schoolId: a,
            registerId: register.id,
            actorUserId: users.form,
            actorMembershipId: members.form,
            eventType: "SUBMITTED",
          },
        });
      }),
    ).rejects.toThrow();
    expect(
      await prisma.attendanceRegister.count({
        where: { schoolId: a, classId: classC, sessionId: session },
      }),
    ).toBe(0);
    expect(
      await prisma.attendanceEvent.count({
        where: {
          schoolId: a,
          eventType: "SUBMITTED",
          register: { classId: classC, sessionId: session },
        },
      }),
    ).toBe(0);
  });

  it("allows only one of two concurrent exact class/date submissions", async () => {
    context.headers = new Headers({ cookie: cookies.form });
    const input = {
      ...formData(classC, enrollmentC),
      marks: [
        { enrollmentId: enrollmentC, mark: "PRESENT" },
        { enrollmentId: enrollmentD, mark: "ABSENT" },
      ],
    };
    const path = `/api/schools/${a}/attendance`;
    const make = () =>
      submitRoute.POST(
        new Request(`http://localhost${path}`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
        { params: Promise.resolve({ schoolId: a }) },
      );
    const responses = await Promise.all([make(), make()]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await prisma.attendanceRegister.count({
        where: { schoolId: a, classId: classC, sessionId: session },
      }),
    ).toBe(1);
  });
});
