import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

const migration = file(
  "prisma/migrations/20261101000000_phase3_platform_subscriptions/migration.sql",
);
const schema = file("prisma/schema.prisma");
const service = file("src/modules/platform/subscription-service.ts");
const http = file("src/modules/platform/subscription-http.ts");
const launcher = file("scripts/launch-phase1-7-verification.mjs");
const platformPage = file("app/platform/page.tsx");
const operatorEditor = file("src/components/platform-subscription-editor.tsx");
const homePage = file("app/page.tsx");

test("migration is complete and not duplicated or truncated", () => {
  assert.equal((migration.match(/^CREATE TABLE /gm) ?? []).length, 2);
  assert.equal((migration.match(/^CREATE FUNCTION /gm) ?? []).length, 4);
  assert.equal((migration.match(/^CREATE TRIGGER /gm) ?? []).length, 6);
  assert.equal(
    (migration.match(/CREATE TABLE "SchoolSubscriptionPeriod"/g) ?? []).length,
    1,
  );
  assert.ok(
    migration.includes(
      `"code" ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'`,
    ),
  );
  assert.match(migration, /INTERVAL '1825 days'/);
  assert.match(migration, /count\(DISTINCT feature_value\)/);
  assert.ok(
    migration.trimEnd().endsWith(
      'FOR EACH STATEMENT EXECUTE FUNCTION "prevent_platform_subscription_truncate"();',
    ),
  );
});

test("operator page and forms revalidate role before reading any school data", () => {
  assert.match(platformPage, /dynamic = "force-dynamic"/);
  assert.match(platformPage, /fetchCache = "force-no-store"/);
  assert.match(platformPage, /"platform:manage"/);
  assert.match(platformPage, /FOR UPDATE/);
  assert.match(platformPage, /if \(!schools\) notFound\(\)/);
  assert.ok(
    platformPage.indexOf('"platform:manage"') <
      platformPage.indexOf("tx.school.findMany("),
  );
  assert.match(operatorEditor, /credentials: "same-origin"/);
  assert.match(operatorEditor, /cache: "no-store"/);
  assert.match(operatorEditor, /type="datetime-local"/);
  assert.match(homePage, /platformActor\?\.platformRole === "SUPER_ADMIN"/);
  assert.match(homePage, /href="\/platform"/);
});

test("keeps subscription migration additive and platform-only", () => {
  for (const token of [
    'CREATE TABLE "PlatformPlanRevision"',
    'CREATE TABLE "SchoolSubscriptionPeriod"',
    'pg_advisory_xact_lock',
    'school."lifecycleStatus" IN',
    'school."id" = NEW."schoolId"',
    'school."isActive"',
    'SchoolSubscriptionPeriod_validate',
    'PlatformPlanRevision_validate',
    'SchoolSubscriptionPeriod_immutable',
    'PlatformPlanRevision_immutable',
    'SchoolSubscriptionPeriod_no_truncate',
    'SchoolSubscriptionPeriod_no_overlap',
    'EXCLUDE USING gist',
    'tsrange("startsAt", "endsAt", \'[)\') WITH &&',
    'PlatformPlanRevision_no_truncate',
  ]) {
    if (token === 'school."isActive"') {
      assert.doesNotMatch(migration, /UPDATE\s+"School"\s+SET\s+"isActive"/i);
    } else {
      assert.ok(migration.includes(token), "Missing subscription boundary: " + token);
    }
  }
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b|\bTRUNCATE\s+TABLE\b/i);
});

test("preserves tenant-specific non-overlapping immutable periods", () => {
  assert.match(migration, /period\."schoolId"\s*=\s*NEW\."schoolId"/);
  assert.match(migration, /period\."startsAt"\s*<\s*NEW\."endsAt"/);
  assert.match(migration, /period\."endsAt"\s*>\s*NEW\."startsAt"/);
  assert.match(migration, /pg_trigger_depth\(\)/);
  assert.match(migration, /INTERVAL '1825 days'/);
  assert.match(schema, /model PlatformPlanRevision\s*\{/);
  assert.match(schema, /model SchoolSubscriptionPeriod\s*\{/);
  assert.match(schema, /@@unique\(\[code, version\]\)/);
  assert.match(schema, /@@unique\(\[schoolId, id\]\)/);
});

test("rechecks real platform roles and never changes school lifecycle", () => {
  assert.match(service, /auth\.api\.getSession/);
  assert.match(service, /"platform:manage"/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /isolationLevel: "Serializable"/);
  assert.doesNotMatch(service, /tx\.school\.update\(/);
  assert.doesNotMatch(service, /tx\.membership\.create\(/);
  assert.doesNotMatch(service, /\bcharge\s*\(/);
  assert.match(http, /"Cache-Control": "private, no-store"/);
  assert.match(http, /\{ error: "Not found" \}/);
});

test("updates fixed browser fixture migration inventory without weakening checksum gate", () => {
  assert.match(launcher, /expectedMigrationCount = 37/);
  assert.match(launcher, /runMigrationChecksumVerification\(environment\)/);
});
