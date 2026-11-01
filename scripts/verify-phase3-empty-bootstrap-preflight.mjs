import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readLocalMigrationChecksums,
} from "./verify-migration-checksums.mjs";
import { assertLocalVerificationTarget } from "./verify-local.mjs";
import {
  assertPhase3SubscriptionSqlSource,
  newMigrationName,
  verifyCleanGitHead,
  verifyExactDisposableDocker,
} from "./verify-phase3-subscription-migration-preflight.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const exactBranch = "verify/pr97-integrated-pupil-workflow";

/**
 * A separate, read-only path for a truly empty disposable PostgreSQL
 * container. It is NOT an exception to the 36-applied/one-pending gate:
 * that path still applies when the earlier migration history exists.
 */
export function assertPhase3FreshMigrationInventory(local) {
  if (!Array.isArray(local) || local.length !== 37) {
    throw new Error("Fresh fixture requires exactly 37 migration files");
  }
  const names = new Set();
  for (const item of local) {
    if (
      !item ||
      typeof item.name !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(item.name) ||
      typeof item.checksum !== "string" ||
      !/^[0-9a-f]{64}$/.test(item.checksum) ||
      names.has(item.name)
    ) {
      throw new Error("Invalid or duplicate fresh migration inventory");
    }
    names.add(item.name);
  }
  if (!names.has(newMigrationName)) {
    throw new Error("Expected exact Phase 3 migration #37");
  }
  return { total: 37, finalMigration: newMigrationName };
}

export function assertPhase3FreshDatabaseEmpty(identity, relations, schemas) {
  if (
    !identity ||
    identity.database !== "myschoolboard_test" ||
    identity.role !== "myschoolboard"
  ) {
    throw new Error("Unexpected fresh test database identity");
  }
  if (!Array.isArray(relations) || !Array.isArray(schemas)) {
    throw new Error("Unable to classify disposable test database schema");
  }
  if (
    relations.length !== 0 ||
    schemas.some((item) => item?.schema !== "public")
  ) {
    throw new Error("Fresh fixture requires an entirely empty test schema");
  }
  return true;
}

function assertExactVerificationBranch() {
  const command = spawnSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
    shell: false,
  });
  if (
    command.error ||
    command.status !== 0 ||
    command.stdout.trim() !== exactBranch
  ) {
    throw new Error("Fresh fixture preflight requires the exact verification branch");
  }
}

export async function verifyPhase3FreshEmptyPreflight(environment = process.env) {
  assertLocalVerificationTarget(environment);
  assertExactVerificationBranch();
  const commit = verifyCleanGitHead();
  verifyExactDisposableDocker();

  const local = await readLocalMigrationChecksums();
  const inventory = assertPhase3FreshMigrationInventory(local);
  const sql = await readFile(
    new URL("../prisma/migrations/" + newMigrationName + "/migration.sql", import.meta.url),
    "utf8",
  );
  assertPhase3SubscriptionSqlSource(sql);

  const { Client } = await import("pg");
  const client = new Client({
    connectionString: environment.TEST_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
  });
  let inTransaction = false;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    inTransaction = true;

    const identityResult = await client.query(
      "SELECT current_database() AS database, current_user AS role",
    );
    if (identityResult.rows.length !== 1) {
      throw new Error("Unexpected database identity result");
    }

    const relationResult = await client.query(
      "SELECT n.nspname AS schema, c.relname AS name " +
        "FROM pg_catalog.pg_class AS c " +
        "JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace " +
        "WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') " +
        "AND n.nspname NOT LIKE 'pg_toast%' " +
        "AND n.nspname NOT LIKE 'pg_temp_%' " +
        "AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')",
    );
    const schemaResult = await client.query(
      "SELECT nspname AS schema FROM pg_catalog.pg_namespace " +
        "WHERE nspname <> 'pg_catalog' " +
        "AND nspname <> 'information_schema' " +
        "AND nspname NOT LIKE 'pg_toast%' " +
        "AND nspname NOT LIKE 'pg_temp_%'",
    );

    assertPhase3FreshDatabaseEmpty(
      identityResult.rows[0],
      relationResult.rows,
      schemaResult.rows,
    );
    await client.query("ROLLBACK");
    inTransaction = false;
    console.info(
      "Phase 3 fresh disposable preflight passed: exactly " +
        inventory.total + " local migrations, completely empty test database, " +
        "correct Docker identity and source SHA " + commit.slice(0, 12) +
        ". No migration or seed executed.",
    );
    return { commit, ...inventory, empty: true };
  } finally {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  verifyPhase3FreshEmptyPreflight().catch(() => {
    console.error(
      "Phase 3 fresh disposable preflight failed closed. " +
        "Do not deploy, reset or replace any database.",
    );
    process.exitCode = 1;
  });
}
