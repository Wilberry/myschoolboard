import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL(
    "../prisma/migrations/20261013100000_phase8_result_sheet_evidence_review/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

const expectedDeclarations = new Map([
  [
    "assert_result_sheet_manifest_complete",
    [
      "pupil JSONB;",
      "score JSONB;",
      "any_source BOOLEAN := false;",
      "pupil_has_source BOOLEAN;",
    ],
  ],
  [
    "validate_result_sheet_evidence",
    [
      "current_adoption RECORD;",
      "previous RECORD;",
      "next_revision INT;",
      "frozen JSONB;",
    ],
  ],
  [
    "validate_result_sheet_review",
    [
      "snapshot RECORD;",
      "current_adoption RECORD;",
      "current_evidence TEXT;",
      "now_manifest JSONB;",
    ],
  ],
]);

test("Phase 8 result evidence functions have one PL/pgSQL DECLARE section each", () => {
  // SQL migrations are applied in lexical order. A later migration cannot
  // rescue a CREATE FUNCTION rejected by the PL/pgSQL parser.
  for (const [name, expected] of expectedDeclarations) {
    const signature = `CREATE FUNCTION "${name}"`;
    assert.equal(sql.split(signature).length, 2, `${name}: one declaration`);
    const after = sql.split(signature)[1];
    const start = after.indexOf("AS $$");
    const begin = after.indexOf("\nBEGIN", start);
    assert.ok(start >= 0 && begin > start, `${name}: block not found`);
    const section = after.slice(start + "AS $$".length, begin);
    const declarations = section
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    assert.equal(
      declarations.filter((line) => /^DECLARE\s/u.test(line)).length,
      1,
      `${name}: duplicate DECLARE section`,
    );
    assert.deepEqual(
      declarations.map((line) => line.replace(/^DECLARE\s+/u, "")),
      expected,
    );
  }
});

test("draft source fix does not introduce report publication or alter integrity triggers", () => {
  for (const name of [
    "assert_result_sheet_manifest_complete",
    "validate_result_sheet_evidence",
    "validate_result_sheet_review",
  ]) {
    assert.ok(sql.includes(`CREATE FUNCTION "${name}"`));
  }
  assert.ok(sql.includes('CREATE TRIGGER "ResultSheetEvidence_validate"'));
  assert.ok(sql.includes('CREATE TRIGGER "ResultSheetReview_validate"'));
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
  assert.equal(sql.includes('CREATE TABLE "ResultPublicationRelease"'), false);
});
