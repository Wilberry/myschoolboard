import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013200000_phase8_guardian_relationship_evidence/migration.sql",
);
const service = read("../src/modules/results/guardian-relationship-service.ts");
const events = read("../app/api/schools/[schoolId]/guardian-relationships/route.ts");
const diagnostic = read(
  "../app/api/schools/[schoolId]/guardian-relationships/inspect/route.ts",
);
const page = read("../app/schools/[schoolId]/guardian-relationships/page.tsx");
const workspace = read("../src/components/guardian-relationship-workspace.tsx");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

test("guardian relationship ledger has exact school-locked reviewed VERIFY/REVOKE rules", () => {
  assert.ok(schema.includes("model GuardianStudentRelationshipEvent {"));
  assert.ok(sql.includes('CREATE FUNCTION "validate_guardian_student_relationship_event"'));
  assert.ok(sql.includes('school."isActive"=true FOR UPDATE'));
  assert.ok(sql.includes('owner."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.ok(sql.includes('guardian."role"=\'PARENT\''));
  assert.ok(sql.includes('guardian_user."emailVerified"=true'));
  assert.ok(sql.includes('student."status"=\'ENROLLED\''));
  assert.ok(sql.includes('enrollment."status"=\'ACTIVE\''));
  assert.ok(sql.includes('NEW."action"=\'VERIFY\''));
  assert.ok(sql.includes('NEW."ordinal":=COALESCE(previous."ordinal",0)+1'));
  assert.ok(sql.includes('NEW."evidenceReviewed":=(NEW."action"=\'VERIFY\')'));
  assert.ok(sql.includes('NEW."recordedAt":=(clock_timestamp()'));
  assert.ok(sql.includes('"GuardianStudentRelationshipEvent_pair_ordinal_key"'));
  for (const suffix of ["validate", "immutable", "no_truncate"]) {
    assert.ok(sql.includes(`"GuardianStudentRelationshipEvent_${suffix}"`));
  }
  for (const reference of ["student", "guardian", "actor"]) {
    assert.ok(sql.includes(`"GuardianStudentRelationshipEvent_${reference}_fkey"`));
  }
  assert.equal(sql.includes('CREATE TABLE "PublishedResult"'), false);
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
  assert.equal(sql.includes("GRANT SELECT"), false);
});

test("report-specific relationship diagnostic explicitly never authorizes report access", () => {
  assert.ok(sql.includes('CREATE FUNCTION "inspect_private_report_recipient_relationship"'));
  assert.ok(sql.includes('owner."id"=p_actor_membership'));
  assert.ok(sql.includes('owner."userId"=p_actor_user'));
  assert.ok(sql.includes('comp."status"=\'INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED\''));
  assert.ok(sql.includes('enrollment."classId"=snapshot."classId"'));
  assert.ok(sql.includes('enrollment."sessionId"=snapshot."sessionId"'));
  assert.ok(sql.includes('card.value->>\'studentId\'=p_student'));
  assert.ok(sql.includes('link."studentMembershipId"=p_recipient_member'));
  assert.ok(sql.includes('revoked."id" IS NULL'));
  assert.ok(sql.includes('ORDER BY evt."ordinal" DESC LIMIT 1'));
  assert.ok(sql.includes("RETURN 'RELATIONSHIP_VERIFIED_NOT_RELEASED'"));
  assert.ok(sql.includes("RETURN 'NO_VERIFIED_RELATIONSHIP_OR_POLICY'"));
  assert.ok(service.includes("authorizedForReports: false"));
  assert.equal(service.includes("composedStudentCards: true"), false);
  assert.equal(events.includes("rawPercentBps"), false);
  assert.equal(diagnostic.includes("composedStudentCards"), false);
  assert.ok(diagnostic.includes("PRIVATE_RELATIONSHIP_DIAGNOSTIC_NOT_PUBLICATION"));
});

test("current owner endpoints deny forged grants and preserve immutable private ledger", () => {
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes("z.discriminatedUnion"));
  assert.ok(service.includes("relationshipEvidenceReviewed: z.literal(true)"));
  assert.ok(service.includes(".strict()"));
  assert.ok(service.includes('owner."userId"=${userId}'));
  assert.ok(service.includes("LIMIT 100"));
  assert.ok(events.includes("manualHeaders"));
  assert.ok(diagnostic.includes("manualHeaders"));
  assert.ok(page.includes("if (!owner) notFound()"));
  assert.ok(workspace.includes("Record relationship evidence (no report access)"));
  for (const evidence of [
    'record("super", verified, schoolB)',
    'history("super", schoolB)',
    'inspect("super", query, schoolB)',
    'relationshipEvidenceReviewed: false',
    'data: { isActive: false }',
    'action: "REVOKE"',
    'prisma.guardianStudentRelationshipEvent.update(',
    'prisma.guardianStudentRelationshipEvent.delete(',
    'TRUNCATE "GuardianStudentRelationshipEvent"',
    'authorizedForReports',
  ]) assert.ok(integration.includes(evidence), evidence);
});
