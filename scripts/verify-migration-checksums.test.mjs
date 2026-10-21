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
  assert.equal(
    verifyMigrationChecksums([one, two], [recorded(two), recorded(one)]),
    2,
  );
  assert.equal(
    sha256Migration("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("rejects any altered migration SQL checksum", () => {
  assert.throws(
    () =>
      verifyMigrationChecksums([one], [
        { ...recorded(one), checksum: two.checksum },
      ]),
    /checksum mismatch/,
  );
});

test("rejects missing or unexpected migration records", () => {
  assert.throws(
    () => verifyMigrationChecksums([one, two], [recorded(one)]),
    /not applied/,
  );
  assert.throws(
    () => verifyMigrationChecksums([one], [recorded(one), recorded(two)]),
    /Unexpected database migration/,
  );
});

test("rejects duplicate migration records and local inventory entries", () => {
  assert.throws(
    () => verifyMigrationChecksums([one], [recorded(one), recorded(one)]),
    /Duplicate migration record/,
  );
  assert.throws(
    () => verifyMigrationChecksums([one, one], [recorded(one)]),
    /Duplicate local migration/,
  );
});

test("rejects unfinished and rolled-back migrations", () => {
  assert.throws(
    () =>
      verifyMigrationChecksums([one], [
        { ...recorded(one), finished_at: null },
      ]),
    /not successfully applied/,
  );
  assert.throws(
    () =>
      verifyMigrationChecksums([one], [
        { ...recorded(one), rolled_back_at: new Date() },
      ]),
    /not successfully applied/,
  );
});

test("rejects invalid and empty inventories", () => {
  assert.throws(() => verifyMigrationChecksums([], []), /No local migrations/);
  assert.throws(
    () =>
      verifyMigrationChecksums([one], [
        { ...recorded(one), migration_name: "../outside" },
      ]),
    MigrationChecksumError,
  );
  assert.throws(
    () => verifyMigrationChecksums([{ ...one, checksum: "nonsense" }], []),
    /Invalid local/,
  );
});
