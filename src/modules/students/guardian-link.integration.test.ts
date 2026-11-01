import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const requestContext = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
}));

import * as linkRoute from "@/app/api/schools/[schoolId]/guardian-links/route";
import {
  POST as revokeRoute,
} from "@/app/api/schools/[schoolId]/guardian-links/[linkId]/revoke/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const schoolA = `guardian-a-${tag}`;
const schoolB = `guardian-b-${tag}`;
const sectionA = `guardian-section-${tag}`;
const classA = `guardian-class-${tag}`;
const sessionA = `guardian-session-${tag}`;
const studentA = `guardian-student-${tag}`;
const studentUnenrolled = `guardian-no-enrollment-${tag}`;
const studentEnded = `guardian-ended-${tag}`;
const password = "synthetic-guardian-relationship-test-42";
const emails = {
  admin: `guardian-admin-${tag}@example.test`,
  otherAdmin: `guardian-foreign-${tag}@example.test`,
  guardian: `guardian-parent-${tag}@example.test`,
  teacher: `guardian-teacher-${tag}@example.test`,
};
const userIds: Record<string, string> = {};
const cookies: Record<string, string> = {};
let adminMembershipId = "";
let guardianMembershipId = "";
let teacherMembershipId = "";
let linkId = "";

async function signIn(email: string) {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = result.headers
    .getSetCookie()
    .map((item) => item.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Synthetic auth cookie missing");
  return cookie;
}

function request(person: string, url: string, method: "GET" | "POST", body?: unknown) {
  requestContext.headers = new Headers(
    cookies[person] ? { cookie: cookies[person] } : {},
  );
  return new Request(`http://localhost${url}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const attestation = () => ({
  studentId: studentA,
  guardianMembershipId,
  relationshipVerified: true,
  reason: "School office verified synthetic guardian identity",
});

async function create(person: string, body: unknown, schoolId = schoolA) {
  return linkRoute.POST(
    request(person, `/api/schools/${schoolId}/guardian-links`, "POST", body),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function list(person: string, schoolId = schoolA) {
  return linkRoute.GET(
    request(person, `/api/schools/${schoolId}/guardian-links`, "GET"),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function revoke(person: string, id = linkId, schoolId = schoolA) {
  return revokeRoute(
    request(
      person,
      `/api/schools/${schoolId}/guardian-links/${id}/revoke`,
      "POST",
      { reason: "School administrator revoked attested relationship" },
    ),
    { params: Promise.resolve({ schoolId, linkId: id }) },
  );
}

describe("guardian relationship attestation stays admin-only and school-scoped", () => {
  beforeAll(async () => {
    for (const [role, email] of Object.entries(emails)) {
      const signed = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${role}`, password },
      });
      userIds[role] = signed.user.id;
      cookies[role] = await signIn(email);
    }
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Synthetic Guardian School A", slug: schoolA },
        { id: schoolB, name: "Synthetic Guardian School B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { schoolId: schoolA, userId: userIds.admin, role: "SCHOOL_ADMIN" },
        { schoolId: schoolB, userId: userIds.otherAdmin, role: "SCHOOL_ADMIN" },
        { schoolId: schoolA, userId: userIds.guardian, role: "PARENT" },
        { schoolId: schoolA, userId: userIds.teacher, role: "TEACHER" },
      ],
    });
    const [admin, guardian, teacher] = await Promise.all([
      prisma.membership.findUniqueOrThrow({
        where: { schoolId_userId: { schoolId: schoolA, userId: userIds.admin } },
      }),
      prisma.membership.findUniqueOrThrow({
        where: { schoolId_userId: { schoolId: schoolA, userId: userIds.guardian } },
      }),
      prisma.membership.findUniqueOrThrow({
        where: { schoolId_userId: { schoolId: schoolA, userId: userIds.teacher } },
      }),
    ]);
    adminMembershipId = admin.id;
    guardianMembershipId = guardian.id;
    teacherMembershipId = teacher.id;
    await prisma.schoolSection.create({
      data: { id: sectionA, schoolId: schoolA, name: "Primary", stage: "PRIMARY" },
    });
    await prisma.schoolClass.create({
      data: { id: classA, schoolId: schoolA, sectionId: sectionA, name: "Class A" },
    });
    await prisma.academicSession.create({
      data: {
        id: sessionA,
        schoolId: schoolA,
        name: "Guardian synthetic session",
        status: "ACTIVE",
        startsOn: new Date("2026-09-01T00:00:00.000Z"),
        endsOn: new Date("2027-07-31T00:00:00.000Z"),
      },
    });
    await prisma.studentRecord.createMany({
      data: [
        {
          id: studentA,
          schoolId: schoolA,
          admissionNumber: `G-A-${tag}`.toUpperCase(),
          givenName: "Synthetic",
          familyName: "Child",
          status: "ENROLLED",
        },
        {
          id: studentUnenrolled,
          schoolId: schoolA,
          admissionNumber: `G-N-${tag}`.toUpperCase(),
          givenName: "Not",
          familyName: "Enrolled",
          status: "REGISTERED",
        },
        {
          id: studentEnded,
          schoolId: schoolA,
          admissionNumber: `G-E-${tag}`.toUpperCase(),
          givenName: "Former",
          familyName: "Pupil",
          status: "WITHDRAWN",
        },
      ],
    });
    await prisma.studentEnrollment.createMany({
      data: [
        {
          schoolId: schoolA,
          studentId: studentA,
          sessionId: sessionA,
          classId: classA,
          status: "ACTIVE",
        },
        {
          schoolId: schoolA,
          studentId: studentEnded,
          sessionId: sessionA,
          classId: classA,
          status: "ENDED",
          endedAt: new Date(),
        },
      ],
    });
  }, 45_000);

  afterAll(async () => {
    await prisma.school.deleteMany({ where: { id: { in: [schoolA, schoolB] } } });
    await prisma.session.deleteMany({
      where: { userId: { in: Object.values(userIds) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(userIds) } },
    });
    await prisma.$disconnect();
  });

  it("denies anonymous, teachers, parents, and other-school administrators", async () => {
    for (const [person, status] of [
      ["", 401],
      ["teacher", 404],
      ["guardian", 404],
      ["otherAdmin", 404],
    ] as const) {
      const result = await create(person, attestation());
      expect(result.status).toBe(status);
      expect(result.headers.get("cache-control")).toBe("private, no-store");
      expect((await list(person)).status).toBe(status);
    }
    expect((await create("admin", attestation(), schoolB)).status).toBe(404);
    expect((await list("admin", schoolB)).status).toBe(404);
    expect(await prisma.guardianStudentLink.count()).toBe(0);
  });

  it("rejects unverified identity, wrong roles and un-enrolled children", async () => {
    expect((await create("admin", {
      ...attestation(),
      relationshipVerified: false,
    })).status).toBe(400);
    expect((await create("admin", {
      ...attestation(),
      guardianMembershipId: teacherMembershipId,
    })).status).toBe(404);
    expect((await create("admin", {
      ...attestation(),
      studentId: studentUnenrolled,
    })).status).toBe(404);
    expect((await create("admin", {
      ...attestation(),
      guardianMembershipId: "unknown-member",
    })).status).toBe(404);
    expect(await prisma.guardianStudentLink.count()).toBe(0);
  });

  it("rejects an inactive guardian membership before attestation", async () => {
    await prisma.membership.update({
      where: { id: guardianMembershipId },
      data: { isActive: false },
    });
    try {
      expect((await create("admin", attestation())).status).toBe(404);
      expect(await prisma.guardianStudentLink.count()).toBe(0);
    } finally {
      await prisma.membership.update({
        where: { id: guardianMembershipId },
        data: { isActive: true },
      });
    }
  });

  it("rejects direct database attestation by an unqualified TEACHER actor", async () => {
    await expect(
      prisma.guardianStudentLink.create({
        data: {
          schoolId: schoolA,
          studentId: studentA,
          guardianMembershipId,
          attestedByMembershipId: teacherMembershipId,
          attestedByUserId: userIds.teacher,
          attestationReason: "Forged identity attestation using teacher role",
        },
      }),
    ).rejects.toThrow();
    expect(await prisma.guardianStudentLink.count()).toBe(0);
  });

  it("persists exactly one attested same-school relationship with minimal response", async () => {
    const result = await create("admin", attestation());
    expect(result.status).toBe(201);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const body = (await result.json()).link;
    linkId = body.id;
    expect(body.schoolId).toBe(schoolA);
    expect(body.studentId).toBeUndefined();
    expect(body.guardianMembershipId).toBeUndefined();

    const saved = await prisma.guardianStudentLink.findUniqueOrThrow({
      where: { id: linkId },
    });
    expect(saved).toMatchObject({
      schoolId: schoolA,
      studentId: studentA,
      guardianMembershipId,
      attestedByMembershipId: adminMembershipId,
      attestedByUserId: userIds.admin,
    });

    expect((await create("admin", attestation())).status).toBe(409);
    const read = await list("admin");
    expect(read.status).toBe(200);
    const links = (await read.json()).links;
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      id: linkId, studentId: studentA, guardianMembershipId,
    });
    expect(JSON.stringify(links)).not.toContain("Synthetic");
  });

  it("does not permit direct updates or deletions of attested history", async () => {
    await expect(
      prisma.guardianStudentLink.update({
        where: { id: linkId },
        data: { attestationReason: "Forged later statement" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.guardianStudentLink.delete({ where: { id: linkId } }),
    ).rejects.toThrow();
  });

  it("refuses inactive enrollment even with an active school and PARENT member", async () => {
    expect(
      (await create("admin", { ...attestation(), studentId: studentEnded })).status,
    ).toBe(404);
    expect(
      await prisma.guardianStudentLink.count({
        where: { schoolId: schoolA, studentId: studentEnded },
      }),
    ).toBe(0);
  });

  it("revokes once, preserves the original record, and denies resurrection", async () => {
    expect((await revoke("teacher")).status).toBe(404);
    expect((await revoke("otherAdmin")).status).toBe(404);
    const result = await revoke("admin");
    expect(result.status).toBe(201);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect((await revoke("admin")).status).toBe(404);
    expect((await create("admin", attestation())).status).toBe(409);
    const link = await prisma.guardianStudentLink.findFirstOrThrow({
      where: { schoolId: schoolA, id: linkId },
      include: { revocation: true },
    });
    expect(link.revocation?.actorUserId).toBe(userIds.admin);
    expect(link.revocation?.linkId).toBe(linkId);
    await expect(
      prisma.guardianStudentLinkRevocation.update({
        where: { id: link.revocation!.id },
        data: { reason: "Tampered history" },
      }),
    ).rejects.toThrow();
  });

});
