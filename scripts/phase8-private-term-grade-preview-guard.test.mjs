import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const service = read("../src/modules/results/private-term-grade-preview-service.ts");
const route = read("../app/api/schools/[schoolId]/private-term-grade-previews/route.ts");
const page = read("../app/schools/[schoolId]/private-term-grade-previews/page.tsx");
const workspace = read("../src/components/private-term-grade-preview-workspace.tsx");
const schoolPage = read("../app/schools/[schoolId]/page.tsx");
const integration = read("../src/modules/assessments/questions.integration.test.ts");
const existingSql = read(
  "../prisma/migrations/20261013220000_phase8_private_owner_one_pupil_preview/migration.sql",
);

test("term preview is strict owner-only and exact school/session/term/class/pupil scoped", () => {
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes(".strict()"));
  assert.ok(service.includes('schoolId, sessionId, classId, studentId,'));
  assert.ok(service.includes('where: { schoolId, sessionId, id: termId }'));
  assert.ok(service.includes('schoolId, id: classId, isActive: true'));
  assert.ok(service.includes('student: { status: "ENROLLED" }'));
  assert.ok(service.includes('status: "ACTIVE"'));
  assert.ok(service.includes('assignment."schoolId"=${schoolId}'));
  assert.ok(service.includes('assignment."sessionId"=${sessionId}'));
  assert.ok(service.includes('assignment."classId"=${classId}'));
  assert.ok(service.includes("SELECT DISTINCT"));
  assert.ok(service.includes("LIMIT 101"));
  assert.ok(service.includes("expected.length > maximumPrivatePreviewSubjects"));
  assert.ok(service.includes("matching.some((other, index) =>"));
});

test("all subjects use an existing atomic audited SQL reader; partial failures roll back", () => {
  assert.ok(existingSql.includes(
    'INSERT INTO "ResultPrivateGradePreviewAudit" (',
  ));
  assert.ok(existingSql.includes(
    'RETURN jsonb_build_object(\n   \'preview\',jsonb_build_object(',
  ));
  assert.ok(service.includes("for (const item of selected)"));
  assert.ok(service.includes('"read_private_owner_one_pupil_grade_preview"('));
  assert.ok(service.includes("${randomUUID()},${reason}"));
  assert.ok(service.includes("result.audit?.status"));
  assert.ok(service.includes('throw new AssessmentError("CONFLICT")'));
  assert.ok(service.includes("subjects.length !== expected.length"));
  assert.ok(service.includes(
    "ACTIVE_SESSION_ASSIGNMENTS_ONLY_NOT_OFFICIAL_COMPLETENESS",
  ));
  assert.ok(service.includes("PRIVATE_TERM_OWNER_PREVIEW_NOT_RELEASED"));
  assert.equal(service.includes("resultPrivateGradePreviewAudit.create("), false);
  assert.equal(service.includes("composedStudentCards: true"), false);
  assert.equal(service.includes("exportReport"), false);
  assert.equal(service.includes("studentId: grade.studentId"), false);
});

test("single-restricted POST and UI never expose a public or official report route", () => {
  assert.ok(route.includes("export async function POST("));
  assert.equal(route.includes("export async function GET("), false);
  assert.ok(route.includes("origin !== target.origin"));
  assert.ok(route.includes("manualHeaders"));
  assert.equal(route.includes("downloadReport"), false);
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(workspace.includes("PRIVATE TERM PREVIEW — NOT RELEASED"));
  assert.ok(workspace.includes("NOT AN OFFICIAL REPORT CARD. NOT RELEASED."));
  assert.ok(workspace.includes("not a school-adopted curriculum"));
  assert.ok(schoolPage.includes("/private-term-grade-previews"));
});

test("synthetic integration covers role/tenant denial, missing grades and audit rollback", () => {
  for (const evidence of [
    'previewTerm("super", payload, schoolB)',
    'recipientMembershipId: members.parent',
    'Origin: "https://foreign.example"',
    "prisma.resultPrivateGradePreviewAudit.count(",
    "Zzz Synthetic Unapproved Term Subject",
    'prisma.teacherClassSubjectAssignment.create({',
    'expect((await previewTerm("super", payload)).status).toBe(409)',
    'data: { status: "ENDED" }',
    'data: { isActive: false }',
    "INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED",
  ]) assert.ok(integration.includes(evidence), evidence);
});
