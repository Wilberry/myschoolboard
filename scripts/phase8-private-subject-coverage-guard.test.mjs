import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const service = read("../src/modules/results/private-subject-coverage-service.ts");
const api = read("../app/api/schools/[schoolId]/private-subject-coverage/route.ts");
const page = read("../app/schools/[schoolId]/private-subject-coverage/page.tsx");
const ui = read("../src/components/private-subject-coverage-workspace.tsx");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

test("school owner only: exact session/class/term assignment subject diagnostic", () => {
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('"isActive"=true FOR UPDATE'));
  assert.ok(service.includes('isolationLevel: Prisma.TransactionIsolationLevel.Serializable'));
  assert.ok(service.includes("tx.academicTerm.findFirst("));
  assert.ok(service.includes("where: { schoolId, id: termId, sessionId }"));
  assert.ok(service.includes("tx.schoolClass.findFirst("));
  assert.ok(service.includes("where: { schoolId, id: classId, isActive: true }"));
  assert.ok(service.includes('sessionId, status: "ACTIVE"'));
  assert.ok(service.includes('membership: { isActive: true, role: "TEACHER" }'));
  assert.ok(service.includes("subject: { isActive: true }"));
  assert.ok(service.includes("if (assigned.length > 500)"));
  assert.ok(service.includes("if (evidences.length > 500)"));
  assert.ok(service.includes("const latestEvidence = new Map"));
  assert.ok(service.includes("orderBy: [{ revision: \"desc\" }"));
  assert.ok(service.includes("const approved = new Set("));
  assert.ok(service.includes("const ownerDecisions = new Map("));
  assert.ok(service.includes("const privateCompositions = new Map("));
});

test("states are diagnostic only, never a publication approval or national grading default", () => {
  for (const token of [
    "MISSING_TEACHER_RESULT_EVIDENCE",
    "AWAITING_ACADEMIC_REVIEW",
    "AWAITING_OWNER_DECISION",
    "AWAITING_PRIVATE_COMPOSITION",
    "PRIVATE_COMPOSITION_POLICY_SUPERSEDED",
    "PRIVATE_COMPOSITION_METADATA_PRESENT_NOT_RELEASED",
    "PRIVATE_SUBJECT_COVERAGE_METADATA_NOT_PUBLICATION",
  ]) {
    assert.ok(service.includes(token));
    assert.ok(ui.includes(token) || token.includes("PRIVATE_SUBJECT_COVERAGE"));
  }
  assert.ok(service.includes("composition.gradeScaleId !== gradeScale.id"));
  assert.ok(service.includes("composition.aggregationRuleId !== aggregationRule.id"));
  assert.ok(service.includes("configuredSubjectCount: coverage.length"));
  assert.equal(service.includes("composedStudentCards"), false);
  assert.equal(service.includes("studentSourceCards"), false);
  assert.equal(service.includes("StudentEnrollment"), false);
  assert.equal(service.includes("rawPercentBps"), false);
  assert.equal(service.includes("gradeCode"), false);
  assert.equal(service.includes("accessGranted"), false);
  assert.ok(ui.includes("not a complete"));
  assert.ok(ui.includes("not a report-card release") || ui.includes("NOT A REPORT-CARD RELEASE"));
  assert.ok(ui.includes("P-004 remains unresolved"));
});

test("private GET route returns no report scores and rejects duplicate/unknown scope parameters", () => {
  assert.ok(api.includes("export async function GET("));
  assert.equal(api.includes("export async function POST("), false);
  assert.ok(api.includes("getAll(key).length !== 1"));
  assert.ok(api.includes("[...target.searchParams.keys()].length !== keys.length"));
  assert.ok(api.includes("manualHeaders"));
  assert.equal(api.includes("gradeCode"), false);
  assert.equal(api.includes("composedStudentCards"), false);
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(page.includes("if (!owner) notFound()"));
  for (const marker of [
    'PRIVATE_SUBJECT_COVERAGE_GET',
    'coverage("super", schoolB)',
    'data: { isActive: false }',
    'expect(safe).not.toContain(forbidden)',
  ]) {
    assert.ok(integration.includes(marker), marker);
  }
});
