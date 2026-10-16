import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const migration = read("../prisma/migrations/20261017000000_phase9_effective_fee_waiver_application/migration.sql");
const service = read("../src/modules/fees/effective-fee-waiver-service.ts");
const preview = read("../src/modules/fees/manual-payment-allocation-service.ts");
const route = read("../app/api/schools/[schoolId]/fee-waiver-applications/route.ts");
const integration = read("../src/modules/fees/fee-configuration.integration.test.ts");
const env = read("../.env.example");
const pkg = read("../package.json");

test("applied waivers are immutable, source-derived and school-locked", () => {
  assert.ok(schema.includes("model FeeWaiverApplication {"));
  for (const name of ["obligation","proposal","decision","applier"]) {
    const fk = "FeeWaiverApplication_" + name + "_fkey";
    assert.ok(schema.includes('map: "' + fk + '"'));
    assert.ok(migration.includes('"' + fk + '"'));
  }
  assert.ok(schema.includes('@@unique([schoolId, decisionId])'));
  assert.ok(schema.includes('@@unique([schoolId, proposalId])'));
  assert.ok(schema.includes('@@unique([schoolId, requestKey])'));
  assert.ok(migration.includes('"FeeAdjustmentDecision_schoolId_id_key"'));
  assert.ok(migration.includes('"FeeWaiverApplication_schoolId_requestKey_key"'));
  assert.ok(migration.includes('"FeeWaiverApplication_schoolId_proposalId_key"'));
  assert.ok(migration.includes('"FeeWaiverApplication_schoolId_decisionId_key"'));
  assert.equal(migration.split('CREATE FUNCTION "validate_fee_waiver_application_insert"').length,2);
  assert.ok(migration.includes("decision.\"action\"='APPROVED'"));
  assert.ok(migration.includes("proposal.\"kind\"='WAIVER'"));
  assert.ok(migration.includes("m.\"role\"='SCHOOL_SUPER_ADMIN'"));
  assert.ok(migration.includes('"School" s WHERE s."id"=NEW."schoolId"'));
  assert.ok(migration.includes("FOR UPDATE"));
  assert.ok(migration.includes('waived_total+verified_total+source."waiverAmount">source."originalAmount"'));
  assert.ok(migration.includes('NEW."amountMinor":=source."waiverAmount"'));
  assert.ok(migration.includes('NEW."currency":=source."originalCurrency"'));
  for (const suffix of ["validate","immutable","no_truncate"])
    assert.ok(migration.includes('"FeeWaiverApplication_'+suffix+'"'));
  assert.ok(migration.includes("prevent_lesson_note_history_mutation"));
  assert.ok(migration.includes("prevent_lesson_note_history_truncate"));
});

test("later verification and manual allocation independently obey applied waivers", () => {
  for (const name of ["validate_fee_waiver_payment_verification_limit",
    "validate_fee_waiver_allocation_limit"]) {
    assert.equal(migration.split('CREATE FUNCTION "'+name+'"').length,2);
  }
  assert.ok(migration.includes('"PaymentVerificationDecision_waiver_limit"'));
  assert.ok(migration.includes('"ManualPaymentAllocation_waiver_limit"'));
  assert.ok(migration.includes('waived_total+verified_total+source."claimedAmountMinor">source."originalAmount"'));
  assert.ok(migration.includes('waived_total+allocated_total+source."claimedAmountMinor">source."originalAmount"'));
  assert.ok(migration.includes("v.\"action\"='VERIFIED'"));
  assert.ok(migration.includes('v."confirmedBankFunds"=true'));
  assert.ok(migration.includes("v.\"confirmedReferenceDigest\"=e.\"referenceDigest\""));
  assert.ok(!migration.includes('UPDATE "FeeObligation"'));
  assert.ok(!migration.includes('UPDATE "PaymentEvidence"'));
  assert.ok(!migration.includes('UPDATE "ManualPaymentAllocation"'));
});

test("owner-only default-off waiver API adjusts only internal financial preview", () => {
  assert.ok(service.includes("PHASE9_EFFECTIVE_WAIVER_ENABLED"));
  assert.ok(service.includes("requirePhase9FeeWritesEnabled"));
  assert.ok(service.includes("lockCurrentFinanceAdmin"));
  assert.ok(service.includes("isolationLevel: \"Serializable\""));
  assert.ok(service.includes("tx.feeWaiverApplication.create"));
  assert.ok(service.includes("APPLIED_INTERNAL_WAIVER_NOT_SETTLEMENT"));
  assert.ok(service.includes("replay: true"));
  assert.ok(service.includes('if (allowed.length !== 1) throw new FeeError("NOT_FOUND")'));
  assert.ok(!service.includes("issueReceipt("));
  assert.ok(!service.includes("refundPayment("));
  assert.ok(route.includes('"Cache-Control": "private, no-store"'));
  assert.ok(route.includes("export async function GET"));
  assert.ok(route.includes("export async function POST"));
  assert.doesNotMatch(route, /export async function (DELETE|PUT|PATCH)/);
  assert.ok(preview.includes('"appliedWaiverMinor"'));
  assert.ok(preview.includes('"adjustedChargeMinor"'));
  assert.ok(preview.includes('SUM(w."amountMinor")::numeric AS "waivedMinor"'));
  assert.ok(preview.includes('COALESCE(waived."waivedMinor",0)-'));
  assert.ok(integration.includes("applies approved WAIVER only under the net claim cap"));
  assert.ok(integration.includes('previewRemainingMinor: "336789"'));
  assert.ok(integration.includes('adjustedChargeMinor: "436789"'));
  assert.ok(env.includes("PHASE9_EFFECTIVE_WAIVER_ENABLED=false"));
  assert.ok(pkg.includes("phase9-effective-waiver-guard.test.mjs"));
});
