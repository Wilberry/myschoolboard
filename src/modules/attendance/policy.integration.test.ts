import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => ctx.headers }));

import { POST } from "@/app/api/schools/[schoolId]/attendance-policy/route";
import { POST as designateDay } from "@/app/api/schools/[schoolId]/attendance-days/route";
import { readAttendancePolicyForAdmin } from "./policy-service";
import { prisma } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const a = `calendar-school-a-${tag}`;
const b = `calendar-school-b-${tag}`;
const creds = "synthetic-calendar-policy-2026-passphrase";
const users: Record<string, string> = {};
const cookies: Record<string, string> = {};
const members: Record<string, string> = {};
const valid = {
  timeZone: "Africa/Lagos",
  submissionBackdateDays: 2,
  correctionWindowDays: 14,
  reason: "Synthetic school calendar preference",
};
function route(actor: string, body: unknown, schoolId = a) {
  ctx.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
  const url = `http://localhost/api/schools/${schoolId}/attendance-policy`;
  return POST(
    new Request(url, {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ schoolId }) },
  );
}

describe("school-versioned attendance calendar policy", () => {
  beforeAll(async () => {
    for (const actor of ["admin", "super", "teacher", "foreign"]) {
      const email = `calendar-${actor}-${tag}@example.test`;
      const created = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${actor}`, password: creds },
      });
      users[actor] = created.user.id;
      const logged = await auth.api.signInEmail({
        body: { email, password: creds },
        headers: new Headers({ origin: env.BETTER_AUTH_URL }),
        returnHeaders: true,
      });
      cookies[actor] = logged.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      if (!cookies[actor]) throw new Error("Test-only session absent");
    }
    await prisma.school.createMany({
      data: [
        { id: a, name: "Synthetic Attendance Calendar A", slug: a },
        { id: b, name: "Synthetic Attendance Calendar B", slug: b },
      ],
    });
    for (const [key, role, schoolId] of [
      ["admin", "SCHOOL_ADMIN", a],
      ["super", "SCHOOL_SUPER_ADMIN", a],
      ["teacher", "TEACHER", a],
      ["foreign", "SCHOOL_ADMIN", b],
    ] as const) {
      const member = await prisma.membership.create({
        data: { userId: users[key], role, schoolId },
      });
      members[key] = member.id;
    }
  }, 45_000);
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
  it("shows a restricted, explicit UTC default for an unconfigured school", async () => {
    const snapshot = await readAttendancePolicyForAdmin(users.admin, a);
    expect(snapshot?.current).toMatchObject({
      revision: 0,
      timeZone: "Etc/UTC",
      submissionBackdateDays: 7,
      correctionWindowDays: 30,
    });
    expect(await readAttendancePolicyForAdmin(users.teacher, a)).toBeNull();
    expect(await readAttendancePolicyForAdmin(users.foreign, a)).toBeNull();
  });
  it("rejects anonymous, teacher, foreign administrator and cross-school policy writes", async () => {
    for (const [who, expected] of [
      ["", 401],
      ["teacher", 404],
      ["foreign", 404],
    ] as const) {
      const response = await route(who, valid);
      expect(response.status).toBe(expected);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect((await route("admin", valid, b)).status).toBe(404);
    expect(
      await prisma.schoolAttendancePolicyRevision.count({
        where: { schoolId: a },
      }),
    ).toBe(0);
  });
  it("rejects timezone and policy ranges, unknown keys and missing reason", async () => {
    for (const bad of [
      { ...valid, timeZone: "Imaginary/Timezone" },
      { ...valid, submissionBackdateDays: 31 },
      { ...valid, correctionWindowDays: 366 },
      { ...valid, reason: "bad" },
      { ...valid, actorMembershipId: members.admin },
    ]) {
      expect((await route("admin", bad)).status).toBe(400);
    }
  });
  it("records immutable authorized versions without changing past history", async () => {
    const one = await route("admin", valid);
    expect(one.status).toBe(201);
    const first = (await one.json()).policy;
    expect(first).toMatchObject({
      revision: 1,
      timeZone: "Africa/Lagos",
      submissionBackdateDays: 2,
      correctionWindowDays: 14,
    });
    const two = await route("super", {
      ...valid,
      timeZone: "Etc/UTC",
      submissionBackdateDays: 0,
      reason: "Synthetic stricter school daily calendar",
    });
    expect(two.status).toBe(201);
    expect((await two.json()).policy.revision).toBe(2);
    const versions = await prisma.schoolAttendancePolicyRevision.findMany({
      where: { schoolId: a },
      orderBy: { revision: "asc" },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({
      actorUserId: users.admin,
      actorMembershipId: members.admin,
      timeZone: "Africa/Lagos",
      revision: 1,
    });
    expect(versions[1]).toMatchObject({
      actorUserId: users.super,
      actorMembershipId: members.super,
      timeZone: "Etc/UTC",
      revision: 2,
    });
    expect(
      (await readAttendancePolicyForAdmin(users.admin, a))?.current.revision,
    ).toBe(2);
  });
  it("rejects direct SQL actor spoofing, stale revisions, audit edits and truncation", async () => {
    await expect(
      prisma.schoolAttendancePolicyRevision.create({
        data: {
          schoolId: a,
          revision: 3,
          ...valid,
          actorUserId: users.teacher,
          actorMembershipId: members.teacher,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.schoolAttendancePolicyRevision.create({
        data: {
          schoolId: a,
          revision: 6,
          ...valid,
          actorUserId: users.admin,
          actorMembershipId: members.admin,
        },
      }),
    ).rejects.toThrow();
    const first = await prisma.schoolAttendancePolicyRevision.findFirstOrThrow({
      where: { schoolId: a, revision: 1 },
    });
    await expect(
      prisma.schoolAttendancePolicyRevision.update({
        where: { id: first.id },
        data: { submissionBackdateDays: 30 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.schoolAttendancePolicyRevision.delete({
        where: { id: first.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "SchoolAttendancePolicyRevision"',
      ),
    ).rejects.toThrow();
  });
  it("blocks unauthorised nonteaching-day edits and preserves immutable day revisions", async () => {
    const attendanceDate = "2030-03-11"; // only synthetic future date
    const payload = {
      attendanceDate,
      isTeachingDay: false,
      reason: "Synthetic pre-scheduled school closure",
    };
    async function designate(actor: string, body: unknown, schoolId = a) {
      ctx.headers = new Headers(
        cookies[actor] ? { cookie: cookies[actor] } : {},
      );
      return designateDay(
        new Request(
          `http://localhost/api/schools/${schoolId}/attendance-days`,
          { method: "POST", body: JSON.stringify(body) },
        ),
        { params: Promise.resolve({ schoolId }) },
      );
    }
    expect((await designate("", payload)).status).toBe(401);
    expect((await designate("teacher", payload)).status).toBe(404);
    expect((await designate("foreign", payload)).status).toBe(404);
    const first = await designate("admin", payload);
    expect(first.status).toBe(201);
    expect((await first.json()).day.revision).toBe(1);
    const second = await designate("super", {
      ...payload,
      isTeachingDay: true,
      reason: "Synthetic revised planned opening",
    });
    expect(second.status).toBe(201);
    expect((await second.json()).day.revision).toBe(2);
    const rows = await prisma.schoolAttendanceDayRevision.findMany({
      where: { schoolId: a },
      orderBy: { revision: "asc" },
    });
    expect(rows.map((x) => [x.revision, x.isTeachingDay])).toEqual([
      [1, false],
      [2, true],
    ]);
    await expect(
      prisma.schoolAttendanceDayRevision.update({
        where: { id: rows[0].id },
        data: { isTeachingDay: true },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.schoolAttendanceDayRevision.delete({
        where: { id: rows[0].id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.schoolAttendanceDayRevision.create({
        data: {
          schoolId: a,
          attendanceDate: new Date("2030-03-12T00:00:00.000Z"),
          revision: 1,
          isTeachingDay: false,
          reason: "Synthetic direct forged administrator entry",
          actorUserId: users.teacher,
          actorMembershipId: members.teacher,
        },
      }),
    ).rejects.toThrow();
  });

  it("refuses revisions after the administrator membership is revoked", async () => {
    await prisma.membership.update({
      where: { id: members.admin },
      data: { isActive: false },
    });
    try {
      expect((await route("admin", valid)).status).toBe(404);
      expect(await readAttendancePolicyForAdmin(users.admin, a)).toBeNull();
    } finally {
      await prisma.membership.update({
        where: { id: members.admin },
        data: { isActive: true },
      });
    }
  });
});
