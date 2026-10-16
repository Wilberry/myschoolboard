import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261016230000_phase9_fee_adjustment_proposals/migration.sql");
const service = read("../src/modules/fees/fee-adjustment-proposal-service.ts");
const routes = [read("../app/api/schools/[schoolId]/fee-adjustment-proposals/route.ts"),
  read("../app/api/schools/[schoolId]/fee-adjustment-decisions/route.ts")];
const testSource = read("../src/modules/fees/fee-configuration.integration.test.ts");
const env = read("../.env.example");
const pkg = read("../package.json");

test("immutable tenant-bound school fee adjustments remain advisory only", () => {
  for (const model of ["FeeAdjustmentProposal", "FeeAdjustmentDecision"]) {
    assert.ok(schema.includes("model " + model + " {"));
    assert.ok(sql.includes('CREATE TABLE "' + model + '"'));
    for (const suffix of ["validate", "immutable", "no_truncate"])
      assert.ok(sql.includes('"' + model + "_" + suffix + '"'));
  }
  for (const fk of ["FeeAdjustmentProposal_obligation_fkey",
    "FeeAdjustmentProposal_proposer_fkey",
    "FeeAdjustmentDecision_proposal_fkey",
    "FeeAdjustmentDecision_reviewer_fkey"]) {
    assert.ok(schema.includes('map: "' + fk + '"'), fk);
    assert.ok(sql.includes('"' + fk + '"'), fk);
  }
  assert.equal(sql.split('CREATE FUNCTION "validate_fee_adjustment_proposal_insert"').length, 2);
  assert.equal(sql.split('CREATE FUNCTION "validate_fee_adjustment_decision_insert"').length, 2);
  assert.ok(sql.includes('"School" s WHERE s."id"=NEW."schoolId"'));
  assert.ok(sql.includes("m.\"role\"='SCHOOL_ADMIN'"));
  assert.ok(sql.includes("m.\"role\"='SCHOOL_SUPER_ADMIN'"));
  assert.ok(sql.includes('NEW."reviewerMembershipId"=original."proposerMembershipId"'));
  assert.ok(sql.includes('NEW."proposedAmountMinor">obligation."amountMinor"'));
  assert.ok(sql.includes('prevent_lesson_note_history_mutation'));
  assert.ok(!sql.includes('UPDATE "FeeObligation"'));
  assert.ok(!sql.includes('UPDATE "ManualPaymentAllocation"'));
});

test("private default-off review never applies approved fee waivers to debts or receipts", () => {
  assert.ok(service.includes("requirePhase9FeeWritesEnabled"));
  assert.ok(service.includes("PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED"));
  assert.ok(service.includes("lockCurrentSubmitter"));
  assert.ok(service.includes("lockCurrentFinanceAdmin"));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes('tx.feeAdjustmentProposal.create'));
  assert.ok(service.includes('tx.feeAdjustmentDecision.create'));
  assert.ok(service.includes('replay: true'));
  assert.ok(service.includes('APPROVAL_NOT_EFFECTIVE_FINANCIAL_ADJUSTMENT'));
  assert.ok(service.includes('ADVISORY_APPROVED_NOT_APPLIED'));
  assert.ok(service.includes('if (auth.length !== 1) throw new FeeError("NOT_FOUND")'));
  assert.ok(!service.includes('tx.feeObligation.update'));
  assert.ok(!service.includes('tx.manualPaymentAllocation.update'));
  assert.ok(!service.includes('issueReceipt'));
  for (const route of routes) {
    assert.ok(route.includes('"Cache-Control": "private, no-store"'));
    assert.doesNotMatch(route, /export async function (DELETE|PUT|PATCH)/);
  }
  assert.ok(testSource.includes('keeps school waiver decisions advisory'));
  assert.ok(testSource.includes('originalChargeMinor).toBe("456789")'));
  assert.ok(env.includes("PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED=false"));
  assert.ok(pkg.includes("phase9-fee-adjustment-guard.test.mjs"));
});
