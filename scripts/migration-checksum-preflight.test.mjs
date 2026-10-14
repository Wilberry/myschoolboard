import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { compareAppliedMigrationChecksums } from "./migration-checksum-preflight.mjs";

const migrationName = "20261012160100_lesson_review_decisions";
const correctSQL = Buffer.from("CREATE TABLE synthetic_school_test (id TEXT);\n");
const digest = createHash("sha256").update(correctSQL).digest("hex");
const applied = {
  migration_name: migrationName,
  checksum: digest,
  finished_at: new Date("2026-10-14T00:00:00Z"),
  rolled_back_at: null,
};
const source = () => correctSQL;

test("accepts exact finalized migration bytes without modifying any migration", () => {
  assert.deepEqual(compareAppliedMigrationChecksums([applied], source), []);
});

test("fails closed if a historically applied migration was edited", () => {
  const wrong = compareAppliedMigrationChecksums([applied], () =>
    Buffer.from("CREATE TABLE changed (id TEXT);\n"),
  );
  assert.deepEqual(wrong, [
    `${migrationName}: applied checksum differs from local SQL`,
  ]);
});

test("refuses absent history files, unsafe names, and incomplete migrations", () => {
  assert.deepEqual(
    compareAppliedMigrationChecksums([applied], () => {
      throw new Error("missing");
    }),
    [`${migrationName}: missing migration.sql`],
  );
  assert.deepEqual(
    compareAppliedMigrationChecksums(
      [{ ...applied, migration_name: "../../private" }],
      source,
    ),
    ["Unsafe migration directory name in database history"],
  );
  assert.deepEqual(
    compareAppliedMigrationChecksums([{ ...applied, finished_at: null }], source),
    [`${migrationName}: unfinished database migration`],
  );
});

test("allows explicit terminal rolled-back attempts without treating them as applied", () => {
  assert.deepEqual(
    compareAppliedMigrationChecksums(
      [{ ...applied, finished_at: null, rolled_back_at: new Date() }],
      () => {
        throw new Error("historical failed attempt not consulted");
      },
    ),
    [],
  );
});
