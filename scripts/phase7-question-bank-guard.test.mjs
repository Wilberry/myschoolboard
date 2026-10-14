import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = (relative) =>
  readFileSync(new URL(relative, import.meta.url), "utf8");
const schema = load("../prisma/schema.prisma");
const migration = load(
  "../prisma/migrations/20261012260000_phase7_question_bank/migration.sql",
);
const service = load("../src/modules/assessments/question-service.ts");
const route = load(
  "../app/api/schools/[schoolId]/assessment-questions/route.ts",
);

test("question and answer key live in separate school-bound, immutable tables", () => {
  assert.match(schema, /model AssessmentQuestion \{/);
  assert.match(schema, /model AssessmentQuestionKey \{/);
  assert.match(migration, /"AssessmentQuestion_exact_assignment_fkey"/);
  assert.match(migration, /"AssessmentQuestionKey_question_fkey"/);
  assert.match(migration, /"AssessmentQuestion_validate"/);
  assert.match(migration, /"AssessmentQuestionKey_validate"/);
  for (const token of [
    "AssessmentQuestion_immutable",
    "AssessmentQuestionKey_immutable",
    "AssessmentQuestion_no_truncate",
    "AssessmentQuestionKey_no_truncate",
  ])
    assert.ok(migration.includes(token), token);
});
test("DB actor guards exact active school/class/subject/session/term teacher assignment", () => {
  assert.match(migration, /"teacherUserId"/);
  assert.match(migration, /"role"='TEACHER'/);
  assert.match(migration, /"status"='ACTIVE'/);
  assert.match(migration, /"AcademicTerm"/);
  assert.match(migration, /"SchoolSection"/);
  assert.match(migration, /"TeacherClassSubjectAssignment"/);
  assert.match(migration, /"AssessmentQuestionKey_index_check"/);
});
test("HTTP read and write projections do not return secret answer indexes", () => {
  assert.match(service, /tx\.assessmentQuestionKey\.create/);
  assert.match(service, /tx\.assessmentQuestion\.create/);
  assert.match(
    service,
    /select:\s*\{\s*id:\s*true,\s*schoolId:\s*true,\s*classId:\s*true/,
  );
  assert.match(service, /FROM "AssessmentQuestion" q/);
  assert.doesNotMatch(service, /JOIN "AssessmentQuestionKey" key/);
  assert.doesNotMatch(route, /correctIndex/);
  assert.doesNotMatch(route, /answerKey/);
  assert.match(route, /Cache-Control": "private, no-store"/);
});
test("migration is additive and does not alter student marks or existing audits", () => {
  assert.doesNotMatch(
    migration,
    /\bDROP TABLE\b|\bTRUNCATE TABLE\b|\bUPDATE\s+"StudentRecord"\b|\bUPDATE\s+"AttendanceEntry"\b/i,
  );
});
