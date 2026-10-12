import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));

import { GET, POST } from "@/app/api/schools/[schoolId]/assessment-questions/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const suffix = randomUUID();
const schoolA = `asm-school-a-${suffix}`;
const schoolB = `asm-school-b-${suffix}`;
const sectionId = `asm-section-${suffix}`;
const classId = `asm-class-${suffix}`;
const subjectId = `asm-subject-${suffix}`;
const sessionId = `asm-session-${suffix}`;
const termId = `asm-term-${suffix}`;
const assignmentId = `asm-assignment-${suffix}`;
const members: Record<string, string> = {};
const users: Record<string, string> = {};
const cookies: Record<string, string> = {};
const password = "synthetic-asm-question-password";

function req(actor: string, schoolId: string, method: "POST" | "GET", body?: unknown) {
  context.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
  return new Request(`http://localhost/api/schools/${schoolId}/assessment-questions`, {
    method,
    ...(body === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}
const payload = () => ({
  termId, assignmentId,
  prompt: "Which fraction is equal to one half?",
  options: ["1/2", "1/4", "2/5", "3/5"],
  correctIndex: 0,
});
async function create(actor: string, body: unknown, schoolId = schoolA) {
  return POST(req(actor, schoolId, "POST", body),
    { params: Promise.resolve({ schoolId }) });
}
async function list(actor: string, schoolId = schoolA) {
  return GET(req(actor, schoolId, "GET"), { params: Promise.resolve({ schoolId }) });
}

describe("Phase 7 exact-assignment private question bank", () => {
  beforeAll(async () => {
    for (const name of ["teacher", "other", "admin", "foreign"]) {
      const email = `asm-${name}-${suffix}@example.test`;
      const registered = await auth.api.signUpEmail({
        body: { name: `Synthetic ${name}`, email, password },
      });
      users[name] = registered.user.id;
      const login = await auth.api.signInEmail({
        body: { email, password },
        headers: new Headers({ origin: env.BETTER_AUTH_URL }),
        returnHeaders: true,
      });
      cookies[name] = login.headers.getSetCookie().map(v => v.split(";")[0]).join("; ");
      if (!cookies[name]) throw new Error("Test-only session unavailable");
    }
    await prisma.school.createMany({ data: [
      { id: schoolA, slug: schoolA, name: "Synthetic Assessment A" },
      { id: schoolB, slug: schoolB, name: "Synthetic Assessment B" },
    ] });
    for (const [name, role, schoolId] of [
      ["teacher", "TEACHER", schoolA],
      ["other", "TEACHER", schoolA],
      ["admin", "SCHOOL_ADMIN", schoolA],
      ["foreign", "TEACHER", schoolB],
    ] as const) {
      const member = await prisma.membership.create({
        data: { userId: users[name], schoolId, role },
      });
      members[name] = member.id;
    }
    await prisma.schoolSection.create({
      data: { id: sectionId, schoolId: schoolA, name: "Primary", stage: "PRIMARY" },
    });
    await prisma.schoolClass.create({
      data: { id: classId, schoolId: schoolA, sectionId, name: "Basic Six" },
    });
    await prisma.subject.create({
      data: { id: subjectId, schoolId: schoolA, name: "Mathematics" },
    });
    const now = Date.now();
    await prisma.academicSession.create({
      data: { id: sessionId, schoolId: schoolA, name: "Synthetic Active Session",
        startsOn: new Date(now - 86400000), endsOn: new Date(now + 86400000 * 60),
        status: "ACTIVE" },
    });
    await prisma.academicTerm.create({
      data: { id: termId, schoolId: schoolA, sessionId,
        name: "Synthetic First Term", position: 1,
        startsOn: new Date(now - 86400000), endsOn: new Date(now + 86400000 * 45),
        status: "ACTIVE" },
    });
    await prisma.teacherClassSubjectAssignment.create({
      data: { id: assignmentId, schoolId: schoolA, membershipId: members.teacher,
        classId, subjectId, sessionId, status: "ACTIVE" },
    });
  });
  afterAll(async () => {
    await prisma.school.deleteMany({ where: { id: { in: [schoolA, schoolB] } } });
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(users) } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
    await prisma.$disconnect();
  });

  it("denies anonymous, admin, unassigned teacher and foreign teacher even for empty lists", async () => {
    for (const [actor, status] of [["", 401], ["other", 404],
      ["admin", 404], ["foreign", 404]] as const) {
      expect((await list(actor)).status).toBe(status);
      expect((await create(actor, payload())).status).toBe(status);
    }
    expect((await create("teacher", payload(), schoolB)).status).toBe(404);
  });
  it("rejects malformed keys, duplicate options and client-supplied actor IDs", async () => {
    for (const input of [
      { ...payload(), options: ["same", "Same"] },
      { ...payload(), correctIndex: 5 },
      { ...payload(), correctIndex: -1 },
      { ...payload(), teacherMembershipId: members.teacher },
      { ...payload(), assignmentId: "not-assigned" },
    ]) {
      const result = await create("teacher", input);
      expect(result.status).toBe(input.assignmentId === "not-assigned" ? 404 : 400);
    }
  });
  it("creates a question and secret key atomically but never returns the answer index", async () => {
    const result = await create("teacher", payload());
    expect(result.status).toBe(201);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const visible = (await result.json()).question;
    expect(visible.prompt).toBe(payload().prompt);
    expect(JSON.stringify(visible)).not.toContain("correctIndex");
    const key = await prisma.assessmentQuestionKey.findUniqueOrThrow({
      where: { questionId: visible.id },
    });
    expect(key.correctIndex).toBe(0);
    const own = await list("teacher");
    expect(own.status).toBe(200);
    const listed = await own.json();
    expect(listed.questions).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain("correctIndex");
    expect(JSON.stringify(listed)).not.toContain("answerKey");
    expect((await list("other")).status).toBe(404);
    await expect(prisma.assessmentQuestionKey.update({
      where: { questionId: visible.id }, data: { correctIndex: 2 },
    })).rejects.toThrow();
    await expect(prisma.assessmentQuestion.update({
      where: { id: visible.id }, data: { prompt: "Altered exam question!" },
    })).rejects.toThrow();
    await expect(prisma.assessmentQuestionKey.delete({
      where: { questionId: visible.id },
    })).rejects.toThrow();
  });
  it("rejects forged raw SQL / ORM question creator even with structurally valid tuple", async () => {
    await expect(prisma.assessmentQuestion.create({
      data: {
        schoolId: schoolA, sessionId, termId, classId, subjectId,
        assignmentId, teacherMembershipId: members.teacher, teacherUserId: users.admin,
        prompt: "Forged question inserted without teacher identity",
        options: ["Option A", "Option B"],
      },
    })).rejects.toThrow();
  });
  it("revokes teacher question access when the exact assignment becomes inactive", async () => {
    await prisma.teacherClassSubjectAssignment.update({
      where: { id: assignmentId }, data: { status: "REVOKED" },
    });
    try {
      expect((await list("teacher")).status).toBe(404);
      expect((await create("teacher", payload())).status).toBe(404);
    } finally {
      await prisma.teacherClassSubjectAssignment.update({
        where: { id: assignmentId }, data: { status: "ACTIVE" },
      });
    }
  });
});
