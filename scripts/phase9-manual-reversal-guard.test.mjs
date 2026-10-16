import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261016160000_phase9_manual_allocation_reversal_review/migration.sql");
const service = read("../src/modules/fees/manual-allocation-reversal-service.ts");
const preview = read("../src/modules/fees/manual-payment-allocation-service.ts");
const requestRoute = read("../app/api/schools/[schoolId]/manual-allocation-reversals/route.ts");
const decisionRoute = read("../app/api/schools/[schoolId]/manual-allocation-reversal-decisions/route.ts");
const testSource = read("../src/modules/fees/fee-configuration.integration.test.ts");
const env = read("../.env.example");
const packageJson = read("../package.json");

test("only a separately reviewed immutable manual reversal may affect preview arithmetic", () => {
  assert.match(schema, /enum ManualAllocationReversalAction \{/);
  for (const value of ["APPROVED","REJECTED"]) assert.ok(schema.includes(value));
  for (const model of ["ManualAllocationReversalRequest","ManualAllocationReversalDecision"]) {
    assert.ok(schema.includes("model " + model + " {"));
    assert.ok(sql.includes('CREATE TABLE "' + model + '"'));
    for (const suffix of ["validate", "immutable", "no_truncate"]) {
      assert.ok(sql.includes('"' + model + "_" + suffix + '"'));
    }
  }
  for (const fk of ["ManualAllocationReversalRequest_allocation_fkey",
    "ManualAllocationReversalRequest_requester_fkey",
    "ManualAllocationReversalDecision_request_fkey",
    "ManualAllocationReversalDecision_reviewer_fkey"]) {
    assert.ok(sql.includes('"' + fk + '"'));
    assert.ok(schema.includes('map: "' + fk + '"'));
  }
  assert.ok(sql.includes('"ManualAllocationReversalRequest_schoolId_allocationId_key"'));
  assert.ok(sql.includes('"ManualAllocationReversalRequest_schoolId_requestKey_key"'));
  assert.ok(sql.includes('"ManualAllocationReversalDecision_schoolId_requestId_key"'));
  assert.equal(sql.split('CREATE FUNCTION "validate_manual_allocation_reversal_request_insert"').length,2);
  assert.equal(sql.split('CREATE FUNCTION "validate_manual_allocation_reversal_decision_insert"').length,2);
  assert.ok(sql.includes('FOR UPDATE'));
  assert.ok(sql.includes('m."role"=\'SCHOOL_ADMIN\''));
  assert.ok(sql.includes('m."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.ok(sql.includes('NEW."reviewerMembershipId"=original."requesterMembershipId"'));
  assert.ok(sql.includes('NEW."amountMinor":=source."amountMinor"'));
  assert.ok(sql.includes('NEW."currency":=source."currency"'));
  assert.ok(sql.includes('prevent_lesson_note_history_mutation'));
  assert.ok(sql.includes('prevent_lesson_note_history_truncate'));
  assert.ok(!sql.includes('UPDATE "ManualPaymentAllocation"'));
  assert.ok(!sql.includes('DELETE FROM "ManualPaymentAllocation"'));
});

test("strict private actor-authorized reversal APIs never refund, and preview nets approved only", () => {
  assert.ok(service.includes('lockCurrentSubmitter'));
  assert.ok(service.includes('lockCurrentFinanceAdmin'));
  assert.ok(service.includes('currentUserId()'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes('PHASE9_MANUAL_REVERSAL_ENABLED'));
  assert.ok(service.includes('requirePhase9FeeWritesEnabled'));
  assert.ok(service.includes('requestKey: z.string().uuid()'));
  assert.ok(service.includes('replay: true'));
  assert.ok(service.includes('status: "REVERSAL_REQUEST_ONLY"'));
  assert.ok(service.includes('status: "MANUAL_ALLOCATION_REVERSAL_DECISION_ONLY"'));
  assert.ok(service.includes('if (allowed.length !== 1) throw new FeeError("NOT_FOUND")'));
  assert.ok(preview.includes('"grossManuallyAllocatedMinor"'));
  assert.ok(preview.includes('"approvedReversedMinor"'));
  assert.ok(preview.includes("correction.\"action\"='APPROVED'"));
  assert.ok(preview.includes("'REVERSED_MANUAL_ALLOCATION'"));
  assert.ok(preview.includes('COALESCE(applied."allocatedMinor",0)'));
  assert.ok(preview.includes('COALESCE(applied."grossAllocatedMinor",0)'));
  for (const route of [requestRoute, decisionRoute]) {
    assert.ok(route.includes('private, no-store'));
    assert.ok(route.includes('export async function POST'));
    assert.doesNotMatch(route, /export async function (PATCH|PUT|DELETE)/);
  }
  assert.ok(requestRoute.includes('export async function GET'));
  assert.ok(!decisionRoute.includes('export async function GET'));
  assert.ok(!service.includes("issueRefund"));
  assert.ok(!service.includes("transferFunds"));
  assert.ok(testSource.includes("independently approves a manual allocation reversal"));
  assert.ok(testSource.includes("rejected manual reversal from subtracting"));
  assert.ok(testSource.includes('approvedReversedMinor: "300000"'));
  assert.ok(testSource.includes('previewRemainingMinor: "356789"'));
  assert.ok(env.includes("PHASE9_MANUAL_REVERSAL_ENABLED=false"));
  assert.ok(packageJson.includes("phase9-manual-reversal-guard.test.mjs"));
});
