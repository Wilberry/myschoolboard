import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261016150000_phase9_manual_claim_allocation/migration.sql");
const service = read("../src/modules/fees/manual-payment-allocation-service.ts");
const route = read("../app/api/schools/[schoolId]/manual-payment-allocations/route.ts");
const testSource = read("../src/modules/fees/fee-configuration.integration.test.ts");
const env = read("../.env.example");
const packageJson = read("../package.json");

test("manual allocations are one-time immutable, tenant-bound, SQL-sourced money", () => {
  assert.match(schema, /model ManualPaymentAllocation \{/);
  for (const fk of [
    "ManualPaymentAllocation_obligation_fkey",
    "ManualPaymentAllocation_evidence_fkey",
    "ManualPaymentAllocation_verification_fkey",
    "ManualPaymentAllocation_allocator_fkey",
  ]) {
    assert.ok(schema.includes('map: "' + fk + '"'), fk);
    assert.ok(sql.includes('"' + fk + '"'), fk);
  }
  for (const suffix of ["validate","immutable","no_truncate"]) {
    assert.ok(sql.includes('"ManualPaymentAllocation_' + suffix + '"'));
  }
  assert.ok(sql.includes('"PaymentVerificationDecision_schoolId_id_key"'));
  assert.ok(schema.includes('@@unique([schoolId, id])'));
  assert.ok(schema.includes('@@unique([schoolId, verificationId])'));
  assert.ok(schema.includes('@@unique([schoolId, evidenceId])'));
  assert.ok(schema.includes('@@unique([schoolId, requestKey])'));
  assert.ok(sql.includes('"ManualPaymentAllocation_schoolId_evidenceId_key"'));
  assert.ok(sql.includes('"ManualPaymentAllocation_schoolId_verificationId_key"'));
  assert.ok(sql.includes('"ManualPaymentAllocation_schoolId_requestKey_key"'));
  assert.equal(sql.split('CREATE FUNCTION "validate_manual_payment_allocation_insert"').length, 2);
  assert.ok(sql.includes('NEW."amountMinor":=source."claimedAmountMinor"'));
  assert.ok(sql.includes('NEW."currency":=source."currency"'));
  assert.ok(sql.includes('NEW."allocatedAt":=(clock_timestamp()'));
  assert.ok(sql.includes('v."action"=\'VERIFIED\''));
  assert.ok(sql.includes('v."confirmedBankFunds"=true'));
  assert.ok(sql.includes('v."confirmedReferenceDigest"=e."referenceDigest"'));
  assert.ok(sql.includes('previously_allocated+source."claimedAmountMinor">source."owedAmount"'));
  assert.ok(sql.includes("m.\"role\"='SCHOOL_SUPER_ADMIN'"));
  assert.ok(sql.includes('"School" s WHERE s."id"=NEW."schoolId"'));
  assert.ok(sql.includes('FOR UPDATE'));
  assert.ok(sql.includes('prevent_lesson_note_history_mutation'));
});

test("owner-only allocation and provisional arithmetic never produce a paid receipt", () => {
  assert.ok(service.includes('requirePhase9FeeWritesEnabled'));
  assert.ok(service.includes('PHASE9_MANUAL_ALLOCATION_ENABLED'));
  assert.ok(service.includes('lockCurrentFinanceAdmin'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes('tx.manualPaymentAllocation.create'));
  assert.ok(service.includes('replay: true'));
  assert.ok(service.includes('status: "MANUAL_ALLOCATION_PREVIEW_ONLY"'));
  assert.ok(service.includes('status: "MANUAL_RECONCILIATION_PREVIEW_NOT_OFFICIAL"'));
  assert.ok(service.includes('if (allowed.length !== 1) throw new FeeError("NOT_FOUND")'));
  assert.ok(service.includes('member."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.ok(service.includes('LEFT JOIN LATERAL'));
  assert.ok(service.includes('SUM(e."claimedAmountMinor")::numeric'));
  assert.ok(service.includes('SUM(alloc."amountMinor")::numeric'));
  assert.ok(service.includes('"previewRemainingMinor"'));
  assert.ok(service.includes('"reviewedNotAllocatedMinor"'));
  assert.ok(service.includes("'FULL_MANUAL_ALLOCATION'"));
  assert.ok(!service.includes('status: "PAID"'));
  assert.ok(!service.includes("issueReceipt"));
  assert.ok(!service.includes("paymentProvider"));
  assert.ok(route.includes('private, no-store'));
  assert.ok(route.includes('export async function GET'));
  assert.ok(route.includes('export async function POST'));
  assert.doesNotMatch(route, /export async function (DELETE|PATCH|PUT)/);
  assert.ok(testSource.includes("concurrent manual allocation"));
  assert.ok(testSource.includes("previewRemainingMinor: \"156789\""));
  assert.ok(testSource.includes("manuallyAllocatedMinor: \"300000\""));
  assert.ok(env.includes("PHASE9_MANUAL_ALLOCATION_ENABLED=false"));
  assert.ok(packageJson.includes("phase9-manual-allocation-guard.test.mjs"));
});
