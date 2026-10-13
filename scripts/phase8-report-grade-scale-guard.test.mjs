import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261013140000_phase8_report_grade_scale_revisions/migration.sql");
const service = read("../src/modules/results/report-grade-scale-service.ts");
const route = read("../app/api/schools/[schoolId]/report-grade-scales/route.ts");
const page = read("../app/schools/[schoolId]/report-grade-scales/page.tsx");
const simulation = read("../src/modules/results/report-grade-scale.ts");
const workspace = read("../src/components/report-grade-scale-workspace.tsx");
const specs = read("../src/modules/results/report-grade-scale.test.ts");
const integration = read("../src/modules/assessments/questions.integration.test.ts");
test("adopted grade scale has no defaults, SQL validates bands and preserves immutable revisions", () => {
  assert.ok(schema.includes("model ReportGradeScaleRevision {"));
  assert.ok(sql.includes('CREATE FUNCTION "assert_report_grade_scale_bands"('));
  assert.ok(sql.includes('jsonb_array_length(p_bands) NOT BETWEEN 1 AND 20'));
  assert.ok(sql.includes('this_min<>previous_max+1'));
  assert.ok(sql.includes("previous_max<>10000"));
  assert.ok(sql.includes('lower(code)=ANY(codes)'));
  assert.ok(sql.includes('NEW."version":=next_version'));
  assert.ok(sql.includes('NEW."adoptedAt":=(clock_timestamp()'));
  for (const verb of ["validate", "immutable", "no_truncate"])
    assert.ok(sql.includes('"ReportGradeScaleRevision_'+verb+'"'));
  assert.ok(sql.includes('"ReportGradeScaleRevision_schoolId_version_key"'));
  assert.equal(sql.includes("INSERT INTO"),false);
  assert.equal(sql.includes('CREATE TABLE "ReportCard"'),false);
});
test("school owner is server authenticated and other school identities concealed", () => {
  assert.ok(sql.includes('WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE'));
  assert.ok(sql.includes('owner."userId"=NEW."actorUserId"'));
  assert.ok(sql.includes('owner."id"=NEW."actorMembershipId"'));
  assert.ok(sql.includes('owner."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.ok(service.includes('assessmentUserId()'));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes('inputSchema = z.object({'));
  assert.ok(service.includes('}).strict()'));
  assert.ok(service.includes('WHERE scale."schoolId"=${schoolId}'));
  assert.ok(service.includes('LIMIT 100'));
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("SCHOOL_GRADE_SCALE_ADOPTED_NOT_PUBLISHED"));
  assert.ok(page.includes('if (!owner) notFound()'));
  assert.ok(integration.includes("await expect(prisma.reportGradeScaleRevision.update("));
  assert.ok(integration.includes("await expect(prisma.reportGradeScaleRevision.delete("));
});
test("rounding and threshold evaluation remain school-selected and simulation-only", () => {
  assert.ok(simulation.includes('status: "PRIVATE_POLICY_SIMULATION_ONLY"'));
  assert.ok(simulation.includes('validateReportGradeScale'));
  assert.ok(simulation.includes('policy.bandBasis === "RAW_BPS"'));
  assert.ok(simulation.includes('policy.roundingMode === "FLOOR"'));
  assert.ok(simulation.includes('policy.roundingMode === "CEILING"'));
  assert.ok(specs.includes("resolves all 0..10000 basis-point threshold edges"));
  assert.ok(specs.includes("raw-vs-displayed grade-band classification"));
  assert.equal(simulation.includes("OFFICIAL_REPORT_PUBLISHED"), false);
});

test("school must actively choose rounding, precision and grade-band basis before adoption", () => {
  assert.ok(workspace.includes('useState<0 | 1 | 2 | null>(null)'));
  assert.ok(workspace.includes('useState<"HALF_UP" | "FLOOR" | "CEILING" | "">("")'));
  assert.ok(workspace.includes('useState<"RAW_BPS" | "DISPLAY_ROUNDED_BPS" | "">("")'));
  assert.ok(workspace.includes('Choose display precision'));
  assert.ok(workspace.includes('Choose rounding mode'));
  assert.ok(workspace.includes('Choose the threshold basis'));
  assert.ok(workspace.includes('disabled={busy || !policy || reason.trim().length < 5}'));
});
