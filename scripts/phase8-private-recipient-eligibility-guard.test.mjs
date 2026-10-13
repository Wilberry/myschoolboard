import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013210000_phase8_private_recipient_eligibility_evidence/migration.sql",
);
const service = read("../src/modules/results/private-recipient-eligibility-service.ts");
const route = read("../app/api/schools/[schoolId]/private-recipient-eligibility/route.ts");
const page = read("../app/schools/[schoolId]/private-recipient-eligibility/page.tsx");
const ui = read("../src/components/private-recipient-eligibility-workspace.tsx");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

test("recipient eligibility ledger is locked, immutable and strictly not a grade release", () => {
  assert.ok(schema.includes("model ResultRecipientEligibilityEvidence {"));
  assert.ok(schema.includes('map: "ResultRecipientEligibilityEvidence_exact_proof_key"'));
  assert.ok(sql.includes('CREATE FUNCTION "validate_result_recipient_eligibility_evidence"'));
  assert.ok(sql.includes('school."isActive"=true FOR UPDATE'));
  assert.ok(sql.includes('owner."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.ok(sql.includes('PERFORM "assert_result_publication_readiness"('));
  assert.ok(sql.includes('FROM "ResultReleasePreflightAttestation" p'));
  assert.ok(sql.includes('max(scale."version") FROM "ReportGradeScaleRevision"'));
  assert.ok(sql.includes('max(rule."version") FROM "ReportAggregationRuleRevision"'));
  assert.ok(sql.includes('ORDER BY v."version" DESC LIMIT 1'));
  assert.ok(sql.includes('visibility."recipientMode"=\'ASSESSMENT_ONLY\''));
  assert.ok(sql.includes('"inspect_private_report_recipient_relationship"('));
  assert.ok(sql.includes("IS DISTINCT FROM 'RELATIONSHIP_VERIFIED_NOT_RELEASED'"));
  assert.ok(sql.includes('revoked."linkId"=link."id"'));
  assert.ok(sql.includes('ORDER BY event."ordinal" DESC LIMIT 1'));
  assert.ok(sql.includes('NEW."relationshipProofId":=proof_id'));
  assert.ok(sql.includes('NEW."preflightId":=prior_preflight."id"'));
  assert.ok(sql.includes('NEW."status":=\'INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS\''));
  for (const key of ["composition", "student", "recipient", "preflight", "visibility", "actor"]) {
    assert.ok(sql.includes(`"ResultRecipientEligibilityEvidence_${key}_fkey"`));
  }
  for (const name of ["validate", "immutable", "no_truncate"]) {
    assert.ok(sql.includes(`"ResultRecipientEligibilityEvidence_${name}"`));
  }
  assert.equal(sql.includes("GRANT SELECT"), false);
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
  assert.equal(sql.includes("INSERT INTO"), false);
});

test("owner-only metadata API never sends grades, student or guardian identity", () => {
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes(".strict()"));
  assert.ok(service.includes("LIMIT 100"));
  assert.ok(service.includes('owner."userId"=${userId}'));
  assert.equal(service.includes("studentId: true"), false);
  assert.equal(service.includes("recipientMembershipId: true"), false);
  assert.equal(service.includes('evidence."studentId"'), false);
  assert.equal(service.includes('evidence."recipientMembershipId"'), false);
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("INTERNAL_REVIEW_ONLY_NOT_AUTHORIZED_OR_RELEASED"));
  assert.equal(route.includes("composedStudentCards"), false);
  assert.equal(route.includes("gradeCode"), false);
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(ui.includes("Record internal eligibility review (no grade access)"));
  assert.equal(ui.includes("publishReport"), false);
});

test("authored integration negatives deny stale access and immutable history writes", () => {
  for (const expected of [
    'record("super", studentRequest, schoolB)',
    'recipientRole: "PARENT"',
    'accessGranted: true',
    'prisma.studentAccountLinkRevocation.create(',
    'data: { isActive: false }',
    'prisma.resultRecipientEligibilityEvidence.update(',
    'prisma.resultRecipientEligibilityEvidence.delete(',
    'TRUNCATE "ResultRecipientEligibilityEvidence"',
    'expect(safe).not.toContain(secret)',
    'INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS',
  ]) assert.ok(integration.includes(expected), expected);
});
