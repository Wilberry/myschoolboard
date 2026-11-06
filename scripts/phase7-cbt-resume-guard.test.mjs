import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const read = source("../src/modules/assessments/attempt-resume-reader.ts");
test("final question query binds signed-in student, active class/session, unrevoked attestation", () => {
  for (const token of [
    'member."userId"=${userId}',
    "member.\"role\"='STUDENT'",
    '"StudentAccountLink" binding',
    '"StudentAccountLinkRevocation" revoked',
    "enrollment.\"status\"='ACTIVE'",
    'question."termId"=draft."termId"',
    '"AssessmentDraftSeal" seal',
    '"AssessmentReviewEvent" review',
    "publication.\"action\"='PUBLISHED'",
    '"AssessmentPublicationEvent" withdrawn',
    '"AssessmentAttemptSubmission" finalized',
    '"AssessmentAttemptAnswerEvent" response',
    'response."revision" DESC',
    "LIMIT 50",
  ])
    assert.ok(read.includes(token), token);
});
test("read discloses only questions and own latest selections while attempt open", () => {
  assert.match(read, /clock_timestamp\(\) AT TIME ZONE 'UTC'/);
  assert.match(read, /attempt\."deadlineAt"/);
  assert.match(read, /selectedIndex: row\.selectedIndex/);
  assert.doesNotMatch(
    read,
    /JOIN "AssessmentQuestionKey"|"correctIndex"|answerKey/,
  );
  assert.doesNotMatch(
    read,
    /student\.givenName|student\.familyName|pupil\."givenName"/,
  );
});
