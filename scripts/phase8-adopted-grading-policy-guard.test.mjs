import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const model = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013090000_phase8_result_grading_adoption/migration.sql",
);
const svc = read("../src/modules/results/grading-adoption-service.ts");
const route = read(
  "../app/api/schools/[schoolId]/result-grading-adoptions/route.ts",
);
test("adoption uses exact immutable policy version, SQL School Super Admin guard", () => {
  for (const n of [
    "ResultGradingAdoption_policy_fkey",
    "ResultGradingAdoption_actor_fkey",
  ]) {
    assert.ok(
      sql.includes('"' + n + '"') && model.includes('map: "' + n + '"'),
    );
  }
  assert.ok(sql.includes("actor.\"role\"='SCHOOL_SUPER_ADMIN'"));
  assert.ok(sql.includes('policy."id"=NEW."policyId"'));
  assert.ok(sql.includes('policy."classId"=NEW."classId"'));
  assert.ok(sql.includes('NEW."ordinal":=next_ordinal'));
  assert.ok(sql.includes('school."isActive"=true FOR UPDATE'));
  for (const n of [
    "ResultGradingAdoption_validate",
    "ResultGradingAdoption_immutable",
    "ResultGradingAdoption_no_truncate",
  ])
    assert.ok(sql.includes('"' + n + '"'));
});
test("adoption never publishes result and reads only bounded owner history", () => {
  assert.ok(svc.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(svc.includes('isolationLevel: "Serializable"'));
  assert.ok(svc.includes("LIMIT 200"));
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("ACADEMIC_POLICY_ADOPTED_NOT_PUBLISHED"));
  assert.equal(svc.includes("AssessmentQuestionKey"), false);
  assert.equal(svc.includes("ReportCard"), false);
});
