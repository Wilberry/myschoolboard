import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261012320000_phase7_cbt_objective_scoring/migration.sql",
);
const svc = read("../src/modules/assessments/objective-score-service.ts");
test("scoring audit is immutable, once per submitted school-bound attempt", () => {
  assert.match(schema, /model AssessmentAttemptScore \{/);
  assert.match(schema, /@@unique\(\[schoolId, attemptId\]\)/);
  for (const name of [
    "AssessmentAttemptScore_attempt_fkey",
    "AssessmentAttemptScore_scorer_fkey",
    "AssessmentAttemptScore_validate",
    "AssessmentAttemptScore_immutable",
    "AssessmentAttemptScore_no_truncate",
  ])
    assert.ok(sql.includes(name), name);
});
test("keys are only joined within database-calculated objective score", () => {
  assert.match(sql, /JOIN "AssessmentQuestionKey" key/);
  assert.match(sql, /ORDER BY answer\."revision" DESC/);
  assert.match(sql, /"AssessmentAttemptSubmission" final/);
  assert.match(sql, /review\."decision"='APPROVED'/);
  assert.match(sql, /publication\."action"='PUBLISHED'/);
  assert.match(sql, /withdrawn\."action"='WITHDRAWN'/);
  assert.match(sql, /scorer\."id"=draft\."teacherMembershipId"/);
  assert.match(sql, /earned_score \* 10000\.0 \/ max_score/);
  assert.match(sql, /NEW\."passed" :=/);
  assert.equal((sql.match(/RETURNS trigger AS \$\$/g) ?? []).length, 1);
  assert.equal((sql.match(/\$\$ LANGUAGE plpgsql/g) ?? []).length, 1);
  assert.doesNotMatch(svc, /AssessmentQuestionKey|correctIndex|answerKey/);
  assert.match(svc, /scoreInternalSubmittedAttempt/);
  assert.match(svc, /"Serializable"/);
});
