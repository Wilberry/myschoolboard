import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));

import { GET, POST } from "@/app/api/schools/[schoolId]/assessment-questions/route";
import { reserveInternalCbtAttempt } from "@/src/modules/assessments/attempt-reservation-service";
import { readInternalCbtAttempt } from "@/src/modules/assessments/attempt-resume-reader";
import { scoreInternalSubmittedAttempt } from "@/src/modules/assessments/objective-score-service";
import { GET as CLASS_RECORDS_GET } from "@/app/api/schools/[schoolId]/assessment-class-records/route";
import {
  GET as MANUAL_COMPONENTS_GET, POST as MANUAL_COMPONENTS_POST,
} from "@/app/api/schools/[schoolId]/assessment-manual-components/route";
import { GET as MANUAL_STUDENTS_GET } from "@/app/api/schools/[schoolId]/assessment-manual-components/[componentId]/students/route";
import { POST as MANUAL_PROPOSAL_POST } from "@/app/api/schools/[schoolId]/assessment-manual-proposals/route";
import { GET as MANUAL_REVIEW_QUEUE } from "@/app/api/schools/[schoolId]/assessment-manual-reviews/route";
import { POST as MANUAL_REVIEW_DECISION } from "@/app/api/schools/[schoolId]/assessment-manual-reviews/[proposalId]/decision/route";
import { GET as REVIEWED_MANUAL_GRADEBOOK_GET } from "@/app/api/schools/[schoolId]/assessment-reviewed-manual-gradebook/route";
import {
  GET as CORRECTIONS_GET, POST as CORRECTIONS_POST,
} from "@/app/api/schools/[schoolId]/assessment-manual-corrections/route";
import { GET as CORRECTION_QUEUE } from "@/app/api/schools/[schoolId]/assessment-manual-correction-reviews/route";
import { POST as CORRECTION_REVIEW } from "@/app/api/schools/[schoolId]/assessment-manual-correction-reviews/[requestId]/decision/route";
import {
  GET as POLICIES_GET, POST as POLICIES_POST,
} from "@/app/api/schools/[schoolId]/assessment-grading-policies/route";
import { GET as SCORE_QUEUE } from "@/app/api/schools/[schoolId]/assessment-score-queue/route";
import { POST as SCORE_POST } from "@/app/api/schools/[schoolId]/assessment-scores/[attemptId]/route";
import {
  saveInternalCbtAnswer, submitInternalCbtAttempt,
} from "@/src/modules/assessments/attempt-answer-service";
import { AssessmentError } from "@/src/modules/assessments/question-service";
import { GET as REVIEW_QUEUE } from "@/app/api/schools/[schoolId]/assessment-reviews/route";
import { GET as PUBLICATION_QUEUE } from "@/app/api/schools/[schoolId]/assessment-publications/route";
import { POST as PUBLICATION_DECISION } from "@/app/api/schools/[schoolId]/assessment-publications/[draftId]/decision/route";
import { GET as REVIEW_DETAIL } from "@/app/api/schools/[schoolId]/assessment-reviews/[draftId]/route";
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
const pupilId = `asm-student-${suffix}`;
const enrollmentId = `asm-student-enrollment-${suffix}`;
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
    for (const name of ["teacher", "other", "admin", "foreign", "head", "principal", "super", "student"]) {
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
      ["super", "SCHOOL_SUPER_ADMIN", schoolA],
      ["student", "STUDENT", schoolA],
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
    await prisma.studentRecord.create({
      data: { id: pupilId, schoolId: schoolA,
        admissionNumber: `ASM-SYNTHETIC-${suffix}`,
        givenName: "Synthetic", familyName: "Pupil", status: "ENROLLED" },
    });
    await prisma.studentEnrollment.create({
      data: { id: enrollmentId, schoolId: schoolA, studentId: pupilId,
        classId, sessionId, status: "ACTIVE" },
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
    const detail = await REVIEW_DETAIL(req("head", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA, draftId }),
    });
    expect(detail.status).toBe(200);
    expect(detail.headers.get("cache-control")).toBe("private, no-store");
    const detailBody = await detail.json();
    expect(detailBody.items).toMatchObject([{
      questionId, position: 1, points: 4,
      prompt: payload().prompt,
    }]);
    expect(JSON.stringify(detailBody)).not.toContain("correctIndex");
    expect(JSON.stringify(detailBody)).not.toContain("answerKey");
    for (const actor of ["teacher", "principal", "admin", "foreign"]) {
      const denied = await REVIEW_DETAIL(req(actor, schoolA, "GET"), {
        params: Promise.resolve({ schoolId: schoolA, draftId }),
      });
      expect(denied.status).toBe(404);
    }
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
    const preview = await REVIEW_DETAIL(req("principal", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA, draftId }),
    });
    expect(preview.status).toBe(200);
    expect(JSON.stringify(await preview.json())).not.toContain("correctIndex");
    const result = await REVIEW_DECISION(req("principal", schoolA, "POST", input),
      { params: Promise.resolve({ schoolId: schoolA, draftId }) });
    expect(result.status).toBe(201);
    expect((await result.json()).event.decision).toBe("RETURNED");
    expect(await prisma.assessmentReviewEvent.count({
      where: { schoolId: schoolA, draftId },
    })).toBe(1);
    // A RETURNED immutable configuration cannot be edited: author new draft.
  });

  it("requires independent school super admin publication after APPROVED, not RETURNED", async () => {
    async function listPublication(actor: string, schoolId = schoolA) {
      return PUBLICATION_QUEUE(req(actor, schoolId, "GET"),
        { params: Promise.resolve({ schoolId }) });
    }
    async function publish(actor: string, draftId: string,
      action: "PUBLISHED" | "WITHDRAWN", schoolId = schoolA) {
      return PUBLICATION_DECISION(req(actor, schoolId, "POST", {
        action, reason: "Synthetic independent school publication authorization",
      }), { params: Promise.resolve({ schoolId, draftId }) });
    }
    const approved = await prisma.assessmentReviewEvent.findFirstOrThrow({
      where: { schoolId: schoolA, decision: "APPROVED" },
      select: { draftId: true },
    });
    const returned = await prisma.assessmentReviewEvent.findFirstOrThrow({
      where: { schoolId: schoolA, decision: "RETURNED" },
      select: { draftId: true },
    });
    for (const [actor, code] of [
      ["", 401], ["teacher", 404], ["admin", 404],
      ["head", 404], ["principal", 404], ["foreign", 404],
    ] as const) {
      expect((await listPublication(actor)).status).toBe(code);
      expect((await publish(actor, approved.draftId, "PUBLISHED")).status).toBe(code);
    }
    expect((await publish("super", approved.draftId, "PUBLISHED", schoolB)).status).toBe(404);
    expect((await publish("super", returned.draftId, "PUBLISHED")).status).toBe(404);
    expect((await publish("super", approved.draftId, "WITHDRAWN")).status).toBe(409);
    const listing = await listPublication("super");
    expect(listing.status).toBe(200);
    expect(listing.headers.get("cache-control")).toBe("private, no-store");
    const response = await listing.json();
    expect(response.drafts.some((x: { id: string }) => x.id === approved.draftId)).toBe(true);
    expect(response.drafts.some((x: { id: string }) => x.id === returned.draftId)).toBe(false);
    expect(JSON.stringify(response)).not.toContain("correctIndex");
    expect(JSON.stringify(response)).not.toContain("answerKey");

    const published = await publish("super", approved.draftId, "PUBLISHED");
    expect(published.status).toBe(201);
    expect((await published.json()).event.action).toBe("PUBLISHED");
    expect((await publish("super", approved.draftId, "PUBLISHED")).status).toBe(409);

    await expect(prisma.assessmentPublicationEvent.create({
      data: {
        schoolId: schoolA, draftId: approved.draftId, action: "WITHDRAWN",
        actorMembershipId: members.admin, actorUserId: users.admin,
        reason: "Forged ordinary administrator withdrawal",
      },
    })).rejects.toThrow();

    const withdrawal = await publish("super", approved.draftId, "WITHDRAWN");
    expect(withdrawal.status).toBe(201);
    expect((await withdrawal.json()).event.action).toBe("WITHDRAWN");
    expect((await publish("super", approved.draftId, "WITHDRAWN")).status).toBe(409);
    expect((await publish("super", approved.draftId, "PUBLISHED")).status).toBe(409);
    const events = await prisma.assessmentPublicationEvent.findMany({
      where: { schoolId: schoolA, draftId: approved.draftId },
    });
    expect(events.map(e => e.action).sort()).toEqual(["PUBLISHED","WITHDRAWN"]);
    await expect(prisma.assessmentPublicationEvent.update({
      where: { id: events[0].id }, data: { reason: "Tampered publication decision" },
    })).rejects.toThrow();
    await expect(prisma.assessmentPublicationEvent.delete({
      where: { id: events[0].id },
    })).rejects.toThrow();
  });

  it("reserves a database-clock attempt only for a linked exact enrolled STUDENT and published exam", async () => {
    async function reserve(actor: string, draftId: string, schoolId = schoolA) {
      context.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
      return reserveInternalCbtAttempt(schoolId, draftId);
    }
    const q = await create("teacher", payload());
    expect(q.status).toBe(201);
    const questionId = (await q.json()).question.id;
    // Start already open by trusted DB clock; only synthetic disposable DB.
    const opens = new Date(Date.now() - 5 * 60000).toISOString();
    const closes = new Date(Date.now() + 70 * 60000).toISOString();
    const d = await POST_DRAFTS(req("teacher", schoolA, "POST", {
      assignmentId, termId, kind: "QUIZ",
      title: "Synthetic pupil-admission attempt test",
      startsAt: opens, endsAt: closes,
      durationMinutes: 30, maxAttempts: 1, passPercent: 60,
      questions: [{ questionId, points: 4 }],
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(d.status).toBe(201);
    const draftId = (await d.json()).draft.id;
    // Approval alone and absence of identity link cannot grant admission.
    await expect(reserve("student", draftId)).rejects.toBeInstanceOf(AssessmentError);
    const approved = await REVIEW_DECISION(req("head", schoolA, "POST", {
      decision: "APPROVED",
      reason: "Synthetic HM approves immutable pupil admission test",
    }), { params: Promise.resolve({ schoolId: schoolA, draftId }) });
    expect(approved.status).toBe(201);
    await expect(reserve("student", draftId)).rejects.toBeInstanceOf(AssessmentError);
    const published = await PUBLICATION_DECISION(req("super", schoolA, "POST", {
      action: "PUBLISHED",
      reason: "Synthetic separate school approval for internal CBT test",
    }), { params: Promise.resolve({ schoolId: schoolA, draftId }) });
    expect(published.status).toBe(201);
    await expect(reserve("student", draftId)).rejects.toBeInstanceOf(AssessmentError);
    const link = await prisma.studentAccountLink.create({
      data: { schoolId: schoolA, studentId: pupilId,
        studentMembershipId: members.student,
        attestedByMembershipId: members.admin,
        attestedByUserId: users.admin,
        attestationReason: "Synthetic verified account and enrolled student record",
      },
    });
    await expect(reserve("teacher", draftId)).rejects.toBeInstanceOf(AssessmentError);
    await expect(reserve("student", draftId, schoolB)).rejects.toBeInstanceOf(AssessmentError);
    // Transactional school row lock and DB-trigger attempt counter: racing
    // submissions may not result in two issued first attempt numbers.
    context.headers = new Headers({ cookie: cookies.student });
    const outcomes = await Promise.allSettled([
      reserveInternalCbtAttempt(schoolA, draftId),
      reserveInternalCbtAttempt(schoolA, draftId),
    ]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1);
    const reservation = outcomes.find(x => x.status === "fulfilled");
    if (!reservation || reservation.status !== "fulfilled") {
      throw new Error("Synthetic reservation missing");
    }
    expect(reservation.value.attemptNumber).toBe(1);
    expect(reservation.value.startedAt.getTime()).toBeGreaterThan(
      Date.parse(opens),
    );
    expect(reservation.value.deadlineAt.getTime()).toBeLessThanOrEqual(Date.parse(closes));
    const rows = await prisma.assessmentAttempt.findMany({
      where: { schoolId: schoolA, draftId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      studentId: pupilId, enrollmentId, studentMembershipId: members.student,
      linkId: link.id, classId, sessionId, attemptNumber: 1,
    });
    // The exact attested student may append key-blind answer snapshots but
    // cannot alter stored revisions or choose server timestamps/revisions.
    context.headers = new Headers({ cookie: cookies.teacher });
    const firstKey = "25a99854-3700-4d38-9b76-eed3b0f19f21";
    await expect(saveInternalCbtAnswer(schoolA, rows[0].id, {
      questionId, selectedIndex: 1, idempotencyKey: firstKey,
    })).rejects.toBeInstanceOf(AssessmentError);
    context.headers = new Headers({ cookie: cookies.student });
    const input = { questionId, selectedIndex: 1, idempotencyKey: firstKey };
    const beforeSave = await readInternalCbtAttempt(schoolA, rows[0].id);
    expect(beforeSave.attempt.attemptId).toBe(rows[0].id);
    expect(beforeSave.questions).toMatchObject([
      { questionId, selectedIndex: null, revision: null, prompt: payload().prompt },
    ]);
    expect(JSON.stringify(beforeSave)).not.toContain("correctIndex");
    expect(JSON.stringify(beforeSave)).not.toContain("answerKey");
    context.headers = new Headers({ cookie: cookies.teacher });
    await expect(readInternalCbtAttempt(schoolA, rows[0].id))
      .rejects.toBeInstanceOf(AssessmentError);
    context.headers = new Headers({ cookie: cookies.student });
    await expect(readInternalCbtAttempt(schoolB, rows[0].id))
      .rejects.toBeInstanceOf(AssessmentError);
    const first = await saveInternalCbtAnswer(schoolA, rows[0].id, input);
    expect(first).toMatchObject({ questionId, revision: 1 });
    expect(JSON.stringify(first)).not.toContain("correctIndex");
    expect(JSON.stringify(first)).not.toContain("answerKey");
    const replay = await saveInternalCbtAnswer(schoolA, rows[0].id, input);
    expect(replay).toEqual(first);
    await expect(saveInternalCbtAnswer(schoolA, rows[0].id, {
      ...input, selectedIndex: 0,
    })).rejects.toBeInstanceOf(AssessmentError);
    const newKey = "25a99854-3700-4d38-9b76-eed3b0f19f22";
    const second = await saveInternalCbtAnswer(schoolA, rows[0].id, {
      ...input, selectedIndex: 2, idempotencyKey: newKey,
    });
    expect(second.revision).toBe(2);
    expect(second.id).not.toBe(first.id);
    const resumed = await readInternalCbtAttempt(schoolA, rows[0].id);
    expect(resumed.questions).toMatchObject([{
      questionId, selectedIndex: 2, revision: 2, position: 1,
    }]);
    expect(JSON.stringify(resumed)).not.toContain("correctIndex");
    expect(JSON.stringify(resumed)).not.toContain("answerKey");

    await expect(saveInternalCbtAnswer(schoolA, rows[0].id, {
      ...input, questionId: "not-an-assessment-question",
      idempotencyKey: "25a99854-3700-4d38-9b76-eed3b0f19f23",
    })).rejects.toBeInstanceOf(AssessmentError);
    await expect(saveInternalCbtAnswer(schoolA, rows[0].id, {
      ...input, selectedIndex: 5,
      idempotencyKey: "25a99854-3700-4d38-9b76-eed3b0f19f24",
    })).rejects.toBeInstanceOf(AssessmentError);
    expect(await prisma.assessmentAttemptAnswerEvent.count({
      where: { schoolId: schoolA, attemptId: rows[0].id },
    })).toBe(2);
    const stored = await prisma.assessmentAttemptAnswerEvent.findFirstOrThrow({
      where: { schoolId: schoolA, attemptId: rows[0].id, questionId, revision: 1 },
    });
    expect(stored.actorMembershipId).toBe(members.student);
    await expect(prisma.assessmentAttemptAnswerEvent.update({
      where: { id: stored.id }, data: { selectedIndex: 0 },
    })).rejects.toThrow();
    await expect(prisma.assessmentAttemptAnswerEvent.delete({
      where: { id: stored.id },
    })).rejects.toThrow();
    await expect(prisma.assessmentAttemptAnswerEvent.create({
      data: { id: "forged-autosave-" + suffix, schoolId: schoolA,
        attemptId: rows[0].id, questionId,
        requestKey: "25a99854-3700-4d38-9b76-eed3b0f19f26",
        selectedIndex: 0, actorMembershipId: members.admin,
        actorUserId: users.admin },
    })).rejects.toThrow();
    // Latest answer wins. Set the correct option as last immutable revision
    // before terminal submission for SQL-only auto-marking.
    const third = await saveInternalCbtAnswer(schoolA, rows[0].id, {
      questionId, selectedIndex: 0,
      idempotencyKey: "19f790cc-c4bf-4350-b5cf-325480cd87aa",
    });
    expect(third.revision).toBe(3);
    const submitKey = "25a99854-3700-4d38-9b76-eed3b0f19f25";
    const finalized = await submitInternalCbtAttempt(schoolA, rows[0].id, {
      idempotencyKey: submitKey,
    });
    expect((await submitInternalCbtAttempt(schoolA, rows[0].id, {
      idempotencyKey: submitKey,
    }))).toEqual(finalized);
    await expect(submitInternalCbtAttempt(schoolA, rows[0].id, {
      idempotencyKey: "19f790cc-c4bf-4350-b5cf-325480cd874b",
    })).rejects.toBeInstanceOf(AssessmentError);
    await expect(readInternalCbtAttempt(schoolA, rows[0].id))
      .rejects.toBeInstanceOf(AssessmentError);
    await expect(saveInternalCbtAnswer(schoolA, rows[0].id, {
      questionId, selectedIndex: 3,
      idempotencyKey: "19f790cc-c4bf-4350-b5cf-325480cd874c",
    })).rejects.toBeInstanceOf(AssessmentError);
    // Only exact original teacher, after final submission, may initiate
    // secret-key-only database auto-scoring. Student never sees scores.
    await expect(scoreInternalSubmittedAttempt(schoolA, rows[0].id))
      .rejects.toBeInstanceOf(AssessmentError);
    const getScoringQueue = (actor: string, schoolId = schoolA) => {
      context.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
      return SCORE_QUEUE(new Request(
        `http://localhost/api/schools/${schoolId}/assessment-score-queue`,
      ), { params: Promise.resolve({ schoolId }) });
    };
    const beforeMark = await getScoringQueue("teacher");
    expect(beforeMark.status).toBe(200);
    expect((await beforeMark.json()).attempts.some(
      (a: { attemptId: string }) => a.attemptId === rows[0].id,
    )).toBe(true);
    expect((await getScoringQueue("student")).status).toBe(404);
    expect((await getScoringQueue("admin")).status).toBe(404);
    expect((await getScoringQueue("other")).status).toBe(404);
    context.headers = new Headers({ cookie: cookies.teacher });
    const marked = await scoreInternalSubmittedAttempt(schoolA, rows[0].id);
    expect(marked).toMatchObject({
      maxPoints: 4, earnedPoints: 4, percentBps: 10000,
      correctCount: 1, questionCount: 1, passed: true,
    });
    expect(await scoreInternalSubmittedAttempt(schoolA, rows[0].id))
      .toEqual(marked);
    const markerResponse = await SCORE_POST(new Request(
      `http://localhost/api/schools/${schoolA}/assessment-scores/${rows[0].id}`,
      { method: "POST" },
    ), { params: Promise.resolve({ schoolId: schoolA, attemptId: rows[0].id }) });
    expect(markerResponse.status).toBe(200);
    expect((await markerResponse.json()).score.id).toBe(marked.id);
    const afterMark = await getScoringQueue("teacher");
    expect((await afterMark.json()).attempts.some(
      (a: { attemptId: string }) => a.attemptId === rows[0].id,
    )).toBe(false);
    context.headers = new Headers({ cookie: cookies.teacher });

    expect(JSON.stringify(marked)).not.toContain("correctIndex");
    expect(JSON.stringify(marked)).not.toContain("answerKey");
    const sheetUrl = (schoolId: string) =>
      `http://localhost/api/schools/${schoolId}/assessment-class-records?` +
      new URLSearchParams({ classId, sessionId, subjectId, termId }).toString();
    const record = (actor: string, schoolId = schoolA) => {
      context.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
      return CLASS_RECORDS_GET(new Request(sheetUrl(schoolId)), {
        params: Promise.resolve({ schoolId }),
      });
    };
    const gradingInput = {
      sessionId, termId, classId, subjectId,
      quizWeight: 20, testWeight: 30, examWeight: 50,
      reason: "Synthetic explicit school grading preview setup",
    };
    const gradingRequest = (actor: string, input: unknown, schoolId = schoolA) =>
      POLICIES_POST(req(actor, schoolId, "POST", input), {
        params: Promise.resolve({ schoolId }),
      });
    const getPolicies = (actor: string, schoolId = schoolA) =>
      POLICIES_GET(req(actor, schoolId, "GET"), {
        params: Promise.resolve({ schoolId }),
      });
    for (const actor of ["teacher", "student", "admin", "head", "principal", "foreign"]) {
      expect((await gradingRequest(actor, gradingInput)).status).toBe(404);
      expect((await getPolicies(actor)).status).toBe(404);
    }
    expect((await gradingRequest("super", gradingInput, schoolB)).status).toBe(404);
    expect((await gradingRequest("super", {
      ...gradingInput, testWeight: 31,
    })).status).toBe(400);
    expect((await gradingRequest("super", {
      ...gradingInput, actorUserId: users.super,
    })).status).toBe(400);
    const revision1 = await gradingRequest("super", gradingInput);
    expect(revision1.status).toBe(201);
    const policy1 = (await revision1.json()).policy;
    expect(policy1.version).toBe(1);
    expect(policy1.status).toBe("DRAFT_PREVIEW_ONLY");
    const revision2 = await gradingRequest("super", {
      ...gradingInput, quizWeight: 0, testWeight: 0, examWeight: 100,
      reason: "Synthetic updated exam-only preview experiment",
    });
    expect(revision2.status).toBe(201);
    const policy2 = (await revision2.json()).policy;
    expect(policy2.version).toBe(2);
    expect((await getPolicies("super")).status).toBe(200);
    const history = await prisma.assessmentGradingPolicyRevision.findMany({
      where: { schoolId: schoolA, sessionId, termId, classId, subjectId },
    });
    expect(history).toHaveLength(2);
    await expect(prisma.assessmentGradingPolicyRevision.update({
      where: { id: policy1.id }, data: { quizWeight: 100 },
    })).rejects.toThrow();
    await expect(prisma.assessmentGradingPolicyRevision.delete({
      where: { id: policy1.id },
    })).rejects.toThrow();
    await expect(prisma.assessmentGradingPolicyRevision.create({
      data: {
        id: "forged-grading-revision-" + suffix,
        schoolId: schoolA, sessionId, termId, classId, subjectId,
        quizWeight: 20, testWeight: 30, examWeight: 50,
        reason: "Forged actor should be rejected",
        actorMembershipId: members.admin, actorUserId: users.admin,
      },
    })).rejects.toThrow();
    const ownSheet = await record("teacher");
    expect(ownSheet.status).toBe(200);
    expect(ownSheet.headers.get("cache-control")).toBe("private, no-store");
    const sheet = await ownSheet.json();
    expect(sheet.status).toBe("PROVISIONAL");
    expect(sheet.sheet.gradingPolicy).toMatchObject({
      version: 2, quizWeight: 0, testWeight: 0, examWeight: 100,
      status: "DRAFT_PREVIEW_ONLY",
    });
    expect(sheet.sheet.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    ).weightedPreview).toMatchObject({
      status: "PENDING", weightedPercentBps: null,
    });

    const pupilLine = sheet.sheet.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    );
    expect(pupilLine).toBeTruthy();
    expect(pupilLine.assessments.some((a: { draftId: string; earnedPoints: number }) =>
      a.draftId === draftId && a.earnedPoints === 4)).toBe(true);
    expect(JSON.stringify(sheet)).not.toContain("correctIndex");
    expect(JSON.stringify(sheet)).not.toContain("answerKey");
    expect((await record("student")).status).toBe(404);
    expect((await record("other")).status).toBe(404);
    expect((await record("admin")).status).toBe(404);
    expect((await record("teacher", schoolB)).status).toBe(404);

    await expect(prisma.assessmentAttemptScore.update({
      where: { id: marked.id }, data: { earnedPoints: 0 },
    })).rejects.toThrow();
    await expect(prisma.assessmentAttemptScore.delete({
      where: { id: marked.id },
    })).rejects.toThrow();
    await expect(prisma.assessmentAttemptScore.create({
      data: {
        id: "forged-objective-score-" + suffix,
        schoolId: schoolA, attemptId: rows[0].id,
        scorerMembershipId: members.admin, scorerUserId: users.admin,
        earnedPoints: 0, maxPoints: 4, passed: false,
      },
    })).rejects.toThrow();
    context.headers = new Headers({ cookie: cookies.student });
    const submissionRow = await prisma.assessmentAttemptSubmission.findFirstOrThrow({
      where: { schoolId: schoolA, attemptId: rows[0].id },
    });
    await expect(prisma.assessmentAttemptSubmission.update({
      where: { id: submissionRow.id }, data: { requestKey: firstKey },
    })).rejects.toThrow();
    await expect(prisma.assessmentAttemptSubmission.delete({
      where: { id: submissionRow.id },
    })).rejects.toThrow();
    await expect(reserve("student", draftId)).rejects.toBeInstanceOf(AssessmentError);
    await expect(prisma.assessmentAttempt.update({
      where: { id: rows[0].id }, data: { attemptNumber: 2 },
    })).rejects.toThrow();
    await expect(prisma.assessmentAttempt.delete({
      where: { id: rows[0].id },
    })).rejects.toThrow();
    // Revocation is append-only and forbids all future admissions.
    await prisma.studentAccountLinkRevocation.create({
      data: { schoolId: schoolA, linkId: link.id,
        actorMembershipId: members.admin, actorUserId: users.admin,
        reason: "Synthetic child account safety revocation during CBT check",
      },
    });
    await expect(reserve("student", draftId)).rejects.toBeInstanceOf(AssessmentError);
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

  it("records only an exact assigned teacher's immutable written mark proposal, never official scores", async () => {
    const componentInput = {
      assignmentId, termId, kind: "TEST",
      title: "Synthetic written fraction assessment", maxPoints: 20,
    };
    const addComponent = (actor: string, value: unknown, schoolId = schoolA) =>
      MANUAL_COMPONENTS_POST(req(actor, schoolId, "POST", value), {
        params: Promise.resolve({ schoolId }),
      });
    const addProposal = (actor: string, value: unknown, schoolId = schoolA) =>
      MANUAL_PROPOSAL_POST(req(actor, schoolId, "POST", value), {
        params: Promise.resolve({ schoolId }),
      });
    for (const actor of ["", "other", "admin", "super", "head", "principal", "student", "foreign"]) {
      expect((await addComponent(actor, componentInput)).status)
        .toBe(actor === "" ? 401 : 404);
    }
    expect((await addComponent("teacher", componentInput, schoolB)).status).toBe(404);
    expect((await addComponent("teacher", { ...componentInput, maxPoints: 101 })).status).toBe(400);
    expect((await addComponent("teacher", {
      ...componentInput, teacherUserId: users.teacher,
    })).status).toBe(400);
    const created = await addComponent("teacher", componentInput);
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    const component = (await created.json()).component;
    expect(component).toMatchObject({
      kind: "TEST", classId, sessionId, termId, maxPoints: 20,
    });
    const list = await MANUAL_COMPONENTS_GET(req("teacher", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    });
    expect(list.status).toBe(200);
    expect((await list.json()).components.some(
      (c: { id: string }) => c.id === component.id,
    )).toBe(true);
    const roster = await MANUAL_STUDENTS_GET(req("teacher", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA, componentId: component.id }),
    });
    expect(roster.status).toBe(200);
    expect((await roster.json()).students).toMatchObject([{
      studentId: pupilId, proposed: false,
    }]);
    const deniedRoster = await MANUAL_STUDENTS_GET(req("other", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA, componentId: component.id }),
    });
    expect(deniedRoster.status).toBe(404);
    const proposalInput = {
      componentId: component.id, studentId: pupilId,
      earnedPoints: 17, reason: "Synthetic written teacher marking note",
    };
    expect((await addProposal("student", proposalInput)).status).toBe(404);
    expect((await addProposal("admin", proposalInput)).status).toBe(404);
    expect((await addProposal("other", proposalInput)).status).toBe(404);
    expect((await addProposal("teacher", {
      ...proposalInput, earnedPoints: 21,
    })).status).toBe(404);
    expect((await addProposal("teacher", {
      ...proposalInput, studentId: "unrelated-pupil",
    })).status).toBe(404);
    expect((await addProposal("teacher", proposalInput, schoolB)).status).toBe(404);
    const proposal = await addProposal("teacher", proposalInput);
    expect(proposal.status).toBe(201);
    expect((await proposal.json()).status).toBe("UNAPPROVED_NOT_SCORED");
    expect((await addProposal("teacher", proposalInput)).status).toBe(409);
    const recorded = await prisma.assessmentManualMarkProposal.findFirstOrThrow({
      where: { schoolId: schoolA, componentId: component.id, studentId: pupilId },
    });
    expect(recorded).toMatchObject({
      earnedPoints: 17, enrollmentId,
      actorMembershipId: members.teacher, actorUserId: users.teacher,
    });
    const reviewedGradebook = (actor: string, schoolId = schoolA) => {
      context.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
      const q = new URLSearchParams({ classId, sessionId, termId, subjectId });
      return REVIEWED_MANUAL_GRADEBOOK_GET(new Request(
        `http://localhost/api/schools/${schoolId}/assessment-reviewed-manual-gradebook?${q}`,
      ), { params: Promise.resolve({ schoolId }) });
    };
    const beforeAcademicDecision = await reviewedGradebook("teacher");
    expect(beforeAcademicDecision.status).toBe(200);
    const beforeRows = (await beforeAcademicDecision.json()).gradebook.students;
    const unapproved = beforeRows.find((x: { studentId: string }) => x.studentId === pupilId);
    expect(unapproved).toMatchObject({
      approvedMarksSum: 0, unapprovedComponents: 1,
      completedPercentBps: null, readyForFurtherAcademicReview: false,
    });
    expect(unapproved.components[0]).toMatchObject({
      originalPoints: 17, effectiveApprovedPoints: null,
      status: "PENDING_ACADEMIC_REVIEW",
    });
    expect((await reviewedGradebook("student")).status).toBe(404);
    expect((await reviewedGradebook("admin")).status).toBe(404);
    expect((await reviewedGradebook("other")).status).toBe(404);
    expect((await reviewedGradebook("teacher", schoolB)).status).toBe(404);
    const initialReview = (actor: string, input: unknown) =>
      MANUAL_REVIEW_DECISION(req(actor, schoolA, "POST", input), {
        params: Promise.resolve({ schoolId: schoolA, proposalId: recorded.id }),
      });
    for (const actor of ["teacher", "admin", "student", "super", "principal", "other"]) {
      expect((await initialReview(actor, {
        action: "APPROVED", reason: "Synthetic wrong role or wrong section reviewer",
      })).status).toBe(404);
    }
    const reviewerQueue = await MANUAL_REVIEW_QUEUE(req("head", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    });
    expect(reviewerQueue.status).toBe(200);
    expect((await reviewerQueue.json()).proposals.some(
      (p: { proposalId: string }) => p.proposalId === recorded.id,
    )).toBe(true);
    const decision = await initialReview("head", {
      action: "APPROVED", reason: "Synthetic Primary Head verified original written marks",
    });
    expect(decision.status).toBe(201);
    expect((await decision.json()).decision.action).toBe("APPROVED");
    const initiallyApproved = await reviewedGradebook("teacher");
    const initiallyApprovedPupil = (await initiallyApproved.json()).gradebook.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    );
    expect(initiallyApprovedPupil).toMatchObject({
      approvedMarksSum: 17, unapprovedComponents: 0,
      completedPercentBps: 8500, readyForFurtherAcademicReview: true,
    });
    expect(initiallyApprovedPupil.components[0].status).toBe("APPROVED_INITIAL");

    expect((await initialReview("head", {
      action: "RETURNED", reason: "Duplicate terminal decision should fail",
    })).status).toBe(409);
    const immutableDecision = await prisma.assessmentManualMarkDecision.findFirstOrThrow({
      where: { schoolId: schoolA, proposalId: recorded.id },
    });
    await expect(prisma.assessmentManualMarkDecision.update({
      where: { id: immutableDecision.id }, data: { action: "RETURNED" },
    })).rejects.toThrow();
    await expect(prisma.assessmentManualMarkDecision.delete({
      where: { id: immutableDecision.id },
    })).rejects.toThrow();
    const correction = (actor: string, input: unknown) =>
      CORRECTIONS_POST(req(actor, schoolA, "POST", input), {
        params: Promise.resolve({ schoolId: schoolA }),
      });
    const correctionDecision = (actor: string, requestId: string, input: unknown) =>
      CORRECTION_REVIEW(req(actor, schoolA, "POST", input), {
        params: Promise.resolve({ schoolId: schoolA, requestId }),
      });
    const revisionInput = {
      proposalId: recorded.id, proposedPoints: 18,
      reason: "Synthetic mathematical recheck of marked essay",
    };
    for (const actor of ["student", "admin", "head", "principal", "other"]) {
      expect((await correction(actor, revisionInput)).status).toBe(404);
    }
    const firstCorrection = await correction("teacher", revisionInput);
    expect(firstCorrection.status).toBe(201);
    const correction1 = (await firstCorrection.json()).request;
    expect(correction1.revision).toBe(1);
    expect((await correction("teacher", {
      ...revisionInput, proposedPoints: 19,
    })).status).not.toBe(201);
    const activeQueue = await CORRECTION_QUEUE(req("head", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    });
    expect(activeQueue.status).toBe(200);
    expect((await activeQueue.json()).requests.some(
      (x: { requestId: string }) => x.requestId === correction1.id,
    )).toBe(true);
    expect((await correctionDecision("principal", correction1.id, {
      action: "APPROVED", reason: "Wrong stage principal should be rejected",
    })).status).toBe(404);
    expect((await correctionDecision("teacher", correction1.id, {
      action: "APPROVED", reason: "Proposer cannot self approve corrections",
    })).status).toBe(404);
    expect((await correctionDecision("head", correction1.id, {
      action: "APPROVED", reason: "Synthetic Primary Head approves revised evidence",
    })).status).toBe(201);
    const afterFirstCorrection = await CORRECTIONS_GET(req("teacher", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    });
    expect(afterFirstCorrection.status).toBe(200);
    expect((await afterFirstCorrection.json()).marks.find(
      (x: { proposalId: string }) => x.proposalId === recorded.id,
    )).toMatchObject({ originalPoints: 17, approvedPoints: 18,
      latestRevision: 1, pending: false });
    const returnedCorrection = await correction("teacher", {
      ...revisionInput, proposedPoints: 19,
      reason: "Synthetic second correction pending reviewer opinion",
    });
    expect(returnedCorrection.status).toBe(201);
    const correction2 = (await returnedCorrection.json()).request;
    expect(correction2.revision).toBe(2);
    const withCorrectionPending = await reviewedGradebook("teacher");
    const pendingPupil = (await withCorrectionPending.json()).gradebook.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    );
    expect(pendingPupil).toMatchObject({
      approvedMarksSum: 18, pendingCorrections: 1,
      completedPercentBps: null, readyForFurtherAcademicReview: false,
    });
    expect(pendingPupil.components[0]).toMatchObject({
      effectiveApprovedPoints: 18, status: "APPROVED_CORRECTION_PENDING",
    });

    expect((await correctionDecision("head", correction2.id, {
      action: "RETURNED", reason: "Synthetic reason lacked acceptable marking evidence",
    })).status).toBe(201);
    const corrected = await correction("teacher", {
      ...revisionInput, proposedPoints: 16,
      reason: "Synthetic final verified correction to written score",
    });
    expect(corrected.status).toBe(201);
    const correction3 = (await corrected.json()).request;
    expect(correction3.revision).toBe(3);
    expect((await correctionDecision("head", correction3.id, {
      action: "APPROVED", reason: "Synthetic verified independent final academic review",
    })).status).toBe(201);
    expect((await correctionDecision("head", correction3.id, {
      action: "RETURNED", reason: "Attempted reversal of terminal correction",
    })).status).not.toBe(201);
    const revisions = await prisma.assessmentManualCorrectionRequest.findMany({
      where: { schoolId: schoolA, proposalId: recorded.id },
      orderBy: { revision: "asc" },
    });
    expect(revisions.map(r => r.proposedPoints)).toEqual([18,19,16]);
    await expect(prisma.assessmentManualCorrectionRequest.update({
      where: { id: correction1.id }, data: { proposedPoints: 0 },
    })).rejects.toThrow();
    await expect(prisma.assessmentManualCorrectionRequest.delete({
      where: { id: correction1.id },
    })).rejects.toThrow();
    const finalDecision = await prisma.assessmentManualCorrectionDecision.findFirstOrThrow({
      where: { schoolId: schoolA, requestId: correction3.id },
    });
    await expect(prisma.assessmentManualCorrectionDecision.update({
      where: { id: finalDecision.id }, data: { action: "RETURNED" },
    })).rejects.toThrow();
    await expect(prisma.assessmentManualCorrectionDecision.delete({
      where: { id: finalDecision.id },
    })).rejects.toThrow();
    const afterLast = await CORRECTIONS_GET(req("teacher", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    });
    expect((await afterLast.json()).marks.find(
      (x: { proposalId: string }) => x.proposalId === recorded.id,
    )).toMatchObject({ originalPoints: 17, approvedPoints: 16,
      latestRevision: 3, pending: false });
    const finalGradebookResponse = await reviewedGradebook("teacher");
    expect(finalGradebookResponse.status).toBe(200);
    expect(finalGradebookResponse.headers.get("cache-control")).toBe("private, no-store");
    const gradebookBody = await finalGradebookResponse.json();
    expect(gradebookBody.gradebook.status).toBe("ACADEMIC_APPROVED_PREVIEW_ONLY");
    expect(JSON.stringify(gradebookBody)).not.toContain("correctIndex");
    expect(JSON.stringify(gradebookBody)).not.toContain("answerKey");
    const finalPupil = gradebookBody.gradebook.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    );
    expect(finalPupil).toMatchObject({
      approvedMarksSum: 16, totalPossiblePoints: 20,
      completedPercentBps: 8000, unapprovedComponents: 0,
      pendingCorrections: 0, readyForFurtherAcademicReview: true,
    });
    expect(finalPupil.components[0]).toMatchObject({
      originalPoints: 17, effectiveApprovedPoints: 16,
      approvedCorrectionRevision: 3, status: "APPROVED_CORRECTED",
    });



    await expect(prisma.assessmentManualMarkProposal.update({
      where: { id: recorded.id }, data: { earnedPoints: 19 },
    })).rejects.toThrow();
    await expect(prisma.assessmentManualMarkProposal.delete({
      where: { id: recorded.id },
    })).rejects.toThrow();
    await expect(prisma.assessmentManualComponent.update({
      where: { id: component.id }, data: { maxPoints: 100 },
    })).rejects.toThrow();
    await expect(prisma.assessmentManualMarkProposal.create({
      data: {
        id: "forged-manual-mark-" + suffix, schoolId: schoolA,
        componentId: component.id, studentId: "unrelated-pupil",
        enrollmentId, classId, sessionId, earnedPoints: 10,
        reason: "Forged actor role should be denied",
        actorMembershipId: members.admin, actorUserId: users.admin,
      },
    })).rejects.toThrow();
    const postRoster = await MANUAL_STUDENTS_GET(req("teacher", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA, componentId: component.id }),
    });
    expect((await postRoster.json()).students).toMatchObject([{
      studentId: pupilId, proposed: true,
    }]);
    // Proposals are deliberately excluded from class record aggregates
    // until independent academic review and correction controls exist.
    const recordQuery = new URLSearchParams({
      classId, sessionId, termId, subjectId,
    });
    const provisional = await CLASS_RECORDS_GET(new Request(
      `http://localhost/api/schools/${schoolA}/assessment-class-records?${recordQuery}`,
    ), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(provisional.status).toBe(200);
    const content = await provisional.json();
    const own = content.sheet.students.find(
      (value: { studentId: string }) => value.studentId === pupilId,
    );
    expect(own.assessments.some((a: { title: string }) =>
      a.title === componentInput.title)).toBe(false);

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
