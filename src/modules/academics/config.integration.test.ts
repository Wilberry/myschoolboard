import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => ctx.headers,
}));

import { POST as newSession } from "@/app/api/schools/[schoolId]/academic/sessions/route";
import { POST as newTerm } from "@/app/api/schools/[schoolId]/academic/sessions/[sessionId]/terms/route";
import { POST as newClass } from "@/app/api/schools/[schoolId]/classes/route";
import { POST as newSubject } from "@/app/api/schools/[schoolId]/subjects/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const password = "synthetic-academic-config-test-password-42";
const adminEmail = `academic-admin-${tag}@example.test`;
const principalEmail = `academic-principal-${tag}@example.test`;
const otherEmail = `academic-other-${tag}@example.test`;
const schoolA = `academic-school-a-${tag}`;
const schoolB = `academic-school-b-${tag}`;
const memberId = `academic-admin-member-${tag}`;
const userIds: string[] = [];
let adminId = "";
let adminCookie = "";
let principalCookie = "";
let otherCookie = "";

async function signIn(email: string) {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = result.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Synthetic login cookie missing");
  return cookie;
}

function request(cookie: string, url: string, body: unknown) {
  ctx.headers = new Headers(cookie ? { cookie } : {});
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function createSession(
  cookie: string,
  data: unknown,
  schoolId = schoolA,
) {
  return newSession(
    request(
      cookie,
      `http://localhost/api/schools/${schoolId}/academic/sessions`,
      data,
    ),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function createTerm(
  cookie: string,
  sessionId: string,
  data: unknown,
  schoolId = schoolA,
) {
  return newTerm(
    request(
      cookie,
      `http://localhost/api/schools/${schoolId}/academic/sessions/${sessionId}/terms`,
      data,
    ),
    { params: Promise.resolve({ schoolId, sessionId }) },
  );
}

async function createCatalog(
  cookie: string,
  kind: "class" | "subject",
  data: unknown,
  schoolId = schoolA,
) {
  const handler = kind === "class" ? newClass : newSubject;
  return handler(
    request(cookie, `http://localhost/api/schools/${schoolId}/${kind}s`, data),
    { params: Promise.resolve({ schoolId }) },
  );
}

describe("tenant-owned academic configuration routes", () => {
  beforeAll(async () => {
    const results = await Promise.all(
      [
        [adminEmail, "Academic Admin"],
        [principalEmail, "Academic Principal"],
        [otherEmail, "Other-School Admin"],
      ].map(([email, name]) =>
        auth.api.signUpEmail({
          body: { email, name, password },
        }),
      ),
    );
    for (const result of results) userIds.push(result.user.id);
    adminId = results[0].user.id;
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Academic Synthetic School A", slug: schoolA },
        { id: schoolB, name: "Academic Synthetic School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        {
          id: memberId,
          userId: userIds[0],
          schoolId: schoolA,
          role: "SCHOOL_ADMIN",
        },
        { userId: userIds[1], schoolId: schoolA, role: "PRINCIPAL" },
        { userId: userIds[2], schoolId: schoolB, role: "SCHOOL_ADMIN" },
      ],
    });
    adminCookie = await signIn(adminEmail);
    principalCookie = await signIn(principalEmail);
    otherCookie = await signIn(otherEmail);
  }, 45_000);

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
    await prisma.$disconnect();
  });

  it("enforces server-side school:configure on all four creates", async () => {
    const sessionData = {
      name: "2026/2027",
      startsOn: "2026-09-01",
      endsOn: "2027-07-31",
    };
    const termData = {
      name: "First Term",
      position: 1,
      startsOn: "2026-09-01",
      endsOn: "2026-12-18",
    };
    for (const cookie of ["", principalCookie, otherCookie]) {
      const expected = cookie ? 404 : 401;
      const results = [
        await createSession(cookie, sessionData),
        await createTerm(cookie, "unknown-session", termData),
        await createCatalog(cookie, "class", { name: "Class 1" }),
        await createCatalog(cookie, "subject", { name: "Mathematics" }),
      ];
      for (const result of results) {
        expect(result.status).toBe(expected);
        expect(result.headers.get("cache-control")).toBe("private, no-store");
      }
    }
    expect(
      await prisma.schoolConfigurationEvent.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
  });

  it("creates school-owned sessions and terms with audit events", async () => {
    const response = await createSession(adminCookie, {
      name: "2026/2027",
      startsOn: "2026-09-01",
      endsOn: "2027-07-31",
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    const sessionId: string = body.session.id;
    expect(body.session).toMatchObject({
      schoolId: schoolA,
      status: "PLANNED",
    });

    const term = await createTerm(adminCookie, sessionId, {
      name: "First Term",
      position: 1,
      startsOn: "2026-09-01",
      endsOn: "2026-12-18",
    });
    expect(term.status).toBe(201);
    expect((await term.json()).term).toMatchObject({
      sessionId,
      schoolId: schoolA,
      position: 1,
      status: "PLANNED",
    });

    const foreign = await createTerm(
      adminCookie,
      sessionId,
      {
        name: "Second Term",
        position: 2,
        startsOn: "2027-01-01",
        endsOn: "2027-04-01",
      },
      schoolB,
    );
    expect(foreign.status).toBe(404);

    const outOfRange = await createTerm(adminCookie, sessionId, {
      name: "Second Term",
      position: 2,
      startsOn: "2027-08-01",
      endsOn: "2027-08-30",
    });
    expect(outOfRange.status).toBe(400);

    const duplicate = await createTerm(adminCookie, sessionId, {
      name: "Duplicated Position",
      position: 1,
      startsOn: "2027-01-01",
      endsOn: "2027-04-01",
    });
    expect(duplicate.status).toBe(409);

    const events = await prisma.schoolConfigurationEvent.findMany({
      where: { schoolId: schoolA },
    });
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.actorUserId === adminId)).toBe(true);
    expect(events.every((event) => event.actorMembershipId === memberId)).toBe(
      true,
    );
  });

  it("creates class and subject catalogs without mixing tenants", async () => {
    const schoolClass = await createCatalog(adminCookie, "class", {
      name: "Primary One",
    });
    const subject = await createCatalog(adminCookie, "subject", {
      name: "Mathematics",
    });
    expect(schoolClass.status).toBe(201);
    expect(subject.status).toBe(201);
    expect((await schoolClass.json()).class.schoolId).toBe(schoolA);
    expect((await subject.json()).subject.schoolId).toBe(schoolA);

    const duplicate = await createCatalog(adminCookie, "subject", {
      name: "mathematics",
    });
    expect(duplicate.status).toBe(409);

    const forged = await createCatalog(adminCookie, "class", {
      name: "Forged",
      schoolId: schoolB,
    });
    expect(forged.status).toBe(400);
    expect(
      await prisma.schoolConfigurationEvent.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(4);
  });

  it("rejects invalid dates, duplicates, and inactive membership", async () => {
    for (const dates of [
      ["2027-05-01", "2026-09-01"],
      ["2026-02-30", "2026-12-01"],
    ]) {
      const response = await createSession(adminCookie, {
        name: "Invalid Session",
        startsOn: dates[0],
        endsOn: dates[1],
      });
      expect(response.status).toBe(400);
    }
    expect(
      (
        await createSession(adminCookie, {
          name: "2026/2027",
          startsOn: "2026-09-01",
          endsOn: "2027-07-31",
        })
      ).status,
    ).toBe(409);
    await prisma.membership.update({
      where: { id: memberId },
      data: { isActive: false },
    });
    try {
      const denied = await createCatalog(adminCookie, "class", {
        name: "Unauthorized Class",
      });
      expect(denied.status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: memberId },
        data: { isActive: true },
      });
    }
  });

  it("enforces immutable school configuration audit history", async () => {
    const event = await prisma.schoolConfigurationEvent.findFirstOrThrow({
      where: { schoolId: schoolA },
    });
    await expect(
      prisma.schoolConfigurationEvent.update({
        where: { id: event.id },
        data: { resourceId: "tampered" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.schoolConfigurationEvent.delete({
        where: { id: event.id },
      }),
    ).rejects.toThrow();
  });
});
