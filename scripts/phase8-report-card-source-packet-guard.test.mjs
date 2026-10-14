import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { includesSource } from "./source-text.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013130000_phase8_private_report_card_source_packets/migration.sql",
);
const service = read(
  "../src/modules/results/report-card-source-packet-service.ts",
);
const route = read(
  "../app/api/schools/[schoolId]/report-card-source-packets/route.ts",
);
const page = read("../app/schools/[schoolId]/report-card-sources/page.tsx");
const ui = read("../src/components/report-card-source-workspace.tsx");
const integration = read(
  "../src/modules/assessments/questions.integration.test.ts",
);

test("private source packet is immutable and cannot create an official grade", () => {
  assert.ok(schema.includes("model ResultReportCardSourcePacket {"));
  for (const name of ["validate", "immutable", "no_truncate"])
    assert.ok(sql.includes('"ResultReportCardSourcePacket_' + name + '"'));
  assert.ok(
    sql.includes('"ResultReportCardSourcePacket_schoolId_finalDecisionId_key"'),
  );
  assert.ok(sql.includes('NEW."studentSourceCards":=cards'));
  assert.ok(sql.includes('NEW."finalDecisionOrdinal":=snapshot."ordinal"'));
  assert.ok(sql.includes("'reportStatus','INTERNAL_SOURCE_ONLY_NOT_RELEASED'"));
  assert.equal(sql.includes("'officialGrade'"), false);
  assert.equal(sql.includes("'passMark'"), false);
  assert.equal(sql.includes('CREATE TABLE "ReportCardRelease"'), false);
  assert.equal(sql.includes('CREATE TABLE "ResultPublicationRelease"'), false);
});
test("packet creation must revalidate current owner, approval and roster under DB lock", () => {
  assert.ok(sql.includes('PERFORM "assert_result_publication_readiness"('));
  assert.ok(sql.includes('NEW."actorMembershipId",NEW."actorUserId"'));
  assert.ok(sql.includes('decision."status"'));
  assert.ok(sql.includes("'APPROVED_AWAITING_RELEASE'"));
  assert.ok(
    sql.includes(
      'jsonb_array_elements(snapshot."sourceManifest") AS pupil(value)',
    ),
  );
  assert.ok(sql.includes('NEW."studentCount":=jsonb_array_length(cards)'));
  assert.ok(service.includes('isolationLevel: "Serializable"'));
  assert.ok(service.includes('role: "SCHOOL_SUPER_ADMIN"'));
  assert.ok(service.includes("assessmentUserId()"));
  assert.ok(
    includesSource(service, "request = z.object({") &&
      includesSource(service, "}).strict()"),
  );
  assert.ok(service.includes("tx.resultReportCardSourcePacket.create("));
  assert.ok(page.includes('role: "SCHOOL_SUPER_ADMIN"'));
  for (const token of [
    'const sourceCreated = await freezeSource("super", sourceInput)',
    'const laterPacketResponse = await freezeSource("super",',
    "prisma.resultReportCardSourcePacket.update(",
    "prisma.resultReportCardSourcePacket.delete(",
    'TRUNCATE "ResultReportCardSourcePacket"',
  ])
    assert.ok(includesSource(integration, token), token);
});
test("private metadata routes never return frozen per-pupil packet contents", () => {
  assert.ok(route.includes("manualHeaders"));
  assert.ok(route.includes("PRIVATE_SOURCE_PREPARED_NOT_GRADED_NOT_RELEASED"));
  assert.ok(route.includes("PRIVATE_SOURCE_ONLY_NOT_GRADED_NOT_RELEASED"));
  assert.ok(service.includes("Prisma.sql"));
  assert.ok(service.includes("LIMIT 100"));
  assert.equal(service.includes('packet."studentSourceCards"'), false);
  assert.equal(service.includes('SELECT packet."studentSourceCards"'), false);
  assert.ok(ui.includes("do not publish"));
  assert.ok(
    integration.includes("expect(publicPayload).not.toContain(pupilId)"),
  );
  assert.ok(
    integration.includes(
      'expect(publicPayload).not.toContain("studentSourceCards")',
    ),
  );
});
