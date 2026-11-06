import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// Formatting-insensitive source guard: retain every asserted token,
// including SQL policy, private-data denials and tenant/owner checks.
// This changes whitespace matching only; it does not remove assertions.
const hasCode = (source, fragment) =>
  source.replace(/\s+/g, "").includes(fragment.replace(/\s+/g, ""));

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013150000_phase8_report_aggregation_rule_revisions/migration.sql",
);
const service = read(
  "../src/modules/results/report-aggregation-rule-service.ts",
);
const route = read(
  "../app/api/schools/[schoolId]/report-aggregation-rules/route.ts",
);
const page = read(
  "../app/schools/[schoolId]/report-aggregation-rules/page.tsx",
);
const workspace = read(
  "../src/components/report-aggregation-rule-workspace.tsx",
);
const pure = read("../src/modules/results/report-composition-simulation.ts");
const tests = read(
  "../src/modules/results/report-composition-simulation.test.ts",
);
const integration = read(
  "../src/modules/assessments/questions.integration.test.ts",
);

test("adopted report aggregation rules are owner-scoped immutable histories, not release", () => {
  assert.ok(schema.includes("model ReportAggregationRuleRevision {"));
  assert.ok(
    sql.includes('"ReportAggregationRuleRevision_schoolId_version_key"'),
  );
  assert.ok(sql.includes('school."isActive"=true FOR UPDATE'));
  assert.ok(sql.includes('owner."userId"=NEW."actorUserId"'));
  assert.ok(sql.includes('owner."id"=NEW."actorMembershipId"'));
  assert.ok(sql.includes("owner.\"role\"='SCHOOL_SUPER_ADMIN'"));
  assert.ok(sql.includes('NEW."version":=COALESCE(previous."version",0)+1'));
  for (const suffix of ["validate", "immutable", "no_truncate"])
    assert.ok(sql.includes('"ReportAggregationRuleRevision_' + suffix + '"'));
  assert.equal(sql.includes('CREATE TABLE "ReportCard"'), false);
  assert.equal(sql.includes("INSERT INTO"), false);
});
test("private API cannot select a grading rule for another school or return student marks", () => {
  assert.ok(hasCode(service, "assessmentUserId()"));
  assert.ok(hasCode(service, 'role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(hasCode(service, 'isolationLevel: "Serializable"'));
  assert.ok(hasCode(service, "}).strict()"));
  assert.ok(hasCode(service, 'owner."userId"=${userId}'));
  assert.ok(hasCode(service, 'WHERE rule."schoolId"=${schoolId}'));
  assert.ok(hasCode(service, "LIMIT 100"));
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("AGGREGATION_RULE_ADOPTED_NOT_PUBLISHED"));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(hasCode(integration, 'adoptRule("super", first, schoolB)'));
  assert.ok(
    hasCode(integration, "prisma.reportAggregationRuleRevision.update("),
  );
  assert.ok(
    hasCode(integration, "prisma.reportAggregationRuleRevision.delete("),
  );
});
test("score math is private, deterministic, explicitly chosen, and never defaults to an official report", () => {
  assert.ok(hasCode(pure, '"PRIVATE_COMPOSITION_SIMULATION_ONLY"'));
  assert.ok(hasCode(pure, 'categoryMethod === "EQUAL_ASSESSMENT_BPS"'));
  assert.ok(hasCode(pure, "BigInt(mark.earned) * BigInt(10000)"));
  assert.ok(
    hasCode(pure, "simulateSchoolGradeScale(input.scale, rawPercentBps)"),
  );
  assert.ok(hasCode(pure, "seenPupils.has(pupil.studentId)"));
  assert.ok(
    hasCode(
      pure,
      'if (weight > 0) throw new Error("Missing mandatory weighted category")',
    ),
  );
  assert.ok(tests.includes("pools category points"));
  assert.ok(
    tests.includes("does not combine different adopted weighting versions"),
  );
  assert.ok(hasCode(workspace, 'useState<Method | "">("")'));
  assert.ok(hasCode(workspace, 'useState<Mode | "">("")'));
  assert.equal(route.includes("studentSourceCards"), false);
  assert.equal(route.includes("officialPercentBps"), false);
});
