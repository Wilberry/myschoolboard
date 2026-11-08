import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { verifyPhase9DatabaseIdentity } from "@/scripts/verify-phase9-disposable.mjs";
const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => ctx.headers }));
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import {
  deliverSecurityBatchForActor as deliver,
  readSecurityInbox as inbox,
  changeSecurityNotification as change,
  replaySecurityDelivery as replay,
} from "./security-inapp";
import { GET as ownGET } from "@/app/api/account/security-notifications/route";
import { POST as deliverPOST } from "@/app/api/platform/security-delivery/route";
const tag = randomUUID(),
  school = `p10-security-inbox-${tag}`,
  password = `Synthetic-security-inbox-${randomUUID()}`;
const users: Record<string, string> = {},
  cookies: Record<string, string> = {},
  pageUsers: string[] = [];
let personalEvent: string, personalDelivery: string;
function actor(name: string) {
  ctx.headers = new Headers(cookies[name] ? { cookie: cookies[name] } : {});
}
async function failureEvent() {
  const before = await prisma.authSecurityEvidence.count({
    where: { kind: "AUTH_FAILED" },
  });
  await expect(
    auth.api.signInEmail({
      body: {
        email: `unknown-security-${randomUUID()}@example.test`,
        password,
      },
    }),
  ).rejects.toThrow();
  expect(
    await prisma.authSecurityEvidence.count({ where: { kind: "AUTH_FAILED" } }),
  ).toBe(before + 1);
  return (
    await prisma.authSecurityEvidence.findFirstOrThrow({
      where: { kind: "AUTH_FAILED" },
      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
    })
  ).id;
}
async function drain(eventId: string) {
  for (let i = 0; i < 10; i++) {
    if (!(await deliver(users.operator, eventId)).processed) return;
  }
  throw Error("Bounded synthetic security queue exceeded");
}
beforeAll(async () => {
  verifyPhase9DatabaseIdentity(process.env);
  for (const flag of [
    "PHASE10_AUTH_SECURITY_ENABLED",
    "PHASE10_SECURITY_INAPP_ENABLED",
    "PHASE10_INAPP_ENABLED",
  ])
    vi.stubEnv(flag, "true");
  for (const name of ["owner", "operator", "second", "other"]) {
    const email = `security-inbox-${name}-${tag}@example.test`;
    const made = await auth.api.signUpEmail({
      body: { email, password, name: "Synthetic security inbox actor" },
    });
    users[name] = made.user.id;
    if (["operator", "second"].includes(name))
      await prisma.user.update({
        where: { id: made.user.id },
        data: { platformRole: "SUPER_ADMIN" },
      });
    const signed = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });
    cookies[name] = signed.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; ");
  }
  await prisma.school.create({
    data: { id: school, slug: school, name: "Synthetic security inbox school" },
  });
  await prisma.membership.create({
    data: { userId: users.owner, schoolId: school, role: "SCHOOL_SUPER_ADMIN" },
  });
  personalEvent = (
    await prisma.authSecurityEvidence.findFirstOrThrow({
      where: { subjectUserId: users.owner, kind: "AUTH_SUCCEEDED" },
      orderBy: { recordedAt: "desc" },
    })
  ).id;
}, 30000);
afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.school.deleteMany({ where: { id: school } });
  await prisma.user.deleteMany({
    where: { id: { in: [...Object.values(users), ...pageUsers] } },
  });
  await prisma.$disconnect();
});
it("defaults off and never grants school owners global security delivery authority", async () => {
  actor("owner");
  vi.stubEnv("PHASE10_SECURITY_INAPP_ENABLED", "false");
  await expect(inbox("ACCOUNT")).rejects.toMatchObject({ code: "NOT_FOUND" });
  vi.stubEnv("PHASE10_SECURITY_INAPP_ENABLED", "true");
  actor("");
  await expect(inbox("ACCOUNT")).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await expect(deliver(users.owner, personalEvent)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("deduplicates concurrent authenticated delivery and read decisions without disclosing source identities", async () => {
  const result = await Promise.all([
    deliver(users.operator, personalEvent),
    deliver(users.second, personalEvent),
  ]);
  expect(result.some((r) => r.processed)).toBe(true);
  const deliveries = await prisma.securityDelivery.findMany({
    where: { eventId: personalEvent },
  });
  expect(deliveries).toHaveLength(1);
  expect(deliveries[0].recipientUserId).toBe(users.owner);
  personalDelivery = deliveries[0].id;
  actor("owner");
  const current = await inbox("ACCOUNT");
  const item = current.items.find((i) => i.id === personalDelivery);
  expect(item).toMatchObject({ read: false, href: "/account/security" });
  expect(Object.keys(item!).sort()).toEqual([
    "createdAt",
    "href",
    "id",
    "read",
    "text",
  ]);
  for (const secret of [password, users.owner, cookies.owner, "AUTH_SUCCEEDED"])
    expect(JSON.stringify(current)).not.toContain(secret);
  const intent = { action: "READ", requestKey: randomUUID() };
  const read = await Promise.all([
    change("ACCOUNT", personalDelivery, intent),
    change("ACCOUNT", personalDelivery, intent),
  ]);
  expect(read.map((r) => r.replay).sort()).toEqual([false, true]);
  expect(
    (await inbox("ACCOUNT")).items.find((i) => i.id === personalDelivery)?.read,
  ).toBe(true);
  await expect(
    change("ACCOUNT", personalDelivery, { ...intent, action: "UNREAD" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  await change("ACCOUNT", personalDelivery, {
    action: "UNREAD",
    requestKey: randomUUID(),
  });
  for (const who of ["other", "operator"]) {
    actor(who);
    expect(
      (await inbox("ACCOUNT")).items.some((i) => i.id === personalDelivery),
    ).toBe(false);
    await expect(
      change("ACCOUNT", personalDelivery, {
        action: "READ",
        requestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
  expect(
    (
      await prisma.authSecurityOutbox.findUniqueOrThrow({
        where: { eventId: personalEvent },
      })
    ).state,
  ).toBe("DONE");
});
it("separates unknown-failure platform alerts and terminally suppresses revoked operator delivery", async () => {
  const id = await failureEvent();
  await drain(id);
  const targets = await prisma.securityDelivery.findMany({
    where: { eventId: id },
  });
  expect(targets.some((d) => d.recipientUserId === users.operator)).toBe(true);
  expect(targets.some((d) => d.recipientUserId === users.second)).toBe(true);
  expect(targets.some((d) => d.recipientUserId === users.owner)).toBe(false);
  const mine = targets.find((d) => d.recipientUserId === users.operator)!,
    second = targets.find((d) => d.recipientUserId === users.second)!;
  actor("operator");
  expect(
    (await inbox("PLATFORM")).items.find((i) => i.id === mine.id)?.href,
  ).toBe("/platform/security");
  expect((await inbox("ACCOUNT")).items.some((i) => i.id === mine.id)).toBe(
    false,
  );
  await expect(
    change("ACCOUNT", mine.id, { action: "READ", requestKey: randomUUID() }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("owner");
  await expect(inbox("PLATFORM")).rejects.toMatchObject({ code: "NOT_FOUND" });
  await prisma.user.update({
    where: { id: users.second },
    data: { platformRole: "NONE" },
  });
  actor("second");
  await expect(inbox("PLATFORM")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(
    await prisma.securityDeliverySuppression.count({
      where: { deliveryId: second.id },
    }),
  ).toBe(1);
  // This explicit revoke/regrant scenario proves terminal suppression, rather
  // than resetting a browser fixture to recover old authority or delivery.
  await prisma.user.update({
    where: { id: users.second },
    data: { platformRole: "SUPER_ADMIN" },
  });
  expect((await inbox("PLATFORM")).items.some((i) => i.id === second.id)).toBe(
    false,
  );
  await expect(
    change("PLATFORM", second.id, { action: "READ", requestKey: randomUUID() }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("recovers five failed atomic pages through reasoned concurrent replay and over 100 recipients", async () => {
  const seeded = Array.from({ length: 101 }, (_, i) => ({
    id: `security-page-${tag}-${String(i).padStart(3, "0")}`,
    name: "Synthetic platform paging actor",
    email: `security-page-${i}-${tag}@example.test`,
    platformRole: "SUPER_ADMIN" as const,
  }));
  await prisma.user.createMany({ data: seeded });
  pageUsers.push(...seeded.map((u) => u.id));
  const id = await failureEvent(),
    fn = "p10_security_delivery_fault_" + tag.replaceAll("-", "");
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW."eventId"='${id}'::uuid THEN RAISE EXCEPTION 'Synthetic failure after security insert';END IF;RETURN NEW;END; $$ LANGUAGE plpgsql`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${fn}" AFTER INSERT ON "SecurityDelivery" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
  );
  try {
    for (let i = 1; i <= 5; i++) {
      expect(await deliver(users.operator, id)).toEqual({
        processed: false,
        delivered: 0,
      });
      const q = await prisma.authSecurityOutbox.findUniqueOrThrow({
        where: { eventId: id },
      });
      expect(q.failures).toBe(i);
      expect(q.cursorUserId).toBe(null);
      expect(q.state).toBe(i === 5 ? "DEAD_LETTER" : "RETRY_WAIT");
      expect(
        await prisma.securityDelivery.count({ where: { eventId: id } }),
      ).toBe(0);
      expect(await deliver(users.operator, id)).toEqual({
        processed: false,
        delivered: 0,
      });
      expect(
        (
          await prisma.authSecurityOutbox.findUniqueOrThrow({
            where: { eventId: id },
          })
        ).failures,
      ).toBe(i);
      if (i < 5)
        await prisma.$executeRaw`UPDATE "AuthSecurityOutbox" SET "nextAttemptAt"=clock_timestamp()-interval '1 second' WHERE "eventId"=${id}::uuid`;
    }
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "${fn}" ON "SecurityDelivery"`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`);
  }
  expect(
    await prisma.securityOutboxAttempt.count({
      where: { eventId: id, outcome: "FAILED" },
    }),
  ).toBe(5);
  const intent = {
    eventId: id,
    requestKey: randomUUID(),
    reason: "Synthetic verified worker recovery",
  };
  actor("owner");
  await expect(replay(intent)).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("operator");
  const repeated = await Promise.all([replay(intent), replay(intent)]);
  expect(repeated[0].id).toBe(repeated[1].id);
  expect(repeated.map((r) => r.replay).sort()).toEqual([false, true]);
  await expect(
    replay({ ...intent, reason: "Changed recovery intent" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect((await deliver(users.operator, id)).delivered).toBe(100);
  expect(
    (
      await prisma.authSecurityOutbox.findUniqueOrThrow({
        where: { eventId: id },
      })
    ).state,
  ).toBe("PENDING");
  await Promise.all([deliver(users.operator, id), deliver(users.second, id)]);
  await drain(id);
  const rows = await prisma.securityDelivery.findMany({
    where: { eventId: id },
  });
  expect(new Set(rows.map((r) => r.recipientUserId)).size).toBe(rows.length);
  expect(
    seeded.every((u) => rows.some((r) => r.recipientUserId === u.id)),
  ).toBe(true);
  expect(
    (
      await prisma.authSecurityOutbox.findUniqueOrThrow({
        where: { eventId: id },
      })
    ).state,
  ).toBe("DONE");
  expect(
    await prisma.securityOutboxAttempt.count({
      where: { eventId: id, outcome: "REPLAY" },
    }),
  ).toBe(1);
  expect(await deliver(users.operator, id)).toEqual({
    processed: false,
    delivered: 0,
  });
  await expect(
    prisma.$executeRaw`UPDATE "SecurityOutboxAttempt" SET "reason"='Rewritten evidence' WHERE "eventId"=${id}::uuid`,
  ).rejects.toThrow();
}, 30000);
it("paginates personal alerts and rejects foreign cursors, spoofing and untrusted or oversized writes", async () => {
  const sessions = Array.from({ length: 55 }, () => ({
    id: randomUUID(),
    token: randomUUID(),
    userId: users.owner,
    expiresAt: new Date(Date.now() + 3600000),
  }));
  await prisma.session.createMany({ data: sessions });
  const events = await prisma.authSecurityEvidence.findMany({
    where: {
      kind: "SESSION_CREATED",
      sessionRecordId: { in: sessions.map((s) => s.id) },
    },
  });
  expect(events).toHaveLength(55);
  for (const e of events) await deliver(users.operator, e.id);
  actor("owner");
  const first = await inbox("ACCOUNT");
  expect(first.items).toHaveLength(50);
  expect(first.nextCursor).toBeTruthy();
  const second = await inbox("ACCOUNT", first.nextCursor!);
  expect(second.items.length).toBeGreaterThan(0);
  expect(new Set([...first.items, ...second.items].map((r) => r.id)).size).toBe(
    first.items.length + second.items.length,
  );
  actor("other");
  await expect(inbox("ACCOUNT", first.nextCursor!)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  const url = env.BETTER_AUTH_URL + "/api/platform/security-delivery";
  actor("operator");
  for (const [origin, body] of [
    ["https://foreign.example", "{}"],
    [env.BETTER_AUTH_URL, "x".repeat(4097)],
    [env.BETTER_AUTH_URL, JSON.stringify({ recipientUserId: users.owner })],
  ])
    expect(
      (
        await deliverPOST(
          new Request(url, {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body,
          }),
        )
      ).status,
    ).toBe(400);
  expect(
    (
      await ownGET(
        new Request(
          env.BETTER_AUTH_URL +
            "/api/account/security-notifications?userId=" +
            users.owner,
        ),
      )
    ).status,
  ).toBe(400);
});
it("serializes a real uncommitted platform-role revocation before recipient delivery", async () => {
  const target = `000-security-race-${tag}`;
  pageUsers.push(target);
  await prisma.user.create({
    data: {
      id: target,
      name: "Synthetic security race actor",
      email: `security-race-${tag}@example.test`,
      platformRole: "SUPER_ADMIN",
    },
  });
  const id = await failureEvent();
  expect(
    (
      await prisma.user.findMany({
        where: { platformRole: "SUPER_ADMIN" },
        orderBy: { id: "asc" },
        take: 100,
        select: { id: true },
      })
    ).some((u) => u.id === target),
  ).toBe(true);
  let unlock!: () => void,
    locked!: () => void,
    backend = 0;
  const release = new Promise<void>((r) => {
      unlock = r;
    }),
    ready = new Promise<void>((r) => {
      locked = r;
    });
  const holder = prisma.$transaction(
    async (tx) => {
      backend = (
        await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${target} FOR UPDATE`;
      await tx.user.update({
        where: { id: target },
        data: { platformRole: "NONE" },
      });
      locked();
      await release;
    },
    { timeout: 15000 },
  );
  await ready;
  const worker = deliver(users.operator, id);
  let observed = false;
  try {
    for (let i = 0; i < 200; i++) {
      observed = (
        await prisma.$queryRaw<
          Array<{ blocked: boolean }>
        >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity activity WHERE activity.datname=current_database() AND activity.pid<>${backend} AND ${backend}=ANY(pg_blocking_pids(activity.pid))) AS blocked`
      )[0].blocked;
      if (observed) break;
      await new Promise((r) => setTimeout(r, 25));
    }
  } finally {
    unlock();
    await Promise.all([holder, worker]);
  }
  expect(observed).toBe(true);
  await drain(id);
  expect(
    await prisma.securityDelivery.count({
      where: { eventId: id, recipientUserId: target },
    }),
  ).toBe(0);
}, 20000);
