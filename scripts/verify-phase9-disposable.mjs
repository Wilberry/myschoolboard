import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

/**
 * Phase 9 safety gate: verifies an explicit nonce INSIDE an operator-owned
 * disposable database, not just a loopback URL (which may be forwarded
 * to a shared or production database).
 *
 * Never creates or mutates a DB. Never prints passwords or the nonce.
 * Actual migrations and seed run ONLY after this read-only check passes.
 */
const expectedTable =
  'public."myschoolboard_disposable_verification_marker"';
const readOnlySql = `SELECT "nonce" FROM ${expectedTable}
  WHERE "id"='phase9-local'
    AND current_database()='myschoolboard_test'`;

const tokenPattern = /^[a-f0-9]{32,128}$/;

export function assertPhase9Target(environment) {
  assertLocalVerificationTarget(environment);

  // The cumulative runner must never inherit unlocked finance routes,
  // even if an operator previously tested a feature in this terminal.
  for (const flag of [
    "PHASE9_FEE_WRITE_ENABLED",
    "PHASE9_PAYMENT_EVIDENCE_ENABLED",
    "PHASE9_PAYMENT_REVIEW_ENABLED",
    "PHASE9_MANUAL_ALLOCATION_ENABLED",
    "PHASE9_MANUAL_REVERSAL_ENABLED",
    "PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED",
    "PHASE9_EFFECTIVE_WAIVER_ENABLED",
  ]) {
    if (environment[flag] === "true") {
      throw new Error("Phase 9 verification requires all finance writes disabled");
    }
  }

  if (!tokenPattern.test(environment.PHASE9_TEST_DATABASE_NONCE ?? "")) {
    throw new Error("Phase 9 requires a 32-128 character lowercase hex disposable DB nonce");
  }

  // Reject libpq/Prisma URI options that can redirect away from the host
  // and DB validated in verify-local.mjs.
  let url;
  try {
    url = new URL(environment.TEST_DATABASE_URL);
  } catch {
    throw new Error("Phase 9 requires a valid disposable database URL");
  }
  if (
    url.hash ||
    !url.username ||
    !url.password ||
    [...url.searchParams.keys()].length !== 1 ||
    url.searchParams.get("schema") !== "public"
  ) {
    throw new Error("Phase 9 test database URI must contain only schema=public");
  }

  const connect = new URL(url.toString());
  connect.search = ""; // libpq does not support Prisma's ?schema=public.
  return connect.toString();
}

export function verifyPhase9DatabaseIdentity(environment, spawn = spawnSync) {
  const uri = assertPhase9Target(environment);
  const cleanEnvironment = { ...environment };
  for (const key of Object.keys(cleanEnvironment)) {
    // Ignore inherited libpq config overriding the validated URI,
    // services, SSL negotiation, and connection defaults.
    if (/^PG[A-Z0-9_]+$/.test(key)) delete cleanEnvironment[key];
  }
  cleanEnvironment.PGDATABASE = uri;
  cleanEnvironment.PGCONNECT_TIMEOUT = "5";
  cleanEnvironment.PGOPTIONS =
    "-c default_transaction_read_only=on -c statement_timeout=5000";

  // NOTE: no credential-bearing URI in argv, no shell, no SQL parameters.
  // The random expected nonce is compared ONLY in this process.
  const result = spawn(
    "psql", ["-X", "-w", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", readOnlySql],
    {
      env: cleanEnvironment, encoding: "utf8", shell: false,
      timeout: 10_000, maxBuffer: 4096,
    },
  );
  if (result.error || result.signal || result.status !== 0) {
    throw new Error("Phase 9 disposable DB identity attestation failed");
  }
  const observed = (result.stdout ?? "").trim();
  if (observed !== environment.PHASE9_TEST_DATABASE_NONCE) {
    throw new Error("Phase 9 database nonce mismatch: refuse migrations/seed");
  }
}

/** The existing guarded runner retains its exact CI command order.
 * Do not enable shared/production DB or any Phase 9 finance-write flags. */
export function runVerifiedPhase9Local(environment = process.env,
  spawn = spawnSync) {
  verifyPhase9DatabaseIdentity(environment, spawn);
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const root = fileURLToPath(new URL("../", import.meta.url));
  const result = spawn(npm, ["run", "verify:local"], {
    cwd: root, env: environment, shell: false, stdio: "inherit",
  });
  if (result.error || result.signal || result.status !== 0) {
    throw new Error("Phase 9 cumulative verification failed");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === "--help") {
      console.info("Usage: npm run verify:phase9:preflight (read-only DB attestation) or npm run verify:phase9:local (attest, then existing local CI).");
    } else if (args.length === 1 && args[0] === "--preflight") {
      verifyPhase9DatabaseIdentity(process.env);
      console.info("Phase 9 disposable database attestation passed (read-only).");
    } else if (args.length === 0) {
      runVerifiedPhase9Local();
    } else {
      throw new Error("Unsupported argument");
    }
  } catch (error) {
    // Do NOT expose the URL, password, nonce, database schema or raw psql stderr.
    console.error(error instanceof Error ? error.message : "Phase 9 preflight failed");
    process.exitCode = 1;
  }
}
