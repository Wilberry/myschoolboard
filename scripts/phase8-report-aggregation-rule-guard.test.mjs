import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261013150000_phase8_report_aggregation_rule_revisions/migration.sql");
const service = read("../src/modules/results/report-aggregation-rule-service.ts");
const route = read("../app/api/schools/[schoolId]/report-aggregation-rules/route.ts");
const page = read("../app/schools/[schoolId]/report-aggregation-rules/page.tsx");
const workspace = read("../src/components/report-aggregation-rule-workspace.tsx");
const pure = read("../src/modules/results/report-composition-simulation.ts");
const tests = read("../src/modules/results/report-composition-simulation.test.ts");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

test("adopted report aggregation rules are owner-scoped immutable histories, not release", () => {
  assert.ok(schema.includes("model ReportAggregationRuleRevision {"));
  assert.ok(sql.includes('"ReportAggregationRuleRevision_schoolId_version_key"'));
  assert.ok(sql.includes('school."isActive"=true FOR UPDATE'));
  assert.ok(sql.includes('owner."userId"=NEW."actorUserId"'));
  assert.ok(sql.includes('owner."id"=NEW."actorMembershipId"'));
  assert.ok(sql.includes('owner."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.ok(sql.includes('NEW."version":=COALESCE(previous."version",0)+1'));
  for (const suffix of ["validate", "immutable", "no_truncate"])
    assert.ok(sql.includes('"ReportAggregationRuleRevision_'+suffix+'"'));
  assert.equal(sql.includes('CREATE TABLE "ReportCard"'), false);
  assert.equal(sql.includes('INSERT INTO'), false);
});
test("private API cannot select a grading rule for another school or return student marks", () => {
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes("}).strict()"));
  assert.ok(service.includes('owner."userId"=${userId}'));
  assert.ok(service.includes('WHERE rule."schoolId"=${schoolId}'));
  assert.ok(service.includes("LIMIT 100"));
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("AGGREGATION_RULE_ADOPTED_NOT_PUBLISHED"));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(integration.includes('adoptRule("super", first, schoolB)'));
  assert.ok(integration.includes('prisma.reportAggregationRuleRevision.update('));
  assert.ok(integration.includes('prisma.reportAggregationRuleRevision.delete('));
});
test("score math is private, deterministic, explicitly chosen, and never defaults to an official report", () => {
  assert.ok(pure.includes('"PRIVATE_COMPOSITION_SIMULATION_ONLY"'));
  assert.ok(pure.includes('categoryMethod === "EQUAL_ASSESSMENT_BPS"'));
  assert.ok(pure.includes('BigInt(mark.earned) * 10000n'));
  assert.ok(pure.includes("simulateSchoolGradeScale(input.scale, rawPercentBps)"));
  assert.ok(pure.includes("seenPupils.has(pupil.studentId)"));
  assert.ok(pure.includes('if (weight > 0) throw new Error("Missing mandatory weighted category")'));
  assert.ok(tests.includes("pools category points"));
  assert.ok(tests.includes("does not combine different adopted weighting versions"));
  assert.ok(workspace.includes('useState<Method | "">("")'));
  assert.ok(workspace.includes('useState<Mode | "">("")'));
  assert.equal(route.includes("studentSourceCards"), false);
  assert.equal(route.includes("officialPercentBps"), false);
});
