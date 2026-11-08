import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => ctx.headers }));
import { prisma } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";
import { verifyPhase9DatabaseIdentity } from "@/scripts/verify-phase9-disposable.mjs";
import { attestStudentAccount } from "@/src/modules/students/account-link-service";
import { attestGuardianStudentLink } from "@/src/modules/students/guardian-link-service";
const tag = randomUUID(),
  s = "p10-library-" + tag,
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
let pupil: string;
const intent = <T extends Record<string, unknown>>(extra: T = {} as T) => ({
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
beforeAll(async () => {
  verifyPhase9DatabaseIdentity(process.env);
  vi.stubEnv("PHASE10_LIBRARY_ENABLED", "true");
  vi.stubEnv("PHASE10_INAPP_ENABLED", "true");
  await prisma.school.createMany({
    data: [
      { id: s, name: "Synthetic class school", slug: s },
      { id: foreign, name: "Synthetic foreign school", slug: foreign },
    ],
  });
  for (const [name, role, school] of [
    ["teacher", "TEACHER", s],
    ["unassigned", "TEACHER", s],
    ["form", "FORM_TEACHER", s],
    ["reviewer", "HEAD_OF_SECTION", s],
    ["owner", "SCHOOL_SUPER_ADMIN", s],
    ["owner2", "SCHOOL_SUPER_ADMIN", s],
    ["admin", "SCHOOL_ADMIN", s],
    ["student", "STUDENT", s],
    ["parent", "PARENT", s],
    ["foreign", "TEACHER", foreign],
  ] as const) {
    const password = "Synthetic-class-announcement-password-42";
    const email = `p10-library-${name}-${tag}@example.test`;
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
  if (process.env.PHASE10_LIBRARY_BROWSER_FIXTURE_FILE) {
    await prisma.$disconnect();
    return;
  }
  await prisma.school.deleteMany({ where: { id: { in: [s, foreign] } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});

import {
  createCatalogEntry as create,
  reviseCatalogEntry as revise,
  reviewCatalogEntry as review,
  releaseCatalogEntry as release,
  withdrawCatalogRelease as withdraw,
  readLibraryCatalog as feed,
} from "./catalog";
const metadata = {
  title: "Synthetic catalog title",
  author: "Synthetic author",
  publisher: "Synthetic publisher",
  isbn: null,
  description: "Synthetic physical or digital metadata; no file attached",
  provenance: "Original synthetic test content; no external copyrighted source",
};
let entry: string, released: string;
async function published(
  scope: "SCHOOL" | "SECTION" | "CLASS" | "STUDENT",
  kind: "PHYSICAL_BOOK" | "DIGITAL_RESOURCE" = "PHYSICAL_BOOK",
) {
  actor("teacher");
  const n = await create(s, intent({ ...metadata, kind }));
  actor("owner");
  await review(s, n.id, intent({ expectedRevision: 1, action: "APPROVE" }));
  return release(
    s,
    n.id,
    intent({
      expectedRevision: 1,
      scope,
      ...(scope === "SECTION"
        ? { sectionId: section }
        : scope === "CLASS"
          ? { classId: room }
          : scope === "STUDENT"
            ? { studentId: pupil }
            : {}),
    }),
  );
}
it("defaults off, restricts curation and preserves immutable retry identity", async () => {
  actor("teacher");
  vi.stubEnv("PHASE10_LIBRARY_ENABLED", "false");
  await expect(
    create(s, intent({ ...metadata, kind: "PHYSICAL_BOOK" })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  vi.stubEnv("PHASE10_LIBRARY_ENABLED", "true");
  for (const role of ["parent", "student", "foreign"]) {
    actor(role);
    await expect(
      create(s, intent({ ...metadata, kind: "PHYSICAL_BOOK" })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
  actor("teacher");
  const input = intent({ ...metadata, kind: "PHYSICAL_BOOK" });
  const results = await Promise.all([create(s, input), create(s, input)]);
  entry = results[0].id;
  expect(results.map((x) => x.replay).sort()).toEqual([false, true]);
  await expect(
    create(s, { ...input, title: "Changed replay" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("requires independent owner metadata review and explicit release, never exposes a digital file", async () => {
  actor("student");
  expect((await feed(s)).entries).toEqual([]);
  actor("teacher");
  await expect(
    review(s, entry, intent({ expectedRevision: 1, action: "APPROVE" })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("owner");
  await expect(
    release(s, entry, intent({ expectedRevision: 1, scope: "SCHOOL" })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await review(s, entry, intent({ expectedRevision: 1, action: "RETURN" }));
  actor("teacher");
  await revise(
    s,
    entry,
    intent({
      ...metadata,
      expectedRevision: 1,
      title: "Synthetic reviewed physical book",
    }),
  );
  actor("owner");
  await review(s, entry, intent({ expectedRevision: 2, action: "APPROVE" }));
  released = (
    await release(s, entry, intent({ expectedRevision: 2, scope: "SCHOOL" }))
  ).id;
  actor("student");
  expect((await feed(s, released)).entries[0]).toMatchObject({
    kind: "PHYSICAL_BOOK",
    assetAvailable: false,
    title: "Synthetic reviewed physical book",
  });
  actor("owner");
  const own = await create(
    s,
    intent({ ...metadata, kind: "DIGITAL_RESOURCE" }),
  );
  await expect(
    review(s, own.id, intent({ expectedRevision: 1, action: "APPROVE" })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("supports four exact typed targets, denies verified guardians and foreign schools", async () => {
  for (const scope of ["SCHOOL", "SECTION", "CLASS", "STUDENT"] as const) {
    const r = await published(scope, "DIGITAL_RESOURCE");
    actor("student");
    expect((await feed(s, r.id)).entries[0]).toMatchObject({
      kind: "DIGITAL_RESOURCE",
      assetAvailable: false,
    });
    for (const name of ["parent", "foreign"]) {
      actor(name);
      await expect(feed(s, r.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  }
  actor("owner");
  await expect(
    release(
      s,
      entry,
      intent({
        expectedRevision: 2,
        scope: "CLASS",
        classId: room,
        studentId: pupil,
      }),
    ),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
it("does not broaden class/student resources through unrelated staff roles", async () => {
  for (const scope of ["CLASS", "STUDENT", "SECTION"] as const) {
    const r = await published(scope);
    actor("unassigned");
    await expect(feed(s, r.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    actor("teacher");
    expect((await feed(s, r.id)).entries).toHaveLength(1);
  }
  const schoolWide = await published("SCHOOL");
  actor("unassigned");
  expect((await feed(s, schoolWide.id)).entries).toHaveLength(1);
});
it("checks current enrollment and target/class state without restoring revoked fixture authority", async () => {
  const r = await published("CLASS");
  const marker = Symbol("rollback catalog scope");
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
          >`SELECT can_read_library_catalog(${s},${r.id}::uuid,${users.student}) AS allowed`
        )[0].allowed,
      ).toBe(false);
      throw marker;
    }),
  ).rejects.toBe(marker);
});
it("does not bypass inactive resource targets through owner or curator privileges", async () => {
  const r = await published("CLASS");
  const marker = Symbol("rollback inactive target");
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.schoolClass.update({
        where: { id: room },
        data: { isActive: false },
      });
      for (const name of ["owner", "teacher", "student"])
        expect(
          (
            await tx.$queryRaw<
              Array<{ allowed: boolean }>
            >`SELECT can_read_library_catalog(${s},${r.id}::uuid,${users[name]}) AS allowed`
          )[0].allowed,
        ).toBe(false);
      throw marker;
    }),
  ).rejects.toBe(marker);
});
it("protects catalog history and terminal withdrawal", async () => {
  await expect(
    prisma.$executeRaw`UPDATE "LibraryCatalogRevision" SET "description"='forged' WHERE "schoolId"=${s}`,
  ).rejects.toThrow();
  await expect(
    prisma.$executeRawUnsafe('TRUNCATE "LibraryCatalogRelease" CASCADE'),
  ).rejects.toThrow();
  actor("owner");
  const d = intent();
  const w = await withdraw(s, released, d);
  expect((await withdraw(s, released, d)).id).toBe(w.id);
  actor("student");
  await expect(feed(s, released)).rejects.toMatchObject({ code: "NOT_FOUND" });
});

import sharp from "sharp";
import { mkdtemp, writeFile } from "node:fs/promises";
import {
  uploadLearningAsset as upload,
  attestLearningAssetRights as rights,
  releaseLearningAsset as releaseAsset,
  withdrawLearningAsset as withdrawAsset,
  readLearningAsset as bytes,
} from "./assets";
import { privateLearningStore } from "@/src/modules/files/private-learning-store";
let assetStorage: string;
async function imageFile() {
  return new File(
    [
      new Uint8Array(
        await sharp({
          create: {
            width: 3,
            height: 3,
            channels: 3,
            background: { r: 30, g: 100, b: 150 },
          },
        })
          .png()
          .toBuffer(),
      ),
    ],
    "../../ignored-private-name.png",
    { type: "image/png" },
  );
}
async function digital() {
  actor("teacher");
  const n = await create(s, intent({ ...metadata, kind: "DIGITAL_RESOURCE" }));
  actor("owner");
  await review(s, n.id, intent({ action: "APPROVE", expectedRevision: 1 }));
  const r = await release(
    s,
    n.id,
    intent({ scope: "CLASS", classId: room, expectedRevision: 1 }),
  );
  return { entryId: n.id, catalogReleaseId: r.id };
}
async function readyAsset(expiresAt: string | null = null) {
  const source = await digital();
  actor("teacher");
  const a = await upload(s, source.entryId, {
    ...intent({ expectedRevision: 1 }),
    file: await imageFile(),
  });
  actor("owner");
  const r = await rights(
    s,
    a.id,
    intent({
      catalogReleaseId: source.catalogReleaseId,
      basis: "PUBLIC_DOMAIN",
      sourceLicense: "Original synthetic raster generated solely for tests",
      permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
      expiresAt,
    }),
  );
  const published = await releaseAsset(s, a.id, intent({ rightsId: r.id }));
  return { ...source, assetId: a.id, rightsId: r.id, releaseId: published.id };
}
it("enables only independently attested disposable raster fixtures, never external content", async () => {
  assetStorage = await mkdtemp(
    "/workspace/phase10-tools-resumed-20261107/library-test-",
  );
  vi.stubEnv("PHASE10_LIBRARY_STORAGE_DIR", assetStorage);
  vi.stubEnv("PHASE10_ASSETS_ENABLED", "true");
  vi.stubEnv("PHASE10_RASTER_INSPECTION_ENABLED", "true");
});
it("separates metadata from quarantined bytes, independent rights and explicit clean release", async () => {
  const source = await digital();
  actor("teacher");
  const file = await imageFile();
  const d = { ...intent({ expectedRevision: 1 }), file };
  const [a, b] = await Promise.all([
    upload(s, source.entryId, d),
    upload(s, source.entryId, d),
  ]);
  expect(a.id).toBe(b.id);
  expect([a.replay, b.replay].sort()).toEqual([false, true]);
  actor("student");
  await expect(bytes(s, a.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("teacher");
  await expect(
    rights(
      s,
      a.id,
      intent({
        catalogReleaseId: source.catalogReleaseId,
        basis: "PUBLIC_DOMAIN",
        sourceLicense: "Synthetic original generated raster",
        permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
        expiresAt: null,
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("owner");
  await expect(
    releaseAsset(s, a.id, intent({ rightsId: randomUUID() })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const attested = await rights(
    s,
    a.id,
    intent({
      catalogReleaseId: source.catalogReleaseId,
      basis: "PUBLIC_DOMAIN",
      sourceLicense: "Synthetic original generated raster",
      permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
      expiresAt: null,
    }),
  );
  const r = await releaseAsset(s, a.id, intent({ rightsId: attested.id }));
  actor("student");
  const data = await bytes(s, r.id);
  expect((await sharp(data).metadata()).format).toBe("png");
  for (const name of ["parent", "foreign"]) {
    actor(name);
    await expect(bytes(s, r.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});
it("fails closed for unavailable inspection and rejects PDF, SVG, declared MIME mismatch and trailing polyglots", async () => {
  const source = await digital();
  actor("teacher");
  vi.stubEnv("PHASE10_RASTER_INSPECTION_ENABLED", "false");
  const a = await upload(s, source.entryId, {
    ...intent({ expectedRevision: 1 }),
    file: await imageFile(),
  });
  vi.stubEnv("PHASE10_RASTER_INSPECTION_ENABLED", "true");
  actor("owner");
  const attested = await rights(
    s,
    a.id,
    intent({
      catalogReleaseId: source.catalogReleaseId,
      basis: "PUBLIC_DOMAIN",
      sourceLicense: "Synthetic generated raster; inspector unavailable",
      permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
      expiresAt: null,
    }),
  );
  await expect(
    releaseAsset(s, a.id, intent({ rightsId: attested.id })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("teacher");
  for (const type of ["application/pdf", "image/svg+xml", "application/zip"])
    await expect(
      upload(s, source.entryId, {
        ...intent({ expectedRevision: 1 }),
        file: new File(["synthetic invalid content"], "ignored", { type }),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const png = Buffer.from(await (await imageFile()).arrayBuffer());
  for (const file of [
    new File([png], "mismatch", { type: "image/jpeg" }),
    new File([png, Buffer.from("<svg/>")], "trailing", { type: "image/png" }),
  ])
    await expect(
      upload(s, source.entryId, { ...intent({ expectedRevision: 1 }), file }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
it("rechecks authorization after real private file I/O and denies withdrawals before responding", async () => {
  const a = await readyAsset();
  actor("student");
  await expect(
    bytes(s, a.releaseId, {
      ...privateLearningStore,
      async openVersion(...args) {
        const data = await privateLearningStore.openVersion(...args);
        actor("owner");
        await withdrawAsset(s, a.releaseId, intent());
        return data;
      },
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("student");
  await expect(bytes(s, a.releaseId)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("enforces rights expiry at read time without deleting or rewriting history", async () => {
  const a = await readyAsset(new Date(Date.now() + 3000).toISOString());
  actor("student");
  expect((await bytes(s, a.releaseId)).length).toBeGreaterThan(0);
  await new Promise((r) => setTimeout(r, 3100));
  await expect(bytes(s, a.releaseId)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
}, 10000);
it("protects asset histories and validates private response headers and denied range requests", async () => {
  const a = await readyAsset();
  await expect(
    prisma.$executeRaw`UPDATE "LearningAssetInspection" SET "verdict"='CLEAN' WHERE "schoolId"=${s}`,
  ).rejects.toThrow();
  await expect(
    prisma.$executeRawUnsafe('TRUNCATE "LearningAssetRights" CASCADE'),
  ).rejects.toThrow();
  actor("student");
  const { GET, HEAD } =
    await import("@/app/api/schools/[schoolId]/library/asset-releases/[releaseId]/download/route");
  const context = {
    params: Promise.resolve({ schoolId: s, releaseId: a.releaseId }),
  };
  const response = await GET(
    new Request("http://localhost:3001/library"),
    context,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("content-disposition")).toMatch(
    /^attachment; filename="learning-resource-/,
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-security-policy")).toContain("sandbox");
  expect(
    (
      await HEAD(
        new Request("http://localhost:3001/library", { method: "HEAD" }),
        context,
      )
    ).status,
  ).toBe(200);
  const denied = await GET(
    new Request("http://localhost:3001/library", {
      headers: { range: "bytes=0-10" },
    }),
    context,
  );
  expect(denied.status).toBe(404);
  expect(await denied.text()).toBe("");
});

it("requires a different rights reviewer even for an owner-proposed digital asset", async () => {
  actor("owner");
  const n = await create(s, intent({ ...metadata, kind: "DIGITAL_RESOURCE" }));
  actor("owner2");
  await review(s, n.id, intent({ action: "APPROVE", expectedRevision: 1 }));
  const catalog = await release(
    s,
    n.id,
    intent({ scope: "SCHOOL", expectedRevision: 1 }),
  );
  actor("owner");
  const asset = await upload(s, n.id, {
    ...intent({ expectedRevision: 1 }),
    file: await imageFile(),
  });
  const d = intent({
    catalogReleaseId: catalog.id,
    basis: "PUBLIC_DOMAIN",
    sourceLicense: "Synthetic owner-proposed generated raster",
    permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
    expiresAt: null,
  });
  await expect(rights(s, asset.id, d)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  actor("owner2");
  const attested = await rights(s, asset.id, d);
  const published = await releaseAsset(
    s,
    asset.id,
    intent({ rightsId: attested.id }),
  );
  actor("student");
  expect((await bytes(s, published.id)).length).toBeGreaterThan(0);
});

it("supersedes older asset versions and never resurrects one after correction withdrawal", async () => {
  const source = await digital();
  actor("teacher");
  const first = await upload(s, source.entryId, {
    ...intent({ expectedRevision: 1 }),
    file: await imageFile(),
  });
  actor("owner");
  const firstRights = await rights(
    s,
    first.id,
    intent({
      catalogReleaseId: source.catalogReleaseId,
      basis: "PUBLIC_DOMAIN",
      sourceLicense: "Synthetic version one generated raster",
      permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
      expiresAt: null,
    }),
  );
  const r1 = await releaseAsset(
    s,
    first.id,
    intent({ rightsId: firstRights.id }),
  );
  actor("student");
  expect((await bytes(s, r1.id)).length).toBeGreaterThan(0);
  actor("teacher");
  const next = await upload(s, source.entryId, {
    ...intent({ expectedRevision: 1 }),
    file: await imageFile(),
  });
  actor("owner");
  const nextRights = await rights(
    s,
    next.id,
    intent({
      catalogReleaseId: source.catalogReleaseId,
      basis: "PUBLIC_DOMAIN",
      sourceLicense: "Synthetic version two generated raster",
      permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
      expiresAt: null,
    }),
  );
  const r2 = await releaseAsset(
    s,
    next.id,
    intent({ rightsId: nextRights.id }),
  );
  actor("student");
  await expect(bytes(s, r1.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect((await bytes(s, r2.id)).length).toBeGreaterThan(0);
  actor("owner");
  await withdrawAsset(s, r2.id, intent());
  actor("student");
  await expect(bytes(s, r1.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(bytes(s, r2.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("denies a stale upload revision before any storage write", async () => {
  const source = await digital();
  actor("teacher");
  const write = vi.fn(privateLearningStore.putQuarantined);
  await expect(
    upload(
      s,
      source.entryId,
      { ...intent({ expectedRevision: 999 }), file: await imageFile() },
      { ...privateLearningStore, putQuarantined: write },
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(write).not.toHaveBeenCalled();
});
it("bounds authenticated upload quota while retaining exact retry behavior", async () => {
  const source = await digital();
  actor("teacher");
  const file = await imageFile();
  const count = await prisma.$queryRaw<
    Array<{ count: string }>
  >`SELECT count(*)::text AS count FROM "PrivateLearningAsset" WHERE "schoolId"=${s} AND "proposerUserId"=${users.teacher}`;
  for (let i = Number(count[0].count); i < 20; i++)
    await upload(s, source.entryId, {
      ...intent({ expectedRevision: 1 }),
      file,
    });
  await expect(
    upload(s, source.entryId, { ...intent({ expectedRevision: 1 }), file }),
  ).rejects.toMatchObject({ code: "RATE_LIMITED" });
}, 15000);

it("stages fresh private browser curation authority without reactivating or clearing fixtures", async () => {
  const file = process.env.PHASE10_LIBRARY_BROWSER_FIXTURE_FILE;
  if (!file) return;
  expect(file).toMatch(/^\/tmp\/phase10-library-[\w-]+\.json$/);
  const password = "Synthetic-class-announcement-password-42",
    email = `p10-library-browsercurator-${tag}@example.test`;
  const created = await auth.api.signUpEmail({
    body: { email, password, name: "Synthetic fresh browser curator" },
  });
  users.browsercurator = created.user.id;
  members.browsercurator = (
    await prisma.membership.create({
      data: { schoolId: s, userId: created.user.id, role: "TEACHER" },
    })
  ).id;
  const teacherEmail = `p10-library-browserteacher-${tag}@example.test`;
  const teacher = await auth.api.signUpEmail({
    body: {
      email: teacherEmail,
      password,
      name: "Synthetic fresh scoped browser teacher",
    },
  });
  users.browserteacher = teacher.user.id;
  members.browserteacher = (
    await prisma.membership.create({
      data: { schoolId: s, userId: teacher.user.id, role: "TEACHER" },
    })
  ).id;
  await prisma.teacherClassSubjectAssignment.create({
    data: {
      schoolId: s,
      membershipId: members.browserteacher,
      classId: room,
      sessionId: session,
      subjectId: subject,
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
      password,
      pupilId: pupil,
      room,
      section,
    }),
    { mode: 0o600, flag: "wx" },
  );
});
