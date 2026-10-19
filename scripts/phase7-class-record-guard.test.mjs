import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const svc = read("../src/modules/assessments/class-record-service.ts");
const scoring = read("../src/modules/assessments/objective-score-service.ts");
const route = read(
  "../app/api/schools/[schoolId]/assessment-class-records/route.ts",
);
const scoringRoute = read(
  "../app/api/schools/[schoolId]/assessment-scores/[attemptId]/route.ts",
);
const compact = (source) => source.replace(/\s+/g, "");
test("class sheets repeat teacher exact current class subject session term authorization", () => {
  for (const key of [
    'teacher."userId"=${userId}',
    "teacher.\"role\"='TEACHER'",
    'assignment."classId"=${classId}',
    'assignment."subjectId"=${subjectId}',
    'assignment."sessionId"=${sessionId}',
    'term."id"=${termId}',
    "enrollment.\"status\"='ACTIVE'",
    "pupil.\"status\"='ENROLLED'",
    "review.\"decision\"='APPROVED'",
    "published.\"action\"='PUBLISHED'",
    "withdrawn.\"action\"='WITHDRAWN'",
    '"AssessmentAttemptScore" score',
    'score."percentBps" DESC',
    'attempt."enrollmentId"=enrollment."id"',
  ])
    assert.ok(svc.includes(key), key);
  assert.match(
    compact(svc),
    /student\.assessments\.some\(\(?a\)?=>a\.draftId===row\.draftId\)/,
  );
  assert.match(svc, /grouped\.size > 500/);
  assert.doesNotMatch(svc, /AssessmentQuestionKey|correctIndex|selectedIndex/);
});
test("provisional teacher class record route is private and not an official release", () => {
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(route, /readInternalTeacherClassRecord/);
  assert.match(route, /"PROVISIONAL"/);
  assert.doesNotMatch(route, /correctIndex|answerKey/);
});
test("marking queue is scoped to teacher, no answers or keys; score POST accepts no body", () => {
  assert.match(scoring, /listOwnUnscoredCbtAttempts/);
  assert.match(scoring, /teacher\."userId"=\$\{userId\}/);
  assert.match(scoring, /scored\."id" IS NULL/);
  assert.doesNotMatch(scoring, /JOIN "AssessmentQuestionKey"|"correctIndex"/);
  assert.match(scoringRoute, /request\.body !== null/);
  assert.match(scoringRoute, /scoreInternalSubmittedAttempt/);
  assert.match(scoringRoute, /"Cache-Control": "private, no-store"/);
});

test("private class-record page defers request-scoped authentication and params behind Suspense", () => {
  const page = read("../app/schools/[schoolId]/assessment-class-records/page.tsx");
  const authorizedStart = page.indexOf("async function AuthorizedClassRecords(");
  assert.ok(authorizedStart > 0);
  const publicShell = page.slice(
    page.indexOf("export default function ClassRecordsPage("),
    authorizedStart,
  );
  const authorized = page.slice(authorizedStart);
  assert.match(publicShell, /<Suspense/);
  assert.match(publicShell, /<AuthorizedClassRecords params=\{params\}/);
  assert.doesNotMatch(publicShell, /auth\.api\.getSession|await headers\(\)|await params/);
  assert.match(authorized, /auth\.api\.getSession\(\{ headers: await headers\(\) \}\)/);
  assert.match(authorized, /if \(!session\) redirect\("\/"\)/);
  assert.match(authorized, /const \{ schoolId \} = await params/);
  assert.match(authorized, /readLessonWritingOptions\(session\.user\.id, schoolId\)/);
  assert.match(authorized, /if \(!options \|\| !options\.assignments\.length\) notFound\(\)/);
  assert.doesNotMatch(publicShell, /AssessmentClassRecordWorkspace|options\.school\.name/);
});
