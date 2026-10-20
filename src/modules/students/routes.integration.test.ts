import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => ctx.headers,
}));

import * as studentRoute from "@/app/api/schools/[schoolId]/students/route";
import { POST as enrollRoute } from "@/app/api/schools/[schoolId]/students/[studentId]/enrollments/route";
import { POST as withdrawRoute } from "@/app/api/schools/[schoolId]/students/[studentId]/enrollments/[enrollmentId]/withdraw/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const schoolA = `students-a-${tag}`;
const schoolB = `students-b-${tag}`;
const sessionA = `students-session-a-${tag}`;
const sessionPlanned = `students-session-planned-${tag}`;
const sessionB = `students-session-b-${tag}`;
const sectionA = `students-section-a-${tag}`;
const classA = `students-class-a-${tag}`;
const classUnclassified = `students-unclassified-${tag}`;
const classB = `students-class-b-${tag}`;
const password = "synthetic-student-ledger-test-42";
const emails = {
  admin: `students-admin-${tag}@example.test`,
  foreign: `students-foreign-${tag}@example.test`,
  teacher: `students-teacher-${tag}@example.test`,
};
const users: Record<string, string> = {};
const cookies: Record<string, string> = {};
let studentId = "";
let enrollmentId = "";

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
  if (!cookie) throw new Error("Synthetic auth cookie missing");
  return cookie;
}

function request(person: string, url: string, body: unknown) {
  ctx.headers = new Headers(cookies[person] ? { cookie: cookies[person] } : {});
  return new Request(`http://localhost${url}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const newStudent = {
  admissionNumber: "sT-2026-001",
  givenName: "Synthetic",
  familyName: "Pupil",
  reason: "Synthetic admission record",
};

async function register(person: string, input: unknown, schoolId = schoolA) {
  return studentRoute.POST(
    request(person, `/api/schools/${schoolId}/students`, input),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function enroll(
  person: string,
  input: unknown,
  id = studentId,
  schoolId = schoolA,
) {
  return enrollRoute(
    request(
      person,
      `/api/schools/${schoolId}/students/${id}/enrollments`,
      input,
    ),
    { params: Promise.resolve({ schoolId, studentId: id }) },
  );
}

async function withdraw(
  person: string,
  body: unknown,
  id = studentId,
  enrollment = enrollmentId,
  schoolId = schoolA,
) {
  return withdrawRoute(
    request(
      person,
      `/api/schools/${schoolId}/students/${id}/enrollments/${enrollment}/withdraw`,
      body,
    ),
    {
      params: Promise.resolve({
        schoolId,
        studentId: id,
        enrollmentId: enrollment,
      }),
    },
  );
}

describe("tenant-scoped student registration and enrollment ledger", () => {
  beforeAll(async () => {
    for (const [role, email] of Object.entries(emails)) {
      const user = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${role}`, password },
      });
      users[role] = user.user.id;
      cookies[role] = await signIn(email);
    }
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Student Test School A", slug: schoolA },
        { id: schoolB, name: "Student Test School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { schoolId: schoolA, userId: users.admin, role: "SCHOOL_ADMIN" },
        { schoolId: schoolB, userId: users.foreign, role: "SCHOOL_ADMIN" },
        { schoolId: schoolA, userId: users.teacher, role: "TEACHER" },
      ],
    });
    await prisma.schoolSection.create({
      data: {
        id: sectionA,
        schoolId: schoolA,
        name: "Primary",
        stage: "PRIMARY",
      },
    });
    await prisma.schoolClass.createMany({
      data: [
        {
          id: classA,
          schoolId: schoolA,
          name: "Class One",
          sectionId: sectionA,
        },
        { id: classUnclassified, schoolId: schoolA, name: "No Section" },
        { id: classB, schoolId: schoolB, name: "Foreign Class" },
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
          id: sessionPlanned,
          schoolId: schoolA,
          name: "2027/2028",
          status: "PLANNED",
          startsOn: new Date("2027-09-01T00:00:00.000Z"),
          endsOn: new Date("2028-07-31T00:00:00.000Z"),
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
  }, 45_000);

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

  it("conceals registration and enrollment from anonymous, teacher and foreign actors", async () => {
    for (const [person, expected] of [
      ["", 401],
      ["teacher", 404],
      ["foreign", 404],
    ] as const) {
      const response = await register(person, newStudent);
      expect(response.status).toBe(expected);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(
        (
          await enroll(
            person,
            {
              sessionId: sessionA,
              classId: classA,
              reason: "Synthetic enrollment",
            },
            "forged-student",
          )
        ).status,
      ).toBe(expected);
    }
    expect((await register("admin", newStudent, schoolB)).status).toBe(404);
    expect(
      await prisma.studentRecord.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
    expect("GET" in studentRoute).toBe(false);
  });

  it("registers a student privately and enforces school-specific admission numbers", async () => {
    const created = await register("admin", newStudent);
    expect(created.status).toBe(201);
    const body = (await created.json()).student;
    expect(body).toMatchObject({
      schoolId: schoolA,
      admissionNumber: "ST-2026-001",
      status: "REGISTERED",
    });
    expect(body.givenName).toBeUndefined();
    expect(body.familyName).toBeUndefined();
    studentId = body.id;
    expect((await register("admin", newStudent)).status).toBe(409);
    expect((await register("foreign", newStudent, schoolB)).status).toBe(201);
    const event = await prisma.studentEvent.findFirstOrThrow({
      where: { schoolId: schoolA, studentId },
    });
    expect(event).toMatchObject({
      eventType: "REGISTERED",
      actorUserId: users.admin,
      enrollmentId: null,
    });
  });

  it("requires an ACTIVE same-school session and classified class", async () => {
    const input = {
      sessionId: sessionA,
      classId: classA,
      reason: "Enroll synthetic pupil in this class",
    };
    expect(
      (await enroll("admin", { ...input, sessionId: sessionPlanned })).status,
    ).toBe(404);
    expect(
      (await enroll("admin", { ...input, sessionId: sessionB })).status,
    ).toBe(404);
    expect((await enroll("admin", { ...input, classId: classB })).status).toBe(
      404,
    );
    expect(
      (await enroll("admin", { ...input, classId: classUnclassified })).status,
    ).toBe(404);
    expect(
      (await enroll("admin", { ...input, studentId: "forged" })).status,
    ).toBe(400);
    expect((await enroll("admin", input, studentId, schoolB)).status).toBe(404);

    const enrolled = await enroll("admin", input);
    expect(enrolled.status).toBe(201);
    const record = (await enrolled.json()).enrollment;
    enrollmentId = record.id;
    expect(record).toMatchObject({
      schoolId: schoolA,
      studentId,
      classId: classA,
      sessionId: sessionA,
      status: "ACTIVE",
    });
    expect(
      await prisma.studentRecord.findUnique({
        where: { id: studentId },
        select: { status: true },
      }),
    ).toEqual({ status: "ENROLLED" });
    expect((await enroll("admin", input)).status).toBe(404);
  });

  it("rejects duplicate ACTIVE student/session rows and foreign composite relations", async () => {
    await expect(
      prisma.studentEnrollment.create({
        data: {
          schoolId: schoolA,
          studentId,
          sessionId: sessionA,
          classId: classA,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.studentEnrollment.create({
        data: {
          schoolId: schoolB,
          studentId,
          sessionId: sessionB,
          classId: classB,
        },
      }),
    ).rejects.toThrow();
    const records = await prisma.studentEnrollment.findMany({
      where: { schoolId: schoolA, studentId },
    });
    expect(records).toHaveLength(1);
  });

  it("withdraws only the exact active enrollment, retaining its class and session", async () => {
    const reason = { reason: "Recorded synthetic pupil withdrawal" };
    expect((await withdraw("teacher", reason)).status).toBe(404);
    expect((await withdraw("foreign", reason)).status).toBe(404);
    expect((await withdraw("", reason)).status).toBe(401);
    expect(
      (await withdraw("admin", reason, studentId, "foreign-enrollment")).status,
    ).toBe(404);
    const response = await withdraw("admin", reason);
    expect(response.status).toBe(200);
    expect((await response.json()).enrollment).toMatchObject({
      id: enrollmentId,
      studentId,
      sessionId: sessionA,
      classId: classA,
      status: "ENDED",
    });
    expect((await withdraw("admin", reason)).status).toBe(404);
    const history = await prisma.studentEnrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
    });
    expect(history.endedAt).not.toBeNull();
    expect(history.classId).toBe(classA);
    expect(history.sessionId).toBe(sessionA);
    expect(
      (
        await prisma.studentRecord.findUniqueOrThrow({
          where: { id: studentId },
        })
      ).status,
    ).toBe("WITHDRAWN");
  });

  it("preserves append-only actor/event history and rejects forged mutations", async () => {
    const events = await prisma.studentEvent.findMany({
      where: { schoolId: schoolA, studentId },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.eventType).sort()).toEqual([
      "ENROLLED",
      "REGISTERED",
      "WITHDRAWN",
    ]);
    expect(events.every((e) => e.actorUserId === users.admin)).toBe(true);
    expect(events.every((e) => e.reason.length >= 5)).toBe(true);

    const event = events[0];
    await expect(
      prisma.studentEvent.update({
        where: { id: event.id },
        data: { reason: "forcibly changed history" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.studentEvent.delete({
        where: { id: event.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.studentEvent.create({
        data: {
          schoolId: schoolA,
          studentId,
          enrollmentId,
          actorUserId: users.foreign,
          actorMembershipId: "forged-foreign-school-membership",
          eventType: "WITHDRAWN",
          reason: "Attempted forged student history",
        },
      }),
    ).rejects.toThrow();
    expect(
      await prisma.studentEvent.count({
        where: { schoolId: schoolA, studentId },
      }),
    ).toBe(3);
  });
});
