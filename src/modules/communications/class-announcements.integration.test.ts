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
  createClassAnnouncement as create,
  transitionClassAnnouncement as action,
  reviseClassAnnouncement as revise,
  readClassAnnouncements as feed,
  classAnnouncementWorkspace as workspace,
} from "./class-announcements";
import { attestStudentAccount } from "@/src/modules/students/account-link-service";
import { attestGuardianStudentLink } from "@/src/modules/students/guardian-link-service";
const tag = randomUUID(),
  s = "p10-class-" + tag,
  foreign = s + "-foreign",
  session = s + "-session",
  term = s + "-term",
  section = s + "-section",
  room = s + "-room",
  subject = s + "-subject",
  assignment = s + "-assignment",
  responsibility = s + "-form";
const users: Record<string, string> = {},
  members: Record<string, string> = {},
  cookies: Record<string, string> = {};
let a: string, r: string, pupil: string;
const intent = (extra = {}) => ({
  requestKey: randomUUID(),
  reason: "Synthetic separate class channel verification",
  ...extra,
});
const actor = (name: string) => {
  ctx.headers = new Headers({
    cookie: cookies[name],
    origin: env.BETTER_AUTH_URL,
  });
};
import {
  deliverClassBatch,
  readClassInbox,
  changeClassNotification,
  replayClassDelivery,
} from "@/src/modules/notifications/class-inapp";
beforeAll(async () => {
  verifyPhase9DatabaseIdentity(process.env);
  vi.stubEnv("PHASE10_CLASS_ANNOUNCEMENTS_ENABLED", "true");
  vi.stubEnv("PHASE10_INAPP_ENABLED", "true");
  await prisma.school.createMany({
    data: [
      { id: s, name: "Synthetic class school", slug: s },
      { id: foreign, name: "Synthetic foreign school", slug: foreign },
    ],
  });
  for (const [name, role, school] of [
    ["teacher", "TEACHER", s],
    ["form", "FORM_TEACHER", s],
    ["reviewer", "HEAD_OF_SECTION", s],
    ["owner", "SCHOOL_SUPER_ADMIN", s],
    ["admin", "SCHOOL_ADMIN", s],
    ["student", "STUDENT", s],
    ["parent", "PARENT", s],
    ["foreign", "TEACHER", foreign],
  ] as const) {
    const password = "Synthetic-class-announcement-password-42";
    const email = `p10-class-${name}-${tag}@example.test`;
    const signup = await auth.api.signUpEmail({
      body: { email, password, name: "Synthetic class actor" },
    });
    users[name] = signup.user.id;
    members[name] = (
      await prisma.membership.create({
        data: { schoolId: school, userId: signup.user.id, role },
      })
    ).id;
    const signed = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers({ origin: env.BETTER_AUTH_URL }),
      returnHeaders: true,
    });
    cookies[name] = signed.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
  }
  await prisma.academicSession.create({
    data: {
      id: session,
      schoolId: s,
      name: "Synthetic session",
      status: "ACTIVE",
      startsOn: new Date("2026-09-01Z"),
      endsOn: new Date("2027-08-01Z"),
    },
  });
  await prisma.academicTerm.create({
    data: {
      id: term,
      schoolId: s,
      sessionId: session,
      name: "Synthetic term",
      position: 1,
      status: "ACTIVE",
      startsOn: new Date("2026-09-01Z"),
      endsOn: new Date("2026-12-20Z"),
    },
  });
  await prisma.schoolSection.create({
    data: { id: section, schoolId: s, name: "Primary", stage: "PRIMARY" },
  });
  await prisma.schoolClass.create({
    data: {
      id: room,
      schoolId: s,
      sectionId: section,
      name: "Synthetic class",
    },
  });
  await prisma.subject.create({
    data: { id: subject, schoolId: s, name: "Synthetic subject" },
  });
  await prisma.teacherClassSubjectAssignment.create({
    data: {
      id: assignment,
      schoolId: s,
      membershipId: members.teacher,
      classId: room,
      subjectId: subject,
      sessionId: session,
    },
  });
  await prisma.formTeacherResponsibility.create({
    data: {
      id: responsibility,
      schoolId: s,
      membershipId: members.form,
      classId: room,
      sessionId: session,
    },
  });
  await prisma.scopeGrant.create({
    data: {
      membershipId: members.reviewer,
      type: "SECTION",
      scopeId: section,
      verified: true,
    },
  });
  pupil = (
    await prisma.studentRecord.create({
      data: {
        schoolId: s,
        admissionNumber: tag,
        givenName: "Synthetic",
        familyName: "Class pupil",
        status: "ENROLLED",
      },
    })
  ).id;
  await prisma.studentEnrollment.create({
    data: { schoolId: s, studentId: pupil, classId: room, sessionId: session },
  });
  actor("admin");
  await attestStudentAccount(s, {
    studentId: pupil,
    studentMembershipId: members.student,
    identityVerified: true,
    reason: "Synthetic attested pupil account",
  });
  await attestGuardianStudentLink(s, {
    studentId: pupil,
    guardianMembershipId: members.parent,
    relationshipVerified: true,
    reason: "Synthetic separately attested guardian",
  });
}, 45000);
afterAll(async () => {
  vi.unstubAllEnvs();
  if (process.env.PHASE10_CLASS_BROWSER_FIXTURE_FILE) {
    await prisma.$disconnect();
    return;
  }
  await prisma.school.deleteMany({ where: { id: { in: [s, foreign] } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});
it("defaults off and derives exact teacher scope, denies owner/admin/guardian/foreign authoring", async () => {
  actor("teacher");
  vi.stubEnv("PHASE10_CLASS_ANNOUNCEMENTS_ENABLED", "false");
  await expect(
    create(
      s,
      intent({
        assignmentId: assignment,
        termId: term,
        title: "Denied",
        body: "Denied",
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  vi.stubEnv("PHASE10_CLASS_ANNOUNCEMENTS_ENABLED", "true");
  for (const name of ["owner", "admin", "parent", "student", "foreign"]) {
    actor(name);
    await expect(
      create(
        s,
        intent({
          assignmentId: assignment,
          termId: term,
          title: "Denied",
          body: "Denied",
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
  actor("teacher");
  const data = intent({
    assignmentId: assignment,
    termId: term,
    title: "Synthetic class announcement",
    body: "Private pupil class announcement",
  });
  const created = await Promise.all([create(s, data), create(s, data)]);
  a = created[0].id;
  expect(created.map((x) => x.replay).sort()).toEqual([false, true]);
  await expect(create(s, { ...data, classId: room })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(create(s, { ...data, title: "Changed" })).rejects.toMatchObject({
    code: "CONFLICT",
  });
});
it("requires independent verified section review and original teacher release", async () => {
  actor("teacher");
  await action(s, a, intent({ action: "SUBMIT", expectedRevision: 1 }));
  await expect(
    action(s, a, intent({ action: "APPROVE", expectedRevision: 1 })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("owner");
  await expect(
    action(s, a, intent({ action: "APPROVE", expectedRevision: 1 })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("reviewer");
  await action(s, a, intent({ action: "RETURN", expectedRevision: 1 }));
  actor("teacher");
  await revise(
    s,
    a,
    intent({
      expectedRevision: 1,
      title: "Revised class announcement",
      body: "Synthetic revised private class announcement",
    }),
  );
  await action(s, a, intent({ action: "SUBMIT", expectedRevision: 2 }));
  actor("reviewer");
  expect((await workspace(s)).announcements.some((x) => x.id === a)).toBe(true);
  await action(s, a, intent({ action: "APPROVE", expectedRevision: 2 }));
  await expect(
    action(s, a, intent({ action: "RELEASE", expectedRevision: 2 })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("teacher");
  r = (await action(s, a, intent({ action: "RELEASE", expectedRevision: 2 })))
    .id;
});
it("captures class release atomically, deduplicates concurrent delivery and isolates class inbox reads", async () => {
  expect(
    await prisma.$queryRaw`SELECT "eventId" FROM "ClassOutbox" WHERE "schoolId"=${s} AND "eventId"=${r}::uuid`,
  ).toHaveLength(1);
  actor("owner");
  await Promise.all([
    deliverClassBatch(s, users.owner),
    deliverClassBatch(s, users.owner),
  ]);
  for (let i = 0; i < 5; i++) await deliverClassBatch(s, users.owner);
  actor("student");
  const items = (await readClassInbox(s)).items;
  expect(items).toHaveLength(1);
  expect(JSON.stringify(items)).not.toContain("Revised class announcement");
  const key = randomUUID();
  await changeClassNotification(s, items[0].id, {
    action: "READ",
    requestKey: key,
  });
  expect(
    (
      await changeClassNotification(s, items[0].id, {
        action: "READ",
        requestKey: key,
      })
    ).replay,
  ).toBe(true);
  expect((await readClassInbox(s)).unreadCount).toBe("0");
  await changeClassNotification(s, items[0].id, {
    action: "UNREAD",
    requestKey: randomUUID(),
  });
  expect((await readClassInbox(s)).unreadCount).toBe("1");
  actor("parent");
  await expect(readClassInbox(s)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    changeClassNotification(s, items[0].id, {
      action: "READ",
      requestKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("foreign");
  await expect(readClassInbox(s)).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("permits only intended verified pupil and never a verified guardian or foreign actor", async () => {
  actor("student");
  expect((await feed(s, r)).announcements).toHaveLength(1);
  for (const name of ["parent", "foreign", "owner", "admin"]) {
    actor(name);
    await expect(feed(s, r)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
  actor("parent");
  await expect(workspace(s)).rejects.toMatchObject({ code: "NOT_FOUND" });
  const marker = Symbol("rollback");
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.studentEnrollment.updateMany({
        where: { schoolId: s, studentId: pupil },
        data: { status: "ENDED", endedAt: new Date() },
      });
      expect(
        (
          await tx.$queryRaw<
            Array<{ allowed: boolean }>
          >`SELECT can_read_class_announcement(${s},${r}::uuid,${users.student}) AS allowed`
        )[0].allowed,
      ).toBe(false);
      throw marker;
    }),
  ).rejects.toBe(marker);
});
it("requires actual Form Teacher responsibility without conferring subject or school notice authority", async () => {
  actor("form");
  const n = await create(
    s,
    intent({
      formResponsibilityId: responsibility,
      termId: term,
      title: "Synthetic form task notice",
      body: "Synthetic class only",
    }),
  );
  await action(s, n.id, intent({ action: "SUBMIT", expectedRevision: 1 }));
  actor("reviewer");
  await action(s, n.id, intent({ action: "APPROVE", expectedRevision: 1 }));
  actor("form");
  const released = await action(
    s,
    n.id,
    intent({ action: "RELEASE", expectedRevision: 1 }),
  );
  actor("student");
  expect((await feed(s, released.id)).announcements).toHaveLength(1);
});
it("rolls back failed class pages, records bounded failure history and replays concurrently without duplicate delivery", async () => {
  actor("owner");
  const fn = "p10_class_fault_" + tag.replaceAll("-", "");
  await prisma.$executeRawUnsafe(
    `CREATE FUNCTION "${fn}"() RETURNS trigger AS $$ BEGIN IF NEW."schoolId"='${s}' THEN RAISE EXCEPTION 'Synthetic isolated failure';END IF;RETURN NEW;END; $$ LANGUAGE plpgsql`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${fn}" BEFORE INSERT ON "ClassDelivery" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
  );
  let eventId: string;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ eventId: string }>
    >`SELECT "eventId" FROM "ClassOutbox" WHERE "schoolId"=${s} AND "state"='PENDING'`;
    expect(rows).toHaveLength(1);
    eventId = rows[0].eventId;
    for (let i = 0; i < 5; i++) {
      expect((await deliverClassBatch(s, users.owner)).processed).toBe(false);
      await prisma.$executeRaw`UPDATE "ClassOutbox" SET "nextAttemptAt"=clock_timestamp()-interval '1 second' WHERE "schoolId"=${s} AND "eventId"=${eventId}::uuid`;
    }
    expect(
      await prisma.$queryRaw`SELECT "id" FROM "ClassDelivery" WHERE "schoolId"=${s} AND "eventId"=${eventId}::uuid`,
    ).toHaveLength(0);
    expect(
      await prisma.$queryRaw`SELECT "id" FROM "ClassOutboxAttempt" WHERE "schoolId"=${s} AND "eventId"=${eventId}::uuid AND "outcome"='FAILED'`,
    ).toHaveLength(5);
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${fn}" ON "ClassDelivery"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${fn}"()`);
  }
  const data = intent({ eventId: eventId! });
  const replayed = await Promise.all([
    replayClassDelivery(s, data),
    replayClassDelivery(s, data),
  ]);
  expect(replayed[0].id).toBe(replayed[1].id);
  await deliverClassBatch(s, users.owner);
  actor("student");
  expect((await readClassInbox(s)).items).toHaveLength(2);
  actor("parent");
  await expect(replayClassDelivery(s, data)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("protects immutable class history and rejects direct forged release", async () => {
  await expect(
    prisma.$executeRaw`UPDATE "ClassAnnouncementRevision" SET "body"='forged' WHERE "schoolId"=${s}`,
  ).rejects.toThrow();
  await expect(
    prisma.$executeRawUnsafe('TRUNCATE "ClassAnnouncementEvent" CASCADE'),
  ).rejects.toThrow();
  await expect(
    prisma.$executeRaw`INSERT INTO "ClassAnnouncementEvent"("id","schoolId","announcementId","revision","action","actorUserId","requestKey","reason") VALUES(${randomUUID()}::uuid,${s},${a}::uuid,2,'RELEASE',${users.owner},${randomUUID()}::uuid,'Synthetic forged owner release')`,
  ).rejects.toThrow();
});
it("supports explicit owner moderation, preserving withdrawal and denying stale historical URLs", async () => {
  actor("owner");
  const d = intent({
    action: "WITHDRAW",
    expectedRevision: 2,
    targetReleaseId: r,
  });
  const first = await action(s, a, d);
  expect((await action(s, a, d)).id).toBe(first.id);
  actor("student");
  await expect(feed(s, r)).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("revoked teacher authority suppresses current class releases", async () => {
  await prisma.formTeacherResponsibility.update({
    where: { id: responsibility },
    data: { status: "ENDED", endedAt: new Date() },
  });
  actor("student");
  expect((await feed(s)).announcements).toEqual([]);
  expect((await readClassInbox(s)).items).toEqual([]);
  actor("form");
  await expect(
    create(
      s,
      intent({
        formResponsibilityId: responsibility,
        termId: term,
        title: "Revoked",
        body: "Revoked",
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("stages only explicitly requested private synthetic browser fixtures", async () => {
  const file = process.env.PHASE10_CLASS_BROWSER_FIXTURE_FILE;
  if (!file) return;
  expect(file).toMatch(/^\/tmp\/phase10-class-[\w-]+\.json$/);
  const freshForm = randomUUID();
  await prisma.formTeacherResponsibility.create({
    data: {
      id: freshForm,
      schoolId: s,
      membershipId: members.form,
      classId: room,
      sessionId: session,
    },
  });
  await writeFile(
    file,
    JSON.stringify({
      school: s,
      foreign,
      tag,
      users,
      members,
      password: "Synthetic-class-announcement-password-42",
      assignment,
      formResponsibilityId: freshForm,
      term,
      room,
      session,
      pupilId: pupil,
    }),
    { mode: 0o600, flag: "wx" },
  );
});

it("rejects unknown class worker request fields with a private 400 response", async () => {
  actor("owner");
  const { POST } =
    await import("@/app/api/schools/[schoolId]/class-delivery/route");
  const response = await POST(
    new Request("http://localhost:3001/api/schools/" + s + "/class-delivery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actorUserId: users.owner }),
    }),
    { params: Promise.resolve({ schoolId: s }) },
  );
  expect(response.status).toBe(400);
  expect(response.headers.get("cache-control")).toContain("no-store");
});
