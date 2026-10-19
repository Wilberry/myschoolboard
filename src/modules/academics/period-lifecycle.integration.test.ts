import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => ctx.headers,
}));

import { POST as changeSession } from "@/app/api/schools/[schoolId]/academic/sessions/[sessionId]/status/route";
import { POST as changeTerm } from "@/app/api/schools/[schoolId]/academic/sessions/[sessionId]/terms/[termId]/status/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const schoolA = `period-school-a-${tag}`;
const schoolB = `period-school-b-${tag}`;
const sessionA = `period-session-a-${tag}`;
const termA = `period-term-a-${tag}`;
const sessionB = `period-session-b-${tag}`;
const adminEmail = `period-admin-${tag}@example.test`;
const foreignEmail = `period-foreign-${tag}@example.test`;
const password = "synthetic-period-lifecycle-password-42";
let adminId = "";
let otherId = "";
let adminCookie = "";
let otherCookie = "";

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
  if (!cookie) throw new Error("No synthetic session cookie");
  return cookie;
}

function post(
  cookie: string,
  resource: string,
  status: string,
  reason: string,
) {
  ctx.headers = new Headers(cookie ? { cookie } : {});
  return new Request(`http://localhost/api/schools/${schoolA}/${resource}`, {
    method: "POST",
    body: JSON.stringify({ status, reason }),
  });
}

async function sessionStatus(
  cookie: string,
  status: string,
  schoolId = schoolA,
  sessionId = sessionA,
) {
  return changeSession(
    post(
      cookie,
      `academic/sessions/${sessionId}/status`,
      status,
      "Synthetic period change",
    ),
    { params: Promise.resolve({ schoolId, sessionId }) },
  );
}

async function termStatus(
  cookie: string,
  status: string,
  schoolId = schoolA,
  sessionId = sessionA,
  termId = termA,
) {
  return changeTerm(
    post(
      cookie,
      `academic/sessions/${sessionId}/terms/${termId}/status`,
      status,
      "Synthetic term change",
    ),
    { params: Promise.resolve({ schoolId, sessionId, termId }) },
  );
}

describe("academic session and term lifecycle", () => {
  beforeAll(async () => {
    const results = await Promise.all([
      auth.api.signUpEmail({
        body: { name: "Synthetic Period Admin", email: adminEmail, password },
      }),
      auth.api.signUpEmail({
        body: { name: "Foreign Period Admin", email: foreignEmail, password },
      }),
    ]);
    adminId = results[0].user.id;
    otherId = results[1].user.id;
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Period School A", slug: schoolA },
        { id: schoolB, name: "Period School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { userId: adminId, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        { userId: otherId, schoolId: schoolB, role: "SCHOOL_ADMIN" },
      ],
    });
    await prisma.academicSession.createMany({
      data: [
        {
          id: sessionA,
          schoolId: schoolA,
          name: "2026/2027",
          startsOn: new Date("2026-09-01T00:00:00.000Z"),
          endsOn: new Date("2027-07-31T00:00:00.000Z"),
        },
        {
          id: sessionB,
          schoolId: schoolB,
          name: "2026/2027",
          startsOn: new Date("2026-09-01T00:00:00.000Z"),
          endsOn: new Date("2027-07-31T00:00:00.000Z"),
        },
      ],
    });
    await prisma.academicTerm.create({
      data: {
        id: termA,
        schoolId: schoolA,
        sessionId: sessionA,
        name: "First Term",
        position: 1,
        startsOn: new Date("2026-09-01T00:00:00.000Z"),
        endsOn: new Date("2026-12-18T00:00:00.000Z"),
      },
    });
    adminCookie = await signIn(adminEmail);
    otherCookie = await signIn(foreignEmail);
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: [adminId, otherId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, otherId] } },
    });
    await prisma.$disconnect();
  });

  it("denies unauthenticated and foreign administrators", async () => {
    for (const cookie of ["", otherCookie]) {
      const expected = cookie ? 404 : 401;
      expect((await sessionStatus(cookie, "ACTIVE")).status).toBe(expected);
      expect((await termStatus(cookie, "ACTIVE")).status).toBe(expected);
    }
    expect(
      (await sessionStatus(adminCookie, "ACTIVE", schoolA, sessionB)).status,
    ).toBe(404);
  });

  it("rejects activating a term before the session is active", async () => {
    expect((await termStatus(adminCookie, "ACTIVE")).status).toBe(409);
    expect((await sessionStatus(adminCookie, "CLOSED")).status).toBe(409);
  });

  it("activates, closes, and audits periods without rewriting history", async () => {
    const activate = await sessionStatus(adminCookie, "ACTIVE");
    expect(activate.status).toBe(200);
    expect((await activate.json()).session.status).toBe("ACTIVE");

    const termActive = await termStatus(adminCookie, "ACTIVE");
    expect(termActive.status).toBe(200);
    expect((await termActive.json()).term.status).toBe("ACTIVE");

    expect((await sessionStatus(adminCookie, "CLOSED")).status).toBe(409);

    const termClosed = await termStatus(adminCookie, "CLOSED");
    expect(termClosed.status).toBe(200);
    const sessionClosed = await sessionStatus(adminCookie, "CLOSED");
    expect(sessionClosed.status).toBe(200);
    expect((await sessionClosed.json()).session.status).toBe("CLOSED");
    expect((await sessionStatus(adminCookie, "ACTIVE")).status).toBe(409);

    const events = await prisma.schoolConfigurationEvent.findMany({
      where: { schoolId: schoolA },
    });
    expect(events).toHaveLength(4);
    expect(events.every((event) => event.actorUserId === adminId)).toBe(true);
    expect(
      events.every(
        (event) =>
          event.reason === "Synthetic period change" ||
          event.reason === "Synthetic term change",
      ),
    ).toBe(true);
    expect(events.map((event) => event.eventType).sort()).toEqual([
      "ACADEMIC_SESSION_ACTIVATED",
      "ACADEMIC_SESSION_CLOSED",
      "ACADEMIC_TERM_ACTIVATED",
      "ACADEMIC_TERM_CLOSED",
    ]);
  });
});
