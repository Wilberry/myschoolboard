import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readLocalMigrationChecksums,
  verifyMigrationChecksums,
} from "./verify-migration-checksums.mjs";
import { assertLocalVerificationTarget } from "./verify-local.mjs";
import { assertLocalDockerFixtureTarget } from "./browser-fixture-safety.mjs";

/**
 * Static review boundary for the one pending additive migration.
 * Not a SQL parser: PostgreSQL and Prisma validation are still mandatory.
 */
export function assertPhase3SubscriptionSqlSource(sql) {
  if (typeof sql !== "string" || sql.length < 4000 || sql.length > 20000) {
    throw new Error("Unexpected Phase 3 migration source length");
  }
  const count = (pattern) => (sql.match(pattern) ?? []).length;
  if (
    count(/^CREATE TABLE /gm) !== 2 ||
    count(/^CREATE FUNCTION /gm) !== 4 ||
    count(/^CREATE TRIGGER /gm) !== 6 ||
    count(/CREATE TABLE "PlatformPlanRevision"/g) !== 1 ||
    count(/CREATE TABLE "SchoolSubscriptionPeriod"/g) !== 1
  ) {
    throw new Error("Phase 3 SQL contains missing or duplicated DDL");
  }
  for (const token of [
    '"code" ~ ' + String.fromCharCode(39) + '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' + String.fromCharCode(39),
    "INTERVAL '1825 days'",
    "count(DISTINCT feature_value)",
    "SchoolSubscriptionPeriod_no_overlap",
    "EXCLUDE USING gist",
    "tsrange(\"startsAt\", \"endsAt\", '[)') WITH &&",
    '"schoolId" WITH =',
    'CREATE TRIGGER "PlatformPlanRevision_immutable"',
    'CREATE TRIGGER "SchoolSubscriptionPeriod_immutable"',
    'CREATE TRIGGER "SchoolSubscriptionPeriod_no_truncate"',
    'CREATE TRIGGER "PlatformPlanRevision_no_truncate"',
    "pg_advisory_xact_lock",
    'WHERE school."id" = NEW."schoolId"',
  ]) {
    if (!sql.includes(token)) {
      throw new Error("Phase 3 SQL missing a required safety boundary");
    }
  }
  if (/\b(?:DROP|ALTER)\s+(?:TABLE|SCHEMA)\s+"?(?:School|User|StudentRecord)"?(?=\s|;|$)/i.test(sql)) {
    throw new Error("Phase 3 SQL must not rewrite identity or school tables");
  }
  if (!sql.trimEnd().endsWith(
    'FOR EACH STATEMENT EXECUTE FUNCTION "prevent_platform_subscription_truncate"();'
  )) {
    throw new Error("Phase 3 SQL has an unexpected ending");
  }
  return true;
}

const worktree = fileURLToPath(new URL("../", import.meta.url));
export const newMigrationName = "20261101000000_phase3_platform_subscriptions";

/**
 * No mutations. Requires exactly the previously verified 36 migrations to
 * be successfully applied and this exact additive migration to be pending.
 */
export function assertPhase3SubscriptionMigrationPending(local, applied) {
  if (!Array.isArray(local) || local.length !== 37) {
    throw new Error("Expected exactly 37 migration files");
  }
  const newMigrations = local.filter((item) => item.name === newMigrationName);
  if (newMigrations.length !== 1) {
    throw new Error("Expected one exact additive subscription migration");
  }
  const oldMigrations = local.filter((item) => item.name !== newMigrationName);
  const count = verifyMigrationChecksums(oldMigrations, applied);
  if (count !== 36) {
    throw new Error("Expected exactly 36 previously verified migrations");
  }
  return { applied: count, pending: newMigrationName };
}

function command(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: worktree,
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 1024 * 1024,
    shell: false,
  });
  if (result.error || result.status !== 0 || result.signal) {
    throw new Error("Disposable Docker preflight could not be completed");
  }
  return result.stdout.trim();
}

function verifyCleanGitHead() {
  const status = command("git", ["status", "--porcelain", "--untracked-files=all"]);
  if (status) {
    throw new Error("Verification requires a clean reviewed worktree");
  }
  const head = command("git", ["rev-parse", "HEAD"]);
  if (!/^[a-f0-9]{40}$/i.test(head)) {
    throw new Error("Verification requires an exact commit SHA");
  }
  return head;
}

function verifyExactDisposableDocker() {
  const context = command("docker", ["context", "show"]);
  if (!/^[A-Za-z0-9._][A-Za-z0-9._-]*$/.test(context)) {
    throw new Error("Unrecognized local Docker context");
  }
  const endpoint = command("docker", [
    "context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}",
  ]);
  const ids = command("docker", [
    "compose", "--profile", "test", "ps", "-q", "postgres-test",
  ]).split("\n").filter(Boolean);
  if (ids.length !== 1 || !/^[a-f0-9]{12,64}$/i.test(ids[0])) {
    throw new Error("Expected one exact disposable PostgreSQL service");
  }
  const inspection = JSON.parse(command("docker", ["inspect", ids[0]]));
  if (!Array.isArray(inspection) || inspection.length !== 1) {
    throw new Error("Docker inspection returned unexpected data");
  }
  assertLocalDockerFixtureTarget(endpoint, inspection[0], worktree);
}

export async function verifyPhase3SubscriptionMigrationPreflight(
  environment = process.env,
) {
  assertLocalVerificationTarget(environment);
  const commit = verifyCleanGitHead();
  verifyExactDisposableDocker();
  const migrations = await readLocalMigrationChecksums();
  const migrationSource = await readFile(
    new URL("../prisma/migrations/" + newMigrationName + "/migration.sql", import.meta.url),
    "utf8",
  );
  assertPhase3SubscriptionSqlSource(migrationSource);
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: environment.TEST_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  let began = false;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    began = true;
    const result = await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations"',
    );
    const summary = assertPhase3SubscriptionMigrationPending(
      migrations,
      result.rows,
    );
    await client.query("ROLLBACK");
    began = false;
    console.info(
      "Phase 3 read-only migration preflight passed: " +
        summary.applied + " exact applied; only " + summary.pending +
        " remains pending. No migration was executed. Tested commit " +
        commit.slice(0, 12) + ".",
    );
    return summary;
  } finally {
    if (began) await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  verifyPhase3SubscriptionMigrationPreflight().catch(() => {
    // Driver errors may contain credentials. Never echo the original error.
    console.error(
      "Phase 3 migration preflight failed closed; inspect disposable target " +
        "and verify expected pending migration without printing credentials.",
    );
    process.exitCode = 1;
  });
}
