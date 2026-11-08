import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFile, mkdtemp } from "node:fs/promises";
import sharp from "sharp";
import { readSchoolAudit } from "@/src/modules/audit/school-ledger";
import {
  deliverModuleBatch,
  readModuleInbox,
  changeModuleNotification,
} from "@/src/modules/notifications/module-inapp";
import {
  createCatalogEntry,
  reviewCatalogEntry,
  releaseCatalogEntry,
} from "@/src/modules/learning-resources/catalog";
import {
  uploadLearningAsset,
  attestLearningAssetRights,
  releaseLearningAsset,
} from "@/src/modules/learning-resources/assets";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));
import { prisma } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";
import { verifyPhase9DatabaseIdentity } from "@/scripts/verify-phase9-disposable.mjs";
import { attestStudentAccount } from "@/src/modules/students/account-link-service";
import { attestGuardianStudentLink } from "@/src/modules/students/guardian-link-service";
import {
  adoptLearningPolicy as adopt,
  createLearningAssignment as create,
  reviseLearningAssignment as revise,
  transitionLearningAssignment as action,
  readLearningAssignments as feed,
} from "./service";
import {
  submitLearningWork as submit,
  reviewLearningWork as review,
  readLearningSubmissions as submissions,
} from "./submissions";

const tag = randomUUID();
const school = `p10-tasks-${tag}`,
  foreign = `${school}-foreign`;
const session = `${school}-session`,
  term = `${school}-term`;
const section = `${school}-section`,
  room = `${school}-class`;
const subject = `${school}-subject`,
  assignment = `${school}-assignment`;
const responsibility = `${school}-form`;
const users: Record<string, string> = {},
  members: Record<string, string> = {};
const cookies: Record<string, string> = {};
let task: string, releaseId: string, policyId: string, pupil: string;
const intent = (extra = {}) => ({
  requestKey: randomUUID(),
  reason: "Synthetic learning workflow verification",
  ...extra,
});
function actor(name: string) {
  context.headers = new Headers({
    cookie: cookies[name],
    origin: env.BETTER_AUTH_URL,
  });
}
const settings = {
  timeZone: "UTC",
  allowFormTasks: false,
  allowTextSubmissions: false,
  allowImageReferences: false,
  allowLateSubmissions: false,
  allowResubmission: false,
};
async function policy(options = {}) {
  actor("owner");
  policyId = (await adopt(school, intent({ ...settings, ...options }))).id;
  return policyId;
}
const content = () => ({
  title: "Synthetic learning assignment",
  body: "Synthetic instructions; no automatic grade",
  dueAt: new Date(Date.now() + 3600000).toISOString(),
  submissionsEnabled: false,
  imageReferencesEnabled: false,
  assetReleaseIds: [],
});
async function published(options: Record<string, unknown> = {}) {
  actor("teacher");
  const n = await create(
    school,
    intent({
      ...content(),
      assignmentId: assignment,
      termId: term,
      policyId,
      ...options,
    }),
  );
  await action(school, n.id, intent({ action: "SUBMIT", expectedRevision: 1 }));
  actor("reviewer");
  await action(
    school,
    n.id,
    intent({ action: "APPROVE", expectedRevision: 1 }),
  );
  actor("teacher");
  const r = await action(
    school,
    n.id,
    intent({ action: "RELEASE", expectedRevision: 1 }),
  );
  return { taskId: n.id, releaseId: r.id };
}
beforeAll(async () => {
  verifyPhase9DatabaseIdentity(process.env);
  vi.stubEnv("PHASE10_LEARNING_ASSIGNMENTS_ENABLED", "true");
  await prisma.school.createMany({
    data: [
      { id: school, name: "Synthetic tasks school", slug: school },
      { id: foreign, name: "Synthetic foreign school", slug: foreign },
    ],
  });
  for (const [name, role, tenant] of [
    ["owner", "SCHOOL_SUPER_ADMIN", school],
    ["admin", "SCHOOL_ADMIN", school],
    ["teacher", "TEACHER", school],
    ["form", "FORM_TEACHER", school],
    ["reviewer", "HEAD_OF_SECTION", school],
    ["student", "STUDENT", school],
    ["parent", "PARENT", school],
    ["foreign", "TEACHER", foreign],
  ] as const) {
    const email = `p10-task-${name}-${tag}@example.test`,
      password = "Synthetic-learning-task-password-42";
    const created = await auth.api.signUpEmail({
      body: { email, password, name: "Synthetic learning actor" },
    });
    users[name] = created.user.id;
    members[name] = (
      await prisma.membership.create({
        data: { schoolId: tenant, userId: created.user.id, role },
      })
    ).id;
    const signed = await auth.api.signInEmail({
      body: { email, password },
      headers: new Headers({ origin: env.BETTER_AUTH_URL }),
      returnHeaders: true,
    });
    cookies[name] = signed.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
  }
  await prisma.academicSession.create({
    data: {
      id: session,
      schoolId: school,
      name: "Synthetic current session",
      status: "ACTIVE",
      startsOn: new Date(Date.now() - 14 * 86400000),
      endsOn: new Date(Date.now() + 60 * 86400000),
    },
  });
  await prisma.academicTerm.create({
    data: {
      id: term,
      schoolId: school,
      sessionId: session,
      name: "Synthetic current term",
      position: 1,
      status: "ACTIVE",
      startsOn: new Date(Date.now() - 7 * 86400000),
      endsOn: new Date(Date.now() + 30 * 86400000),
    },
  });
  await prisma.schoolSection.create({
    data: { id: section, schoolId: school, name: "Primary", stage: "PRIMARY" },
  });
  await prisma.schoolClass.create({
    data: {
      id: room,
      schoolId: school,
      sectionId: section,
      name: "Synthetic task class",
    },
  });
  await prisma.subject.create({
    data: { id: subject, schoolId: school, name: "Synthetic subject" },
  });
  await prisma.teacherClassSubjectAssignment.create({
    data: {
      id: assignment,
      schoolId: school,
      membershipId: members.teacher,
      classId: room,
      subjectId: subject,
      sessionId: session,
    },
  });
  await prisma.formTeacherResponsibility.create({
    data: {
      id: responsibility,
      schoolId: school,
      membershipId: members.form,
      classId: room,
      sessionId: session,
    },
  });
  await prisma.scopeGrant.create({
    data: {
      membershipId: members.reviewer,
      type: "SECTION",
      scopeId: section,
      verified: true,
    },
  });
  pupil = (
    await prisma.studentRecord.create({
      data: {
        schoolId: school,
        admissionNumber: tag,
        givenName: "Synthetic",
        familyName: "Learning pupil",
        status: "ENROLLED",
      },
    })
  ).id;
  await prisma.studentEnrollment.create({
    data: {
      schoolId: school,
      studentId: pupil,
      classId: room,
      sessionId: session,
    },
  });
  actor("admin");
  await attestStudentAccount(school, {
    studentId: pupil,
    studentMembershipId: members.student,
    identityVerified: true,
    reason: "Synthetic independently verified pupil identity",
  });
  await attestGuardianStudentLink(school, {
    studentId: pupil,
    guardianMembershipId: members.parent,
    relationshipVerified: true,
    reason: "Synthetic independently verified guardian relationship",
  });
}, 45000);
afterAll(async () => {
  const fixture = process.env.PHASE10_LEARNING_BROWSER_FIXTURE_FILE;
  vi.unstubAllEnvs();
  if (fixture) {
    verifyPhase9DatabaseIdentity(process.env);
    if (!/^\/tmp\/phase10-learning-[\w-]+\.json$/.test(fixture))
      throw Error("Private fixture path required");
    // Terminal revocation tests remain terminal. Browser staging creates a new
    // identity and relationship instead of reactivating the tested membership.
    const email = `p10-task-browserstudent-${tag}@example.test`;
    const fresh = await auth.api.signUpEmail({
      body: {
        email,
        password: "Synthetic-learning-task-password-42",
        name: "Synthetic fresh browser pupil",
      },
    });
    const membership = await prisma.membership.create({
      data: { schoolId: school, userId: fresh.user.id, role: "STUDENT" },
    });
    const student = await prisma.studentRecord.create({
      data: {
        schoolId: school,
        admissionNumber: `${tag}-browser`,
        givenName: "Synthetic",
        familyName: "Fresh browser pupil",
        status: "ENROLLED",
      },
    });
    await prisma.studentEnrollment.create({
      data: {
        schoolId: school,
        studentId: student.id,
        classId: room,
        sessionId: session,
      },
    });
    actor("admin");
    await attestStudentAccount(school, {
      studentId: student.id,
      studentMembershipId: membership.id,
      identityVerified: true,
      reason: "Independent synthetic fresh browser identity verification",
    });
    await attestGuardianStudentLink(school, {
      studentId: student.id,
      guardianMembershipId: members.parent,
      relationshipVerified: true,
      reason: "Independent synthetic fresh browser guardian relationship",
    });
    await writeFile(
      fixture,
      JSON.stringify({
        tag,
        school,
        foreign,
        assignment,
        responsibility,
        term,
        users: { ...users, student: fresh.user.id },
        members: { ...members, student: membership.id },
        pupil: student.id,
        emails: { student: email },
        password: "Synthetic-learning-task-password-42",
      }),
      { mode: 0o600, flag: "wx" },
    );
    await prisma.$disconnect();
    return;
  }
  await prisma.school.deleteMany({ where: { id: { in: [school, foreign] } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  await prisma.$disconnect();
});
it("requires explicit owner policy and defaults submission/Form permissions off", async () => {
  actor("teacher");
  await expect(adopt(school, intent(settings))).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await policy();
  actor("form");
  await expect(
    create(
      school,
      intent({
        ...content(),
        formResponsibilityId: responsibility,
        termId: term,
        policyId,
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("teacher");
  await expect(
    create(
      school,
      intent({
        ...content(),
        assignmentId: assignment,
        termId: term,
        policyId,
        submissionsEnabled: true,
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const data = intent({
    ...content(),
    assignmentId: assignment,
    termId: term,
    policyId,
  });
  const n = await Promise.all([create(school, data), create(school, data)]);
  task = n[0].id;
  expect(n.map((value) => value.replay).sort()).toEqual([false, true]);
  for (const who of ["parent", "student", "owner", "foreign"]) {
    actor(who);
    await expect(
      create(
        school,
        intent({
          ...content(),
          assignmentId: assignment,
          termId: term,
          policyId,
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});
it("requires independent section review and original author release of the unchanged revision", async () => {
  actor("teacher");
  await action(school, task, intent({ action: "SUBMIT", expectedRevision: 1 }));
  await expect(
    action(school, task, intent({ action: "APPROVE", expectedRevision: 1 })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("owner");
  await expect(
    action(school, task, intent({ action: "APPROVE", expectedRevision: 1 })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("reviewer");
  await action(school, task, intent({ action: "RETURN", expectedRevision: 1 }));
  actor("teacher");
  await revise(
    school,
    task,
    intent({
      ...content(),
      expectedRevision: 1,
      title: "Revised synthetic task",
    }),
  );
  await action(school, task, intent({ action: "SUBMIT", expectedRevision: 2 }));
  actor("reviewer");
  await action(
    school,
    task,
    intent({ action: "APPROVE", expectedRevision: 2 }),
  );
  actor("teacher");
  releaseId = (
    await action(
      school,
      task,
      intent({ action: "RELEASE", expectedRevision: 2 }),
    )
  ).id;
  actor("student");
  expect((await feed(school, releaseId)).tasks[0]).toMatchObject({
    title: "Revised synthetic task",
    submissionsEnabled: false,
    timeZone: "UTC",
  });
  await expect(
    submit(school, releaseId, {
      expectedSubmissionRevision: 0,
      text: "Denied by explicit default",
      requestKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("denies verified guardians, foreign actors and forged submission identity", async () => {
  for (const who of ["parent", "foreign"]) {
    actor(who);
    await expect(feed(school, releaseId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(submissions(school, releaseId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  }
  actor("student");
  await expect(
    submit(school, releaseId, {
      studentId: pupil,
      expectedSubmissionRevision: 0,
      text: "Spoofed identity",
      requestKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
it("preserves pupil work under concurrent exact retry and teacher return/resubmission", async () => {
  await policy({ allowTextSubmissions: true, allowResubmission: true });
  const n = await published({ submissionsEnabled: true });
  actor("student");
  const data = {
    expectedSubmissionRevision: 0,
    text: "Original synthetic pupil work",
    assetReleaseIds: [],
    requestKey: randomUUID(),
  };
  const results = await Promise.all([
    submit(school, n.releaseId, data),
    submit(school, n.releaseId, data),
  ]);
  expect(results[0].id).toBe(results[1].id);
  await expect(
    submit(school, n.releaseId, { ...data, text: "Changed replay" }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  actor("owner");
  await expect(
    review(school, results[0].id, intent({ action: "APPROVE" })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("teacher");
  await review(school, results[0].id, intent({ action: "RETURN" }));
  actor("student");
  const revised = await submit(school, n.releaseId, {
    expectedSubmissionRevision: 1,
    text: "Revised synthetic pupil work",
    requestKey: randomUUID(),
  });
  expect((await submissions(school, n.releaseId)).submissions).toHaveLength(2);
  actor("teacher");
  await review(school, revised.id, intent({ action: "APPROVE" }));
  actor("student");
  await expect(
    submit(school, n.releaseId, {
      expectedSubmissionRevision: 2,
      text: "Not returned again",
      requestKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(
    (
      await prisma.$queryRaw<
        Array<{ count: string }>
      >`SELECT count(*)::text AS count FROM "AssessmentAttemptScore" WHERE "schoolId"=${school}`
    )[0].count,
  ).toBe("0");
});
it("rejects retrospective deadlines and late work when policy denies it", async () => {
  await policy({ allowTextSubmissions: true });
  actor("teacher");
  await expect(
    create(
      school,
      intent({
        ...content(),
        assignmentId: assignment,
        termId: term,
        policyId,
        dueAt: new Date(Date.now() - 1000).toISOString(),
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const n = await published({
    submissionsEnabled: true,
    dueAt: new Date(Date.now() + 2500).toISOString(),
  });
  await new Promise((resolve) => setTimeout(resolve, 2600));
  actor("student");
  await expect(
    submit(school, n.releaseId, {
      expectedSubmissionRevision: 0,
      text: "Too late",
      requestKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
}, 10000);
it("permits explicit late-work and actual Form Teacher tasks without grade authority", async () => {
  await policy({
    allowFormTasks: true,
    allowTextSubmissions: true,
    allowLateSubmissions: true,
  });
  actor("form");
  const n = await create(
    school,
    intent({
      ...content(),
      formResponsibilityId: responsibility,
      termId: term,
      policyId,
      submissionsEnabled: true,
      dueAt: new Date(Date.now() + 2500).toISOString(),
    }),
  );
  await action(school, n.id, intent({ action: "SUBMIT", expectedRevision: 1 }));
  actor("reviewer");
  await action(
    school,
    n.id,
    intent({ action: "APPROVE", expectedRevision: 1 }),
  );
  actor("form");
  const r = await action(
    school,
    n.id,
    intent({ action: "RELEASE", expectedRevision: 1 }),
  );
  await new Promise((resolve) => setTimeout(resolve, 2600));
  actor("student");
  const submitted = await submit(school, r.id, {
    expectedSubmissionRevision: 0,
    text: "Explicitly permitted late work",
    requestKey: randomUUID(),
  });
  actor("form");
  await review(school, submitted.id, intent({ action: "APPROVE" }));
}, 10000);
it("denies attachment forgery and protects immutable task/submission ledgers", async () => {
  actor("teacher");
  await expect(
    create(
      school,
      intent({
        ...content(),
        assignmentId: assignment,
        termId: term,
        policyId,
        assetReleaseIds: [randomUUID()],
      }),
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  for (const table of [
    "LearningAssignmentPolicy",
    "LearningAssignmentRevision",
    "LearningAssignmentEvent",
    "LearningSubmissionRevision",
    "LearningSubmissionReview",
  ])
    await expect(
      prisma.$executeRawUnsafe(`TRUNCATE "${table}" CASCADE`),
    ).rejects.toThrow();
});
it("revokes task/submission reads on withdrawal and checks current membership", async () => {
  const n = await published();
  actor("owner");
  await action(
    school,
    n.taskId,
    intent({
      action: "WITHDRAW",
      expectedRevision: 1,
      targetReleaseId: n.releaseId,
    }),
  );
  actor("student");
  await expect(feed(school, n.releaseId)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(submissions(school, n.releaseId)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  const rollback = Symbol("rollback synthetic membership transition");
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: members.student },
        data: { isActive: false },
      });
      expect(
        (
          await tx.$queryRaw<
            Array<{ allowed: boolean }>
          >`SELECT can_read_learning_assignment(${school},${releaseId}::uuid,${users.student}) AS allowed`
        )[0].allowed,
      ).toBe(false);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
});
it("rejects invalid policy zones and stale policy publication without changing history", async () => {
  actor("owner");
  await expect(
    adopt(school, intent({ ...settings, timeZone: "Invalid/School" })),
  ).rejects.toThrow();
  await policy();
  actor("teacher");
  const n = await create(
    school,
    intent({ ...content(), assignmentId: assignment, termId: term, policyId }),
  );
  await action(school, n.id, intent({ action: "SUBMIT", expectedRevision: 1 }));
  actor("reviewer");
  await action(
    school,
    n.id,
    intent({ action: "APPROVE", expectedRevision: 1 }),
  );
  await policy({ timeZone: "Africa/Lagos" });
  actor("teacher");
  await expect(
    action(school, n.id, intent({ action: "RELEASE", expectedRevision: 1 })),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(
    await prisma.learningAssignmentEvent.count({
      where: { schoolId: school, taskId: n.id, action: "RELEASE" },
    }),
  ).toBe(0);
});
it("validates submission cursor ownership and derives the current deadline window", async () => {
  await policy({ allowTextSubmissions: true });
  const n = await published({ submissionsEnabled: true });
  actor("student");
  expect((await feed(school, n.releaseId)).tasks[0].submissionWindowOpen).toBe(
    true,
  );
  const own = await submit(school, n.releaseId, {
    expectedSubmissionRevision: 0,
    text: "Cursor ownership verification",
    requestKey: randomUUID(),
  });
  expect((await submissions(school, n.releaseId)).nextCursor).toBeNull();
  expect(
    (await submissions(school, n.releaseId, own.id)).submissions,
  ).toHaveLength(0);
  await expect(
    submissions(school, n.releaseId, randomUUID()),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  actor("foreign");
  await expect(submissions(school, n.releaseId, own.id)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("intersects approved image rights with each pupil instead of widening the task audience", async () => {
  vi.stubEnv("PHASE10_LIBRARY_ENABLED", "true");
  vi.stubEnv("PHASE10_ASSETS_ENABLED", "true");
  vi.stubEnv("PHASE10_RASTER_INSPECTION_ENABLED", "true");
  vi.stubEnv(
    "PHASE10_LIBRARY_STORAGE_DIR",
    await mkdtemp("/workspace/phase10-tools-resumed-20261107/task-images-"),
  );
  actor("teacher");
  const entry = await createCatalogEntry(
    school,
    intent({
      kind: "DIGITAL_RESOURCE",
      title: "Synthetic task raster",
      author: "Synthetic author",
      publisher: "Synthetic publisher",
      isbn: null,
      description: "Generated original test image",
      provenance: "Original synthetic raster solely for verification",
    }),
  );
  actor("owner");
  await reviewCatalogEntry(
    school,
    entry.id,
    intent({ expectedRevision: 1, action: "APPROVE" }),
  );
  const catalog = await releaseCatalogEntry(
    school,
    entry.id,
    intent({ expectedRevision: 1, scope: "STUDENT", studentId: pupil }),
  );
  actor("teacher");
  const raster = await sharp({
    create: { width: 3, height: 3, channels: 3, background: "#456789" },
  })
    .png()
    .toBuffer();
  const asset = await uploadLearningAsset(school, entry.id, {
    ...intent(),
    expectedRevision: 1,
    file: new File([new Uint8Array(raster)], "synthetic.png", {
      type: "image/png",
    }),
  });
  actor("owner");
  const rights = await attestLearningAssetRights(
    school,
    asset.id,
    intent({
      catalogReleaseId: catalog.id,
      basis: "PUBLIC_DOMAIN",
      sourceLicense: "Synthetic raster generated solely for verification",
      permittedUse: "EDUCATIONAL_VIEW_DOWNLOAD",
      expiresAt: null,
    }),
  );
  const image = await releaseLearningAsset(
    school,
    asset.id,
    intent({ rightsId: rights.id }),
  );
  await policy({ allowTextSubmissions: true, allowImageReferences: true });
  const n = await published({
    submissionsEnabled: true,
    imageReferencesEnabled: true,
    assetReleaseIds: [image.id],
  });
  actor("student");
  expect((await feed(school, n.releaseId)).tasks[0].assetReleaseIds).toEqual([
    image.id,
  ]);
  const work = await submit(school, n.releaseId, {
    expectedSubmissionRevision: 0,
    text: "Original pupil text with authorized reference",
    assetReleaseIds: [image.id],
    requestKey: randomUUID(),
  });
  expect((await submissions(school, n.releaseId)).submissions[0].id).toBe(
    work.id,
  );
  const signed = await auth.api.signUpEmail({
    body: {
      email: `p10-task-other-${tag}@example.test`,
      password: "Synthetic-learning-task-password-42",
      name: "Synthetic other pupil",
    },
  });
  users.other = signed.user.id;
  const member = await prisma.membership.create({
    data: { schoolId: school, userId: users.other, role: "STUDENT" },
  });
  const other = await prisma.studentRecord.create({
    data: {
      schoolId: school,
      admissionNumber: `${tag}-other`,
      givenName: "Synthetic",
      familyName: "Other pupil",
      status: "ENROLLED",
    },
  });
  await prisma.studentEnrollment.create({
    data: {
      schoolId: school,
      studentId: other.id,
      classId: room,
      sessionId: session,
    },
  });
  actor("admin");
  await attestStudentAccount(school, {
    studentId: other.id,
    studentMembershipId: member.id,
    identityVerified: true,
    reason: "Independent synthetic identity verification",
  });
  const login = await auth.api.signInEmail({
    body: {
      email: `p10-task-other-${tag}@example.test`,
      password: "Synthetic-learning-task-password-42",
    },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  cookies.other = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  actor("other");
  expect((await feed(school, n.releaseId)).tasks[0].assetReleaseIds).toEqual(
    [],
  );
  await expect(
    submit(school, n.releaseId, {
      expectedSubmissionRevision: 0,
      text: "Must not attach another pupil image",
      assetReleaseIds: [image.id],
      requestKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await submit(school, n.releaseId, {
    expectedSubmissionRevision: 0,
    text: "Independent authorized text only",
    requestKey: randomUUID(),
  });
});
it("restricts registered audit metadata to the current school owner without source contents", async () => {
  vi.stubEnv("PHASE10_AUDIT_ENABLED", "true");
  actor("owner");
  const all = await readSchoolAudit(school);
  expect(all.events.length).toBeGreaterThan(0);
  const tasks = await readSchoolAudit(school, "LearningAssignmentEvent");
  expect(tasks.events.length).toBeGreaterThan(0);
  for (const event of all.events) {
    expect(Object.keys(event).sort()).toEqual([
      "action",
      "actorUserId",
      "at",
      "id",
      "source",
    ]);
    expect(event.at).toMatch(/\.\d{6}Z$/);
  }
  expect(JSON.stringify(all)).not.toContain("Original pupil text");
  for (const name of [
    "admin",
    "teacher",
    "reviewer",
    "student",
    "parent",
    "foreign",
  ]) {
    actor(name);
    await expect(readSchoolAudit(school)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  }
  actor("owner");
  await expect(readSchoolAudit(foreign)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(readSchoolAudit(school, "Account")).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  await expect(
    readSchoolAudit(school, undefined, "invalid-cursor"),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
it("paginates immutable audit evidence without duplicates and rejects cross-filter cursors", async () => {
  actor("owner");
  for (let i = 0; i < 101; i++) await policy();
  const first = await readSchoolAudit(school, "LearningAssignmentPolicy");
  expect(first.events).toHaveLength(100);
  expect(first.nextCursor).toBeTruthy();
  const second = await readSchoolAudit(
    school,
    "LearningAssignmentPolicy",
    first.nextCursor!,
  );
  const ids = [...first.events, ...second.events].map((e) => e.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.length).toBe(
    await prisma.learningAssignmentPolicy.count({
      where: { schoolId: school },
    }),
  );
  await expect(
    readSchoolAudit(school, "LearningAssignmentEvent", first.nextCursor!),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
}, 20000);
it("revokes audit access immediately on actual owner role removal", async () => {
  const email = `p10-task-audit-owner-${tag}@example.test`,
    password = "Synthetic-learning-task-password-42";
  const signed = await auth.api.signUpEmail({
    body: { email, password, name: "Synthetic audit operator" },
  });
  users.auditOwner = signed.user.id;
  const m = await prisma.membership.create({
    data: {
      schoolId: school,
      userId: signed.user.id,
      role: "SCHOOL_SUPER_ADMIN",
    },
  });
  const login = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  cookies.auditOwner = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  actor("auditOwner");
  expect((await readSchoolAudit(school)).events.length).toBeGreaterThan(0);
  await prisma.membership.update({
    where: { id: m.id },
    data: { role: "SCHOOL_ADMIN" },
  });
  await expect(readSchoolAudit(school)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("captures minimal source events and one durable outbox entry under concurrent exact retry", async () => {
  actor("owner");
  const data = intent(settings);
  const [a, b] = await Promise.all([adopt(school, data), adopt(school, data)]);
  expect(a.id).toBe(b.id);
  const events = await prisma.schoolSourceEvent.findMany({
    where: {
      schoolId: school,
      sourceType: "LearningAssignmentPolicy",
      sourceId: a.id,
    },
  });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    schoolId: school,
    schemaVersion: 1,
    actorUserId: users.owner,
    action: "RECORDED",
  });
  expect(
    await prisma.schoolSourceOutbox.count({
      where: { schoolId: school, eventId: events[0].id, state: "PENDING" },
    }),
  ).toBe(1);
  expect(Object.keys(events[0]).sort()).toEqual([
    "action",
    "actorUserId",
    "createdAt",
    "id",
    "occurredAt",
    "schemaVersion",
    "schoolId",
    "sourceId",
    "sourceType",
  ]);
});
it("rolls back source, envelope and outbox together without disabling integrity guards", async () => {
  const id = randomUUID(),
    request = randomUUID(),
    rollback = Symbol("synthetic source rollback");
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO "LearningAssignmentPolicy"("id","schoolId","version","timeZone","actorUserId","requestKey","reason") VALUES(${id}::uuid,${school},1,'UTC',${users.owner},${request}::uuid,'Synthetic atomic source rollback')`;
      expect(
        await tx.schoolSourceEvent.count({
          where: { schoolId: school, sourceId: id },
        }),
      ).toBe(1);
      expect(
        await tx.schoolSourceOutbox.count({
          where: { schoolId: school, event: { sourceId: id } },
        }),
      ).toBe(1);
      throw rollback;
    }),
  ).rejects.toBe(rollback);
  expect(
    await prisma.learningAssignmentPolicy.count({
      where: { schoolId: school, id },
    }),
  ).toBe(0);
  expect(
    await prisma.schoolSourceEvent.count({
      where: { schoolId: school, sourceId: id },
    }),
  ).toBe(0);
});
it("denies invented envelopes and ordinary source-evidence rewriting", async () => {
  await expect(
    prisma.$executeRaw`INSERT INTO "SchoolSourceEvent"("schoolId","sourceType","sourceId","action","occurredAt") VALUES(${school},'LearningAssignmentPolicy','invented','RECORDED',clock_timestamp())`,
  ).rejects.toThrow();
  await expect(
    prisma.$executeRaw`UPDATE "SchoolSourceEvent" SET "action"='FORGED' WHERE "schoolId"=${school}`,
  ).rejects.toThrow();
  await expect(
    prisma.$executeRaw`TRUNCATE "SchoolSourceEvent" CASCADE`,
  ).rejects.toThrow();
});
async function drainModules() {
  for (let i = 0; i < 100; i++) {
    const batch = await Promise.all([
      deliverModuleBatch(school, users.owner),
      deliverModuleBatch(school, users.owner),
    ]);
    if (!batch.some((item) => item.processed)) return;
  }
  throw Error("Synthetic module queue exceeded bounded drain");
}
it("delivers current task/resource updates concurrently without consuming unregistered source contracts", async () => {
  vi.stubEnv("PHASE10_INAPP_ENABLED", "true");
  vi.stubEnv("PHASE10_MODULE_INAPP_ENABLED", "true");
  await policy({ allowTextSubmissions: true, allowResubmission: true });
  const n = await published({ submissionsEnabled: true });
  await drainModules();
  actor("student");
  const inbox = await readModuleInbox(school);
  const item = inbox.items.find((i) => i.href.endsWith(n.releaseId));
  expect(item).toBeTruthy();
  const read = { action: "READ", requestKey: randomUUID() };
  const decisions = await Promise.all([
    changeModuleNotification(school, item!.id, read),
    changeModuleNotification(school, item!.id, read),
  ]);
  expect(decisions.map((i) => i.replay).sort()).toEqual([false, true]);
  expect(
    (await readModuleInbox(school)).items.find((i) => i.id === item!.id)?.read,
  ).toBe(true);
  await changeModuleNotification(school, item!.id, {
    action: "UNREAD",
    requestKey: randomUUID(),
  });
  const work = await submit(school, n.releaseId, {
    expectedSubmissionRevision: 0,
    text: "Synthetic source-adapted pupil work",
    requestKey: randomUUID(),
  });
  await drainModules();
  actor("teacher");
  expect(
    (await readModuleInbox(school)).items.some((i) =>
      i.href.endsWith(n.releaseId),
    ),
  ).toBe(true);
  await review(school, work.id, intent({ action: "RETURN" }));
  await drainModules();
  actor("student");
  expect(
    (await readModuleInbox(school)).items.filter((i) =>
      i.href.endsWith(n.releaseId),
    ).length,
  ).toBeGreaterThanOrEqual(2);
  for (const who of ["parent", "foreign"]) {
    actor(who);
    await expect(readModuleInbox(school)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      changeModuleNotification(school, item!.id, {
        action: "READ",
        requestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
  expect(
    await prisma.schoolSourceOutbox.count({
      where: {
        schoolId: school,
        state: "PENDING",
        event: { sourceType: "LearningAssignmentPolicy" },
      },
    }),
  ).toBeGreaterThan(100);
  const duplicates = await prisma.$queryRaw<
    Array<{ count: string }>
  >`SELECT count(*)::text AS count FROM (SELECT "eventId","recipientMembershipId" FROM "ModuleDelivery" WHERE "schoolId"=${school} GROUP BY "eventId","recipientMembershipId" HAVING count(*)>1) duplicate`;
  expect(duplicates[0].count).toBe("0");
}, 20000);
it("terminally suppresses delivered task notifications on actual pupil membership revocation", async () => {
  const n = await published();
  await drainModules();
  actor("student");
  const item = (await readModuleInbox(school)).items.find((i) =>
    i.href.endsWith(n.releaseId),
  );
  expect(item).toBeTruthy();
  await prisma.membership.update({
    where: { id: members.student },
    data: { isActive: false },
  });
  await expect(readModuleInbox(school)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(
    await prisma.moduleDeliverySuppression.count({
      where: { schoolId: school, deliveryId: item!.id },
    }),
  ).toBe(1);
  await expect(
    changeModuleNotification(school, item!.id, {
      action: "READ",
      requestKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("serializes delivery with an actual uncommitted recipient revocation", async () => {
  const email = `p10-task-racer-${tag}@example.test`,
    password = "Synthetic-learning-task-password-42";
  const registered = await auth.api.signUpEmail({
    body: { email, password, name: "Synthetic revocation race pupil" },
  });
  users.racer = registered.user.id;
  const member = await prisma.membership.create({
    data: { schoolId: school, userId: users.racer, role: "STUDENT" },
  });
  const child = await prisma.studentRecord.create({
    data: {
      schoolId: school,
      admissionNumber: `${tag}-race`,
      givenName: "Synthetic",
      familyName: "Race pupil",
      status: "ENROLLED",
    },
  });
  await prisma.studentEnrollment.create({
    data: {
      schoolId: school,
      studentId: child.id,
      classId: room,
      sessionId: session,
    },
  });
  actor("admin");
  await attestStudentAccount(school, {
    studentId: child.id,
    studentMembershipId: member.id,
    identityVerified: true,
    reason: "Independent synthetic race pupil identity",
  });
  const n = await published();
  let unlock!: () => void,
    locked!: () => void,
    backend = 0;
  const gate = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const holder = prisma.$transaction(
    async (tx) => {
      backend = (
        await tx.$queryRaw<
          Array<{ pid: number }>
        >`SELECT pg_backend_pid() AS pid`
      )[0].pid;
      await tx.membership.update({
        where: { id: member.id },
        data: { isActive: false },
      });
      locked();
      await gate;
    },
    { timeout: 15000 },
  );
  await Promise.race([
    ready,
    holder.then(() => {
      throw Error("Expected a live synthetic revocation lock");
    }),
  ]);
  const worker = drainModules();
  let observed = false;
  try {
    for (let i = 0; i < 200; i++) {
      observed = (
        await prisma.$queryRaw<
          Array<{ blocked: boolean }>
        >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity activity WHERE activity.datname=current_database() AND activity.pid<>${backend} AND ${backend}=ANY(pg_blocking_pids(activity.pid))) AS blocked`
      )[0].blocked;
      if (observed) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } finally {
    unlock();
    await Promise.all([holder, worker]);
  }
  expect(observed).toBe(true);
  expect(
    await prisma.moduleDelivery.count({
      where: {
        schoolId: school,
        recipientMembershipId: member.id,
        event: { sourceId: n.releaseId },
      },
    }),
  ).toBe(0);
  expect(
    (await prisma.membership.findUniqueOrThrow({ where: { id: member.id } }))
      .isActive,
  ).toBe(false);
}, 20000);
