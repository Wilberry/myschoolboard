import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const requestContext = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({
  headers: async () => requestContext.headers,
}));

import * as createRoute from "@/app/api/schools/[schoolId]/teacher-assignments/route";
import * as deactivateRoute from "@/app/api/schools/[schoolId]/teacher-assignments/[assignmentId]/deactivate/route";
import * as revokeRoute from "@/app/api/schools/[schoolId]/teacher-assignments/[assignmentId]/revoke/route";
import * as reactivateRoute from "@/app/api/schools/[schoolId]/teacher-assignments/[assignmentId]/reactivate/route";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";
import { prisma } from "@/src/lib/db";
import { authorize } from "@/src/modules/authorization/policy";
import { resolveSchoolPrincipal } from "@/src/modules/tenancy/context";

const fixtureId = randomUUID();
const password = "synthetic-assignment-route-test-password-42";
const adminEmail = `assignment-route-admin-${fixtureId}@example.test`;
const otherAdminEmail = `assignment-route-other-admin-${fixtureId}@example.test`;
const principalEmail = `assignment-route-principal-${fixtureId}@example.test`;
const teacherEmail = `assignment-route-teacher-${fixtureId}@example.test`;
const otherTeacherEmail = `assignment-route-other-teacher-${fixtureId}@example.test`;
const platformEmail = `assignment-route-platform-${fixtureId}@example.test`;
const schoolA = `assignment-route-school-a-${fixtureId}`;
const schoolB = `assignment-route-school-b-${fixtureId}`;
const adminMembershipId = `assignment-route-admin-member-${fixtureId}`;
const principalMembershipId = `assignment-route-principal-member-${fixtureId}`;
const teacherMembershipId = `assignment-route-teacher-member-${fixtureId}`;
const otherTeacherMembershipId = `assignment-route-other-teacher-member-${fixtureId}`;
const classA = `assignment-route-class-a-${fixtureId}`;
const inactiveClassA = `assignment-route-class-inactive-${fixtureId}`;
const classB = `assignment-route-class-b-${fixtureId}`;
const subjectA = `assignment-route-subject-a-${fixtureId}`;
const inactiveSubjectA = `assignment-route-subject-inactive-${fixtureId}`;
const subjectB = `assignment-route-subject-b-${fixtureId}`;

let adminUserId = "";
let otherAdminUserId = "";
let principalUserId = "";
let teacherUserId = "";
let otherTeacherUserId = "";
let platformUserId = "";
let adminCookie = "";
let otherAdminCookie = "";
let principalCookie = "";
let platformCookie = "";

type RouteParams = { schoolId: string; assignmentId: string };
type LifecycleHandler = (
  request: Request,
  context: { params: Promise<RouteParams> },
) => Promise<Response>;

async function signIn(email: string): Promise<string> {
  const result = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = result.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Sign-in did not issue a session cookie");
  return cookie;
}

function setCookie(cookie = "") {
  requestContext.headers = new Headers(cookie ? { cookie } : {});
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function create(
  body: unknown,
  cookie = adminCookie,
  targetSchool = schoolA,
) {
  setCookie(cookie);
  return createRoute.POST(jsonRequest(body), {
    params: Promise.resolve({ schoolId: targetSchool }),
  });
}

async function lifecycle(
  handler: LifecycleHandler,
  assignmentId: string,
  body: unknown,
  cookie = adminCookie,
  targetSchool = schoolA,
) {
  setCookie(cookie);
  return handler(jsonRequest(body), {
    params: Promise.resolve({ schoolId: targetSchool, assignmentId }),
  });
}

async function createValidAssignment(
  body = { teacherMembershipId, classId: classA, subjectId: subjectA },
  cookie = adminCookie,
  targetSchool = schoolA,
) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await create(body, cookie, targetSchool);
    if (response.status === 201) {
      return (await response.json()).assignment as {
        id: string;
        status: string;
      };
    }
    const assignmentCount = await prisma.teacherClassSubjectAssignment.count({
      where: { schoolId: targetSchool },
    });
    const eventCount = await prisma.teacherClassSubjectAssignmentEvent.count({
      where: { schoolId: targetSchool },
    });
    if (response.status !== 409 || assignmentCount !== 0 || eventCount !== 0) {
      throw new Error(
        `Expected assignment creation, received HTTP ${response.status}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Assignment creation repeatedly conflicted without a row");
}

async function events() {
  return prisma.teacherClassSubjectAssignmentEvent.findMany({
    where: { schoolId: schoolA },
    orderBy: { createdAt: "asc" },
  });
}

async function waitUntilBlockedOnDatabaseLock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  blockerPid: number,
) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const blocked = await tx.$queryRaw<Array<{ pid: number }>>`
      SELECT pid FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
        AND ${blockerPid} = ANY(pg_blocking_pids(pid))
    `;
    if (blocked.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Assignment route did not wait for the expected row lock");
}

describe("teacher assignment mutation routes", () => {
  beforeAll(async () => {
    const signups = await Promise.all(
      [
        ["Assignment Route Admin", adminEmail],
        ["Assignment Route Other Admin", otherAdminEmail],
        ["Assignment Route Principal", principalEmail],
        ["Assignment Route Teacher", teacherEmail],
        ["Assignment Route Other Teacher", otherTeacherEmail],
        ["Assignment Route Platform Admin", platformEmail],
      ].map(([name, email]) =>
        auth.api.signUpEmail({
          body: { name, email, password },
        }),
      ),
    );
    [
      adminUserId,
      otherAdminUserId,
      principalUserId,
      teacherUserId,
      otherTeacherUserId,
      platformUserId,
    ] = signups.map((result) => result.user.id);

    await prisma.user.update({
      where: { id: platformUserId },
      data: { platformRole: "SUPER_ADMIN" },
    });
    await prisma.school.create({
      data: {
        id: schoolB,
        name: "Assignment Route School B",
        slug: `${schoolB}-slug`,
      },
    });
    await prisma.membership.createMany({
      data: [
        { userId: otherAdminUserId, schoolId: schoolB, role: "SCHOOL_ADMIN" },
        {
          id: otherTeacherMembershipId,
          userId: otherTeacherUserId,
          schoolId: schoolB,
          role: "TEACHER",
        },
      ],
    });
    await prisma.schoolClass.create({
      data: { id: classB, schoolId: schoolB, name: `Class ${fixtureId}` },
    });
    await prisma.subject.create({
      data: { id: subjectB, schoolId: schoolB, name: `Subject ${fixtureId}` },
    });

    adminCookie = await signIn(adminEmail);
    otherAdminCookie = await signIn(otherAdminEmail);
    principalCookie = await signIn(principalEmail);
    platformCookie = await signIn(platformEmail);
  }, 30_000);

  beforeEach(async () => {
    setCookie();
    await prisma.school.deleteMany({ where: { id: schoolA } });
    await prisma.school.create({
      data: {
        id: schoolA,
        name: "Assignment Route School A",
        slug: `${schoolA}-slug`,
      },
    });
    await prisma.membership.createMany({
      data: [
        {
          id: adminMembershipId,
          userId: adminUserId,
          schoolId: schoolA,
          role: "SCHOOL_ADMIN",
        },
        {
          id: principalMembershipId,
          userId: principalUserId,
          schoolId: schoolA,
          role: "PRINCIPAL",
        },
        {
          id: teacherMembershipId,
          userId: teacherUserId,
          schoolId: schoolA,
          role: "TEACHER",
        },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: schoolA, name: `Class ${fixtureId}` },
        {
          id: inactiveClassA,
          schoolId: schoolA,
          name: `Inactive Class ${fixtureId}`,
          isActive: false,
        },
      ],
    });
    await prisma.subject.createMany({
      data: [
        { id: subjectA, schoolId: schoolA, name: `Subject ${fixtureId}` },
        {
          id: inactiveSubjectA,
          schoolId: schoolA,
          name: `Inactive Subject ${fixtureId}`,
          isActive: false,
        },
      ],
    });
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    setCookie();
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    const userIds = [
      adminUserId,
      otherAdminUserId,
      principalUserId,
      teacherUserId,
      otherTeacherUserId,
      platformUserId,
    ];
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("requires a server-side session for every mutation", async () => {
    const assignment = await createValidAssignment();
    setCookie();
    const responses = await Promise.all([
      create({ teacherMembershipId, classId: classA, subjectId: subjectA }, ""),
      lifecycle(deactivateRoute.POST, assignment.id, { reason: "reason" }, ""),
      lifecycle(revokeRoute.POST, assignment.id, { reason: "reason" }, ""),
      lifecycle(reactivateRoute.POST, assignment.id, {}, ""),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
    expect(await events()).toHaveLength(1);
  });

  it("denies every mutation after session revocation", async () => {
    const assignment = await createValidAssignment();
    const cookie = await signIn(adminEmail);
    const liveSession = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    if (!liveSession) {
      throw new Error("Expected a valid session before revocation");
    }

    await prisma.session.delete({
      where: { id: liveSession.session.id },
    });

    const body = { teacherMembershipId, classId: classA, subjectId: subjectA };
    const attempts = [
      () => create(body, cookie),
      () =>
        lifecycle(
          deactivateRoute.POST,
          assignment.id,
          { reason: "Synthetic expired session" },
          cookie,
        ),
      () =>
        lifecycle(
          revokeRoute.POST,
          assignment.id,
          { reason: "Synthetic expired session" },
          cookie,
        ),
      () => lifecycle(reactivateRoute.POST, assignment.id, {}, cookie),
    ];

    for (const attempt of attempts) {
      const response = await attempt();
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
    expect(await events()).toHaveLength(1);
    expect(
      await prisma.teacherClassSubjectAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      }),
    ).toMatchObject({ status: "ACTIVE" });
  });

  it("rechecks demoted membership with an active session", async () => {
    const cookie = await signIn(adminEmail);
    await prisma.membership.update({
      where: { id: adminMembershipId },
      data: { role: "PRINCIPAL" },
    });

    const response = await create(
      { teacherMembershipId, classId: classA, subjectId: subjectA },
      cookie,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(await events()).toHaveLength(0);
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
  });

  it("creates an assignment and exactly one event using the authenticated actor", async () => {
    const assignment = await createValidAssignment();
    expect(assignment).toMatchObject({
      schoolId: schoolA,
      membershipId: teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
      status: "ACTIVE",
    });
    const [event] = await events();
    const actorMembership = await prisma.membership.findUniqueOrThrow({
      where: { id: adminMembershipId },
    });
    expect(await events()).toHaveLength(1);
    expect(event).toMatchObject({
      actorUserId: adminUserId,
      actorMembershipId: actorMembership.id,
      assignmentId: assignment.id,
      teacherMembershipId,
      eventType: "CREATED",
      newStatus: "ACTIVE",
    });
  });

  it("keeps period-aware assignments distinct from legacy authorizations", async () => {
    const sessionId = `assignment-session-a-${fixtureId}`;
    await prisma.academicSession.create({
      data: {
        id: sessionId,
        schoolId: schoolA,
        name: "Session A",
        status: "ACTIVE",
        startsOn: new Date("2026-09-01T00:00:00.000Z"),
        endsOn: new Date("2027-07-31T00:00:00.000Z"),
      },
    });
    const input = {
      teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
      sessionId,
    };
    const periodResponse = await create(input);
    expect(periodResponse.status).toBe(201);
    const periodAssignment = (await periodResponse.json()).assignment;
    expect(periodAssignment.sessionId).toBe(sessionId);
    expect((await create(input)).status).toBe(409);

    const legacyResponse = await create({
      teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
    });
    expect(legacyResponse.status).toBe(201);
    const legacyAssignment = (await legacyResponse.json()).assignment;
    expect(legacyAssignment.sessionId).toBeNull();

    const teacherPrincipal = await resolveSchoolPrincipal(
      teacherUserId,
      schoolA,
    );
    expect(authorize(teacherPrincipal, "academic:read", {
      schoolId: schoolA,
      classId: classA,
      subjectId: subjectA,
      sessionId,
    }).allowed).toBe(true);
    expect(authorize(teacherPrincipal, "academic:read", {
      schoolId: schoolA,
      classId: classA,
      subjectId: subjectA,
      sessionId: "another-session",
    }).allowed).toBe(false);

    const revokeLegacy = await lifecycle(
      revokeRoute.POST,
      legacyAssignment.id,
      { reason: "Synthetic legacy access test" },
    );
    expect(revokeLegacy.status).toBe(200);
    const after = await resolveSchoolPrincipal(teacherUserId, schoolA);
    expect(authorize(after, "academic:read", {
      schoolId: schoolA,
      classId: classA,
      subjectId: subjectA,
    }).allowed).toBe(false);
    expect(authorize(after, "academic:read", {
      schoolId: schoolA,
      classId: classA,
      subjectId: subjectA,
      sessionId,
    }).allowed).toBe(true);

    // Even an ACTIVE assignment no longer authorizes a CLOSED session.
    await prisma.academicSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED" },
    });
    const closed = await resolveSchoolPrincipal(teacherUserId, schoolA);
    expect(authorize(closed, "academic:read", {
      schoolId: schoolA,
      classId: classA,
      subjectId: subjectA,
      sessionId,
    }).allowed).toBe(false);
  });

  it("rejects planned, closed and other-school session assignments", async () => {
    const plannedId = `assignment-planned-${fixtureId}`;
    const closedId = `assignment-closed-${fixtureId}`;
    const otherId = `assignment-other-${fixtureId}`;
    const dates = {
      startsOn: new Date("2026-09-01T00:00:00.000Z"),
      endsOn: new Date("2027-07-31T00:00:00.000Z"),
    };
    await prisma.academicSession.createMany({
      data: [
        { id: plannedId, schoolId: schoolA, name: "Planned", ...dates },
        { id: closedId, schoolId: schoolA, name: "Closed", status: "CLOSED", ...dates },
        { id: otherId, schoolId: schoolB, name: "Other School", status: "ACTIVE", ...dates },
      ],
    });
    for (const sessionId of [plannedId, closedId, otherId]) {
      const response = await create({
        teacherMembershipId,
        classId: classA,
        subjectId: subjectA,
        sessionId,
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
    expect(await events()).toHaveLength(0);
  });

  it("marks all mutation response types private and no-store", async () => {
    const body = { teacherMembershipId, classId: classA, subjectId: subjectA };
    const created = await create(body);
    expect(created.status).toBe(201);
    const result = (await created.json()) as { assignment: { id: string } };

    const duplicate = await create(body);
    expect(duplicate.status).toBe(409);
    const unauthorized = await create(body, "");
    expect(unauthorized.status).toBe(401);
    const forbidden = await create(body, otherAdminCookie);
    expect(forbidden.status).toBe(404);
    const invalid = await create({ teacherMembershipId, classId: classA });
    expect(invalid.status).toBe(400);
    const revoked = await lifecycle(revokeRoute.POST, result.assignment.id, {
      reason: "Synthetic cache regression test",
    });
    expect(revoked.status).toBe(200);

    for (const response of [
      created,
      duplicate,
      unauthorized,
      forbidden,
      invalid,
      revoked,
    ]) {
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });

  it("rejects forged actor and tenant fields in the request body", async () => {
    const response = await create({
      schoolId: schoolB,
      actorUserId: teacherUserId,
      actorMembershipId: teacherMembershipId,
      teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
    });
    expect(response.status).toBe(400);
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
    expect(await events()).toHaveLength(0);
  });

  it("denies platform-only, nonmember, insufficient-role, and inactive actors uniformly", async () => {
    const bodies = {
      teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
    };
    const platformOnly = await create(bodies, platformCookie);
    const otherSchoolAdmin = await create(bodies, otherAdminCookie);
    const insufficientRole = await create(bodies, principalCookie);

    await prisma.membership.update({
      where: { id: adminMembershipId },
      data: { isActive: false },
    });
    const inactiveActor = await create(bodies);

    for (const response of [
      platformOnly,
      otherSchoolAdmin,
      insufficientRole,
      inactiveActor,
    ]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
    expect(await events()).toHaveLength(0);
  });

  it("returns the same concealed response for missing and cross-school targets", async () => {
    const bodies = [
      {
        teacherMembershipId: otherTeacherMembershipId,
        classId: classA,
        subjectId: subjectA,
      },
      { teacherMembershipId, classId: classB, subjectId: subjectA },
      { teacherMembershipId, classId: classA, subjectId: subjectB },
      {
        teacherMembershipId: "missing-teacher",
        classId: classA,
        subjectId: subjectA,
      },
      { teacherMembershipId, classId: "missing-class", subjectId: subjectA },
      { teacherMembershipId, classId: classA, subjectId: "missing-subject" },
    ];
    for (const body of bodies) {
      const response = await create(body);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
    expect(await events()).toHaveLength(0);
  });

  it("rejects inactive teacher, class, and subject targets", async () => {
    await prisma.membership.update({
      where: { id: teacherMembershipId },
      data: { isActive: false },
    });
    const inactiveTeacher = await create({
      teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
    });
    await prisma.membership.update({
      where: { id: teacherMembershipId },
      data: { isActive: true },
    });
    const inactiveClass = await create({
      teacherMembershipId,
      classId: inactiveClassA,
      subjectId: subjectA,
    });
    const inactiveSubject = await create({
      teacherMembershipId,
      classId: classA,
      subjectId: inactiveSubjectA,
    });

    for (const response of [inactiveTeacher, inactiveClass, inactiveSubject]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
    expect(await events()).toHaveLength(0);
  });

  it("rejects missing fields, unexpected fields, malformed JSON, and missing lifecycle reasons", async () => {
    setCookie(adminCookie);
    const missingCreateField = await create({
      teacherMembershipId,
      classId: classA,
    });
    const unexpectedCreateField = await create({
      teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
      actorUserId: adminUserId,
    });
    const malformedJson = await createRoute.POST(
      new Request("http://localhost/api/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      { params: Promise.resolve({ schoolId: schoolA }) },
    );
    const assignment = await createValidAssignment();
    const missingDeactivateReason = await lifecycle(
      deactivateRoute.POST,
      assignment.id,
      {},
    );
    const missingRevokeReason = await lifecycle(
      revokeRoute.POST,
      assignment.id,
      {},
    );

    for (const response of [
      missingCreateField,
      unexpectedCreateField,
      malformedJson,
      missingDeactivateReason,
      missingRevokeReason,
    ]) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid request" });
    }
    expect(await events()).toHaveLength(1);
  });

  it("prevents duplicate assignment creation without a duplicate audit event", async () => {
    await createValidAssignment();
    const duplicate = await create({
      teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
    });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toEqual({ error: "Conflict" });
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(1);
    expect(await events()).toHaveLength(1);
  });

  it("supports valid lifecycle transitions and rejects repeated transitions", async () => {
    const assignment = await createValidAssignment();
    const deactivated = await lifecycle(deactivateRoute.POST, assignment.id, {
      reason: "Teacher reassigned",
    });
    expect(deactivated.status).toBe(200);
    expect((await deactivated.json()).assignment.status).toBe("INACTIVE");
    const repeatedDeactivation = await lifecycle(
      deactivateRoute.POST,
      assignment.id,
      { reason: "Repeated" },
    );
    expect(repeatedDeactivation.status).toBe(409);

    const revoked = await lifecycle(revokeRoute.POST, assignment.id, {
      reason: "Assignment withdrawn",
    });
    expect(revoked.status).toBe(200);
    expect((await revoked.json()).assignment.status).toBe("REVOKED");
    const repeatedRevocation = await lifecycle(
      revokeRoute.POST,
      assignment.id,
      { reason: "Repeated" },
    );
    expect(repeatedRevocation.status).toBe(409);

    const reactivated = await lifecycle(
      reactivateRoute.POST,
      assignment.id,
      {},
    );
    expect(reactivated.status).toBe(200);
    expect((await reactivated.json()).assignment.status).toBe("ACTIVE");
    expect((await events()).map((event) => event.eventType)).toEqual([
      "CREATED",
      "DEACTIVATED",
      "REVOKED",
      "REACTIVATED",
    ]);
  });

  it("conceals another school's assignment ID and rejects invalid reactivation targets", async () => {
    const schoolBAssignment = await createValidAssignment(
      {
        teacherMembershipId: otherTeacherMembershipId,
        classId: classB,
        subjectId: subjectB,
      },
      otherAdminCookie,
      schoolB,
    );
    const crossSchool = await lifecycle(
      deactivateRoute.POST,
      schoolBAssignment.id,
      { reason: "Cross school" },
    );
    const missingAssignment = await lifecycle(
      deactivateRoute.POST,
      `missing-assignment-${fixtureId}`,
      { reason: "Missing target" },
    );
    expect(crossSchool.status).toBe(404);
    expect(await crossSchool.json()).toEqual({ error: "Not found" });
    expect(missingAssignment.status).toBe(404);
    expect(await missingAssignment.json()).toEqual({ error: "Not found" });

    const assignment = await createValidAssignment();
    await lifecycle(deactivateRoute.POST, assignment.id, { reason: "Pause" });
    await prisma.schoolClass.update({
      where: { id: classA },
      data: { isActive: false },
    });
    const invalidReactivation = await lifecycle(
      reactivateRoute.POST,
      assignment.id,
      {},
    );
    expect(invalidReactivation.status).toBe(404);
    expect(await invalidReactivation.json()).toEqual({ error: "Not found" });
    expect(
      await prisma.teacherClassSubjectAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      }),
    ).toMatchObject({ status: "INACTIVE" });
    expect(await events()).toHaveLength(2);
  });

  it("refuses reactivation when the teacher, class, or subject is inactive", async () => {
    const assignment = await createValidAssignment();
    const deactivated = await lifecycle(deactivateRoute.POST, assignment.id, {
      reason: "Temporary pause",
    });
    expect(deactivated.status).toBe(200);

    await prisma.membership.update({
      where: { id: teacherMembershipId },
      data: { isActive: false },
    });
    const inactiveTeacher = await lifecycle(
      reactivateRoute.POST,
      assignment.id,
      {},
    );
    await prisma.membership.update({
      where: { id: teacherMembershipId },
      data: { isActive: true },
    });

    await prisma.schoolClass.update({
      where: { id: classA },
      data: { isActive: false },
    });
    const inactiveClass = await lifecycle(
      reactivateRoute.POST,
      assignment.id,
      {},
    );
    await prisma.schoolClass.update({
      where: { id: classA },
      data: { isActive: true },
    });

    await prisma.subject.update({
      where: { id: subjectA },
      data: { isActive: false },
    });
    const inactiveSubject = await lifecycle(
      reactivateRoute.POST,
      assignment.id,
      {},
    );

    for (const response of [inactiveTeacher, inactiveClass, inactiveSubject]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
    expect(
      await prisma.teacherClassSubjectAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      }),
    ).toMatchObject({ status: "INACTIVE" });
    expect(await events()).toHaveLength(2);
  });

  it("denies safely even when the security logger throws", async () => {
    const logEntries: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation((entry) => {
      logEntries.push(String(entry));
      throw new Error(`logger should not leak ${adminUserId}`);
    });
    const response = await create(
      { teacherMembershipId, classId: classA, subjectId: subjectA },
      otherAdminCookie,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(warn).toHaveBeenCalledTimes(1);
    const logEntry = JSON.parse(logEntries[0]) as Record<string, string>;
    expect(logEntry).toMatchObject({
      event: "teacher_assignment_mutation_denied",
      operation: "create",
    });
    expect(logEntry.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(logEntries[0]).not.toContain(adminUserId);
    expect(logEntries[0]).not.toContain("cookie");
    expect(await events()).toHaveLength(0);
  });

  it("rolls back creation and lifecycle transitions when audit persistence fails", async () => {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "fail_assignment_route_audit_test"() RETURNS trigger AS $$
      BEGIN
        IF NEW.actorUserId = '${adminUserId}' AND
          (NEW.eventType = 'CREATED' OR NEW.reason = 'force route audit failure') THEN
          RAISE EXCEPTION 'synthetic route audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "fail_assignment_route_audit_test_trigger"
      BEFORE INSERT ON "TeacherClassSubjectAssignmentEvent"
      FOR EACH ROW EXECUTE FUNCTION "fail_assignment_route_audit_test"()
    `);
    try {
      const createFailure = await create({
        teacherMembershipId,
        classId: classA,
        subjectId: subjectA,
      });
      expect(createFailure.status).toBe(500);
      expect(createFailure.headers.get("cache-control")).toBe(
        "private, no-store",
      );
      expect(
        await prisma.teacherClassSubjectAssignment.count({
          where: { schoolId: schoolA },
        }),
      ).toBe(0);
      expect(await events()).toHaveLength(0);

      await prisma.$executeRawUnsafe(
        'DROP TRIGGER "fail_assignment_route_audit_test_trigger" ON "TeacherClassSubjectAssignmentEvent"',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION "fail_assignment_route_audit_test"()',
      );
      const assignment = await createValidAssignment();
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "fail_assignment_route_audit_test"() RETURNS trigger AS $$
        BEGIN
          IF NEW.actorUserId = '${adminUserId}' AND NEW.reason = 'force route audit failure' THEN
            RAISE EXCEPTION 'synthetic route audit failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "fail_assignment_route_audit_test_trigger"
        BEFORE INSERT ON "TeacherClassSubjectAssignmentEvent"
        FOR EACH ROW EXECUTE FUNCTION "fail_assignment_route_audit_test"()
      `);
      const transitionFailure = await lifecycle(
        deactivateRoute.POST,
        assignment.id,
        { reason: "force route audit failure" },
      );
      expect(transitionFailure.status).toBe(500);
      expect(transitionFailure.headers.get("cache-control")).toBe(
        "private, no-store",
      );
      expect(
        await prisma.teacherClassSubjectAssignment.findUniqueOrThrow({
          where: { id: assignment.id },
        }),
      ).toMatchObject({ status: "ACTIVE" });
      expect(await events()).toHaveLength(1);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "fail_assignment_route_audit_test_trigger" ON "TeacherClassSubjectAssignmentEvent"',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS "fail_assignment_route_audit_test"()',
      );
    }
  });

  it("serializes competing route transitions and records only one winner", async () => {
    const assignment = await createValidAssignment();
    const responses = await Promise.all([
      lifecycle(deactivateRoute.POST, assignment.id, {
        reason: "Concurrent A",
      }),
      lifecycle(deactivateRoute.POST, assignment.id, {
        reason: "Concurrent B",
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(await events()).toHaveLength(2);
  });

  it("does not create an assignment when actor membership is revoked during the request", async () => {
    let attempt!: Promise<Response>;
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Membership" WHERE "id" = ${adminMembershipId} FOR UPDATE`;
        const [{ pid }] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        setCookie(adminCookie);
        attempt = createRoute.POST(
          jsonRequest({
            teacherMembershipId,
            classId: classA,
            subjectId: subjectA,
          }),
          {
            params: Promise.resolve({ schoolId: schoolA }),
          },
        );
        void attempt.catch(() => undefined);
        await waitUntilBlockedOnDatabaseLock(tx, pid);
        await tx.membership.update({
          where: { id: adminMembershipId },
          data: { isActive: false },
        });
      },
      { timeout: 15_000 },
    );

    const response = await attempt;
    expect([404, 409]).toContain(response.status);
    expect(["Not found", "Conflict"]).toContain((await response.json()).error);
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
    expect(await events()).toHaveLength(0);
  }, 20_000);

  it("exports only intended administration read and mutation handlers", () => {
    expect(Object.hasOwn(createRoute, "GET")).toBe(true);
    expect(Object.hasOwn(createRoute, "POST")).toBe(true);
    for (const route of [
      createRoute,
      deactivateRoute,
      revokeRoute,
      reactivateRoute,
    ]) {
      expect(Object.hasOwn(route, "DELETE")).toBe(false);
    }
    for (const route of [
      deactivateRoute,
      revokeRoute,
      reactivateRoute,
    ]) {
      expect(Object.hasOwn(route, "GET")).toBe(false);
    }
  });
});
