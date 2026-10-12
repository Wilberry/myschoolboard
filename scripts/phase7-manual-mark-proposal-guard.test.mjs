import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261012340000_phase7_manual_mark_proposals/migration.sql");
const svc = read("../src/modules/assessments/manual-mark-service.ts");
const get = read("../app/api/schools/[schoolId]/assessment-manual-components/[componentId]/students/route.ts");
const post = read("../app/api/schools/[schoolId]/assessment-manual-proposals/route.ts");
const sheet = read("../src/modules/assessments/class-record-service.ts");

test("offline component and initial pupil mark are append-only, not objective or official results", () => {
  assert.match(schema, /model AssessmentManualComponent \{/);
  assert.match(schema, /model AssessmentManualMarkProposal \{/);
  assert.match(schema, /@@unique\(\[schoolId, componentId, studentId\]\)/);
  assert.match(sql, /"maxPoints" BETWEEN 1 AND 100/);
  assert.match(sql, /"earnedPoints" BETWEEN 0 AND 100/);
  assert.match(sql, /NEW\."earnedPoints" > max_points/);
  for (const name of [
    "AssessmentManualComponent_validate", "AssessmentManualMarkProposal_validate",
    "AssessmentManualComponent_immutable", "AssessmentManualMarkProposal_immutable",
    "AssessmentManualComponent_no_truncate", "AssessmentManualMarkProposal_no_truncate",
  ]) assert.ok(sql.includes('"' + name + '"'), name);
  assert.equal((sql.match(/RETURNS trigger AS \$\$/g) ?? []).length, 2);
  assert.equal((sql.match(/\$\$ LANGUAGE plpgsql/g) ?? []).length, 2);
  assert.doesNotMatch(sql, /CREATE TABLE "AssessmentAttemptScore"|CREATE TABLE "OfficialResult"/);
  assert.doesNotMatch(sheet, /AssessmentManualMarkProposal|AssessmentManualComponent/);
});
test("SQL independently binds actual current teacher and exact pupil enrollment", () => {
  for (const name of [
    "AssessmentManualComponent_assignment_fkey",
    "AssessmentManualMarkProposal_component_fkey",
    "AssessmentManualMarkProposal_enrollment_fkey",
    "AssessmentManualMarkProposal_actor_fkey",
  ]) assert.ok(schema.includes('map: "' + name + '"') &&
    sql.includes('"' + name + '"'), name);
  for (const token of [
    'teacher."userId"=NEW."actorUserId"',
    'teacher."id"=NEW."actorMembershipId"',
    'teacher."role"=\'TEACHER\'',
    'assignment."status"=\'ACTIVE\'',
    'enrollment."studentId"=NEW."studentId"',
    'enrollment."status"=\'ACTIVE\'',
    'pupil."status"=\'ENROLLED\'',
    'component."classId"=NEW."classId"',
  ]) assert.ok(sql.includes(token), token);
});
test("private signed-in teacher is the only source of mark actor and roster names", () => {
  assert.match(svc, /exactAssessmentTeacher\(/);
  assert.match(svc, /assessmentUserId\(\)/);
  assert.match(svc, /teacherUserId: userId/);
  assert.match(svc, /studentEnrollment\.findMany/);
  assert.match(svc, /new Set\(pupils\.map\(p => p\.studentId\)\)/);
  assert.match(svc, /teacher\."userId"=\$\{userId\}/);
  assert.match(get, /"Cache-Control"|manualHeaders/);
  assert.match(post, /"Cache-Control"|manualHeaders/);
  assert.doesNotMatch(svc, /AssessmentQuestionKey|correctIndex|answerKey/);
});
