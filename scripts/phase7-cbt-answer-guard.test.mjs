import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261012310000_phase7_cbt_answer_submission/migration.sql");
const service = read("../src/modules/assessments/attempt-answer-service.ts");
const tests = read("../src/modules/assessments/questions.integration.test.ts");

test("separate append-only answer revisions and final submissions retain tenant FKs", () => {
  assert.match(schema, /model AssessmentAttemptAnswerEvent \{/);
  assert.match(schema, /model AssessmentAttemptSubmission \{/);
  assert.match(schema, /@@unique\(\[schoolId, attemptId, requestKey\]\)/);
  assert.match(schema, /@@unique\(\[schoolId, attemptId, questionId, revision\]\)/);
  assert.match(schema, /@@unique\(\[schoolId, attemptId\]\)/);
  for (const name of [
    "AssessmentAttemptAnswerEvent_attempt_fkey",
    "AssessmentAttemptAnswerEvent_question_fkey",
    "AssessmentAttemptAnswerEvent_actor_fkey",
    "AssessmentAttemptSubmission_attempt_fkey",
    "AssessmentAttemptSubmission_actor_fkey",
  ]) assert.ok(schema.includes('map: "' + name + '"') &&
    sql.includes('"' + name + '"'), name);
  for (const name of [
    "AssessmentAttemptAnswerEvent_validate",
    "AssessmentAttemptSubmission_validate",
    "AssessmentAttemptAnswerEvent_immutable",
    "AssessmentAttemptSubmission_immutable",
    "AssessmentAttemptAnswerEvent_no_truncate",
    "AssessmentAttemptSubmission_no_truncate",
  ]) assert.ok(sql.includes('"' + name + '"'), name);
});
test("two insert triggers share exact active student, publisher and deadline guard", () => {
  assert.equal((sql.match(/RETURNS trigger AS \$\$/g) ?? []).length, 2);
  assert.equal((sql.match(/\$\$ LANGUAGE plpgsql/g) ?? []).length, 3);
  assert.match(sql, /"assert_cbt_attempt_writable"/);
  assert.match(sql, /school\."isActive"=true FOR UPDATE/);
  assert.match(sql, /FOR UPDATE OF attempt/);
  assert.match(sql, /member\."userId"=p_actor_user/);
  assert.match(sql, /member\."role"='STUDENT'/);
  assert.match(sql, /enrollment\."status"='ACTIVE'/);
  assert.match(sql, /review\."decision"='APPROVED'/);
  assert.match(sql, /published\."action"='PUBLISHED'/);
  assert.match(sql, /"StudentAccountLinkRevocation" revoked/);
  assert.match(sql, /"AssessmentPublicationEvent" withdrawn/);
  assert.match(sql, /server_now >= actual_deadline/);
  assert.match(sql, /"AssessmentAttemptSubmission" finish/);
});
test("DB calculates revision and disallows non-assessment choices and late edits", () => {
  assert.match(sql, /NEW\."revision" := next_revision/);
  assert.match(sql, /NEW\."createdAt" := server_now/);
  assert.match(sql, /NEW\."submittedAt" := "assert_cbt_attempt_writable"/);
  assert.match(sql, /item\."questionId"=NEW\."questionId"/);
  assert.match(sql, /NEW\."selectedIndex" >= option_count/);
  assert.match(sql, /Duplicate autosave key/);
});
test("internal authenticated and idempotent services do not reveal answer keys", () => {
  assert.match(service, /saveInternalCbtAnswer/);
  assert.match(service, /submitInternalCbtAttempt/);
  assert.match(service, /assessmentUserId\(\)/);
  assert.match(service, /"Serializable"/);
  assert.match(service, /saved\.selectedIndex !== selectedIndex/);
  assert.match(service, /previous\.requestKey !== parsed\.data\.idempotencyKey/);
  assert.doesNotMatch(service, /"AssessmentQuestionKey"|correctIndex|answerKey/);
  assert.doesNotMatch(sql, /JOIN "AssessmentQuestionKey"/);
  assert.match(tests, /assessmentAttemptSubmission\.delete/);
  assert.match(tests, /assessmentAttemptAnswerEvent\.update/);
  assert.match(tests, /saveInternalCbtAnswer/);
  assert.match(tests, /submitInternalCbtAttempt/);
});
