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
import { hasCurrentGuardianRelationship } from "./guardian-link-service";
import {
  POST as withdrawRoute,
} from "@/app/api/schools/[schoolId]/students/[studentId]/enrollments/[enrollmentId]/withdraw/route";

const tag = randomUUID();
const schoolA = `guardian-a-${tag}`;
const schoolB = `guardian-b-${tag}`;
const sectionA = `guardian-section-${tag}`;
const classA = `guardian-class-${tag}`;
const sessionA = `guardian-session-${tag}`;
const studentA = `guardian-student-${tag}`;
const studentUnenrolled = `guardian-no-enrollment-${tag}`;
const studentEnded = `guardian-ended-${tag}`;
const studentWithdrawal = `guardian-withdrawal-${tag}`;
const password = "synthetic-guardian-relationship-test-42";
const emails = {
  admin: `guardian-admin-${tag}@example.test`,
  otherAdmin: `guardian-foreign-${tag}@example.test`,
  guardian: `guardian-parent-${tag}@example.test`,
  unlinkedGuardian: `guardian-unlinked-parent-${tag}@example.test`,
  teacher: `guardian-teacher-${tag}@example.test`,
};
const userIds: Record<string, string> = {};
const cookies: Record<string, string> = {};
let adminMembershipId = "";
let guardianMembershipId = "";
let teacherMembershipId = "";
let linkId = "";
let withdrawalEnrollmentId = "";

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

async function currentRelationship(
  person: string,
  studentId = studentA,
  schoolId = schoolA,
) {
  requestContext.headers = new Headers(
    cookies[person] ? { cookie: cookies[person] } : {},
  );
  return hasCurrentGuardianRelationship(schoolId, studentId);
}

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
        { schoolId: schoolA, userId: userIds.unlinkedGuardian, role: "PARENT" },
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
        {
          id: studentWithdrawal,
          schoolId: schoolA,
          admissionNumber: `G-W-${tag}`.toUpperCase(),
          givenName: "Soon",
          familyName: "Withdrawn",
          status: "ENROLLED",
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
    const withdrawalEnrollment = await prisma.studentEnrollment.create({
      data: {
        schoolId: schoolA,
        studentId: studentWithdrawal,
        sessionId: sessionA,
        classId: classA,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    withdrawalEnrollmentId = withdrawalEnrollment.id;
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
      ["unlinkedGuardian", 404],
      ["otherAdmin", 404],
    ] as const) {
      const result = await create(person, attestation());
      expect(result.status).toBe(status);
      expect(result.headers.get("cache-control")).toBe("private, no-store");
      expect((await list(person)).status).toBe(status);
    }
    expect((await create("admin", attestation(), schoolB)).status).toBe(404);
    expect((await list("admin", schoolB)).status).toBe(404);
    expect(
      await prisma.guardianStudentLink.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
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
    expect(
      await prisma.guardianStudentLink.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
  });

  it("denies existing administrator sessions after role demotion", async () => {
    await prisma.membership.update({
      where: { id: adminMembershipId },
      data: { role: "TEACHER" },
    });
    try {
      expect((await create("admin", attestation())).status).toBe(404);
      expect((await list("admin")).status).toBe(404);
      expect(
        await prisma.guardianStudentLink.count({
          where: { schoolId: schoolA },
        }),
      ).toBe(0);
    } finally {
      await prisma.membership.update({
        where: { id: adminMembershipId },
        data: { role: "SCHOOL_ADMIN" },
      });
    }
  });

  it("denies attestation and listing when the school is inactive", async () => {
    await prisma.school.update({
      where: { id: schoolA },
      data: { isActive: false },
    });
    try {
      expect((await create("admin", attestation())).status).toBe(404);
      expect((await list("admin")).status).toBe(404);
      expect(
        await prisma.guardianStudentLink.count({
          where: { schoolId: schoolA },
        }),
      ).toBe(0);
    } finally {
      await prisma.school.update({
        where: { id: schoolA },
        data: { isActive: true },
      });
    }
  });

  it("rejects an inactive guardian membership before attestation", async () => {
    await prisma.membership.update({
      where: { id: guardianMembershipId },
      data: { isActive: false },
    });
    try {
      expect((await create("admin", attestation())).status).toBe(404);
      expect(
        await prisma.guardianStudentLink.count({
          where: { schoolId: schoolA },
        }),
      ).toBe(0);
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
    expect(
      await prisma.guardianStudentLink.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
  });

  it("rejects direct database links to memberships in another school", async () => {
    const foreign = await prisma.membership.findUniqueOrThrow({
      where: {
        schoolId_userId: { schoolId: schoolB, userId: userIds.otherAdmin },
      },
    });
    await expect(
      prisma.guardianStudentLink.create({
        data: {
          schoolId: schoolA,
          studentId: studentA,
          guardianMembershipId: foreign.id,
          attestedByMembershipId: adminMembershipId,
          attestedByUserId: userIds.admin,
          attestationReason: "Forged cross-school family relationship",
        },
      }),
    ).rejects.toThrow();
  });

  it("a role, matching identifier or unknown link cannot confer relationship", async () => {
    expect(await currentRelationship("guardian")).toBe(false);
    expect(await currentRelationship("unlinkedGuardian")).toBe(false);
    expect(await currentRelationship("teacher")).toBe(false);
    expect(await currentRelationship("guardian", studentUnenrolled)).toBe(false);
    expect(await currentRelationship("guardian", studentA, schoolB)).toBe(false);
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
    expect(await currentRelationship("guardian")).toBe(true);
    expect(await currentRelationship("unlinkedGuardian")).toBe(false);
    expect(await currentRelationship("teacher")).toBe(false);
    expect(await currentRelationship("otherAdmin")).toBe(false);
    expect(await currentRelationship("guardian", studentUnenrolled)).toBe(false);
    expect(await currentRelationship("guardian", studentA, schoolB)).toBe(false);
  });

  it("rechecks current guardian membership, school and section instead of trusting history", async () => {
    await prisma.membership.update({
      where: { id: guardianMembershipId },
      data: { isActive: false },
    });
    try {
      expect(await currentRelationship("guardian")).toBe(false);
    } finally {
      await prisma.membership.update({
        where: { id: guardianMembershipId },
        data: { isActive: true },
      });
    }
    expect(await currentRelationship("guardian")).toBe(true);

    await prisma.school.update({
      where: { id: schoolA },
      data: { isActive: false },
    });
    try {
      expect(await currentRelationship("guardian")).toBe(false);
    } finally {
      await prisma.school.update({
        where: { id: schoolA },
        data: { isActive: true },
      });
    }

    await prisma.schoolSection.update({
      where: { id: sectionA },
      data: { isActive: false },
    });
    try {
      expect(await currentRelationship("guardian")).toBe(false);
    } finally {
      await prisma.schoolSection.update({
        where: { id: sectionA },
        data: { isActive: true },
      });
    }
    expect(await currentRelationship("guardian")).toBe(true);
  });

  it("a real withdrawn enrollment permanently invalidates the guardian link", async () => {
    const created = await create("admin", {
      ...attestation(),
      studentId: studentWithdrawal,
    });
    expect(created.status).toBe(201);
    expect(await currentRelationship("guardian", studentWithdrawal)).toBe(true);
    expect(await currentRelationship("unlinkedGuardian", studentWithdrawal)).toBe(
      false,
    );

    const withdrawn = await withdrawRoute(
      request(
        "admin",
        `/api/schools/${schoolA}/students/${studentWithdrawal}/enrollments/${withdrawalEnrollmentId}/withdraw`,
        "POST",
        { reason: "Synthetic school-approved pupil withdrawal" },
      ),
      {
        params: Promise.resolve({
          schoolId: schoolA,
          studentId: studentWithdrawal,
          enrollmentId: withdrawalEnrollmentId,
        }),
      },
    );
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.headers.get("cache-control")).toBe("private, no-store");
    expect(await currentRelationship("guardian", studentWithdrawal)).toBe(false);
    expect(await currentRelationship("guardian", studentA)).toBe(true);
    expect(
      (await create("admin", { ...attestation(), studentId: studentWithdrawal }))
        .status,
    ).not.toBe(201);
    expect(
      await prisma.studentEvent.count({
        where: {
          schoolId: schoolA,
          studentId: studentWithdrawal,
          eventType: "WITHDRAWN",
        },
      }),
    ).toBe(1);
    const ended = await prisma.studentEnrollment.findUniqueOrThrow({
      where: { id: withdrawalEnrollmentId },
      select: { status: true, endedAt: true },
    });
    expect(ended.status).toBe("ENDED");
    expect(ended.endedAt).not.toBeNull();
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
    await expect(
      prisma.guardianStudentLinkRevocation.create({
        data: {
          schoolId: schoolA,
          linkId,
          actorMembershipId: teacherMembershipId,
          actorUserId: userIds.teacher,
          reason: "Forged guardian revocation from teacher role",
        },
      }),
    ).rejects.toThrow();
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
    expect(await currentRelationship("guardian")).toBe(false);
    await expect(
      prisma.guardianStudentLinkRevocation.update({
        where: { id: link.revocation!.id },
        data: { reason: "Tampered history" },
      }),
    ).rejects.toThrow();
  });

});
