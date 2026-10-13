import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013180000_phase8_report_visibility_policy_revisions/migration.sql",
);
const service = read("../src/modules/results/report-visibility-policy-service.ts");
const route = read("../app/api/schools/[schoolId]/report-visibility-policies/route.ts");
const page = read("../app/schools/[schoolId]/report-visibility-policies/page.tsx");
const workspace = read("../src/components/report-visibility-policy-workspace.tsx");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

const modes = [
  "ASSESSMENT_ONLY",
  "GUARDIAN_AFTER_RELEASE",
  "STUDENT_AFTER_RELEASE",
  "GUARDIAN_AND_STUDENT_AFTER_RELEASE",
];

test("school-only visibility revision is append-only and never grants report access", () => {
  assert.ok(schema.includes("model ReportVisibilityPolicyRevision {"));
  assert.ok(sql.includes('"ReportVisibilityPolicyRevision_schoolId_version_key"'));
  assert.ok(sql.includes('"ReportVisibilityPolicyRevision_actor_fkey"'));
  assert.ok(sql.includes('school."isActive"=true FOR UPDATE'));
  assert.ok(sql.includes('owner."userId"=NEW."actorUserId"'));
  assert.ok(sql.includes('owner."id"=NEW."actorMembershipId"'));
  assert.ok(sql.includes("owner.\"role\"='SCHOOL_SUPER_ADMIN'"));
  assert.ok(sql.includes('NEW."version":=COALESCE(previous."version",0)+1'));
  assert.ok(sql.includes('NEW."adoptedAt":=(clock_timestamp()'));
  assert.ok(sql.includes("Identical visibility policy already adopted"));
  for (const suffix of ["validate", "immutable", "no_truncate"]) {
    assert.ok(sql.includes(`"ReportVisibilityPolicyRevision_${suffix}"`));
  }
  for (const mode of modes) {
    assert.ok(sql.includes(`'${mode}'`));
    assert.ok(service.includes(`"${mode}"`));
    assert.ok(workspace.includes(`value="${mode}"`));
  }
  assert.equal(sql.includes("INSERT INTO"), false);
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
  assert.equal(sql.includes("GRANT SELECT"), false);
});

test("private API and UI require current same-school owner and deliberate intent", () => {
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes(".strict()"));
  assert.ok(service.includes('owner."userId"=${userId}'));
  assert.ok(service.includes('WHERE policy."schoolId"=${schoolId}'));
  assert.ok(service.includes("LIMIT 100"));
  assert.equal(service.includes('policy."composedStudentCards"'), false);
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("CONFIGURATION_ONLY_NO_REPORT_RECIPIENT_ACCESS"));
  assert.ok(route.includes("VISIBILITY_POLICY_ADOPTED_REPORTS_NOT_RELEASED"));
  assert.equal(route.includes("studentId"), false);
  assert.equal(route.includes("composedStudentCards"), false);
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(workspace.includes('useState<Mode | "">("")'));
  assert.ok(workspace.includes('disabled={busy || !recipientMode || reason.trim().length < 5}'));
  assert.ok(workspace.includes("report-card reader, release action"));
});

test("integration tests enforce roles, tenant isolation and immutable privacy", () => {
  assert.ok(integration.includes('adopt("super", mode, schoolB)'));
  assert.ok(integration.includes('history("super", schoolB)'));
  assert.ok(integration.includes('recipientMode: "ALL_PUBLIC"'));
  assert.ok(integration.includes('expect((await adopt("super", mode)).status).toBe(409)'));
  assert.ok(integration.includes("prisma.reportVisibilityPolicyRevision.update("));
  assert.ok(integration.includes("prisma.reportVisibilityPolicyRevision.delete("));
  assert.ok(integration.includes('TRUNCATE "ReportVisibilityPolicyRevision"'));
  assert.ok(integration.includes('expect(metadata).not.toContain(pupilId)'));
  assert.ok(integration.includes("privateOfficialReportComposition.count("));
  assert.ok(integration.includes('data: { isActive: false }'));
  assert.ok(integration.includes('expect((await history("super")).status).toBe(404)'));
});
