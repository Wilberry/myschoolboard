import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { verifyPhase9DatabaseIdentity } from "@/scripts/verify-phase9-disposable.mjs";
const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => ctx.headers }));
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { POST as authPOST } from "@/app/api/auth/[...all]/route";
import { GET as ownGET } from "@/app/api/account/security-evidence/route";
import { GET as platformGET } from "@/app/api/platform/security-evidence/route";
const tag = randomUUID(),
  password = "Synthetic-security-" + randomUUID(),
  school = "p10-security-" + tag;
const emails = {
  owner: `p10-security-owner-${tag}@example.test`,
  operator: `p10-security-operator-${tag}@example.test`,
  other: `p10-security-other-${tag}@example.test`,
};
const users: Record<string, string> = {},
  cookies: Record<string, string> = {};
async function signIn(who: keyof typeof emails) {
  const response = await auth.api.signInEmail({
    body: { email: emails[who], password },
    returnHeaders: true,
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
  });
  return response.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
}
const request = (path: string, body: unknown, cookie?: string) =>
  new Request(env.BETTER_AUTH_URL + "/api/auth" + path, {
    method: "POST",
    headers: {
      origin: env.BETTER_AUTH_URL,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  verifyPhase9DatabaseIdentity(process.env);
  vi.stubEnv("PHASE10_AUTH_SECURITY_ENABLED", "true");
  for (const [name, email] of Object.entries(emails)) {
    const created = await auth.api.signUpEmail({
      body: { email, password, name: "Synthetic account security actor" },
    });
    users[name] = created.user.id;
  }
  await prisma.user.update({
    where: { id: users.operator },
    data: { platformRole: "SUPER_ADMIN" },
  });
  await prisma.school.create({
    data: { id: school, slug: school, name: "Synthetic security school" },
  });
  await prisma.membership.create({
    data: { schoolId: school, userId: users.owner, role: "SCHOOL_SUPER_ADMIN" },
  });
  for (const who of Object.keys(emails) as Array<keyof typeof emails>)
    cookies[who] = await signIn(who);
}, 30000);
afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.school.deleteMany({ where: { id: school } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});
it("captures real successful sessions, unknown failures and exactly one HTTP failure without credentials", async () => {
  const success = await prisma.authSecurityEvidence.findMany({
    where: { subjectUserId: users.owner },
  });
  expect(
    success.some((e) => e.kind === "SESSION_CREATED" && e.actorUserId === null),
  ).toBe(true);
  expect(
    success.some(
      (e) => e.kind === "AUTH_SUCCEEDED" && e.actorUserId === users.owner,
    ),
  ).toBe(true);
  const before = await prisma.authSecurityEvidence.count({
    where: { kind: "AUTH_FAILED" },
  });
  await expect(
    auth.api.signInEmail({
      body: { email: emails.owner, password: "Incorrect synthetic password" },
    }),
  ).rejects.toThrow();
  expect(
    await prisma.authSecurityEvidence.count({ where: { kind: "AUTH_FAILED" } }),
  ).toBe(before + 1);
  const response = await authPOST(
    request("/sign-in/email", {
      email: `unknown-${tag}@example.test`,
      password,
    }),
  );
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(
    await prisma.authSecurityEvidence.count({ where: { kind: "AUTH_FAILED" } }),
  ).toBe(before + 2);
  const unknown = await prisma.authSecurityEvidence.findMany({
    where: { kind: "AUTH_FAILED" },
    orderBy: { recordedAt: "desc" },
    take: 2,
  });
  expect(
    unknown.every(
      (e) =>
        e.subjectUserId === null &&
        e.actorUserId === null &&
        e.sessionRecordId === null,
    ),
  ).toBe(true);
  const rows = await prisma.authSecurityEvidence.findMany({
    where: {
      OR: [
        { subjectUserId: { in: Object.values(users) } },
        { id: { in: unknown.map((e) => e.id) } },
      ],
    },
  });
  const serialized = JSON.stringify(rows);
  for (const forbidden of [password, ...Object.values(emails), cookies.owner])
    expect(serialized).not.toContain(forbidden);
  for (const row of rows)
    expect(
      await prisma.authSecurityOutbox.count({
        where: { eventId: row.id, state: "PENDING" },
      }),
    ).toBe(1);
});
it("confines self evidence to the account and requires current platform authority for global metadata", async () => {
  const request = new Request(
    env.BETTER_AUTH_URL + "/api/account/security-evidence",
  );
  ctx.headers = new Headers();
  expect((await ownGET(request)).status).toBe(401);
  for (const who of ["owner", "other", "operator"]) {
    ctx.headers = new Headers({ cookie: cookies[who] });
    const response = await ownGET(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.evidence.length).toBeGreaterThan(0);
    expect(
      body.evidence.every(
        (e: { subjectUserId: string }) => e.subjectUserId === users[who],
      ),
    ).toBe(true);
    expect(Object.keys(body.evidence[0]).sort()).toEqual([
      "actorUserId",
      "at",
      "id",
      "kind",
      "method",
      "subjectUserId",
    ]);
    const global = await platformGET(request);
    expect(global.status).toBe(who === "operator" ? 200 : 404);
  }
  ctx.headers = new Headers({ cookie: cookies.owner });
  expect(
    (await ownGET(new Request(request.url + "?userId=" + users.other))).status,
  ).toBe(400);
});
it("never confirms logout while a failed database deletion leaves the real session valid", async () => {
  const cookie = await signIn("other");
  const current = await auth.api.getSession({
    headers: new Headers({ cookie }),
  });
  expect(current).toBeTruthy();
  const fn = "p10_logout_fault_" + tag.replaceAll("-", "");
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW."subjectUserId"='${users.other}' AND NEW."kind"='SESSION_ENDED' THEN RAISE EXCEPTION 'Synthetic session evidence failure';END IF;RETURN NEW;END; $$ LANGUAGE plpgsql`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${fn}" BEFORE INSERT ON "AuthSecurityEvidence" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
  );
  const diagnostics = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const failed = await authPOST(request("/sign-out", {}, cookie));
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(failed.headers.get("set-cookie")).toBeNull();
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie }) }),
    ).toBeTruthy();
    expect(
      await prisma.authSecurityEvidence.count({
        where: {
          kind: "LOGOUT_FAILED",
          subjectUserId: users.other,
          sessionRecordId: current!.session.id,
        },
      }),
    ).toBe(1);
    const logs = JSON.stringify(diagnostics.mock.calls);
    expect(logs).not.toContain(cookie);
    expect(logs).not.toContain(password);
    expect(logs).not.toContain("Synthetic session evidence failure");
  } finally {
    diagnostics.mockRestore();
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "${fn}" ON "AuthSecurityEvidence"`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`);
  }
  const success = await authPOST(request("/sign-out", {}, cookie));
  expect(success.status).toBe(200);
  expect(
    await auth.api.getSession({ headers: new Headers({ cookie }) }),
  ).toBeNull();
  expect(
    await prisma.authSecurityEvidence.count({
      where: {
        kind: "LOGOUT_COMPLETED",
        subjectUserId: users.other,
        sessionRecordId: current!.session.id,
      },
    }),
  ).toBe(1);
  expect(
    await prisma.authSecurityEvidence.count({
      where: {
        kind: "SESSION_ENDED",
        subjectUserId: users.other,
        sessionRecordId: current!.session.id,
      },
    }),
  ).toBe(1);
});
it("rolls back session creation if durable outbox capture fails and preserves immutable evidence", async () => {
  const before = await prisma.session.count({ where: { userId: users.other } });
  const fn = "p10_security_fault_" + tag.replaceAll("-", "");
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF EXISTS(SELECT 1 FROM "AuthSecurityEvidence" e WHERE e."id"=NEW."eventId" AND e."kind"='SESSION_CREATED' AND e."subjectUserId"='${users.other}') THEN RAISE EXCEPTION 'Synthetic security outbox failure';END IF;RETURN NEW;END; $$ LANGUAGE plpgsql`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${fn}" AFTER INSERT ON "AuthSecurityOutbox" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
  );
  const diagnostics = vi.spyOn(console, "warn").mockImplementation(() => {});
  const errorDiagnostics = vi
    .spyOn(console, "error")
    .mockImplementation(() => {});
  try {
    const response = await authPOST(
      request("/sign-in/email", { email: emails.other, password }),
    );
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await prisma.session.count({ where: { userId: users.other } })).toBe(
      before,
    );
    const logs = JSON.stringify([
      ...diagnostics.mock.calls,
      ...errorDiagnostics.mock.calls,
    ]);
    for (const secret of [
      password,
      cookies.other,
      "Synthetic security outbox failure",
      "PrismaClientKnownRequestError",
    ])
      expect(logs).not.toContain(secret);
    expect(
      errorDiagnostics.mock.calls.every(
        (args) =>
          args.length === 1 &&
          args[0] ===
            JSON.stringify({
              event: "authentication_audit_operation_unavailable",
            }),
      ),
    ).toBe(true);
  } finally {
    diagnostics.mockRestore();
    errorDiagnostics.mockRestore();
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "${fn}" ON "AuthSecurityOutbox"`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`);
  }
  const evidence = await prisma.authSecurityEvidence.findFirstOrThrow({
    where: { subjectUserId: users.owner },
  });
  await expect(
    prisma.authSecurityEvidence.update({
      where: { id: evidence.id },
      data: { kind: "AUTH_FAILED" },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.authSecurityEvidence.delete({ where: { id: evidence.id } }),
  ).rejects.toThrow();
  await expect(
    prisma.$executeRaw`TRUNCATE "AuthSecurityEvidence" CASCADE`,
  ).rejects.toThrow();
});
it("denies fabricated session evidence and forces actual database provenance", async () => {
  const before = new Date();
  const row = await prisma.authSecurityEvidence.create({
    data: {
      kind: "AUTH_FAILED",
      method: "EMAIL_SIGN_IN",
      databasePrincipal: "invented",
      recordedAt: new Date(0),
    },
  });
  expect(row.databasePrincipal).not.toBe("invented");
  expect(row.recordedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  await expect(
    prisma.authSecurityEvidence.create({
      data: {
        kind: "SESSION_CREATED",
        method: "DATABASE_SESSION",
        subjectUserId: users.owner,
      },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.authSecurityEvidence.create({
      data: {
        kind: "SESSION_CREATED",
        method: "EMAIL_SIGN_IN",
        subjectUserId: users.owner,
        actorUserId: users.owner,
        sessionRecordId: randomUUID(),
      },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.authSecurityEvidence.create({
      data: {
        kind: "AUTH_SUCCEEDED",
        method: "EMAIL_SIGN_IN",
        subjectUserId: users.owner,
        sessionRecordId: randomUUID(),
      },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.authSecurityOutbox.delete({ where: { eventId: row.id } }),
  ).rejects.toThrow();
  await expect(
    prisma.$executeRaw`TRUNCATE "AuthSecurityOutbox"`,
  ).rejects.toThrow();
});
it("withholds credentials and compensates the new session when mandatory success evidence fails", async () => {
  const before = await prisma.session.count({ where: { userId: users.other } });
  const fn = "p10_success_fault_" + tag.replaceAll("-", "");
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW."subjectUserId"='${users.other}' AND NEW."kind"='AUTH_SUCCEEDED' THEN RAISE EXCEPTION 'Synthetic success audit failure';END IF;RETURN NEW;END; $$ LANGUAGE plpgsql`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${fn}" BEFORE INSERT ON "AuthSecurityEvidence" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
  );
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const response = await authPOST(
      request("/sign-in/email", { email: emails.other, password }),
    );
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await prisma.session.count({ where: { userId: users.other } })).toBe(
      before,
    );
  } finally {
    warn.mockRestore();
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "${fn}" ON "AuthSecurityEvidence"`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`);
  }
});

it("paginates over 100 immutable account events with exact cursor ownership and scope", async () => {
  const sessions = Array.from({ length: 101 }, (_, i) => ({
    id: `security-page-${tag}-${i}`,
    token: randomUUID(),
    userId: users.owner,
    expiresAt: new Date(Date.now() + 3600000),
  }));
  await prisma.session.createMany({ data: sessions });
  ctx.headers = new Headers({ cookie: cookies.owner });
  const url = env.BETTER_AUTH_URL + "/api/account/security-evidence";
  const first = await (await ownGET(new Request(url))).json();
  expect(first.evidence).toHaveLength(100);
  expect(first.nextCursor).toBeTruthy();
  const second = await (
    await ownGET(
      new Request(url + "?cursor=" + encodeURIComponent(first.nextCursor)),
    )
  ).json();
  const all = [...first.evidence, ...second.evidence];
  expect(new Set(all.map((e: { id: string }) => e.id)).size).toBe(all.length);
  expect(all.length).toBe(
    await prisma.authSecurityEvidence.count({
      where: { subjectUserId: users.owner },
    }),
  );
  expect(second.nextCursor).toBeNull();
  ctx.headers = new Headers({ cookie: cookies.other });
  expect(
    (
      await ownGET(
        new Request(url + "?cursor=" + encodeURIComponent(first.nextCursor)),
      )
    ).status,
  ).toBe(404);
  ctx.headers = new Headers({ cookie: cookies.operator });
  const platform = await (await platformGET(new Request(url))).json();
  expect(platform.nextCursor).toBeTruthy();
  expect(
    (
      await ownGET(
        new Request(url + "?cursor=" + encodeURIComponent(platform.nextCursor)),
      )
    ).status,
  ).toBe(400);
});

it("revokes platform evidence access for a still-authenticated operator", async () => {
  await prisma.user.update({
    where: { id: users.operator },
    data: { platformRole: "NONE" },
  });
  ctx.headers = new Headers({ cookie: cookies.operator });
  expect(
    (
      await platformGET(
        new Request(env.BETTER_AUTH_URL + "/api/platform/security-evidence"),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await ownGET(
        new Request(env.BETTER_AUTH_URL + "/api/account/security-evidence"),
      )
    ).status,
  ).toBe(200);
});
