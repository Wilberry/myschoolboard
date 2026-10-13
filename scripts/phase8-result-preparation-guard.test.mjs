import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const pure = read("../src/modules/results/result-readiness.ts");
const service = read("../src/modules/results/preparation-service.ts");
const route = read("../app/api/schools/[schoolId]/result-preparation/route.ts");
const page = read("../app/schools/[schoolId]/result-preparation/page.tsx");

test("Phase 8 preflight never grants publication from a draft grading policy", () => {
  for (const signal of [
    "PRIVATE_PREPARATION_ONLY",
    "GRADING_POLICY_NOT_ADOPTED",
    "NO_ASSESSMENT_SOURCE",
    "OBJECTIVE_SCORING_PENDING",
    "MANUAL_REVIEW_PENDING",
    "MANUAL_CORRECTION_PENDING",
    "SOURCES_RECONCILED_NOT_APPROVED",
  ]) assert.ok(pure.includes(signal), signal);
  assert.equal(pure.includes("approvedForPublication"), false);
  assert.equal(pure.includes("publishReport"), false);
});
test("preflight uses two independently exact-teacher secured readers", () => {
  assert.ok(service.includes("readInternalTeacherClassRecord"));
  assert.ok(service.includes("readInternalReviewedManualGradebook"));
  assert.ok(service.includes("reconcileResultPreparation"));
  assert.ok(service.includes('throw new AssessmentError("CONFLICT")'));
  for (const secret of [
    "AssessmentQuestionKey", "correctIndex",
    "AssessmentAttemptAnswerEvent", "AssessmentManualMarkProposal",
  ]) assert.equal(service.includes(secret), false, secret);
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
