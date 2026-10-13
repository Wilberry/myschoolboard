import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const load = path => readFileSync(new URL(path, import.meta.url), "utf8");
const service = load("../src/modules/results/publication-candidate-service.ts");
const route = load("../app/api/schools/[schoolId]/result-publication-candidates/route.ts");
const page = load("../app/schools/[schoolId]/result-publication-preflight/page.tsx");
const workspace = load("../src/components/result-publication-preflight-workspace.tsx");

test("owner candidate API remains strictly read-only, private and metadata-only", () => {
  assert.ok(route.includes("export async function GET("));
  assert.equal(route.includes("export async function POST("), false);
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("INTERNAL_PREFLIGHT_ONLY_NOT_PUBLISHED"));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(service.includes("Prisma.sql"));
  assert.ok(service.includes('owner."role"=\'SCHOOL_SUPER_ADMIN\''));
  assert.equal(service.includes('AS "sourceManifest"'), false);
  assert.equal(service.includes('SELECT evidence."sourceManifest"'), false);
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(workspace.includes("Publication remains disabled."));
  assert.equal(workspace.includes("fetch(") && workspace.includes('method: "POST"'), false);
});
test("owner view rechecks fresh independent approval and enrolled-pupil categories", () => {
  for (const required of [
    'review."action"=\'APPROVED\'', 'scope."verified"=true',
    'reviewer."userId"<>teacher."userId"',
    'assignment."status"=\'ACTIVE\'',
    'session."status"=\'ACTIVE\'', 'term."status"=\'ACTIVE\'',
    'newer."ordinal">adoption."ordinal"', 'later."revision">evidence."revision"',
    '"build_result_sheet_source_manifest"(', 'jsonb_array_elements(evidence."sourceManifest")',
    'policy."quizWeight">0', 'policy."testWeight">0', 'policy."examWeight">0',
    'LIMIT 100',
  ]) assert.ok(service.includes(required), required);
  assert.equal(service.includes("ResultPublicationEvent"), false);
  assert.equal(service.includes("ReportCard"), false);
});
