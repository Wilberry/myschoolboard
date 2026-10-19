import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));

import { POST as submitRoute } from "@/app/api/schools/[schoolId]/attendance/route";
import { POST as approveRoute } from "@/app/api/schools/[schoolId]/attendance/[registerId]/decision/route";
import * as correctionRoute from "@/app/api/schools/[schoolId]/attendance/[registerId]/corrections/route";
import * as correctionDecisionRoute from "@/app/api/schools/[schoolId]/attendance-corrections/[requestId]/decision/route";
import { GET as correctableRegistersRoute } from "@/app/api/schools/[schoolId]/attendance/corrections/route";
import { GET as correctableEntriesRoute } from "@/app/api/schools/[schoolId]/attendance/[registerId]/corrections/entries/route";
import { GET as correctionQueueRoute } from "@/app/api/schools/[schoolId]/attendance-correction-reviews/route";
import { GET as correctionDetailRoute } from "@/app/api/schools/[schoolId]/attendance-correction-reviews/[requestId]/route";
import {
  readFormTeacherAttendanceOptions,
  readAttendanceReviewerOptions,
} from "./navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const schoolA = `correction-school-a-${tag}`;
const schoolB = `correction-school-b-${tag}`;
const year = `correction-session-${tag}`;
const primary = `correction-primary-${tag}`;
const secondary = `correction-secondary-${tag}`;
const classA = `correction-class-a-${tag}`;
const classB = `correction-class-b-${tag}`;
const pupilA = `correction-pupil-a-${tag}`;
const pupilB = `correction-pupil-b-${tag}`;
const enrollmentA = `correction-enrollment-a-${tag}`;
const enrollmentB = `correction-enrollment-b-${tag}`;
const users: Record<string, string> = {};
const cookies: Record<string, string> = {};
const members: Record<string, string> = {};
const secret = "synthetic-correction-auth-password";
const today = new Date().toISOString().slice(0, 10);
let registerA = "";
let registerB = "";
let entryA = "";
let request1 = "";
let request2 = "";
let request3 = "";

function request(
  actor: string,
  method: "POST" | "GET",
  url: string,
  body?: unknown,
) {
  context.headers = new Headers(
    cookies[actor] ? { cookie: cookies[actor] } : {},
  );
  return new Request(`http://localhost${url}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function submit(classId: string, enrollmentId: string) {
  const path = `/api/schools/${schoolA}/attendance`;
  return submitRoute(
    request("form", "POST", path, {
      classId,
      sessionId: year,
      attendanceDate: today,
      marks: [{ enrollmentId, mark: "PRESENT" }],
    }),
    { params: Promise.resolve({ schoolId: schoolA }) },
  );
}
async function initialApprove(registerId: string, actor: string) {
  return approveRoute(
    request(
      actor,
      "POST",
      `/api/schools/${schoolA}/attendance/${registerId}/decision`,
      {
        action: "APPROVE",
        reason: "Synthetic original section approval",
      },
    ),
    { params: Promise.resolve({ schoolId: schoolA, registerId }) },
  );
}
async function correction(
  actor: string,
  body: unknown,
  schoolId = schoolA,
  registerId = registerA,
) {
  return correctionRoute.POST(
    request(
      actor,
      "POST",
      `/api/schools/${schoolId}/attendance/${registerId}/corrections`,
      body,
    ),
    { params: Promise.resolve({ schoolId, registerId }) },
  );
}
async function decide(
  actor: string,
  requestId: string,
  action: "APPROVE" | "RETURN",
  schoolId = schoolA,
) {
  return correctionDecisionRoute.POST(
    request(
      actor,
      "POST",
      `/api/schools/${schoolId}/attendance-corrections/${requestId}/decision`,
      {
        action,
        reason: "Synthetic independently reviewed correction",
      },
    ),
    { params: Promise.resolve({ schoolId, requestId }) },
  );
}
async function registers(actor: string, schoolId = schoolA) {
  return correctableRegistersRoute(
    request(actor, "GET", `/api/schools/${schoolId}/attendance/corrections`),
    {
      params: Promise.resolve({ schoolId }),
    },
  );
}
async function entries(
  actor: string,
  registerId = registerA,
  schoolId = schoolA,
) {
  return correctableEntriesRoute(
    request(
      actor,
      "GET",
      `/api/schools/${schoolId}/attendance/${registerId}/corrections/entries`,
    ),
    {
      params: Promise.resolve({ schoolId, registerId }),
    },
  );
}
async function queue(actor: string, schoolId = schoolA) {
  return correctionQueueRoute(
    request(
      actor,
      "GET",
      `/api/schools/${schoolId}/attendance-correction-reviews`,
    ),
    {
      params: Promise.resolve({ schoolId }),
    },
  );
}
async function detail(actor: string, requestId: string, schoolId = schoolA) {
  return correctionDetailRoute(
    request(
      actor,
      "GET",
      `/api/schools/${schoolId}/attendance-correction-reviews/${requestId}`,
    ),
    {
      params: Promise.resolve({ schoolId, requestId }),
    },
  );
}

const proposal = (
  expectedMark: "PRESENT" | "ABSENT" | "LATE",
  proposedMark: "PRESENT" | "ABSENT" | "LATE",
) => ({
  entryId: entryA,
  expectedMark,
  proposedMark,
  reason: "Synthetic pupil mark correction explanation",
});

describe("Phase 6 immutable reasoned attendance corrections", () => {
  beforeAll(async () => {
    for (const actor of [
      "form",
      "support",
      "head",
      "principal",
      "admin",
      "foreign",
    ]) {
      const email = `correction-${actor}-${tag}@example.test`;
      const created = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${actor}`, password: secret },
      });
      users[actor] = created.user.id;
      const login = await auth.api.signInEmail({
        body: { email, password: secret },
        headers: new Headers({ origin: env.BETTER_AUTH_URL }),
        returnHeaders: true,
      });
      cookies[actor] = login.headers
        .getSetCookie()
        .map((v) => v.split(";")[0])
        .join("; ");
      if (!cookies[actor])
        throw new Error("Synthetic authentication unavailable");
    }
    await prisma.school.createMany({
      data: [
        {
          id: schoolA,
          name: "Synthetic Attendance Correction A",
          slug: schoolA,
          allowCoFormTeachers: true,
        },
        {
          id: schoolB,
          name: "Synthetic Attendance Correction B",
          slug: schoolB,
        },
      ],
    });
    for (const [actor, role, schoolId] of [
      ["form", "FORM_TEACHER", schoolA],
      ["support", "FORM_TEACHER", schoolA],
      ["head", "HEAD_OF_SECTION", schoolA],
      ["principal", "PRINCIPAL", schoolA],
      ["admin", "SCHOOL_ADMIN", schoolA],
      ["foreign", "HEAD_OF_SECTION", schoolB],
    ] as const) {
      const membership = await prisma.membership.create({
        data: { userId: users[actor], schoolId, role },
      });
      members[actor] = membership.id;
    }
    await prisma.schoolSection.createMany({
      data: [
        { id: primary, schoolId: schoolA, name: "Primary", stage: "PRIMARY" },
        {
          id: secondary,
          schoolId: schoolA,
          name: "Secondary",
          stage: "SECONDARY",
        },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        {
          id: classA,
          schoolId: schoolA,
          name: "Primary Two",
          sectionId: primary,
        },
        {
          id: classB,
          schoolId: schoolA,
          name: "Secondary Two",
          sectionId: secondary,
        },
      ],
    });
    const now = Date.now();
    await prisma.academicSession.create({
      data: {
        id: year,
        schoolId: schoolA,
        name: "Synthetic Active Year",
        startsOn: new Date(now - 86400000),
        endsOn: new Date(now + 30 * 86400000),
        status: "ACTIVE",
      },
    });
    await prisma.studentRecord.createMany({
      data: [
        {
          id: pupilA,
          schoolId: schoolA,
          admissionNumber: "COR-A-1",
          givenName: "Synthetic",
          familyName: "One",
          status: "ENROLLED",
        },
        {
          id: pupilB,
          schoolId: schoolA,
          admissionNumber: "COR-B-1",
          givenName: "Synthetic",
          familyName: "Two",
          status: "ENROLLED",
        },
      ],
    });
    await prisma.studentEnrollment.createMany({
      data: [
        {
          id: enrollmentA,
          schoolId: schoolA,
          sessionId: year,
          classId: classA,
          studentId: pupilA,
        },
        {
          id: enrollmentB,
          schoolId: schoolA,
          sessionId: year,
          classId: classB,
          studentId: pupilB,
        },
      ],
    });
    await prisma.formTeacherResponsibility.createMany({
      data: [
        {
          schoolId: schoolA,
          sessionId: year,
          classId: classA,
          membershipId: members.form,
          kind: "PRIMARY",
        },
        {
          schoolId: schoolA,
          sessionId: year,
          classId: classB,
          membershipId: members.form,
          kind: "PRIMARY",
        },
        {
          schoolId: schoolA,
          sessionId: year,
          classId: classA,
          membershipId: members.support,
          kind: "SUPPORT",
        },
      ],
    });
    await prisma.scopeGrant.createMany({
      data: [
        {
          membershipId: members.head,
          type: "SECTION",
          scopeId: primary,
          verified: true,
        },
        {
          membershipId: members.head,
          type: "SECTION",
          scopeId: secondary,
          verified: true,
        },
        {
          membershipId: members.principal,
          type: "SECTION",
          scopeId: secondary,
          verified: true,
        },
        {
          membershipId: members.principal,
          type: "SECTION",
          scopeId: primary,
          verified: false,
        },
        {
          membershipId: members.foreign,
          type: "SECTION",
          scopeId: primary,
          verified: true,
        },
      ],
    });
    const a = await submit(classA, enrollmentA);
    const b = await submit(classB, enrollmentB);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    registerA = (await a.json()).register.id;
    registerB = (await b.json()).register.id;
    expect((await initialApprove(registerA, "head")).status).toBe(200);
    expect((await initialApprove(registerB, "principal")).status).toBe(200);
    entryA = (
      await prisma.attendanceEntry.findFirstOrThrow({
        where: { schoolId: schoolA, registerId: registerA },
      })
    ).id;
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

  it("limits correctable register navigation and historical marks to exact Form Teacher", async () => {
    const index = await registers("form");
    expect(index.status).toBe(200);
    expect(index.headers.get("cache-control")).toBe("private, no-store");
    expect(
      (await index.json()).registers.map((x: { id: string }) => x.id).sort(),
    ).toEqual([registerA, registerB].sort());
    const pupil = await entries("form");
    expect(pupil.status).toBe(200);
    const row = (await pupil.json()).register.entries[0];
    expect(row).toMatchObject({
      entryId: entryA,
      admissionNumber: "COR-A-1",
      originalMark: "PRESENT",
      effectiveMark: "PRESENT",
      pending: false,
    });
    expect((await registers("support")).status).toBe(404);
    expect((await registers("head")).status).toBe(404);
    expect((await registers("")).status).toBe(401);
    expect((await entries("principal")).status).toBe(404);
    expect((await entries("foreign")).status).toBe(404);
    expect((await entries("form", registerA, schoolB)).status).toBe(404);
    expect(
      await readFormTeacherAttendanceOptions(users.support, schoolA),
    ).toBeNull();
  });

  it("denies reviewer queues from unrelated actors, even when empty", async () => {
    expect((await queue("")).status).toBe(401);
    expect((await queue("form")).status).toBe(404);
    expect((await queue("admin")).status).toBe(404);
    expect((await queue("foreign")).status).toBe(404);
    expect((await queue("head", schoolB)).status).toBe(404);
    const primary = await queue("head");
    expect(primary.status).toBe(200);
    expect((await primary.json()).corrections).toEqual([]);
    expect(
      (await readAttendanceReviewerOptions(users.principal, schoolA))
        ?.sectionNames,
    ).toEqual(["Secondary"]);
  });

  it("conceals student mark corrections from unauthenticated, support, school admin and foreign actors", async () => {
    for (const [actor, expected] of [
      ["", 401],
      ["support", 404],
      ["head", 404],
      ["principal", 404],
      ["admin", 404],
      ["foreign", 404],
    ] as const) {
      const response = await correction(actor, proposal("PRESENT", "ABSENT"));
      expect(response.status).toBe(expected);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(
      (await correction("form", proposal("PRESENT", "ABSENT"), schoolB)).status,
    ).toBe(404);
    expect("GET" in correctionRoute).toBe(false);
    expect("GET" in correctionDecisionRoute).toBe(false);
  });

  it("rejects unknown entry IDs, forged client actor, identical marks and invalid input", async () => {
    expect(
      (
        await correction("form", {
          ...proposal("PRESENT", "ABSENT"),
          entryId: "foreign",
        })
      ).status,
    ).toBe(404);
    expect(
      (await correction("form", proposal("PRESENT", "PRESENT"))).status,
    ).toBe(400);
    expect(
      (
        await correction("form", {
          ...proposal("PRESENT", "ABSENT"),
          actorUserId: users.head,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await correction("form", {
          ...proposal("PRESENT", "ABSENT"),
          reason: "bad",
        })
      ).status,
    ).toBe(400);
    expect((await correction("form", proposal("ABSENT", "LATE"))).status).toBe(
      409,
    );
  });

  it("rejects revoked Form Teacher membership before a correction is submitted", async () => {
    await prisma.membership.update({
      where: { id: members.form },
      data: { isActive: false },
    });
    try {
      expect(
        (await correction("form", proposal("PRESENT", "ABSENT"))).status,
      ).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: members.form },
        data: { isActive: true },
      });
    }
  });

  it("creates one immutable request with the actual Form Teacher and original expected mark", async () => {
    const response = await correction("form", proposal("PRESENT", "ABSENT"));
    expect(response.status).toBe(201);
    request1 = (await response.json()).correction.id;
    const row = await prisma.attendanceCorrectionRequest.findFirstOrThrow({
      where: { id: request1, schoolId: schoolA },
    });
    expect(row).toMatchObject({
      registerId: registerA,
      entryId: entryA,
      revision: 1,
      expectedMark: "PRESENT",
      proposedMark: "ABSENT",
      requestedByUserId: users.form,
      requestedByMembershipId: members.form,
    });
    expect(
      (
        await prisma.attendanceEntry.findFirstOrThrow({
          where: { id: entryA },
        })
      ).mark,
    ).toBe("PRESENT");
    const reviewQueue = await queue("head");
    expect(reviewQueue.status).toBe(200);
    const payload = await reviewQueue.json();
    expect(payload.corrections.map((x: { id: string }) => x.id)).toContain(
      request1,
    );
    expect(JSON.stringify(payload)).not.toContain("COR-A-1");
    expect(JSON.stringify(payload)).not.toContain(
      "Synthetic pupil mark correction",
    );
    const reviewDetail = await detail("head", request1);
    expect(reviewDetail.status).toBe(200);
    const record = (await reviewDetail.json()).correction;
    expect(record).toMatchObject({
      admissionNumber: "COR-A-1",
      originalMark: "PRESENT",
      expectedMark: "PRESENT",
      proposedMark: "ABSENT",
    });
    expect((await detail("principal", request1)).status).toBe(404);
    expect((await detail("foreign", request1)).status).toBe(404);
    const forAuthor = (await (await entries("form")).json()).register
      .entries[0];
    expect(forAuthor).toMatchObject({
      originalMark: "PRESENT",
      effectiveMark: "PRESENT",
      pending: true,
    });
    expect((await correction("form", proposal("PRESENT", "LATE"))).status).toBe(
      409,
    );
  });

  it("denies wrong-stage, foreign, unverified and revoked section reviewer decisions", async () => {
    for (const actor of ["form", "support", "admin", "foreign", "principal"]) {
      expect((await decide(actor, request1, "APPROVE")).status).toBe(404);
    }
    expect((await decide("head", request1, "APPROVE", schoolB)).status).toBe(
      404,
    );
    const scope = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, scopeId: primary },
    });
    await prisma.scopeGrant.update({
      where: { id: scope.id },
      data: { verified: false },
    });
    try {
      expect((await decide("head", request1, "APPROVE")).status).toBe(404);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: scope.id },
        data: { verified: true },
      });
    }
  });

  it("returns a correction without changing the original or effective mark", async () => {
    const result = await decide("head", request1, "RETURN");
    expect(result.status).toBe(200);
    expect((await result.json()).decision.approved).toBe(false);
    expect((await decide("head", request1, "APPROVE")).status).toBe(404);
    const row = await prisma.attendanceEntry.findUniqueOrThrow({
      where: { id: entryA },
    });
    expect(row.mark).toBe("PRESENT");
    expect((await detail("head", request1)).status).toBe(404);
    const current = (await (await entries("form")).json()).register.entries[0];
    expect(current).toMatchObject({
      originalMark: "PRESENT",
      effectiveMark: "PRESENT",
      pending: false,
    });
  });

  it("permits a new audited revision after a returned request, and approves its proposed mark", async () => {
    const result = await correction("form", proposal("PRESENT", "LATE"));
    expect(result.status).toBe(201);
    const created = (await result.json()).correction;
    request2 = created.id;
    expect(created.revision).toBe(2);
    expect((await decide("head", request2, "APPROVE")).status).toBe(200);
    const accepted = await prisma.attendanceCorrectionRequest.findFirstOrThrow({
      where: { id: request2 },
      include: { decisions: true },
    });
    expect(accepted.decisions[0]?.approved).toBe(true);
    expect(
      (
        await prisma.attendanceEntry.findUniqueOrThrow({
          where: { id: entryA },
        })
      ).mark,
    ).toBe("PRESENT");
    const corrected = (await (await entries("form")).json()).register
      .entries[0];
    expect(corrected).toMatchObject({
      originalMark: "PRESENT",
      effectiveMark: "LATE",
      pending: false,
    });
    expect(
      (await correction("form", proposal("PRESENT", "ABSENT"))).status,
    ).toBe(409);
  });

  it("preserves successive versions and rejects a stale expected mark", async () => {
    const next = await correction("form", proposal("LATE", "ABSENT"));
    expect(next.status).toBe(201);
    request3 = (await next.json()).correction.id;
    expect((await correction("form", proposal("LATE", "PRESENT"))).status).toBe(
      409,
    );
    expect((await decide("head", request3, "RETURN")).status).toBe(200);
    const rows = await prisma.attendanceCorrectionRequest.findMany({
      where: { schoolId: schoolA, entryId: entryA },
      orderBy: { revision: "asc" },
      include: { decisions: true },
    });
    expect(rows.map((x) => [x.revision, x.decisions[0]?.approved])).toEqual([
      [1, false],
      [2, true],
      [3, false],
    ]);
    expect(rows[0].reason).toContain("Synthetic");
    expect(rows[1].proposedMark).toBe("LATE");
  });

  it("prevents forged actor rows, audit edits, removal and truncation at the database layer", async () => {
    await expect(
      prisma.attendanceCorrectionRequest.create({
        data: {
          schoolId: schoolA,
          registerId: registerA,
          entryId: entryA,
          revision: 4,
          expectedMark: "LATE",
          proposedMark: "ABSENT",
          requestedByUserId: users.admin,
          requestedByMembershipId: members.admin,
          reason: "Synthetic attempt to impersonate correction author",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.attendanceCorrectionDecision.create({
        data: {
          schoolId: schoolA,
          registerId: registerA,
          requestId: request1,
          reviewerUserId: users.form,
          reviewerMembershipId: members.form,
          approved: true,
          reason: "Synthetic forged reviewer decision",
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.attendanceCorrectionRequest.update({
        where: { id: request1 },
        data: { reason: "Attempted historical overwrite" },
      }),
    ).rejects.toThrow();
    const decision = await prisma.attendanceCorrectionDecision.findFirstOrThrow(
      {
        where: { requestId: request1 },
      },
    );
    await expect(
      prisma.attendanceCorrectionDecision.update({
        where: { id: decision.id },
        data: { approved: true },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.attendanceCorrectionRequest.delete({
        where: { id: request1 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "AttendanceCorrectionRequest" CASCADE',
      ),
    ).rejects.toThrow();
  });

  it("serializes concurrent revisions rather than losing the winner's audit", async () => {
    context.headers = new Headers({ cookie: cookies.form });
    const path = `/api/schools/${schoolA}/attendance/${registerA}/corrections`;
    const input = proposal("LATE", "PRESENT");
    const call = () =>
      correctionRoute.POST(
        new Request(`http://localhost${path}`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
        {
          params: Promise.resolve({ schoolId: schoolA, registerId: registerA }),
        },
      );
    const answers = await Promise.all([call(), call()]);
    expect(answers.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.attendanceCorrectionRequest.count({
        where: { schoolId: schoolA, entryId: entryA },
      }),
    ).toBe(4);
  });
});
