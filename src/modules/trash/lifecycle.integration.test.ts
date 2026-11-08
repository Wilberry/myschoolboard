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
import {
  createLessonNote,
  readOwnLessonNotes,
  reviseLessonNote,
  submitLessonNote,
} from "@/src/modules/lesson-notes/service";
import { GET, POST } from "@/app/api/schools/[schoolId]/trash/route";
import { GET as PGET, POST as PPOST } from "@/app/api/platform/trash/route";
import { expireTrashBatch } from "./service";
const tag = randomUUID(),
  school = `p11-school-${tag}`,
  foreign = `p11-foreign-${tag}`,
  session = `p11-session-${tag}`,
  term = `p11-term-${tag}`,
  section = `p11-section-${tag}`,
  classId = `p11-class-${tag}`,
  subject = `p11-subject-${tag}`,
  assignment = `p11-assignment-${tag}`;
const users: Record<string, string> = {},
  members: Record<string, string> = {},
  cookies: Record<string, string> = {};
const password = "Synthetic-phase11-browser-password-42";
let noteId: string, caseId: string;
function actor(name: string) {
  ctx.headers = new Headers(cookies[name] ? { cookie: cookies[name] } : {});
}
function req(body?: unknown) {
  return new Request("http://localhost/api/trash", {
    method: body ? "POST" : "GET",
    ...(body
      ? {
          headers: {
            "content-type": "application/json",
            origin: new URL(env.BETTER_AUTH_URL).origin,
          },
          body: JSON.stringify(body),
        }
      : {}),
  });
}
function call(name: string, body?: unknown, schoolId = school) {
  actor(name);
  return (body ? POST : GET)(req(body), {
    params: Promise.resolve({ schoolId }),
  });
}
function platform(name: string, body?: unknown) {
  actor(name);
  return (body ? PPOST : PGET)(req(body));
}
function intent(action: string, extra: Record<string, unknown> = {}) {
  return {
    action,
    requestKey: randomUUID(),
    reason: "Synthetic isolated lifecycle acceptance",
    ...extra,
  };
}
async function event(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  action: string,
  version: number,
) {
  return tx.$executeRaw`INSERT INTO "TrashEvent" ("id","schoolId","caseId","action","actorUserId","requestKey","reason","version") VALUES (${randomUUID()}::uuid,${school},${id}::uuid,${action},${users.platform},${randomUUID()}::uuid,'Synthetic database clock boundary',${version})`;
}
beforeAll(async () => {
  verifyPhase9DatabaseIdentity(process.env);
  vi.stubEnv("PHASE11_TRASH_ENABLED", "true");
  await prisma.school.createMany({
    data: [
      { id: school, name: "Synthetic lifecycle school", slug: school },
      { id: foreign, name: "Synthetic foreign lifecycle", slug: foreign },
    ],
  });
  for (const [name, role] of [
    ["teacher", "TEACHER"],
    ["other", "TEACHER"],
    ["owner", "SCHOOL_SUPER_ADMIN"],
    ["admin", "SCHOOL_ADMIN"],
    ["student", "STUDENT"],
    ["parent", "PARENT"],
    ["foreign", "SCHOOL_SUPER_ADMIN"],
    ["platform", "SCHOOL_ADMIN"],
  ] as const) {
    const u = await auth.api.signUpEmail({
      body: {
        email: `p11-${name}-${tag}@example.test`,
        name: `Synthetic ${name}`,
        password,
      },
    });
    users[name] = u.user.id;
    members[name] = (
      await prisma.membership.create({
        data: {
          schoolId: name === "foreign" ? foreign : school,
          userId: u.user.id,
          role,
        },
      })
    ).id;
    const signed = await auth.api.signInEmail({
      body: { email: `p11-${name}-${tag}@example.test`, password },
      headers: new Headers({ origin: env.BETTER_AUTH_URL }),
      returnHeaders: true,
    });
    cookies[name] = signed.headers
      .getSetCookie()
      .map((s) => s.split(";")[0])
      .join("; ");
  }
  await prisma.user.update({
    where: { id: users.platform },
    data: { platformRole: "SUPER_ADMIN" },
  });
  const dates = {
    startsOn: new Date("2026-09-01Z"),
    endsOn: new Date("2027-07-31Z"),
  };
  await prisma.academicSession.create({
    data: {
      id: session,
      schoolId: school,
      name: "Synthetic lifecycle session",
      status: "ACTIVE",
      ...dates,
    },
  });
  await prisma.academicTerm.create({
    data: {
      id: term,
      schoolId: school,
      sessionId: session,
      name: "Synthetic lifecycle term",
      position: 1,
      status: "ACTIVE",
      ...dates,
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
      name: "Synthetic class",
    },
  });
  await prisma.subject.create({
    data: { id: subject, schoolId: school, name: "Synthetic subject" },
  });
  await prisma.teacherClassSubjectAssignment.create({
    data: {
      id: assignment,
      schoolId: school,
      sessionId: session,
      membershipId: members.teacher,
      classId,
      subjectId: subject,
    },
  });
  actor("teacher");
  noteId = (
    await createLessonNote(school, {
      termId: term,
      assignmentId: assignment,
      topic: "Synthetic private lifecycle draft",
      objectives: "Synthetic objectives",
      content: "Synthetic protected draft content",
    })
  ).id;
}, 45000);
afterAll(async () => {
  vi.unstubAllEnvs();
  if (process.env.PHASE11_BROWSER_FIXTURE_FILE) {
    const path = process.env.PHASE11_BROWSER_FIXTURE_FILE;
    if (!/^\/tmp\/phase11-[\w-]+\.json$/.test(path))
      throw Error("Private path required");
    await writeFile(
      path,
      JSON.stringify({
        school,
        foreign,
        tag,
        users,
        members,
        password,
        noteId,
        caseId,
        assignment,
        term,
      }),
      { mode: 0o600, flag: "wx" },
    );
  } else {
    await prisma.school.deleteMany({
      where: { id: { in: [school, foreign] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
  }
  await prisma.$disconnect();
});
it("keeps feature default-off and enforces real tenant and role boundaries", async () => {
  vi.stubEnv("PHASE11_TRASH_ENABLED", "false");
  expect((await call("owner")).status).toBe(404);
  vi.stubEnv("PHASE11_TRASH_ENABLED", "true");
  expect((await call("")).status).toBe(401);
  for (const a of ["admin", "student", "parent", "foreign", "platform"])
    expect((await call(a)).status).toBe(404);
  for (const a of ["teacher", "owner", "admin", "student", "foreign"])
    expect((await platform(a)).status).toBe(404);
  expect((await call("other", intent("TRASH", { noteId }))).status).toBe(404);
  expect(
    (await call("teacher", intent("TRASH", { noteId }), foreign)).status,
  ).toBe(404);
  actor("teacher");
  for (const origin of ["https://foreign.example", "null", ""]) {
    const response = await POST(
      new Request("http://localhost/api/trash", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(origin ? { origin } : {}),
        },
        body: JSON.stringify(intent("TRASH", { noteId })),
      }),
      { params: Promise.resolve({ schoolId: school }) },
    );
    expect(response.status).toBe(400);
  }
  // Reject JSON lookalike media types before any state-changing service call.
  actor("teacher");
  for (const contentType of [
    "application/jsonp",
    "application/json-seq",
    "application/json; charset=iso-8859-1",
    "text/plain",
  ]) {
    const response = await POST(
      new Request("http://localhost/api/trash", {
        method: "POST",
        headers: {
          "content-type": contentType,
          origin: new URL(env.BETTER_AUTH_URL).origin,
        },
        body: JSON.stringify(intent("TRASH", { noteId })),
      }),
      { params: Promise.resolve({ schoolId: school }) },
    );
    expect(response.status).toBe(400);
  }
  actor("teacher");
  for (const [body, declaredLength] of [
    ["x".repeat(4097), undefined],
    [JSON.stringify(intent("TRASH", { noteId })), "999999"],
  ] as const) {
    const response = await POST(
      new Request("http://localhost/api/trash", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: new URL(env.BETTER_AUTH_URL).origin,
          ...(declaredLength ? { "content-length": declaredLength } : {}),
        },
        body,
      }),
      { params: Promise.resolve({ schoolId: school }) },
    );
    expect(response.status).toBe(400);
  }
  // A syntactically valid declared byte count must reach the ordinary
  // authorization path; the length guard must not reject every request.
  actor("other");
  const validBody = JSON.stringify(intent("TRASH", { noteId }));
  expect(
    (
      await POST(
        new Request("http://localhost/api/trash", {
          method: "POST",
          headers: {
            "content-type": "application/json; charset=utf-8",
            origin: new URL(env.BETTER_AUTH_URL).origin,
            "content-length": String(Buffer.byteLength(validBody)),
          },
          body: validBody,
        }),
        { params: Promise.resolve({ schoolId: school }) },
      )
    ).status,
  ).toBe(404);
  actor("platform");
  expect(
    (
      await PPOST(
        new Request("http://localhost/api/platform/trash", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://foreign.example",
          },
          body: JSON.stringify(
            intent("HOLD", {
              schoolId: school,
              caseId: randomUUID(),
              expectedVersion: 1,
            }),
          ),
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    await prisma.trashCase.count({ where: { schoolId: school, noteId } }),
  ).toBe(0);
  expect(
    (
      await call("teacher", {
        ...intent("TRASH", { noteId }),
        createdAt: "2000-01-01",
      })
    ).status,
  ).toBe(400);
});
it("trashes once under concurrent exact retries, conceals source and freezes revisions", async () => {
  const body = intent("TRASH", { noteId });
  const results = await Promise.all([
    call("teacher", body),
    call("teacher", body),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
  caseId = (await results[0].json()).result.id;
  const c = await prisma.trashCase.findUniqueOrThrow({ where: { id: caseId } });
  expect(c.schoolExpiresAt.getTime() - c.createdAt.getTime()).toBe(
    30 * 86400000,
  );
  actor("teacher");
  expect(await readOwnLessonNotes(school)).toEqual([]);
  await expect(readOwnLessonNotes(school, noteId)).rejects.toThrow();
  await expect(
    reviseLessonNote(school, noteId, {
      expectedRevision: 1,
      topic: "Changed",
      objectives: "changed",
      content: "changed",
    }),
  ).rejects.toThrow();
  await expect(
    submitLessonNote(school, noteId, { expectedRevision: 1 }),
  ).rejects.toThrow();
  await expect(
    prisma.lessonNote.update({
      where: { id: noteId },
      data: { topic: "SQL bypass" },
    }),
  ).rejects.toThrow();
  expect(await prisma.trashEvent.count({ where: { caseId } })).toBe(1);
});
it("preserves content and tenant lineage on scoped restoration; rejects stale keys and other teachers", async () => {
  expect(
    (await call("other", intent("RESTORE", { caseId, expectedVersion: 1 })))
      .status,
  ).toBe(404);
  const body = intent("RESTORE", { caseId, expectedVersion: 1 });
  expect((await call("teacher", body)).status).toBe(201);
  expect((await call("teacher", body)).status).toBe(200);
  expect(
    (await call("teacher", { ...body, reason: "Changed replay reason" }))
      .status,
  ).toBe(409);
  actor("teacher");
  const detail = await readOwnLessonNotes(school, noteId);
  expect(
    (Array.isArray(detail)
      ? (() => {
          throw Error("Single note required");
        })()
      : detail
    ).revisions[0].content,
  ).toBe("Synthetic protected draft content");
  expect(
    (await prisma.trashCase.findUniqueOrThrow({ where: { id: caseId } })).state,
  ).toBe("RESTORED");
});
it("separates school recovery removal from platform-only metadata and scoped recovery authorization", async () => {
  const r = await call("teacher", intent("TRASH", { noteId }));
  caseId = (await r.json()).result.id;
  expect(
    (
      await call(
        "teacher",
        intent("REMOVE_SCHOOL", { caseId, expectedVersion: 1 }),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await call(
        "owner",
        intent("REMOVE_SCHOOL", { caseId, expectedVersion: 1 }),
      )
    ).status,
  ).toBe(201);
  expect((await (await call("owner")).json()).items).toEqual([]);
  const p = await platform("platform");
  expect(p.status).toBe(200);
  expect(JSON.stringify(await p.json())).not.toMatch(
    /Synthetic private|protected draft content|objectives|reason|actorUserId/,
  );
  expect(
    (await call("teacher", intent("RESTORE", { caseId, expectedVersion: 2 })))
      .status,
  ).toBe(404);
  expect(
    (
      await platform(
        "owner",
        intent("AUTHORIZE_RECOVERY", {
          caseId,
          schoolId: school,
          expectedVersion: 2,
        }),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await platform(
        "platform",
        intent("AUTHORIZE_RECOVERY", {
          caseId,
          schoolId: school,
          expectedVersion: 2,
        }),
      )
    ).status,
  ).toBe(201);
  expect(
    (await call("teacher", intent("RESTORE", { caseId, expectedVersion: 3 })))
      .status,
  ).toBe(201);
});
it("enforces holds, immutable history, and never permits protected source deletion", async () => {
  caseId = (await (await call("teacher", intent("TRASH", { noteId }))).json())
    .result.id;
  expect(
    (
      await platform(
        "platform",
        intent("HOLD", { caseId, schoolId: school, expectedVersion: 1 }),
      )
    ).status,
  ).toBe(201);
  expect(
    (await call("teacher", intent("RESTORE", { caseId, expectedVersion: 2 })))
      .status,
  ).toBe(404);
  await expect(
    prisma.trashCase.update({
      where: { id: caseId },
      data: { legalHold: false },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.trashEvent.deleteMany({ where: { caseId } }),
  ).rejects.toThrow();
  await expect(
    prisma.$executeRawUnsafe('TRUNCATE "TrashEvent"'),
  ).rejects.toThrow();
  await expect(
    prisma.lessonNote.delete({ where: { id: noteId } }),
  ).rejects.toThrow();
  expect(
    (
      await platform(
        "platform",
        intent("RELEASE_HOLD", {
          caseId,
          schoolId: school,
          expectedVersion: 2,
        }),
      )
    ).status,
  ).toBe(201);
});
it("checks exact database-clock 30/90-day boundaries without production clock overrides or resetting data", async () => {
  const rollback = Symbol("clock rollback");
  const c = await prisma.trashCase.findUniqueOrThrow({ where: { id: caseId } });
  await expect(
    prisma.$transaction(async (tx) => {
      // Test-only transactional DDL; always rolled back. No clock injection exists in API/config.
      const at = (
        await tx.$queryRaw<
          Array<{ stamp: string }>
        >`SELECT "schoolExpiresAt"::text AS stamp FROM "TrashCase" WHERE "id"=${caseId}::uuid`
      )[0].stamp;
      expect(at).toMatch(/^[0-9:. +\-]+$/);
      await tx.$executeRawUnsafe(
        `CREATE OR REPLACE FUNCTION phase11_now() RETURNS TIMESTAMPTZ LANGUAGE SQL VOLATILE AS $$ SELECT '${at}'::timestamptz $$`,
      );
      await event(tx, caseId, "EXPIRE_SCHOOL", 3);
      let row = await tx.trashCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(row.state).toBe("PLATFORM");
      expect(row.platformEnteredAt?.toISOString()).toBe(
        c.schoolExpiresAt.toISOString(),
      );
      expect(
        row.platformExpiresAt!.getTime() - row.platformEnteredAt!.getTime(),
      ).toBe(90 * 86400000);
      const expiry = (
        await tx.$queryRaw<
          Array<{ stamp: string }>
        >`SELECT "platformExpiresAt"::text AS stamp FROM "TrashCase" WHERE "id"=${caseId}::uuid`
      )[0].stamp;
      expect(expiry).toMatch(/^[0-9:. +\-]+$/);
      await tx.$executeRawUnsafe(
        `CREATE OR REPLACE FUNCTION phase11_now() RETURNS TIMESTAMPTZ LANGUAGE SQL VOLATILE AS $$ SELECT '${expiry}'::timestamptz $$`,
      );
      await event(tx, caseId, "EXPIRE_PLATFORM", 4);
      row = await tx.trashCase.findUniqueOrThrow({ where: { id: caseId } });
      expect(row.state).toBe("PURGE_BLOCKED");
      expect(await tx.lessonNoteRevision.count({ where: { noteId } })).toBe(1);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
  expect(
    (await prisma.trashCase.findUniqueOrThrow({ where: { id: caseId } })).state,
  ).toBe("SCHOOL");
  expect((await expireTrashBatch(users.platform)).processed).toBe(0);
  await expect(expireTrashBatch(users.teacher)).rejects.toThrow();
});
it("captures one immutable minimal envelope per actual lifecycle event without foreign or invented sources", async () => {
  const events = await prisma.trashEvent.findMany({
    where: { schoolId: school },
  });
  expect(events.length).toBeGreaterThan(0);
  for (const e of events) {
    const outbox = await prisma.trashEventOutbox.findUniqueOrThrow({
      where: { eventId: e.id },
    });
    expect(outbox).toMatchObject({
      schoolId: e.schoolId,
      caseId: e.caseId,
      schemaVersion: 1,
      action: e.action,
      sourceVersion: e.version,
      actorUserId: e.actorUserId,
    });
    const exact = await prisma.$queryRaw<
      Array<{ exact: boolean }>
    >`SELECT o."occurredAt"=e."createdAt" AS exact FROM "TrashEventOutbox" o JOIN "TrashEvent" e ON e."id"=o."eventId" WHERE e."id"=${e.id}::uuid`;
    expect(exact[0].exact).toBe(true);
    expect(Object.keys(outbox).sort()).toEqual([
      "action",
      "actorUserId",
      "capturedAt",
      "caseId",
      "eventId",
      "occurredAt",
      "schemaVersion",
      "schoolId",
      "sourceVersion",
    ]);
  }
  const e = events[0];
  await expect(
    prisma.trashEventOutbox.create({
      data: {
        eventId: randomUUID(),
        schoolId: foreign,
        caseId: e.caseId,
        action: e.action,
        sourceVersion: e.version,
        actorUserId: e.actorUserId,
        occurredAt: e.createdAt,
      },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.trashEventOutbox.update({
      where: { eventId: e.id },
      data: { schoolId: foreign },
    }),
  ).rejects.toThrow();
  await expect(
    prisma.trashEventOutbox.delete({ where: { eventId: e.id } }),
  ).rejects.toThrow();
  await expect(
    prisma.$executeRaw`TRUNCATE "TrashEventOutbox"`,
  ).rejects.toThrow();
});
it("rolls back trash state, source concealment and event when durable capture fails, then retries exactly once", async () => {
  actor("teacher");
  const note = await createLessonNote(school, {
    termId: term,
    assignmentId: assignment,
    topic: "Synthetic atomic lifecycle capture",
    objectives: "Verify all-or-nothing source transition",
    content: "Original synthetic draft retained after failed outbox capture.",
  });
  const fn = "p11_outbox_fault_" + tag.replaceAll("-", "");
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW."schoolId"='${school}' THEN RAISE EXCEPTION 'Synthetic lifecycle capture failure';END IF;RETURN NEW;END; $$ LANGUAGE plpgsql`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${fn}" AFTER INSERT ON "TrashEventOutbox" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
  );
  const body = intent("TRASH", { noteId: note.id });
  try {
    expect((await call("teacher", body)).status).toBe(500);
    expect(
      await prisma.trashCase.count({
        where: { schoolId: school, noteId: note.id },
      }),
    ).toBe(0);
    actor("teacher");
    expect(await readOwnLessonNotes(school, note.id)).toBeTruthy();
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER "${fn}" ON "TrashEventOutbox"`,
    );
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`);
  }
  expect((await call("teacher", body)).status).toBe(201);
  expect((await call("teacher", body)).status).toBe(200);
  const c = await prisma.trashCase.findFirstOrThrow({
    where: { schoolId: school, noteId: note.id },
  });
  expect(await prisma.trashEvent.count({ where: { caseId: c.id } })).toBe(1);
  expect(await prisma.trashEventOutbox.count({ where: { caseId: c.id } })).toBe(
    1,
  );
});

it("revocation denies restoration and hides school metadata without resurrecting old authority", async () => {
  await prisma.teacherClassSubjectAssignment.update({
    where: { id: assignment },
    data: { status: "REVOKED" },
  });
  expect((await (await call("teacher")).json()).items).toEqual([]);
  expect(
    (await call("teacher", intent("RESTORE", { caseId, expectedVersion: 3 })))
      .status,
  ).toBe(404);
  expect(
    (await call("owner", intent("RESTORE", { caseId, expectedVersion: 3 })))
      .status,
  ).toBe(404);
  // Browser fixtures use a fresh authorized assignment and fresh draft, never reactivate revoked authority.
  if (process.env.PHASE11_BROWSER_FIXTURE_FILE) {
    const freshSubject = await prisma.subject.create({
      data: { schoolId: school, name: "Synthetic browser subject" },
    });
    const a = await prisma.teacherClassSubjectAssignment.create({
      data: {
        schoolId: school,
        sessionId: session,
        membershipId: members.teacher,
        classId,
        subjectId: freshSubject.id,
      },
    });
    actor("teacher");
    noteId = (
      await createLessonNote(school, {
        termId: term,
        assignmentId: a.id,
        topic: "Synthetic browser lifecycle draft",
        objectives: "Synthetic objectives",
        content: "Synthetic browser-only private draft",
      })
    ).id;
  }
});
