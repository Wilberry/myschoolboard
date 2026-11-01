import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = source("../prisma/schema.prisma");
const older = source(
  "../prisma/migrations/20261012270000_phase7_assessment_drafts/migration.sql",
);
const review = source(
  "../prisma/migrations/20261012280000_phase7_assessment_review/migration.sql",
);
const queue = source("../src/modules/assessments/review-service.ts");
const preview = source(
  "../app/api/schools/[schoolId]/assessment-reviews/[draftId]/route.ts",
);
const decision = source(
  "../app/api/schools/[schoolId]/assessment-reviews/[draftId]/decision/route.ts",
);
const policy = source("../src/modules/assessments/cbt-admission-policy.ts");

test("repair assessment SQL dollar quote syntax in prior draft migration", () => {
  assert.equal((older.match(/RETURNS trigger AS \$\$/g) ?? []).length, 3);
  assert.equal((older.match(/\$\$ LANGUAGE plpgsql/g) ?? []).length, 3);
  assert.doesNotMatch(older, /RETURNS trigger AS \$(?!\$)/);
  assert.doesNotMatch(older, /(?<!\$)\$ LANGUAGE plpgsql/);
});

test("review is an immutable school-bound terminal section decision", () => {
  assert.match(schema, /model AssessmentReviewEvent \{/);
  assert.match(schema, /@@unique\(\[schoolId, draftId\]\)/);
  assert.match(schema, /enum AssessmentReviewDecision \{/);
  assert.match(review, /"AssessmentReviewEvent_draft_fkey"/);
  assert.match(review, /"AssessmentReviewEvent_reviewer_fkey"/);
  assert.match(review, /"AssessmentReviewEvent_validate"/);
  assert.match(review, /"AssessmentReviewEvent_immutable"/);
  assert.match(review, /"AssessmentReviewEvent_no_truncate"/);
  assert.match(review, /"AssessmentDraftSeal" seal/);
  assert.match(review, /"ScopeGrant" scope/);
  assert.match(review, /scope\."verified"=true/);
  assert.match(review, /"HEAD_OF_SECTION"|'HEAD_OF_SECTION'/);
  assert.match(review, /"PRINCIPAL"|'PRINCIPAL'/);
  assert.equal((review.match(/RETURNS trigger AS \$\$/g) ?? []).length, 1);
  assert.equal((review.match(/\$\$ LANGUAGE plpgsql/g) ?? []).length, 1);
});

test("reviewer queue and preview bind exact assigned section and never join key", () => {
  assert.match(queue, /scope\."scopeId"=section\."id"/);
  assert.match(queue, /reviewer\."userId"=\$\{userId\}/);
  assert.match(queue, /"AssessmentDraftSeal"/);
  assert.match(queue, /NOT EXISTS \(SELECT 1 FROM "AssessmentReviewEvent"/);
  assert.doesNotMatch(queue, /JOIN "AssessmentQuestionKey"/);
  assert.doesNotMatch(preview, /correctIndex|answerKey/);
  assert.doesNotMatch(decision, /correctIndex|answerKey/);
  assert.match(preview, /"Cache-Control": "private, no-store"/);
  assert.match(decision, /"Cache-Control": "private, no-store"/);
});

test("future CBT attempt policy is pure, not a student attempt authorization", () => {
  assert.match(policy, /computeAttemptDeadline/);
  assert.match(policy, /evaluateAttemptAdmission/);
  assert.match(policy, /ACTIVE_ATTEMPT/);
  assert.match(policy, /ATTEMPT_LIMIT/);
  assert.match(policy, /scheduledEnd/);
  assert.doesNotMatch(
    policy,
    /from ["'](?:@\/src\/lib\/(?:db|auth)|next\/headers)["']/,
  );
  assert.doesNotMatch(policy, /prisma\.\$transaction|PrismaClient/);
  assert.doesNotMatch(review, /CREATE TABLE "AssessmentAttempt"/);
});
