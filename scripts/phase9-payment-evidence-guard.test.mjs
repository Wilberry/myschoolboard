import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = source("../prisma/schema.prisma");
const sql = source("../prisma/migrations/20261016140000_phase9_payment_reference_evidence_review/migration.sql");
const service = source("../src/modules/fees/payment-reference-service.ts");
const submitRoute = source("../app/api/schools/[schoolId]/payment-evidence/route.ts");
const reviewRoute = source("../app/api/schools/[schoolId]/payment-verifications/route.ts");
const integration = source("../src/modules/fees/fee-configuration.integration.test.ts");

test("a bank reference submission remains an immutable UNVERIFIED claim", () => {
  assert.ok(schema.includes("model PaymentEvidence {"));
  assert.ok(schema.includes("model PaymentVerificationDecision {"));
  assert.ok(schema.includes("enum PaymentEvidenceStatus {"));
  assert.ok(schema.includes("enum PaymentVerificationAction {"));
  assert.ok(schema.includes("SUBMITTED"));
  assert.ok(schema.includes("VERIFIED"));
  assert.ok(schema.includes("REJECTED"));
  for (const ref of ["PaymentEvidence_obligation_fkey",
    "PaymentEvidence_submitter_fkey",
    "PaymentVerificationDecision_evidence_fkey",
    "PaymentVerificationDecision_reviewer_fkey"]) {
    assert.ok(schema.includes('map: "' + ref + '"'), ref);
    assert.ok(sql.includes('"' + ref + '"'), ref);
  }
  for (const kind of ["PaymentEvidence","PaymentVerificationDecision"]) {
    for (const suffix of ["validate", "immutable", "no_truncate"]) {
      assert.ok(sql.includes('"' + kind + "_" + suffix + '"'));
    }
  }
  assert.ok(sql.includes('"PaymentEvidence_schoolId_requestKey_key"'));
  assert.ok(sql.includes('"PaymentEvidence_schoolId_referenceDigest_key"'));
  assert.ok(sql.includes('m."role"=\'SCHOOL_ADMIN\''));
  assert.ok(sql.includes('m."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.ok(sql.includes('candidate."submitterMembershipId"=NEW."reviewerMembershipId"'));
  assert.ok(sql.includes('already_verified+candidate."claimedAmountMinor">candidate."owedAmount"'));
  assert.ok(sql.includes('NEW."confirmedBankFunds" IS DISTINCT FROM true'));
  assert.ok(sql.includes('NEW."confirmedReferenceDigest" IS DISTINCT FROM candidate."referenceDigest"'));
  assert.ok(sql.includes('prevent_lesson_note_history_mutation'));
  assert.ok(sql.includes('prevent_lesson_note_history_truncate'));
});

test("manual reviewer requires distinct authenticated actor and explicit funds attestation", () => {
  assert.ok(service.includes('role: "SCHOOL_ADMIN"'));
  assert.ok(service.includes('lockCurrentFinanceAdmin'));
  assert.ok(service.includes('z.literal("VERIFIED")'));
  assert.ok(service.includes('fundsConfirmed: z.literal(true)'));
  assert.ok(service.includes('action: z.literal("REJECTED")'));
  assert.ok(service.includes('confirmedBankFunds: choice.action === "VERIFIED"'));
  assert.ok(service.includes('PHASE9_PAYMENT_EVIDENCE_ENABLED'));
  assert.ok(service.includes('PHASE9_PAYMENT_REVIEW_ENABLED'));
  assert.ok(service.includes('requirePhase9FeeWritesEnabled'));
  assert.ok(service.includes('createHash("sha256")'));
  assert.ok(service.includes('schoolId + "\\0" + value'));
  assert.ok(service.includes('status: "SUBMITTED_EVIDENCE_ONLY"'));
  assert.ok(service.includes("'PENDING_VERIFICATION' END AS \"verificationState\""));
  assert.ok(service.includes('review."action"::text AS "reviewAction"'));
  assert.ok(service.includes('replay: true'));
  assert.ok(service.includes('original.confirmedReferenceDigest !== digest'));
  assert.ok(service.includes('original.reviewerMembershipId !== memberId'));
  assert.ok(reviewRoute.includes('decision.replay ? 200 : 201'));
  assert.ok(sql.includes('candidate RECORD;'));
  assert.ok(sql.includes('already_verified NUMERIC;'));
  assert.ok(!sql.includes('DECLARE already_verified NUMERIC;'));
  assert.equal(sql.split('CREATE FUNCTION "validate_payment_verification_insert"').length, 2);
  assert.equal(sql.split('CREATE FUNCTION "validate_payment_evidence_insert"').length, 2);
  assert.ok(sql.includes('"confirmedReferenceDigest" ~ ' + "'^[a-f0-9]{64}$'"));
  assert.ok(sql.includes("OR (\"action\"='REJECTED' AND \"confirmedBankFunds\"=false"));
  assert.ok(!service.includes('status: "PAID"'));
  assert.ok(!service.includes('createPaymentRecord'));
  assert.ok(service.includes('if (allowed.length !== 1) throw new FeeError("NOT_FOUND")'));
  for (const route of [submitRoute, reviewRoute]) {
    assert.ok(route.includes('"Cache-Control": "private, no-store"'));
    assert.ok(!route.includes("export async function DELETE"));
    assert.ok(!route.includes("export async function PATCH"));
  }
  assert.ok(!reviewRoute.includes("export async function GET"));
  assert.ok(submitRoute.includes("export async function GET"));
  assert.ok(submitRoute.includes("export async function POST"));
  assert.ok(reviewRoute.includes("export async function POST"));
  assert.ok(integration.includes("keeps submitted bank reference metadata UNVERIFIED"));
  assert.ok(integration.includes("independent explicit school-owner bank reconciliation decision"));
  assert.ok(integration.includes("Synthetic claim exceeding verified amount"));
});
