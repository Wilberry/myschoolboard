import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({
  headers: async () => ctx.headers,
}));

import { GET as queueRoute } from "@/app/api/schools/[schoolId]/lesson-note-reviews/route";
import { GET as detailRoute } from "@/app/api/schools/[schoolId]/lesson-note-reviews/[noteId]/route";
import { POST as decisionRoute } from "@/app/api/schools/[schoolId]/lesson-note-reviews/[noteId]/decision/route";
import { POST as releaseRoute } from "@/app/api/schools/[schoolId]/lesson-releases/[noteId]/decision/route";
import { GET as releaseQueueRoute } from "@/app/api/schools/[schoolId]/lesson-releases/route";
import { POST as linkStudentRoute } from "@/app/api/schools/[schoolId]/student-identity-links/route";
import { GET as studentLessonRoute } from "@/app/api/schools/[schoolId]/released-lessons/route";
import { POST as authorCreate } from "@/app/api/schools/[schoolId]/lesson-notes/route";
import { POST as authorRevise } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/revisions/route";
import { POST as authorSubmit } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/submit/route";
import { GET as authorDetail } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/route";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/db";
import { env } from "@/src/lib/env";

const suffix = randomUUID();
const schoolA = `review-school-a-${suffix}`;
const schoolB = `review-school-b-${suffix}`;
const sectionPrimary = `review-primary-${suffix}`;
const sectionSecondary = `review-secondary-${suffix}`;
const sectionForeign = `review-foreign-${suffix}`;
const classPrimary = `review-class-primary-${suffix}`;
const classSecondary = `review-class-secondary-${suffix}`;
const classUnknown = `review-class-unknown-${suffix}`;
const subject = `review-subject-${suffix}`;
const sessionId = `review-session-${suffix}`;
const termId = `review-term-${suffix}`;
const teacherMember = `review-teacher-member-${suffix}`;
const headMember = `review-head-member-${suffix}`;
const principalMember = `review-principal-member-${suffix}`;
const foreignMember = `review-foreign-member-${suffix}`;
const primaryAssignment = `review-assign-primary-${suffix}`;
const secondaryAssignment = `review-assign-secondary-${suffix}`;
const unknownAssignment = `review-assign-unknown-${suffix}`;
const password = "synthetic-review-password-2026";
const verifiedStudentMember = `review-student-member-${suffix}`;
const verifiedStudentId = `review-student-record-${suffix}`;
const verifiedEnrollmentId = `review-student-enrollment-${suffix}`;
const emails = {
  teacher: `review-teacher-${suffix}@example.test`,
  head: `review-head-${suffix}@example.test`,
  principal: `review-principal-${suffix}@example.test`,
  noGrant: `review-no-grant-${suffix}@example.test`,
  admin: `review-admin-${suffix}@example.test`,
  foreign: `review-foreign-${suffix}@example.test`,
  student: `review-student-${suffix}@example.test`,
};
const users: Record<string, string> = {};
const cookies: Record<string, string> = {};
let primaryNoteId = "";
let secondaryNoteId = "";
let unknownNoteId = "";
let headScopeId = "";

async function login(email: string) {
  const session = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  const cookie = session.headers.getSetCookie()
    .map((value) => value.split(";")[0]).join("; ");
  if (!cookie) throw new Error("Missing synthetic session");
  return cookie;
}

function request(
  person: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
) {
  ctx.headers = new Headers(cookies[person] ? { cookie: cookies[person] } : {});
  return new Request(`http://localhost${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function author(person: string, operation: "create" | "revise" | "submit", noteId: string, body: unknown) {
  const base = `/api/schools/${schoolA}/lesson-notes`;
  if (operation === "create") {
    return authorCreate(request(person, "POST", base, body), {
      params: Promise.resolve({ schoolId: schoolA }),
    });
  }
  const path = operation === "revise"
    ? `${base}/${noteId}/revisions`
    : `${base}/${noteId}/submit`;
  const params = { params: Promise.resolve({ schoolId: schoolA, noteId }) };
  return operation === "revise"
    ? authorRevise(request(person, "POST", path, body), params)
    : authorSubmit(request(person, "POST", path, body), params);
}

async function detailOwn(noteId: string) {
  return authorDetail(
    request("teacher", "GET", `/api/schools/${schoolA}/lesson-notes/${noteId}`),
    { params: Promise.resolve({ schoolId: schoolA, noteId }) },
  );
}

async function queue(person: string, schoolId = schoolA) {
  return queueRoute(
    request(person, "GET", `/api/schools/${schoolId}/lesson-note-reviews`),
    { params: Promise.resolve({ schoolId }) },
  );
}

async function detail(person: string, noteId: string) {
  return detailRoute(
    request(person, "GET", `/api/schools/${schoolA}/lesson-note-reviews/${noteId}`),
    { params: Promise.resolve({ schoolId: schoolA, noteId }) },
  );
}

async function decide(person: string, noteId: string, action: "APPROVE" | "RETURN", expectedRevision = 1) {
  return decisionRoute(
    request(person, "POST", `/api/schools/${schoolA}/lesson-note-reviews/${noteId}/decision`, {
      action, expectedRevision, reason: "Synthetic exact-section review decision",
    }),
    { params: Promise.resolve({ schoolId: schoolA, noteId }) },
  );
}

describe("section-scoped lesson note review and return", () => {
  beforeAll(async () => {
    for (const [key, email] of Object.entries(emails)) {
      const user = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${key}`, password },
      });
      users[key] = user.user.id;
    }
    await prisma.school.createMany({
      data: [
        { id: schoolA, name: "Review A", slug: schoolA },
        { id: schoolB, name: "Review B", slug: schoolB },
      ],
    });
    await prisma.membership.createMany({
      data: [
        { id: teacherMember, userId: users.teacher, schoolId: schoolA, role: "TEACHER" },
        { id: headMember, userId: users.head, schoolId: schoolA, role: "HEAD_OF_SECTION" },
        { id: principalMember, userId: users.principal, schoolId: schoolA, role: "PRINCIPAL" },
        { userId: users.noGrant, schoolId: schoolA, role: "HEAD_OF_SECTION" },
        { userId: users.admin, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        { id: foreignMember, userId: users.foreign, schoolId: schoolB, role: "HEAD_OF_SECTION" },
        { id: verifiedStudentMember, userId: users.student, schoolId: schoolA, role: "STUDENT" },
      ],
    });
    await prisma.schoolSection.createMany({
      data: [
        { id: sectionPrimary, schoolId: schoolA, name: "Primary", stage: "PRIMARY" },
        { id: sectionSecondary, schoolId: schoolA, name: "Secondary", stage: "SECONDARY" },
        { id: sectionForeign, schoolId: schoolB, name: "Foreign Primary", stage: "PRIMARY" },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        { id: classPrimary, schoolId: schoolA, name: "Primary One", sectionId: sectionPrimary },
        { id: classSecondary, schoolId: schoolA, name: "Secondary One", sectionId: sectionSecondary },
        { id: classUnknown, schoolId: schoolA, name: "Unclassified Class" },
      ],
    });
    await prisma.subject.create({
      data: { id: subject, schoolId: schoolA, name: "Mathematics" },
    });
    const startsOn = new Date("2026-09-01T00:00:00.000Z");
    const endsOn = new Date("2027-07-31T00:00:00.000Z");
    await prisma.academicSession.create({
      data: { id: sessionId, schoolId: schoolA, name: "2026/2027", status: "ACTIVE", startsOn, endsOn },
    });
    await prisma.academicTerm.create({
      data: {
        id: termId, schoolId: schoolA, sessionId,
        name: "First Term", position: 1, status: "ACTIVE",
        startsOn, endsOn: new Date("2026-12-18T00:00:00.000Z"),
      },
    });
    await prisma.studentRecord.create({
      data: {
        id: verifiedStudentId, schoolId: schoolA, admissionNumber: `LES-${suffix}`,
        givenName: "Synthetic", familyName: "Learner", status: "ENROLLED",
      },
    });
    await prisma.studentEnrollment.create({
      data: {
        id: verifiedEnrollmentId, schoolId: schoolA,
        studentId: verifiedStudentId, classId: classSecondary, sessionId,
      },
    });
    await prisma.teacherClassSubjectAssignment.createMany({
      data: [
        { id: primaryAssignment, schoolId: schoolA, sessionId,
          membershipId: teacherMember, classId: classPrimary, subjectId: subject },
        { id: secondaryAssignment, schoolId: schoolA, sessionId,
          membershipId: teacherMember, classId: classSecondary, subjectId: subject },
        { id: unknownAssignment, schoolId: schoolA, sessionId,
          membershipId: teacherMember, classId: classUnknown, subjectId: subject },
      ],
    });
    const grant = await prisma.scopeGrant.create({
      data: {
        membershipId: headMember, type: "SECTION",
        scopeId: sectionPrimary, verified: true,
      },
    });
    headScopeId = grant.id;
    await prisma.scopeGrant.createMany({
      data: [
        { membershipId: principalMember, type: "SECTION",
          scopeId: sectionSecondary, verified: true },
        { membershipId: foreignMember, type: "SECTION",
          scopeId: sectionForeign, verified: true },
        { membershipId: headMember, type: "SECTION",
          scopeId: sectionForeign, verified: true },
        { membershipId: principalMember, type: "SECTION",
          scopeId: sectionPrimary, verified: false },
      ],
    });
    for (const [key, email] of Object.entries(emails)) {
      cookies[key] = await login(email);
    }
  });

  afterAll(async () => {
    await prisma.school.deleteMany({ where: { id: { in: [schoolA, schoolB] } } });
    await prisma.session.deleteMany({
      where: { userId: { in: Object.values(users) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: Object.values(users) } },
    });
    await prisma.$disconnect();
  });

  it("conceals queues from anonymous, teacher, admin and unscope reviewers", async () => {
    for (const [person, status] of [
      ["", 401], ["teacher", 404], ["admin", 404], ["noGrant", 404],
      ["foreign", 404],
    ] as const) {
      const response = await queue(person);
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect((await queue("head", schoolB)).status).toBe(404);
    expect((await queue("principal", schoolB)).status).toBe(404);
  });

  it("lists submitted notes only for matching primary/secondary class sections", async () => {
    async function submitted(assignmentId: string, topic: string) {
      const created = await author("teacher", "create", "", {
        termId, assignmentId, topic,
        objectives: "Describe this lesson and its educational objectives",
        content: "Synthetic class-specific lesson text for school review.",
      });
      expect(created.status).toBe(201);
      const id = (await created.json()).note.id;
      expect((await author("teacher", "submit", id, { expectedRevision: 1 })).status)
        .toBe(200);
      return id as string;
    }
    primaryNoteId = await submitted(primaryAssignment, "Primary Fractions");
    secondaryNoteId = await submitted(secondaryAssignment, "Secondary Fractions");
    unknownNoteId = await submitted(unknownAssignment, "Unclassified Fractions");

    const head = await queue("head");
    expect(head.status).toBe(200);
    const headRows = (await head.json()).notes;
    expect(headRows.map((row: { id: string }) => row.id)).toEqual([primaryNoteId]);
    expect(headRows[0].sectionId).toBe(sectionPrimary);
    expect(headRows[0].revisions).toEqual([]);

    const principal = await queue("principal");
    expect(principal.status).toBe(200);
    expect((await principal.json()).notes.map((x: { id: string }) => x.id))
      .toEqual([secondaryNoteId]);

    const ownDetail = await detail("head", primaryNoteId);
    expect(ownDetail.status).toBe(200);
    const record = (await ownDetail.json()).note;
    expect(record.revisions).toHaveLength(1);
    expect(record.revisions[0].content).toContain("Synthetic class-specific");
    for (const [person, id] of [
      ["head", secondaryNoteId], ["principal", primaryNoteId],
      ["head", unknownNoteId], ["principal", unknownNoteId],
    ] as const) {
      expect((await detail(person, id)).status).toBe(404);
      expect((await decide(person, id, "APPROVE")).status).toBe(404);
    }
  });

  it("returns primary notes for revision with an immutable reviewer reason", async () => {
    const returned = await decide("head", primaryNoteId, "RETURN");
    expect(returned.status).toBe(200);
    expect((await returned.json()).note.status).toBe("RETURNED");
    expect((await decide("head", primaryNoteId, "RETURN")).status).toBe(409);
    expect((await detail("head", primaryNoteId)).status).toBe(404);
    const returnedOwn = await detailOwn(primaryNoteId);
    expect(returnedOwn.status).toBe(200);
    const authorNote = (await returnedOwn.json()).note;
    expect(authorNote.events.find((event: { eventType: string }) =>
      event.eventType === "RETURNED",
    )).toMatchObject({
      eventType: "RETURNED",
      revisionNumber: 1,
      reason: "Synthetic exact-section review decision",
    });
    // A returned note cannot simply be resubmitted unchanged.
    expect((await author("teacher", "submit", primaryNoteId, {
      expectedRevision: 1,
    })).status).toBe(409);
    const revised = await author("teacher", "revise", primaryNoteId, {
      expectedRevision: 1,
      topic: "Improved Primary Fractions",
      objectives: "Revised learner objectives for primary fractions",
      content: "New content version preserving the old submission and review.",
    });
    expect(revised.status).toBe(200);
    expect((await revised.json()).note).toMatchObject({
      status: "DRAFT", currentRevision: 2, submittedAt: null,
    });
    expect((await author("teacher", "submit", primaryNoteId, {
      expectedRevision: 2,
    })).status).toBe(200);
    const approved = await decide("head", primaryNoteId, "APPROVE", 2);
    expect(approved.status).toBe(200);
    expect((await approved.json()).note).toMatchObject({
      status: "APPROVED", currentRevision: 2,
    });
    const events = await prisma.lessonNoteEvent.findMany({
      where: { schoolId: schoolA, noteId: primaryNoteId },
    });
    expect(events.map((event) => event.eventType).sort()).toEqual([
      "APPROVED", "CREATED", "RETURNED", "REVISED", "SUBMITTED", "SUBMITTED",
    ]);
    expect(events.find((event) => event.eventType === "APPROVED"))
      .toMatchObject({
        actorMembershipId: headMember,
        revisionNumber: 2,
        reason: "Synthetic exact-section review decision",
      });
    expect((await decide("head", primaryNoteId, "APPROVE", 2)).status)
      .toBe(409);
  });

  it("allows the Principal to approve only the secondary section", async () => {
    const result = await decide("principal", secondaryNoteId, "APPROVE");
    expect(result.status).toBe(200);
    expect((await result.json()).note.status).toBe("APPROVED");
    expect((await queue("principal")).status).toBe(200);
    expect((await (await queue("principal")).json()).notes).toEqual([]);
    expect((await decide("principal", primaryNoteId, "APPROVE", 2)).status)
      .toBe(404);
    expect((await detailOwn(secondaryNoteId)).status).toBe(200);
  });

  it("requires approved revision and exact HM/Principal section for separate release", async () => {
    async function release(actor: string, noteId: string, action: "RELEASE" | "WITHDRAW",
      expectedRevision: number) {
      return releaseRoute(request(actor, "POST",
        `/api/schools/${schoolA}/lesson-releases/${noteId}/decision`, {
          action, expectedRevision, reason: "Synthetic separate approved-content release",
        }), { params: Promise.resolve({ schoolId: schoolA, noteId }) });
    }
    async function releaseQueue(actor: string) {
      return releaseQueueRoute(request(actor, "GET",
        `/api/schools/${schoolA}/lesson-releases`),
        { params: Promise.resolve({ schoolId: schoolA }) });
    }
    expect((await release("teacher", primaryNoteId, "RELEASE", 2)).status).toBe(404);
    expect((await release("principal", primaryNoteId, "RELEASE", 2)).status).toBe(404);
    expect((await release("head", unknownNoteId, "RELEASE", 1)).status).toBe(404);
    expect((await release("head", primaryNoteId, "RELEASE", 1)).status).toBe(409);
    expect((await releaseQueue("teacher")).status).toBe(404);
    const queue = await releaseQueue("head");
    expect(queue.status).toBe(200);
    const rows = (await queue.json()).notes;
    expect(rows.some((note: { id: string }) => note.id === primaryNoteId)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("learner objectives");
    const result = await release("head", primaryNoteId, "RELEASE", 2);
    expect(result.status).toBe(201);
    expect((await result.json()).event.eventType).toBe("RELEASED");
    expect((await release("head", primaryNoteId, "RELEASE", 2)).status).toBe(409);
    expect((await release("head", primaryNoteId, "WITHDRAW", 2)).status).toBe(201);
    expect((await release("head", primaryNoteId, "WITHDRAW", 2)).status).toBe(409);
    const original = await prisma.lessonNote.findUniqueOrThrow({ where: { id: primaryNoteId } });
    expect(original.status).toBe("APPROVED");
    const events = await prisma.lessonReleaseEvent.findMany({
      where: { schoolId: schoolA, noteId: primaryNoteId },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map(e => e.eventType).sort()).toEqual(["RELEASED", "WITHDRAWN"]);
    await expect(prisma.lessonReleaseEvent.update({
      where: { id: events[0].id }, data: { reason: "Unauthorized overwrite" },
    })).rejects.toThrow();
    await expect(prisma.lessonReleaseEvent.delete({
      where: { id: events[0].id },
    })).rejects.toThrow();
  });

  it("releases only to an explicitly linked active student of the exact class and period", async () => {
    async function studentLessons(actor: string, schoolId = schoolA) {
      return studentLessonRoute(request(actor, "GET",
        `/api/schools/${schoolId}/released-lessons`),
        { params: Promise.resolve({ schoolId }) });
    }
    async function studentLink(actor: string, action: "LINK" | "REVOKE", schoolId = schoolA) {
      return linkStudentRoute(request(actor, "POST",
        `/api/schools/${schoolId}/student-identity-links`, {
          membershipId: verifiedStudentMember, studentId: verifiedStudentId,
          action, identityConfirmed: true,
          reason: "Synthetic verified learner identity evidence",
        }), { params: Promise.resolve({ schoolId }) });
    }
    expect((await studentLessons("student")).status).toBe(404);
    expect((await studentLessons("teacher")).status).toBe(404);
    expect((await studentLessons("head")).status).toBe(404);
    expect((await studentLessons("foreign", schoolA)).status).toBe(404);
    expect((await studentLink("teacher", "LINK")).status).toBe(404);
    expect((await studentLink("foreign", "LINK")).status).toBe(404);
    expect((await studentLink("admin", "LINK", schoolB)).status).toBe(404);

    const linked = await studentLink("admin", "LINK");
    expect(linked.status).toBe(201);
    expect((await linked.json()).event.eventType).toBe("LINKED");
    expect((await studentLessons("student")).status).toBe(200);
    expect((await (await studentLessons("student")).json()).lessons).toEqual([]);

    // Approval alone did not publish this SECONDARY note.
    const releaseResponse = await releaseRoute(request("principal", "POST",
      `/api/schools/${schoolA}/lesson-releases/${secondaryNoteId}/decision`, {
        action: "RELEASE", expectedRevision: 1,
        reason: "Synthetic explicit secondary lesson release",
      }), { params: Promise.resolve({ schoolId: schoolA, noteId: secondaryNoteId }) });
    expect(releaseResponse.status).toBe(201);
    const released = await studentLessons("student");
    expect(released.status).toBe(200);
    const lessons = (await released.json()).lessons;
    expect(lessons).toHaveLength(1);
    expect(lessons[0].id).toBe(secondaryNoteId);
    expect(lessons[0].content).toBeTruthy();
    expect(JSON.stringify(lessons)).not.toContain(primaryNoteId);

    const withdrawal = await releaseRoute(request("principal", "POST",
      `/api/schools/${schoolA}/lesson-releases/${secondaryNoteId}/decision`, {
        action: "WITHDRAW", expectedRevision: 1,
        reason: "Synthetic explicit withdrawal of published lesson",
      }), { params: Promise.resolve({ schoolId: schoolA, noteId: secondaryNoteId }) });
    expect(withdrawal.status).toBe(201);
    expect((await (await studentLessons("student")).json()).lessons).toEqual([]);

    await prisma.studentEnrollment.update({
      where: { id: verifiedEnrollmentId }, data: { status: "ENDED", endedAt: new Date() },
    });
    try { expect((await studentLessons("student")).status).toBe(404); }
    finally {
      await prisma.studentEnrollment.update({
        where: { id: verifiedEnrollmentId },
        data: { status: "ACTIVE", endedAt: null },
      });
    }
    expect((await studentLink("admin", "REVOKE")).status).toBe(201);
    expect((await studentLessons("student")).status).toBe(404);
    const identity = await prisma.studentIdentityLinkEvent.findFirstOrThrow({
      where: { membershipId: verifiedStudentMember, sequence: 1 },
    });
    await expect(prisma.studentIdentityLinkEvent.update({
      where: { id: identity.id }, data: { reason: "Attempted forged identity reassignment" },
    })).rejects.toThrow();
    await expect(prisma.studentIdentityLinkEvent.create({
      data: {
        schoolId: schoolA, membershipId: verifiedStudentMember,
        studentId: verifiedStudentId, sequence: 3, eventType: "LINKED",
        reason: "Synthetic forged school administrator identity",
        actorUserId: users.teacher, actorMembershipId: teacherMember,
      },
    })).rejects.toThrow();
  });

  it("reviews a structured term scheme with immutable weekly versions before release", async () => {
    const plan = [
      { week: 1, topic: "Secondary algebra basics",
        objectives: "Introduce algebraic notation", activities: "Use classroom algebra examples" },
      { week: 3, topic: "Linear equations",
        objectives: "Solve basic linear equations", activities: "Practice equations in groups" },
    ];
    const payload = {
      kind: "SCHEME_OF_WORK", termId, assignmentId: secondaryAssignment,
      topic: "Secondary Mathematics Scheme",
      objectives: "Plan the term learning progression",
      content: "Weekly mathematics learning sequence for the full term.",
      weeklyPlan: plan,
    };
    const invalid = await author("teacher", "create", "", {
      ...payload, weeklyPlan: [plan[1], plan[0]],
    });
    expect(invalid.status).toBe(400);
    const created = await author("teacher", "create", "", payload);
    expect(created.status).toBe(201);
    const scheme = (await created.json()).note;
    expect(scheme.kind).toBe("SCHEME_OF_WORK");
    expect((await author("teacher", "create", "", payload)).status).toBe(409);
    const detailResponse = await detailOwn(scheme.id);
    expect(detailResponse.status).toBe(200);
    const ownDetail = (await detailResponse.json()).note;
    expect(ownDetail.revisions[0].weeklyPlan).toEqual(plan);
    await expect(prisma.lessonNoteRevision.create({
      data: {
        schoolId: schoolA, noteId: scheme.id, revisionNumber: 2,
        actorUserId: users.teacher, topic: "Forged scheme",
        objectives: "Invalid direct scheme insert",
        content: "Invalid direct scheme contents",
        weeklyPlan: [{ week: 0, topic: "Invalid", objectives: "Invalid",
          activities: "Invalid" }],
      },
    })).rejects.toThrow();
    expect((await author("teacher", "submit", scheme.id,
      { expectedRevision: 1 })).status).toBe(200);
    const submitted = await detail("principal", scheme.id);
    expect(submitted.status).toBe(200);
    const reviewed = (await submitted.json()).note;
    expect(reviewed.kind).toBe("SCHEME_OF_WORK");
    expect(reviewed.revisions[0].weeklyPlan).toEqual(plan);
    expect((await decide("head", scheme.id, "APPROVE")).status).toBe(404);
    expect((await decide("principal", scheme.id, "RETURN")).status).toBe(200);
    const updatedPlan = [...plan, { week: 4, topic: "Graph interpretation",
      objectives: "Interpret linear graph patterns",
      activities: "Sketch and compare simple graphs" }];
    const revised = await author("teacher", "revise", scheme.id, {
      expectedRevision: 1,
      topic: "Secondary Mathematics Scheme Revised",
      objectives: "Plan updated term learning progression",
      content: "Updated week by week learning sequence for the term.",
      weeklyPlan: updatedPlan,
    });
    expect(revised.status).toBe(200);
    expect((await author("teacher", "submit", scheme.id,
      { expectedRevision: 2 })).status).toBe(200);
    expect((await decide("principal", scheme.id, "APPROVE", 2)).status).toBe(200);
    expect((await releaseRoute(request("principal", "POST",
      `/api/schools/${schoolA}/lesson-releases/${scheme.id}/decision`, {
        action: "RELEASE", expectedRevision: 2,
        reason: "Synthetic approved term scheme release",
      }), { params: Promise.resolve({ schoolId: schoolA, noteId: scheme.id }) })).status).toBe(201);
    expect((await linkStudentRoute(request("admin", "POST",
      `/api/schools/${schoolA}/student-identity-links`, {
        membershipId: verifiedStudentMember, studentId: verifiedStudentId,
        action: "LINK", identityConfirmed: true,
        reason: "Synthetic verified school scheme student identity",
      }), { params: Promise.resolve({ schoolId: schoolA }) })).status).toBe(201);
    const student = await studentLessonRoute(request("student", "GET",
      `/api/schools/${schoolA}/released-lessons`),
      { params: Promise.resolve({ schoolId: schoolA }) });
    expect(student.status).toBe(200);
    const visible = (await student.json()).lessons;
    expect(visible).toHaveLength(1);
    expect(visible[0].kind).toBe("SCHEME_OF_WORK");
    expect(visible[0].weeklyPlan).toEqual(updatedPlan);
    expect(visible[0].revisionNumber).toBe(2);
    expect((await linkStudentRoute(request("admin", "POST",
      `/api/schools/${schoolA}/student-identity-links`, {
        membershipId: verifiedStudentMember, studentId: verifiedStudentId,
        action: "REVOKE", identityConfirmed: true,
        reason: "Synthetic revocation after weekly scheme check",
      }), { params: Promise.resolve({ schoolId: schoolA }) })).status).toBe(201);
  });

  it("revoking verified section grant or section activity removes reviewer authority", async () => {
    await prisma.scopeGrant.update({
      where: { id: headScopeId },
      data: { verified: false },
    });
    try {
      expect((await queue("head")).status).toBe(404);
      expect((await decide("head", primaryNoteId, "APPROVE", 2)).status)
        .toBe(404);
    } finally {
      await prisma.scopeGrant.update({
        where: { id: headScopeId },
        data: { verified: true },
      });
    }
    await prisma.schoolSection.update({
      where: { id: sectionPrimary },
      data: { isActive: false },
    });
    try {
      expect((await queue("head")).status).toBe(404);
    } finally {
      await prisma.schoolSection.update({
        where: { id: sectionPrimary },
        data: { isActive: true },
      });
    }
  });

  it("rejects direct tampering and forged review events at database level", async () => {
    const approval = await prisma.lessonNoteEvent.findFirstOrThrow({
      where: {
        schoolId: schoolA, noteId: primaryNoteId,
        eventType: "APPROVED",
      },
    });
    await expect(prisma.lessonNoteEvent.update({
      where: { id: approval.id },
      data: { reason: "Forcibly altered review justification" },
    })).rejects.toThrow();
    await expect(prisma.lessonNoteEvent.delete({
      where: { id: approval.id },
    })).rejects.toThrow();
    await expect(prisma.lessonNoteEvent.create({
      data: {
        schoolId: schoolA,
        noteId: primaryNoteId,
        actorUserId: users.principal,
        actorMembershipId: principalMember,
        eventType: "APPROVED",
        revisionNumber: 2,
        reason: "Attempted reviewer grant forgery",
      },
    })).rejects.toThrow();
  });

  it("removes notes from review after term closure without deleting history", async () => {
    await prisma.academicTerm.update({
      where: { id: termId },
      data: { status: "CLOSED" },
    });
    expect((await (await queue("head")).json()).notes).toEqual([]);
    expect((await (await queue("principal")).json()).notes).toEqual([]);
    expect(await prisma.lessonNote.count({ where: { schoolId: schoolA } }))
      .toBe(4);
  });
});
