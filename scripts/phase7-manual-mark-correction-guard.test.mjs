import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read("../prisma/migrations/20261012360000_phase7_manual_mark_correction_ledger/migration.sql");
const svc = read("../src/modules/assessments/manual-correction-service.ts");
test("manual mark revision requests and independent decisions remain immutable", () => {
 assert.match(schema,/model AssessmentManualCorrectionRequest \{/);
 assert.match(schema,/model AssessmentManualCorrectionDecision \{/);
 for(const n of ["AssessmentManualCorrectionRequest_proposal_fkey",
  "AssessmentManualCorrectionRequest_requester_fkey",
  "AssessmentManualCorrectionDecision_request_fkey",
  "AssessmentManualCorrectionDecision_reviewer_fkey"]){
  assert.ok(schema.includes('map: "'+n+'"') && sql.includes('"'+n+'"'),n);
 }
 for(const n of ["AssessmentManualCorrectionRequest_validate",
  "AssessmentManualCorrectionDecision_validate",
  "AssessmentManualCorrectionRequest_immutable",
  "AssessmentManualCorrectionDecision_immutable",
  "AssessmentManualCorrectionRequest_no_truncate",
  "AssessmentManualCorrectionDecision_no_truncate"]){
  assert.ok(sql.includes('"'+n+'"'),n);
 }
 assert.equal((sql.match(/RETURNS trigger AS \$\$/g)||[]).length,2);
 assert.equal((sql.match(/\$\$ LANGUAGE plpgsql/g)||[]).length,2);
});
test("only approved initial mark and true unreviewed next correction can enter ledger", () => {
 assert.match(sql,/original\."action"='APPROVED'/);
 assert.match(sql,/NEW\."requesterMembershipId"/);
 assert.match(sql,/requester\."userId"=NEW\."requesterUserId"/);
 assert.match(sql,/requester\."role"='TEACHER'/);
 assert.match(sql,/enrollment\."status"='ACTIVE'/);
 assert.match(sql,/decision\."id" IS NULL/);
 assert.match(sql,/NEW\."proposedPoints"=current_points/);
 assert.match(sql,/NEW\."revision":=next_revision/);
 assert.match(sql,/"assert_manual_mark_section_reviewer"/);
 assert.match(sql,/newer\."revision">/);
 assert.match(sql,/FOR UPDATE/);
});
test("current approved mark only from independently approved correction decisions",()=>{
 assert.match(svc,/approved."proposedPoints"/);
 assert.match(svc,/decision\."action"='APPROVED'/);
 assert.match(svc,/revision" DESC LIMIT 1/);
 assert.match(svc,/listManualCorrectionReviewQueue/);
 assert.match(svc,/scope\."verified"=true/);
 assert.doesNotMatch(svc,/AssessmentQuestionKey|correctIndex|answerKey/);
});
