import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261013190000_phase8_release_visibility_and_ack/migration.sql");
const publication = read("../src/modules/results/report-publication-service.ts");
const recipient = read("../src/modules/results/recipient-report-service.ts");
const http = read("../src/modules/results/report-http.ts");
const policyRoute = read("../app/api/schools/[schoolId]/report-visibility-policies/route.ts");
const releaseRoute = read("../app/api/schools/[schoolId]/report-recipient-releases/route.ts");
const reportRoute = read("../app/api/schools/[schoolId]/published-reports/route.ts");
const acknowledgmentRoute = read("../app/api/schools/[schoolId]/published-reports/acknowledgments/[releaseId]/[studentId]/route.ts");
const tests = read("../src/modules/assessments/questions.integration.test.ts");
const ownerUI = read("../src/components/report-release-workspace.tsx");
const recipientUI = read("../src/components/published-report-workspace.tsx");

test("policy, immutable independent release, and per-child acknowledgment have three exact-school ledgers", () => {
  for (const mode of ["SCHOOL_ONLY","STUDENT_ONLY","GUARDIAN_ONLY","GUARDIAN_FIRST_ACK"]) {
    assert.ok(schema.includes(mode), mode);
    assert.ok(sql.includes(mode), mode);
  }
  for (const model of ["ReportVisibilityPolicyRevision","ReportRecipientRelease",
    "ReportGuardianAcknowledgment"]) {
    assert.ok(schema.includes(`model ${model} {`), model);
    assert.ok(sql.includes(`CREATE TABLE "${model}"`), model);
    assert.ok(sql.includes(`"${model}_immutable"`), model);
    assert.ok(sql.includes(`"${model}_no_truncate"`), model);
  }
  for (const token of [
    '"ReportVisibilityPolicyRevision_schoolId_version_key"',
    '"ReportRecipientRelease_exact_ordinal_key"',
    '"ReportRecipientRelease_composition_policy_key"',
    '"ReportGuardianAcknowledgment_exact_receipt_key"',
    'CREATE FUNCTION "validate_report_visibility_policy"()',
    'CREATE FUNCTION "validate_report_recipient_release"()',
    'CREATE FUNCTION "validate_report_guardian_acknowledgment"()',
    '"assert_result_publication_readiness"(',
    '"build_private_official_report_cards"(',
    'recalculated IS DISTINCT FROM snapshot."composedStudentCards"',
    'NEW."visibilityPolicyVersion":=school_policy."version"',
    'NEW."releaseOrdinal":=last_ordinal+1',
    'policy."version"=(\n   SELECT max(v."version")',
    'guardian."userId"=NEW."actorUserId"',
    'guardian."isActive"=true',
    'guardian."role"=\'PARENT\'',
    'revoked."linkId"=link."id"',
  ]) assert.ok(sql.includes(token), token);
  assert.equal((sql.match(/\$\$/g) || []).length, 6);
  assert.equal(sql.includes("GRANT SELECT TO PUBLIC"), false);
});

test("owner release is confirmation-gated and report readers are independently tenant-authorized", () => {
  for (const token of [
    'PHASE8_REPORT_RELEASE_ENABLED', 'PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED',
    'confirmRecipientRelease: z.literal(true)',
    'role: "SCHOOL_SUPER_ADMIN"', 'isActive: true',
    'isolationLevel: "Serializable"',
    'reportVisibilityPolicyRevision.create(',
    'reportRecipientRelease.create(',
    'owner."role"=\'SCHOOL_SUPER_ADMIN\'',
  ]) assert.ok(publication.includes(token), token);
  for (const token of [
    'reportGate("recipient")',
    'role: { in: ["STUDENT", "PARENT"] }',
    'JOIN "StudentEnrollment" e',
    'JOIN "StudentRecord" pupil',
    'JOIN "StudentAccountLink" link',
    'JOIN "GuardianStudentLink" link',
    '"StudentAccountLinkRevocation"',
    '"GuardianStudentLinkRevocation"',
    '"ReportGuardianAcknowledgment" receipt',
    'guardian."isActive"=true',
    'newer."releaseOrdinal">release."releaseOrdinal"',
    'policy."version"=(\n        SELECT max(latest."version")',
    'release."schoolId"=${schoolId}',
    'AND recipient."isActive"=true',
    'LIMIT 101',
    'readCurrentPublishedReports',
    'guardianLinkId: link.id',
    'acknowledge: z.literal(true)',
  ]) assert.ok(recipient.includes(token), token);
  assert.equal(recipient.includes("AssessmentQuestionKey"), false);
  assert.ok(policyRoute.includes("adoptReportVisibilityPolicy"));
  assert.ok(releaseRoute.includes("releaseOfficialComposition"));
  assert.ok(reportRoute.includes("readCurrentPublishedReports"));
  assert.ok(acknowledgmentRoute.includes("acknowledgeGuardianReport"));
  assert.equal(reportRoute.includes("export async function POST"), false);
  assert.equal(acknowledgmentRoute.includes("export async function GET"), false);
  assert.ok(http.includes("private, no-store, max-age=0"));
  assert.ok(http.includes("noindex, noarchive, nosnippet"));
  assert.ok(ownerUI.includes("I have inspected the frozen grades"));
  assert.ok(recipientUI.includes("window.print()"));
});

test("authenticated tests cover visibility revision changes, replay, role, revocation, parent's explicit receipt", () => {
  for (const token of [
    "REPORT_VISIBILITY_POST", "REPORT_RELEASE_POST",
    "PUBLISHED_REPORT_GET", "REPORT_ACK_POST",
    'mode: "GUARDIAN_ONLY"', 'mode: "GUARDIAN_FIRST_ACK"',
    'policy2.version).toBe(2)',
    'release3.releaseOrdinal).toBe(3)',
    '"GUARDIAN_FIRST_ACK"',
    'guardianHasAcknowledged).toBe(false)',
    'guardianHasAcknowledged).toBe(true)',
    'members.parent2', 'published("parent2")',
    'published("student")', 'published("teacher")',
    'process.env.PHASE8_REPORT_RELEASE_ENABLED = "true"',
    'process.env.PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED = "true"',
    'prisma.reportRecipientRelease.delete(',
    'prisma.reportGuardianAcknowledgment.update(',
    'TRUNCATE "ReportRecipientRelease"',
  ]) assert.ok(tests.includes(token), token);
});
