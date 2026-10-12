import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = p => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = source("../prisma/schema.prisma");
const sql = source("../prisma/migrations/20261012330000_phase7_grading_policy_revisions/migration.sql");
const svc = source("../src/modules/assessments/grading-policy-service.ts");
const pure = source("../src/modules/assessments/grading-policy.ts");
const sheet = source("../src/modules/assessments/class-record-service.ts");
const route = source("../app/api/schools/[schoolId]/assessment-grading-policies/route.ts");
test("school grading revision is append-only and always a DRAFT preview", () => {
  assert.match(schema, /model AssessmentGradingPolicyRevision \{/);
  assert.match(schema, /@@unique\(\[schoolId, sessionId, termId, classId, subjectId, version\]/);
  for (const name of ["AssessmentGradingPolicyRevision_actor_fkey",
    "AssessmentGradingPolicyRevision_session_fkey",
    "AssessmentGradingPolicyRevision_term_fkey",
    "AssessmentGradingPolicyRevision_schoolClass_fkey",
    "AssessmentGradingPolicyRevision_subject_fkey"]) {
    assert.ok(schema.includes('map: "' + name + '"') && sql.includes('"' + name + '"'), name);
  }
  for (const name of ["AssessmentGradingPolicyRevision_validate",
    "AssessmentGradingPolicyRevision_immutable",
    "AssessmentGradingPolicyRevision_no_truncate"]) assert.ok(sql.includes('"' + name + '"'), name);
  assert.equal((sql.match(/RETURNS trigger AS \$\$/g) ?? []).length, 1);
  assert.equal((sql.match(/\$\$ LANGUAGE plpgsql/g) ?? []).length, 1);
  assert.match(sql, /"quizWeight"\+"testWeight"\+"examWeight"/);
  assert.match(sql, /"version" := next_version/);
  assert.match(sql, /"School" school[\s\S]*?FOR UPDATE/);
  assert.match(sql, /actor\."role"='SCHOOL_SUPER_ADMIN'/);
  assert.match(svc, /role: "SCHOOL_SUPER_ADMIN"/);
  assert.match(svc, /DRAFT_PREVIEW_ONLY/);
  assert.doesNotMatch(sql, /CREATE TABLE "OfficialResult"|CREATE TABLE "ReportCard"/);
});
test("weighted previews fail closed for missing assessment types and grades", () => {
  assert.match(pure, /validateGradingWeights/);
  assert.match(pure, /pendingRequired = true/);
  assert.match(pure, /weight > 0 && !complete/);
  assert.match(pure, /status: pendingRequired \? "PENDING" : "READY"/);
  assert.match(sheet, /gradingPolicy.*status: "DRAFT_PREVIEW_ONLY"/s);
  assert.match(sheet, /calculateWeightedPreview/);
  assert.match(sheet, /policy\."schoolId"=school\."id"/);
  assert.match(sheet, /policy\."termId"=term\."id"/);
  assert.doesNotMatch(sheet, /AssessmentQuestionKey|correctIndex|selectedIndex/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
});
