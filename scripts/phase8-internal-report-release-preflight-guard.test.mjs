import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013190000_phase8_internal_report_release_preflight/migration.sql",
);
const service = read("../src/modules/results/internal-report-release-preflight-service.ts");
const route = read("../app/api/schools/[schoolId]/report-release-preflights/route.ts");
const page = read("../app/schools/[schoolId]/report-release-preflights/page.tsx");
const workspace = read("../src/components/report-release-preflight-workspace.tsx");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

test("private release preflight locks current academic evidence and never publishes grades", () => {
  assert.ok(schema.includes("model ResultReleasePreflightAttestation {"));
  assert.ok(sql.includes('CREATE FUNCTION "validate_result_release_preflight_attestation"'));
  assert.ok(sql.includes('PERFORM "assert_result_publication_readiness"('));
  assert.ok(sql.includes('"build_private_official_report_cards"('));
  assert.ok(sql.includes('recomputed IS DISTINCT FROM composition."composedStudentCards"'));
  assert.ok(sql.includes('visibility."recipientMode"=\'ASSESSMENT_ONLY\''));
  assert.ok(sql.includes('max(v."version") FROM "ReportVisibilityPolicyRevision"'));
  assert.ok(sql.includes('max(a2."version") FROM "ReportAggregationRuleRevision"'));
  assert.ok(sql.includes('max(g2."version") FROM "ReportGradeScaleRevision"'));
  assert.ok(sql.includes('source_packet."id"=composition."sourcePacketId"'));
  assert.ok(sql.includes('decision."status" IS DISTINCT FROM \'APPROVED_AWAITING_RELEASE\''));
  assert.ok(sql.includes('IF EXISTS (\n   SELECT 1 FROM "ResultReleasePreflightAttestation" earlier'));
  assert.ok(sql.includes('NEW."status":=\'INTERNAL_RELEASE_PREFLIGHT_ONLY_NOT_AUTHORIZATION\''));
  assert.ok(schema.includes('recipientMode String @default("INTERNAL_UNSET")'));
  assert.ok(sql.includes('DEFAULT \'INTERNAL_UNSET\''));
  assert.ok(sql.includes('char_length("evidenceId")>0'));
  assert.ok(sql.includes('char_length("sourcePacketId")>0'));

  for (const name of ["validate", "immutable", "no_truncate"]) {
    assert.ok(sql.includes(`"ResultReleasePreflightAttestation_${name}"`));
  }
  assert.equal(sql.includes('CREATE TABLE "PublishedResult"'), false);
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
  assert.equal(sql.includes("GRANT SELECT"), false);
  assert.equal(sql.includes("INSERT INTO"), false);
});

test("preflight API accepts only exact owner request, discloses metadata and never grants access", () => {
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes('compositionId: identifier'));
  assert.ok(service.includes('visibilityPolicyId: identifier'));
  assert.ok(service.includes(".strict()"));
  assert.ok(service.includes('owner."userId"=${userId}'));
  assert.ok(service.includes('WHERE att."schoolId"=${schoolId}'));
  assert.ok(service.includes("LIMIT 100"));
  assert.equal(service.includes('recipientMode: "ASSESSMENT_ONLY"'), false);
  assert.equal(service.includes('sourcePacketId: ""'), false);

  assert.equal(service.includes('att."composedStudentCards"'), false);
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("INTERNAL_PREFLIGHT_ONLY_NOT_AUTHORIZED_OR_RELEASED"));
  assert.equal(route.includes("studentId"), false);
  assert.equal(route.includes("composedStudentCards"), false);
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(workspace.includes('Record private readiness check (never publish)'));
  assert.equal(workspace.includes("rawPercentBps"), false);
  assert.equal(workspace.includes("studentId"), false);
});

test("integration coverage rejects stale visibility and revoked teacher-review/owner authorization", () => {
  assert.ok(integration.includes('record("super", payload, schoolB)'));
  assert.ok(integration.includes('history("super", schoolB)'));
  assert.ok(integration.includes('visibilityPolicyId: olderVisibility.id'));
  assert.ok(integration.includes('data: { verified: false }'));
  assert.ok(integration.includes('data: { isActive: false }'));
  assert.ok(integration.includes('isPublished: true'));
  assert.ok(integration.includes('reportStatus: "PUBLISHED"'));
  assert.ok(integration.includes('prisma.resultReleasePreflightAttestation.update('));
  assert.ok(integration.includes('prisma.resultReleasePreflightAttestation.delete('));
  assert.ok(integration.includes('TRUNCATE "ResultReleasePreflightAttestation"'));
  assert.ok(integration.includes('expect(metadata).not.toContain(secret)'));
});
