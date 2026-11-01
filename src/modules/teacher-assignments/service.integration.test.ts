import "dotenv/config";
import { randomUUID } from "node:crypto";
import {
  afterAll,
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

import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";
import { prisma } from "@/src/lib/db";
import {
  createTeacherClassSubjectAssignment,
  deactivateTeacherClassSubjectAssignment,
  reactivateTeacherClassSubjectAssignment,
  revokeTeacherClassSubjectAssignment,
} from "./service";

const testId = randomUUID();
const password = "synthetic-assignment-test-password-42";
const adminEmail = `assignment-admin-${testId}@example.test`;
const limitedEmail = `assignment-limited-${testId}@example.test`;
const otherAdminEmail = `assignment-other-admin-${testId}@example.test`;
const schoolA = `service-school-a-${testId}`;
const schoolB = `service-school-b-${testId}`;
const teacherMembershipId = `service-teacher-membership-${testId}`;
const studentMembershipId = `service-student-membership-${testId}`;
const otherTeacherMembershipId = `service-other-teacher-${testId}`;
const otherTeacherUserId = `assignment-other-teacher-${testId}`;
const classA = `service-class-a-${testId}`;
const inactiveClass = `service-class-inactive-${testId}`;
const otherClass = `service-class-b-${testId}`;
const subjectA = `service-subject-a-${testId}`;
const inactiveSubject = `service-subject-inactive-${testId}`;
const otherSubject = `service-subject-b-${testId}`;
const createdUsers = new Set<string>();
let adminUserId = "";
let limitedUserId = "";
let otherAdminUserId = "";
const studentUserId = `assignment-student-${testId}`;
let adminCookie = "";
let limitedCookie = "";
let otherAdminCookie = "";

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

function setCookieContext(cookie = "") {
  requestContext.headers = new Headers(cookie ? { cookie } : {});
}

function createInput(overrides: Record<string, string> = {}) {
  return {
    schoolId: schoolA,
    teacherMembershipId,
    classId: classA,
    subjectId: subjectA,
    ...overrides,
  };
}

async function expectServiceError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({
    name: "AssignmentServiceError",
    code,
  });
}

async function createAssignment(cookie = adminCookie) {
  setCookieContext(cookie);
  return createTeacherClassSubjectAssignment(createInput());
}

async function eventsForSchool() {
  return prisma.teacherClassSubjectAssignmentEvent.findMany({
    where: { schoolId: schoolA },
    orderBy: { createdAt: "asc" },
  });
}

async function waitUntilBlockedOnDatabaseLock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  blockerPid: number,
) {
  const deadline = Date.now() + 2_500;
  while (Date.now() < deadline) {
    const blocked = await tx.$queryRaw<Array<{ pid: number }>>`
      SELECT pid FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
        AND ${blockerPid} = ANY(pg_blocking_pids(pid))
    `;
    if (blocked.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(
    "Assignment request did not wait on the expected database lock",
  );
}

describe("teacher assignment management service", () => {
  beforeAll(async () => {
    const signups = await Promise.all([
      auth.api.signUpEmail({
        body: { name: "Assignment Admin", email: adminEmail, password },
      }),
      auth.api.signUpEmail({
        body: {
          name: "Assignment Limited User",
          email: limitedEmail,
          password,
        },
      }),
      auth.api.signUpEmail({
        body: {
          name: "Assignment Other Admin",
          email: otherAdminEmail,
          password,
        },
      }),
    ]);
    [adminUserId, limitedUserId, otherAdminUserId] = signups.map(
      (result) => result.user.id,
    );
    await prisma.user.create({
      data: {
        id: studentUserId,
        name: "Assignment Student",
        email: `assignment-student-${testId}@example.test`,
      },
    });
    await prisma.user.create({
      data: {
        id: otherTeacherUserId,
        name: "Assignment Other Teacher",
        email: `assignment-other-teacher-${testId}@example.test`,
      },
    });
    for (const id of [adminUserId, limitedUserId, otherAdminUserId]) {
      createdUsers.add(id);
    }
    createdUsers.add(studentUserId);
    createdUsers.add(otherTeacherUserId);

    await prisma.school.createMany({
      data: [
        {
          id: schoolA,
          name: "Assignment Service School A",
          slug: `${schoolA}-slug`,
        },
        {
          id: schoolB,
          name: "Assignment Service School B",
          slug: `${schoolB}-slug`,
        },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { userId: adminUserId, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        {
          id: teacherMembershipId,
          userId: limitedUserId,
          schoolId: schoolA,
          role: "TEACHER",
        },
        { userId: otherAdminUserId, schoolId: schoolB, role: "SCHOOL_ADMIN" },
        {
          id: studentMembershipId,
          userId: studentUserId,
          schoolId: schoolA,
          role: "STUDENT",
        },
        {
          id: otherTeacherMembershipId,
          userId: otherTeacherUserId,
          schoolId: schoolB,
          role: "TEACHER",
        },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: schoolA, name: `Service Class ${testId}` },
        {
          id: inactiveClass,
          schoolId: schoolA,
          name: `Inactive Service Class ${testId}`,
          isActive: false,
        },
        {
          id: otherClass,
          schoolId: schoolB,
          name: `Other Service Class ${testId}`,
        },
      ],
    });
    await prisma.subject.createMany({
      data: [
        { id: subjectA, schoolId: schoolA, name: `Service Subject ${testId}` },
        {
          id: inactiveSubject,
          schoolId: schoolA,
          name: `Inactive Service Subject ${testId}`,
          isActive: false,
        },
        {
          id: otherSubject,
          schoolId: schoolB,
          name: `Other Service Subject ${testId}`,
        },
      ],
    });
    adminCookie = await signIn(adminEmail);
    limitedCookie = await signIn(limitedEmail);
    otherAdminCookie = await signIn(otherAdminEmail);
  }, 30_000);

  beforeEach(async () => {
    setCookieContext();
    await prisma.school.deleteMany({ where: { id: schoolA } });
    await prisma.school.create({
      data: {
        id: schoolA,
        name: "Assignment Service School A",
        slug: `${schoolA}-slug`,
      },
    });
    await prisma.membership.createMany({
      data: [
        { userId: adminUserId, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        {
          id: teacherMembershipId,
          userId: limitedUserId,
          schoolId: schoolA,
          role: "TEACHER",
        },
        {
          id: studentMembershipId,
          userId: studentUserId,
          schoolId: schoolA,
          role: "STUDENT",
        },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classA, schoolId: schoolA, name: `Service Class ${testId}` },
        {
          id: inactiveClass,
          schoolId: schoolA,
          name: `Inactive Service Class ${testId}`,
          isActive: false,
        },
      ],
    });
    await prisma.subject.createMany({
      data: [
        { id: subjectA, schoolId: schoolA, name: `Service Subject ${testId}` },
        {
          id: inactiveSubject,
          schoolId: schoolA,
          name: `Inactive Service Subject ${testId}`,
          isActive: false,
        },
      ],
    });
  });

  afterAll(async () => {
    const cleanupErrors: string[] = [];
    const cleanupSteps = [
      async () =>
        prisma.school.deleteMany({ where: { id: { in: [schoolA, schoolB] } } }),
      async () =>
        prisma.session.deleteMany({
          where: { userId: { in: [...createdUsers] } },
        }),
      async () =>
        prisma.user.deleteMany({ where: { id: { in: [...createdUsers] } } }),
    ];
    for (const cleanup of cleanupSteps) {
      try {
        await cleanup();
      } catch (error) {
        cleanupErrors.push(
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    if (cleanupErrors.length > 0) {
      console.warn(
        `Assignment test cleanup warnings: ${cleanupErrors.join("; ")}`,
      );
    }
    await prisma.$disconnect();
  });

  it("rejects unauthenticated and malformed requests", async () => {
    setCookieContext();
    await expectServiceError(
      createTeacherClassSubjectAssignment(createInput()),
      "UNAUTHENTICATED",
    );
    setCookieContext(adminCookie);
    await expectServiceError(
      createTeacherClassSubjectAssignment(createInput({ classId: " " })),
      "INVALID_INPUT",
    );
    await expectServiceError(
      createTeacherClassSubjectAssignment(
        createInput({ status: "REVOKED", actorUserId: adminUserId }),
      ),
      "INVALID_INPUT",
    );
  });

  it("denies insufficient-role and cross-school callers without revealing records", async () => {
    await expectServiceError(createAssignment(limitedCookie), "FORBIDDEN");
    setCookieContext(otherAdminCookie);
    await expectServiceError(
      createTeacherClassSubjectAssignment(createInput()),
      "FORBIDDEN",
    );
    expect((await eventsForSchool()).length).toBe(0);
  });

  it("denies an administrator with an inactive school membership", async () => {
    await prisma.membership.updateMany({
      where: { userId: adminUserId, schoolId: schoolA },
      data: { isActive: false },
    });
    await expectServiceError(createAssignment(), "FORBIDDEN");
    expect((await eventsForSchool()).length).toBe(0);
  });

  it("does not create an assignment when actor membership is revoked concurrently", async () => {
    setCookieContext(adminCookie);
    let attempt!: Promise<unknown>;
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Membership" WHERE "userId" = ${adminUserId} AND "schoolId" = ${schoolA} FOR UPDATE`;
        const [{ pid }] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        attempt = createTeacherClassSubjectAssignment(createInput());
        void attempt.catch(() => undefined);
        await waitUntilBlockedOnDatabaseLock(tx, pid);
        await tx.membership.update({
          where: {
            schoolId_userId: { schoolId: schoolA, userId: adminUserId },
          },
          data: { isActive: false },
        });
      },
      { timeout: 15_000 },
    );
    await expect(attempt).rejects.toMatchObject({
      name: "AssignmentServiceError",
      code: expect.stringMatching(/FORBIDDEN|CONFLICT/),
    });
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
    expect(await eventsForSchool()).toHaveLength(0);
  }, 20_000);

  it("does not create an assignment when target teacher membership is revoked concurrently", async () => {
    setCookieContext(adminCookie);
    let attempt!: Promise<unknown>;
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Membership" WHERE "userId" = ${adminUserId} AND "schoolId" = ${schoolA} FOR UPDATE`;
        const [{ pid }] = await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`;
        attempt = createTeacherClassSubjectAssignment(createInput());
        void attempt.catch(() => undefined);
        await waitUntilBlockedOnDatabaseLock(tx, pid);
        await tx.membership.update({
          where: { id: teacherMembershipId },
          data: { isActive: false },
        });
      },
      { timeout: 15_000 },
    );
    await expect(attempt).rejects.toMatchObject({
      name: "AssignmentServiceError",
      code: expect.stringMatching(/NOT_FOUND|CONFLICT/),
    });
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
    expect(await eventsForSchool()).toHaveLength(0);
  }, 20_000);

  it("does not create an assignment when class or subject is deactivated concurrently", async () => {
    setCookieContext(adminCookie);
    for (const target of ["class", "subject"] as const) {
      let attempt!: Promise<unknown>;
      await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Membership" WHERE "userId" = ${adminUserId} AND "schoolId" = ${schoolA} FOR UPDATE`;
          const [{ pid }] = await tx.$queryRaw<
            Array<{ pid: number }>
          >`SELECT pg_backend_pid() AS pid`;
          attempt = createTeacherClassSubjectAssignment(createInput());
          void attempt.catch(() => undefined);
          await waitUntilBlockedOnDatabaseLock(tx, pid);
          if (target === "class") {
            await tx.schoolClass.update({
              where: { id: classA },
              data: { isActive: false },
            });
          } else {
            await tx.subject.update({
              where: { id: subjectA },
              data: { isActive: false },
            });
          }
        },
        { timeout: 15_000 },
      );
      await expect(attempt).rejects.toMatchObject({
        name: "AssignmentServiceError",
        code: expect.stringMatching(/NOT_FOUND|CONFLICT/),
      });
      if (target === "class") {
        await prisma.schoolClass.update({
          where: { id: classA },
          data: { isActive: true },
        });
      } else {
        await prisma.subject.update({
          where: { id: subjectA },
          data: { isActive: true },
        });
      }
    }
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
    expect(await eventsForSchool()).toHaveLength(0);
  }, 40_000);

  it("rejects inactive, non-teacher, and cross-school target identifiers", async () => {
    setCookieContext(adminCookie);
    await prisma.membership.update({
      where: { id: teacherMembershipId },
      data: { isActive: false },
    });
    await expectServiceError(
      createTeacherClassSubjectAssignment(createInput()),
      "NOT_FOUND",
    );
    await prisma.membership.update({
      where: { id: teacherMembershipId },
      data: { isActive: true },
    });

    await expectServiceError(
      createTeacherClassSubjectAssignment(
        createInput({ teacherMembershipId: studentMembershipId }),
      ),
      "NOT_FOUND",
    );
    await expectServiceError(
      createTeacherClassSubjectAssignment(
        createInput({ teacherMembershipId: otherTeacherMembershipId }),
      ),
      "NOT_FOUND",
    );
    await expectServiceError(
      createTeacherClassSubjectAssignment(createInput({ classId: otherClass })),
      "NOT_FOUND",
    );
    await expectServiceError(
      createTeacherClassSubjectAssignment(
        createInput({ subjectId: otherSubject }),
      ),
      "NOT_FOUND",
    );
    await expectServiceError(
      createTeacherClassSubjectAssignment(createInput({ classId: "missing" })),
      "NOT_FOUND",
    );
    expect((await eventsForSchool()).length).toBe(0);
  });

  it("rejects inactive classes and subjects", async () => {
    setCookieContext(adminCookie);
    await expectServiceError(
      createTeacherClassSubjectAssignment(
        createInput({ classId: inactiveClass }),
      ),
      "NOT_FOUND",
    );
    await expectServiceError(
      createTeacherClassSubjectAssignment(
        createInput({ subjectId: inactiveSubject }),
      ),
      "NOT_FOUND",
    );
  });

  it("creates one active assignment and a complete actor-level audit event", async () => {
    const assignment = await createAssignment();
    expect(assignment).toMatchObject({
      schoolId: schoolA,
      membershipId: teacherMembershipId,
      classId: classA,
      subjectId: subjectA,
      status: "ACTIVE",
    });
    const events = await eventsForSchool();
    const actorMembership = await prisma.membership.findUniqueOrThrow({
      where: {
        schoolId_userId: { schoolId: schoolA, userId: adminUserId },
      },
      select: { id: true },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      schoolId: schoolA,
      actorUserId: adminUserId,
      actorMembershipId: actorMembership.id,
      teacherMembershipId,
      assignmentId: assignment.id,
      eventType: "CREATED",
      previousStatus: null,
      newStatus: "ACTIVE",
      reason: null,
    });
    expect(events[0].createdAt).toBeInstanceOf(Date);
    expect(events[0].createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("rejects inconsistent audit actor and target associations in PostgreSQL", async () => {
    const assignment = await createAssignment();
    const base = {
      schoolId: schoolA,
      actorUserId: adminUserId,
      actorMembershipId: (
        await prisma.membership.findUniqueOrThrow({
          where: {
            schoolId_userId: { schoolId: schoolA, userId: adminUserId },
          },
          select: { id: true },
        })
      ).id,
      teacherMembershipId,
      assignmentId: assignment.id,
      eventType: "DEACTIVATED" as const,
      previousStatus: "ACTIVE" as const,
      newStatus: "INACTIVE" as const,
    };

    await expect(
      prisma.teacherClassSubjectAssignmentEvent.create({
        data: { ...base, actorMembershipId: "missing-actor-membership" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.teacherClassSubjectAssignmentEvent.create({
        data: { ...base, actorUserId: limitedUserId },
      }),
    ).rejects.toThrow();
    const otherSchoolActorMembership =
      await prisma.membership.findUniqueOrThrow({
        where: {
          schoolId_userId: { schoolId: schoolB, userId: otherAdminUserId },
        },
        select: { id: true },
      });
    await expect(
      prisma.teacherClassSubjectAssignmentEvent.create({
        data: {
          ...base,
          actorUserId: otherAdminUserId,
          actorMembershipId: otherSchoolActorMembership.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.teacherClassSubjectAssignmentEvent.create({
        data: { ...base, teacherMembershipId: studentMembershipId },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.teacherClassSubjectAssignmentEvent.create({
        data: { ...base, schoolId: schoolB },
      }),
    ).rejects.toThrow();
    expect(await eventsForSchool()).toHaveLength(1);
  });

  it("retains the actor ID snapshot after user and membership deletion", async () => {
    const assignment = await createAssignment();
    const historicalActorId = `historical-actor-${testId}`;
    const historicalMembershipId = `historical-membership-${testId}`;
    await prisma.user.create({
      data: {
        id: historicalActorId,
        name: "Historical Audit Actor",
        email: `${historicalActorId}@example.test`,
      },
    });
    try {
      await prisma.membership.create({
        data: {
          id: historicalMembershipId,
          userId: historicalActorId,
          schoolId: schoolA,
          role: "SCHOOL_ADMIN",
        },
      });
      const event = await prisma.teacherClassSubjectAssignmentEvent.create({
        data: {
          schoolId: schoolA,
          actorUserId: historicalActorId,
          actorMembershipId: historicalMembershipId,
          teacherMembershipId,
          assignmentId: assignment.id,
          eventType: "CREATED",
          previousStatus: null,
          newStatus: "ACTIVE",
        },
      });
      await prisma.user.delete({ where: { id: historicalActorId } });
      await expect(
        prisma.teacherClassSubjectAssignmentEvent.findUnique({
          where: { id: event.id },
        }),
      ).resolves.toMatchObject({
        actorUserId: historicalActorId,
        actorMembershipId: historicalMembershipId,
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: historicalActorId } });
    }
  });

  it("rejects duplicate creation without a second assignment or event", async () => {
    await createAssignment();
    setCookieContext(adminCookie);
    await expectServiceError(
      createTeacherClassSubjectAssignment(createInput()),
      "CONFLICT",
    );
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: {
          schoolId: schoolA,
          membershipId: teacherMembershipId,
          classId: classA,
          subjectId: subjectA,
        },
      }),
    ).toBe(1);
    expect(await eventsForSchool()).toHaveLength(1);
  });

  it("serializes concurrent creates to one assignment and one audit event", async () => {
    const attempts = await Promise.allSettled(
      [1, 2].map(async () => {
        setCookieContext(adminCookie);
        return createTeacherClassSubjectAssignment(createInput());
      }),
    );
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await prisma.teacherClassSubjectAssignment.count({
        where: {
          schoolId: schoolA,
          membershipId: teacherMembershipId,
          classId: classA,
          subjectId: subjectA,
        },
      }),
    ).toBe(1);
    expect(await eventsForSchool()).toHaveLength(1);
  });

  it("does not reveal or mutate an assignment through another school's ID", async () => {
    const assignment = await createAssignment();
    setCookieContext(otherAdminCookie);
    await expectServiceError(
      deactivateTeacherClassSubjectAssignment({
        schoolId: schoolB,
        assignmentId: assignment.id,
        reason: "Cross-school request",
      }),
      "NOT_FOUND",
    );
    expect(
      await prisma.teacherClassSubjectAssignment.findUnique({
        where: { id: assignment.id },
      }),
    ).toMatchObject({ status: "ACTIVE" });
  });

  it("audits deactivation, revocation, reactivation, and redundant transitions", async () => {
    const assignment = await createAssignment();
    setCookieContext(adminCookie);
    await expectServiceError(
      deactivateTeacherClassSubjectAssignment({
        schoolId: schoolA,
        assignmentId: assignment.id,
      }),
      "INVALID_INPUT",
    );
    await deactivateTeacherClassSubjectAssignment({
      schoolId: schoolA,
      assignmentId: assignment.id,
      reason: "Teacher reassigned",
    });
    await expectServiceError(
      deactivateTeacherClassSubjectAssignment({
        schoolId: schoolA,
        assignmentId: assignment.id,
        reason: "Repeated request",
      }),
      "INVALID_STATE",
    );
    await revokeTeacherClassSubjectAssignment({
      schoolId: schoolA,
      assignmentId: assignment.id,
      reason: "Assignment withdrawn",
    });
    await reactivateTeacherClassSubjectAssignment({
      schoolId: schoolA,
      assignmentId: assignment.id,
      reason: "Approved again",
    });

    const rows = await prisma.teacherClassSubjectAssignment.findMany({
      where: { schoolId: schoolA },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: assignment.id, status: "ACTIVE" });
    expect(
      (await eventsForSchool()).map((event) => [
        event.eventType,
        event.previousStatus,
        event.newStatus,
        event.reason,
      ]),
    ).toEqual([
      ["CREATED", null, "ACTIVE", null],
      ["DEACTIVATED", "ACTIVE", "INACTIVE", "Teacher reassigned"],
      ["REVOKED", "INACTIVE", "REVOKED", "Assignment withdrawn"],
      ["REACTIVATED", "REVOKED", "ACTIVE", "Approved again"],
    ]);
  });

  it("rejects reactivation when the teacher, class, or subject is inactive", async () => {
    const assignment = await createAssignment();
    setCookieContext(adminCookie);
    await deactivateTeacherClassSubjectAssignment({
      schoolId: schoolA,
      assignmentId: assignment.id,
      reason: "Temporary pause",
    });

    await prisma.membership.update({
      where: { id: teacherMembershipId },
      data: { isActive: false },
    });
    await expectServiceError(
      reactivateTeacherClassSubjectAssignment({
        schoolId: schoolA,
        assignmentId: assignment.id,
      }),
      "NOT_FOUND",
    );
    await prisma.membership.update({
      where: { id: teacherMembershipId },
      data: { isActive: true },
    });

    await prisma.schoolClass.update({
      where: { id: classA },
      data: { isActive: false },
    });
    await expectServiceError(
      reactivateTeacherClassSubjectAssignment({
        schoolId: schoolA,
        assignmentId: assignment.id,
      }),
      "NOT_FOUND",
    );
    await prisma.schoolClass.update({
      where: { id: classA },
      data: { isActive: true },
    });

    await prisma.subject.update({
      where: { id: subjectA },
      data: { isActive: false },
    });
    await expectServiceError(
      reactivateTeacherClassSubjectAssignment({
        schoolId: schoolA,
        assignmentId: assignment.id,
      }),
      "NOT_FOUND",
    );
  });

  it("rolls back assignment status when audit persistence fails", async () => {
    const assignment = await createAssignment();
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "fail_assignment_audit_test"() RETURNS trigger AS $$
      BEGIN
        IF NEW.reason = 'force audit failure' THEN
          RAISE EXCEPTION 'synthetic audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "fail_assignment_audit_test_trigger"
      BEFORE INSERT ON "TeacherClassSubjectAssignmentEvent"
      FOR EACH ROW EXECUTE FUNCTION "fail_assignment_audit_test"()
    `);

    try {
      setCookieContext(adminCookie);
      await expect(
        deactivateTeacherClassSubjectAssignment({
          schoolId: schoolA,
          assignmentId: assignment.id,
          reason: "force audit failure",
        }),
      ).rejects.toThrow();
      const unchanged = await prisma.teacherClassSubjectAssignment.findUnique({
        where: { id: assignment.id },
      });
      expect(unchanged?.status).toBe("ACTIVE");
      expect(await eventsForSchool()).toHaveLength(1);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "fail_assignment_audit_test_trigger" ON "TeacherClassSubjectAssignmentEvent"',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS "fail_assignment_audit_test"()',
      );
    }
  });

  it("serializes competing transitions and creates one lifecycle event", async () => {
    const assignment = await createAssignment();
    const attempts = await Promise.allSettled(
      [1, 2].map(async () => {
        setCookieContext(adminCookie);
        return deactivateTeacherClassSubjectAssignment({
          schoolId: schoolA,
          assignmentId: assignment.id,
          reason: "Concurrent change",
        });
      }),
    );
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    expect(await eventsForSchool()).toHaveLength(2);
  });

  it("does not permit direct audit event updates or deletes", async () => {
    await createAssignment();
    const [event] = await eventsForSchool();
    await expect(
      prisma.teacherClassSubjectAssignmentEvent.updateMany({
        where: { id: event.id },
        data: { reason: "tampered" },
      }),
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.teacherClassSubjectAssignmentEvent.deleteMany({
        where: { id: event.id },
      }),
    ).rejects.toThrow(/append-only/);
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'TRUNCATE TABLE "TeacherClassSubjectAssignmentEvent"',
        );
        throw new Error("TRUNCATE guard did not run");
      }),
    ).rejects.toThrow(/append-only/);
    expect(await eventsForSchool()).toHaveLength(1);
  });

  it("removes assignment history only as part of school cascade deletion", async () => {
    await createAssignment();
    expect(await eventsForSchool()).toHaveLength(1);
    await prisma.school.delete({ where: { id: schoolA } });
    expect(
      await prisma.teacherClassSubjectAssignmentEvent.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
  });

  it("enforces case-insensitive trimmed active names per school", async () => {
    const duplicateClass = await prisma.schoolClass.create({
      data: {
        schoolId: schoolA,
        name: `  name check ${testId.toUpperCase()}  `,
      },
    });
    await expect(
      prisma.schoolClass.create({
        data: { schoolId: schoolA, name: `NAME CHECK ${testId}` },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const otherSchoolClass = await prisma.schoolClass.create({
      data: { schoolId: schoolB, name: `NAME CHECK ${testId}` },
    });
    const inactiveDuplicate = await prisma.schoolClass.create({
      data: {
        schoolId: schoolA,
        name: `NAME CHECK ${testId}`,
        isActive: false,
      },
    });
    expect(duplicateClass.schoolId).toBe(schoolA);
    expect(otherSchoolClass.schoolId).toBe(schoolB);
    expect(inactiveDuplicate.isActive).toBe(false);

    await expect(
      prisma.schoolClass.update({
        where: { id: inactiveDuplicate.id },
        data: { isActive: true },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces normalized active subject names per school", async () => {
    await prisma.subject.create({
      data: { schoolId: schoolA, name: `  subject ${testId.toUpperCase()}  ` },
    });
    await expect(
      prisma.subject.create({
        data: { schoolId: schoolA, name: `SUBJECT ${testId}` },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.subject.create({
        data: { schoolId: schoolB, name: `SUBJECT ${testId}` },
      }),
    ).resolves.toMatchObject({ schoolId: schoolB });

    const inactiveSubjectRecord = await prisma.subject.create({
      data: {
        schoolId: schoolA,
        name: `SUBJECT ${testId}`,
        isActive: false,
      },
    });
    await expect(
      prisma.subject.update({
        where: { id: inactiveSubjectRecord.id },
        data: { isActive: true },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
