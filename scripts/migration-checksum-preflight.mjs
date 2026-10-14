import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLocalVerificationTarget } from "./verify-local.mjs";

const migrationsRoot = fileURLToPath(
  new URL("../prisma/migrations/", import.meta.url),
);

/** Pure comparator: inspect only finalized, non-rolled-back migrations.
 * Never rewrite a migration's historical checksum or database ledger.
 */
export function compareAppliedMigrationChecksums(rows, readMigration) {
  const mismatches = [];
  for (const row of rows) {
    if (row.rolled_back_at !== null) continue;
    if (row.finished_at === null) {
      mismatches.push(`${row.migration_name}: unfinished database migration`);
      continue;
    }
    if (!/^[0-9]{14}_[A-Za-z0-9_-]+$/.test(row.migration_name)) {
      mismatches.push("Unsafe migration directory name in database history");
      continue;
    }
    let contents;
    try {
      contents = readMigration(row.migration_name);
    } catch {
      mismatches.push(`${row.migration_name}: missing migration.sql`);
      continue;
    }
    const hash = createHash("sha256").update(contents).digest("hex");
    if (hash !== row.checksum) {
      mismatches.push(
        `${row.migration_name}: applied checksum differs from local SQL`,
      );
    }
  }
  return mismatches;
}

export async function preflightMigrationHistory(environment = process.env) {
  assertLocalVerificationTarget(environment);
  // A protected loopback DB with a different schema selector is not the
  // existing public-schema migration ledger targeted by this checkpoint.
  const url = new URL(environment.DATABASE_URL);
  if (url.searchParams.get("schema") !== "public") {
    throw new Error("Migration checksum preflight requires schema=public");
  }
  // Pure guard tests must not require generated Prisma Client or a DB.\n  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const [ledger] = await prisma.$queryRaw`
      SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS "exists"
    `;
    if (!ledger?.exists) {
      const [count] = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS "tableCount"
        FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE'
      `;
      if (count?.tableCount !== 0) {
        throw new Error(
          "Refusing migrations: pre-existing tables without a Prisma migration ledger",
        );
      }
      console.info("Empty disposable database: no prior applied migrations");
      return;
    }
    const applied = await prisma.$queryRaw`
      SELECT migration_name, checksum, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at, migration_name
    `;
    const mismatches = compareAppliedMigrationChecksums(applied, (name) =>
      readFileSync(join(migrationsRoot, name, "migration.sql")),
    );
    if (mismatches.length) {
      throw new Error(
        `Migration safety preflight stopped: ${mismatches.join("; ")}. Do not reset or rewrite history; reconcile with a reviewed forward-only migration.`,
      );
    }
    const finalized = applied.filter(
      (row) => row.finished_at !== null && row.rolled_back_at === null,
    );
    console.info(`Verified ${finalized.length} applied migration checksums`);
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  preflightMigrationHistory().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Migration checksum preflight failed",
    );
    process.exitCode = 1;
  });
}
