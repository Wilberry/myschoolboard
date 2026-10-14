import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const migration = read("../prisma/migrations/20261012270000_phase7_assessment_drafts/migration.sql");
const service = read("../src/modules/assessments/draft-service.ts");
const route = read("../app/api/schools/[schoolId]/assessment-drafts/route.ts");

test("assessment configurations are immutable DRAFT-ONLY without delivery fields", () => {
  assert.match(schema, /model AssessmentDraft \{/);
  assert.match(schema, /model AssessmentDraftQuestion \{/);
  const draftSchema = schema.match(/model AssessmentDraft \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(draftSchema, /isPublished|PUBLISHED|releasedAt|answerKey|correctIndex/);
  // Later Phase 7 added controlled CBT attempts, not an implicit draft release.
  assert.match(draftSchema, /attempts\s+AssessmentAttempt\[\]/);
  assert.doesNotMatch(migration, /CREATE TABLE "AssessmentAttempt"/);
  assert.match(migration, /"AssessmentDraft_immutable"/);
  assert.match(migration, /"AssessmentDraftQuestion_immutable"/);
  assert.match(migration, /"AssessmentDraftSeal_validate"/);
  assert.match(migration, /"AssessmentDraftSeal_immutable"/);
  assert.match(migration, /"AssessmentDraftSeal_no_truncate"/);
  assert.match(migration, /"A sealed assessment draft cannot accept new items"/);
  assert.match(service, /tx\.assessmentDraftSeal\.create/);
  assert.match(service, /JOIN "AssessmentDraftSeal" seal/);

  assert.match(migration, /"AssessmentDraft_no_truncate"/);
  assert.match(migration, /"AssessmentDraftQuestion_no_truncate"/);
});
test("DB enforces exact teacher assignment and grading/attempt limits", () => {
  assert.match(migration, /"AssessmentDraft_exact_assignment_fkey"/);
  assert.match(migration, /"AssessmentDraftQuestion_draft_fkey"/);
  assert.match(migration, /"AssessmentDraftQuestion_question_fkey"/);
  assert.match(migration, /"AssessmentDraft_validate"/);
  assert.match(migration, /"AssessmentDraftQuestion_validate"/);
  assert.match(migration, /"maxAttempts" BETWEEN 1 AND 3/);
  assert.match(migration, /"passPercent" BETWEEN 0 AND 100/);
  assert.match(migration, /"durationMinutes" BETWEEN 5 AND 180/);
  assert.match(migration, /"position" BETWEEN 1 AND 50/);
  assert.match(migration, /"points" BETWEEN 1 AND 20/);
});
test("draft service selects exact keyed questions and protects actor identity", () => {
  assert.match(service, /exactAssessmentTeacher\(/);
  assert.match(service, /answerKey: \{ isNot: null \}/);
  assert.match(service, /tx\.assessmentDraft\.create/);
  assert.match(service, /tx\.assessmentDraftQuestion\.createMany/);
  assert.match(service, /isolationLevel: "Serializable"/);
  assert.doesNotMatch(route, /correctIndex/);
  assert.doesNotMatch(route, /answerKey/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
});
test("draft migration never publishes scores or changes existing records", () => {
  assert.doesNotMatch(migration, /\bDROP TABLE\b|\bTRUNCATE TABLE\b|\bUPDATE\s+"AttendanceEntry"/i);
  assert.doesNotMatch(migration, /CREATE TABLE "AssessmentAttempt"|CREATE TABLE "AssessmentScore"/);
});
