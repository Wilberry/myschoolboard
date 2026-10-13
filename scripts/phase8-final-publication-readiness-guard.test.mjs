import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../prisma/migrations/20261013110000_phase8_final_publication_readiness/migration.sql");
const integration = read("../src/modules/assessments/questions.integration.test.ts");

test("Phase 8 final publication readiness is SQL-only and never publishes", () => {
  assert.ok(sql.includes('CREATE FUNCTION "assert_result_publication_readiness"('));
  assert.equal(sql.includes("CREATE TABLE"), false);
  assert.equal(sql.includes("CREATE TRIGGER"), false);
  assert.equal(sql.includes("INSERT INTO"), false);
  assert.equal(sql.includes("UPDATE "), false);
  assert.equal(sql.includes("DELETE FROM"), false);
  assert.ok(sql.includes('WHERE school."id"=p_school AND school."isActive"=true FOR UPDATE'));
  assert.ok(sql.includes('RETURN TRUE;'));
});
test("readiness demands current School Super Admin and complete independent sources", () => {
  for (const fragment of [
    'owner."userId"=p_owner_user', 'owner."id"=p_owner_membership',
    'owner."role"=\'SCHOOL_SUPER_ADMIN\'',
    'teacher."role"=\'TEACHER\'', 'assignment."status"=\'ACTIVE\'',
    'review."action"=\'APPROVED\'', 'scope."verified"=true',
    'scope."scopeId"=snapshot."actualSectionId"',
    'reviewer."userId"<>snapshot."teacherUserId"',
    'snapshot."actualStage"=\'PRIMARY\'', 'snapshot."actualStage"=\'SECONDARY\'',
    'adopted."id" IS DISTINCT FROM snapshot."adoptionId"',
    'latest_id IS DISTINCT FROM p_evidence',
    '"build_result_sheet_source_manifest"(',
    '"assert_result_sheet_manifest_complete"(',
    '"assert_result_sheet_weighted_categories"(',
    'current_manifest IS DISTINCT FROM snapshot."sourceManifest"',
  ]) assert.ok(sql.includes(fragment), fragment);
  for (const fragment of [
    'const finalReady = (targetSchool: string, targetEvidence: string,',
    'members.head, users.head', 'members.super, users.head',
    'schoolB, thirdId', 'firstId, members.super', 'secondId, members.super',
    'await expect(finalReady(schoolA, thirdId, members.super, users.super))',
  ]) assert.ok(integration.includes(fragment), fragment);
});
