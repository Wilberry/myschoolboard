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
import { GET as RESULT_PREP_GET } from "@/app/api/schools/[schoolId]/result-preparation/route";
import {
  GET as RESULT_EVIDENCE_GET, POST as RESULT_EVIDENCE_POST,
} from "@/app/api/schools/[schoolId]/result-sheet-evidence/route";
import { GET as RESULT_REVIEW_QUEUE } from "@/app/api/schools/[schoolId]/result-sheet-reviews/route";
import { GET as RESULT_OWNER_PREFLIGHT } from "@/app/api/schools/[schoolId]/result-publication-candidates/route";
import { GET as FINAL_OWNER_GET, POST as FINAL_OWNER_POST } from "@/app/api/schools/[schoolId]/result-final-publication-decisions/route";
import { GET as SOURCE_PACKET_GET, POST as SOURCE_PACKET_POST } from "@/app/api/schools/[schoolId]/report-card-source-packets/route";
import { GET as REPORT_SCALE_GET, POST as REPORT_SCALE_POST } from "@/app/api/schools/[schoolId]/report-grade-scales/route";
import { GET as AGGREGATION_RULE_GET, POST as AGGREGATION_RULE_POST } from "@/app/api/schools/[schoolId]/report-aggregation-rules/route";
import { GET as COMPOSITION_GET, POST as COMPOSITION_POST } from "@/app/api/schools/[schoolId]/private-official-report-compositions/route";
import { GET as VISIBILITY_POLICY_GET, POST as VISIBILITY_POLICY_POST } from "@/app/api/schools/[schoolId]/report-visibility-policies/route";
import { GET as RELEASE_PREFLIGHT_GET, POST as RELEASE_PREFLIGHT_POST } from "@/app/api/schools/[schoolId]/report-release-preflights/route";
import { GET as GUARDIAN_EVENTS_GET, POST as GUARDIAN_EVENTS_POST } from "@/app/api/schools/[schoolId]/guardian-relationships/route";
import { POST as GUARDIAN_RELATIONSHIP_INSPECT_POST } from "@/app/api/schools/[schoolId]/guardian-relationships/inspect/route";
import { GET as RECIPIENT_ELIGIBILITY_GET, POST as RECIPIENT_ELIGIBILITY_POST } from "@/app/api/schools/[schoolId]/private-recipient-eligibility/route";
import { POST as OWNER_PRIVATE_GRADE_PREVIEW } from "@/app/api/schools/[schoolId]/private-owner-grade-previews/route";
import { POST as PRIVATE_TERM_GRADE_PREVIEW_POST } from "@/app/api/schools/[schoolId]/private-term-grade-previews/route";
import { simulatePrivateReportComposition, type PrivatePacketStudent } from "@/src/modules/results/report-composition-simulation";
import { POST as RESULT_REVIEW_POST } from "@/app/api/schools/[schoolId]/result-sheet-reviews/[evidenceId]/decision/route";
import {
  GET as ADOPTIONS_GET, POST as ADOPTIONS_POST,
} from "@/app/api/schools/[schoolId]/result-grading-adoptions/route";
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
    for (const name of ["teacher", "other", "admin", "foreign", "head", "principal", "super", "student", "parent"]) {
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
      ["parent", "PARENT", schoolA],
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
    const adoption = (actor: string, data: unknown, id = schoolA) =>
      ADOPTIONS_POST(req(actor, id, "POST", data), {
        params: Promise.resolve({ schoolId: id }),
      });
    for (const actor of ["teacher","student","admin","head","principal","foreign"]) {
      expect((await adoption(actor, {
        policyId: policy2.id, reason: "Only owner may adopt",
      })).status).toBe(404);
    }
    expect((await adoption("super", {
      policyId: policy2.id, reason: "Wrong school adoption attempt",
    }, schoolB)).status).toBe(404);
    expect((await adoption("super", { policyId: policy2.id })).status).toBe(400);
    const adopted = await adoption("super", {
      policyId: policy2.id, reason: "Synthetic initial official grading policy adoption",
    });
    expect(adopted.status).toBe(201);
    expect((await adopted.json()).adoption).toMatchObject({
      policyId: policy2.id, ordinal: 1, sessionId, termId, classId, subjectId,
    });
    expect((await adoption("super", {
      policyId: policy2.id, reason: "Duplicate adoption should not rewrite history",
    })).status).toBe(409);
    expect((await ADOPTIONS_GET(req("super", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    })).status).toBe(200);
    expect((await ADOPTIONS_GET(req("teacher", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    })).status).toBe(404);
    const firstAdoption = await prisma.resultGradingAdoption.findFirstOrThrow({
      where: { schoolId: schoolA, policyId: policy2.id },
    });
    await expect(prisma.resultGradingAdoption.update({
      where: { id: firstAdoption.id }, data: { reason: "Tampered grading policy" },
    })).rejects.toThrow();
    await expect(prisma.resultGradingAdoption.delete({
      where: { id: firstAdoption.id },
    })).rejects.toThrow();

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
    const preparation = (actor: string, schoolId = schoolA) => {
      context.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
      const query = new URLSearchParams({ classId, sessionId, termId, subjectId });
      return RESULT_PREP_GET(new Request(
        `http://localhost/api/schools/${schoolId}/result-preparation?${query}`,
      ), { params: Promise.resolve({ schoolId }) });
    };
    const beforePreparation = await preparation("teacher");
    expect(beforePreparation.status).toBe(200);
    expect(beforePreparation.headers.get("cache-control")).toBe("private, no-store");
    const prepBody = await beforePreparation.json();
    expect(prepBody.preparation.status).toBe("PRIVATE_PREPARATION_ONLY");
    const prepPupil = prepBody.preparation.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    );
    expect(prepPupil.blockers).toContain("MANUAL_REVIEW_PENDING");
    expect(prepPupil.blockers).toContain("GRADING_POLICY_NOT_ADOPTED");
    expect(JSON.stringify(prepBody)).not.toContain("correctIndex");
    expect(JSON.stringify(prepBody)).not.toContain("answerKey");
    expect((await preparation("student")).status).toBe(404);
    expect((await preparation("other")).status).toBe(404);
    expect((await preparation("admin")).status).toBe(404);
    expect((await preparation("teacher", schoolB)).status).toBe(404);
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
    const afterSourceReview = await preparation("teacher");
    expect(afterSourceReview.status).toBe(200);
    expect((await afterSourceReview.json()).preparation.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    ).blockers).not.toContain("MANUAL_REVIEW_PENDING");


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
    const pendingSourceReview = await preparation("teacher");
    expect((await pendingSourceReview.json()).preparation.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    ).blockers).toContain("MANUAL_CORRECTION_PENDING");


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
    // Phase 8 requires a separately adopted school policy, immutable source
    // manifest and independent section review. The exam-only adoption above
    // cannot satisfy the absence of EXAM evidence in this synthetic case.
    const createFrozen = (actor: string, input: unknown, id = schoolA) =>
      RESULT_EVIDENCE_POST(req(actor, id, "POST", input), {
        params: Promise.resolve({ schoolId: id }),
      });
    const freezeInput = {
      assignmentId, termId, reason: "Synthetic immutable result source preparation",
    };
    for (const actor of ["student", "admin", "head", "principal", "super", "other"]) {
      expect((await createFrozen(actor, freezeInput)).status).toBe(404);
    }
    expect((await createFrozen("teacher", freezeInput, schoolB)).status).toBe(404);
    expect((await createFrozen("teacher", {
      ...freezeInput, sourceManifest: [{ studentId: pupilId, earnedPoints: 100 }],
    })).status).toBe(400);
    const frozenUnderExamOnly = await createFrozen("teacher", freezeInput);
    expect(frozenUnderExamOnly.status).not.toBe(201);
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

  it("reworks a RETURNED initial written mark through immutable independent correction approval", async () => {
    const newComponent = await MANUAL_COMPONENTS_POST(
      req("teacher", schoolA, "POST", {
        assignmentId, termId, kind: "QUIZ",
        title: "Synthetic returned initial offline quiz",
        maxPoints: 10,
      }), { params: Promise.resolve({ schoolId: schoolA }) },
    );
    expect(newComponent.status).toBe(201);
    const component = (await newComponent.json()).component;
    const proposed = await MANUAL_PROPOSAL_POST(
      req("teacher", schoolA, "POST", {
        componentId: component.id, studentId: pupilId,
        earnedPoints: 9, reason: "Synthetic first handwritten quiz marking",
      }), { params: Promise.resolve({ schoolId: schoolA }) },
    );
    expect(proposed.status).toBe(201);
    const initial = (await proposed.json()).proposal;
    const correctionBeforeDecision = await CORRECTIONS_POST(req("teacher", schoolA, "POST", {
      proposalId: initial.id, proposedPoints: 8,
      reason: "An unreviewed initial mark is not yet eligible",
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(correctionBeforeDecision.status).not.toBe(201);
    const returned = await MANUAL_REVIEW_DECISION(req("head", schoolA, "POST", {
      action: "RETURNED", reason: "Synthetic primary reviewer returned initial quiz mark",
    }), { params: Promise.resolve({ schoolId: schoolA, proposalId: initial.id }) });
    expect(returned.status).toBe(201);
    const returnedQ = new URLSearchParams({ classId, sessionId, subjectId, termId });
    const preview = (actor: string) => {
      context.headers = new Headers({ cookie: cookies[actor] });
      return REVIEWED_MANUAL_GRADEBOOK_GET(new Request(
        `http://localhost/api/schools/${schoolA}/assessment-reviewed-manual-gradebook?${returnedQ}`,
      ), { params: Promise.resolve({ schoolId: schoolA }) });
    };
    const returnedSheet = (await (await preview("teacher")).json()).gradebook;
    const before = returnedSheet.students.find((x: { studentId: string }) => x.studentId === pupilId);
    expect(before.readyForFurtherAcademicReview).toBe(false);
    expect(before.components.find((c: { componentId: string }) =>
      c.componentId === component.id)).toMatchObject({
      originalPoints: 9, effectiveApprovedPoints: null,
      status: "RETURNED_NOT_APPROVED",
    });
    const reworked = await CORRECTIONS_POST(req("teacher", schoolA, "POST", {
      proposalId: initial.id, proposedPoints: 8,
      reason: "Synthetic first reconsideration after returned initial mark",
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(reworked.status).toBe(201);
    const change = (await reworked.json()).request;
    expect(change.revision).toBe(1);
    const queue = await CORRECTION_QUEUE(req("head", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    });
    expect(queue.status).toBe(200);
    expect((await queue.json()).requests.some(
      (x: { requestId: string }) => x.requestId === change.id,
    )).toBe(true);
    const awaiting = (await (await preview("teacher")).json()).gradebook.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    );
    expect(awaiting.components.find((c: { componentId: string }) =>
      c.componentId === component.id)).toMatchObject({
      effectiveApprovedPoints: null, status: "RETURNED_CORRECTION_PENDING",
    });
    const reviewed = await CORRECTION_REVIEW(req("head", schoolA, "POST", {
      action: "APPROVED", reason: "Synthetic independent approval of reworked initial quiz mark",
    }), { params: Promise.resolve({ schoolId: schoolA, requestId: change.id }) });
    expect(reviewed.status).toBe(201);
    const finished = (await (await preview("teacher")).json()).gradebook.students.find(
      (x: { studentId: string }) => x.studentId === pupilId,
    );
    expect(finished.components.find((c: { componentId: string }) =>
      c.componentId === component.id)).toMatchObject({
      originalPoints: 9, effectiveApprovedPoints: 8,
      approvedCorrectionRevision: 1, status: "APPROVED_CORRECTED",
    });
    expect(await prisma.assessmentManualMarkProposal.findFirstOrThrow({
      where: { schoolId: schoolA, id: initial.id },
    })).toMatchObject({ earnedPoints: 9 });
    expect(await prisma.assessmentManualMarkDecision.findFirstOrThrow({
      where: { schoolId: schoolA, proposalId: initial.id },
    })).toMatchObject({ action: "RETURNED" });
  });

  it("rejects partial per-pupil coverage even when the class has every adopted category", async () => {
    // The original class-wide check incorrectly accepted a QUIZ-only pupil and
    // an EXAM-only pupil for a 50/50 QUIZ/EXAM policy. Exercise actual PG code.
    const disjoint = JSON.stringify([
      { studentId: "quiz-only", cbt: [{ kind: "QUIZ" }], manual: [] },
      { studentId: "exam-only", cbt: [], manual: [{ kind: "EXAM" }] },
    ]);
    await expect(prisma.$queryRaw`
      SELECT "assert_result_sheet_weighted_categories"(
        ${disjoint}::jsonb, ${50}::integer, ${0}::integer, ${50}::integer)
        AS "valid"
    `).rejects.toThrow();
    const complete = JSON.stringify([
      { studentId: "pupil-one", cbt: [{ kind: "QUIZ" }], manual: [{ kind: "EXAM" }] },
      { studentId: "pupil-two", cbt: [{ kind: "EXAM" }], manual: [{ kind: "QUIZ" }] },
    ]);
    const passed = await prisma.$queryRaw<Array<{ valid: boolean }>>`
      SELECT "assert_result_sheet_weighted_categories"(
        ${complete}::jsonb, ${50}::integer, ${0}::integer, ${50}::integer)
        AS "valid"
    `;
    expect(passed).toEqual([{ valid: true }]);
    const quizOnly = JSON.stringify([
      { studentId: "pupil-one", cbt: [{ kind: "QUIZ" }], manual: [] },
      { studentId: "pupil-two", cbt: [{ kind: "QUIZ" }], manual: [] },
    ]);
    const zeroWeighted = await prisma.$queryRaw<Array<{ valid: boolean }>>`
      SELECT "assert_result_sheet_weighted_categories"(
        ${quizOnly}::jsonb, ${100}::integer, ${0}::integer, ${0}::integer)
        AS "valid"
    `;
    expect(zeroWeighted).toEqual([{ valid: true }]);
  });

  it("prepares DB-frozen single-subject evidence, independently reviews it and versions later changes", async () => {
    // Dedicated exact subject avoids relying on unrelated CBT attempt state.
    const newSubjectId = "res-review-subject-" + suffix;
    const newAssignmentId = "res-review-assignment-" + suffix;
    await prisma.subject.create({
      data: { id: newSubjectId, schoolId: schoolA, name: "Synthetic Result Review Subject" },
    });
    await prisma.teacherClassSubjectAssignment.create({
      data: { id: newAssignmentId, schoolId: schoolA,
        membershipId: members.teacher, classId, subjectId: newSubjectId,
        sessionId, status: "ACTIVE" },
    });
    const draftPolicy = await POLICIES_POST(req("super", schoolA, "POST", {
      sessionId, termId, classId, subjectId: newSubjectId,
      quizWeight: 0, testWeight: 100, examWeight: 0,
      reason: "Synthetic adopted written-only subject policy",
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(draftPolicy.status).toBe(201);
    const policy = (await draftPolicy.json()).policy;
    const adopted = await ADOPTIONS_POST(req("super", schoolA, "POST", {
      policyId: policy.id, reason: "Synthetic approved school grading policy version",
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(adopted.status).toBe(201);
    const adoptionId = (await adopted.json()).adoption.id;
    const componentResponse = await MANUAL_COMPONENTS_POST(
      req("teacher", schoolA, "POST", {
        assignmentId: newAssignmentId, termId,
        kind: "TEST", title: "Synthetic reviewed algebra essay", maxPoints: 10,
      }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(componentResponse.status).toBe(201);
    const componentId = (await componentResponse.json()).component.id;
    const proposalResponse = await MANUAL_PROPOSAL_POST(
      req("teacher", schoolA, "POST", {
        componentId, studentId: pupilId,
        earnedPoints: 8, reason: "Synthetic initial marking evidence",
      }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(proposalResponse.status).toBe(201);
    const proposalId = (await proposalResponse.json()).proposal.id;
    const input = {
      assignmentId: newAssignmentId, termId,
      reason: "Synthetic complete and teacher-prepared source snapshot",
    };
    const prepare = (actor: string, value: unknown) =>
      RESULT_EVIDENCE_POST(req(actor, schoolA, "POST", value), {
        params: Promise.resolve({ schoolId: schoolA }),
      });
    expect((await prepare("teacher", input)).status).not.toBe(201); // still unapproved
    const originalApproval = await MANUAL_REVIEW_DECISION(
      req("head", schoolA, "POST", {
        action: "APPROVED", reason: "Synthetic independently reviewed essay mark",
      }), { params: Promise.resolve({ schoolId: schoolA, proposalId }) });
    expect(originalApproval.status).toBe(201);
    for (const actor of ["student","admin","super","head","principal","other"]) {
      expect((await prepare(actor, input)).status).toBe(404);
    }
    const first = await prepare("teacher", input);
    expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    const firstId = (await first.json()).evidence.id;
    const firstRow = await prisma.resultSheetEvidence.findFirstOrThrow({
      where: { schoolId: schoolA, id: firstId },
    });
    expect(firstRow).toMatchObject({
      revision: 1, studentCount: 1, adoptionId,
    });
    const manifest = firstRow.sourceManifest as Array<{
      studentId: string; cbt: unknown[]; manual: Array<{
        kind: string; effectivePoints: number; maxPoints: number;
      }>;
    }>;
    expect(manifest).toMatchObject([{
      studentId: pupilId, cbt: [],
      manual: [{ kind: "TEST", effectivePoints: 8, maxPoints: 10 }],
    }]);
    expect((await prepare("teacher", input)).status).toBe(409);
    const queue = (actor: string) =>
      RESULT_REVIEW_QUEUE(req(actor, schoolA, "GET"), {
        params: Promise.resolve({ schoolId: schoolA }),
      });
    const headQueue = await queue("head");
    expect(headQueue.status).toBe(200);
    expect((await headQueue.json()).candidates.some(
      (x: { id: string }) => x.id === firstId,
    )).toBe(true);
    const principalQueue = await queue("principal");
    expect(principalQueue.status).toBe(200);
    expect((await principalQueue.json()).candidates.some(
      (x: { id: string }) => x.id === firstId,
    )).toBe(false);
    const decide = (actor: string, evidenceId: string, action: string) =>
      RESULT_REVIEW_POST(req(actor, schoolA, "POST", {
        action, reason: "Synthetic verified independent academic decision",
      }), { params: Promise.resolve({ schoolId: schoolA, evidenceId }) });
    // A previously eligible reviewer loses BOTH list and decision access
    // immediately when the verified SECTION grant is revoked.
    const reviewerGrant = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, type: "SECTION", scopeId: sectionId },
    });
    await prisma.scopeGrant.update({
      where: { id: reviewerGrant.id }, data: { verified: false },
    });
    try {
      expect((await queue("head")).status).toBe(404);
      expect((await decide("head", firstId, "APPROVED")).status).toBe(404);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: reviewerGrant.id }, data: { verified: true },
      });
    }
    expect((await decide("principal", firstId, "APPROVED")).status).toBe(404);
    expect((await decide("teacher", firstId, "APPROVED")).status).toBe(404);
    const approved = await decide("head", firstId, "APPROVED");
    expect(approved.status).toBe(201);
    expect((await approved.json()).status).toBe("ACADEMIC_REVIEW_ONLY_NOT_PUBLISHED");
    expect((await decide("head", firstId, "RETURNED")).status).toBe(409);
    const oldReview = await prisma.resultSheetReview.findFirstOrThrow({
      where: { schoolId: schoolA, evidenceId: firstId },
    });
    await expect(prisma.resultSheetEvidence.update({
      where: { id: firstId }, data: { reason: "Altered teacher evidence" },
    })).rejects.toThrow();
    await expect(prisma.resultSheetReview.update({
      where: { id: oldReview.id }, data: { action: "RETURNED" },
    })).rejects.toThrow();
    // A later independently approved mark correction requires a NEW sheet.
    const correction = await CORRECTIONS_POST(req("teacher", schoolA, "POST", {
      proposalId, proposedPoints: 9,
      reason: "Synthetic evidence-based algebra marking correction",
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(correction.status).toBe(201);
    const correctedId = (await correction.json()).request.id;
    const review = await CORRECTION_REVIEW(req("head", schoolA, "POST", {
      action: "APPROVED", reason: "Synthetic approved changed algebra mark",
    }), { params: Promise.resolve({ schoolId: schoolA, requestId: correctedId }) });
    expect(review.status).toBe(201);
    const second = await prepare("teacher", {
      ...input, reason: "Synthetic amended source marks after academic correction",
    });
    expect(second.status).toBe(201);
    const secondId = (await second.json()).evidence.id;
    const newer = await prisma.resultSheetEvidence.findFirstOrThrow({
      where: { schoolId: schoolA, id: secondId },
    });
    expect(newer.revision).toBe(2);
    expect(newer.sourceManifest).not.toEqual(firstRow.sourceManifest);
    // An adoption made AFTER teacher preparation invalidates that exact
    // revision. Reviewer may RETURN it, but must not approve stale policy.
    const changedPolicy = await POLICIES_POST(req("super", schoolA, "POST", {
      sessionId, termId, classId, subjectId: newSubjectId,
      quizWeight: 0, testWeight: 100, examWeight: 0,
      reason: "Synthetic later adopted grading policy revision",
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(changedPolicy.status).toBe(201);
    const adoptedNext = await ADOPTIONS_POST(req("super", schoolA, "POST", {
      policyId: (await changedPolicy.json()).policy.id,
      reason: "Synthetic explicit subsequent grading policy adoption",
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(adoptedNext.status).toBe(201);
    const adoptionNextId = (await adoptedNext.json()).adoption.id;
    expect(adoptionNextId).not.toBe(adoptionId);
    expect((await decide("head", secondId, "APPROVED")).status).toBe(409);
    expect((await decide("head", secondId, "RETURNED")).status).toBe(201);
    const preparedAgain = await prepare("teacher", {
      ...input, reason: "Synthetic refreshed source evidence after adoption change",
    });
    expect(preparedAgain.status).toBe(201);
    const thirdId = (await preparedAgain.json()).evidence.id;
    const thirdRow = await prisma.resultSheetEvidence.findFirstOrThrow({
      where: { schoolId: schoolA, id: thirdId },
    });
    expect(thirdRow.revision).toBe(3);
    expect(thirdRow.adoptionId).toBe(adoptionNextId);
    expect(thirdRow.sourceManifest).toEqual(newer.sourceManifest);
    expect((await decide("head", thirdId, "APPROVED")).status).toBe(201);
    // Server-only future publication readiness predicate: validates active
    // original assignment, distinct current academic reviewer, exact policy,
    // frozen source and the current School Super Admin under a school lock.
    // It creates NO publication or student-visible result.
    const finalReady = (targetSchool: string, targetEvidence: string,
      actorMembership: string, actorUser: string) => prisma.$queryRaw<
      Array<{ ready: boolean }>
    >`SELECT "assert_result_publication_readiness"(
      ${targetSchool}, ${targetEvidence}, ${actorMembership}, ${actorUser})
      AS "ready"`;
    expect(await finalReady(schoolA, thirdId, members.super, users.super))
      .toEqual([{ ready: true }]);
    const finalDecisionInput = {
      evidenceId: thirdId, reason: "Synthetic final school academic evidence approval",
    };
    const finalDecision = (actor: string, input: unknown, targetSchool = schoolA) =>
      FINAL_OWNER_POST(req(actor, targetSchool, "POST", input), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    for (const actor of ["teacher", "head", "principal", "admin", "student", "other"]) {
      expect((await finalDecision(actor, finalDecisionInput)).status).toBe(404);
    }
    expect((await finalDecision("super", finalDecisionInput, schoolB)).status).toBe(404);
    expect((await finalDecision("super", { ...finalDecisionInput,
      actorUserId: users.super })).status).toBe(400);
    const approvedForLater = await finalDecision("super", finalDecisionInput);
    expect(approvedForLater.status).toBe(201);
    expect(approvedForLater.headers.get("cache-control")).toBe("private, no-store");
    expect((await approvedForLater.json()).status)
      .toBe("FINAL_OWNER_APPROVED_AWAITING_RELEASE_NOT_PUBLIC");
    const recorded = await prisma.resultFinalPublicationDecision.findFirstOrThrow({
      where: { schoolId: schoolA, evidenceId: thirdId },
    });
    expect(recorded).toMatchObject({
      ordinal: 1, evidenceRevision: 3, adoptionId: adoptionNextId,
      actorMembershipId: members.super, actorUserId: users.super,
      status: "APPROVED_AWAITING_RELEASE",
    });
    expect((await finalDecision("super", finalDecisionInput)).status).toBe(409);
    const freezeSource = (actor: string, input: unknown, targetSchool = schoolA) =>
      SOURCE_PACKET_POST(req(actor, targetSchool, "POST", input), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const packetHistory = (actor: string, targetSchool = schoolA) =>
      SOURCE_PACKET_GET(req(actor, targetSchool, "GET"), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const sourceInput = {
      finalDecisionId: recorded.id,
      reason: "Synthetic private frozen report-card source evidence packet",
    };
    for (const actor of ["teacher", "head", "principal", "admin", "student", "other"]) {
      expect((await freezeSource(actor, sourceInput)).status).toBe(404);
      expect((await packetHistory(actor)).status).toBe(404);
    }
    expect((await freezeSource("super", sourceInput, schoolB)).status).toBe(404);
    expect((await packetHistory("super", schoolB)).status).toBe(404);
    expect((await freezeSource("super", { ...sourceInput, studentCount: 25 }))
      .status).toBe(400);
    expect((await freezeSource("super", { ...sourceInput, studentSourceCards: [] }))
      .status).toBe(400);
    const sourceCreated = await freezeSource("super", sourceInput);
    expect(sourceCreated.status).toBe(201);
    expect(sourceCreated.headers.get("cache-control")).toBe("private, no-store");
    expect((await sourceCreated.json()).status)
      .toBe("PRIVATE_SOURCE_PREPARED_NOT_GRADED_NOT_RELEASED");
    const originalPacket = await prisma.resultReportCardSourcePacket.findFirstOrThrow({
      where: { schoolId: schoolA, finalDecisionId: recorded.id },
    });
    expect(originalPacket).toMatchObject({
      evidenceId: thirdId, adoptionId: adoptionNextId,
      evidenceRevision: 3, finalDecisionOrdinal: 1, studentCount: 1,
      actorMembershipId: members.super, actorUserId: users.super,
    });
    const sourceCards = originalPacket.studentSourceCards as Array<{
      studentId: string; manual: Array<{ effectivePoints: number }>;
      reportStatus: string; adoptedWeightVersion: number;
    }>;
    expect(sourceCards).toMatchObject([{
      studentId: pupilId, reportStatus: "INTERNAL_SOURCE_ONLY_NOT_RELEASED",
      manual: [{ effectivePoints: 9 }],
    }]);
    expect(JSON.stringify(sourceCards)).not.toContain("correctIndex");
    expect(JSON.stringify(sourceCards)).not.toContain("officialGrade");
    const publicPayload = JSON.stringify(await (await packetHistory("super")).json());
    expect(publicPayload).not.toContain(pupilId);
    expect(publicPayload).not.toContain(proposalId);
    expect(publicPayload).not.toContain("studentSourceCards");
    expect((await freezeSource("super", sourceInput)).status).toBe(409);
    await expect(prisma.resultReportCardSourcePacket.update({
      where: { id: originalPacket.id }, data: { reason: "Forged packet reason" },
    })).rejects.toThrow();
    await expect(prisma.resultReportCardSourcePacket.delete({
      where: { id: originalPacket.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "ResultReportCardSourcePacket"`)
      .rejects.toThrow();
    const finalHistory = (actor: string, targetSchool = schoolA) =>
      FINAL_OWNER_GET(req(actor, targetSchool, "GET"), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    for (const actor of ["teacher", "head", "principal", "admin", "student", "other"]) {
      expect((await finalHistory(actor)).status).toBe(404);
    }
    expect((await finalHistory("super", schoolB)).status).toBe(404);
    const ownerDecisions = await finalHistory("super");
    expect(ownerDecisions.status).toBe(200);
    expect(ownerDecisions.headers.get("cache-control")).toBe("private, no-store");
    const historyBody = await ownerDecisions.json();
    expect(historyBody.decisions.some(
      (item: { evidenceId: string }) => item.evidenceId === thirdId,
    )).toBe(true);
    const historyJSON = JSON.stringify(historyBody);
    expect(historyJSON).not.toContain(pupilId);
    expect(historyJSON).not.toContain(proposalId);
    expect(historyJSON).not.toContain("sourceManifest");
    await expect(prisma.resultFinalPublicationDecision.update({
      where: { id: recorded.id }, data: { reason: "Forged altered final school approval" },
    })).rejects.toThrow();
    await expect(prisma.resultFinalPublicationDecision.delete({
      where: { id: recorded.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "ResultFinalPublicationDecision"`)
      .rejects.toThrow();

    await expect(finalReady(schoolA, thirdId, members.head, users.head))
      .rejects.toThrow();
    await expect(finalReady(schoolA, thirdId, members.super, users.head))
      .rejects.toThrow();
    await expect(finalReady(schoolB, thirdId, members.super, users.super))
      .rejects.toThrow();
    await expect(finalReady(schoolA, firstId, members.super, users.super))
      .rejects.toThrow();
    await expect(finalReady(schoolA, secondId, members.super, users.super))
      .rejects.toThrow();
    const ownerPreflight = (actor: string, inspectedSchool = schoolA) =>
      RESULT_OWNER_PREFLIGHT(req(actor, inspectedSchool, "GET"), {
        params: Promise.resolve({ schoolId: inspectedSchool }),
      });
    for (const actor of ["teacher", "student", "head", "admin", "principal", "other"]) {
      expect((await ownerPreflight(actor)).status).toBe(404);
    }
    expect((await ownerPreflight("super", schoolB)).status).toBe(404);
    const eligible = await ownerPreflight("super");
    expect(eligible.status).toBe(200);
    expect(eligible.headers.get("cache-control")).toBe("private, no-store");
    const ownerBody = await eligible.json();
    expect(ownerBody.status).toBe("INTERNAL_PREFLIGHT_ONLY_NOT_PUBLISHED");
    const current = ownerBody.candidates.find(
      (item: { evidenceId: string }) => item.evidenceId === thirdId,
    );
    expect(current).toMatchObject({ revision: 3, studentCount: 1,
      adoptionId: adoptionNextId });
    expect(ownerBody.candidates.some(
      (item: { evidenceId: string }) => item.evidenceId === secondId,
    )).toBe(false);
    expect(ownerBody.candidates.some(
      (item: { evidenceId: string }) => item.evidenceId === firstId,
    )).toBe(false);
    const ownerPayload = JSON.stringify(ownerBody);
    expect(ownerPayload).not.toContain(pupilId);
    expect(ownerPayload).not.toContain(proposalId);
    expect(ownerPayload).not.toContain("sourceManifest");
    // Changes in the current reviewer grant must hide the candidate,
    // even though its immutable historic academic approval remains.
    const scope = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, type: "SECTION", scopeId: sectionId },
    });
    await prisma.scopeGrant.update({
      where: { id: scope.id }, data: { verified: false },
    });
    try {
      await expect(finalReady(schoolA, thirdId, members.super, users.super))
        .rejects.toThrow();
      const revoked = await ownerPreflight("super");
      expect(revoked.status).toBe(200);
      expect((await revoked.json()).candidates.some(
        (item: { evidenceId: string }) => item.evidenceId === thirdId,
      )).toBe(false);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: scope.id }, data: { verified: true },
      });
    }
    const newerAdoption = await POLICIES_POST(req("super", schoolA, "POST", {
      sessionId, termId, classId, subjectId: newSubjectId,
      quizWeight: 0, testWeight: 100, examWeight: 0,
      reason: "Synthetic adoption invalidates owner result candidate",
    }), { params: Promise.resolve({ schoolId: schoolA }) });
    expect(newerAdoption.status).toBe(201);
    expect((await ADOPTIONS_POST(req("super", schoolA, "POST", {
      policyId: (await newerAdoption.json()).policy.id,
      reason: "Synthetic subsequent owner preflight policy adoption",
    }), { params: Promise.resolve({ schoolId: schoolA }) })).status).toBe(201);
    await expect(finalReady(schoolA, thirdId, members.super, users.super))
      .rejects.toThrow();
    expect(await prisma.resultFinalPublicationDecision.findFirstOrThrow({
      where: { schoolId: schoolA, evidenceId: thirdId },
    })).toMatchObject({ status: "APPROVED_AWAITING_RELEASE" });
    expect((await freezeSource("super", sourceInput)).status).toBe(409);
    const staleOwnerList = await ownerPreflight("super");
    expect(staleOwnerList.status).toBe(200);
    expect((await staleOwnerList.json()).candidates.some(
      (item: { evidenceId: string }) => item.evidenceId === thirdId,
    )).toBe(false);
    // A newer authorized version cannot rewrite or delete historical owner
    // approval. It must follow new teacher evidence and new HM approval.
    const fourthPrepared = await prepare("teacher", {
      ...input, reason: "Synthetic fourth frozen evidence after new adopted policy",
    });
    expect(fourthPrepared.status).toBe(201);
    const fourthId = (await fourthPrepared.json()).evidence.id;
    const fourthEvidence = await prisma.resultSheetEvidence.findFirstOrThrow({
      where: { schoolId: schoolA, id: fourthId },
    });
    expect(fourthEvidence.revision).toBe(4);
    expect((await decide("head", fourthId, "APPROVED")).status).toBe(201);
    const finalScope = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, type: "SECTION", scopeId: sectionId },
    });
    await prisma.scopeGrant.update({
      where: { id: finalScope.id }, data: { verified: false },
    });
    try {
      expect((await finalDecision("super", {
        evidenceId: fourthId, reason: "Unauthorized final approval after section grant revoked",
      })).status).toBe(409);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: finalScope.id }, data: { verified: true },
      });
    }
    expect((await freezeSource("super", {
      finalDecisionId: recorded.id,
      reason: "Stale original source after new grading adoption",
    })).status).toBe(409);
    const subsequentApproval = await finalDecision("super", {
      evidenceId: fourthId, reason: "Synthetic renewed independently reviewed final approval",
    });
    expect(subsequentApproval.status).toBe(201);
    const laterDecision = await prisma.resultFinalPublicationDecision.findFirstOrThrow({
      where: { schoolId: schoolA, evidenceId: fourthId },
    });
    expect(laterDecision).toMatchObject({
      ordinal: 2, evidenceRevision: 4, status: "APPROVED_AWAITING_RELEASE",
    });
    const laterPacketResponse = await freezeSource("super", {
      finalDecisionId: laterDecision.id,
      reason: "Synthetic new internal report packet after renewed approval",
    });
    expect(laterPacketResponse.status).toBe(201);
    const laterPacket = await prisma.resultReportCardSourcePacket.findFirstOrThrow({
      where: { schoolId: schoolA, finalDecisionId: laterDecision.id },
    });
    expect(laterPacket).toMatchObject({
      evidenceRevision: 4, finalDecisionOrdinal: 2, studentCount: 1,
    });
    expect((await prisma.resultReportCardSourcePacket.findFirstOrThrow({
      where: { id: originalPacket.id },
    })).studentSourceCards).toEqual(originalPacket.studentSourceCards);

    expect(await prisma.resultFinalPublicationDecision.findFirstOrThrow({
      where: { schoolId: schoolA, evidenceId: thirdId },
    })).toMatchObject({
      ordinal: 1, evidenceRevision: 3, status: "APPROVED_AWAITING_RELEASE",
    });
    const teacherHistory = await RESULT_EVIDENCE_GET(
      req("teacher", schoolA, "GET"),
      { params: Promise.resolve({ schoolId: schoolA }) });
    expect(teacherHistory.status).toBe(200);
    expect((await teacherHistory.json()).snapshots).toHaveLength(4);
    expect((await RESULT_EVIDENCE_GET(req("student", schoolA, "GET"), {
      params: Promise.resolve({ schoolId: schoolA }),
    })).status).toBe(404);
  });

  it("adopts versioned school report grade scales without touching old report sources", async () => {
    const scaleRequest = (actor: string, body: unknown, targetSchool = schoolA) =>
      REPORT_SCALE_POST(req(actor, targetSchool, "POST", body),
        { params: Promise.resolve({ schoolId: targetSchool }) });
    const scaleHistory = (actor: string, targetSchool = schoolA) =>
      REPORT_SCALE_GET(req(actor, targetSchool, "GET"),
        { params: Promise.resolve({ schoolId: targetSchool }) });
    const bands = [
      { code: "F", remark: "Synthetic low band", minBps: 0, maxBps: 5999 },
      { code: "A", remark: "Synthetic high band", minBps: 6000, maxBps: 10000 },
    ];
    const valid = {
      bands, decimalPlaces: 0, roundingMode: "HALF_UP",
      bandBasis: "RAW_BPS",
      reason: "Synthetic school grading scale adoption",
    };
    for (const actor of ["teacher", "head", "principal", "admin", "student", "other"]) {
      expect((await scaleRequest(actor, valid)).status).toBe(404);
      expect((await scaleHistory(actor)).status).toBe(404);
    }
    expect((await scaleRequest("super", valid, schoolB)).status).toBe(404);
    expect((await scaleHistory("super", schoolB)).status).toBe(404);
    for (const invalid of [
      { ...valid, version: 99 },
      { ...valid, actorMembershipId: members.super },
      { ...valid, decimalPlaces: 3 },
      { ...valid, bands: [{ ...bands[0], maxBps: 6000 }, bands[1]] },
      { ...valid, bands: [{ ...bands[0], maxBps: 5998 }, bands[1]] },
      { ...valid, bands: [{ ...bands[0], maxBps: 5999 },
        { ...bands[1], code: "f" }] },
    ]) expect((await scaleRequest("super", invalid)).status).toBe(400);

    const savedPacket = await prisma.resultReportCardSourcePacket.findFirst({
      where: { schoolId: schoolA }, orderBy: { preparedAt: "asc" },
      select: { id: true, studentSourceCards: true },
    });
    const adoptedOne = await scaleRequest("super", valid);
    expect(adoptedOne.status).toBe(201);
    expect(adoptedOne.headers.get("cache-control")).toBe("private, no-store");
    const first = (await adoptedOne.json()).scale;
    expect(first.version).toBe(1);
    expect(first.bands).toEqual(bands);
    expect((await scaleRequest("super", valid)).status).toBe(409);
    const updated = await scaleRequest("super", {
      ...valid, decimalPlaces: 1, bandBasis: "DISPLAY_ROUNDED_BPS",
      reason: "Synthetic amended displayed-score school grading policy",
    });
    expect(updated.status).toBe(201);
    const second = (await updated.json()).scale;
    expect(second.version).toBe(2);
    const ownerHistory = await scaleHistory("super");
    expect(ownerHistory.status).toBe(200);
    expect(ownerHistory.headers.get("cache-control")).toBe("private, no-store");
    const observed = (await ownerHistory.json()).scales;
    expect(observed.slice(0, 2).map((item: { version: number }) => item.version))
      .toEqual([2, 1]);
    expect(JSON.stringify(observed)).not.toContain(pupilId);
    expect(JSON.stringify(observed)).not.toContain("studentSourceCards");
    await expect(prisma.reportGradeScaleRevision.update({
      where: { id: first.id }, data: { reason: "Forged policy correction" },
    })).rejects.toThrow();
    await expect(prisma.reportGradeScaleRevision.delete({
      where: { id: first.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "ReportGradeScaleRevision"`)
      .rejects.toThrow();
    await expect(prisma.$queryRaw`SELECT "assert_report_grade_scale_bands"(
      ${JSON.stringify([
        { ...bands[0], maxBps: 7000 }, bands[1],
      ])}::jsonb)`).rejects.toThrow();
    if (savedPacket) {
      const original = await prisma.resultReportCardSourcePacket.findFirstOrThrow({
        where: { id: savedPacket.id }, select: { studentSourceCards: true },
      });
      expect(original.studentSourceCards).toEqual(savedPacket.studentSourceCards);
    }
  });

  it("adopts immutable school calculation policies without rewriting frozen pupils", async () => {
    const adoptRule = (actor: string, input: unknown, targetSchool = schoolA) =>
      AGGREGATION_RULE_POST(req(actor, targetSchool, "POST", input), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const ruleHistory = (actor: string, targetSchool = schoolA) =>
      AGGREGATION_RULE_GET(req(actor, targetSchool, "GET"), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const first = {
      categoryMethod: "EQUAL_ASSESSMENT_BPS",
      precisionMode: "HALF_UP",
      reason: "Synthetic school-adopted equal-assessment grade aggregation",
    };
    for (const actor of ["teacher", "head", "principal", "admin", "student", "other"]) {
      expect((await adoptRule(actor, first)).status).toBe(404);
      expect((await ruleHistory(actor)).status).toBe(404);
    }
    expect((await adoptRule("super", first, schoolB)).status).toBe(404);
    expect((await ruleHistory("super", schoolB)).status).toBe(404);
    for (const input of [
      { ...first, actorUserId: users.super },
      { ...first, version: 25 },
      { ...first, precisionMode: "BANKERS" },
      { ...first, categoryMethod: "AUTO" },
      { ...first, reason: "x" },
    ]) expect((await adoptRule("super", input)).status).toBe(400);

    const sourceBefore = await prisma.resultReportCardSourcePacket.findFirst({
      where: { schoolId: schoolA }, orderBy: { preparedAt: "asc" },
      select: { id: true, studentSourceCards: true },
    });
    const saved = await adoptRule("super", first);
    expect(saved.status).toBe(201);
    expect(saved.headers.get("cache-control")).toBe("private, no-store");
    expect((await saved.json()).rule.version).toBe(1);
    expect((await adoptRule("super", first)).status).toBe(409);
    const revised = await adoptRule("super", {
      ...first, categoryMethod: "POOLED_CATEGORY_POINTS",
      precisionMode: "CEILING",
      reason: "Synthetic changed adopted category-aggregation rule",
    });
    expect(revised.status).toBe(201);
    const second = (await revised.json()).rule;
    expect(second.version).toBe(2);
    const history = await ruleHistory("super");
    expect(history.status).toBe(200);
    expect(history.headers.get("cache-control")).toBe("private, no-store");
    const data = (await history.json()).rules;
    expect(data.slice(0, 2).map((row: { version: number }) => row.version))
      .toEqual([2, 1]);
    expect(JSON.stringify(data)).not.toContain(pupilId);
    expect(JSON.stringify(data)).not.toContain("studentSourceCards");
    await expect(prisma.reportAggregationRuleRevision.update({
      where: { id: second.id },
      data: { precisionMode: "FLOOR" },
    })).rejects.toThrow();
    await expect(prisma.reportAggregationRuleRevision.delete({
      where: { id: second.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "ReportAggregationRuleRevision"`)
      .rejects.toThrow();
    if (sourceBefore) {
      const unchanged = await prisma.resultReportCardSourcePacket.findFirstOrThrow({
        where: { id: sourceBefore.id },
        select: { studentSourceCards: true },
      });
      expect(unchanged.studentSourceCards).toEqual(sourceBefore.studentSourceCards);
    }
  });

  it("freezes private official composition with DB-recomputed pinned grade evidence, never releases", async () => {
    const compose = (actor: string, input: unknown, targetSchool = schoolA) =>
      COMPOSITION_POST(req(actor, targetSchool, "POST", input), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const history = (actor: string, targetSchool = schoolA) =>
      COMPOSITION_GET(req(actor, targetSchool, "GET"), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const source = await prisma.resultReportCardSourcePacket.findFirstOrThrow({
      where: { schoolId: schoolA },
      orderBy: { preparedAt: "desc" },
    });
    const aggregation = await prisma.reportAggregationRuleRevision.findFirstOrThrow({
      where: { schoolId: schoolA }, orderBy: { version: "desc" },
    });
    const scale = await prisma.reportGradeScaleRevision.findFirstOrThrow({
      where: { schoolId: schoolA }, orderBy: { version: "desc" },
    });
    const payload = {
      sourcePacketId: source.id, aggregationRuleId: aggregation.id,
      gradeScaleId: scale.id, reason: "Synthetic immutable private official result evidence",
    };
    for (const actor of ["teacher", "student", "head", "principal", "admin", "other"]) {
      expect((await compose(actor, payload)).status).toBe(404);
      expect((await history(actor)).status).toBe(404);
    }
    expect((await compose("super", payload, schoolB)).status).toBe(404);
    expect((await history("super", schoolB)).status).toBe(404);
    for (const injected of [
      { ...payload, studentId: pupilId },
      { ...payload, composedStudentCards: [] },
      { ...payload, actorUserId: users.super },
      { ...payload, gradeScaleVersion: 500 },
      { ...payload, studentCount: 0 },
    ]) expect((await compose("super", injected)).status).toBe(400);
    const older = await prisma.resultReportCardSourcePacket.findFirstOrThrow({
      where: { schoolId: schoolA },
      orderBy: { preparedAt: "asc" },
    });
    if (older.id !== source.id) {
      expect((await compose("super", {
        ...payload, sourcePacketId: older.id,
      })).status).toBe(409);
    }
    const olderScale = await prisma.reportGradeScaleRevision.findFirst({
      where: { schoolId: schoolA, version: { lt: scale.version } },
      orderBy: { version: "desc" },
    });
    if (olderScale) expect((await compose("super", {
      ...payload, gradeScaleId: olderScale.id,
    })).status).toBe(409);
    const olderRule = await prisma.reportAggregationRuleRevision.findFirst({
      where: { schoolId: schoolA, version: { lt: aggregation.version } },
      orderBy: { version: "desc" },
    });
    if (olderRule) expect((await compose("super", {
      ...payload, aggregationRuleId: olderRule.id,
    })).status).toBe(409);
    const reviewerScope = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, type: "SECTION", scopeId: sectionId },
    });
    await prisma.scopeGrant.update({
      where: { id: reviewerScope.id }, data: { verified: false },
    });
    try {
      expect((await compose("super", payload)).status).toBe(409);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: reviewerScope.id }, data: { verified: true },
      });
    }
    const accepted = await compose("super", payload);
    expect(accepted.status).toBe(201);
    expect(accepted.headers.get("cache-control")).toBe("private, no-store");
    expect((await accepted.json()).status)
      .toBe("PRIVATE_COMPOSITION_FROZEN_NOT_PUBLISHED");
    const frozen = await prisma.privateOfficialReportComposition.findFirstOrThrow({
      where: { schoolId: schoolA, sourcePacketId: source.id },
    });
    expect(frozen).toMatchObject({
      aggregationRuleId: aggregation.id, gradeScaleId: scale.id,
      aggregationRuleVersion: aggregation.version, gradeScaleVersion: scale.version,
      studentCount: source.studentCount, evidenceRevision: source.evidenceRevision,
      status: "INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED",
    });
    const composed = frozen.composedStudentCards as Array<{
      studentId: string; rawPercentBps: number; gradeCode: string;
      remark: string; displayPercent: string; categoryPercentBps: unknown;
      reportStatus: string;
    }>;
    const expected = simulatePrivateReportComposition({
      sourcePacketId: source.id, expectedStudentCount: source.studentCount,
      students: source.studentSourceCards as unknown as PrivatePacketStudent[],
      aggregation: {
        id: aggregation.id, version: aggregation.version,
        categoryMethod: aggregation.categoryMethod as "EQUAL_ASSESSMENT_BPS" | "POOLED_CATEGORY_POINTS",
        precisionMode: aggregation.precisionMode as "HALF_UP" | "FLOOR" | "CEILING",
      },
      scale: {
        id: scale.id, version: scale.version,
        bands: scale.bands as unknown as Array<{
          code: string; remark: string; minBps: number; maxBps: number }>,
        decimalPlaces: scale.decimalPlaces as 0 | 1 | 2,
        roundingMode: scale.roundingMode as "HALF_UP" | "FLOOR" | "CEILING",
        bandBasis: scale.bandBasis as "RAW_BPS" | "DISPLAY_ROUNDED_BPS",
      },
    });
    expect(composed).toHaveLength(source.studentCount);
    for (const row of expected.students) {
      expect(composed.find(item => item.studentId === row.studentId)).toMatchObject({
        ...row, reportStatus: "INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED",
      });
    }
    expect(JSON.stringify(composed)).not.toContain("correctIndex");
    const privateResponse = await history("super");
    expect(privateResponse.status).toBe(200);
    expect(privateResponse.headers.get("cache-control")).toBe("private, no-store");
    const metadata = JSON.stringify(await privateResponse.json());
    expect(metadata).not.toContain(pupilId);
    expect(metadata).not.toContain("composedStudentCards");
    expect(metadata).not.toContain("rawPercentBps");
    expect((await compose("super", payload)).status).toBe(409);
    await expect(prisma.privateOfficialReportComposition.update({
      where: { id: frozen.id }, data: { reason: "Forged grade revision" },
    })).rejects.toThrow();
    await expect(prisma.privateOfficialReportComposition.delete({
      where: { id: frozen.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "PrivateOfficialReportComposition"`)
      .rejects.toThrow();
    // Independently compare PostgreSQL category aggregation, both modes,
    // and display-label rounding against the deterministic TypeScript engine.
    const synthetic = [{
      studentId: pupilId, adoptedWeightVersion: 7,
      reportStatus: "INTERNAL_SOURCE_ONLY_NOT_RELEASED",
      quizWeight: 20, testWeight: 30, examWeight: 50,
      cbt: [
        { draftId: "quiz-1", attemptId: "attempt-1", kind: "QUIZ",
          earnedPoints: 1, maxPoints: 2 },
        { draftId: "quiz-2", attemptId: "attempt-2", kind: "QUIZ",
          earnedPoints: 1, maxPoints: 4 },
        { draftId: "exam-1", attemptId: "attempt-3", kind: "EXAM",
          earnedPoints: 8, maxPoints: 10 },
      ],
      manual: [
        { componentId: "test-1", markId: "approved-mark-1", kind: "TEST",
          effectivePoints: 6, maxPoints: 10 },
      ],
    }];
    for (const mode of ["EQUAL_ASSESSMENT_BPS", "POOLED_CATEGORY_POINTS"] as const) {
      const pg = await prisma.$queryRaw<Array<{ cards: Array<unknown> }>>`
        SELECT "build_private_official_report_cards"(
          ${JSON.stringify(synthetic)}::jsonb, ${1}::integer,
          ${7}::integer, ${20}::integer, ${30}::integer, ${50}::integer,
          ${mode}, ${"HALF_UP"}, ${JSON.stringify(scale.bands)}::jsonb,
          ${scale.decimalPlaces}::integer, ${scale.roundingMode},
          ${scale.bandBasis}) AS "cards"`;
      const simulated = simulatePrivateReportComposition({
        sourcePacketId: source.id, expectedStudentCount: 1,
        students: synthetic as unknown as PrivatePacketStudent[],
        aggregation: { id: aggregation.id, version: aggregation.version,
          categoryMethod: mode, precisionMode: "HALF_UP" },
        scale: { id: scale.id, version: scale.version,
          bands: scale.bands as unknown as Array<{
            code: string; remark: string; minBps: number; maxBps: number }>,
          decimalPlaces: scale.decimalPlaces as 0 | 1 | 2,
          roundingMode: scale.roundingMode as "HALF_UP" | "FLOOR" | "CEILING",
          bandBasis: scale.bandBasis as "RAW_BPS" | "DISPLAY_ROUNDED_BPS",
        },
      });
      expect(pg[0]?.cards).toMatchObject(simulated.students.map(item => ({
        ...item, reportStatus: "INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED",
      })));
    }
    // A missing JSON status previously made SQL "<>" evaluate to NULL;
    // the forward-only composer migration must reject all such variants.
    for (const statusVariant of [undefined, null, "", "PUBLISHED"]) {
      const malformed = [{ ...synthetic[0], reportStatus: statusVariant }];
      await expect(prisma.$queryRaw`
        SELECT "build_private_official_report_cards"(
          ${JSON.stringify(malformed)}::jsonb, ${1}::integer,
          ${7}::integer, ${20}::integer, ${30}::integer, ${50}::integer,
          ${"POOLED_CATEGORY_POINTS"}, ${"HALF_UP"},
          ${JSON.stringify(scale.bands)}::jsonb,
          ${scale.decimalPlaces}::integer,
          ${scale.roundingMode}, ${scale.bandBasis})`).rejects.toThrow();
    }
    await expect(prisma.$queryRaw`
      SELECT "build_private_official_report_cards"(
        ${"[]"}::jsonb, ${null}::integer,
        ${7}::integer, ${20}::integer, ${30}::integer, ${50}::integer,
        ${"POOLED_CATEGORY_POINTS"}, ${"HALF_UP"},
        ${JSON.stringify(scale.bands)}::jsonb, ${scale.decimalPlaces}::integer,
        ${scale.roundingMode}, ${scale.bandBasis})`).rejects.toThrow();
    await expect(prisma.$queryRaw`
      SELECT "round_report_fraction"(${1}::numeric, ${0}::numeric,
        ${"HALF_UP"})`).rejects.toThrow();
    await expect(prisma.$queryRaw`
      SELECT "round_report_fraction"(${1}::numeric, ${3}::numeric,
        ${null}::text)`).rejects.toThrow();
    const bogus = [{
      studentId: pupilId, reportStatus: "INTERNAL_SOURCE_ONLY_NOT_RELEASED",
      adoptedWeightVersion: 3, quizWeight: 50, testWeight: 50,
      examWeight: 0, cbt: [], manual: [],
    }];
    await expect(prisma.$queryRaw`SELECT "build_private_official_report_cards"(
      ${JSON.stringify(bogus)}::jsonb, ${1}::integer,
      ${3}::integer, ${50}::integer, ${50}::integer, ${0}::integer,
      ${"POOLED_CATEGORY_POINTS"}, ${"HALF_UP"},
      ${JSON.stringify(scale.bands)}::jsonb, ${scale.decimalPlaces}::integer,
      ${scale.roundingMode}, ${scale.bandBasis})`).rejects.toThrow();
  });

  it("adopts immutable future report visibility intent but never grants pupils or guardians access", async () => {
    const adopt = (actor: string, body: unknown, targetSchool = schoolA) =>
      VISIBILITY_POLICY_POST(req(actor, targetSchool, "POST", body), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const history = (actor: string, targetSchool = schoolA) =>
      VISIBILITY_POLICY_GET(req(actor, targetSchool, "GET"), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const mode = {
      recipientMode: "ASSESSMENT_ONLY",
      reason: "Synthetic initial school report visibility choice",
    };
    for (const actor of ["teacher", "student", "head", "principal", "admin", "other"]) {
      expect((await adopt(actor, mode)).status).toBe(404);
      expect((await history(actor)).status).toBe(404);
    }
    expect((await adopt("super", mode, schoolB)).status).toBe(404);
    expect((await history("super", schoolB)).status).toBe(404);
    for (const forged of [
      { ...mode, version: 7 },
      { ...mode, actorUserId: users.super },
      { ...mode, actorMembershipId: members.super },
      { ...mode, studentId: pupilId },
      { ...mode, release: true },
      { ...mode, rawPercentBps: 7200 },
      { ...mode, recipientMode: "ALL_PUBLIC" },
      { ...mode, reason: "x" },
    ]) {
      expect((await adopt("super", forged)).status).toBe(400);
    }
    const before = await prisma.privateOfficialReportComposition.count({
      where: { schoolId: schoolA },
    });
    const first = await adopt("super", mode);
    expect(first.status).toBe(201);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    const one = (await first.json()).policy;
    expect(one).toMatchObject({ version: 1, recipientMode: "ASSESSMENT_ONLY" });
    expect((await adopt("super", mode)).status).toBe(409);
    for (const recipientMode of [
      "GUARDIAN_AFTER_RELEASE",
      "STUDENT_AFTER_RELEASE",
      "GUARDIAN_AND_STUDENT_AFTER_RELEASE",
    ]) {
      const accepted = await adopt("super", {
        recipientMode,
        reason: "Synthetic future visibility configuration without publication",
      });
      expect(accepted.status).toBe(201);
    }
    const current = await history("super");
    expect(current.status).toBe(200);
    expect(current.headers.get("cache-control")).toBe("private, no-store");
    const json = await current.json();
    expect(json.status).toBe("CONFIGURATION_ONLY_NO_REPORT_RECIPIENT_ACCESS");
    expect(json.policies.map((p: { version: number }) => p.version))
      .toEqual([4, 3, 2, 1]);
    const metadata = JSON.stringify(json);
    expect(metadata).not.toContain(pupilId);
    expect(metadata).not.toContain("composedStudentCards");
    expect(metadata).not.toContain("rawPercentBps");
    expect(metadata).not.toContain("studentSourceCards");
    await expect(prisma.reportVisibilityPolicyRevision.update({
      where: { id: one.id }, data: { reason: "Forged change to recorded audience" },
    })).rejects.toThrow();
    await expect(prisma.reportVisibilityPolicyRevision.delete({
      where: { id: one.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "ReportVisibilityPolicyRevision"`)
      .rejects.toThrow();
    expect(await prisma.privateOfficialReportComposition.count({
      where: { schoolId: schoolA },
    })).toBe(before);
    await prisma.membership.update({
      where: { id: members.super }, data: { isActive: false },
    });
    try {
      expect((await adopt("super", {
        recipientMode: "ASSESSMENT_ONLY",
        reason: "Synthetic refusal while owner membership is revoked",
      })).status).toBe(404);
      expect((await history("super")).status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: members.super }, data: { isActive: true },
      });
    }
  });

  it("records private report release readiness without publishing or granting any recipient", async () => {
    const record = (actor: string, input: unknown, targetSchool = schoolA) =>
      RELEASE_PREFLIGHT_POST(req(actor, targetSchool, "POST", input), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const history = (actor: string, targetSchool = schoolA) =>
      RELEASE_PREFLIGHT_GET(req(actor, targetSchool, "GET"), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const composition = await prisma.privateOfficialReportComposition.findFirstOrThrow({
      where: { schoolId: schoolA }, orderBy: { composedAt: "desc" },
    });
    const currentVisibility = await prisma.reportVisibilityPolicyRevision.findFirstOrThrow({
      where: { schoolId: schoolA }, orderBy: { version: "desc" },
    });
    expect(currentVisibility.recipientMode).not.toBe("ASSESSMENT_ONLY");
    const payload = {
      compositionId: composition.id,
      visibilityPolicyId: currentVisibility.id,
      reason: "Synthetic private release audit of school academic readiness",
    };
    for (const actor of ["teacher", "student", "head", "principal", "admin", "other"]) {
      expect((await record(actor, payload)).status).toBe(404);
      expect((await history(actor)).status).toBe(404);
    }
    expect((await record("super", payload, schoolB)).status).toBe(404);
    expect((await history("super", schoolB)).status).toBe(404);
    for (const forged of [
      { ...payload, actorUserId: users.super },
      { ...payload, studentId: pupilId },
      { ...payload, isPublished: true },
      { ...payload, recipientMode: "GUARDIAN_AFTER_RELEASE" },
      { ...payload, gradePercent: 100 },
      { ...payload, reportStatus: "PUBLISHED" },
      { ...payload, reason: "x" },
    ]) expect((await record("super", forged)).status).toBe(400);

    const olderVisibility = await prisma.reportVisibilityPolicyRevision.findFirst({
      where: { schoolId: schoolA, version: { lt: currentVisibility.version } },
      orderBy: { version: "asc" },
    });
    if (olderVisibility) {
      expect((await record("super", {
        ...payload, visibilityPolicyId: olderVisibility.id,
      })).status).toBe(409);
    }
    const reviewerScope = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, type: "SECTION", scopeId: sectionId },
    });
    await prisma.scopeGrant.update({
      where: { id: reviewerScope.id }, data: { verified: false },
    });
    try {
      expect((await record("super", payload)).status).toBe(409);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: reviewerScope.id }, data: { verified: true },
      });
    }

    const result = await record("super", payload);
    expect(result.status).toBe(201);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    const response = await result.json();
    expect(response.status).toBe("INTERNAL_PREFLIGHT_ONLY_NOT_AUTHORIZED_OR_RELEASED");
    expect(response.preflight).toMatchObject({
      compositionId: composition.id,
      visibilityPolicyId: currentVisibility.id,
      visibilityPolicyVersion: currentVisibility.version,
      recipientMode: currentVisibility.recipientMode,
      evidenceId: composition.evidenceId,
      sourcePacketId: composition.sourcePacketId,
      finalDecisionId: composition.finalDecisionId,
      studentCount: composition.studentCount,
      status: "INTERNAL_RELEASE_PREFLIGHT_ONLY_NOT_AUTHORIZATION",
    });
    expect((await record("super", payload)).status).toBe(409);
    const saved = await prisma.resultReleasePreflightAttestation.findFirstOrThrow({
      where: { schoolId: schoolA, compositionId: composition.id },
    });
    expect(saved.status).toBe("INTERNAL_RELEASE_PREFLIGHT_ONLY_NOT_AUTHORIZATION");
    const ownerHistory = await history("super");
    expect(ownerHistory.status).toBe(200);
    expect(ownerHistory.headers.get("cache-control")).toBe("private, no-store");
    const metadata = JSON.stringify(await ownerHistory.json());
    for (const secret of [
      pupilId, "composedStudentCards", "studentSourceCards", "rawPercentBps",
      "earnedPoints", "effectivePoints", "gradeCode",
    ]) expect(metadata).not.toContain(secret);
    await expect(prisma.resultReleasePreflightAttestation.update({
      where: { id: saved.id }, data: { status: "PUBLISHED" },
    })).rejects.toThrow();
    await expect(prisma.resultReleasePreflightAttestation.delete({
      where: { id: saved.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "ResultReleasePreflightAttestation"`)
      .rejects.toThrow();
    await prisma.membership.update({
      where: { id: members.super }, data: { isActive: false },
    });
    try {
      expect((await record("super", payload)).status).toBe(404);
      expect((await history("super")).status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: members.super }, data: { isActive: true },
      });
    }
    expect(await prisma.privateOfficialReportComposition.count({
      where: { schoolId: schoolA },
    })).toBeGreaterThan(0);
  });

  it("records verified guardian evidence, revokes immediately, and never authorizes report reading", async () => {
    const record = (actor: string, input: unknown, target = schoolA) =>
      GUARDIAN_EVENTS_POST(req(actor, target, "POST", input), {
        params: Promise.resolve({ schoolId: target }),
      });
    const history = (actor: string, target = schoolA) =>
      GUARDIAN_EVENTS_GET(req(actor, target, "GET"), {
        params: Promise.resolve({ schoolId: target }),
      });
    const inspect = (actor: string, input: unknown, target = schoolA) =>
      GUARDIAN_RELATIONSHIP_INSPECT_POST(req(actor, target, "POST", input), {
        params: Promise.resolve({ schoolId: target }),
      });
    const composition = await prisma.privateOfficialReportComposition.findFirstOrThrow({
      where: { schoolId: schoolA }, orderBy: { composedAt: "desc" },
    });
    const verified = {
      action: "VERIFY", studentId: pupilId,
      guardianMembershipId: members.parent,
      relationshipEvidenceReviewed: true,
      reason: "School verified exact parent pupil relationship evidence",
    };
    const query = {
      compositionId: composition.id, studentId: pupilId,
      recipientMembershipId: members.parent,
    };
    for (const actor of ["teacher", "student", "head", "principal", "admin", "parent", "other"]) {
      expect((await record(actor, verified)).status).toBe(404);
      expect((await history(actor)).status).toBe(404);
      expect((await inspect(actor, query)).status).toBe(404);
    }
    expect((await record("super", verified, schoolB)).status).toBe(404);
    expect((await history("super", schoolB)).status).toBe(404);
    expect((await inspect("super", query, schoolB)).status).toBe(404);
    for (const forged of [
      { ...verified, relationshipEvidenceReviewed: false },
      { ...verified, actorMembershipId: members.super },
      { ...verified, actorUserId: users.super },
      { ...verified, action: "GRANT_REPORT_ACCESS" },
      { ...verified, rawPercentBps: 10000 },
      { ...verified, recipientMode: "GUARDIAN_AFTER_RELEASE" },
      { ...verified, isPublished: true },
    ]) expect((await record("super", forged)).status).toBe(400);

    await prisma.user.update({
      where: { id: users.parent }, data: { emailVerified: false },
    });
    expect((await record("super", verified)).status).toBe(409);
    await prisma.user.update({
      where: { id: users.parent }, data: { emailVerified: true },
    });
    await prisma.user.update({
      where: { id: users.student }, data: { emailVerified: true },
    });
    const noProof = await inspect("super", query);
    expect(noProof.status).toBe(200);
    expect((await noProof.json()).status).toBe("NO_VERIFIED_RELATIONSHIP_OR_POLICY");
    expect((await record("super", {
      ...verified, guardianMembershipId: members.teacher,
    })).status).toBe(409);
    const accepted = await record("super", verified);
    expect(accepted.status).toBe(201);
    expect(accepted.headers.get("cache-control")).toBe("private, no-store");
    const first = (await accepted.json()).event;
    expect(first).toMatchObject({
      studentId: pupilId, guardianMembershipId: members.parent,
      action: "VERIFY", ordinal: 1, evidenceReviewed: true,
    });
    expect((await record("super", verified)).status).toBe(409);
    const related = await inspect("super", query);
    expect(related.status).toBe(200);
    const privateStatus = await related.json();
    expect(privateStatus).toMatchObject({
      status: "RELATIONSHIP_VERIFIED_NOT_RELEASED",
      authorizedForReports: false,
    });
    expect(JSON.stringify(privateStatus)).not.toContain("rawPercentBps");
    expect(JSON.stringify(privateStatus)).not.toContain("composedStudentCards");

    await prisma.studentEnrollment.update({
      where: { id: enrollmentId }, data: { status: "ENDED" },
    });
    try {
      expect((await (await inspect("super", query)).json()).status)
        .toBe("NO_VERIFIED_RELATIONSHIP_OR_POLICY");
    } finally {
      await prisma.studentEnrollment.update({
        where: { id: enrollmentId }, data: { status: "ACTIVE" },
      });
    }

    await prisma.membership.update({
      where: { id: members.parent }, data: { isActive: false },
    });
    try {
      expect((await (await inspect("super", query)).json()).status)
        .toBe("NO_VERIFIED_RELATIONSHIP_OR_POLICY");
      expect((await record("super", verified)).status).toBe(409);
    } finally {
      await prisma.membership.update({
        where: { id: members.parent }, data: { isActive: true },
      });
    }
    // A guardian whose PARENT role was removed must still be revocable
    // for a complete historical audit, although diagnostics already deny it.
    await prisma.membership.update({
      where: { id: members.parent }, data: { role: "TEACHER" },
    });
    let revokedStatus = 0;
    try {
      expect((await (await inspect("super", query)).json()).status)
        .toBe("NO_VERIFIED_RELATIONSHIP_OR_POLICY");
      revokedStatus = (await record("super", {
        action: "REVOKE", studentId: pupilId,
        guardianMembershipId: members.parent,
        reason: "School guardian evidence authorization withdrawn",
      })).status;
    } finally {
      await prisma.membership.update({
        where: { id: members.parent }, data: { role: "PARENT" },
      });
    }
    expect(revokedStatus).toBe(201);
    const newest = await prisma.guardianStudentRelationshipEvent.findFirstOrThrow({
      where: { schoolId: schoolA, studentId: pupilId, guardianMembershipId: members.parent },
      orderBy: { ordinal: "desc" },
    });
    expect(newest).toMatchObject({
      action: "REVOKE", ordinal: 2, evidenceReviewed: false,
    });
    expect((await (await inspect("super", query)).json()).status)
      .toBe("NO_VERIFIED_RELATIONSHIP_OR_POLICY");
    expect((await record("super", {
      action: "REVOKE", studentId: pupilId,
      guardianMembershipId: members.parent, reason: "Duplicate revocation",
    })).status).toBe(409);
    const restored = await record("super", {
      ...verified, reason: "School reviewed renewed parent relationship evidence",
    });
    expect(restored.status).toBe(201);
    expect((await restored.json()).event.ordinal).toBe(3);
    expect((await (await inspect("super", query)).json()).authorizedForReports)
      .toBe(false);
    const events = await history("super");
    expect(events.status).toBe(200);
    expect(events.headers.get("cache-control")).toBe("private, no-store");
    const metadata = JSON.stringify(await events.json());
    for (const secret of [
      "composedStudentCards", "studentSourceCards", "rawPercentBps",
      "earnedPoints", "effectivePoints", "gradeCode",
    ]) expect(metadata).not.toContain(secret);
    await expect(prisma.guardianStudentRelationshipEvent.update({
      where: { id: first.id }, data: { reason: "Forged correction" },
    })).rejects.toThrow();
    await expect(prisma.guardianStudentRelationshipEvent.delete({
      where: { id: first.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "GuardianStudentRelationshipEvent"`)
      .rejects.toThrow();

    const link = await prisma.studentAccountLink.findFirst({
      where: { schoolId: schoolA, studentId: pupilId },
    });
    if (!link) {
      await prisma.studentAccountLink.create({
        data: {
          schoolId: schoolA, studentId: pupilId,
          studentMembershipId: members.student,
          attestedByMembershipId: members.super,
          attestedByUserId: users.super,
          attestationReason: "Synthetic exact account-to-pupil school attestation",
        },
      });
    }
    const studentStatus = await inspect("super", {
      ...query, recipientMembershipId: members.student,
    });
    expect(studentStatus.status).toBe(200);
    expect((await studentStatus.json()).authorizedForReports).toBe(false);
    await prisma.membership.update({
      where: { id: members.super }, data: { isActive: false },
    });
    try {
      expect((await record("super", verified)).status).toBe(404);
      expect((await history("super")).status).toBe(404);
      expect((await inspect("super", query)).status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: members.super }, data: { isActive: true },
      });
    }
  });

  it("freezes only private recipient relationship eligibility; denies forged grants and revoked proofs", async () => {
    const record = (actor: string, value: unknown, target = schoolA) =>
      RECIPIENT_ELIGIBILITY_POST(req(actor, target, "POST", value), {
        params: Promise.resolve({ schoolId: target }),
      });
    const history = (actor: string, target = schoolA) =>
      RECIPIENT_ELIGIBILITY_GET(req(actor, target, "GET"), {
        params: Promise.resolve({ schoolId: target }),
      });
    const composition = await prisma.privateOfficialReportComposition.findFirstOrThrow({
      where: { schoolId: schoolA }, orderBy: { composedAt: "desc" },
    });
    const studentRequest = {
      compositionId: composition.id,
      studentId: pupilId,
      recipientMembershipId: members.student,
      reason: "Synthetic review of existing verified student account link",
    };
    const parentRequest = {
      ...studentRequest,
      recipientMembershipId: members.parent,
      reason: "Synthetic review of current guardian event and private report",
    };
    for (const actor of ["teacher", "student", "parent", "head", "principal", "admin", "other"]) {
      expect((await record(actor, studentRequest)).status).toBe(404);
      expect((await history(actor)).status).toBe(404);
    }
    expect((await record("super", studentRequest, schoolB)).status).toBe(404);
    expect((await history("super", schoolB)).status).toBe(404);
    for (const forged of [
      { ...studentRequest, recipientRole: "PARENT" },
      { ...studentRequest, visibilityPolicyId: "wrong" },
      { ...studentRequest, preflightId: "forged" },
      { ...studentRequest, status: "PUBLISHED" },
      { ...studentRequest, accessGranted: true },
      { ...studentRequest, rawPercentBps: 10000 },
      { ...studentRequest, actorUserId: users.super },
      { ...studentRequest, reason: "x" },
    ]) expect((await record("super", forged)).status).toBe(400);
    expect((await record("super", {
      ...studentRequest, recipientMembershipId: members.teacher,
    })).status).toBe(409);
    const studentResult = await record("super", studentRequest);
    expect(studentResult.status).toBe(201);
    expect(studentResult.headers.get("cache-control")).toBe("private, no-store");
    const studentEvidence = (await studentResult.json()).evidence;
    expect(studentEvidence).toMatchObject({
      compositionId: composition.id,
      recipientRole: "STUDENT",
      status: "INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS",
    });
    expect(JSON.stringify(studentEvidence)).not.toContain(pupilId);
    expect(JSON.stringify(studentEvidence)).not.toContain(members.student);
    expect((await record("super", studentRequest)).status).toBe(409);

    const parentResult = await record("super", parentRequest);
    expect(parentResult.status).toBe(201);
    expect((await parentResult.json()).evidence.recipientRole).toBe("PARENT");
    const parentProof = await prisma.resultRecipientEligibilityEvidence.findFirstOrThrow({
      where: {
        schoolId: schoolA, compositionId: composition.id,
        recipientMembershipId: members.parent,
      },
    });
    const latestGuardianEvent = await prisma.guardianStudentRelationshipEvent.findFirstOrThrow({
      where: { schoolId: schoolA, guardianMembershipId: members.parent, studentId: pupilId },
      orderBy: { ordinal: "desc" },
    });
    expect(parentProof.relationshipProofId).toBe(latestGuardianEvent.id);
    expect(parentProof.status).toBe("INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS");
    const metaResponse = await history("super");
    expect(metaResponse.status).toBe(200);
    expect(metaResponse.headers.get("cache-control")).toBe("private, no-store");
    const safe = JSON.stringify(await metaResponse.json());
    for (const secret of [
      pupilId, members.student, members.parent, "relationshipProofId",
      "composedStudentCards", "studentSourceCards", "rawPercentBps",
      "earnedPoints", "gradeCode",
    ]) expect(safe).not.toContain(secret);
    await expect(prisma.resultRecipientEligibilityEvidence.update({
      where: { id: parentProof.id }, data: { status: "PUBLISHED" },
    })).rejects.toThrow();
    await expect(prisma.resultRecipientEligibilityEvidence.delete({
      where: { id: parentProof.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "ResultRecipientEligibilityEvidence"`)
      .rejects.toThrow();

    const revokedLink = await prisma.studentAccountLink.findFirstOrThrow({
      where: { schoolId: schoolA, studentId: pupilId },
    });
    await prisma.studentAccountLinkRevocation.create({
      data: {
        schoolId: schoolA, linkId: revokedLink.id,
        actorMembershipId: members.super, actorUserId: users.super,
        reason: "Synthetic account link revoked after eligibility snapshot",
      },
    });
    expect((await record("super", studentRequest)).status).toBe(409);
    await prisma.membership.update({
      where: { id: members.parent }, data: { isActive: false },
    });
    try {
      expect((await record("super", parentRequest)).status).toBe(409);
    } finally {
      await prisma.membership.update({
        where: { id: members.parent }, data: { isActive: true },
      });
    }
    await prisma.membership.update({
      where: { id: members.super }, data: { isActive: false },
    });
    try {
      expect((await record("super", parentRequest)).status).toBe(404);
      expect((await history("super")).status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: members.super }, data: { isActive: true },
      });
    }
    expect(parentProof.status).toBe("INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS");
  });

  it("privately previews exactly one approved pupil grade for current owner with immutable access audit", async () => {
    const preview = (actor: string, body: unknown, targetSchool = schoolA) =>
      OWNER_PRIVATE_GRADE_PREVIEW(req(actor, targetSchool, "POST", body), {
        params: Promise.resolve({ schoolId: targetSchool }),
      });
    const composition = await prisma.privateOfficialReportComposition.findFirstOrThrow({
      where: { schoolId: schoolA }, orderBy: { composedAt: "desc" },
    });
    const payload = {
      compositionId: composition.id,
      studentId: pupilId,
      reason: "Audit synthetic head-office private grade preview review",
    };
    for (const actor of [
      "teacher", "student", "parent", "head", "principal", "admin", "other",
    ]) {
      expect((await preview(actor, payload)).status).toBe(404);
    }
    expect((await preview("super", payload, schoolB)).status).toBe(404);
    for (const forged of [
      { ...payload, studentId: "wrong-school-pupil" },
    ]) expect((await preview("super", forged)).status).toBe(409);
    for (const forged of [
      { ...payload, recipientMembershipId: members.parent },
      { ...payload, release: true },
      { ...payload, status: "PUBLISHED" },
      { ...payload, actorUserId: users.super },
      { ...payload, gradeCode: "A" },
      { ...payload, rawPercentBps: 10000 },
      { ...payload, reason: "x" },
    ]) expect((await preview("super", forged)).status).toBe(400);
    // The route rejects cross-origin browser requests independent of cookies.
    req("super", schoolA, "POST", payload);
    const crossOrigin = new Request(
      `http://localhost/api/schools/${schoolA}/private-owner-grade-previews`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify(payload),
      },
    );
    expect((await OWNER_PRIVATE_GRADE_PREVIEW(crossOrigin, {
      params: Promise.resolve({ schoolId: schoolA }),
    })).status).toBe(400);
    const before = await prisma.resultPrivateGradePreviewAudit.count({
      where: { schoolId: schoolA, compositionId: composition.id },
    });
    const granted = await preview("super", payload);
    expect(granted.status).toBe(200);
    expect(granted.headers.get("cache-control")).toBe("private, no-store");
    const body = await granted.json();
    expect(body.preview).toMatchObject({
      status: "PRIVATE_OWNER_PREVIEW_NOT_RELEASED",
      evidenceRevision: composition.evidenceRevision,
      gradeScaleVersion: composition.gradeScaleVersion,
      aggregationRuleVersion: composition.aggregationRuleVersion,
    });
    expect(typeof body.preview.student.givenName).toBe("string");
    expect(typeof body.preview.student.admissionNumber).toBe("string");
    expect(typeof body.preview.displayPercent).toBe("string");
    expect(typeof body.preview.gradeCode).toBe("string");
    expect(body.preview.academic).toMatchObject({
      session: expect.any(String), term: expect.any(String),
      class: expect.any(String), subject: expect.any(String),
    });
    const safe = JSON.stringify(body);
    for (const forbidden of [
      '"studentId"', "recipientMembershipId", "sourcePacketId",
      "correctIndex", "answerEvents", "composedStudentCards",
      "studentSourceCards", "draftId", "markId", "effectivePoints",
      "maxPoints", "originalPoints",
    ]) expect(safe).not.toContain(forbidden);
    expect(body.audit).toMatchObject({
      evidenceRevision: composition.evidenceRevision,
      status: "INTERNAL_OWNER_PREVIEW_NOT_RELEASED",
    });
    expect(await prisma.resultPrivateGradePreviewAudit.count({
      where: { schoolId: schoolA, compositionId: composition.id },
    })).toBe(before + 1);
    // Direct SQL calls must create their own audit; there is no unlogged
    // function that can return an approved pupil's grade.
    const direct = await prisma.$queryRaw<Array<{
      result: { preview: { status: string }; audit: { id: string; status: string } };
    }>>`
      SELECT "read_private_owner_one_pupil_grade_preview"(
        ${schoolA},${composition.id},${pupilId},
        ${members.super},${users.super},${randomUUID()},
        ${"Direct synthetic owner preview audit regression"}
      ) AS "result"`;
    expect(direct[0]?.result.preview.status).toBe("PRIVATE_OWNER_PREVIEW_NOT_RELEASED");
    expect(direct[0]?.result.audit.status).toBe("INTERNAL_OWNER_PREVIEW_NOT_RELEASED");
    expect(await prisma.resultPrivateGradePreviewAudit.count({
      where: { schoolId: schoolA, compositionId: composition.id },
    })).toBe(before + 2);
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "read_private_owner_one_pupil_grade_preview"(
            ${schoolA},${composition.id},${pupilId},
            ${members.super},${users.super},${randomUUID()},
            ${"Rollback atomic SQL owner preview audit"}
          )`;
        throw new Error("ROLLBACK_OWNER_PREVIEW_AND_AUDIT");
      }),
    ).rejects.toThrow("ROLLBACK_OWNER_PREVIEW_AND_AUDIT");
    expect(await prisma.resultPrivateGradePreviewAudit.count({
      where: { schoolId: schoolA, compositionId: composition.id },
    })).toBe(before + 2);
    const audit = await prisma.resultPrivateGradePreviewAudit.findUniqueOrThrow({
      where: { id: body.audit.id },
    });
    expect(audit).toMatchObject({
      schoolId: schoolA, compositionId: composition.id,
      studentId: pupilId, actorMembershipId: members.super,
      actorUserId: users.super,
      status: "INTERNAL_OWNER_PREVIEW_NOT_RELEASED",
    });
    await expect(prisma.resultPrivateGradePreviewAudit.update({
      where: { id: audit.id }, data: { status: "PUBLISHED" },
    })).rejects.toThrow();
    await expect(prisma.resultPrivateGradePreviewAudit.delete({
      where: { id: audit.id },
    })).rejects.toThrow();
    await expect(prisma.$executeRaw`TRUNCATE "ResultPrivateGradePreviewAudit"`)
      .rejects.toThrow();

    const reviewer = await prisma.scopeGrant.findFirstOrThrow({
      where: { membershipId: members.head, type: "SECTION", scopeId: sectionId },
    });
    await prisma.scopeGrant.update({
      where: { id: reviewer.id }, data: { verified: false },
    });
    try {
      expect((await preview("super", payload)).status).toBe(409);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: reviewer.id }, data: { verified: true },
      });
    }
    await prisma.studentEnrollment.update({
      where: { id: enrollmentId }, data: { status: "ENDED" },
    });
    try {
      expect((await preview("super", payload)).status).toBe(409);
    } finally {
      await prisma.studentEnrollment.update({
        where: { id: enrollmentId }, data: { status: "ACTIVE" },
      });
    }
    expect(await prisma.resultPrivateGradePreviewAudit.count({
      where: { schoolId: schoolA, compositionId: composition.id },
    })).toBe(before + 2);

    await prisma.membership.update({
      where: { id: members.super }, data: { isActive: false },
    });
    try {
      expect((await preview("super", payload)).status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: members.super }, data: { isActive: true },
      });
    }
    expect((await prisma.privateOfficialReportComposition.findUniqueOrThrow({
      where: { id: composition.id },
    })).status).toBe("INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED");
  });

  it("privately previews assigned term subjects atomically and rolls back all audit reads on missing evidence", async () => {
    const previewTerm = (actor: string, data: unknown, target = schoolA) =>
      PRIVATE_TERM_GRADE_PREVIEW_POST(req(actor, target, "POST", data), {
        params: Promise.resolve({ schoolId: target }),
      });
    const payload = {
      sessionId, termId, classId, studentId: pupilId,
      reason: "Synthetic confidential complete assigned-subject term review",
    };
    for (const actor of [
      "teacher", "student", "parent", "head", "principal", "admin", "other",
    ]) {
      expect((await previewTerm(actor, payload)).status).toBe(404);
    }
    expect((await previewTerm("super", payload, schoolB)).status).toBe(404);
    for (const forged of [
      { ...payload, status: "PUBLISHED" },
      { ...payload, grades: [{ subject: "Fake", gradeCode: "A" }] },
      { ...payload, recipientMembershipId: members.parent },
      { ...payload, release: true },
      { ...payload, actorUserId: users.super },
      { ...payload, reason: "x" },
    ]) {
      expect((await previewTerm("super", forged)).status).toBe(400);
    }
    req("super", schoolA, "POST", payload);
    const crossOrigin = new Request(
      `http://localhost/api/schools/${schoolA}/private-term-grade-previews`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://foreign.example",
        },
        body: JSON.stringify(payload),
      },
    );
    expect((await PRIVATE_TERM_GRADE_PREVIEW_POST(crossOrigin, {
      params: Promise.resolve({ schoolId: schoolA }),
    })).status).toBe(400);
    const before = await prisma.resultPrivateGradePreviewAudit.count({
      where: { schoolId: schoolA },
    });
    const response = await previewTerm("super", payload);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const result = await response.json();
    expect(result).toMatchObject({
      status: "PRIVATE_TERM_OWNER_PREVIEW_NOT_RELEASED",
      coverage: "ACTIVE_SESSION_ASSIGNMENTS_ONLY_NOT_OFFICIAL_COMPLETENESS",
      subjectCount: 1,
      auditedSubjectCount: 1,
      subjects: [{
        subject: expect.any(String),
        displayPercent: expect.any(String),
        gradeCode: expect.any(String),
        remark: expect.any(String),
      }],
    });
    expect(result.student).toMatchObject({
      givenName: expect.any(String),
      familyName: expect.any(String),
      admissionNumber: expect.any(String),
    });
    expect(JSON.stringify(result)).not.toContain('"studentId"');
    expect(JSON.stringify(result)).not.toContain("composedStudentCards");
    expect(JSON.stringify(result)).not.toContain("studentSourceCards");
    expect(JSON.stringify(result)).not.toContain("answerEvents");
    expect(JSON.stringify(result)).not.toContain("correctIndex");
    expect(JSON.stringify(result)).not.toContain("recipientMembershipId");
    expect(await prisma.resultPrivateGradePreviewAudit.count({
      where: { schoolId: schoolA },
    })).toBe(before + 1);

    // Introduce a second currently assigned subject with NO approved report.
    // Its absence must fail the entire term, including rollback of the
    // already-audited first subject's SQL read inside the same transaction.
    const extraSubjectId = `asm-ungraded-subject-${randomUUID()}`;
    const extraAssignmentId = `asm-ungraded-assignment-${randomUUID()}`;
    await prisma.subject.create({
      data: {
        id: extraSubjectId, schoolId: schoolA,
        name: "Zzz Synthetic Unapproved Term Subject",
        isActive: true,
      },
    });
    try {
      await prisma.teacherClassSubjectAssignment.create({
        data: {
          id: extraAssignmentId, schoolId: schoolA,
          membershipId: members.teacher,
          classId, sessionId,
          subjectId: extraSubjectId, status: "ACTIVE",
        },
      });
      try {
        expect((await previewTerm("super", payload)).status).toBe(409);
        expect(await prisma.resultPrivateGradePreviewAudit.count({
          where: { schoolId: schoolA },
        })).toBe(before + 1);
      } finally {
        await prisma.teacherClassSubjectAssignment.delete({
          where: { id: extraAssignmentId },
        });
      }
    } finally {
      await prisma.subject.delete({ where: { id: extraSubjectId } });
    }

    await prisma.studentEnrollment.update({
      where: { id: enrollmentId }, data: { status: "ENDED" },
    });
    try {
      expect((await previewTerm("super", payload)).status).toBe(404);
    } finally {
      await prisma.studentEnrollment.update({
        where: { id: enrollmentId }, data: { status: "ACTIVE" },
      });
    }
    await prisma.membership.update({
      where: { id: members.super }, data: { isActive: false },
    });
    try {
      expect((await previewTerm("super", payload)).status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: members.super }, data: { isActive: true },
      });
    }
    expect((await prisma.privateOfficialReportComposition.findFirstOrThrow({
      where: { schoolId: schoolA },
    })).status).toBe("INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED");
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
