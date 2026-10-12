import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const requestContext = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
}));

import { POST as onboard } from "@/app/api/platform/schools/route";
import { POST as changeLifecycle } from "@/app/api/platform/schools/[schoolId]/lifecycle/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const uid = randomUUID();
const password = "synthetic-platform-lifecycle-password-42";
const adminEmail = `platform-onboard-${uid}@example.test`;
const schoolAdminEmail = `school-onboard-${uid}@example.test`;
const slug = `platform-onboard-${uid}`;
let adminId = "";
let schoolAdminId = "";
let adminCookie = "";
let schoolCookie = "";
let createdSchoolId = "";

async function signIn(email: string) {
  const res = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = res.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Synthetic sign-in cookie missing");
  return cookie;
}

function setCookie(cookie: string) {
  requestContext.headers = new Headers(cookie ? { cookie } : {});
}

async function createSchool(cookie: string, slugValue = slug) {
  setCookie(cookie);
  return onboard(
    new Request("http://localhost/api/platform/schools", {
      method: "POST",
      body: JSON.stringify({ name: "Synthetic Platform School", slug: slugValue }),
    }),
  );
}

async function move(cookie: string, status: string, reason = "Synthetic platform lifecycle test") {
  setCookie(cookie);
  return changeLifecycle(
    new Request(`http://localhost/api/platform/schools/${createdSchoolId}/lifecycle`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),
    { params: Promise.resolve({ schoolId: createdSchoolId }) },
  );
}

describe("platform school onboarding and lifecycle", () => {
  beforeAll(async () => {
    const [platform, schoolAdmin] = await Promise.all([
      auth.api.signUpEmail({
        body: { name: "Platform Test", email: adminEmail, password },
      }),
      auth.api.signUpEmail({
        body: { name: "School Admin Test", email: schoolAdminEmail, password },
      }),
    ]);
    adminId = platform.user.id;
    schoolAdminId = schoolAdmin.user.id;
    await prisma.user.update({
      where: { id: adminId },
      data: { platformRole: "SUPER_ADMIN" },
    });
    adminCookie = await signIn(adminEmail);
    schoolCookie = await signIn(schoolAdminEmail);
  });

  afterAll(async () => {
    if (createdSchoolId) {
      await prisma.school.deleteMany({ where: { id: createdSchoolId } });
    }
    const userIds = [adminId, schoolAdminId].filter(Boolean);
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("denies anonymous and school-only identities", async () => {
    for (const cookie of ["", schoolCookie]) {
      const response = await createSchool(cookie);
      expect(response.status).toBe(cookie ? 404 : 401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(
      await prisma.school.count({ where: { slug } }),
    ).toBe(0);
  });

  it("onboards pending and records audited status changes without academic access", async () => {
    const first = await createSchool(adminCookie);
    expect(first.status).toBe(201);
    const payload = await first.json();
    createdSchoolId = payload.school.id;
    expect(payload.school).toMatchObject({
      slug,
      lifecycleStatus: "PENDING",
      isActive: false,
    });
    const duplicate = await createSchool(adminCookie);
    expect(duplicate.status).toBe(409);

    expect((await move(adminCookie, "ACTIVE")).status).toBe(200);
    const suspend = await move(adminCookie, "SUSPENDED");
    expect(suspend.status).toBe(200);
    expect((await suspend.json()).school).toMatchObject({
      lifecycleStatus: "SUSPENDED",
      isActive: false,
    });
    const repeat = await move(adminCookie, "SUSPENDED");
    expect(repeat.status).toBe(409);
    expect((await move(adminCookie, "ACTIVE")).status).toBe(200);
    const close = await move(adminCookie, "CLOSED");
    expect(close.status).toBe(200);
    expect((await move(adminCookie, "ACTIVE")).status).toBe(409);

    const events = await prisma.schoolLifecycleEvent.findMany({
      where: { schoolId: createdSchoolId },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toHaveLength(5);
    expect(events.map((event) => event.eventType).sort()).toEqual([
      "ACTIVATED",
      "CLOSED",
      "ONBOARDED",
      "REACTIVATED",
      "SUSPENDED",
    ]);
    expect(events.every((event) => event.actorUserId === adminId)).toBe(true);
    const school = await prisma.school.findUniqueOrThrow({
      where: { id: createdSchoolId },
      select: { isActive: true, lifecycleStatus: true },
    });
    expect(school).toMatchObject({
      isActive: false,
      lifecycleStatus: "CLOSED",
    });
  });

  it("preserves append-only lifecycle events", async () => {
    if (!createdSchoolId) throw new Error("Expected previous onboarding fixture");
    const event = await prisma.schoolLifecycleEvent.findFirstOrThrow({
      where: { schoolId: createdSchoolId },
    });
    await expect(
      prisma.schoolLifecycleEvent.update({
        where: { id: event.id },
        data: { reason: "unauthorized audit edit" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.schoolLifecycleEvent.delete({ where: { id: event.id } }),
    ).rejects.toThrow();
  });
});
