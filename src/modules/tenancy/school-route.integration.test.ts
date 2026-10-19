import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const routeContext = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({
  headers: async () => routeContext.headers,
}));

import { GET } from "../../../app/api/schools/[schoolId]/route";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";
import { prisma } from "@/src/lib/db";

const testId = randomUUID();
const userAEmail = `school-route-a-${testId}@example.test`;
const userBEmail = `school-route-b-${testId}@example.test`;
const password = "synthetic-route-test-password-42";
const schoolA = `route-school-a-${testId}`;
const schoolB = `route-school-b-${testId}`;
const schoolC = `route-school-c-${testId}`;

let userAId: string | undefined;
let userBId: string | undefined;
const createdUserIds = new Set<string>();

async function signIn(email: string): Promise<string> {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });

  const cookies = result.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

  if (!cookies) throw new Error("Sign-in did not issue a session cookie");
  return cookies;
}

function setCookie(cookie = "") {
  routeContext.headers = new Headers(cookie ? { cookie } : {});
}

async function getSchool(schoolId: string, cookie = "") {
  setCookie(cookie);
  return GET(new Request(`http://localhost/api/schools/${schoolId}`), {
    params: Promise.resolve({ schoolId }),
  });
}

describe("school API route authorization", () => {
  beforeAll(async () => {
    const signupResults = await Promise.allSettled([
      auth.api.signUpEmail({
        body: { name: "Synthetic Route User A", email: userAEmail, password },
      }),
      auth.api.signUpEmail({
        body: { name: "Synthetic Route User B", email: userBEmail, password },
      }),
    ]);

    for (const result of signupResults) {
      if (result.status !== "fulfilled") continue;

      createdUserIds.add(result.value.user.id);
      if (!userAId) userAId = result.value.user.id;
      else if (!userBId) userBId = result.value.user.id;
    }

    const rejectedSignups = signupResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (rejectedSignups.length > 0) {
      throw rejectedSignups[0].reason;
    }

    await prisma.school.createMany({
      data: [
        {
          id: schoolA,
          name: "Synthetic Authorized School",
          slug: `${schoolA}-slug`,
        },
        {
          id: schoolB,
          name: "Synthetic Other School",
          slug: `${schoolB}-slug`,
        },
        {
          id: schoolC,
          name: "Synthetic Parent School",
          slug: `${schoolC}-slug`,
        },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { userId: userAId!, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        { userId: userBId!, schoolId: schoolB, role: "SCHOOL_ADMIN" },
        { userId: userAId!, schoolId: schoolC, role: "PARENT" },
      ],
    });
  });

  beforeEach(async () => {
    await prisma.membership.updateMany({
      where: { userId: userAId, schoolId: schoolA },
      data: { isActive: true, role: "SCHOOL_ADMIN" },
    });
    await prisma.school.updateMany({
      where: { id: schoolA },
      data: { isActive: true },
    });
  });

  afterAll(async () => {
    const userIds = Array.from(createdUserIds);
    const schoolIds = [schoolA, schoolB, schoolC];

    const cleanupSteps = [
      {
        name: "sessions",
        operation: async () => {
          if (userIds.length === 0) return;
          await prisma.session.deleteMany({
            where: { userId: { in: userIds } },
          });
        },
      },
      {
        name: "memberships",
        operation: async () => {
          if (userIds.length === 0 || schoolIds.length === 0) return;
          await prisma.membership.deleteMany({
            where: {
              OR: [
                { userId: { in: userIds } },
                { schoolId: { in: schoolIds } },
              ],
            },
          });
        },
      },
      {
        name: "schools",
        operation: async () => {
          await prisma.school.deleteMany({
            where: { id: { in: schoolIds } },
          });
        },
      },
      {
        name: "users",
        operation: async () => {
          if (userIds.length === 0) return;
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        },
      },
    ];

    const cleanupErrors: string[] = [];
    for (const step of cleanupSteps) {
      try {
        await step.operation();
      } catch (error) {
        cleanupErrors.push(
          `${step.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (cleanupErrors.length > 0) {
      console.warn(
        "School route test cleanup warnings:\n" + cleanupErrors.join("\n"),
      );
    }

    try {
      await prisma.$disconnect();
    } catch (error) {
      console.warn(
        "School route test disconnect warning: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  });

  it("rejects a request with no session without returning school data", async () => {
    const response = await getSchool(schoolA);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects an invalid session cookie without returning school data", async () => {
    const response = await getSchool(
      schoolA,
      "myschoolboard.session_token=invalid-session-token",
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects a real session after its database expiry", async () => {
    const cookie = await signIn(userAEmail);
    const session = await prisma.session.findFirst({
      where: { userId: userAId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!session) throw new Error("Sign-in did not create a database session");

    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const response = await getSchool(schoolA, cookie);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects the same cookie after session revocation", async () => {
    const cookie = await signIn(userAEmail);
    const initiallyAuthorized = await getSchool(schoolA, cookie);
    expect(initiallyAuthorized.status).toBe(200);

    const liveSession = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    if (!liveSession) {
      throw new Error("Expected a valid session before revocation");
    }

    await prisma.session.delete({
      where: { id: liveSession.session.id },
    });

    const revoked = await getSchool(schoolA, cookie);
    expect(revoked.status).toBe(401);
    expect(revoked.headers.get("cache-control")).toBe("private, no-store");
    expect(await revoked.json()).toEqual({ error: "Unauthorized" });
  });

  it("does not grant school access from platform status alone", async () => {
    const cookie = await signIn(userBEmail);
    if (!userBId) throw new Error("Missing synthetic second user");

    await prisma.user.update({
      where: { id: userBId },
      data: { platformRole: "SUPER_ADMIN" },
    });

    try {
      const otherSchool = await getSchool(schoolA, cookie);
      expect(otherSchool.status).toBe(404);
      expect(otherSchool.headers.get("cache-control")).toBe(
        "private, no-store",
      );
      expect(await otherSchool.json()).toEqual({ error: "Not found" });
    } finally {
      await prisma.user.update({
        where: { id: userBId },
        data: { platformRole: "NONE" },
      });
    }
  });

  it("returns only minimal school details to a valid active member", async () => {
    const cookie = await signIn(userAEmail);
    const response = await getSchool(schoolA, cookie);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      school: {
        id: schoolA,
        name: "Synthetic Authorized School",
        slug: `${schoolA}-slug`,
      },
    });
  });

  it("denies access to a school belonging to another user", async () => {
    const cookie = await signIn(userAEmail);
    const response = await getSchool(schoolB, cookie);
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).not.toContain("Synthetic Other School");
    expect(body).not.toContain(`${schoolB}-slug`);
  });

  it("logs a sanitized denial event for cross-school and missing resources", async () => {
    const cookie = await signIn(userAEmail);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const crossSchool = await getSchool(schoolB, cookie);
      const missing = await getSchool("not-a-real-school-id", cookie);

      for (const response of [crossSchool, missing]) {
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(await response.json()).toEqual({ error: "Not found" });
      }
      expect(warn).toHaveBeenCalledTimes(2);
      const entries = warn.mock.calls.map(
        ([entry]) => JSON.parse(String(entry)) as Record<string, string>,
      );
      for (const entry of entries) {
        expect(Object.keys(entry).sort()).toEqual(["event", "requestId"]);
        expect(entry.event).toBe("school_read_denied");
        expect(entry.requestId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(JSON.stringify(entry)).not.toContain(schoolA);
        expect(JSON.stringify(entry)).not.toContain(schoolB);
        expect(JSON.stringify(entry)).not.toContain(userAEmail);
      }
      expect(entries[0].requestId).not.toBe(entries[1].requestId);
    } finally {
      warn.mockRestore();
    }
  });

  it("preserves concealed denials when the security logger throws", async () => {
    const cookie = await signIn(userAEmail);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("synthetic security logging failure");
    });

    try {
      const response = await getSchool(schoolB, cookie);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Not found" });
    } finally {
      warn.mockRestore();
    }
  });

  it("safely rejects missing and unknown school IDs", async () => {
    const cookie = await signIn(userAEmail);

    for (const schoolId of ["", "not-a-real-school-id"]) {
      const response = await getSchool(schoolId, cookie);

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("Synthetic");
    }
  });

  it("denies a member whose role cannot read the requested school", async () => {
    const cookie = await signIn(userAEmail);
    const response = await getSchool(schoolC, cookie);
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).not.toContain("Synthetic Parent School");
  });

  it("denies access after the membership is revoked", async () => {
    const cookie = await signIn(userAEmail);
    await prisma.membership.updateMany({
      where: { userId: userAId, schoolId: schoolA },
      data: { isActive: false },
    });

    const response = await getSchool(schoolA, cookie);

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Synthetic Authorized School");
  });

  it("denies an inactive school despite an active school membership", async () => {
    const cookie = await signIn(userAEmail);
    await prisma.school.update({
      where: { id: schoolA },
      data: { isActive: false },
    });

    const response = await getSchool(schoolA, cookie);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("denies access after a school administrator loses their reader role", async () => {
    const cookie = await signIn(userAEmail);
    await prisma.membership.updateMany({
      where: { userId: userAId, schoolId: schoolA },
      data: { role: "PARENT" },
    });

    const response = await getSchool(schoolA, cookie);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("rechecks the authenticated membership and role in its final school query", async () => {
    const cookie = await signIn(userAEmail);
    const findSchool = vi.spyOn(prisma.school, "findFirst");

    try {
      const response = await getSchool(schoolA, cookie);
      expect(response.status).toBe(200);
      expect(findSchool).toHaveBeenCalledWith({
        where: {
          id: schoolA,
          isActive: true,
          memberships: {
            some: {
              userId: userAId,
              isActive: true,
              role: "SCHOOL_ADMIN",
            },
          },
        },
        select: { id: true, name: true, slug: true },
      });
    } finally {
      findSchool.mockRestore();
    }
  });

  it("uses the path school ID and ignores a substituted query ID", async () => {
    const cookie = await signIn(userAEmail);
    setCookie(cookie);
    const response = await GET(
      new Request(
        `http://localhost/api/schools/${schoolA}?schoolId=${schoolB}`,
      ),
      { params: Promise.resolve({ schoolId: schoolA }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ school: { id: schoolA } });
  });

  it("fails closed with a generic response when membership lookup fails", async () => {
    const cookie = await signIn(userAEmail);
    const lookup = vi
      .spyOn(prisma.membership, "findFirst")
      .mockRejectedValueOnce(new Error("synthetic database failure"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await getSchool(schoolA, cookie);

      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        error: "Request could not be completed",
      });
    } finally {
      lookup.mockRestore();
      errorLog.mockRestore();
    }
  });

  it("keeps a generic error when logging throws", async () => {
    const cookie = await signIn(userAEmail);
    const lookup = vi
      .spyOn(prisma.membership, "findFirst")
      .mockRejectedValueOnce(new Error("synthetic lookup failure"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {
      throw new Error("synthetic logging failure");
    });

    try {
      const response = await getSchool(schoolA, cookie);
      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        error: "Request could not be completed",
      });
    } finally {
      lookup.mockRestore();
      errorLog.mockRestore();
    }
  });
});
