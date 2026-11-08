import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

const migration = read(
  "prisma/migrations/20261101010000_guardian_student_attestations/migration.sql",
);
const schema = read("prisma/schema.prisma");
const policy = read("src/modules/authorization/policy.ts");
const resolver = read("src/modules/tenancy/context.ts");
const service = read("src/modules/students/guardian-link-service.ts");
const http = read("src/modules/students/guardian-link-http.ts");
const adminRoutes = read("app/api/schools/[schoolId]/guardian-links/route.ts");
const revokeRoute = read(
  "app/api/schools/[schoolId]/guardian-links/[linkId]/revoke/route.ts",
);
const browserLauncher = read("scripts/launch-phase1-7-verification.mjs");
const guardianIntegration = read(
  "src/modules/students/guardian-link.integration.test.ts",
);

test("Issue #20 remains fail-closed for generic child reads", () => {
  assert.match(
    policy,
    /if \(action === "child:read"\) \{\s*return \{ allowed: false, reason: "forbidden" \};/,
  );
  assert.match(resolver, /if \(scope.type === "SUBJECT"\)/);
  assert.match(resolver, /CHILD scopes?/i);
  assert.match(
    resolver,
    /relationship with current enrollment and revocation is implemented\.\s*return false;/,
  );
});

test("guardian attestation migration is additive and has tenant-safe integrity", () => {
  assert.equal((migration.match(/^CREATE TABLE /gm) ?? []).length, 2);
  for (const entity of [
    "GuardianStudentLink",
    "GuardianStudentLinkRevocation",
  ]) {
    assert.match(schema, new RegExp("model " + entity + " \\{"));
    assert.ok(migration.includes('CREATE TABLE "' + entity + '"'));
    assert.ok(migration.includes('"' + entity + '_immutable"'));
    assert.ok(migration.includes('"' + entity + '_no_truncate"'));
  }
  for (const fragment of [
    'FOREIGN KEY ("schoolId", "studentId")',
    'FOREIGN KEY ("schoolId", "guardianMembershipId")',
    'FOREIGN KEY ("schoolId", "attestedByMembershipId")',
    'FOREIGN KEY ("schoolId", "linkId")',
    "validate_guardian_student_binding",
    "validate_guardian_link_revocation",
    `guardian."role"='PARENT'`,
    `student."status"='ENROLLED'`,
    `e."status"='ACTIVE'`,
  ]) {
    assert.ok(migration.includes(fragment), "Missing: " + fragment);
  }
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b|\bTRUNCATE\s+TABLE\b/i);
});

test("guardian links are admin-only, private and cannot grant content access", () => {
  assert.match(service, /relationshipVerified: z\.literal\(true\)/);
  assert.match(service, /requireSchoolConfigActor\(tx, userId, schoolId\)/);
  assert.match(service, /isolationLevel: "Serializable"/);
  assert.match(service, /role: "PARENT"/);
  assert.match(service, /revocation: null/);
  assert.match(service, /export async function hasCurrentGuardianRelationship/);
  assert.match(service, /const userId = await actorId\(\)/);
  assert.match(service, /session: \{ schoolId, status: "ACTIVE" \}/);
  assert.match(service, /school: \{ isActive: true \}/);
  assert.match(http, /"Cache-Control": "private, no-store"/);
  assert.match(adminRoutes, /handleGuardianLink\(request, params, "attest"\)/);
  assert.match(adminRoutes, /handleGuardianLink\(request, params, "list"\)/);
  assert.match(revokeRoute, /handleGuardianLink\(request, params, "revoke"\)/);
  assert.doesNotMatch(adminRoutes, /child:read|report:publish/);
  assert.doesNotMatch(revokeRoute, /export async function GET/);
});

test("guarded browser runner requires the current 60 exact migrations", () => {
  const migrations = readdirSync(
    new URL("../prisma/migrations/", import.meta.url),
    { withFileTypes: true },
  ).filter((entry) => entry.isDirectory());
  assert.equal(migrations.length, 60);
  assert.match(browserLauncher, /expectedMigrationCount = 60/);
  assert.match(
    browserLauncher,
    /runMigrationChecksumVerification\(environment\)/,
  );
  assert.match(browserLauncher, /assertFreshFixtureDatabase\(databaseState\)/);
});

test("guardian regression retains real withdrawal, revocation races and parent isolation", () => {
  const cases = guardianIntegration.match(/^  it\("/gm) ?? [];
  assert.ok(
    cases.length >= 16,
    "Guardian regressions must not be silently removed",
  );
  assert.match(guardianIntegration, /await withdrawRoute\(/);
  assert.match(guardianIntegration, /eventType: "WITHDRAWN"/);
  assert.match(guardianIntegration, /expect\(ended.status\).toBe\("ENDED"\)/);
  assert.match(
    guardianIntegration,
    /expect\(historicalLink.revocation\).toBeNull\(\)/,
  );
  assert.match(guardianIntegration, /currentRelationship\("unlinkedGuardian"/);
  assert.match(
    guardianIntegration,
    /never double-revokes under concurrent authenticated requests/,
  );
  assert.match(guardianIntegration, /Promise.all\(\[/);
  assert.match(guardianIntegration, /guardianStudentLinkRevocation.count/);
  assert.match(
    guardianIntegration,
    /rechecks the administrator role before reading or revoking stored links/,
  );
});
