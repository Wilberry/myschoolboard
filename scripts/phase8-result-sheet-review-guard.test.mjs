import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=load("../prisma/migrations/20261013100000_phase8_result_sheet_evidence_review/migration.sql");
const schema=load("../prisma/schema.prisma");
const service=load("../src/modules/results/result-sheet-evidence-service.ts");
test("phase 8 source evidence remains immutable and database computed",()=>{
 for(const n of ["ResultSheetEvidence","ResultSheetReview"]){
  assert.ok(schema.includes("model "+n+" {"));
  for(const suffix of ["validate","immutable","no_truncate"])
   assert.ok(sql.includes('"'+n+"_"+suffix+'"'));
 }
 for(const check of ["NEW.\"sourceManifest\":=frozen","jsonb_array_length(frozen)","NEW.\"revision\":=next_revision",
  "Every pupil requires an assessment source","Missing category required by adopted policy",
  "Identical source and adoption cannot create a new revision",
  "Source marks or student roster changed since preparation"])
  assert.ok(sql.includes(check),check);
});
test("academic review repeats verified exact-section authorization and stays private",()=>{
 for(const check of ["grant.\"verified\"=true",
  "reviewer.\"role\"='HEAD_OF_SECTION'","reviewer.\"role\"='PRINCIPAL'",
  "NEW.\"reviewerUserId\"<>snapshot.\"teacherUserId\"",
  "IF NEW.\"action\"='APPROVED' THEN"])
  assert.ok(sql.includes(check),check);
 assert.ok(service.includes("exactAssessmentTeacher("));
 assert.ok(service.includes("isolationLevel: \"Serializable\""));
 assert.equal(sql.includes('CREATE TABLE "ReportCard"'),false);
});
