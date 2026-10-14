import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const load = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const sql = load(
  "../prisma/migrations/20261013100000_phase8_result_sheet_evidence_review/migration.sql",
);
const schema = load("../prisma/schema.prisma");
const service = load("../src/modules/results/result-sheet-evidence-service.ts");
test("phase 8 source evidence remains immutable and database computed", () => {
  for (const n of ["ResultSheetEvidence", "ResultSheetReview"]) {
    assert.ok(schema.includes("model " + n + " {"));
    for (const suffix of ["validate", "immutable", "no_truncate"])
      assert.ok(sql.includes('"' + n + "_" + suffix + '"'));
  }
  for (const check of [
    'NEW."sourceManifest":=frozen',
    "jsonb_array_length(frozen)",
    'NEW."revision":=next_revision',
    "Every pupil requires an assessment source",
    "Missing category required by adopted policy",
    "Identical source and adoption cannot create a new revision",
    "Source marks or student roster changed since preparation",
  ])
    assert.ok(sql.includes(check), check);
});
test("academic review repeats verified exact-section authorization and stays private", () => {
  for (const check of [
    'scope."verified"=true',
    "reviewer.\"role\"='HEAD_OF_SECTION'",
    "reviewer.\"role\"='PRINCIPAL'",
    'NEW."reviewerUserId"<>snapshot."teacherUserId"',
    "IF NEW.\"action\"='APPROVED' THEN",
  ])
    assert.ok(sql.includes(check), check);
  assert.ok(service.includes("exactAssessmentTeacher("));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.equal(sql.includes('CREATE TABLE "ReportCard"'), false);
});

test("every positive-weight grading category is checked for each pupil at preparation AND review", () => {
  const body = sql
    .split('CREATE FUNCTION "assert_result_sheet_weighted_categories"(')[1]
    ?.split("$$ LANGUAGE plpgsql;")[0];
  assert.ok(body, "weighted category function must exist");
  assert.ok(
    body.includes("jsonb_array_elements(p_manifest) AS student(value)"),
  );
  for (const [weight, kind] of [
    ["p_quiz_weight", "QUIZ"],
    ["p_test_weight", "TEST"],
    ["p_exam_weight", "EXAM"],
  ]) {
    assert.ok(body.includes(weight + ">0 AND NOT EXISTS"), weight);
    assert.ok(body.includes("item.value->>'kind'='" + kind + "'"), kind);
  }
  assert.equal((body.match(/NOT EXISTS/g) || []).length, 3);
  for (const fn of [
    "validate_result_sheet_evidence",
    "validate_result_sheet_review",
  ]) {
    const content = sql
      .split('CREATE FUNCTION "' + fn + '"() RETURNS trigger AS $$')[1]
      ?.split("$$ LANGUAGE plpgsql;")[0];
    assert.ok(
      content?.includes('PERFORM "assert_result_sheet_weighted_categories"('),
      fn,
    );
  }
});
