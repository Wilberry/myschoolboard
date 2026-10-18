import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPhase9Target, verifyPhase9DatabaseIdentity,
  runVerifiedPhase9Local,
} from "./verify-phase9-disposable.mjs";

const nonce = "f".repeat(48);
const uri =
  "postgresql://myschoolboard:synthetic_ci_password@localhost:5434/myschoolboard_test?schema=public";
const base = Object.freeze({
  NODE_ENV: "test",
  DATABASE_URL: uri,
  TEST_DATABASE_URL: uri,
  TEST_DATABASE_DISPOSABLE: "1",
  ALLOW_DEMO_SEED: "1",
  BETTER_AUTH_SECRET: "only-a-local-synthetic-secret-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  DEV_ADMIN_EMAIL: "synthetic-admin@myschoolboard.test",
  DEV_ADMIN_PASSWORD: "synthetic-fake-password-very-long",
  PHASE9_TEST_DATABASE_NONCE: nonce,
  PHASE9_FEE_WRITE_ENABLED: "false",
  PHASE9_EFFECTIVE_WAIVER_ENABLED: "false",
});

test("rejects wrong/missing DB target, unsafe libpq options and weak attestations", () => {
  assert.equal(assertPhase9Target(base).includes("?schema="), false);
  const invalid = [
    { PHASE9_TEST_DATABASE_NONCE: undefined },
    { PHASE9_TEST_DATABASE_NONCE: "short" },
    { PHASE9_TEST_DATABASE_NONCE: "g".repeat(48) },
    { PHASE9_TEST_DATABASE_NONCE: "f".repeat(16) },
    { PHASE9_FEE_WRITE_ENABLED: "true" },
    { PHASE9_PAYMENT_EVIDENCE_ENABLED: "true" },
    { PHASE9_MANUAL_REVERSAL_ENABLED: "true" },
    { PHASE9_EFFECTIVE_WAIVER_ENABLED: "true" },
    { NODE_ENV: "production" },
    { TEST_DATABASE_DISPOSABLE: "0" },
    { DATABASE_URL: undefined },
    { TEST_DATABASE_URL: undefined },
    { TEST_DATABASE_URL: uri + "&host=shared.example", DATABASE_URL: uri + "&host=shared.example" },
    { TEST_DATABASE_URL: uri + "&schema=public", DATABASE_URL: uri + "&schema=public" },
    { TEST_DATABASE_URL: uri + "#fragment", DATABASE_URL: uri + "#fragment" },
    { TEST_DATABASE_URL: uri.replace("synthetic_ci_password", ""), DATABASE_URL: uri.replace("synthetic_ci_password", "") },
    { TEST_DATABASE_URL: uri.replace("localhost", "shared.example"), DATABASE_URL: uri.replace("localhost", "shared.example") },
  ];
  for (const changed of invalid) {
    assert.throws(() => assertPhase9Target({ ...base, ...changed }), JSON.stringify(changed));
  }
});

test("read-only psql attests true DB marker without touching schema or exposing secrets", () => {
  const calls = [];
  const env = { ...base, PGHOST: "shared.example", PGPORT: "5432",
    PGSERVICE: "sneaky", PGOPTIONS: "-c default_transaction_read_only=off",
    PGPASSWORD: "ignore-me" };
  verifyPhase9DatabaseIdentity(env, (name, args, options) => {
    calls.push({ name, args, options });
    return { status: 0, stdout: nonce + "\n" };
  });
  assert.equal(calls.length, 1);
  const { name, args, options } = calls[0];
  assert.equal(name, "psql");
  assert.equal(options.shell, false);
  assert.ok(args.includes("-X"));
  assert.ok(args.includes("-w"));
  assert.ok(args.includes("ON_ERROR_STOP=1"));
  assert.ok(args.includes("-c"));
  assert.equal(args.some(a => a.includes("synthetic_ci_password")), false);
  assert.equal(args.some(a => a.includes(nonce)), false);
  assert.ok(options.env.PGDATABASE.startsWith("postgresql://"));
  assert.equal(options.env.PGDATABASE.includes("schema=public"), false);
  assert.equal(options.env.PGHOST, undefined);
  assert.equal(options.env.PGPORT, undefined);
  assert.equal(options.env.PGSERVICE, undefined);
  assert.equal(options.env.PGPASSWORD, undefined);
  assert.ok(options.env.PGOPTIONS.includes("default_transaction_read_only=on"));
  assert.ok(args.join(" ").includes('myschoolboard_disposable_verification_marker'));
});

test("mismatched, missing, failed or interrupted psql identity never proceeds", () => {
  const bad = [
    { status: 0, stdout: "" },
    { status: 0, stdout: "0".repeat(48) },
    { status: 1, stdout: nonce },
    { status: null, signal: "SIGTERM", stdout: nonce },
    { status: null, error: new Error("psql missing") },
  ];
  for (const result of bad) {
    assert.throws(
      () => verifyPhase9DatabaseIdentity(base, () => result),
      /attestation failed|nonce mismatch/,
    );
  }
});

test("cumulative npm runner starts only AFTER authenticated read-only DB check", () => {
  const calls = [];
  runVerifiedPhase9Local(base, (name, args) => {
    calls.push({ name, args });
    if (name === "psql") return { status: 0, stdout: nonce + "\n" };
    return { status: 0 };
  });
  assert.deepEqual(calls.map(c => c.name), ["psql", process.platform === "win32" ? "npm.cmd" : "npm"]);
  assert.deepEqual(calls[1].args, ["run", "verify:local"]);
  let count = 0;
  assert.throws(() => runVerifiedPhase9Local(base, () => {
    count++;
    return { status: 0, stdout: "mismatch" };
  }), /nonce mismatch/);
  assert.equal(count, 1, "npm must not run after an invalid DB attestation");
});
