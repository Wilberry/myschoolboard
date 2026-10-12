import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = p => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = source("../prisma/schema.prisma");
const migration = source("../prisma/migrations/20261012290000_phase7_assessment_publication/migration.sql");
const service = source("../src/modules/assessments/publication-service.ts");
const route = source("../app/api/schools/[schoolId]/assessment-publications/[draftId]/decision/route.ts");
const listing = source("../app/api/schools/[schoolId]/assessment-publications/route.ts");

test("a unique immutable publication event differs from academic approval", () => {
  assert.match(schema, /model AssessmentPublicationEvent \{/);
  assert.match(schema, /enum AssessmentPublicationAction \{/);
  assert.match(schema, /@@unique\(\[schoolId, draftId, action\]\)/);
  assert.match(migration, /"AssessmentPublicationEvent_draft_fkey"/);
  assert.match(migration, /"AssessmentPublicationEvent_actor_fkey"/);
  assert.match(migration, /"AssessmentPublicationEvent_validate"/);
  assert.match(migration, /"AssessmentPublicationEvent_immutable"/);
  assert.match(migration, /"AssessmentPublicationEvent_no_truncate"/);
  assert.equal((migration.match(/RETURNS trigger AS \$\$/g) ?? []).length, 1);
  assert.equal((migration.match(/\$\$ LANGUAGE plpgsql/g) ?? []).length, 1);
});

test("SQL requires separate APPROVED review and active School Super Admin", () => {
  assert.match(migration, /"AssessmentReviewEvent" review/);
  assert.match(migration, /review\."decision"='APPROVED'/);
  assert.match(migration, /actor\."role"='SCHOOL_SUPER_ADMIN'/);
  assert.match(migration, /actor\."userId"=NEW\."actorUserId"/);
  assert.match(migration, /"AssessmentDraftSeal" seal/);
  assert.match(migration, /"TeacherClassSubjectAssignment" assignment/);
  assert.match(migration, /"AssessmentPublicationEvent" prior/);
  assert.match(migration, /Only currently published assessment may be withdrawn/);
});

test("no key/score/attempt/student delivery endpoint is created", () => {
  assert.match(service, /role: "SCHOOL_SUPER_ADMIN"/);
  assert.match(service, /reviews: \{ some: \{ decision: "APPROVED" \} \}/);
  assert.match(service, /isolationLevel: "Serializable"/);
  assert.doesNotMatch(service, /JOIN "AssessmentQuestionKey"/);
  assert.doesNotMatch(service, /correctIndex/);
  assert.doesNotMatch(route, /correctIndex|answerKey/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(listing, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(migration, /CREATE TABLE "AssessmentAttempt"|CREATE TABLE "AssessmentScore"/);
});
