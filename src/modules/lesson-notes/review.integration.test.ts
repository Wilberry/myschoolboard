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
import { POST as authorCreate } from "@/app/api/schools/[schoolId]/lesson-notes/route";
import { POST as authorRevise } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/revisions/route";
import { POST as authorSubmit } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/submit/route";
import { GET as authorDetail } from "@/app/api/schools/[schoolId]/lesson-notes/[noteId]/route";
import { POST as studentLinkRoute } from "@/app/api/schools/[schoolId]/student-links/route";
import { POST as studentRevokeRoute } from "@/app/api/schools/[schoolId]/student-links/[linkId]/revoke/route";
import { GET as pupilLessonsRoute } from "@/app/api/schools/[schoolId]/student-lessons/route";
import { GET as pupilLessonDetailRoute } from "@/app/api/schools/[schoolId]/student-lessons/[noteId]/route";
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
const pupilPrimary = `review-student-primary-${suffix}`;
const pupilSecondary = `review-student-secondary-${suffix}`;
const pupilUnlinked = `review-student-unlinked-${suffix}`;
const enrollmentPrimary = `review-enroll-primary-${suffix}`;
const enrollmentSecondary = `review-enroll-secondary-${suffix}`;
const enrollmentUnlinked = `review-enroll-unlinked-${suffix}`;
const primaryStudentMember = `review-student-member-primary-${suffix}`;
const secondaryStudentMember = `review-student-member-secondary-${suffix}`;
const unlinkedStudentMember = `review-student-member-unlinked-${suffix}`;
const primaryAssignment = `review-assign-primary-${suffix}`;
const secondaryAssignment = `review-assign-secondary-${suffix}`;
const unknownAssignment = `review-assign-unknown-${suffix}`;
const password = "synthetic-review-password-2026";
const emails = {
  teacher: `review-teacher-${suffix}@example.test`,
  head: `review-head-${suffix}@example.test`,
  principal: `review-principal-${suffix}@example.test`,
  noGrant: `review-no-grant-${suffix}@example.test`,
  admin: `review-admin-${suffix}@example.test`,
  foreign: `review-foreign-${suffix}@example.test`,
  pupilPrimary: `review-pupil-primary-${suffix}@example.test`,
  pupilSecondary: `review-pupil-secondary-${suffix}@example.test`,
  pupilUnlinked: `review-pupil-unlinked-${suffix}@example.test`,
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
  const cookie = session.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
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

async function author(
  person: string,
  operation: "create" | "revise" | "submit",
  noteId: string,
  body: unknown,
) {
  const base = `/api/schools/${schoolA}/lesson-notes`;
  if (operation === "create") {
    return authorCreate(request(person, "POST", base, body), {
      params: Promise.resolve({ schoolId: schoolA }),
    });
  }
  const path =
    operation === "revise"
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
    request(
      person,
      "GET",
      `/api/schools/${schoolA}/lesson-note-reviews/${noteId}`,
    ),
    { params: Promise.resolve({ schoolId: schoolA, noteId }) },
  );
}

async function decide(
  person: string,
  noteId: string,
  action: "APPROVE" | "RETURN",
  expectedRevision = 1,
) {
  return decisionRoute(
    request(
      person,
      "POST",
      `/api/schools/${schoolA}/lesson-note-reviews/${noteId}/decision`,
      {
        action,
        expectedRevision,
        reason: "Synthetic exact-section review decision",
      },
    ),
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
        {
          id: teacherMember,
          userId: users.teacher,
          schoolId: schoolA,
          role: "TEACHER",
        },
        {
          id: primaryStudentMember,
          userId: users.pupilPrimary,
          schoolId: schoolA,
          role: "STUDENT",
        },
        {
          id: secondaryStudentMember,
          userId: users.pupilSecondary,
          schoolId: schoolA,
          role: "STUDENT",
        },
        {
          id: unlinkedStudentMember,
          userId: users.pupilUnlinked,
          schoolId: schoolA,
          role: "STUDENT",
        },
        {
          id: headMember,
          userId: users.head,
          schoolId: schoolA,
          role: "HEAD_OF_SECTION",
        },
        {
          id: principalMember,
          userId: users.principal,
          schoolId: schoolA,
          role: "PRINCIPAL",
        },
        { userId: users.noGrant, schoolId: schoolA, role: "HEAD_OF_SECTION" },
        { userId: users.admin, schoolId: schoolA, role: "SCHOOL_ADMIN" },
        {
          id: foreignMember,
          userId: users.foreign,
          schoolId: schoolB,
          role: "HEAD_OF_SECTION",
        },
      ],
    });
    await prisma.schoolSection.createMany({
      data: [
        {
          id: sectionPrimary,
          schoolId: schoolA,
          name: "Primary",
          stage: "PRIMARY",
        },
        {
          id: sectionSecondary,
          schoolId: schoolA,
          name: "Secondary",
          stage: "SECONDARY",
        },
        {
          id: sectionForeign,
          schoolId: schoolB,
          name: "Foreign Primary",
          stage: "PRIMARY",
        },
      ],
    });
    await prisma.schoolClass.createMany({
      data: [
        {
          id: classPrimary,
          schoolId: schoolA,
          name: "Primary One",
          sectionId: sectionPrimary,
        },
        {
          id: classSecondary,
          schoolId: schoolA,
          name: "Secondary One",
          sectionId: sectionSecondary,
        },
        { id: classUnknown, schoolId: schoolA, name: "Unclassified Class" },
      ],
    });
    await prisma.subject.create({
      data: { id: subject, schoolId: schoolA, name: "Mathematics" },
    });
    const startsOn = new Date("2026-09-01T00:00:00.000Z");
    const endsOn = new Date("2027-07-31T00:00:00.000Z");
    await prisma.academicSession.create({
      data: {
        id: sessionId,
        schoolId: schoolA,
        name: "2026/2027",
        status: "ACTIVE",
        startsOn,
        endsOn,
      },
    });
    await prisma.academicTerm.create({
      data: {
        id: termId,
        schoolId: schoolA,
        sessionId,
        name: "First Term",
        position: 1,
        status: "ACTIVE",
        startsOn,
        endsOn: new Date("2026-12-18T00:00:00.000Z"),
      },
    });
    await prisma.teacherClassSubjectAssignment.createMany({
      data: [
        {
          id: primaryAssignment,
          schoolId: schoolA,
          sessionId,
          membershipId: teacherMember,
          classId: classPrimary,
          subjectId: subject,
        },
        {
          id: secondaryAssignment,
          schoolId: schoolA,
          sessionId,
          membershipId: teacherMember,
          classId: classSecondary,
          subjectId: subject,
        },
        {
          id: unknownAssignment,
          schoolId: schoolA,
          sessionId,
          membershipId: teacherMember,
          classId: classUnknown,
          subjectId: subject,
        },
      ],
    });
    await prisma.studentRecord.createMany({
      data: [
        {
          id: pupilPrimary,
          schoolId: schoolA,
          admissionNumber: "TEST-PRIMARY-001",
          givenName: "Synthetic",
          familyName: "Primary",
          status: "ENROLLED",
        },
        {
          id: pupilSecondary,
          schoolId: schoolA,
          admissionNumber: "TEST-SECONDARY-001",
          givenName: "Synthetic",
          familyName: "Secondary",
          status: "ENROLLED",
        },
        {
          id: pupilUnlinked,
          schoolId: schoolA,
          admissionNumber: "TEST-UNLINKED-001",
          givenName: "Synthetic",
          familyName: "Unlinked",
          status: "ENROLLED",
        },
      ],
    });
    await prisma.studentEnrollment.createMany({
      data: [
        {
          id: enrollmentPrimary,
          schoolId: schoolA,
          studentId: pupilPrimary,
          sessionId,
          classId: classPrimary,
        },
        {
          id: enrollmentSecondary,
          schoolId: schoolA,
          studentId: pupilSecondary,
          sessionId,
          classId: classSecondary,
        },
        {
          id: enrollmentUnlinked,
          schoolId: schoolA,
          studentId: pupilUnlinked,
          sessionId,
          classId: classPrimary,
        },
      ],
    });
    const grant = await prisma.scopeGrant.create({
      data: {
        membershipId: headMember,
        type: "SECTION",
        scopeId: sectionPrimary,
        verified: true,
      },
    });
    headScopeId = grant.id;
    await prisma.scopeGrant.createMany({
      data: [
        {
          membershipId: principalMember,
          type: "SECTION",
          scopeId: sectionSecondary,
          verified: true,
        },
        {
          membershipId: foreignMember,
          type: "SECTION",
          scopeId: sectionForeign,
          verified: true,
        },
        {
          membershipId: headMember,
          type: "SECTION",
          scopeId: sectionForeign,
          verified: true,
        },
        {
          membershipId: principalMember,
          type: "SECTION",
          scopeId: sectionPrimary,
          verified: false,
        },
      ],
    });
    for (const [key, email] of Object.entries(emails)) {
      cookies[key] = await login(email);
    }
  }, 45_000);

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

  it("conceals queues from anonymous, teacher, admin and unscope reviewers", async () => {
    for (const [person, status] of [
      ["", 401],
      ["teacher", 404],
      ["admin", 404],
      ["noGrant", 404],
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
        termId,
        assignmentId,
        topic,
        objectives: "Describe this lesson and its educational objectives",
        content: "Synthetic class-specific lesson text for school review.",
      });
      expect(created.status).toBe(201);
      const id = (await created.json()).note.id;
      expect(
        (await author("teacher", "submit", id, { expectedRevision: 1 })).status,
      ).toBe(200);
      return id as string;
    }
    primaryNoteId = await submitted(primaryAssignment, "Primary Fractions");
    secondaryNoteId = await submitted(
      secondaryAssignment,
      "Secondary Fractions",
    );
    unknownNoteId = await submitted(
      unknownAssignment,
      "Unclassified Fractions",
    );

    const head = await queue("head");
    expect(head.status).toBe(200);
    const headRows = (await head.json()).notes;
    expect(headRows.map((row: { id: string }) => row.id)).toEqual([
      primaryNoteId,
    ]);
    expect(headRows[0].sectionId).toBe(sectionPrimary);
    expect(headRows[0].revisions).toEqual([]);

    const principal = await queue("principal");
    expect(principal.status).toBe(200);
    expect(
      (await principal.json()).notes.map((x: { id: string }) => x.id),
    ).toEqual([secondaryNoteId]);

    const ownDetail = await detail("head", primaryNoteId);
    expect(ownDetail.status).toBe(200);
    const record = (await ownDetail.json()).note;
    expect(record.revisions).toHaveLength(1);
    expect(record.revisions[0].content).toContain("Synthetic class-specific");
    for (const [person, id] of [
      ["head", secondaryNoteId],
      ["principal", primaryNoteId],
      ["head", unknownNoteId],
      ["principal", unknownNoteId],
    ] as const) {
      expect((await detail(person, id)).status).toBe(404);
      expect((await decide(person, id, "APPROVE")).status).toBe(404);
    }
  }, 20_000);

  it("returns primary notes for revision with an immutable reviewer reason", async () => {
    const returned = await decide("head", primaryNoteId, "RETURN");
    expect(returned.status).toBe(200);
    expect((await returned.json()).note.status).toBe("RETURNED");
    expect((await decide("head", primaryNoteId, "RETURN")).status).toBe(409);
    expect((await detail("head", primaryNoteId)).status).toBe(404);
    const returnedOwn = await detailOwn(primaryNoteId);
    expect(returnedOwn.status).toBe(200);
    const authorNote = (await returnedOwn.json()).note;
    expect(
      authorNote.events.find(
        (event: { eventType: string }) => event.eventType === "RETURNED",
      ),
    ).toMatchObject({
      eventType: "RETURNED",
      revisionNumber: 1,
      reason: "Synthetic exact-section review decision",
    });
    // A returned note cannot simply be resubmitted unchanged.
    expect(
      (
        await author("teacher", "submit", primaryNoteId, {
          expectedRevision: 1,
        })
      ).status,
    ).toBe(409);
    const revised = await author("teacher", "revise", primaryNoteId, {
      expectedRevision: 1,
      topic: "Improved Primary Fractions",
      objectives: "Revised learner objectives for primary fractions",
      content: "New content version preserving the old submission and review.",
    });
    expect(revised.status).toBe(200);
    expect((await revised.json()).note).toMatchObject({
      status: "DRAFT",
      currentRevision: 2,
      submittedAt: null,
    });
    expect(
      (
        await author("teacher", "submit", primaryNoteId, {
          expectedRevision: 2,
        })
      ).status,
    ).toBe(200);
    const approved = await decide("head", primaryNoteId, "APPROVE", 2);
    expect(approved.status).toBe(200);
    expect((await approved.json()).note).toMatchObject({
      status: "APPROVED",
      currentRevision: 2,
    });
    const events = await prisma.lessonNoteEvent.findMany({
      where: { schoolId: schoolA, noteId: primaryNoteId },
    });
    expect(events.map((event) => event.eventType).sort()).toEqual([
      "APPROVED",
      "CREATED",
      "RETURNED",
      "REVISED",
      "SUBMITTED",
      "SUBMITTED",
    ]);
    expect(
      events.find((event) => event.eventType === "APPROVED"),
    ).toMatchObject({
      actorMembershipId: headMember,
      revisionNumber: 2,
      reason: "Synthetic exact-section review decision",
    });
    expect((await decide("head", primaryNoteId, "APPROVE", 2)).status).toBe(
      409,
    );
  });

  it("allows the Principal to approve only the secondary section", async () => {
    const result = await decide("principal", secondaryNoteId, "APPROVE");
    expect(result.status).toBe(200);
    expect((await result.json()).note.status).toBe("APPROVED");
    expect((await queue("principal")).status).toBe(200);
    expect((await (await queue("principal")).json()).notes).toEqual([]);
    expect(
      (await decide("principal", primaryNoteId, "APPROVE", 2)).status,
    ).toBe(404);
    expect((await detailOwn(secondaryNoteId)).status).toBe(200);
  });

  it("requires approved revision and exact HM/Principal section for separate release", async () => {
    async function release(
      actor: string,
      noteId: string,
      action: "RELEASE" | "WITHDRAW",
      expectedRevision: number,
    ) {
      return releaseRoute(
        request(
          actor,
          "POST",
          `/api/schools/${schoolA}/lesson-releases/${noteId}/decision`,
          {
            action,
            expectedRevision,
            reason: "Synthetic separate approved-content release",
          },
        ),
        { params: Promise.resolve({ schoolId: schoolA, noteId }) },
      );
    }
    async function releaseQueue(actor: string) {
      return releaseQueueRoute(
        request(actor, "GET", `/api/schools/${schoolA}/lesson-releases`),
        { params: Promise.resolve({ schoolId: schoolA }) },
      );
    }
    expect((await release("teacher", primaryNoteId, "RELEASE", 2)).status).toBe(
      404,
    );
    expect(
      (await release("principal", primaryNoteId, "RELEASE", 2)).status,
    ).toBe(404);
    expect((await release("head", unknownNoteId, "RELEASE", 1)).status).toBe(
      404,
    );
    // A mismatched historical revision is concealed as NOT_FOUND before
    // release eligibility is disclosed. It must produce no release event.
    expect((await release("head", primaryNoteId, "RELEASE", 1)).status).toBe(
      404,
    );
    expect(
      await prisma.lessonReleaseEvent.count({
        where: { schoolId: schoolA, noteId: primaryNoteId },
      }),
    ).toBe(0);
    expect((await releaseQueue("teacher")).status).toBe(404);
    const queue = await releaseQueue("head");
    expect(queue.status).toBe(200);
    const rows = (await queue.json()).notes;
    expect(rows.some((note: { id: string }) => note.id === primaryNoteId)).toBe(
      true,
    );
    expect(JSON.stringify(rows)).not.toContain("learner objectives");
    const result = await release("head", primaryNoteId, "RELEASE", 2);
    expect(result.status).toBe(201);
    expect((await result.json()).event.eventType).toBe("RELEASED");
    expect((await release("head", primaryNoteId, "RELEASE", 2)).status).toBe(
      409,
    );
    expect((await release("head", primaryNoteId, "WITHDRAW", 2)).status).toBe(
      201,
    );
    expect((await release("head", primaryNoteId, "WITHDRAW", 2)).status).toBe(
      409,
    );
    const original = await prisma.lessonNote.findUniqueOrThrow({
      where: { id: primaryNoteId },
    });
    expect(original.status).toBe("APPROVED");
    const events = await prisma.lessonReleaseEvent.findMany({
      where: { schoolId: schoolA, noteId: primaryNoteId },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((e) => e.eventType).sort()).toEqual([
      "RELEASED",
      "WITHDRAWN",
    ]);
    await expect(
      prisma.lessonReleaseEvent.update({
        where: { id: events[0].id },
        data: { reason: "Unauthorized overwrite" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.lessonReleaseEvent.delete({
        where: { id: events[0].id },
      }),
    ).rejects.toThrow();
  });

  it("uses explicit admin-attested pupil binding for released class/term lessons", async () => {
    async function pupilList(actor: string) {
      return pupilLessonsRoute(
        request(actor, "GET", `/api/schools/${schoolA}/student-lessons`),
        { params: Promise.resolve({ schoolId: schoolA }) },
      );
    }
    async function pupilDetail(actor: string, noteId: string) {
      return pupilLessonDetailRoute(
        request(
          actor,
          "GET",
          `/api/schools/${schoolA}/student-lessons/${noteId}`,
        ),
        { params: Promise.resolve({ schoolId: schoolA, noteId }) },
      );
    }
    async function attest(studentId: string, membershipId: string) {
      return studentLinkRoute(
        request("admin", "POST", `/api/schools/${schoolA}/student-links`, {
          studentId,
          studentMembershipId: membershipId,
          identityVerified: true,
          reason:
            "Verified against synthetic enrollment and student account records",
        }),
        { params: Promise.resolve({ schoolId: schoolA }) },
      );
    }
    expect((await pupilList("pupilSecondary")).status).toBe(404);
    expect((await pupilList("pupilUnlinked")).status).toBe(404);
    expect((await pupilList("teacher")).status).toBe(404);
    expect((await pupilDetail("pupilSecondary", secondaryNoteId)).status).toBe(
      404,
    );
    const invalid = await studentLinkRoute(
      request("admin", "POST", `/api/schools/${schoolA}/student-links`, {
        studentId: pupilSecondary,
        studentMembershipId: secondaryStudentMember,
        reason: "Missing independent identity verification checkbox",
      }),
      { params: Promise.resolve({ schoolId: schoolA }) },
    );
    expect(invalid.status).toBe(400);
    const a = await attest(pupilPrimary, primaryStudentMember);
    expect(a.status).toBe(201);
    const b = await attest(pupilSecondary, secondaryStudentMember);
    expect(b.status).toBe(201);
    const linkId = (await b.json()).link.id;
    expect((await attest(pupilPrimary, secondaryStudentMember)).status).toBe(
      409,
    );
    expect((await pupilList("pupilSecondary")).status).toBe(200);
    expect((await (await pupilList("pupilSecondary")).json()).lessons).toEqual(
      [],
    );
    // Primary previously withdrawn; link alone gives no access to that content.
    expect((await pupilDetail("pupilPrimary", primaryNoteId)).status).toBe(404);
    const released = await releaseRoute(
      request(
        "principal",
        "POST",
        `/api/schools/${schoolA}/lesson-releases/${secondaryNoteId}/decision`,
        {
          action: "RELEASE",
          expectedRevision: 1,
          reason: "Synthetic approved secondary class document release",
        },
      ),
      {
        params: Promise.resolve({ schoolId: schoolA, noteId: secondaryNoteId }),
      },
    );
    expect(released.status).toBe(201);
    const list = await pupilList("pupilSecondary");
    expect(list.status).toBe(200);
    expect(list.headers.get("cache-control")).toBe("private, no-store");
    const items = (await list.json()).lessons;
    expect(items.map((x: { id: string }) => x.id)).toEqual([secondaryNoteId]);
    expect(JSON.stringify(items)).not.toContain(
      "Synthetic class-specific lesson text",
    );
    const detail = await pupilDetail("pupilSecondary", secondaryNoteId);
    expect(detail.status).toBe(200);
    expect((await detail.json()).lesson.content).toContain(
      "Synthetic class-specific",
    );
    expect((await pupilDetail("pupilPrimary", secondaryNoteId)).status).toBe(
      404,
    );
    const revoke = await studentRevokeRoute(
      request(
        "admin",
        "POST",
        `/api/schools/${schoolA}/student-links/${linkId}/revoke`,
        {
          reason:
            "Synthetic identity revocation requiring fresh administrator investigation",
        },
      ),
      { params: Promise.resolve({ schoolId: schoolA, linkId }) },
    );
    expect(revoke.status).toBe(201);
    expect((await pupilList("pupilSecondary")).status).toBe(404);
    expect((await pupilDetail("pupilSecondary", secondaryNoteId)).status).toBe(
      404,
    );
    await expect(
      prisma.studentAccountLink.delete({ where: { id: linkId } }),
    ).rejects.toThrow();
  }, 30_000);

  it("versions and separately approves and releases typed schemes of work", async () => {
    const input = {
      termId,
      assignmentId: primaryAssignment,
      kind: "SCHEME_OF_WORK",
      weekStart: 2,
      weekEnd: 5,
      topic: "Fractions term coverage",
      objectives: "Weekly progression and measurable class outcomes",
      content:
        "Weeks two to five cover equivalent fractions, ordering and practical exercises.",
    };
    expect(
      (
        await author("teacher", "create", "", {
          ...input,
          weekStart: 7,
          weekEnd: 2,
        })
      ).status,
    ).toBe(400);
    const created = await author("teacher", "create", "", input);
    expect(created.status).toBe(201);
    const scheme = (await created.json()).note;
    expect(scheme).toMatchObject({
      kind: "SCHEME_OF_WORK",
      weekStart: 2,
      weekEnd: 5,
      status: "DRAFT",
      currentRevision: 1,
    });
    expect(
      (await author("teacher", "submit", scheme.id, { expectedRevision: 1 }))
        .status,
    ).toBe(200);
    expect((await decide("head", scheme.id, "APPROVE", 1)).status).toBe(200);
    const release = await releaseRoute(
      request(
        "head",
        "POST",
        `/api/schools/${schoolA}/lesson-releases/${scheme.id}/decision`,
        {
          action: "RELEASE",
          expectedRevision: 1,
          reason: "Synthetic independent release of approved scheme of work",
        },
      ),
      { params: Promise.resolve({ schoolId: schoolA, noteId: scheme.id }) },
    );
    expect(release.status).toBe(201);
    const rows = await prisma.lessonNote.findFirstOrThrow({
      where: { id: scheme.id },
    });
    expect(rows).toMatchObject({
      kind: "SCHEME_OF_WORK",
      weekStart: 2,
      weekEnd: 5,
      status: "APPROVED",
    });
    await expect(
      prisma.lessonNote.update({
        where: { id: scheme.id },
        data: { weekEnd: 6 },
      }),
    ).rejects.toThrow();
    const pupil = await pupilLessonDetailRoute(
      request(
        "pupilPrimary",
        "GET",
        `/api/schools/${schoolA}/student-lessons/${scheme.id}`,
      ),
      { params: Promise.resolve({ schoolId: schoolA, noteId: scheme.id }) },
    );
    expect(pupil.status).toBe(200);
    expect((await pupil.json()).lesson).toMatchObject({
      kind: "SCHEME_OF_WORK",
      weekStart: 2,
      weekEnd: 5,
    });
  });

  it("enforces immediate student membership revocation and denies forged identity binding", async () => {
    await expect(
      prisma.studentAccountLink.create({
        data: {
          schoolId: schoolA,
          studentId: pupilUnlinked,
          studentMembershipId: unlinkedStudentMember,
          attestedByMembershipId: teacherMember,
          attestedByUserId: users.teacher,
          attestationReason: "Attempted forged account to enrolled pupil",
        },
      }),
    ).rejects.toThrow();
    await prisma.membership.update({
      where: { id: primaryStudentMember },
      data: { isActive: false },
    });
    try {
      const response = await pupilLessonsRoute(
        request(
          "pupilPrimary",
          "GET",
          `/api/schools/${schoolA}/student-lessons`,
        ),
        { params: Promise.resolve({ schoolId: schoolA }) },
      );
      expect(response.status).toBe(404);
    } finally {
      await prisma.membership.update({
        where: { id: primaryStudentMember },
        data: { isActive: true },
      });
    }
  });

  it("revoking verified section grant or section activity removes reviewer authority", async () => {
    await prisma.scopeGrant.update({
      where: { id: headScopeId },
      data: { verified: false },
    });
    try {
      expect((await queue("head")).status).toBe(404);
      expect((await decide("head", primaryNoteId, "APPROVE", 2)).status).toBe(
        404,
      );
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
        schoolId: schoolA,
        noteId: primaryNoteId,
        eventType: "APPROVED",
      },
    });
    await expect(
      prisma.lessonNoteEvent.update({
        where: { id: approval.id },
        data: { reason: "Forcibly altered review justification" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.lessonNoteEvent.delete({
        where: { id: approval.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.lessonNoteEvent.create({
        data: {
          schoolId: schoolA,
          noteId: primaryNoteId,
          actorUserId: users.principal,
          actorMembershipId: principalMember,
          eventType: "APPROVED",
          revisionNumber: 2,
          reason: "Attempted reviewer grant forgery",
        },
      }),
    ).rejects.toThrow();
  });

  it("removes notes from review after term closure without deleting history", async () => {
    await prisma.academicTerm.update({
      where: { id: termId },
      data: { status: "CLOSED" },
    });
    expect((await (await queue("head")).json()).notes).toEqual([]);
    expect((await (await queue("principal")).json()).notes).toEqual([]);
    const deniedAfterClosingTerm = await pupilLessonsRoute(
      request("pupilPrimary", "GET", `/api/schools/${schoolA}/student-lessons`),
      { params: Promise.resolve({ schoolId: schoolA }) },
    );
    expect(deniedAfterClosingTerm.status).toBe(200);
    expect((await deniedAfterClosingTerm.json()).lessons).toEqual([]);
    expect(
      await prisma.lessonNote.count({ where: { schoolId: schoolA } }),
    ).toBe(4);
  });
});
