import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = load("../prisma/schema.prisma");
const migration = load("../prisma/migrations/20261012300000_phase7_cbt_attempt_admission/migration.sql");
const service = load("../src/modules/assessments/attempt-reservation-service.ts");
const testSource = load("../src/modules/assessments/questions.integration.test.ts");

test("attempt admission enforces exact student enrollment and 1-3 immutable attempts", () => {
  assert.match(schema, /model AssessmentAttempt \{/);
  assert.match(schema, /@@unique\(\[schoolId, draftId, studentId, attemptNumber\]\)/);
  for (const name of [
    "AssessmentAttempt_draft_fkey", "AssessmentAttempt_student_fkey",
    "AssessmentAttempt_enrollment_fkey", "AssessmentAttempt_membership_fkey",
    "AssessmentAttempt_link_fkey",
  ]) assert.ok(schema.includes('map: "' + name + '"') &&
    migration.includes('CONSTRAINT "' + name + '"'), name);
  assert.match(migration, /"AssessmentAttempt_validate"/);
  assert.match(migration, /"AssessmentAttempt_immutable"/);
  assert.match(migration, /"AssessmentAttempt_no_truncate"/);
  assert.match(migration, /"attemptNumber" BETWEEN 1 AND 3/);
});

test("trusted SQL clock, serialized number, and exact verified pupil plus publication", () => {
  assert.equal((migration.match(/RETURNS trigger AS \$\$/g) ?? []).length, 1);
  assert.equal((migration.match(/\$\$ LANGUAGE plpgsql/g) ?? []).length, 1);
  assert.match(migration, /AT TIME ZONE 'UTC'/);
  assert.match(migration, /NEW\."attemptNumber" := next_number/);
  assert.match(migration, /NEW\."deadlineAt" := LEAST/);
  assert.match(migration, /"School" school[\s\S]*?FOR UPDATE/);
  assert.match(migration, /"StudentAccountLinkRevocation" revocation/);
  assert.match(migration, /"AssessmentPublicationEvent" revoked/);
  assert.match(migration, /"AssessmentReviewEvent" review/);
  assert.match(migration, /review\."decision"='APPROVED'/);
  assert.match(migration, /publish\."action"='PUBLISHED'/);
  assert.match(migration, /enrollment\."status"='ACTIVE'/);
  assert.match(migration, /member\."role"='STUDENT'/);
  assert.match(migration, /binding\."studentMembershipId"=member\."id"/);
  assert.match(migration, /prior_attempts >= allowed_attempts/);
  assert.match(migration, /active\."deadlineAt" > clock_now/);
});

test("admission is internal only; no early keys, submissions or scoring", () => {
  assert.match(service, /export async function reserveInternalCbtAttempt/);
  assert.match(service, /assessmentUserId\(\)/);
  assert.match(service, /isolationLevel: "Serializable"/);
  assert.doesNotMatch(service, /"AssessmentQuestionKey"|correctIndex|answerKey/);
  assert.doesNotMatch(migration, /CREATE TABLE "AssessmentScore"/);
  assert.doesNotMatch(migration, /CREATE TABLE "AssessmentAnswer"/);
  assert.doesNotMatch(migration, /CREATE TABLE "AssessmentAttemptSubmission"/);
  assert.match(testSource, /concurrent admission|racing/);
  assert.match(testSource, /studentAccountLinkRevocation\.create/);
});
