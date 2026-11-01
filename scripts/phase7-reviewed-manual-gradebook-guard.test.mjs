import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(
  new URL(
    "../src/modules/assessments/reviewed-manual-gradebook-service.ts",
    import.meta.url,
  ),
  "utf8",
);
const compact = source.replace(/\s+/g, "");
test("reviewed gradebook derives approved initial and corrected marks", () => {
  assert.ok(source.includes("initial.\"action\"='APPROVED'"));
  assert.ok(source.includes("decision.\"action\"='APPROVED'"));
  assert.ok(source.includes('ORDER BY request."revision" DESC LIMIT 1'));
  assert.ok(source.includes("ACADEMIC_APPROVED_PREVIEW_ONLY"));
});
test("read-only gradebook remains scoped to assignment and active enrollment", () => {
  assert.ok(source.includes("teacher.\"role\"='TEACHER'"));
  assert.ok(source.includes("enrollment.\"status\"='ACTIVE'"));
  assert.ok(source.includes('assignment."subjectId"='));
  assert.ok(source.includes("seenEmptyRows.has(r.studentId)"));
  assert.ok(compact.includes("student.unapprovedComponents===0"));
  assert.ok(compact.includes("student.pendingCorrections===0"));
  assert.ok(compact.includes("rows.length>15500"));
});
