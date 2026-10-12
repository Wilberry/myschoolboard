import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => ctx.headers,
}));

import { POST as createSectionRoute } from "@/app/api/schools/[schoolId]/sections/route";
import { POST as assignClassRoute } from "@/app/api/schools/[schoolId]/classes/[classId]/section/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";

const tag = randomUUID();
const schoolA = `section-a-${tag}`;
const schoolB = `section-b-${tag}`;
const classA = `section-class-a-${tag}`;
const classB = `section-class-b-${tag}`;
const headMember = `section-head-member-${tag}`;
const password = "synthetic-section-admin-password-42";
const emails = {
  admin: `section-admin-${tag}@example.test`,
  head: `section-head-${tag}@example.test`,
  foreign: `section-foreign-${tag}@example.test`,
};
const users: Record<string, string> = {};
let adminCookie = "";
let foreignCookie = "";
let primaryId = "";
let secondaryId = "";
let foreignId = "";

async function login(email: string) {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = result.headers.getSetCookie()
    .map((value) => value.split(";")[0]).join("; ");
  if (!cookie) throw new Error("Synthetic authentication cookie missing");
  return cookie;
}

function request(cookie: string, url: string, input: unknown) {
  ctx.headers = new Headers(cookie ? { cookie } : {});
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

async function createSection(
  cookie: string,
  input: unknown,
  schoolId = schoolA,
) {
  return createSectionRoute(
    request(cookie, `http://localhost/api/schools/${schoolId}/sections`, input),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function classify(
  cookie: string,
  classId: string,
  input: unknown,
  schoolId = schoolA,
) {
  return assignClassRoute(
    request(cookie, `http://localhost/api/schools/${schoolId}/classes/${classId}/section`, input),
    { params: Promise.resolve({ schoolId, classId }) },
  );
}

describe("school section ownership and verified SECTION grants", () => {
  beforeAll(async () => {
    for (const [role, email] of Object.entries(emails)) {
      const result = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${role}`, password },
      });
      users[role] = result.user.id;
    }
    await prisma.school.createMany({
      data: [
        { id: schoolA, slug: schoolA, name: "Section Test School A" },
        { id: schoolB, slug: schoolB, name: "Section Test School B" },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { userId: users.admin, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        { id: headMember, userId: users.head, schoolId: schoolA,
          role: "HEAD_OF_SECTION" },
        { userId: users.foreign, schoolId: schoolB, role: "SCHOOL_ADMIN" },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: schoolA, name: "Primary One" },
        { id: classB, schoolId: schoolB, name: "Foreign Secondary One" },
      ],
    });
    const foreign = await prisma.schoolSection.create({
      data: { schoolId: schoolB, name: "Foreign Primary", stage: "PRIMARY" },
    });
    foreignId = foreign.id;
    adminCookie = await login(emails.admin);
    foreignCookie = await login(emails.foreign);
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    await prisma.session.deleteMany({
      where: { userId: { in: Object.values(users) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
  });

  it("denies anonymous and foreign school administrators", async () => {
    for (const [cookie, status] of [["", 401], [foreignCookie, 404]] as const) {
      expect((await createSection(cookie, {
        name: "Primary", stage: "PRIMARY", reason: "Synthetic school setup",
      })).status).toBe(status);
      expect((await classify(cookie, classA, {
        sectionId: foreignId, reason: "Synthetic class assignment",
      })).status).toBe(status);
    }
    expect((await createSection(adminCookie, {
      name: "Foreign Section", stage: "PRIMARY", reason: "Foreign write",
    }, schoolB)).status).toBe(404);
  });

  it("creates school-owned sections and classifies a class once", async () => {
    const primary = await createSection(adminCookie, {
      name: "Primary", stage: "PRIMARY", reason: "Configure school primary section",
    });
    expect(primary.status).toBe(201);
    expect(primary.headers.get("cache-control")).toBe("private, no-store");
    primaryId = (await primary.json()).section.id;
    const secondary = await createSection(adminCookie, {
      name: "Secondary", stage: "SECONDARY", reason: "Configure school secondary section",
    });
    expect(secondary.status).toBe(201);
    secondaryId = (await secondary.json()).section.id;
    expect((await createSection(adminCookie, {
      name: "Primary", stage: "PRIMARY", reason: "Duplicate section",
    })).status).toBe(409);
    expect((await classify(adminCookie, classA, {
      sectionId: foreignId, reason: "Try foreign section",
    })).status).toBe(404);
    expect((await classify(adminCookie, classB, {
      sectionId: primaryId, reason: "Try foreign class",
    })).status).toBe(404);
    const assigned = await classify(adminCookie, classA, {
      sectionId: primaryId, reason: "Place Primary One in Primary",
    });
    expect(assigned.status).toBe(200);
    expect((await assigned.json()).class.sectionId).toBe(primaryId);
    expect((await classify(adminCookie, classA, {
      sectionId: secondaryId, reason: "Unaudited reassignment attempt",
    })).status).toBe(409);
    expect((await classify(adminCookie, classA, {
      sectionId: primaryId, reason: "Repeated placement attempt",
    })).status).toBe(409);
    expect((await prisma.schoolClass.findUniqueOrThrow({
      where: { id: classB },
      select: { sectionId: true },
    })).sectionId).toBeNull();
  });

  it("rejects verified grants pointing to another school's section", async () => {
    await prisma.scopeGrant.createMany({
      data: [
        { membershipId: headMember, scopeId: primaryId, type: "SECTION", verified: true },
        { membershipId: headMember, scopeId: foreignId, type: "SECTION", verified: true },
      ],
    });
    const principal = await resolveSchoolPrincipal(users.head, schoolA);
    expect(principal?.membership?.scopes.map((scope) => scope.scopeId))
      .toContain(primaryId);
    expect(principal?.membership?.scopes.map((scope) => scope.scopeId))
      .not.toContain(foreignId);
    expect(authorize(principal, "academic:approve", {
      schoolId: schoolA,
      sectionId: primaryId,
    }).allowed).toBe(true);
    expect(authorize(principal, "academic:approve", {
      schoolId: schoolA,
      sectionId: foreignId,
    }).allowed).toBe(false);
  });

  it("removes inactive sections from resolved principal authority", async () => {
    await prisma.schoolSection.update({
      where: { id: primaryId },
      data: { isActive: false },
    });
    try {
      const principal = await resolveSchoolPrincipal(users.head, schoolA);
      expect(authorize(principal, "academic:approve", {
        schoolId: schoolA,
        sectionId: primaryId,
      }).allowed).toBe(false);
    } finally {
      await prisma.schoolSection.update({
        where: { id: primaryId },
        data: { isActive: true },
      });
    }
  });

  it("preserves immutable audit events and actor identity", async () => {
    const events = await prisma.schoolConfigurationEvent.findMany({
      where: { schoolId: schoolA },
    });
    expect(events.map((event) => event.eventType).sort()).toEqual([
      "CLASS_SECTION_ASSIGNED",
      "SECTION_CREATED",
      "SECTION_CREATED",
    ]);
    expect(events.every((event) => event.actorUserId === users.admin)).toBe(true);
    expect(events.every((event) => event.reason?.length)).toBe(true);
    const event = events[0];
    await expect(prisma.schoolConfigurationEvent.update({
      where: { id: event.id },
      data: { resourceId: "tampered-class" },
    })).rejects.toThrow();
    await expect(prisma.schoolConfigurationEvent.delete({
      where: { id: event.id },
    })).rejects.toThrow();
  });
});
