import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const protectedPages = [
  {
    path: "../app/schools/[schoolId]/assessment-class-records/page.tsx",
    page: "ClassRecordsPage",
    content: "AuthorizedClassRecords",
    permission: "readLessonWritingOptions(session.user.id, schoolId)",
    denial: "if (!options || !options.assignments.length) notFound();",
    workspace: "AssessmentClassRecordWorkspace",
  },
  {
    path: "../app/schools/[schoolId]/attendance-correction-reviews/page.tsx",
    page: "AttendanceCorrectionReviewPage",
    content: "AuthorizedAttendanceCorrectionReview",
    permission: "readAttendanceReviewerOptions(session.user.id, schoolId)",
    denial: "if (!access) notFound();",
    workspace: "AttendanceCorrectionReviewEditor",
  },
  {
    path: "../app/schools/[schoolId]/assessment-drafts/page.tsx",
    page: "AssessmentDraftPage",
    content: "AuthorizedAssessmentDraft",
    permission: "readLessonWritingOptions(session.user.id, schoolId)",
    denial: "if (!options || !options.assignments.length) notFound();",
    workspace: "AssessmentDraftEditor",
  },
];

test("school layout suspends private pages behind a neutral fallback", () => {
  const layout = read("../app/schools/[schoolId]/layout.tsx");
  assert.match(layout, /<Suspense/);
  assert.match(layout, /\{children\}/);
  assert.match(layout, /Checking school access/);
  assert.doesNotMatch(layout, /getSession|headers\(|prisma\.|await params/);
});

test("authenticated school page shells never expose private data", () => {
  for (const entry of protectedPages) {
    const source = read(entry.path);
    const offset = source.indexOf(`async function ${entry.content}(`);
    assert.ok(offset > 0, entry.path);
    const shell = source.slice(
      source.indexOf(`export default function ${entry.page}(`),
      offset,
    );
    const secure = source.slice(offset);
    assert.match(shell, /<Suspense/);
    assert.ok(shell.includes(`<${entry.content} params={params} />`));
    assert.doesNotMatch(shell, /getSession|headers\(|await params/);
    assert.ok(!shell.includes(entry.workspace), entry.path);
    assert.match(secure, /auth\.api\.getSession/);
    assert.match(secure, /headers\(\)/);
    assert.match(secure, /if \(!session\) redirect/);
    assert.match(secure, /const \{ schoolId \} = await params/);
    assert.ok(secure.includes(entry.permission), entry.path);
    assert.ok(secure.includes(entry.denial), entry.path);
    assert.ok(secure.includes(entry.workspace), entry.path);
  }
});

test("grading policy page retains exact school super admin authorization", () => {
  const page = read(
    "../app/schools/[schoolId]/assessment-grading-policies/page.tsx",
  );
  assert.match(page, /auth\.api\.getSession/);
  assert.match(page, /role: "SCHOOL_SUPER_ADMIN"/);
  assert.match(page, /userId: session\.user\.id/);
  assert.match(page, /school: \{ isActive: true \}/);
  assert.match(page, /if \(!admin\) notFound\(\)/);
  assert.match(page, /AssessmentGradingPolicyEditor/);
});
