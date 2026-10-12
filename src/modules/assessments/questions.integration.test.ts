import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));

import { GET, POST } from "@/app/api/schools/[schoolId]/assessment-questions/route";
import { GET as REVIEW_QUEUE } from "@/app/api/schools/[schoolId]/assessment-reviews/route";
import { POST as REVIEW_DECISION } from "@/app/api/schools/[schoolId]/assessment-reviews/[draftId]/decision/route";
import {
  GET as GET_DRAFTS, POST as POST_DRAFTS,
} from "@/app/api/schools/[schoolId]/assessment-drafts/route";
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
const secondarySectionId = `asm-section-secondary-${suffix}`;
const secondaryClassId = `asm-class-secondary-${suffix}`;
const secondaryAssignmentId = `asm-assignment-secondary-${suffix}`;
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
    for (const name of ["teacher", "other", "admin", "foreign", "head", "principal"]) {
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
      ["head", "HEAD_OF_SECTION", schoolA],
      ["principal", "PRINCIPAL", schoolA],
    ] as const) {
      const member = await prisma.membership.create({
        data: { userId: users[name], schoolId, role },
      });
      members[name] = member.id;
    }
    await prisma.scopeGrant.create({
      data: { membershipId: members.head, type: "SECTION",
        scopeId: sectionId, verified: true },
    });
    await prisma.schoolSection.create({
      data: { id: sectionId, schoolId: schoolA, name: "Primary", stage: "PRIMARY" },
    });
    await prisma.schoolClass.create({
      data: { id: classId, schoolId: schoolA, sectionId, name: "Basic Six" },
    });
    await prisma.schoolSection.create({
      data: { id: secondarySectionId, schoolId: schoolA,
        name: "Secondary", stage: "SECONDARY" },
    });
    await prisma.schoolClass.create({
      data: { id: secondaryClassId, schoolId: schoolA,
        sectionId: secondarySectionId, name: "Junior Secondary One" },
    });
    await prisma.scopeGrant.create({
      data: { membershipId: members.principal, type: "SECTION",
        scopeId: secondarySectionId, verified: true },
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
    await prisma.teacherClassSubjectAssignment.create({
      data: { id: secondaryAssignmentId, schoolId: schoolA, membershipId: members.teacher,
        classId: secondaryClassId, subjectId, sessionId, status: "ACTIVE" },
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
  it("creates an immutable term-bound assessment draft and never exposes keys", async () => {
    const question = await prisma.assessmentQuestion.findFirstOrThrow({
      where: { schoolId: schoolA, teacherMembershipId: members.teacher },
    });
    const startsAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const endsAt = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    const draftInput = {
      assignmentId, termId, kind: "TEST" as const, title: "Synthetic Mathematics Test",
      startsAt, endsAt, durationMinutes: 30, maxAttempts: 2,
      passPercent: 50, questions: [{ questionId: question.id, points: 5 }],
    };
    function draft(actor: string, body: unknown, schoolId = schoolA) {
      return POST_DRAFTS(req(actor, schoolId, "POST", body),
        { params: Promise.resolve({ schoolId }) });
    }
    function drafts(actor: string, schoolId = schoolA) {
      return GET_DRAFTS(req(actor, schoolId, "GET"),
        { params: Promise.resolve({ schoolId }) });
    }
    for (const [actor, status] of [
      ["", 401], ["other", 404], ["admin", 404], ["foreign", 404],
    ] as const) {
      expect((await draft(actor, draftInput)).status).toBe(status);
      expect((await drafts(actor)).status).toBe(status);
    }
    for (const malformed of [
      { ...draftInput, durationMinutes: 0 },
      { ...draftInput, maxAttempts: 4 },
      { ...draftInput, passPercent: 101 },
      { ...draftInput, questions: [] },
      { ...draftInput, questions: [draftInput.questions[0], draftInput.questions[0]] },
      { ...draftInput, teacherUserId: users.teacher },
      { ...draftInput, endsAt: new Date(Date.now() - 86400000).toISOString() },
    ]) {
      expect((await draft("teacher", malformed)).status).toBe(400);
    }
    expect((await draft("teacher", { ...draftInput,
      questions: [{ questionId: "foreign-question", points: 5 }],
    })).status).toBe(404);
    expect((await draft("teacher", draftInput, schoolB)).status).toBe(404);
    const result = await draft("teacher", draftInput);
    expect(result.status).toBe(201);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const created = (await result.json()).draft;
    expect(created).toMatchObject({ kind: "TEST", maxAttempts: 2,
      durationMinutes: 30, questionCount: 1, maxScore: 5, passPercent: 50 });
    expect(JSON.stringify(created)).not.toContain("correctIndex");
    const list = await drafts("teacher");
    expect(list.status).toBe(200);
    const payload = await list.json();
    expect(payload.drafts.map((d: { id: string }) => d.id)).toContain(created.id);
    expect(JSON.stringify(payload)).not.toContain("correctIndex");
    expect(await prisma.assessmentDraftSeal.findUnique({
      where: { draftId: created.id },
    })).not.toBeNull();
    const selected = await prisma.assessmentDraftQuestion.findFirstOrThrow({
      where: { schoolId: schoolA, draftId: created.id },
    });
    expect(selected).toMatchObject({
      questionId: question.id, position: 1, points: 5,
    });
    await expect(prisma.assessmentDraft.update({
      where: { id: created.id }, data: { maxAttempts: 3 },
    })).rejects.toThrow();
    await expect(prisma.assessmentDraftQuestion.update({
      where: { id: selected.id }, data: { points: 10 },
    })).rejects.toThrow();
    await expect(prisma.assessmentDraftQuestion.create({
      data: {
        schoolId: schoolA, draftId: created.id, questionId: question.id,
        position: 2, points: 5,
      },
    })).rejects.toThrow();
    await expect(prisma.assessmentDraftSeal.delete({
      where: { draftId: created.id },
    })).rejects.toThrow();

    await expect(prisma.assessmentDraftQuestion.delete({
      where: { id: selected.id },
    })).rejects.toThrow();
    await expect(prisma.assessmentDraft.create({
      data: {
        schoolId: schoolA, sessionId, termId, classId, subjectId,
        assignmentId, teacherMembershipId: members.teacher,
        teacherUserId: users.admin, kind: "QUIZ",
        title: "Forged teacher authorship draft",
        startsAt: new Date(startsAt), endsAt: new Date(endsAt),
        durationMinutes: 30, maxAttempts: 1, passPercent: 50,
      },
    })).rejects.toThrow();
  });

  it("permits exact PRIMARY HM moderation but not teacher, admin or wrong-stage Principal", async () => {
    async function queue(actor: string, schoolId = schoolA) {
      return REVIEW_QUEUE(req(actor, schoolId, "GET"),
        { params: Promise.resolve({ schoolId }) });
    }
    async function decide(actor: string, draftId: string,
      decision: "APPROVED" | "RETURNED", schoolId = schoolA) {
      const r = req(actor, schoolId, "POST", {
        decision, reason: "Synthetic exact-section academic moderation",
      });
      return REVIEW_DECISION(r, {
        params: Promise.resolve({ schoolId, draftId }),
      });
    }
    const questionRes = await create("teacher", payload());
    expect(questionRes.status).toBe(201);
    const questionId = (await questionRes.json()).question.id;
    const start = new Date(Date.now() + 90 * 60000).toISOString();
    const end = new Date(Date.now() + 240 * 60000).toISOString();
    const draftRes = await POST_DRAFTS(req("teacher", schoolA, "POST", {
      assignmentId, termId, kind: "QUIZ", title: "Synthetic primary section quiz",
      startsAt: start, endsAt: end, durationMinutes: 30,
      maxAttempts: 1, passPercent: 70,
      questions: [{ questionId, points: 4 }],
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(draftRes.status).toBe(201);
    const draftId = (await draftRes.json()).draft.id;
    for (const [actor, expected] of [
      ["", 401], ["teacher", 404], ["other", 404],
      ["admin", 404], ["foreign", 404],
    ] as const) {
      expect((await queue(actor)).status).toBe(expected);
      expect((await decide(actor, draftId, "APPROVED")).status).toBe(expected);
    }
    // Principal can view only their separate SECONDARY queue, never PRIMARY.
    expect((await queue("principal")).status).toBe(200);
    expect((await decide("principal", draftId, "APPROVED")).status).toBe(404);
    expect((await decide("head", draftId, "APPROVED", schoolB)).status).toBe(404);
    const allowed = await queue("head");
    expect(allowed.status).toBe(200);
    const json = await allowed.json();
    expect(json.drafts.some((v: { id: string }) => v.id === draftId)).toBe(true);
    expect(JSON.stringify(json)).not.toContain("correctIndex");
    expect(JSON.stringify(json)).not.toContain("answerKey");
    const decision = await decide("head", draftId, "APPROVED");
    expect(decision.status).toBe(201);
    const recorded = (await decision.json()).event;
    expect(recorded.decision).toBe("APPROVED");
    expect((await decide("head", draftId, "APPROVED")).status).toBe(404);
    expect((await decide("head", draftId, "RETURNED")).status).toBe(404);
    const rows = await prisma.assessmentReviewEvent.findMany({
      where: { schoolId: schoolA, draftId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].reviewerMembershipId).toBe(members.head);
    await expect(prisma.assessmentReviewEvent.update({
      where: { id: rows[0].id },
      data: { reason: "Unauthorized rewritten review" },
    })).rejects.toThrow();
    await expect(prisma.assessmentReviewEvent.delete({
      where: { id: rows[0].id },
    })).rejects.toThrow();
    await expect(prisma.assessmentReviewEvent.create({
      data: {
        schoolId: schoolA, draftId, decision: "APPROVED",
        reviewerUserId: users.admin, reviewerMembershipId: members.admin,
        reason: "Forged administrator academic decision",
      },
    })).rejects.toThrow();
    // This review never creates assessment publication, attempts or scores.
    expect(await prisma.assessmentDraft.findUnique({
      where: { id: draftId }, select: { id: true },
    })).toBeTruthy();
  });

  it("permits Principal only for SECONDARY sealed assessment drafts", async () => {
    const q = await create("teacher", {
      ...payload(), assignmentId: secondaryAssignmentId,
    });
    expect(q.status).toBe(201);
    const questionId = (await q.json()).question.id;
    const startsAt = new Date(Date.now() + 120 * 60_000).toISOString();
    const endsAt = new Date(Date.now() + 250 * 60_000).toISOString();
    const draft = await POST_DRAFTS(req("teacher", schoolA, "POST", {
      assignmentId: secondaryAssignmentId, termId, kind: "EXAM",
      title: "Synthetic secondary examination draft",
      startsAt, endsAt, durationMinutes: 45,
      maxAttempts: 1, passPercent: 50,
      questions: [{ questionId, points: 10 }],
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(draft.status).toBe(201);
    const draftId = (await draft.json()).draft.id;
    const input = {
      decision: "RETURNED", reason: "Synthetic secondary academic moderation",
    };
    for (const actor of ["head", "teacher", "admin"]) {
      const denied = await REVIEW_DECISION(req(actor, schoolA, "POST", input),
        { params: Promise.resolve({ schoolId: schoolA, draftId }) });
      expect(denied.status).toBe(404);
    }
    const listed = await REVIEW_QUEUE(req("principal", schoolA, "GET"),
      { params: Promise.resolve({ schoolId: schoolA }) });
    expect(listed.status).toBe(200);
    const json = await listed.json();
    expect(json.drafts.some((d: { id: string }) => d.id === draftId)).toBe(true);
    const result = await REVIEW_DECISION(req("principal", schoolA, "POST", input),
      { params: Promise.resolve({ schoolId: schoolA, draftId }) });
    expect(result.status).toBe(201);
    expect((await result.json()).event.decision).toBe("RETURNED");
    expect(await prisma.assessmentReviewEvent.count({
      where: { schoolId: schoolA, draftId },
    })).toBe(1);
    // A RETURNED immutable configuration cannot be edited: author new draft.
  });

  it("revoking exact verified section grant blocks new academic moderation", async () => {
    const grant = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, type: "SECTION", scopeId: sectionId },
    });
    await prisma.scopeGrant.update({
      where: { id: grant.id }, data: { verified: false },
    });
    try {
      const response = await REVIEW_QUEUE(req("head", schoolA, "GET"),
        { params: Promise.resolve({ schoolId: schoolA }) });
      expect(response.status).toBe(404);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: grant.id }, data: { verified: true },
      });
    }
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
