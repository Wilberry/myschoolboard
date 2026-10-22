import "dotenv/config";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/db";
import {
  assertBrowserFixtureEnvironment,
  assertLocalDockerFixtureTarget,
} from "./browser-fixture-safety.mjs";
import { runMigrationChecksumVerification } from "./verify-migration-checksums.mjs";

/**
 * Test-only, authenticated HTTP workflow for the existing browser fixtures.
 * Only real application routes create admission, lesson and audit records.
 * Browser UI/history/printing acceptance must still be performed separately.
 */
const root = fileURLToPath(new URL("../", import.meta.url));
const origin = "http://127.0.0.1:3000";
const phase = process.argv.find((part) => part.startsWith("--phase="))?.slice(8);

if (!["prepare", "verify", "revoke"].includes(phase ?? "")) {
  throw new Error("Use --phase=prepare, --phase=verify or --phase=revoke");
}

function docker(args: string[]) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1_048_576,
  });
  if (result.status !== 0 || result.error) {
    throw new Error("Local Docker verification command failed");
  }
  return result.stdout.trim();
}

function verifyDocker() {
  const context = docker(["context", "show"]);
  const endpoint = docker([
    "context",
    "inspect",
    context,
    "--format",
    "{{.Endpoints.docker.Host}}",
  ]);
  const containers = docker([
    "compose",
    "--profile",
    "test",
    "ps",
    "-q",
    "postgres-test",
  ]).split("\n");
  if (containers.length !== 1 || !containers[0]) {
    throw new Error("Expected one verified Compose test container");
  }
  const inspection = JSON.parse(docker(["inspect", containers[0]]));
  if (!Array.isArray(inspection) || inspection.length !== 1) {
    throw new Error("Could not inspect test container");
  }
  assertLocalDockerFixtureTarget(endpoint, inspection[0], root);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Unexpected API response shape");
  }
  return value as Record<string, unknown>;
}

function requireId(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 128) {
    throw new Error("Missing synthetic resource identifier");
  }
  return value;
}

function resourceId(body: unknown, key: string) {
  return requireId(requireRecord(requireRecord(body)[key]).id);
}

function list(body: unknown, key: string) {
  const value = requireRecord(body)[key];
  if (!Array.isArray(value)) {
    throw new Error("Unexpected API list response");
  }
  return value.map(requireRecord);
}

function containsId(rows: Record<string, unknown>[], id: string) {
  return rows.some((row) => row.id === id);
}

function assert(condition: unknown, description: string): asserts condition {
  if (!condition) throw new Error(description);
}

type ActorKey =
  | "adminA"
  | "teacherA"
  | "headA"
  | "principalA"
  | "studentA"
  | "unlinkedA"
  | "parentA"
  | "adminB";
type Login = { cookie: string; userId: string };

async function signIn(key: ActorKey, runId: string): Promise<Login> {
  const email = `${runId}-${key}@myschoolboard.test`;
  const signedIn = await auth.api.signInEmail({
    body: { email, password: process.env.BROWSER_FIXTURE_PASSWORD! },
    headers: new Headers({
      origin: process.env.BETTER_AUTH_URL!,
    }),
    returnHeaders: true,
  });
  const cookie = signedIn.headers
    .getSetCookie()
    .map((item) => item.split(";")[0])
    .join("; ");
  assert(cookie.includes("session_token="), "Synthetic login cookie missing");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  assert(user, "Expected existing synthetic browser actor");
  return { cookie, userId: user.id };
}

async function api(
  actor: Login,
  path: string,
  status: number,
  method: "GET" | "POST" = "GET",
  payload?: Record<string, unknown>,
) {
  assert(path.startsWith("/api/schools/"), "Only school API paths allowed");
  const response = await fetch(origin + path, {
    method,
    headers: {
      cookie: actor.cookie,
      origin: process.env.BETTER_AUTH_URL!,
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify(payload) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  assert(response.status === status, `Unexpected ${method} status on school API (expected ${status}, received ${response.status})`);
  assert(
    response.headers.get("cache-control") === "private, no-store",
    "Missing private/no-store response cache policy",
  );
  // Do not log response text: it may contain synthetic student details.
  const body: unknown = await response.json();
  return requireRecord(body);
}

async function environment() {
  assertBrowserFixtureEnvironment();
  assert(
    ["http://localhost:3000", origin].includes(
      process.env.BETTER_AUTH_URL ?? "",
    ),
    "Better Auth must use the local loopback test application",
  );
  if (phase !== "verify") {
    assert(
      process.env.BROWSER_PUPIL_WORKFLOW_WRITE === "1",
      "Set BROWSER_PUPIL_WORKFLOW_WRITE=1 for writes",
    );
  }
  if (phase === "revoke") {
    assert(
      process.env.BROWSER_PUPIL_REVOKE === "1",
      "Revoke only after separately verifying student browser access",
    );
  }
  verifyDocker();
  await runMigrationChecksumVerification();
  const home = await fetch(origin + "/", {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  assert(home.status === 200, "Local production application unavailable");
  await home.body?.cancel();

  const runId = process.env.BROWSER_FIXTURE_RUN_ID!;
  const [schoolA, schoolB] = await Promise.all(
    ["a", "b"].map((side) =>
      prisma.school.findUnique({
        where: { slug: `browser-${runId}-${side}` },
        select: { id: true, name: true },
      }),
    ),
  );
  assert(schoolA && schoolB, "Missing unique browser fixture schools");
  const keys: ActorKey[] = [
    "adminA",
    "teacherA",
    "headA",
    "principalA",
    "studentA",
    "unlinkedA",
    "parentA",
    "adminB",
  ];
  const members = await Promise.all(
    keys.map(async (key) => {
      const email = `${runId}-${key}@myschoolboard.test`;
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          memberships: {
            select: { id: true, schoolId: true, role: true, isActive: true },
          },
        },
      });
      const member = user?.memberships[0];
      assert(
        user &&
          user.memberships.length === 1 &&
          member?.isActive &&
          member.schoolId === (key === "adminB" ? schoolB.id : schoolA.id),
        "Synthetic account/school relationship mismatch",
      );
      return { key, memberId: member.id };
    }),
  );
  const member = Object.fromEntries(members.map((m) => [m.key, m.memberId]));
  const assignment = await prisma.teacherClassSubjectAssignment.findFirst({
    where: {
      schoolId: schoolA.id,
      membershipId: member.teacherA,
      status: "ACTIVE",
      schoolClass: { section: { stage: "SECONDARY", isActive: true } },
    },
    select: { id: true, classId: true, sessionId: true },
  });
  assert(
    assignment && assignment.sessionId,
    "Active secondary teacher assignment is required",
  );
  const term = await prisma.academicTerm.findFirst({
    where: {
      schoolId: schoolA.id,
      sessionId: assignment.sessionId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  assert(term, "Active academic term is required");
  const principalGrant = await prisma.scopeGrant.count({
    where: {
      membershipId: member.principalA,
      type: "SECTION",
      verified: true,
      scopeId: {
        in: (
          await prisma.schoolClass.findMany({
            where: { schoolId: schoolA.id, id: assignment.classId },
            select: { sectionId: true },
          })
        )
          .map((row) => row.sectionId)
          .filter((id): id is string => id !== null),
      },
    },
  });
  assert(principalGrant === 1, "Verified Principal SECTION grant required");

  const logins = Object.fromEntries(
    await Promise.all(
      keys.map(async (key) => [key, await signIn(key, runId)] as const),
    ),
  ) as Record<ActorKey, Login>;
  return {
    runId,
    schoolA: schoolA.id,
    schoolB: schoolB.id,
    member,
    assignment,
    termId: term.id,
    logins,
  };
}

async function stored(ctx: Awaited<ReturnType<typeof environment>>) {
  const admissionNumber = `BROWSER-${ctx.runId.toUpperCase()}`;
  const topic = `Synthetic Browser Lesson ${ctx.runId}`;
  const [student, note] = await Promise.all([
    prisma.studentRecord.findFirst({
      where: { schoolId: ctx.schoolA, admissionNumber },
      select: { id: true, status: true },
    }),
    prisma.lessonNote.findFirst({
      where: { schoolId: ctx.schoolA, topic },
      select: { id: true, status: true, currentRevision: true },
    }),
  ]);
  return { admissionNumber, topic, student, note };
}

async function assertStudentPrivacy(
  ctx: Awaited<ReturnType<typeof environment>>,
  noteId: string,
) {
  const base = `/api/schools/${ctx.schoolA}/student-lessons`;
  const linked = await api(ctx.logins.studentA, base, 200);
  const rows = list(linked, "lessons");
  assert(containsId(rows, noteId), "Expected only released synthetic lesson");
  const row = rows.find((item) => item.id === noteId)!;
  assert(
    !Object.hasOwn(row, "content") && !Object.hasOwn(row, "objectives"),
    "Student list must omit private revision text",
  );
  const detail = await api(ctx.logins.studentA, `${base}/${noteId}`, 200);
  const lesson = requireRecord(detail.lesson);
  assert(lesson.id === noteId, "Exact student lesson detail mismatch");
  assert(
    typeof lesson.content === "string" &&
      lesson.content.includes(ctx.runId),
    "Student detail missing released synthetic content",
  );
  for (const actor of ["unlinkedA", "parentA", "adminB"] as const) {
    await api(ctx.logins[actor], base, 404);
  }
}

async function prepare(ctx: Awaited<ReturnType<typeof environment>>) {
  const initial = await stored(ctx);
  assert(
    !initial.student && !initial.note,
    "Synthetic pupil workflow already started; do not replay writes",
  );
  const path = `/api/schools/${ctx.schoolA}`;
  await api(ctx.logins.studentA, `${path}/student-lessons`, 404);
  await api(ctx.logins.unlinkedA, `${path}/student-lessons`, 404);

  const registration = await api(
    ctx.logins.adminA,
    `${path}/students`,
    201,
    "POST",
    {
      admissionNumber: initial.admissionNumber,
      givenName: "Synthetic",
      familyName: "BrowserPupil",
      reason: "Synthetic browser registration for privacy checks",
    },
  );
  const studentId = resourceId(registration, "student");
  const enrollment = await api(
    ctx.logins.adminA,
    `${path}/students/${studentId}/enrollments`,
    201,
    "POST",
    {
      sessionId: ctx.assignment.sessionId,
      classId: ctx.assignment.classId,
      reason: "Synthetic browser pupil enrollment for privacy checks",
    },
  );
  requireId(requireRecord(enrollment.enrollment).id);

  const link = await api(
    ctx.logins.adminA,
    `${path}/student-links`,
    201,
    "POST",
    {
      studentId,
      studentMembershipId: ctx.member.studentA,
      reason: "Administrator verifies this synthetic pupil account",
      identityVerified: true,
    },
  );
  const linkId = resourceId(link, "link");
  const beforeRelease = await api(
    ctx.logins.studentA,
    `${path}/student-lessons`,
    200,
  );
  assert(list(beforeRelease, "lessons").length === 0, "Premature lesson leak");

  const note = await api(
    ctx.logins.teacherA,
    `${path}/lesson-notes`,
    201,
    "POST",
    {
      termId: ctx.termId,
      assignmentId: ctx.assignment.id,
      topic: initial.topic,
      objectives: `Synthetic objectives for exact pupil ${ctx.runId}`,
      content: `Synthetic browser-only released lesson content ${ctx.runId}`,
    },
  );
  const noteId = resourceId(note, "note");
  await api(
    ctx.logins.teacherA,
    `${path}/lesson-notes/${noteId}/submit`,
    200,
    "POST",
    { expectedRevision: 1 },
  );
  const principalQueue = await api(
    ctx.logins.principalA,
    `${path}/lesson-note-reviews`,
    200,
  );
  assert(
    containsId(list(principalQueue, "notes"), noteId),
    "Secondary Principal review queue missing submitted note",
  );
  const headQueue = await api(
    ctx.logins.headA,
    `${path}/lesson-note-reviews`,
    200,
  );
  assert(
    !containsId(list(headQueue, "notes"), noteId),
    "Primary Head must not see secondary note",
  );

  await api(
    ctx.logins.principalA,
    `${path}/lesson-note-reviews/${noteId}/decision`,
    200,
    "POST",
    {
      action: "APPROVE",
      expectedRevision: 1,
      reason: "Synthetic Principal exact-section academic approval",
    },
  );
  const afterApproval = await api(
    ctx.logins.studentA,
    `${path}/student-lessons`,
    200,
  );
  assert(
    list(afterApproval, "lessons").length === 0,
    "Approved but unreleased note must remain private",
  );

  const releaseQueue = await api(
    ctx.logins.principalA,
    `${path}/lesson-releases`,
    200,
  );
  assert(
    containsId(list(releaseQueue, "notes"), noteId),
    "Principal release queue missing approved revision",
  );
  const headReleaseQueue = await api(
    ctx.logins.headA,
    `${path}/lesson-releases`,
    200,
  );
  assert(
    !containsId(list(headReleaseQueue, "notes"), noteId),
    "Primary Head cannot release secondary note",
  );
  await api(
    ctx.logins.principalA,
    `${path}/lesson-releases/${noteId}/decision`,
    201,
    "POST",
    {
      action: "RELEASE",
      expectedRevision: 1,
      reason: "Synthetic Principal explicit release for student visibility",
    },
  );
  await assertStudentPrivacy(ctx, noteId);
  console.info(
    JSON.stringify({
      event: "synthetic_pupil_browser_ready",
      runId: ctx.runId,
      schoolId: ctx.schoolA,
      studentId,
      linkId,
      noteId,
      pending: "Verify positive student UI/Back/print before revoking",
    }),
  );
}

async function verify(ctx: Awaited<ReturnType<typeof environment>>) {
  const data = await stored(ctx);
  assert(
    data.student?.status === "ENROLLED" &&
      data.note?.status === "APPROVED",
    "Synthetic pupil/approved lesson not prepared",
  );
  const noteId = data.note.id;
  const release = await prisma.lessonReleaseEvent.count({
    where: {
      schoolId: ctx.schoolA,
      noteId,
      eventType: "RELEASED",
    },
  });
  assert(release === 1, "Expected one immutable release event");
  const link = await prisma.studentAccountLink.findFirst({
    where: {
      schoolId: ctx.schoolA,
      studentId: data.student.id,
    },
    select: { id: true, revocation: { select: { id: true } } },
  });
  assert(link && !link.revocation, "Synthetic student link not active");
  await assertStudentPrivacy(ctx, noteId);
  console.info(
    JSON.stringify({
      event: "synthetic_pupil_http_verified",
      runId: ctx.runId,
      schoolId: ctx.schoolA,
      noteId,
      linkId: link.id,
      status: "Released note visible only to linked student",
    }),
  );
}

async function revoke(ctx: Awaited<ReturnType<typeof environment>>) {
  await verify(ctx);
  const data = await stored(ctx);
  const link = await prisma.studentAccountLink.findFirst({
    where: {
      schoolId: ctx.schoolA,
      studentId: data.student!.id,
    },
    select: { id: true, revocation: { select: { id: true } } },
  });
  assert(link && !link.revocation, "Link already revoked");
  const path = `/api/schools/${ctx.schoolA}/student-links/${link.id}/revoke`;
  await api(ctx.logins.adminA, path, 201, "POST", {
    reason: "Synthetic browser student-link revocation after positive check",
  });
  const studentBase = `/api/schools/${ctx.schoolA}/student-lessons`;
  await api(ctx.logins.studentA, studentBase, 404);
  await api(ctx.logins.studentA, `${studentBase}/${data.note!.id}`, 404);
  const revocations = await prisma.studentAccountLinkRevocation.count({
    where: { schoolId: ctx.schoolA, linkId: link.id },
  });
  assert(revocations === 1, "Expected one immutable link revocation");
  console.info(
    JSON.stringify({
      event: "synthetic_pupil_revocation_verified",
      runId: ctx.runId,
      schoolId: ctx.schoolA,
      noteId: data.note!.id,
      deniedStatus: 404,
      pending: "Check old student browser Back/Reload/RSC/print for leakage",
    }),
  );
}

async function main() {
  const ctx = await environment();
  if (phase === "prepare") await prepare(ctx);
  else if (phase === "verify") await verify(ctx);
  else await revoke(ctx);
}

main()
  .catch((error: unknown) => {
    // Do not print error messages: HTTP/auth errors may include credentials.
    console.error(
      JSON.stringify({
        event: "synthetic_pupil_workflow_failed",
        phase,
        errorType: error instanceof Error ? error.name : "unknown",
        note: "Inspect this run's synthetic records before retrying",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
