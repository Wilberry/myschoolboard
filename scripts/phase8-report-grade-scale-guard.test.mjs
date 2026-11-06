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
  "../prisma/migrations/20261013140000_phase8_report_grade_scale_revisions/migration.sql",
);
const service = read("../src/modules/results/report-grade-scale-service.ts");
const route = read(
  "../app/api/schools/[schoolId]/report-grade-scales/route.ts",
);
const page = read("../app/schools/[schoolId]/report-grade-scales/page.tsx");
const simulation = read("../src/modules/results/report-grade-scale.ts");
const workspace = read("../src/components/report-grade-scale-workspace.tsx");
const specs = read("../src/modules/results/report-grade-scale.test.ts");
const integration = read(
  "../src/modules/assessments/questions.integration.test.ts",
);
test("adopted grade scale has no defaults, SQL validates bands and preserves immutable revisions", () => {
  assert.ok(schema.includes("model ReportGradeScaleRevision {"));
  assert.ok(sql.includes('CREATE FUNCTION "assert_report_grade_scale_bands"('));
  assert.ok(sql.includes("jsonb_array_length(p_bands) NOT BETWEEN 1 AND 20"));
  assert.ok(sql.includes("this_min<>previous_max+1"));
  assert.ok(sql.includes("previous_max<>10000"));
  assert.ok(sql.includes("lower(code)=ANY(codes)"));
  assert.ok(sql.includes('NEW."version":=next_version'));
  assert.ok(sql.includes('NEW."adoptedAt":=(clock_timestamp()'));
  for (const verb of ["validate", "immutable", "no_truncate"])
    assert.ok(sql.includes('"ReportGradeScaleRevision_' + verb + '"'));
  assert.ok(sql.includes('"ReportGradeScaleRevision_schoolId_version_key"'));
  assert.equal(sql.includes("INSERT INTO"), false);
  assert.equal(sql.includes('CREATE TABLE "ReportCard"'), false);
});
test("school owner is server authenticated and other school identities concealed", () => {
  assert.ok(
    sql.includes(
      'WHERE school."id"=NEW."schoolId" AND school."isActive"=true FOR UPDATE',
    ),
  );
  assert.ok(sql.includes('owner."userId"=NEW."actorUserId"'));
  assert.ok(sql.includes('owner."id"=NEW."actorMembershipId"'));
  assert.ok(sql.includes("owner.\"role\"='SCHOOL_SUPER_ADMIN'"));
  assert.ok(hasCode(service, "assessmentUserId()"));
  assert.ok(hasCode(service, 'role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(hasCode(service, 'isolationLevel: "Serializable"'));
  assert.ok(hasCode(service, "inputSchema = z.object({"));
  assert.ok(hasCode(service, "}).strict()"));
  assert.ok(hasCode(service, 'WHERE scale."schoolId"=${schoolId}'));
  assert.ok(hasCode(service, "LIMIT 100"));
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("SCHOOL_GRADE_SCALE_ADOPTED_NOT_PUBLISHED"));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(
    hasCode(
      integration,
      "await expect(prisma.reportGradeScaleRevision.update(",
    ),
  );
  assert.ok(
    hasCode(
      integration,
      "await expect(prisma.reportGradeScaleRevision.delete(",
    ),
  );
});
test("rounding and threshold evaluation remain school-selected and simulation-only", () => {
  assert.ok(simulation.includes('status: "PRIVATE_POLICY_SIMULATION_ONLY"'));
  assert.ok(simulation.includes("validateReportGradeScale"));
  assert.ok(simulation.includes('policy.bandBasis === "RAW_BPS"'));
  assert.ok(simulation.includes('policy.roundingMode === "FLOOR"'));
  assert.ok(simulation.includes('policy.roundingMode === "CEILING"'));
  assert.ok(
    specs.includes("resolves all 0..10000 basis-point threshold edges"),
  );
  assert.ok(specs.includes("raw-vs-displayed grade-band classification"));
  assert.equal(simulation.includes("OFFICIAL_REPORT_PUBLISHED"), false);
});

test("school must actively choose rounding, precision and grade-band basis before adoption", () => {
  assert.ok(hasCode(workspace, "useState<0 | 1 | 2 | null>(null)"));
  assert.ok(
    hasCode(workspace, 'useState<"HALF_UP" | "FLOOR" | "CEILING" | "">("")'),
  );
  assert.ok(
    hasCode(workspace, 'useState<"RAW_BPS" | "DISPLAY_ROUNDED_BPS" | "">("")'),
  );
  assert.ok(hasCode(workspace, "Choose display precision"));
  assert.ok(hasCode(workspace, "Choose rounding mode"));
  assert.ok(hasCode(workspace, "Choose the threshold basis"));
  assert.ok(
    hasCode(
      workspace,
      "disabled={busy || !policy || reason.trim().length < 5}",
    ),
  );
});
// The original 47 migrations must not be rewritten to fix a column width.
test("grade scale explicit displayed basis has forward-only VARCHAR(32) fix", () => {
  const model = schema
    .split("model ReportGradeScaleRevision {")[1]
    ?.split("\n}")[0];
  assert.ok(model?.includes("bandBasis String @db.VarChar(32)"));
  assert.equal("DISPLAY_ROUNDED_BPS".length, 19);
  const patch = read(
    "../prisma/migrations/20261105000000_phase8_grade_scale_band_basis_width/migration.sql",
  );
  assert.ok(patch.includes('ALTER TABLE "ReportGradeScaleRevision"'));
  assert.ok(patch.includes('ALTER COLUMN "bandBasis" TYPE VARCHAR(32);'));
  assert.doesNotMatch(patch, /\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT)\b/i);
  assert.ok(sql.includes('"bandBasis" VARCHAR(16) NOT NULL'));
});
