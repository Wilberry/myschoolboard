import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { includesSource } from "./source-text.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const service = read("../src/modules/results/private-grade-preview-service.ts");
const route = read(
  "../app/api/schools/[schoolId]/private-official-report-compositions/[compositionId]/preview/route.ts",
);
const component = read("../src/components/private-grade-preview.tsx");
const workspace = read(
  "../src/components/private-official-composition-workspace.tsx",
);
const integration = read(
  "../src/modules/assessments/questions.integration.test.ts",
);

test("only active same-school School Super Admin may read exact frozen composition", () => {
  for (const text of [
    "assessmentUserId()",
    'WHERE c."schoolId"=${schoolId}',
    'AND c."id"=${compositionId}',
    'owner."schoolId"=c."schoolId"',
    'owner."userId"=${userId}',
    "owner.\"role\"='SCHOOL_SUPER_ADMIN'",
    'owner."isActive"=true',
    'school."isActive"=true',
    "INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED",
    'pupil."schoolId"=c."schoolId"',
    "pupil.\"id\"=entry.card->>'studentId'",
    'source."schoolId"=c."schoolId"',
    'source."id"=c."sourcePacketId"',
    "sourcePupil.value->>'studentId'=pupil.\"id\"",
    "parsed.data.length !== parsed.data[0].studentCount",
    "seen.has(row.studentId)",
    "LIMIT 501",
  ])
    assert.ok(service.includes(text), `Missing scope check: ${text}`);
});

test("grade preview projects only allowed fields, no source/keys or release mutation", () => {
  for (const text of [
    "entry.card->>'rawPercentBps'",
    "entry.card->>'displayPercent'",
    "entry.card->>'gradeCode'",
    "entry.card->>'remark'",
    "entry.card->'categoryPercentBps'",
    "sourcePupil.value->>'admissionNumber'",
    "sourcePupil.value->>'givenName'",
    "sourcePupil.value->>'familyName'",
  ])
    assert.ok(service.includes(text));
  assert.equal(service.includes('c."composedStudentCards" AS'), false);
  assert.equal(service.includes("SELECT c.*"), false);
  assert.ok(service.includes('source."studentSourceCards"'));
  assert.equal(service.includes('AS "studentSourceCards"'), false);
  assert.equal(service.includes('pupil."givenName" AS "givenName"'), false);
  assert.ok(route.includes("export async function GET"));
  assert.equal(route.includes("export async function POST"), false);
  assert.equal(route.includes("export async function DELETE"), false);
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("noindex, noarchive, nosnippet"));
  assert.ok(route.includes("new URL(request.url).search"));
  assert.ok(component.includes("not published"));
  assert.ok(component.includes('cache: "no-store"'));
  assert.ok(workspace.includes("Inspect private grades (not released)"));
  assert.ok(workspace.includes("<PrivateGradePreview"));
});

test("database-backed scenarios cover role, tenant, nonexistent ID, revoked owner and no source exposure", () => {
  assert.match(
    integration,
    /for \(const actor of \[\s*"teacher",\s*"student",\s*"head",\s*"principal",\s*"admin",\s*"other",?\s*\]\)\s*expect\(\(await preview\(actor\)\)\.status\)\.toBe\(404\)/,
  );
  for (const text of [
    "PRIVATE_GRADE_PREVIEW_GET(",
    'preview("super", schoolB)',
    'preview("super", schoolA, "nonexistent-composition")',
    "payloadPreview.studentCount",
    "payloadPreview.students",
    "where: { id: members.super }, data: { isActive: false }",
    'expect((await preview("super")).status).toBe(404)',
    '"composedStudentCards"',
    '"studentSourceCards"',
    '"correctIndex"',
    'data: { givenName: "LaterCorrectedIdentity" }',
    "expect(historicalRows.find((row) => row.studentId === pupilId)?.givenName",
  ]) {
    assert.ok(
      includesSource(integration, text),
      `Missing test coverage ${text}`,
    );
  }
});
