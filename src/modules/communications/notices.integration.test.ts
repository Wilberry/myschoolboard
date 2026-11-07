import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => ctx.headers }));
import { prisma } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";
import { verifyPhase9DatabaseIdentity } from "@/scripts/verify-phase9-disposable.mjs";
import { POST as CREATE } from "@/app/api/schools/[schoolId]/notices/route";
import { POST as POLICY } from "@/app/api/schools/[schoolId]/notice-policies/route";
import { POST as DECIDE } from "@/app/api/schools/[schoolId]/notices/[noticeId]/decision/route";
import { POST as REVISE } from "@/app/api/schools/[schoolId]/notices/[noticeId]/revisions/route";
import { POST as PUBLISH } from "@/app/api/schools/[schoolId]/notices/[noticeId]/publish/route";
import { POST as WITHDRAW } from "@/app/api/schools/[schoolId]/notice-releases/[releaseId]/withdraw/route";
import { GET as FEED } from "@/app/api/schools/[schoolId]/my-notices/route";
import { GET as WORKSPACE } from "@/app/api/schools/[schoolId]/notice-workspace/route";
import { GET as INBOX } from "@/app/api/schools/[schoolId]/notifications/route";
import { POST as INTERACT } from "@/app/api/schools/[schoolId]/notifications/[deliveryId]/state/route";
import { POST as REPLAY } from "@/app/api/schools/[schoolId]/notice-delivery/replay/route";
import {
  attestStudentAccount,
  revokeStudentAccountLink,
} from "@/src/modules/students/account-link-service";
import {
  attestGuardianStudentLink,
  revokeGuardianStudentLink,
} from "@/src/modules/students/guardian-link-service";
import {
  claimNoticeEvent,
  processNoticeClaim,
  failNoticeClaim,
  deliverNoticeBatch,
} from "@/src/modules/notifications/service";
const tag = randomUUID(),
  school = `p10-notices-${tag}`,
  foreign = `p10-foreign-${tag}`,
  session = `p10-session-${tag}`,
  section = `p10-section-${tag}`,
  classId = `p10-class-${tag}`;
const users: Record<string, string> = {},
  members: Record<string, string> = {},
  cookies: Record<string, string> = {};
const password = "Synthetic-phase10-notice-password-42";
let noticeId: string,
  releaseId: string,
  policyId: string,
  parentLink: string,
  pupilId: string;
const releases: Record<string, string> = {};
const bulkUsers: string[] = [];
const privateBody =
  "Synthetic authorized school notice body — never an inbox payload";
function actor(name: string) {
  ctx.headers = new Headers(cookies[name] ? { cookie: cookies[name] } : {});
}
type Handler = (
  r: Request,
  c: {
    params: Promise<{
      schoolId: string;
      noticeId: string;
      releaseId: string;
      deliveryId: string;
    }>;
  },
) => Promise<Response>;
function call(
  handler: Handler,
  name: string,
  body?: unknown,
  id = "",
  schoolId = school,
  query = "",
) {
  actor(name);
  return handler(
    new Request("http://localhost/api/notices" + query, {
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    }),
    {
      params: Promise.resolve({
        schoolId,
        noticeId: id,
        releaseId: id,
        deliveryId: id,
      }),
    },
  );
}
function intent(extra: Record<string, unknown> = {}) {
  return {
    reason: "Synthetic isolated school notice acceptance",
    requestKey: randomUUID(),
    ...extra,
  };
}
async function ok(h: Handler, name: string, data: unknown, id = "") {
  const r = await call(h, name, data, id);
  expect([200, 201], await r.clone().text()).toContain(r.status);
  return (await r.json()).result;
}
async function register(
  name: string,
  role:
    "SCHOOL_SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "PARENT" | "STUDENT",
  s = school,
) {
  const signup = await auth.api.signUpEmail({
    body: {
      email: `p10-${name}-${tag}@example.test`,
      name: `Synthetic ${name}`,
      password,
    },
  });
  users[name] = signup.user.id;
  if (name !== "platform")
    members[name] = (
      await prisma.membership.create({
        data: { schoolId: s, userId: signup.user.id, role },
      })
    ).id;
  else
    await prisma.user.update({
      where: { id: signup.user.id },
      data: { platformRole: "SUPER_ADMIN" },
    });
  const signed = await auth.api.signInEmail({
    body: { email: `p10-${name}-${tag}@example.test`, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  cookies[name] = signed.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
}
async function pupil(student: string, parent: string, suffix = "main") {
  const p = await prisma.studentRecord.create({
    data: {
      schoolId: school,
      admissionNumber: `P10-${suffix}-${tag}`,
      givenName: "SyntheticNotice",
      familyName: "Pupil",
      status: "ENROLLED",
    },
  });
  await prisma.studentEnrollment.create({
    data: { schoolId: school, studentId: p.id, classId, sessionId: session },
  });
  actor("admin");
  await attestStudentAccount(school, {
    studentId: p.id,
    studentMembershipId: members[student],
    identityVerified: true,
    reason: "Synthetic independent pupil identity attestation",
  });
  actor("admin");
  const link = await attestGuardianStudentLink(school, {
    studentId: p.id,
    guardianMembershipId: members[parent],
    relationshipVerified: true,
    reason: "Synthetic independent guardian relationship",
  });
  return { pupilId: p.id, linkId: link.id };
}
async function ready(title = "Synthetic school notice", author = "admin") {
  const n = await ok(CREATE, author, intent({ title, body: privateBody }));
  await ok(
    DECIDE,
    author,
    intent({ action: "SUBMIT", expectedRevision: 1 }),
    n.id,
  );
  await ok(
    DECIDE,
    "owner",
    intent({ action: "APPROVE", expectedRevision: 1 }),
    n.id,
  );
  return n.id;
}
async function release(audience: string, id?: string) {
  const policy = await ok(POLICY, "owner", intent({ audience }));
  const n = id ?? (await ready("Synthetic " + audience));
  const r = await ok(
    PUBLISH,
    "owner",
    intent({ expectedRevision: 1, policyId: policy.id }),
    n,
  );
  return { ...r, policyId: policy.id };
}
async function feed(name: string) {
  const r = await call(FEED, name);
  expect(r.status).toBe(200);
  return (await r.json()).notices;
}
async function inbox(name: string) {
  const r = await call(INBOX, name);
  expect(r.status).toBe(200);
  return r.json();
}
async function drain() {
  for (let i = 0; i < 20; i++) {
    const result = await deliverNoticeBatch(school, users.owner);
    if (!result.processed) break;
  }
}
beforeAll(async () => {
  verifyPhase9DatabaseIdentity(process.env);
  vi.stubEnv("PHASE10_NOTICES_ENABLED", "true");
  vi.stubEnv("PHASE10_INAPP_ENABLED", "true");
  await prisma.school.createMany({
    data: [
      { id: school, name: "Synthetic notices school", slug: school },
      { id: foreign, name: "Synthetic foreign school", slug: foreign },
    ],
  });
  for (const [name, role, s] of [
    ["owner", "SCHOOL_SUPER_ADMIN", school],
    ["owner2", "SCHOOL_SUPER_ADMIN", school],
    ["admin", "SCHOOL_ADMIN", school],
    ["teacher", "TEACHER", school],
    ["student", "STUDENT", school],
    ["parent", "PARENT", school],
    ["unrelated", "PARENT", school],
    ["foreign", "SCHOOL_SUPER_ADMIN", foreign],
    ["platform", "SCHOOL_ADMIN", school],
  ] as const)
    await register(name, role, s);
  await prisma.academicSession.create({
    data: {
      id: session,
      schoolId: school,
      name: "Synthetic notice session",
      startsOn: new Date("2026-09-01Z"),
      endsOn: new Date("2027-07-31Z"),
      status: "ACTIVE",
    },
  });
  await prisma.schoolSection.create({
    data: { id: section, schoolId: school, name: "Primary", stage: "PRIMARY" },
  });
  await prisma.schoolClass.create({
    data: {
      id: classId,
      schoolId: school,
      sectionId: section,
      name: "Synthetic notice class",
    },
  });
  const bound = await pupil("student", "parent");
  pupilId = bound.pupilId;
  parentLink = bound.linkId;
}, 45000);
afterAll(async () => {
  vi.unstubAllEnvs();
  if (!process.env.PHASE10_BROWSER_FIXTURE_FILE) {
    await prisma.school.deleteMany({
      where: { id: { in: [school, foreign] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [...Object.values(users), ...bulkUsers] } },
    });
  }
  await prisma.$disconnect();
});
it("keeps default-off routes and real current role/tenant boundaries closed", async () => {
  for (const flag of ["PHASE10_NOTICES_ENABLED", "PHASE10_INAPP_ENABLED"]) {
    vi.stubEnv(flag, "false");
    try {
      expect(
        (await call(flag === "PHASE10_NOTICES_ENABLED" ? FEED : INBOX, "owner"))
          .status,
      ).toBe(404);
    } finally {
      vi.stubEnv(flag, "true");
    }
  }
  expect((await call(FEED, "")).status).toBe(401);
  for (const a of ["teacher", "student", "parent", "foreign", "platform"])
    expect(
      (await call(CREATE, a, intent({ title: "Denied", body: privateBody })))
        .status,
    ).toBe(404);
  for (const a of [
    "admin",
    "teacher",
    "student",
    "parent",
    "foreign",
    "platform",
  ])
    expect(
      (await call(POLICY, a, intent({ audience: "STAFF_ONLY" }))).status,
    ).toBe(404);
  for (const a of ["unrelated", "foreign", "platform"])
    expect((await call(FEED, a)).status).toBe(404);
  expect(
    (
      await call(CREATE, "admin", {
        ...intent({ title: "No spoofing", body: privateBody }),
        actorUserId: users.owner,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await call(
        CREATE,
        "admin",
        intent({ title: "Bounded body", body: "x".repeat(70000) }),
      )
    ).status,
  ).toBe(400);
});
it("creates one immutable revision under concurrent exact retry without implicit release", async () => {
  const input = intent({
    title: "Synthetic administrator draft",
    body: privateBody,
  });
  const r = await Promise.all([
    call(CREATE, "admin", input),
    call(CREATE, "admin", input),
  ]);
  expect(r.map((x) => x.status).sort()).toEqual([200, 201]);
  noticeId = (await r[0].json()).result.id;
  expect(await feed("parent")).toEqual([]);
  expect(await prisma.domainEvent.count({ where: { schoolId: school } })).toBe(
    0,
  );
  expect(await prisma.noticeRevision.count({ where: { noticeId } })).toBe(1);
  expect(
    (await call(CREATE, "admin", { ...input, body: "Changed retry" })).status,
  ).toBe(409);
  await expect(
    prisma.noticeRevision.updateMany({
      where: { noticeId },
      data: { body: "SQL change" },
    }),
  ).rejects.toThrow();
});
it("requires independent owner review, including after promotion of an administrator author", async () => {
  await ok(
    DECIDE,
    "admin",
    intent({ action: "SUBMIT", expectedRevision: 1 }),
    noticeId,
  );
  for (const a of ["admin", "teacher", "student", "foreign"])
    expect(
      (
        await call(
          DECIDE,
          a,
          intent({ action: "APPROVE", expectedRevision: 1 }),
          noticeId,
        )
      ).status,
    ).toBe(404);
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: members.admin },
        data: { role: "SCHOOL_SUPER_ADMIN" },
      });
      await tx.noticeWorkflowEvent.create({
        data: {
          id: randomUUID(),
          schoolId: school,
          noticeId,
          revision: 1,
          action: "APPROVE",
          actorUserId: users.admin,
          requestKey: randomUUID(),
          reason: "Synthetic promoted self review attempt",
        },
      });
    }),
  ).rejects.toThrow();
  const p = await ok(
    POLICY,
    "owner",
    intent({ audience: "STUDENTS_AND_GUARDIANS" }),
  );
  policyId = p.id;
  expect(
    (
      await call(
        PUBLISH,
        "owner",
        intent({ expectedRevision: 1, policyId }),
        noticeId,
      )
    ).status,
  ).toBe(409);
  await ok(
    DECIDE,
    "owner",
    intent({ action: "APPROVE", expectedRevision: 1 }),
    noticeId,
  );
  expect(await feed("student")).toEqual([]);
});
it("atomically captures publication and outbox and rolls all three back on failure", async () => {
  const marker = Symbol("rollback publish");
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.noticeRelease.create({
        data: {
          id: randomUUID(),
          schoolId: school,
          noticeId,
          revision: 1,
          policyId,
          ordinal: 0,
          actorUserId: users.owner,
          requestKey: randomUUID(),
          reason: "Synthetic rollback source and outbox",
        },
      });
      throw marker;
    }),
  ).rejects.toBe(marker);
  expect(await prisma.noticeRelease.count({ where: { noticeId } })).toBe(0);
  expect(await prisma.domainEvent.count({ where: { schoolId: school } })).toBe(
    0,
  );
  const input = intent({ expectedRevision: 1, policyId });
  const r = await Promise.all([
    call(PUBLISH, "owner", input, noticeId),
    call(PUBLISH, "owner", input, noticeId),
  ]);
  expect(r.map((x) => x.status).sort()).toEqual([200, 201]);
  releaseId = (await r[0].json()).result.id;
  expect(await prisma.domainEvent.count({ where: { schoolId: school } })).toBe(
    1,
  );
  expect(
    await prisma.outboxDispatch.count({ where: { schoolId: school } }),
  ).toBe(1);
  expect((await feed("parent"))[0].body).toBe(privateBody);
  expect(await feed("teacher")).toEqual([]);
  expect((await call(FEED, "parent", undefined, "", foreign)).status).toBe(404);
});
it("delivers concurrently once and never puts source content or private pupil details in inbox text", async () => {
  await Promise.all([
    deliverNoticeBatch(school, users.owner),
    deliverNoticeBatch(school, users.owner2),
  ]);
  expect(
    await prisma.notificationDelivery.count({
      where: {
        schoolId: school,
        releaseId,
        recipientMembershipId: members.parent,
      },
    }),
  ).toBe(1);
  expect(
    await prisma.notificationDelivery.count({
      where: {
        schoolId: school,
        releaseId,
        recipientMembershipId: members.student,
      },
    }),
  ).toBe(1);
  const result = await inbox("parent");
  expect(result.unreadCount).toBe("1");
  expect(result.items[0].text).toBe("A school notice is available");
  expect(result.items[0].href).toBe(`/schools/${school}/notices/${releaseId}`);
  expect(JSON.stringify(result)).not.toMatch(
    /authorized school notice body|SyntheticNotice|Pupil|bank|actorUserId/,
  );
  await drain();
  expect(
    await prisma.notificationDelivery.count({
      where: { schoolId: school, releaseId },
    }),
  ).toBe(2);
});
it("keeps GET side-effect free and read/unread explicit, replayable and recipient-only", async () => {
  const item = (await inbox("parent")).items[0];
  expect(
    await prisma.notificationInteraction.count({ where: { schoolId: school } }),
  ).toBe(0);
  await inbox("parent");
  expect(
    await prisma.notificationInteraction.count({ where: { schoolId: school } }),
  ).toBe(0);
  const input = { action: "READ", requestKey: randomUUID() };
  expect((await call(INTERACT, "student", input, item.id)).status).toBe(404);
  expect(
    (await call(INTERACT, "foreign", input, item.id, foreign)).status,
  ).toBe(404);
  expect((await call(INTERACT, "parent", input, item.id)).status).toBe(201);
  expect((await call(INTERACT, "parent", input, item.id)).status).toBe(200);
  expect(
    (await call(INTERACT, "parent", { ...input, action: "UNREAD" }, item.id))
      .status,
  ).toBe(409);
  expect((await inbox("parent")).unreadCount).toBe("0");
  await ok(
    INTERACT,
    "parent",
    { action: "UNREAD", requestKey: randomUUID() },
    item.id,
  );
  expect((await inbox("parent")).unreadCount).toBe("1");
  expect(
    (await call(INBOX, "student", undefined, "", school, `?cursor=${item.id}`))
      .status,
  ).toBe(404);
  expect(
    (await call(INBOX, "parent", undefined, "", school, "?limit=51")).status,
  ).toBe(400);
});
it("enforces every explicit school visibility mode without inheriting report or fee policy", async () => {
  for (const audience of [
    "STAFF_ONLY",
    "STUDENTS_ONLY",
    "GUARDIANS_ONLY",
    "STUDENTS_AND_GUARDIANS",
  ]) {
    const r = await release(audience);
    releases[audience] = r.id;
    for (const a of ["teacher", "student", "parent"]) {
      const visible = (await feed(a)).some(
        (n: { id: string }) => n.id === r.id,
      );
      expect(visible).toBe(
        a === "teacher"
          ? audience === "STAFF_ONLY"
          : a === "student"
            ? ["STUDENTS_ONLY", "STUDENTS_AND_GUARDIANS"].includes(audience)
            : ["GUARDIANS_ONLY", "STUDENTS_AND_GUARDIANS"].includes(audience),
      );
    }
  }
});
it("pins corrected versions, rejects stale policies and suppresses superseded delivery history", async () => {
  const n = await ready("Synthetic correction notice");
  const oldPolicy = await ok(
    POLICY,
    "owner",
    intent({ audience: "STUDENTS_AND_GUARDIANS" }),
  );
  const newPolicy = await ok(
    POLICY,
    "owner",
    intent({ audience: "STAFF_ONLY" }),
  );
  expect(
    (
      await call(
        PUBLISH,
        "owner",
        intent({ expectedRevision: 1, policyId: oldPolicy.id }),
        n,
      )
    ).status,
  ).toBe(404);
  const first = await ok(
    PUBLISH,
    "owner",
    intent({ expectedRevision: 1, policyId: newPolicy.id }),
    n,
  );
  await drain();
  await ok(
    REVISE,
    "admin",
    intent({
      expectedRevision: 1,
      title: "Synthetic corrected notice",
      body: "Synthetic corrected version text",
    }),
    n,
  );
  expect(
    (await feed("teacher")).some((x: { id: string }) => x.id === first.id),
  ).toBe(true);
  expect(
    (
      await call(
        PUBLISH,
        "owner",
        intent({ expectedRevision: 2, policyId: newPolicy.id }),
        n,
      )
    ).status,
  ).toBe(409);
  await ok(
    DECIDE,
    "admin",
    intent({ action: "SUBMIT", expectedRevision: 2 }),
    n,
  );
  await ok(
    DECIDE,
    "owner",
    intent({ action: "APPROVE", expectedRevision: 2 }),
    n,
  );
  const second = await ok(
    PUBLISH,
    "owner",
    intent({ expectedRevision: 2, policyId: newPolicy.id }),
    n,
  );
  expect(
    (await feed("teacher")).some((x: { id: string }) => x.id === first.id),
  ).toBe(false);
  expect(
    (await feed("teacher")).some((x: { id: string }) => x.id === second.id),
  ).toBe(true);
  expect(await prisma.noticeRevision.count({ where: { noticeId: n } })).toBe(2);
  expect(
    await prisma.notificationSuppression.count({
      where: { schoolId: school, reasonCode: "SOURCE_SUPERSEDED" },
    }),
  ).toBeGreaterThan(0);
});
it("resumes bounded audience pages beyond 100 memberships without duplication", async () => {
  await drain();
  for (let i = 0; i < 101; i++)
    bulkUsers.push(`p10-bulk-${tag}-${String(i).padStart(3, "0")}`);
  await prisma.user.createMany({
    data: bulkUsers.map((id, i) => ({
      id,
      name: "Synthetic paged staff",
      email: `p10-bulk-${i}-${tag}@example.test`,
    })),
  });
  await prisma.membership.createMany({
    data: bulkUsers.map((id) => ({
      id,
      schoolId: school,
      userId: id,
      role: "TEACHER" as const,
    })),
  });
  const r = await release("STAFF_ONLY");
  const c = await claimNoticeEvent(school, users.owner);
  expect(c?.eventId).toBe(r.id);
  expect(
    (
      await processNoticeClaim(
        { ...c!, cursorMembershipId: "zzzz", kind: "NOTICE_WITHDRAWN" },
        users.owner,
      )
    ).delivered,
  ).toBeGreaterThan(0);
  expect(
    (
      await prisma.outboxDispatch.findUniqueOrThrow({
        where: { eventId: r.id },
      })
    ).state,
  ).toBe("PENDING");
  await drain();
  expect(
    (
      await prisma.outboxDispatch.findUniqueOrThrow({
        where: { eventId: r.id },
      })
    ).state,
  ).toBe("DONE");
  expect(
    await prisma.notificationDelivery.count({
      where: { eventId: r.id, recipientMembershipId: { in: bulkUsers } },
    }),
  ).toBe(101);
});
it("rolls back an entire audience page if its lease expires during inserts", async () => {
  await drain();
  const r = await release("STAFF_ONLY");
  const c = await claimNoticeEvent(school, users.owner);
  expect(c?.eventId).toBe(r.id);
  const fn = "phase10_test_lease_" + tag.replaceAll("-", "");
  // Isolated test-only fault injection, never a production clock/config bypass.
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW."schoolId"='${school}' THEN UPDATE "OutboxDispatch" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE "eventId"=NEW."eventId"; END IF;RETURN NEW;END; $$ LANGUAGE plpgsql`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${fn}" AFTER INSERT ON "NotificationDelivery" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
  );
  try {
    await expect(processNoticeClaim(c!, users.owner)).rejects.toThrow(
      "CONFLICT",
    );
    expect(
      await prisma.notificationDelivery.count({ where: { eventId: r.id } }),
    ).toBe(0);
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "${fn}" ON "NotificationDelivery"`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`);
  }
  await failNoticeClaim(c!, users.owner);
  await prisma.outboxDispatch.update({
    where: { eventId: r.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await drain();
  expect(
    await prisma.notificationDelivery.count({
      where: { eventId: r.id, recipientMembershipId: { in: bulkUsers } },
    }),
  ).toBe(101);
});
it("recovers an expired worker lease with fencing and no duplicated delivery", async () => {
  await drain();
  const r = await release("STUDENTS_AND_GUARDIANS");
  const old = await claimNoticeEvent(school, users.owner);
  expect(old).not.toBeNull();
  await prisma.outboxDispatch.update({
    where: { eventId: old!.eventId },
    data: { leaseExpiresAt: new Date(0) },
  });
  const next = await claimNoticeEvent(school, users.owner2);
  expect(next?.eventId).toBe(old!.eventId);
  expect(next?.leaseToken).not.toBe(old!.leaseToken);
  expect((await processNoticeClaim(old!, users.owner)).processed).toBe(false);
  expect((await processNoticeClaim(next!, users.owner2)).processed).toBe(true);
  expect((await processNoticeClaim(next!, users.owner2)).processed).toBe(false);
  expect(
    await prisma.notificationDelivery.count({
      where: {
        schoolId: school,
        releaseId: r.id,
        recipientMembershipId: members.parent,
      },
    }),
  ).toBe(1);
  expect(
    await prisma.outboxAttemptEvent.count({
      where: { eventId: old!.eventId, outcome: "LEASE_EXPIRED" },
    }),
  ).toBe(1);
});
it("records bounded failures and reasoned dead-letter replay without changing source events", async () => {
  await drain();
  const r = await release("STAFF_ONLY");
  for (let i = 0; i < 5; i++) {
    const c = await claimNoticeEvent(school, users.owner);
    expect(c?.eventId).toBe(r.id);
    expect((await failNoticeClaim(c!, users.owner)).recorded).toBe(true);
    if (i < 4)
      await prisma.outboxDispatch.update({
        where: { eventId: r.id },
        data: { nextAttemptAt: new Date(0) },
      });
  }
  expect(
    (
      await prisma.outboxDispatch.findUniqueOrThrow({
        where: { eventId: r.id },
      })
    ).state,
  ).toBe("DEAD_LETTER");
  const request = intent({ eventId: r.id });
  expect((await call(REPLAY, "admin", request)).status).toBe(404);
  expect((await call(REPLAY, "owner", request)).status).toBe(201);
  expect((await call(REPLAY, "owner", request)).status).toBe(200);
  await drain();
  expect(
    (
      await prisma.outboxDispatch.findUniqueOrThrow({
        where: { eventId: r.id },
      })
    ).state,
  ).toBe("DONE");
  expect(await prisma.domainEvent.count({ where: { id: r.id } })).toBe(1);
  expect(
    await prisma.outboxReplayEvent.count({ where: { eventId: r.id } }),
  ).toBe(1);
  await expect(
    prisma.outboxAttemptEvent.deleteMany({ where: { eventId: r.id } }),
  ).rejects.toThrow();
});
it("withdraws access and inbox counts immediately, retains immutable event evidence, and cancels queued disclosure", async () => {
  const before = (await inbox("parent")).items;
  expect(before.length).toBeGreaterThan(0);
  const request = intent();
  expect((await call(WITHDRAW, "admin", request, releaseId)).status).toBe(404);
  expect((await call(WITHDRAW, "owner", request, releaseId)).status).toBe(201);
  expect((await call(WITHDRAW, "owner", request, releaseId)).status).toBe(200);
  expect(
    (
      await call(
        FEED,
        "parent",
        undefined,
        "",
        school,
        `?releaseId=${releaseId}`,
      )
    ).status,
  ).toBe(404);
  expect(
    (await inbox("parent")).items.some((x: { href: string }) =>
      x.href.endsWith(releaseId),
    ),
  ).toBe(false);
  expect(await prisma.domainEvent.count({ where: { releaseId } })).toBe(2);
  await expect(
    prisma.noticeRelease.delete({ where: { id: releaseId } }),
  ).rejects.toThrow();
  await expect(
    prisma.$executeRawUnsafe('TRUNCATE "DomainEvent" CASCADE'),
  ).rejects.toThrow();
  const queued = await release("STUDENTS_AND_GUARDIANS");
  await ok(WITHDRAW, "owner", intent(), queued.id);
  await drain();
  expect(
    await prisma.notificationDelivery.count({
      where: { releaseId: queued.id },
    }),
  ).toBe(0);
});
it("checks live school, enrollment and membership predicates; notification suppression is terminal", async () => {
  const rollback = Symbol("rollback scope");
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.schoolClass.update({
        where: { id: classId },
        data: { isActive: false },
      });
      const row = await tx.$queryRaw<
        Array<{ allowed: boolean }>
      >`SELECT can_read_notice(${school},${releases.STUDENTS_AND_GUARDIANS}::uuid,${users.parent}) AS allowed`;
      expect(row[0].allowed).toBe(false);
      expect(
        await tx.notificationSuppression.count({
          where: { schoolId: school, reasonCode: "AUTHORITY_REVOKED" },
        }),
      ).toBeGreaterThan(0);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
  await prisma.membership.update({
    where: { id: members.teacher },
    data: { isActive: false },
  });
  expect((await call(INBOX, "teacher")).status).toBe(404);
  expect((await call(FEED, "teacher")).status).toBe(404);
});
it("applies actual terminal relationship revocation and stages fresh verified browser recipients", async () => {
  actor("admin");
  await revokeGuardianStudentLink(school, parentLink, {
    reason: "Synthetic terminal notice guardian revocation",
  });
  expect((await call(FEED, "parent")).status).toBe(404);
  expect((await call(INBOX, "parent")).status).toBe(404);
  expect((await call(FEED, "student")).status).toBe(200);
  const studentLink = await prisma.studentAccountLink.findFirstOrThrow({
    where: { schoolId: school, studentMembershipId: members.student },
  });
  actor("admin");
  await revokeStudentAccountLink(school, studentLink.id, {
    reason: "Synthetic separate terminal student identity revocation",
  });
  expect((await call(FEED, "student")).status).toBe(404);
  expect(
    await prisma.notificationSuppression.count({
      where: { schoolId: school, reasonCode: "AUTHORITY_REVOKED" },
    }),
  ).toBeGreaterThan(0);
  if (process.env.PHASE10_BROWSER_FIXTURE_FILE) {
    await register("browserstudent", "STUDENT");
    await register("browserparent", "PARENT");
    const fresh = await pupil("browserstudent", "browserparent", "browser");
    const path = process.env.PHASE10_BROWSER_FIXTURE_FILE;
    if (!/^\/tmp\/phase10-[\w-]+\.json$/.test(path))
      throw Error("Private path required");
    await writeFile(
      path,
      JSON.stringify({
        ownerCookie: cookies.owner,
        school,
        foreign,
        tag,
        users,
        members,
        password,
        pupilId: fresh.pupilId,
        parentLink: fresh.linkId,
      }),
      { mode: 0o600, flag: "wx" },
    );
  }
});
