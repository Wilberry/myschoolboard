import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256Migration } from "./verify-migration-checksums.mjs";
import {
  assertPhase3SubscriptionMigrationPending,
  assertPhase3SubscriptionSqlSource,
  newMigrationName,
} from "./verify-phase3-subscription-migration-preflight.mjs";

const prior = Array.from({ length: 36 }, (_, index) => ({
  name: "20261031_prior_" + String(index + 1).padStart(3, "0"),
  checksum: sha256Migration("SELECT " + (index + 1) + ";"),
}));
const added = {
  name: newMigrationName,
  checksum: sha256Migration("CREATE TABLE TEST_FIXTURE (id int);"),
};
const recorded = prior.map((item) => ({
  migration_name: item.name,
  checksum: item.checksum,
  finished_at: new Date("2026-10-31T00:00:00Z"),
  rolled_back_at: null,
}));

test("requires all 36 exact old checksums and exactly one expected new migration", () => {
  assert.deepEqual(
    assertPhase3SubscriptionMigrationPending([...prior, added], recorded),
    { applied: 36, pending: newMigrationName },
  );
});

test("refuses already-applied migration #37; it is not safe to re-deploy blindly", () => {
  const extra = {
    migration_name: added.name,
    checksum: added.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  };
  assert.throws(
    () => assertPhase3SubscriptionMigrationPending([...prior, added], [
      ...recorded, extra,
    ]),
    /Unexpected database migration/,
  );
});

test("refuses modified, missing, duplicate, unfinished or rolled-back baseline", () => {
  const local = [...prior, added];
  const mutations = [
    [...recorded.slice(0, 35)],
    [...recorded, recorded[0]],
    [{ ...recorded[0], checksum: added.checksum }, ...recorded.slice(1)],
    [{ ...recorded[0], finished_at: null }, ...recorded.slice(1)],
    [{ ...recorded[0], rolled_back_at: new Date() }, ...recorded.slice(1)],
  ];
  for (const altered of mutations) {
    assert.throws(
      () => assertPhase3SubscriptionMigrationPending(local, altered),
    );
  }
});

test("refuses unexpected or missing migration names, including extra files", () => {
  assert.throws(
    () => assertPhase3SubscriptionMigrationPending(prior, recorded),
    /exactly 37/,
  );
  assert.throws(
    () => assertPhase3SubscriptionMigrationPending(
      [...prior, { name: "different", checksum: added.checksum }],
      recorded,
    ),
    /exact additive/,
  );
  assert.throws(
    () => assertPhase3SubscriptionMigrationPending(
      [...prior.slice(1), added, added],
      recorded,
    ),
    /one exact additive/,
  );
});

const realSource = readFileSync(
  new URL(
    "../prisma/migrations/20261101000000_phase3_platform_subscriptions/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("validates the single complete reviewed SQL migration before deployment", () => {
  assert.equal(assertPhase3SubscriptionSqlSource(realSource), true);
});

test("rejects SQL duplication, accidental truncation and unsafe existing-table edits", () => {
  for (const invalid of [
    realSource + realSource,
    realSource.slice(0, 2000),
    realSource.replace("EXCLUDE USING gist", "EXCLUDE USING btree"),
    realSource.replace("INTERVAL '1825 days'", "INTERVAL '50 years'"),
    realSource.replace("(-[a-z0-9]+)*$", "(-[a-z0-9]+)*"),
    realSource + '\nALTER TABLE "School" ADD COLUMN "unsafe" text;\n',
  ]) {
    assert.throws(
      () => assertPhase3SubscriptionSqlSource(invalid),
      /Phase 3|Unexpected/,
    );
  }
});
