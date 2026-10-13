import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013220000_phase8_private_owner_one_pupil_preview/migration.sql",
);
const service = read("../src/modules/results/private-owner-grade-preview-service.ts");
const api = read("../app/api/schools/[schoolId]/private-owner-grade-previews/route.ts");
const page = read("../app/schools/[schoolId]/private-grade-previews/page.tsx");
const ui = read("../src/components/private-grade-preview-workspace.tsx");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

test("database preview recomputes all exact school grades but returns only one enrolled pupil", () => {
  assert.ok(sql.includes('CREATE FUNCTION "read_private_owner_one_pupil_grade_preview"'));
  assert.ok(sql.includes('PERFORM "assert_result_publication_readiness"('));
  assert.ok(sql.includes('"build_private_official_report_cards"('));
  assert.ok(sql.includes('recomputed IS DISTINCT FROM comp."composedStudentCards"'));
  assert.ok(sql.includes('max(a2."version") FROM "ReportAggregationRuleRevision"'));
  assert.ok(sql.includes('max(g2."version") FROM "ReportGradeScaleRevision"'));
  assert.ok(sql.includes('packet."evidenceRevision" IS DISTINCT FROM comp."evidenceRevision"'));
  assert.ok(sql.includes('enrolled."sessionId"=comp."sessionId"'));
  assert.ok(sql.includes('enrolled."classId"=comp."classId"'));
  assert.ok(sql.includes('enrolled."status"=\'ACTIVE\''));
  assert.ok(sql.includes('stu."status"=\'ENROLLED\''));
  assert.ok(sql.includes('card.value->>\'studentId\'=p_student'));
  assert.ok(sql.includes("jsonb_array_length(matching)<>1"));
  assert.ok(sql.includes("'PRIVATE_OWNER_PREVIEW_NOT_RELEASED'"));
  assert.ok(sql.includes('INSERT INTO "ResultPrivateGradePreviewAudit" ('));
  assert.ok(sql.indexOf('INSERT INTO "ResultPrivateGradePreviewAudit" (') <
    sql.indexOf('RETURN jsonb_build_object('));
  assert.ok(sql.includes("'preview',jsonb_build_object("));
  assert.ok(sql.includes("'audit',jsonb_build_object("));
  const projection = sql.split("RETURN jsonb_build_object(")[1]?.split("\nEND;")[0];
  assert.ok(projection, "Explicit SQL allowlist required");
  for (const allowed of [
    "'schoolName'", "'academic'", "'assessmentWeights'",
    "'categoryPercentBps'", "'rawPercentBps'",
    "'displayPercent'", "'gradeCode'", "'remark'",
    "'evidenceRevision'", "'gradeScaleVersion'", "'aggregationRuleVersion'",
  ]) assert.ok(projection.includes(allowed), allowed);
  for (const forbidden of [
    "'studentId'", "'composedStudentCards'", "'studentSourceCards'",
    "'draftId'", "'markId'", "'attemptId'", "'correctIndex'",
  ]) assert.equal(projection.includes(forbidden), false, forbidden);
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
  assert.equal(sql.includes("GRANT SELECT"), false);
});

test("preview audit is immutable, actor-bound, same-school and contains no grades", () => {
  assert.ok(schema.includes("model ResultPrivateGradePreviewAudit {"));
  assert.ok(sql.includes('CREATE TABLE "ResultPrivateGradePreviewAudit"'));
  assert.ok(sql.includes('owner."userId"=NEW."actorUserId"'));
  assert.ok(sql.includes('owner."id"=NEW."actorMembershipId"'));
  assert.ok(sql.includes('owner."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.ok(sql.includes('enrollment."classId"=snapshot."classId"'));
  assert.ok(sql.includes('enrollment."sessionId"=snapshot."sessionId"'));
  assert.ok(sql.includes('enrollment."status"=\'ACTIVE\''));
  assert.ok(sql.includes('student."status"=\'ENROLLED\''));
  assert.ok(sql.includes('card.value->>\'studentId\'=NEW."studentId"'));

  assert.ok(sql.includes('school."isActive"=true FOR UPDATE'));
  for (const key of ["composition", "student", "actor"]) {
    assert.ok(sql.includes(`"ResultPrivateGradePreviewAudit_${key}_fkey"`));
  }
  for (const key of ["validate", "immutable", "no_truncate"]) {
    assert.ok(sql.includes(`"ResultPrivateGradePreviewAudit_${key}"`));
  }
  const auditTable = sql.split('CREATE TABLE "ResultPrivateGradePreviewAudit"')[1]
    ?.split("CREATE UNIQUE INDEX")[0] ?? "";
  for (const sensitive of [
    '"gradeCode"', '"rawPercentBps"', '"composedStudentCards"',
    '"studentSourceCards"', '"answerEvents"',
  ]) assert.equal(auditTable.includes(sensitive), false, sensitive);
  assert.ok(sql.includes('NEW."status":=\'INTERNAL_OWNER_PREVIEW_NOT_RELEASED\''));
});

test("strict owner-only POST logs each preview, never adds a recipient read route", () => {
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes(".strict()"));
  assert.ok(service.includes('"read_private_owner_one_pupil_grade_preview"('));
  assert.equal(service.includes("resultPrivateGradePreviewAudit.create("), false);
  assert.ok(service.includes("result.audit?.status"));
  assert.ok(service.includes("${randomUUID()},${parsed.data.reason}"));
  assert.ok(service.includes('"read_private_owner_one_pupil_grade_preview"('));
  assert.equal(service.includes("recipientMembershipId:"), false);
  assert.equal(service.includes("publish"), false);
  assert.ok(api.includes("export async function POST("));
  assert.equal(api.includes("export async function GET("), false);
  assert.ok(api.includes('origin !== target.origin'));
  assert.ok(api.includes("manualHeaders"));
  assert.equal(api.includes("exportReport"), false);
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(ui.includes("PRIVATE PREVIEW — NOT RELEASED"));
  assert.ok(ui.includes("NOT AN OFFICIAL REPORT CARD. NOT RELEASED."));
  assert.equal(ui.includes("downloadReport"), false);
});

test("authored authenticated regression cases deny forged, cross-tenant and revoked owner access", () => {
  for (const expected of [
    'preview("super", payload, schoolB)',
    'recipientMembershipId: members.parent',
    'Origin: "https://evil.example"',
    'gradeCode: "A"',
    'resultPrivateGradePreviewAudit.count(',
    'Direct synthetic owner preview audit regression',
    'ROLLBACK_OWNER_PREVIEW_AND_AUDIT',
    'prisma.resultPrivateGradePreviewAudit.update(',
    'prisma.resultPrivateGradePreviewAudit.delete(',
    'TRUNCATE "ResultPrivateGradePreviewAudit"',
    'data: { isActive: false }',
    'data: { verified: false }',
    'data: { status: "ENDED" }',
    ')).toBe(before + 1)',

    'INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED',
    'expect(safe).not.toContain(forbidden)',
  ]) assert.ok(integration.includes(expected), expected);
});
