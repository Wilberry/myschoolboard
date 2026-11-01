import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256Migration } from "./verify-migration-checksums.mjs";
import { newMigrationName } from "./verify-phase3-subscription-migration-preflight.mjs";
import {
  assertPhase3FreshDatabaseEmpty,
  assertPhase3FreshMigrationInventory,
} from "./verify-phase3-empty-bootstrap-preflight.mjs";

const migrations = Array.from({ length: 36 }, (_, index) => ({
  name: "20261031_fixture_" + String(index).padStart(3, "0"),
  checksum: sha256Migration("SELECT " + index + ";"),
}));
migrations.push({
  name: newMigrationName,
  checksum: sha256Migration("Synthetic approved Phase 3 source"),
});
const identity = { database: "myschoolboard_test", role: "myschoolboard" };

test("permits exactly 37 reviewed migration files for fresh disposable DB", () => {
  assert.deepEqual(assertPhase3FreshMigrationInventory(migrations), {
    total: 37,
    finalMigration: newMigrationName,
  });
});

test("refuses duplicate, missing and extra migration files", () => {
  for (const altered of [
    migrations.slice(0, 36),
    [...migrations, migrations[0]],
    [...migrations.slice(0, 35), migrations[0], migrations[36]],
    [
      ...migrations.slice(0, 36),
      { name: "unexpected", checksum: migrations[36].checksum },
    ],
  ]) {
    assert.throws(() => assertPhase3FreshMigrationInventory(altered));
  }
});

test("rejects invalid or missing SHA-256 migration evidence", () => {
  for (const altered of [
    [{ ...migrations[0], checksum: "broken" }, ...migrations.slice(1)],
    [{ ...migrations[0], name: "../../unsafe" }, ...migrations.slice(1)],
    [{ ...migrations[0], checksum: null }, ...migrations.slice(1)],
  ]) {
    assert.throws(() => assertPhase3FreshMigrationInventory(altered));
  }
});

test("permits only a truly empty correct-name and correct-role database", () => {
  assert.equal(
    assertPhase3FreshDatabaseEmpty(identity, [], [{ schema: "public" }]),
    true,
  );
});

test("rejects existing database objects and extra schemas", () => {
  for (const [objects, schemas] of [
    [
      [{ schema: "public", name: "_prisma_migrations", kind: "relation" }],
      [{ schema: "public" }],
    ],
    [
      [{ schema: "public", name: "School", kind: "relation" }],
      [{ schema: "public" }],
    ],
    [
      [{ schema: "public", name: "leftover_function", kind: "routine" }],
      [{ schema: "public" }],
    ],
    [
      [{ schema: "public", name: "leftover_type", kind: "type" }],
      [{ schema: "public" }],
    ],
    [
      [{ schema: "public", name: "leftover_operator", kind: "operator" }],
      [{ schema: "public" }],
    ],
    [
      [{ schema: "public", name: "leftover_extension", kind: "extension" }],
      [{ schema: "public" }],
    ],
    [[], [{ schema: "public" }, { schema: "other" }]],
  ]) {
    assert.throws(() =>
      assertPhase3FreshDatabaseEmpty(identity, objects, schemas),
    );
  }
});

test("rejects production-looking identity, missing schema metadata and malformed responses", () => {
  assert.throws(() =>
    assertPhase3FreshDatabaseEmpty(
      { database: "myschoolboard", role: "myschoolboard" },
      [],
      [{ schema: "public" }],
    ),
  );
  assert.throws(() =>
    assertPhase3FreshDatabaseEmpty(
      { database: "myschoolboard_test", role: "postgres" },
      [],
      [{ schema: "public" }],
    ),
  );
  assert.throws(() => assertPhase3FreshDatabaseEmpty(identity, null, []));
  assert.throws(() => assertPhase3FreshDatabaseEmpty(identity, [], null));
});
