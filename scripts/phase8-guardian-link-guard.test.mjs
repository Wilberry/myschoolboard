import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261013180000_phase8_guardian_student_link_evidence/migration.sql");
const service = read("../src/modules/students/guardian-link-service.ts");
const routes = read("../app/api/schools/[schoolId]/guardian-links/route.ts");
const revocationRoute = read("../app/api/schools/[schoolId]/guardian-links/[linkId]/revoke/route.ts");
const http = read("../src/modules/students/guardian-http.ts");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

test("guardian relationship evidence is tenant-bound, many-to-many and immutable", () => {
  for (const token of [
    "model GuardianStudentLink {",
    "model GuardianStudentLinkRevocation {",
    "@@unique([schoolId, studentId, guardianMembershipId])",
    "@@unique([schoolId, linkId])",
    "guardianStudentLinks GuardianStudentLink[]",
    "guardianStudentLinkRevocations GuardianStudentLinkRevocation[]",
  ]) assert.ok(schema.includes(token), token);
  for (const token of [
    'CREATE TABLE "GuardianStudentLink"',
    'CREATE TABLE "GuardianStudentLinkRevocation"',
    'CREATE FUNCTION "validate_guardian_student_link"()',
    'CREATE FUNCTION "validate_guardian_student_link_revocation"()',
    'WHERE "id"=NEW."schoolId"',
    'AND "isActive"=true FOR UPDATE',
    'administrator."userId"=NEW."attestedByUserId"',
    'guardian."role"=\'PARENT\'',
    'guardian."isActive"=true',
    'student."status"=\'ENROLLED\'',
    'enrollment."status"=\'ACTIVE\'',
    'guardian."userId"<>NEW."attestedByUserId"',
    'link."schoolId"=NEW."schoolId"',
    '"GuardianStudentLink_validate"',
    '"GuardianStudentLinkRevocation_validate"',
    '"GuardianStudentLink_immutable"',
    '"GuardianStudentLinkRevocation_immutable"',
    '"GuardianStudentLink_no_truncate"',
    '"GuardianStudentLinkRevocation_no_truncate"',
  ]) assert.ok(sql.includes(token), token);
  assert.equal(sql.includes("GRANT SELECT"), false);
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
});

test("school administrators must explicitly attest and revoke, no guardian report route", () => {
  for (const token of [
    "identityVerified: z.literal(true)",
    "guardianMembershipId: id", "studentId: id",
    "requireSchoolConfigActor(tx, userId, schoolId)",
    'role: "PARENT"', 'status: "ENROLLED"',
    'status: "ACTIVE"', "guardianStudentLink.create(",
    "guardianStudentLinkRevocation.create(",
    'revocation: null', 'isolationLevel: "Serializable"',
    'admin."userId"=${userId}',
    'admin."role" IN (\'SCHOOL_ADMIN\',\'SCHOOL_SUPER_ADMIN\')',
    'LIMIT 100',
  ]) assert.ok(service.includes(token), token);
  assert.ok(service.includes('if (!administrator) throw new AcademicConfigError("NOT_FOUND")'));
  assert.ok(routes.includes("export async function GET"));
  assert.ok(routes.includes("export async function POST"));
  assert.ok(revocationRoute.includes("export async function POST"));
  assert.equal(revocationRoute.includes("export async function GET"), false);
  assert.ok(routes.includes("GUARDIAN_LINK_EVIDENCE_ONLY_NO_REPORT_ACCESS"));
  assert.ok(revocationRoute.includes("GUARDIAN_LINK_REVOKED_NO_REPORT_ACCESS"));
  assert.ok(http.includes('private, no-store'));
  assert.ok(http.includes("noindex, noarchive, nosnippet"));
  assert.equal(routes.includes("rawPercentBps"), false);
  assert.equal(service.includes("composedStudentCards"), false);
});

test("integration exercises tenant, actor, enrollment, forged SQL and audit negatives", () => {
  for (const token of [
    'GUARDIAN_POST(', 'GUARDIAN_GET(', 'GUARDIAN_REVOKE(',
    '"identityVerified: false"', 'members.parent', 'members.parent2',
    'studentId: "missing-pupil"', '"REGISTERED"',
    'data: { id: unenrolledId, schoolId: schoolA,',
    'attestedByUserId: users.parent',
    'prisma.guardianStudentLink.update(',
    'prisma.guardianStudentLink.delete(',
    'TRUNCATE "GuardianStudentLink"',
    'TRUNCATE "GuardianStudentLinkRevocation"',
    '"GUARDIAN_LINK_REVOKED_NO_REPORT_ACCESS"',
  ]) {
    const normalized = token === '"identityVerified: false"' ? 'identityVerified: false' : token;
    assert.ok(integration.includes(normalized), token);
  }
});
