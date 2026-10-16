import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));

import { GET as CAT_GET, POST as CAT_POST } from
  "@/app/api/schools/[schoolId]/fee-categories/route";
import { GET as REV_GET, POST as REV_POST } from
  "@/app/api/schools/[schoolId]/fee-structures/route";
import { prisma } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";

const suffix = randomUUID();
const schoolA = `fee-a-${suffix}`;
const schoolB = `fee-b-${suffix}`;
const sectionA = `fee-section-a-${suffix}`;
const sectionB = `fee-section-b-${suffix}`;
const classA = `fee-class-a-${suffix}`;
const classB = `fee-class-b-${suffix}`;
const sessionId = `fee-session-${suffix}`;
const termId = `fee-term-${suffix}`;
const actors: Record<string, string> = {};
const members: Record<string, string> = {};
const cookies: Record<string, string> = {};
const password = "synthetic-fee-configuration-password";
let categoryId: string;

function request(actor: string, schoolId: string, endpoint: string,
  method: "GET" | "POST", payload?: unknown) {
  context.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
  return new Request(`http://localhost/api/schools/${schoolId}/${endpoint}`, {
    method,
    ...(payload === undefined ? {} : { headers: { "content-type": "application/json" },
      body: JSON.stringify(payload) }),
  });
}
async function createCategory(actor: string, payload: unknown, schoolId = schoolA) {
  return CAT_POST(request(actor, schoolId, "fee-categories", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function createRevision(actor: string, payload: unknown, schoolId = schoolA) {
  return REV_POST(request(actor, schoolId, "fee-structures", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function categoryList(actor: string, schoolId = schoolA) {
  return CAT_GET(request(actor, schoolId, "fee-categories", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
async function revisionList(actor: string, schoolId = schoolA) {
  return REV_GET(request(actor, schoolId, "fee-structures", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
const revision = (scope: "SCHOOL" | "SECTION" | "CLASS", scopeId: string) => ({
  categoryId, sessionId, termId, scope, scopeId, amountMinor: "123456",
  currency: "NGN", reason: "Synthetic school fee configuration",
});

describe("Phase 9 school-only immutable fee configuration", () => {
  beforeAll(async () => {
    for (const name of ["owner", "admin", "teacher", "foreign"]) {
      const email = `fee-${name}-${suffix}@example.test`;
      const registered = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${name}`, password },
      });
      actors[name] = registered.user.id;
      const login = await auth.api.signInEmail({
        body: { email, password },
        headers: new Headers({ origin: env.BETTER_AUTH_URL }),
        returnHeaders: true,
      });
      cookies[name] = login.headers.getSetCookie()
        .map(v => v.split(";")[0]).join("; ");
      if (!cookies[name]) throw new Error("Synthetic authenticated session missing");
    }
    await prisma.school.createMany({ data: [
      { id: schoolA, slug: schoolA, name: "Synthetic Fee School A" },
      { id: schoolB, slug: schoolB, name: "Synthetic Fee School B" },
    ] });
    for (const [name, role, schoolId] of [
      ["owner", "SCHOOL_SUPER_ADMIN", schoolA],
      ["admin", "SCHOOL_ADMIN", schoolA],
      ["teacher", "TEACHER", schoolA],
      ["foreign", "SCHOOL_SUPER_ADMIN", schoolB],
    ] as const) {
      const member = await prisma.membership.create({
        data: { schoolId, userId: actors[name], role },
      });
      members[name] = member.id;
    }
    await prisma.schoolSection.createMany({ data: [
      { id: sectionA, schoolId: schoolA, name: "Primary", stage: "PRIMARY" },
      { id: sectionB, schoolId: schoolB, name: "Primary", stage: "PRIMARY" },
    ] });
    await prisma.schoolClass.createMany({ data: [
      { id: classA, schoolId: schoolA, name: "Class One", sectionId: sectionA },
      { id: classB, schoolId: schoolB, name: "Class One", sectionId: sectionB },
    ] });
    const now = Date.now();
    await prisma.academicSession.create({
      data: { id: sessionId, schoolId: schoolA, name: "Synthetic Session",
        startsOn: new Date(now - 86400000), endsOn: new Date(now + 86400000 * 60),
        status: "PLANNED" },
    });
    await prisma.academicTerm.create({
      data: { id: termId, schoolId: schoolA, sessionId,
        name: "Synthetic Term", position: 1,
        startsOn: new Date(now - 86400000), endsOn: new Date(now + 86400000 * 45),
        status: "PLANNED" },
    });
  });
  afterAll(async () => {
    await prisma.school.deleteMany({ where: { id: { in: [schoolA, schoolB] } } });
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(actors) } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(actors) } } });
    await prisma.$disconnect();
  });

  it("denies anonymous, ordinary school admin, teacher and cross-school owner", async () => {
    for (const [actor, expected] of [["", 401], ["admin", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await categoryList(actor)).status).toBe(expected);
      expect((await revisionList(actor)).status).toBe(expected);
      expect((await createCategory(actor, {
        code: "TUITION", name: "Tuition Fees",
      })).status).toBe(expected);
    }
  });
  it("creates immutable school-owned category, rejecting spoofed actor and duplicate code", async () => {
    for (const bad of [
      { code: "tuition", name: "Tuition" },
      { code: "TUITION", name: "Tuition", actorMembershipId: members.owner },
      { code: "T", name: "Tuition" },
    ]) expect((await createCategory("owner", bad)).status).toBe(400);

    const made = await createCategory("owner", { code: "TUITION", name: "Tuition Fees" });
    expect(made.status).toBe(201);
    expect(made.headers.get("cache-control")).toBe("private, no-store");
    const doc = await made.json();
    categoryId = doc.categories.id;
    expect(doc.categories.status).toBe("CONFIGURATION_ONLY");
    expect(doc.categories).not.toHaveProperty("actorUserId");
    expect((await createCategory("owner", { code: "TUITION", name: "Other" })).status)
      .toBe(409);
    expect((await categoryList("owner")).status).toBe(200);
    expect((await categoryList("foreign")).status).toBe(404);
    await expect(prisma.feeCategory.update({ where: { id: categoryId },
      data: { name: "Changed" } })).rejects.toThrow();
    await expect(prisma.feeCategory.delete({ where: { id: categoryId } }))
      .rejects.toThrow();
    await expect(prisma.feeCategory.create({ data: {
      id: randomUUID(), schoolId: schoolA, code: "FRAUD",
      name: "Invalid Actor", actorMembershipId: members.admin,
      actorUserId: actors.admin,
    } })).rejects.toThrow();
  });
  it("rejects numeric/negative/unbounded money, foreign scope and forged metadata", async () => {
    for (const bad of [
      { ...revision("SCHOOL", schoolA), amountMinor: 42 },
      { ...revision("SCHOOL", schoolA), amountMinor: "0" },
      { ...revision("SCHOOL", schoolA), amountMinor: "1000000000001" },
      { ...revision("SCHOOL", schoolA), currency: "ngn" },
      { ...revision("SCHOOL", schoolA), actorUserId: actors.owner },
      revision("SCHOOL", schoolB),
    ]) expect((await createRevision("owner", bad)).status).toBe(400);
    expect((await createRevision("owner", revision("CLASS", classB))).status)
      .toBe(404);
    expect((await createRevision("owner", revision("SECTION", sectionB))).status)
      .toBe(404);
  });
  it("versions school, section and class fees separately without mutating history", async () => {
    for (const [scope, scopeId] of [
      ["SCHOOL", schoolA], ["SECTION", sectionA], ["CLASS", classA],
    ] as const) {
      const first = await createRevision("owner", revision(scope, scopeId));
      expect(first.status).toBe(201);
      const original = (await first.json()).revision;
      expect(original.amountMinor).toBe("123456");
      expect(original.version).toBe(1);
      expect(original.status).toBe("CONFIGURATION_ONLY");
      const second = await createRevision("owner", {
        ...revision(scope, scopeId), amountMinor: "456789",
        reason: "Synthetic revised school fee amount",
      });
      expect(second.status).toBe(201);
      expect((await second.json()).revision.version).toBe(2);
      await expect(prisma.feeStructureRevision.update({ where: { id: original.id },
        data: { amountMinor: BigInt(2) } })).rejects.toThrow();
      await expect(prisma.feeStructureRevision.delete({ where: { id: original.id } }))
        .rejects.toThrow();
    }
    const own = await revisionList("owner");
    expect(own.status).toBe(200);
    const body = await own.json();
    expect(body.revisions).toHaveLength(6);
    expect(body.revisions.every((v: { amountMinor: unknown }) =>
      typeof v.amountMinor === "string")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("actorMembershipId");
  });
  it("rejects closed academic periods and forged direct SQL actor", async () => {
    await expect(prisma.feeStructureRevision.create({ data: {
      id: randomUUID(), schoolId: schoolA, categoryId, sessionId, termId,
      scope: "SCHOOL", scopeId: schoolA, currency: "NGN",
      amountMinor: BigInt(10), reason: "Forged non-owner configuration",
      actorMembershipId: members.teacher, actorUserId: actors.teacher,
    } })).rejects.toThrow();
    await prisma.academicTerm.update({ where: { id: termId },
      data: { status: "CLOSED" } });
    expect((await createRevision("owner", revision("SCHOOL", schoolA))).status)
      .toBe(404);
  });
});
