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
  "../prisma/migrations/20261013160000_phase8_private_official_report_compositions/migration.sql",
);
const hardening = read(
  "../prisma/migrations/20261013170000_phase8_private_composition_source_status_hardening/migration.sql",
);
const service = read(
  "../src/modules/results/private-official-report-composition-service.ts",
);
const route = read(
  "../app/api/schools/[schoolId]/private-official-report-compositions/route.ts",
);
const page = read(
  "../app/schools/[schoolId]/private-report-compositions/page.tsx",
);
const ui = read("../src/components/private-official-composition-workspace.tsx");
const integration = read(
  "../src/modules/assessments/questions.integration.test.ts",
);

test("database alone computes and freezes private grade evidence with pinned school policies", () => {
  assert.ok(schema.includes("model PrivateOfficialReportComposition {"));
  assert.ok(sql.includes('CREATE FUNCTION "round_report_fraction"('));
  assert.ok(
    sql.includes('CREATE FUNCTION "build_private_official_report_cards"('),
  );
  assert.ok(
    sql.includes(
      'CREATE FUNCTION "validate_private_official_report_composition"(',
    ),
  );
  assert.ok(sql.includes('PERFORM "assert_result_publication_readiness"('));
  assert.ok(sql.includes('PERFORM "assert_report_grade_scale_bands"(bands)'));
  assert.ok(sql.includes('NEW."composedStudentCards":=cards'));
  assert.ok(
    sql.includes("NEW.\"status\":='INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED'"),
  );
  assert.ok(sql.includes("grade_basis BETWEEN"));
  assert.ok(sql.includes('"round_report_fraction"(earned_total*10000'));
  assert.ok(
    sql.includes('"round_report_fraction"(normalized_total,n,precision_mode)'),
  );
  assert.ok(
    sql.includes(
      "pupil->>'adoptedWeightVersion' IS DISTINCT FROM weight_version::TEXT",
    ),
  );
  assert.ok(sql.includes("IF weight>0 THEN"));
  assert.ok(sql.includes("source_ids:=array_append(source_ids,mark_id)"));
  assert.ok(
    sql.includes("pupil_ids:=array_append(pupil_ids,pupil->>'studentId')"),
  );
  assert.ok(
    sql.includes('max(x."version") FROM "ReportAggregationRuleRevision"'),
  );
  assert.ok(sql.includes('max(x."version") FROM "ReportGradeScaleRevision"'));
  for (const suffix of ["validate", "immutable", "no_truncate"])
    assert.ok(
      sql.includes('"PrivateOfficialReportComposition_' + suffix + '"'),
    );
  assert.ok(
    sql.includes(
      '"PrivateOfficialReportComposition_schoolId_sourcePacketId_key"',
    ),
  );
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
  assert.equal(sql.includes("GRANT SELECT"), false);
});
test("private API never accepts pupil scores, computed grades, actor identities or public release", () => {
  assert.ok(hasCode(service, "assessmentUserId()"));
  assert.ok(hasCode(service, 'role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(hasCode(service, 'isolationLevel: "Serializable"'));
  assert.ok(hasCode(service, "}).strict()"));
  assert.ok(hasCode(service, "tx.privateOfficialReportComposition.create("));
  assert.ok(hasCode(service, 'owner."userId"=${userId}'));
  assert.ok(hasCode(service, 'WHERE composition."schoolId"=${schoolId}'));
  assert.ok(hasCode(service, "LIMIT 100"));
  assert.equal(hasCode(service, 'composition."composedStudentCards"'), false);
  assert.equal(hasCode(service, "studentSourceCards: true"), false);
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("PRIVATE_COMPOSITION_FROZEN_NOT_PUBLISHED"));
  assert.equal(route.includes("composedStudentCards"), false);
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(ui.includes("Choose current school grade scale"));
  assert.ok(ui.includes("Choose current school aggregation rule"));
  assert.equal(ui.includes("studentId"), false);
  assert.equal(ui.includes("rawPercentBps"), false);
});
test("integration scenarios cover SQL calculation parity and mutable-record protection", () => {
  for (const token of [
    "simulatePrivateReportComposition({",
    'const accepted = await compose("super", payload)',
    "const frozen = await prisma.privateOfficialReportComposition.findFirstOrThrow",
    "expect(metadata).not.toContain(pupilId)",
    'expect(metadata).not.toContain("composedStudentCards")',
    "prisma.privateOfficialReportComposition.update(",
    "prisma.privateOfficialReportComposition.delete(",
    'TRUNCATE "PrivateOfficialReportComposition"',
    'SELECT "build_private_official_report_cards"(',
  ])
    assert.ok(hasCode(integration, token), token);
  assert.match(
    integration,
    /expect\s*\(\s*composed\.find\s*\(\s*\(?item\)?\s*=>\s*item\.studentId\s*===\s*row\.studentId\s*\)\s*,?\s*\)\s*\.toMatchObject\s*\(/,
    "Composed student identity must be checked against SQL-generated grade evidence",
  );
});

test("forward-only report composition patch rejects absent and changed pupil statuses", () => {
  assert.ok(
    sql.includes("pupil->>'reportStatus'<>'INTERNAL_SOURCE_ONLY_NOT_RELEASED'"),
  );
  assert.ok(
    hardening.includes(
      'CREATE OR REPLACE FUNCTION "build_private_official_report_cards"(',
    ),
  );
  assert.ok(
    hardening.includes(
      "pupil->>'reportStatus' IS DISTINCT FROM 'INTERNAL_SOURCE_ONLY_NOT_RELEASED'",
    ),
  );
  assert.equal(
    hardening.includes(
      "pupil->>'reportStatus'<>'INTERNAL_SOURCE_ONLY_NOT_RELEASED'",
    ),
    false,
  );
  assert.equal(
    hardening.includes('CREATE TABLE "PrivateOfficialReportComposition"'),
    false,
  );
  assert.equal(hardening.includes("GRANT SELECT"), false);
  assert.ok(
    hardening.includes("Missing positive-weight pupil assessment category"),
  );
  assert.ok(
    hardening.includes("Invalid or unapproved assessment source points") ||
      hardening.includes("Assessment points exceed valid source range"),
  );
  for (const status of ["undefined", "null", '"PUBLISHED"']) {
    assert.ok(hasCode(integration, status), status);
  }
  assert.ok(
    hasCode(
      integration,
      "const malformed = [{ ...synthetic[0], reportStatus: statusVariant }]",
    ),
  );
});
