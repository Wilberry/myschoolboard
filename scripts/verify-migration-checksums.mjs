import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

export class MigrationChecksumError extends Error {
  constructor(message) {
    super(message);
    this.name = "MigrationChecksumError";
  }
}

export function sha256Migration(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

const safeName = /^[a-zA-Z0-9_-]+$/;
const safeChecksum = /^[0-9a-f]{64}$/;

/** Fail closed on missing, unexpected, modified, duplicated or unfinished migrations. */
export function verifyMigrationChecksums(localMigrations, recordedMigrations) {
  if (!Array.isArray(localMigrations) || !Array.isArray(recordedMigrations)) {
    throw new MigrationChecksumError("Migration inventory must be an array");
  }
  if (localMigrations.length === 0) {
    throw new MigrationChecksumError("No local migrations were found");
  }

  const local = new Map();
  for (const migration of localMigrations) {
    if (
      !migration ||
      typeof migration.name !== "string" ||
      !safeName.test(migration.name) ||
      typeof migration.checksum !== "string" ||
      !safeChecksum.test(migration.checksum)
    ) {
      throw new MigrationChecksumError("Invalid local migration metadata");
    }
    if (local.has(migration.name)) {
      throw new MigrationChecksumError(
        `Duplicate local migration: ${migration.name}`,
      );
    }
    local.set(migration.name, migration.checksum);
  }

  const applied = new Set();
  for (const record of recordedMigrations) {
    if (
      !record ||
      typeof record.migration_name !== "string" ||
      !safeName.test(record.migration_name)
    ) {
      throw new MigrationChecksumError("Invalid recorded migration metadata");
    }
    const name = record.migration_name;
    if (applied.has(name)) {
      throw new MigrationChecksumError(`Duplicate migration record: ${name}`);
    }
    applied.add(name);
    if (record.rolled_back_at !== null || record.finished_at == null) {
      throw new MigrationChecksumError(
        `Migration is not successfully applied: ${name}`,
      );
    }
    if (!local.has(name)) {
      throw new MigrationChecksumError(
        `Unexpected database migration: ${name}`,
      );
    }
    if (record.checksum !== local.get(name)) {
      throw new MigrationChecksumError(`Migration checksum mismatch: ${name}`);
    }
  }

  for (const name of local.keys()) {
    if (!applied.has(name)) {
      throw new MigrationChecksumError(`Migration not applied: ${name}`);
    }
  }
  return applied.size;
}

export async function readLocalMigrationChecksums() {
  const migrationsRoot = fileURLToPath(
    new URL("../prisma/migrations/", import.meta.url),
  );
  const entries = await readdir(migrationsRoot, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory() && safeName.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      checksum: sha256Migration(
        await readFile(resolve(migrationsRoot, name, "migration.sql")),
      ),
    })),
  );
}

/** Read-only audit, explicitly restricted to the established test database. */
export async function runMigrationChecksumVerification(
  environment = process.env,
) {
  assertLocalVerificationTarget(environment);
  const localMigrations = await readLocalMigrationChecksums();
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
    const result = await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations"',
    );
    const count = verifyMigrationChecksums(localMigrations, result.rows);
    await client.query("COMMIT");
    inTransaction = false;
    console.info(
      `Migration checksum verification passed (${count} exact applied migrations)`,
    );
    return count;
  } finally {
    if (inTransaction) await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runMigrationChecksumVerification().catch((error) => {
    // Database errors can include connection details: emit only controlled errors.
    console.error(
      error instanceof MigrationChecksumError
        ? error.message
        : "Migration checksum verification failed; confirm the disposable database and migration inventory.",
    );
    process.exitCode = 1;
  });
}
