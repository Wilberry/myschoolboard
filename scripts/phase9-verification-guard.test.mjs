import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const verifier = read("./verify-phase9-disposable.mjs");
const tests = read("./verify-phase9-disposable.test.mjs");
const oldRunner = read("./verify-local.mjs");
const env = read("../.env.example");
const scripts = JSON.parse(read("../package.json")).scripts;
const runbook = read("../docs/quality/PHASE9_DISPOSABLE_DATABASE_VERIFICATION_RUNBOOK.md");

test("Phase 9 local verifier proves a DB nonce BEFORE any mutable npm command", () => {
  assert.ok(verifier.includes("assertLocalVerificationTarget(environment)"));
  assert.ok(verifier.includes("PHASE9_TEST_DATABASE_NONCE"));
  assert.ok(verifier.includes("readOnlySql"));
  assert.ok(verifier.includes("myschoolboard_disposable_verification_marker"));
  assert.ok(verifier.includes('current_database()=\'myschoolboard_test\''));
  assert.ok(verifier.includes("default_transaction_read_only=on"));
  assert.ok(verifier.includes('"psql", ["-X", "-w"'));
  assert.ok(verifier.includes('connect.search = ""'));
  assert.ok(verifier.includes('delete cleanEnvironment[key]'));
  assert.ok(verifier.includes('result.status !== 0'));
  assert.ok(verifier.includes('observed !== environment.PHASE9_TEST_DATABASE_NONCE'));
  const body = verifier.slice(verifier.indexOf("export function runVerifiedPhase9Local("));
  assert.ok(body.indexOf("verifyPhase9DatabaseIdentity(") < body.indexOf('["run", "verify:local"]'));
  assert.ok(!verifier.includes("prisma migrate"));
  assert.ok(!verifier.includes("CREATE TABLE"));
  assert.ok(!verifier.includes("DROP TABLE"));
  assert.ok(!verifier.includes("git push"));
});

test("all finance flags are disabled and existing local runner CI gates remain intact", () => {
  const flags = [
    "PHASE9_FEE_WRITE_ENABLED",
    "PHASE9_PAYMENT_EVIDENCE_ENABLED",
    "PHASE9_PAYMENT_REVIEW_ENABLED",
    "PHASE9_MANUAL_ALLOCATION_ENABLED",
    "PHASE9_MANUAL_REVERSAL_ENABLED",
    "PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED",
    "PHASE9_EFFECTIVE_WAIVER_ENABLED",
  ];
  for (const flag of flags) {
    assert.ok(env.includes(flag+"=false"), flag);
    assert.ok(verifier.includes('"'+flag+'"'), flag);
  }
  for (const fragment of ["missing", "mismatch", "PGHOST", "default_transaction_read_only=on"]) {
    assert.ok(tests.includes(fragment) || verifier.includes(fragment));
  }
  assert.ok(oldRunner.includes('["audit", "--audit-level=high"]'));
  assert.ok(oldRunner.includes('["run", "db:deploy"]'));
  assert.ok(oldRunner.includes('["run", "db:seed"]'));
  assert.equal(scripts["verify:phase9:preflight"],
    "node scripts/verify-phase9-disposable.mjs --preflight");
  assert.equal(scripts["verify:phase9:local"],
    "node scripts/verify-phase9-disposable.mjs");
  assert.ok(scripts["verify:phase9:static"].includes("verify-phase9-disposable.test.mjs"));
  for (const entry of ["test", "verify:local:guards"]) {
    assert.ok(scripts[entry].includes("verify-phase9-disposable.test.mjs"));
    assert.ok(scripts[entry].includes("phase9-effective-waiver-guard.test.mjs"));
  }
  assert.ok(runbook.includes("DO NOT"));
  assert.ok(runbook.includes("openssl rand -hex 24"));
  assert.ok(runbook.includes("nonce"));
});
