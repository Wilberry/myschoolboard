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

import * as listRoute from "@/app/api/schools/[schoolId]/teacher-assignments/route";
import * as detailRoute from "@/app/api/schools/[schoolId]/teacher-assignments/[assignmentId]/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const tag = randomUUID();
const password = "synthetic-assignment-read-password-42";
const schoolA = `read-school-a-${tag}`;
const schoolB = `read-school-b-${tag}`;
const classA = `read-class-a-${tag}`;
const classB = `read-class-b-${tag}`;
const subjectA = `read-subject-a-${tag}`;
const subjectB = `read-subject-b-${tag}`;
const assignmentA = `read-assignment-a-${tag}`;
const assignmentB = `read-assignment-b-${tag}`;
const teacherMemberA = `read-member-a-${tag}`;
const teacherMemberB = `read-member-b-${tag}`;
const adminMemberA = `read-admin-a-${tag}`;

const emails = {
  admin: `read-admin-${tag}@example.test`,
  superAdmin: `read-super-admin-${tag}@example.test`,
  principal: `read-principal-${tag}@example.test`,
  teacher: `read-teacher-${tag}@example.test`,
  otherAdmin: `read-other-admin-${tag}@example.test`,
  otherTeacher: `read-other-teacher-${tag}@example.test`,
  platform: `read-platform-${tag}@example.test`,
} as const;

const users: Partial<Record<keyof typeof emails, string>> = {};
const cookies: Partial<Record<keyof typeof emails, string>> = {};

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
  if (!cookie) throw new Error("Missing synthetic session cookie");
  return cookie;
}

function requestCookie(cookie: string) {
  requestContext.headers = new Headers(cookie ? { cookie } : {});
}

async function list(
  schoolId = schoolA,
  cookie = cookies.admin ?? "",
  search = "",
): Promise<Response> {
  requestCookie(cookie);
  return listRoute.GET(
    new Request(
      `http://localhost/api/schools/${schoolId}/teacher-assignments${search}`,
    ),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function detail(
  assignmentId: string,
  schoolId = schoolA,
  cookie = cookies.admin ?? "",
  search = "",
): Promise<Response> {
  requestCookie(cookie);
  return detailRoute.GET(
    new Request(
      `http://localhost/api/schools/${schoolId}/teacher-assignments/${assignmentId}${search}`,
    ),
    { params: Promise.resolve({ schoolId, assignmentId }) },
  );
}

describe("school-scoped teacher assignment administration reads", () => {
  beforeAll(async () => {
    for (const [key, email] of Object.entries(emails)) {
      const result = await auth.api.signUpEmail({
        body: { name: `Synthetic ${key}`, email, password },
      });
      users[key as keyof typeof emails] = result.user.id;
    }
    await prisma.user.update({
      where: { id: users.platform! },
      data: { platformRole: "SUPER_ADMIN" },
    });

    await prisma.school.create({
      data: { id: schoolB, name: "Read School B", slug: `${schoolB}-slug` },
    });
    await prisma.membership.createMany({
      data: [
        {
          id: `read-other-admin-${tag}`,
          schoolId: schoolB,
          userId: users.otherAdmin!,
          role: "SCHOOL_ADMIN",
        },
        {
          id: teacherMemberB,
          schoolId: schoolB,
          userId: users.otherTeacher!,
          role: "TEACHER",
        },
      ],
    });
    await prisma.schoolClass.create({
      data: { id: classB, schoolId: schoolB, name: "Read Class B" },
    });
    await prisma.subject.create({
      data: { id: subjectB, schoolId: schoolB, name: "Read Subject B" },
    });
    await prisma.teacherClassSubjectAssignment.create({
      data: {
        id: assignmentB,
        schoolId: schoolB,
        membershipId: teacherMemberB,
        classId: classB,
        subjectId: subjectB,
      },
    });

    for (const [key, email] of Object.entries(emails)) {
      cookies[key as keyof typeof emails] = await signIn(email);
    }
  }, 30_000);

  beforeEach(async () => {
    requestCookie("");
    await prisma.school.deleteMany({ where: { id: schoolA } });
    await prisma.school.create({
      data: { id: schoolA, name: "Read School A", slug: `${schoolA}-slug` },
    });
    await prisma.membership.createMany({
      data: [
        {
          id: adminMemberA,
          userId: users.admin!,
          schoolId: schoolA,
          role: "SCHOOL_ADMIN",
        },
        {
          userId: users.superAdmin!,
          schoolId: schoolA,
          role: "SCHOOL_SUPER_ADMIN",
        },
        { userId: users.principal!, schoolId: schoolA, role: "PRINCIPAL" },
        {
          id: teacherMemberA,
          userId: users.teacher!,
          schoolId: schoolA,
          role: "TEACHER",
        },
      ],
    });
    await prisma.schoolClass.create({
      data: { id: classA, schoolId: schoolA, name: "Read Class A" },
    });
    await prisma.subject.create({
      data: { id: subjectA, schoolId: schoolA, name: "Read Subject A" },
    });
    await prisma.teacherClassSubjectAssignment.create({
      data: {
        id: assignmentA,
        schoolId: schoolA,
        membershipId: teacherMemberA,
        classId: classA,
        subjectId: subjectA,
        status: "ACTIVE",
      },
    });
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    requestCookie("");
  });

  afterAll(async () => {
    await prisma.school.deleteMany({
      where: { id: { in: [schoolA, schoolB] } },
    });
    const ids = Object.values(users).filter((id): id is string => !!id);
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("returns only allowed fields on authorized list and detail reads", async () => {
    for (const cookie of [cookies.admin!, cookies.superAdmin!]) {
      const collection = await list(schoolA, cookie);
      expect(collection.status).toBe(200);
      expect(collection.headers.get("cache-control")).toBe("private, no-store");
      const body = await collection.json();
      expect(body.nextCursor).toBeNull();
      expect(body.assignments).toHaveLength(1);
      const record = body.assignments[0];
      expect(Object.keys(record).sort()).toEqual([
        "classId",
        "createdAt",
        "id",
        "membershipId",
        "schoolId",
        "status",
        "subjectId",
      ]);
      expect(record).toMatchObject({
        id: assignmentA,
        schoolId: schoolA,
        membershipId: teacherMemberA,
        status: "ACTIVE",
      });

      const resource = await detail(assignmentA, schoolA, cookie);
      expect(resource.status).toBe(200);
      expect(resource.headers.get("cache-control")).toBe("private, no-store");
      expect((await resource.json()).assignment).toEqual(record);
    }
    expect(
      await prisma.teacherClassSubjectAssignmentEvent.count({
        where: { schoolId: schoolA },
      }),
    ).toBe(0);
  });

  it("denies unauthenticated requests without disclosing assignments", async () => {
    for (const response of [
      await list(schoolA, ""),
      await detail(assignmentA, schoolA, ""),
    ]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
  });

  it("denies academic-only, unrelated-school, and platform-only roles", async () => {
    for (const cookie of [
      cookies.principal!,
      cookies.teacher!,
      cookies.otherAdmin!,
      cookies.platform!,
    ]) {
      for (const response of [
        await list(schoolA, cookie),
        await detail(assignmentA, schoolA, cookie),
      ]) {
        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(await response.json()).toEqual({ error: "Not found" });
      }
    }
  });

  it("conceals foreign and nonexistent assignment identifiers equally", async () => {
    for (const assignmentId of [assignmentB, `missing-${tag}`]) {
      const response = await detail(assignmentId);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
    const foreignCursor = await list(
      schoolA,
      cookies.admin!,
      `?cursor=${assignmentB}`,
    );
    const missingCursor = await list(
      schoolA,
      cookies.admin!,
      `?cursor=missing-${tag}`,
    );
    for (const response of [foreignCursor, missingCursor]) {
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Not found" });
    }
    const ownSchool = await list(schoolB, cookies.otherAdmin!);
    expect(ownSchool.status).toBe(200);
    expect((await ownSchool.json()).assignments[0].id).toBe(assignmentB);
  });

  it("revokes read access after membership demotion or deactivation", async () => {
    await prisma.membership.update({
      where: { id: adminMemberA },
      data: { role: "PRINCIPAL" },
    });
    expect((await list()).status).toBe(404);
    expect((await detail(assignmentA)).status).toBe(404);
    await prisma.membership.update({
      where: { id: adminMemberA },
      data: { role: "SCHOOL_ADMIN", isActive: false },
    });
    expect((await list()).status).toBe(404);
    expect((await detail(assignmentA)).status).toBe(404);
  });

  it("denies reads when the school is inactive", async () => {
    await prisma.school.update({
      where: { id: schoolA },
      data: { isActive: false },
    });
    expect((await list()).status).toBe(404);
    expect((await detail(assignmentA)).status).toBe(404);
  });

  it("rejects the same cookie after session revocation", async () => {
    const cookie = await signIn(emails.admin);
    const prior = await list(schoolA, cookie);
    expect(prior.status).toBe(200);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    if (!session) throw new Error("Expected test session");
    await prisma.session.delete({ where: { id: session.session.id } });
    for (const response of [
      await list(schoolA, cookie),
      await detail(assignmentA, schoolA, cookie),
    ]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
  });

  it("rejects malformed paths, filters, and ambiguous cursors", async () => {
    for (const response of [
      await list(" "),
      await detail(" "),
      await list(schoolA, cookies.admin!, "?status=ACTIVE"),
      await list(schoolA, cookies.admin!, "?cursor="),
      await list(schoolA, cookies.admin!, "?cursor=first&cursor=second"),
      await detail(assignmentA, schoolA, cookies.admin!, "?cursor=anything"),
    ]) {
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({ error: "Invalid request" });
    }
  });

  it("rechecks reader membership in the final database lookup", async () => {
    const many = vi.spyOn(prisma.teacherClassSubjectAssignment, "findMany");
    const one = vi.spyOn(prisma.teacherClassSubjectAssignment, "findFirst");
    try {
      expect((await list()).status).toBe(200);
      expect((await detail(assignmentA)).status).toBe(200);
      const membershipPredicate = {
        schoolId: schoolA,
        school: {
          isActive: true,
          memberships: {
            some: {
              userId: users.admin,
              isActive: true,
              role: "SCHOOL_ADMIN",
            },
          },
        },
      };
      expect(many).toHaveBeenCalledWith(
        expect.objectContaining({ where: membershipPredicate }),
      );
      expect(one).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ...membershipPredicate, id: assignmentA },
        }),
      );
    } finally {
      many.mockRestore();
      one.mockRestore();
    }
  });

  it("limits list pages to 50 and uses tenant-validated cursors", async () => {
    const classes = Array.from({ length: 54 }, (_, i) => ({
      id: `read-extra-class-${i}-${tag}`,
      schoolId: schoolA,
      name: `Read Extra Class ${i}`,
    }));
    await prisma.schoolClass.createMany({ data: classes });
    await prisma.teacherClassSubjectAssignment.createMany({
      data: classes.map((schoolClass, i) => ({
        id: `read-extra-assignment-${i}-${tag}`,
        schoolId: schoolA,
        membershipId: teacherMemberA,
        classId: schoolClass.id,
        subjectId: subjectA,
      })),
    });

    const first = await list();
    expect(first.status).toBe(200);
    const page1 = await first.json();
    expect(page1.assignments).toHaveLength(50);
    expect(page1.nextCursor).toBeTruthy();
    const second = await list(
      schoolA,
      cookies.admin!,
      `?cursor=${page1.nextCursor}`,
    );
    expect(second.status).toBe(200);
    const page2 = await second.json();
    expect(page2.assignments).toHaveLength(5);
    expect(page2.nextCursor).toBeNull();
    const ids = [...page1.assignments, ...page2.assignments].map(
      (assignment: { id: string }) => assignment.id,
    );
    expect(new Set(ids).size).toBe(55);
    expect(ids).toEqual([...ids].sort());
  });

  it("returns a generic non-cacheable 500 when persistence fails", async () => {
    const mocked = vi
      .spyOn(prisma.teacherClassSubjectAssignment, "findMany")
      .mockRejectedValueOnce(new Error("synthetic sensitive database failure"));
    const logger = vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("synthetic logger failure");
    });
    try {
      const response = await list();
      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        error: "Request could not be completed",
      });
    } finally {
      mocked.mockRestore();
      logger.mockRestore();
    }
  });
});
