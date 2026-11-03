import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const pure = read("../src/modules/results/result-readiness.ts");
const service = read("../src/modules/results/preparation-service.ts");
const route = read("../app/api/schools/[schoolId]/result-preparation/route.ts");
const page = read("../app/schools/[schoolId]/result-preparation/page.tsx");
const workspace = read("../src/components/result-preparation-workspace.tsx");
const dashboard = read("../app/page.tsx");
const schoolPage = read("../app/schools/[schoolId]/page.tsx");
const signOut = read("../src/components/sign-out-button.tsx");
const sessionEvents = read("../src/lib/auth-session-events.ts");

test("Phase 8 preflight never grants publication from a draft grading policy", () => {
  for (const signal of [
    "PRIVATE_PREPARATION_ONLY",
    "GRADING_POLICY_NOT_ADOPTED",
    "NO_ASSESSMENT_SOURCE",
    "OBJECTIVE_SCORING_PENDING",
    "MANUAL_REVIEW_PENDING",
    "MANUAL_CORRECTION_PENDING",
    "SOURCES_RECONCILED_NOT_APPROVED",
  ])
    assert.ok(pure.includes(signal), signal);
  assert.equal(pure.includes("approvedForPublication"), false);
  assert.equal(pure.includes("publishReport"), false);
});
test("preflight uses two independently exact-teacher secured readers", () => {
  assert.ok(service.includes("readInternalTeacherClassRecord"));
  assert.ok(service.includes("readInternalReviewedManualGradebook"));
  assert.ok(service.includes("reconcileResultPreparation"));
  assert.ok(service.includes('throw new AssessmentError("CONFLICT")'));
  for (const secret of [
    "AssessmentQuestionKey",
    "correctIndex",
    "AssessmentAttemptAnswerEvent",
    "AssessmentManualMarkProposal",
  ])
    assert.equal(service.includes(secret), false, secret);
});
test("student/guardian publishing remains unavailable from preflight API", () => {
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("readInternalTeacherResultPreparation"));
  assert.ok(route.includes("export async function GET"));
  assert.equal(route.includes("export async function POST"), false);
  assert.equal(route.includes("Content-Disposition"), false);
  assert.ok(page.includes("readLessonWritingOptions"));
  assert.ok(page.includes("notFound()"));
});
test("teacher-only result preparation is linked from the reachable dashboard", () => {
  assert.ok(dashboard.includes("canShowResultPreparationLink(role)"));
  assert.ok(
    dashboard.includes("href={`/schools/${school.id}/result-preparation`}"),
  );
  assert.equal(schoolPage.includes("result-preparation"), false);
});
test("workspace conceals data and rejects stale authorization responses", () => {
  for (const event of [
    '"visibilitychange"',
    '"focus"',
    '"blur"',
    '"pageshow"',
    '"pagehide"',
    '"beforeprint"',
    '"afterprint"',
  ]) {
    assert.ok(workspace.includes(event), event);
  }
  assert.ok(workspace.includes("privatePanel.current.hidden = true"));
  assert.ok(workspace.includes("pending.current?.abort()"));
  assert.ok(workspace.includes("requestEpoch !== epoch.current"));
  assert.ok(workspace.includes("scope.current !== target"));
  assert.ok(workspace.includes("RECHECK_MS = 10_000"));
  assert.ok(workspace.includes("REQUEST_TIMEOUT_MS = 5_000"));
  assert.ok(workspace.includes('cache: "no-store"'));
  assert.ok(workspace.includes("signal: controller.signal"));
  assert.ok(workspace.includes("options.assignments.some"));
  assert.ok(workspace.includes("options.terms.some"));
  assert.ok(workspace.includes("clearSelection()"));
});
test("sign-out immediately redacts this tab and broadcasts to other tabs", () => {
  assert.ok(signOut.includes("announceSessionSignOut()"));
  assert.ok(sessionEvents.includes("SESSION_SIGN_OUT_EVENT"));
  assert.ok(sessionEvents.includes("BroadcastChannel"));
  assert.ok(workspace.includes("listenForSessionSignOut"));
  assert.ok(workspace.includes("scope.current = null"));
});
