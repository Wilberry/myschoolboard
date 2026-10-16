import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = source("../prisma/schema.prisma");
const sql = source("../prisma/migrations/20261016120000_phase9_fee_configuration_foundation/migration.sql");
const service = source("../src/modules/fees/fee-configuration-service.ts");
const categories = source("../app/api/schools/[schoolId]/fee-categories/route.ts");
const structures = source("../app/api/schools/[schoolId]/fee-structures/route.ts");
const integration = source("../src/modules/fees/fee-configuration.integration.test.ts");

test("Phase 9 fee structures are school-scoped and append-only, not debt or payment", () => {
  for (const model of ["FeeCategory", "FeeStructureRevision"]) {
    assert.match(schema, new RegExp("model " + model + " \\{"));
    assert.ok(sql.includes('CREATE TABLE "' + model + '"'));
    for (const suffix of ["validate", "immutable", "no_truncate"]) {
      assert.ok(sql.includes('"' + model + "_" + suffix + '"'));
    }
  }
  assert.match(schema, /amountMinor BigInt/);
  assert.match(sql, /"amountMinor" BIGINT NOT NULL/);
  assert.match(sql, /"amountMinor">0/);
  assert.match(sql, /"currency" ~ '\^\[A-Z\]\{3\}\$'/);
  assert.match(schema, /@@unique\(\[schoolId, categoryId, sessionId, termId, scope, scopeId, version\]/);
  assert.match(sql, /"scope"='SCHOOL'[\s\S]*?"scope"='SECTION'[\s\S]*?"scope"='CLASS'/);
  for (const name of [
    "FeeCategory_actor_fkey",
    "FeeStructureRevision_actor_fkey",
    "FeeStructureRevision_category_fkey",
    "FeeStructureRevision_session_fkey",
    "FeeStructureRevision_term_fkey",
    "FeeStructureRevision_section_fkey",
    "FeeStructureRevision_class_fkey",
  ]) {
    assert.ok(schema.includes('map: "' + name + '"'), name + " schema FK");
    assert.ok(sql.includes('"' + name + '"'), name + " SQL FK");
  }
  assert.match(sql, /"School" s[\s\S]*?FOR UPDATE/);
  assert.match(sql, /m\."role"='SCHOOL_SUPER_ADMIN'/);
  assert.match(sql, /"status" IN \('PLANNED','ACTIVE'\)/);
  assert.match(sql, /"version":=next_version/);
  assert.match(sql, /prevent_lesson_note_history_mutation/);
  assert.match(sql, /prevent_lesson_note_history_truncate/);
  assert.doesNotMatch(schema.slice(schema.indexOf("model FeeCategory")), /model (PaymentRecord|Receipt|FeeObligation) \{/);
});
test("Fee configuration routes and service use session actor and cannot publish payments", () => {
  assert.match(service, /auth\.api\.getSession/);
  assert.match(service, /role: "SCHOOL_SUPER_ADMIN"/);
  assert.match(service, /isolationLevel: "Serializable"/);
  assert.match(service, /actorUserId: userId/);
  assert.match(service, /\.strict\(\)/);
  assert.match(service, /BigInt\(amountMinor\)/);
  assert.match(service, /amountMinor: row\.amountMinor\.toString\(\)/);
  assert.match(service, /r\."amountMinor"::text/);
  assert.match(service, /m\."userId"=\$\{userId\}/);
  for (const route of [categories, structures]) {
    assert.match(route, /"Cache-Control": "private, no-store"/);
    assert.match(route, /export async function GET/);
    assert.match(route, /export async function POST/);
    assert.doesNotMatch(route, /export async function (PUT|PATCH|DELETE)/);
  }
  assert.match(integration, /denies anonymous/);
  assert.match(integration, /foreign scope/);
  assert.match(integration, /immutable school-owned category/);
  assert.match(integration, /prisma\.feeStructureRevision\.update/);
  assert.doesNotMatch(service, /paymentProvider|verifiedPayment|receiptIssued/);
});
