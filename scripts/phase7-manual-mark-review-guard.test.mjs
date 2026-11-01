import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261012350000_phase7_manual_mark_section_approval/migration.sql",
);
const service = read("../src/modules/assessments/manual-review-service.ts");
test("manual mark review requires independently verified exact section", () => {
  assert.match(schema, /model AssessmentManualMarkDecision \{/);
  assert.match(schema, /@@unique\(\[schoolId, proposalId\]\)/);
  assert.match(schema, /@@unique\(\[schoolId, id\]\)/);
  for (const name of [
    "AssessmentManualMarkDecision_proposal_fkey",
    "AssessmentManualMarkDecision_reviewer_fkey",
    "AssessmentManualMarkDecision_validate",
    "AssessmentManualMarkDecision_immutable",
    "AssessmentManualMarkDecision_no_truncate",
  ]) {
    assert.ok(sql.includes('"' + name + '"'), name);
  }
  assert.match(sql, /scope\."type"='SECTION'/);
  assert.match(sql, /scope\."verified"=true/);
  assert.match(sql, /scope\."scopeId"=section\."id"/);
  assert.match(
    sql,
    /reviewer\."role"='HEAD_OF_SECTION' AND section\."stage"='PRIMARY'/,
  );
  assert.match(
    sql,
    /reviewer\."role"='PRINCIPAL' AND section\."stage"='SECONDARY'/,
  );
  assert.match(sql, /p_reviewer_user <> proposal\."actorUserId"/);
  assert.match(sql, /NEW\."decidedAt":=/);
  assert.match(sql, /FOR UPDATE/);
});
test("review queue is final-query scoped and neither reads keys nor publishes marks", () => {
  assert.match(service, /listManualMarkReviewQueue/);
  assert.match(service, /decideInitialManualMark/);
  assert.match(service, /scope\."verified"=true/);
  assert.match(service, /reviewer\."userId"=\$\{actor\}/);
  assert.match(service, /school\."isActive"=true/);
  assert.doesNotMatch(service, /AssessmentQuestionKey|correctIndex|ReportCard/);
});
