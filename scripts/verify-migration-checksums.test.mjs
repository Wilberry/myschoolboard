import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MigrationChecksumError,
  sha256Migration,
  verifyMigrationChecksums,
} from "./verify-migration-checksums.mjs";

const one = {
  name: "20261010000000_initial",
  checksum: sha256Migration("SELECT 1;\n"),
};
const two = {
  name: "20261011000000_scope",
  checksum: sha256Migration("SELECT 2;\n"),
};
const recorded = (item) => ({
  migration_name: item.name,
  checksum: item.checksum,
  finished_at: new Date("2026-10-20T00:00:00Z"),
  rolled_back_at: null,
});

test("matches all successful applied migrations by exact SHA-256", () => {
  const applied = [recorded(two), recorded(one)];
  assert.equal(verifyMigrationChecksums([one, two], applied), 2);
  assert.equal(
    sha256Migration("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("rejects any altered migration SQL checksum", () => {
  const altered = { ...recorded(one), checksum: two.checksum };
  const check = () => verifyMigrationChecksums([one], [altered]);
  assert.throws(check, /checksum mismatch/);
});

test("rejects missing or unexpected migration records", () => {
  const applied = recorded(one);
  const unexpected = recorded(two);
  const missing = () => verifyMigrationChecksums([one, two], [applied]);
  const extra = () => verifyMigrationChecksums([one], [applied, unexpected]);
  assert.throws(missing, /not applied/);
  assert.throws(extra, /Unexpected database migration/);
});

test("rejects duplicate migration records and local inventory entries", () => {
  const applied = recorded(one);
  const duplicate = [applied, applied];
  const recordedTwice = () => verifyMigrationChecksums([one], duplicate);
  const localTwice = () => verifyMigrationChecksums([one, one], [applied]);
  assert.throws(recordedTwice, /Duplicate migration record/);
  assert.throws(localTwice, /Duplicate local migration/);
});

test("rejects unfinished and rolled-back migrations", () => {
  const unfinished = { ...recorded(one), finished_at: null };
  const rolledBack = { ...recorded(one), rolled_back_at: new Date() };
  const checkUnfinished = () => verifyMigrationChecksums([one], [unfinished]);
  const checkRollback = () => verifyMigrationChecksums([one], [rolledBack]);
  assert.throws(checkUnfinished, /not successfully applied/);
  assert.throws(checkRollback, /not successfully applied/);
});

test("rejects invalid and empty inventories", () => {
  const noMigrations = () => verifyMigrationChecksums([], []);
  const unsafe = { ...recorded(one), migration_name: "../outside" };
  const unsafeName = () => verifyMigrationChecksums([one], [unsafe]);
  const invalidLocal = [{ ...one, checksum: "nonsense" }];
  const invalidChecksum = () => verifyMigrationChecksums(invalidLocal, []);

  assert.throws(noMigrations, /No local migrations/);
  assert.throws(unsafeName, MigrationChecksumError);
  assert.throws(invalidChecksum, /Invalid local/);
});
