import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));

import { GET as rosterRoute } from "@/app/api/schools/[schoolId]/attendance/roster/route";
import { GET as queueRoute } from "@/app/api/schools/[schoolId]/attendance-reviews/route";
import { GET as detailRoute } from "@/app/api/schools/[schoolId]/attendance-reviews/[registerId]/route";
import { POST as submitRoute } from "@/app/api/schools/[schoolId]/attendance/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import {
  readFormTeacherAttendanceOptions,
  readAttendanceReviewerOptions,
} from "./navigation";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const school = `att-reads-school-${tag}`;
const foreignSchool = `att-reads-foreign-${tag}`;
const period = `att-reads-session-${tag}`;
const primarySection = `att-reads-primary-${tag}`;
const secondarySection = `att-reads-secondary-${tag}`;
const primaryClass = `att-reads-class-a-${tag}`;
const secondaryClass = `att-reads-class-b-${tag}`;
const primaryStudent = `att-reads-student-a-${tag}`;
const secondaryStudent = `att-reads-student-b-${tag}`;
const primaryEnrollment = `att-reads-enroll-a-${tag}`;
const secondaryEnrollment = `att-reads-enroll-b-${tag}`;
const members: Record<string, string> = {};
const userIds: Record<string, string> = {};
const cookies: Record<string, string> = {};
const password = "synthetic-attendance-read-test-password";
const today = new Date().toISOString().slice(0, 10);
const now = new Date();
let registerPrimary = "";
let registerSecondary = "";

function req(
  actor: string,
  path: string,
  method: "GET" | "POST",
  body?: unknown,
) {
  context.headers = new Headers(
    cookies[actor] ? { cookie: cookies[actor] } : {},
  );
  return new Request(`http://localhost${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function roster(
  actor: string,
  classId = primaryClass,
  sessionId = period,
  schoolId = school,
) {
  const path = `/api/schools/${schoolId}/attendance/roster?classId=${encodeURIComponent(classId)}&sessionId=${encodeURIComponent(sessionId)}`;
  return rosterRoute(req(actor, path, "GET"), {
    params: Promise.resolve({ schoolId }),
  });
}
async function queue(actor: string, schoolId = school) {
  const path = `/api/schools/${schoolId}/attendance-reviews`;
  return queueRoute(req(actor, path, "GET"), {
    params: Promise.resolve({ schoolId }),
  });
}
async function detail(actor: string, registerId: string, schoolId = school) {
  const path = `/api/schools/${schoolId}/attendance-reviews/${registerId}`;
  return detailRoute(req(actor, path, "GET"), {
    params: Promise.resolve({ schoolId, registerId }),
  });
}
async function submit(classId: string, enrollmentId: string) {
  return submitRoute(
    req("form", `/api/schools/${school}/attendance`, "POST", {
      classId,
      sessionId: period,
      attendanceDate: today,
      marks: [{ enrollmentId, mark: "PRESENT" }],
    }),
    { params: Promise.resolve({ schoolId: school }) },
  );
}

describe("Phase 6 private student roster and section-reviewed register reads", () => {
  beforeAll(async () => {
    for (const name of [
      "form",
      "teacher",
      "head",
      "principal",
      "admin",
      "foreign",
    ]) {
      const email = `att-reads-${name}-${tag}@example.test`;
      const created = await auth.api.signUpEmail({
        body: { name: `Synthetic ${name}`, email, password },
      });
      userIds[name] = created.user.id;
      const result = await auth.api.signInEmail({
        body: { email, password },
        headers: new Headers({ origin: env.BETTER_AUTH_URL }),
        returnHeaders: true,
      });
      cookies[name] = result.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
      if (!cookies[name]) throw new Error("Missing synthetic test session");
    }
    await prisma.school.createMany({
      data: [
        { id: school, slug: school, name: "Attendance Read School" },
        { id: foreignSchool, slug: foreignSchool, name: "Foreign School" },
      ],
    });
    for (const [name, role, schoolId] of [
      ["form", "FORM_TEACHER", school],
      ["teacher", "TEACHER", school],
      ["head", "HEAD_OF_SECTION", school],
      ["principal", "PRINCIPAL", school],
      ["admin", "SCHOOL_ADMIN", school],
      ["foreign", "HEAD_OF_SECTION", foreignSchool],
    ] as const) {
      const created = await prisma.membership.create({
        data: { userId: userIds[name], role, schoolId },
      });
      members[name] = created.id;
    }
    await prisma.schoolSection.createMany({
      data: [
        {
          id: primarySection,
          schoolId: school,
          name: "Primary",
          stage: "PRIMARY",
        },
        {
          id: secondarySection,
          schoolId: school,
          name: "Secondary",
          stage: "SECONDARY",
        },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        {
          id: primaryClass,
          schoolId: school,
          sectionId: primarySection,
          name: "Primary One",
        },
        {
          id: secondaryClass,
          schoolId: school,
          sectionId: secondarySection,
          name: "Secondary One",
        },
      ],
    });
    await prisma.academicSession.create({
      data: {
        id: period,
        schoolId: school,
        name: "Current Synthetic Session",
        startsOn: new Date(now.getTime() - 86400000),
        endsOn: new Date(now.getTime() + 30 * 86400000),
        status: "ACTIVE",
      },
    });
    await prisma.studentRecord.createMany({
      data: [
        {
          id: primaryStudent,
          schoolId: school,
          admissionNumber: "RD-A-001",
          givenName: "Synthetic",
          familyName: "Primary",
          status: "ENROLLED",
        },
        {
          id: secondaryStudent,
          schoolId: school,
          admissionNumber: "RD-B-001",
          givenName: "Synthetic",
          familyName: "Secondary",
          status: "ENROLLED",
        },
      ],
    });
    await prisma.studentEnrollment.createMany({
      data: [
        {
          id: primaryEnrollment,
          schoolId: school,
          sessionId: period,
          classId: primaryClass,
          studentId: primaryStudent,
        },
        {
          id: secondaryEnrollment,
          schoolId: school,
          sessionId: period,
          classId: secondaryClass,
          studentId: secondaryStudent,
        },
      ],
    });
    await prisma.formTeacherResponsibility.createMany({
      data: [
        {
          schoolId: school,
          sessionId: period,
          classId: primaryClass,
          membershipId: members.form,
          kind: "PRIMARY",
        },
        {
          schoolId: school,
          sessionId: period,
          classId: secondaryClass,
          membershipId: members.form,
          kind: "PRIMARY",
        },
      ],
    });
    await prisma.scopeGrant.createMany({
      data: [
        {
          membershipId: members.head,
          type: "SECTION",
          scopeId: primarySection,
          verified: true,
        },
        {
          membershipId: members.head,
          type: "SECTION",
          scopeId: secondarySection,
          verified: true,
        },
        {
          membershipId: members.principal,
          type: "SECTION",
          scopeId: secondarySection,
          verified: true,
        },
        {
          membershipId: members.principal,
          type: "SECTION",
          scopeId: primarySection,
          verified: false,
        },
        {
          membershipId: members.foreign,
          type: "SECTION",
          scopeId: primarySection,
          verified: true,
        },
      ],
    });
  }, 45_000);
  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [school, foreignSchool] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: Object.values(userIds) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(userIds) } },
    });
    await prisma.$disconnect();
  });

  it("server-rendered navigation derives only exact active role relationships", async () => {
    const teacherOptions = await readFormTeacherAttendanceOptions(
      userIds.form,
      school,
    );
    expect(teacherOptions?.classes.map((x) => x.classId).sort()).toEqual(
      [primaryClass, secondaryClass].sort(),
    );
    expect(
      await readFormTeacherAttendanceOptions(userIds.teacher, school),
    ).toBeNull();
    expect(
      await readFormTeacherAttendanceOptions(userIds.admin, school),
    ).toBeNull();
    expect(
      await readFormTeacherAttendanceOptions(userIds.form, foreignSchool),
    ).toBeNull();

    const reviewerOptions = await readAttendanceReviewerOptions(
      userIds.head,
      school,
    );
    expect(reviewerOptions?.sectionNames).toEqual(["Primary"]);
    expect(
      (await readAttendanceReviewerOptions(userIds.principal, school))
        ?.sectionNames,
    ).toEqual(["Secondary"]);
    expect(
      await readAttendanceReviewerOptions(userIds.admin, school),
    ).toBeNull();
    expect(
      await readAttendanceReviewerOptions(userIds.foreign, school),
    ).toBeNull();
  });

  it("allows exact active Form Teacher roster with only permitted minimum fields", async () => {
    const response = await roster("form");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const row = (await response.json()).roster;
    expect(row.classId).toBe(primaryClass);
    expect(row.roster).toHaveLength(1);
    expect(row.roster[0]).toMatchObject({
      enrollmentId: primaryEnrollment,
      studentId: primaryStudent,
      admissionNumber: "RD-A-001",
      givenName: "Synthetic",
      familyName: "Primary",
    });
    expect(JSON.stringify(row)).not.toContain(secondaryStudent);
    expect(JSON.stringify(row)).not.toContain("Secondary");
  });

  it("denies anonymous, unrelated subject teacher, reviewer, admin and foreign roster reads", async () => {
    for (const [actor, expected] of [
      ["", 401],
      ["teacher", 404],
      ["head", 404],
      ["principal", 404],
      ["admin", 404],
      ["foreign", 404],
    ] as const) {
      expect((await roster(actor)).status).toBe(expected);
    }
    expect(
      (await roster("form", primaryClass, period, foreignSchool)).status,
    ).toBe(404);
    expect((await roster("form", "guessed-class")).status).toBe(404);
  });

  it("rejects duplicate, extra and missing roster query parameters", async () => {
    const path = `/api/schools/${school}/attendance/roster?classId=${primaryClass}&classId=other&sessionId=${period}`;
    const response = await rosterRoute(req("form", path, "GET"), {
      params: Promise.resolve({ schoolId: school }),
    });
    expect(response.status).toBe(400);
    expect((await roster("form", primaryClass, "bad session")).status).toBe(
      404,
    );
  });

  it("refuses inactive Form Teacher membership even for an otherwise exact class", async () => {
    await prisma.membership.update({
      where: { id: members.form },
      data: { isActive: false },
    });
    try {
      expect((await roster("form")).status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: members.form },
        data: { isActive: true },
      });
    }
  });

  it("denies nonreviewers even for an empty review queue", async () => {
    expect((await queue("")).status).toBe(401);
    for (const name of ["form", "teacher", "admin", "foreign"]) {
      expect((await queue(name)).status).toBe(404);
    }
    expect((await queue("head", foreignSchool)).status).toBe(404);
    expect((await queue("head")).status).toBe(200);
  });

  it("returns only stage-authorized pending registers; queue excludes pupil data", async () => {
    const a = await submit(primaryClass, primaryEnrollment);
    const b = await submit(secondaryClass, secondaryEnrollment);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    registerPrimary = (await a.json()).register.id;
    registerSecondary = (await b.json()).register.id;
    const primaryQueue = await queue("head");
    expect(primaryQueue.status).toBe(200);
    const primaryJson = await primaryQueue.json();
    expect(primaryJson.registers.map((r: { id: string }) => r.id)).toEqual([
      registerPrimary,
    ]);
    expect(JSON.stringify(primaryJson)).not.toContain("RD-A-001");
    expect(JSON.stringify(primaryJson)).not.toContain(primaryStudent);
    const secondaryQueue = await queue("principal");
    expect(
      (await secondaryQueue.json()).registers.map((r: { id: string }) => r.id),
    ).toEqual([registerSecondary]);
  });

  it("returns student marks only through the exact verified reviewer detail", async () => {
    expect((await detail("head", registerSecondary)).status).toBe(404);
    expect((await detail("principal", registerPrimary)).status).toBe(404);
    expect((await detail("form", registerPrimary)).status).toBe(404);
    expect((await detail("foreign", registerPrimary)).status).toBe(404);
    const response = await detail("head", registerPrimary);
    expect(response.status).toBe(200);
    const row = (await response.json()).register;
    expect(row.entries).toHaveLength(1);
    expect(row.entries[0]).toMatchObject({
      enrollmentId: primaryEnrollment,
      admissionNumber: "RD-A-001",
      mark: "PRESENT",
    });
    expect(JSON.stringify(row)).not.toContain(secondaryStudent);
  });

  it("removes queue and detail access immediately after scope grant revocation", async () => {
    const scope = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, scopeId: primarySection },
    });
    await prisma.scopeGrant.update({
      where: { id: scope.id },
      data: { verified: false },
    });
    try {
      expect((await queue("head")).status).toBe(404);
      expect((await detail("head", registerPrimary)).status).toBe(404);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: scope.id },
        data: { verified: true },
      });
    }
  });
});
