import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const requestContext = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
}));

import * as planRoute from "@/app/api/platform/plans/route";
import * as periodsRoute from "@/app/api/platform/schools/[schoolId]/subscriptions/route";
import * as statusRoute from "@/app/api/platform/schools/[schoolId]/subscription-status/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const uid = randomUUID();
const password = "synthetic-platform-subscription-password-42";
const adminEmail = `platform-subs-${uid}@example.test`;
const userEmail = `school-subs-${uid}@example.test`;
const code = `test-plan-${uid.slice(0, 16)}`;
const schoolId = `subscription-school-${uid}`;
const foreignSchoolId = `subscription-foreign-${uid}`;
const observedSchoolId = `subscription-observed-${uid}`;
let adminId = "";
let schoolUserId = "";
let platformCookie = "";
let schoolCookie = "";
let firstPlanId = "";
let secondPlanId = "";
let periodId = "";

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
  if (!cookie) throw new Error("Synthetic sign-in cookie missing");
  return cookie;
}

function asActor(cookie: string) {
  requestContext.headers = new Headers(cookie ? { cookie } : {});
}

function planPayload(overrides: Record<string, unknown> = {}) {
  return {
    code,
    name: "Synthetic school essentials",
    features: ["ATTENDANCE", "LESSONS"],
    maxStudents: 500,
    maxStaff: 80,
    reason: "Create immutable synthetic test plan revision",
    ...overrides,
  };
}

async function planPost(cookie: string, body: unknown) {
  asActor(cookie);
  return planRoute.POST(
    new Request("http://localhost/api/platform/plans", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

async function planGet(cookie: string) {
  asActor(cookie);
  return planRoute.GET();
}

async function periodPost(
  cookie: string,
  body: unknown,
  targetSchool = schoolId,
) {
  asActor(cookie);
  return periodsRoute.POST(
    new Request(`http://localhost/api/platform/schools/${targetSchool}/subscriptions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ schoolId: targetSchool }) },
  );
}

async function periodGet(cookie: string, targetSchool = schoolId) {
  asActor(cookie);
  return periodsRoute.GET(
    new Request(`http://localhost/api/platform/schools/${targetSchool}/subscriptions`),
    { params: Promise.resolve({ schoolId: targetSchool }) },
  );
}

async function statusGet(cookie: string, targetSchool = schoolId) {
  asActor(cookie);
  return statusRoute.GET(
    new Request(`http://localhost/api/platform/schools/${targetSchool}/subscription-status`),
    { params: Promise.resolve({ schoolId: targetSchool }) },
  );
}

function periodPayload(planRevisionId: string, from: string, to: string) {
  return {
    planRevisionId,
    startsAt: from,
    endsAt: to,
    reason: "Operator approved synthetic plan period",
  };
}

function secure(res: Response, expected: number) {
  expect(res.status).toBe(expected);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
}

describe("Phase 3 platform subscription catalog and school periods", () => {
  beforeAll(async () => {
    const [operator, ordinary] = await Promise.all([
      auth.api.signUpEmail({
        body: { name: "Synthetic Platform Operator", email: adminEmail, password },
      }),
      auth.api.signUpEmail({
        body: { name: "Synthetic School Member", email: userEmail, password },
      }),
    ]);
    adminId = operator.user.id;
    schoolUserId = ordinary.user.id;
    await prisma.user.update({
      where: { id: adminId },
      data: { platformRole: "SUPER_ADMIN" },
    });
    await prisma.school.createMany({
      data: [
        { id: schoolId, name: "Synthetic Subscription A",
          slug: schoolId, lifecycleStatus: "PENDING", isActive: false },
        { id: foreignSchoolId, name: "Synthetic Subscription B",
          slug: foreignSchoolId, lifecycleStatus: "PENDING", isActive: false },
        { id: observedSchoolId, name: "Synthetic Suspended Subscription C",
          slug: observedSchoolId, lifecycleStatus: "SUSPENDED", isActive: false },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { schoolId, userId: schoolUserId, role: "SCHOOL_ADMIN" },
        { schoolId: observedSchoolId, userId: schoolUserId, role: "TEACHER" },
      ],
    });
    platformCookie = await signIn(adminEmail);
    schoolCookie = await signIn(userEmail);
  }, 45_000);

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolId, foreignSchoolId, observedSchoolId] } },
    });
    const ids = [adminId, schoolUserId].filter(Boolean);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("denies anonymous and ordinary school users without data disclosure", async () => {
    for (const [cookie, expected] of [
      ["", 401],
      [schoolCookie, 404],
    ] as const) {
      secure(await planGet(cookie), expected);
      secure(await planPost(cookie, planPayload()), expected);
      secure(await periodGet(cookie), expected);
      secure(await statusGet(cookie), expected);
      secure(
        await periodPost(cookie,
          periodPayload("unavailable", "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z")),
        expected,
      );
    }
    expect(await prisma.platformPlanRevision.count({ where: { code } })).toBe(0);
  });

  it("validates strict catalog input and creates immutable successive versions", async () => {
    secure(await planPost(platformCookie, planPayload({
      features: ["ATTENDANCE", "ATTENDANCE"],
    })), 400);
    secure(await planPost(platformCookie, planPayload({
      maxStudents: -2,
    })), 400);
    secure(await planPost(platformCookie, planPayload({
      addedPrivilege: "school:configure",
    })), 400);
    const first = await planPost(platformCookie, planPayload());
    secure(first, 201);
    const initial = (await first.json()).plan;
    firstPlanId = initial.id;
    expect(initial).toMatchObject({
      code, version: 1,
      features: ["ATTENDANCE", "LESSONS"],
      maxStudents: 500,
    });
    const second = await planPost(platformCookie, planPayload({
      name: "Synthetic expanded plan",
      features: ["ATTENDANCE", "LESSONS", "ASSESSMENTS"],
      reason: "Append next synthetic catalog revision",
    }));
    secure(second, 201);
    const revised = (await second.json()).plan;
    secondPlanId = revised.id;
    expect(revised.version).toBe(2);
    const history = await planGet(platformCookie);
    secure(history, 200);
    const versions = (await history.json()).plans.filter(
      (item: { code: string }) => item.code === code,
    );
    expect(versions.map((item: { version: number }) => item.version)).toEqual([2, 1]);
  });

  it("shows missing plan status without claiming a paid or enabled entitlement", async () => {
    const response = await statusGet(platformCookie);
    secure(response, 200);
    const snapshot = (await response.json()).status;
    expect(snapshot).toMatchObject({
      subscriptionStatus: "NONE",
      billingStatus: "NOT_TRACKED",
      entitlementEnforcement: "NOT_ENABLED",
      school: { id: schoolId, lifecycleStatus: "PENDING", isActive: false },
      usage: {
        enrolledStudents: { used: 0, limit: null, exceedsLimit: null },
        activeStaff: { used: 1, limit: null, exceedsLimit: null },
      },
    });
    expect(snapshot.observedPeriod).toBeNull();
    secure(await statusGet(platformCookie, "not-a-school"), 404);
  });

  it("observes current plan without reactivating a suspended school", async () => {
    const now = Date.now();
    const startsAt = new Date(now - 86_400_000).toISOString();
    const endsAt = new Date(now + 86_400_000).toISOString();
    secure(await periodPost(
      platformCookie,
      periodPayload(firstPlanId, startsAt, endsAt),
      observedSchoolId,
    ), 201);
    const response = await statusGet(platformCookie, observedSchoolId);
    secure(response, 200);
    const snapshot = (await response.json()).status;
    expect(snapshot).toMatchObject({
      subscriptionStatus: "CURRENT",
      billingStatus: "NOT_TRACKED",
      entitlementEnforcement: "NOT_ENABLED",
      school: {
        id: observedSchoolId,
        lifecycleStatus: "SUSPENDED",
        isActive: false,
      },
      observedPeriod: {
        planRevision: {
          id: firstPlanId,
          code,
          version: 1,
          maxStudents: 500,
          maxStaff: 80,
        },
      },
      usage: {
        enrolledStudents: { used: 0, limit: 500, exceedsLimit: false },
        activeStaff: { used: 1, limit: 80, exceedsLimit: false },
      },
    });
    expect(snapshot.asOf).toEqual(expect.any(String));
    expect(JSON.stringify(snapshot)).not.toContain(schoolUserId);
    secure(await statusGet(schoolCookie, observedSchoolId), 404);
  });

  it("stores non-overlapping school-specific periods without activating a tenant", async () => {
    const first = await periodPost(
      platformCookie,
      periodPayload(firstPlanId, "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"),
    );
    secure(first, 201);
    periodId = (await first.json()).subscription.id;
    secure(await periodPost(
      platformCookie,
      periodPayload(secondPlanId, "2026-11-15T00:00:00Z", "2026-12-15T00:00:00Z"),
    ), 409);
    secure(await periodPost(
      platformCookie,
      periodPayload(secondPlanId, "2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"),
    ), 201);
    secure(await periodPost(
      platformCookie,
      periodPayload(firstPlanId, "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"),
      foreignSchoolId,
    ), 201);

    const history = await periodGet(platformCookie);
    secure(history, 200);
    const periods = (await history.json()).subscriptions;
    expect(periods).toHaveLength(2);
    expect(periods.map((item: { planRevision: { version: number } }) =>
      item.planRevision.version).sort()).toEqual([1, 2]);
    expect(await prisma.school.findUnique({
      where: { id: schoolId },
      select: { isActive: true, lifecycleStatus: true },
    })).toEqual({ isActive: false, lifecycleStatus: "PENDING" });
  });

  it("serializes concurrent same-school overlapping assignments", async () => {
    const [one, two] = await Promise.all([
      periodPost(
        platformCookie,
        periodPayload(
          secondPlanId,
          "2027-01-01T00:00:00Z",
          "2027-02-01T00:00:00Z",
        ),
      ),
      periodPost(
        platformCookie,
        periodPayload(
          firstPlanId,
          "2027-01-15T00:00:00Z",
          "2027-02-15T00:00:00Z",
        ),
      ),
    ]);
    expect([one.status, two.status].sort()).toEqual([201, 409]);
    expect(await prisma.schoolSubscriptionPeriod.count({
      where: { schoolId },
    })).toBe(3);
    expect([one, two].every(
      (response) => response.headers.get("cache-control") === "private, no-store",
    )).toBe(true);
  });

  it("rejects direct multi-row overlap even when bypassing the HTTP service", async () => {
    await expect(
      prisma.schoolSubscriptionPeriod.createMany({
        data: [
          {
            schoolId,
            planRevisionId: firstPlanId,
            startsAt: new Date("2027-04-01T00:00:00Z"),
            endsAt: new Date("2027-05-01T00:00:00Z"),
            actorUserId: adminId,
            reason: "First synthetic batch subscription period",
          },
          {
            schoolId,
            planRevisionId: secondPlanId,
            startsAt: new Date("2027-04-15T00:00:00Z"),
            endsAt: new Date("2027-05-15T00:00:00Z"),
            actorUserId: adminId,
            reason: "Overlapping synthetic batch subscription period",
          },
        ],
      }),
    ).rejects.toThrow();
    expect(await prisma.schoolSubscriptionPeriod.count({
      where: { schoolId },
    })).toBe(3);
  });

  it("denies a closed or unknown school and rejects invalid temporal bounds", async () => {
    secure(await periodGet(platformCookie, "nonexistent-school"), 404);
    secure(await periodPost(platformCookie, periodPayload(
      secondPlanId, "2027-02-01T00:00:00Z", "2027-01-01T00:00:00Z",
    )), 400);
    secure(await periodPost(platformCookie, periodPayload(
      secondPlanId, "2027-02-01T00:00:00Z", "2027-03-01T00:00:00Z",
    ), "nonexistent-school"), 404);
    await prisma.school.update({
      where: { id: foreignSchoolId },
      data: { lifecycleStatus: "CLOSED" },
    });
    secure(await periodPost(platformCookie, periodPayload(
      secondPlanId, "2027-03-01T00:00:00Z", "2027-04-01T00:00:00Z",
    ), foreignSchoolId), 409);
  });

  it("guards direct SQL actor forgery and historic UPDATE or DELETE", async () => {
    await expect(prisma.platformPlanRevision.create({
      data: {
        code: `forged-${uid.slice(0, 16)}`,
        version: 1,
        name: "Forged plan",
        features: ["LESSONS"],
        maxStudents: null,
        maxStaff: null,
        actorUserId: schoolUserId,
        reason: "Attempt forged catalog mutation",
      },
    })).rejects.toThrow();
    await expect(prisma.schoolSubscriptionPeriod.create({
      data: {
        schoolId, planRevisionId: firstPlanId,
        startsAt: new Date("2027-03-01T00:00:00Z"),
        endsAt: new Date("2027-04-01T00:00:00Z"),
        actorUserId: schoolUserId,
        reason: "Attempt forged plan assignment",
      },
    })).rejects.toThrow();
    await expect(prisma.platformPlanRevision.update({
      where: { id: firstPlanId }, data: { name: "tampered name" },
    })).rejects.toThrow();
    await expect(prisma.platformPlanRevision.delete({
      where: { id: secondPlanId },
    })).rejects.toThrow();
    await expect(prisma.schoolSubscriptionPeriod.update({
      where: { id: periodId },
      data: { reason: "tampered historical reason" },
    })).rejects.toThrow();
    await expect(prisma.schoolSubscriptionPeriod.delete({
      where: { id: periodId },
    })).rejects.toThrow();
    expect(await prisma.schoolSubscriptionPeriod.count({ where: { schoolId } })).toBe(3);
  });

  it("revokes platform authority immediately for a still-signed-in operator", async () => {
    await prisma.user.update({
      where: { id: adminId },
      data: { platformRole: "NONE" },
    });
    secure(await planGet(platformCookie), 404);
    secure(await periodGet(platformCookie, schoolId), 404);
    secure(await statusGet(platformCookie, observedSchoolId), 404);
    const currentPeriod = await prisma.schoolSubscriptionPeriod.findFirst({
      where: { schoolId: observedSchoolId },
      select: { planRevisionId: true },
    });
    expect(currentPeriod?.planRevisionId).toBe(firstPlanId);
  });
});
