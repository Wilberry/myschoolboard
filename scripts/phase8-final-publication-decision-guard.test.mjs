import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013120000_phase8_final_publication_decision/migration.sql",
);
const service = read(
  "../src/modules/results/final-publication-decision-service.ts",
);
const route = read(
  "../app/api/schools/[schoolId]/result-final-publication-decisions/route.ts",
);
const page = read("../app/schools/[schoolId]/result-final-approvals/page.tsx");
const integration = read(
  "../src/modules/assessments/questions.integration.test.ts",
);

test("final school approval ledger is immutable and distinct from result release", () => {
  assert.ok(schema.includes("model ResultFinalPublicationDecision {"));
  for (const suffix of ["validate", "immutable", "no_truncate"])
    assert.ok(sql.includes('"ResultFinalPublicationDecision_' + suffix + '"'));
  assert.ok(
    sql.includes('"ResultFinalPublicationDecision_schoolId_evidenceId_key"'),
  );
  assert.ok(
    sql.includes('"ResultFinalPublicationDecision_context_ordinal_key"'),
  );
  assert.ok(sql.includes("\"status\"='APPROVED_AWAITING_RELEASE'"));
  assert.ok(sql.includes("NEW.\"status\":='APPROVED_AWAITING_RELEASE'"));
  assert.equal(sql.includes('CREATE TABLE "ReportCard"'), false);
  assert.equal(sql.includes('CREATE TABLE "ResultPublicationRelease"'), false);
  assert.equal(sql.includes('UPDATE "ResultSheetEvidence"'), false);
  assert.ok(route.includes("FINAL_OWNER_APPROVED_AWAITING_RELEASE_NOT_PUBLIC"));
});
test("final approval is authorized independently and revalidates current sources under lock", () => {
  assert.ok(sql.includes('PERFORM "assert_result_publication_readiness"('));
  assert.ok(sql.includes('NEW."actorMembershipId", NEW."actorUserId"'));
  assert.ok(sql.includes('NEW."ordinal":=next_ordinal'));
  assert.ok(sql.includes('NEW."decidedAt":=(clock_timestamp()'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes("tx.resultFinalPublicationDecision.create("));
  assert.ok(service.includes("finalDecisionFailure(error)"));
  assert.ok(route.includes("manualHeaders"));
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  for (const required of [
    "members.super, users.super",
    "actorUserId: users.super",
    "prisma.resultFinalPublicationDecision.update(",
    "prisma.resultFinalPublicationDecision.delete(",
    'TRUNCATE "ResultFinalPublicationDecision"',
    "expect(historyJSON).not.toContain(pupilId)",
  ])
    assert.ok(integration.includes(required), required);
});
test("private ledger responses disclose metadata only", () => {
  assert.ok(service.includes("Prisma.sql"));
  assert.ok(service.includes('owner."userId"=${userId}'));
  assert.equal(service.includes('decision."sourceManifest"'), false);
  assert.equal(service.includes('evidence."sourceManifest"'), false);
  assert.equal(service.includes('"earnedPoints"'), false);
  assert.equal(service.includes('"studentId"'), false);
  assert.ok(service.includes("LIMIT 100"));
});
