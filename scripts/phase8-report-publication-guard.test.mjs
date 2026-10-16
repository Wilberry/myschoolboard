import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const schema = read("../prisma/schema.prisma");
const sql = read(
  "../prisma/migrations/20261013190000_phase8_release_visibility_and_ack/migration.sql",
);
const publication = read(
  "../src/modules/results/report-publication-service.ts",
);
const recipient = read("../src/modules/results/recipient-report-service.ts");
const http = read("../src/modules/results/report-http.ts");
const policyRoute = read(
  "../app/api/schools/[schoolId]/report-visibility-policies/route.ts",
);
const releaseRoute = read(
  "../app/api/schools/[schoolId]/report-recipient-releases/route.ts",
);
const reportRoute = read(
  "../app/api/schools/[schoolId]/published-reports/route.ts",
);
const acknowledgmentRoute = read(
  "../app/api/schools/[schoolId]/published-reports/acknowledgments/[releaseId]/[studentId]/route.ts",
);
const tests = read("../src/modules/assessments/questions.integration.test.ts");
const ownerUI = read("../src/components/report-release-workspace.tsx");
const recipientUI = read("../src/components/published-report-workspace.tsx");
const transport = read("../src/modules/results/recipient-browser-delivery.ts");
const transportTests = read(
  "../src/modules/results/recipient-browser-delivery.test.ts",
);
const home = read("../app/page.tsx");
const publishedPage = read(
  "../app/schools/[schoolId]/published-reports/page.tsx",
);
const nextConfig = read("../next.config.ts");
const nextConfigTests = read("../next.config.test.ts");

test("policy, immutable independent release, and per-child acknowledgment have three exact-school ledgers", () => {
  for (const mode of [
    "SCHOOL_ONLY",
    "STUDENT_ONLY",
    "GUARDIAN_ONLY",
    "GUARDIAN_FIRST_ACK",
  ]) {
    assert.ok(schema.includes(mode), mode);
    assert.ok(sql.includes(mode), mode);
  }
  for (const model of [
    "ReportVisibilityPolicyRevision",
    "ReportRecipientRelease",
    "ReportGuardianAcknowledgment",
  ]) {
    assert.ok(schema.includes(`model ${model} {`), model);
    assert.ok(sql.includes(`CREATE TABLE "${model}"`), model);
    assert.ok(sql.includes(`"${model}_immutable"`), model);
    assert.ok(sql.includes(`"${model}_no_truncate"`), model);
  }
  for (const token of [
    '"ReportVisibilityPolicyRevision_schoolId_version_key"',
    '"ReportRecipientRelease_exact_ordinal_key"',
    '"ReportRecipientRelease_composition_policy_key"',
    '"ReportGuardianAcknowledgment_exact_receipt_key"',
    'CREATE FUNCTION "validate_report_visibility_policy"()',
    'CREATE FUNCTION "validate_report_recipient_release"()',
    'CREATE FUNCTION "validate_report_guardian_acknowledgment"()',
    '"assert_result_publication_readiness"(',
    '"build_private_official_report_cards"(',
    'recalculated IS DISTINCT FROM snapshot."composedStudentCards"',
    'NEW."visibilityPolicyVersion":=school_policy."version"',
    'NEW."releaseOrdinal":=last_ordinal+1',
    'policy."version"=(\n   SELECT max(v."version")',
    'guardian."userId"=NEW."actorUserId"',
    'guardian."isActive"=true',
    "guardian.\"role\"='PARENT'",
    'revoked."linkId"=link."id"',
  ])
    assert.ok(sql.includes(token), token);
  assert.equal((sql.match(/\$\$/g) || []).length, 6);
  assert.equal(sql.includes("GRANT SELECT TO PUBLIC"), false);
});

test("owner release is confirmation-gated and report readers are independently tenant-authorized", () => {
  for (const token of [
    "PHASE8_REPORT_RELEASE_ENABLED",
    "PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED",
    "confirmRecipientRelease: z.literal(true)",
    'role: "SCHOOL_SUPER_ADMIN"',
    "isActive: true",
    'isolationLevel: "Serializable"',
    "reportVisibilityPolicyRevision.create(",
    "reportRecipientRelease.create(",
    "owner.\"role\"='SCHOOL_SUPER_ADMIN'",
  ])
    assert.ok(publication.includes(token), token);
  for (const token of [
    'reportGate("recipient")',
    'role: { in: ["STUDENT", "PARENT"] }',
    'JOIN "StudentEnrollment" e',
    'JOIN "StudentRecord" pupil',
    'FROM "StudentAccountLink" link',
    'FROM "GuardianStudentLink" link',
    '"StudentAccountLinkRevocation"',
    '"GuardianStudentLinkRevocation"',
    '"ReportGuardianAcknowledgment" receipt',
    'guardian."isActive"=true',
    'newer."releaseOrdinal">release."releaseOrdinal"',
    'policy."version"=(\n        SELECT max(latest."version")',
    'release."schoolId"=${schoolId}',
    'AND recipient."isActive"=true',
    "LIMIT 101",
    "readCurrentPublishedReports",
    "guardianLinkId: link.id",
    "acknowledge: z.literal(true)",
  ])
    assert.ok(recipient.includes(token), token);
  // There are two independent guardian-revocation boundaries: parent view
  // and student post-acknowledgment, and two exact receipt projections.
  assert.ok(recipient.split('"GuardianStudentLinkRevocation"').length >= 3);
  assert.ok(
    recipient.split('"ReportGuardianAcknowledgment" receipt').length >= 3,
  );
  assert.equal(recipient.includes("AssessmentQuestionKey"), false);
  assert.ok(policyRoute.includes("adoptReportVisibilityPolicy"));
  assert.ok(releaseRoute.includes("releaseOfficialComposition"));
  assert.ok(reportRoute.includes("readCurrentPublishedReports"));
  assert.ok(acknowledgmentRoute.includes("acknowledgeGuardianReport"));
  assert.equal(reportRoute.includes("export async function POST"), false);
  assert.equal(
    acknowledgmentRoute.includes("export async function GET"),
    false,
  );
  assert.ok(http.includes("private, no-store, max-age=0"));
  assert.ok(http.includes("noindex, noarchive, nosnippet"));
  assert.ok(ownerUI.includes("I have inspected the frozen grades"));
  assert.ok(recipientUI.includes("window.print()"));
  // Academic school-detail navigation deliberately excludes guardians/pupils.
  // Recipient portal must be reachable separately without an academic:read grant.
  assert.ok(home.includes('role === "STUDENT" || role === "PARENT"'));
  assert.ok(home.includes("/published-reports"));
});

test("authenticated tests cover visibility revision changes, replay, role, revocation, parent's explicit receipt", () => {
  for (const token of [
    "REPORT_VISIBILITY_POST",
    "REPORT_RELEASE_POST",
    "PUBLISHED_REPORT_GET",
    "REPORT_ACK_POST",
    'mode: "GUARDIAN_ONLY"',
    'mode: "GUARDIAN_FIRST_ACK"',
    "policy2.version).toBe(2)",
    "release3.releaseOrdinal).toBe(3)",
    '"GUARDIAN_FIRST_ACK"',
    "guardianHasAcknowledged).toBe(false)",
    "guardianHasAcknowledged).toBe(true)",
    "members.parent2",
    'published("parent2")',
    'published("student")',
    'published("teacher")',
    'process.env.PHASE8_REPORT_RELEASE_ENABLED = "true"',
    'process.env.PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED = "true"',
    "prisma.reportRecipientRelease.delete(",
    "prisma.reportGuardianAcknowledgment.update(",
    'TRUNCATE "ReportRecipientRelease"',
    "const releaseRace = await Promise.all([",
    "const acknowledgmentRace = await Promise.all([",
    'mode: "STUDENT_ONLY"',
    "policy4.version).toBe(4)",
    "release4.releaseOrdinal).toBe(4)",
    'recipientRole: "STUDENT"',
    'const studentAckRead = await published("student")',
    "guardianHasAcknowledged).toBe(true)",
    "prisma.studentAccountLinkRevocation.create(",
    "reserveInternalCbtAttempt(schoolA, admittedAttempt.draftId)",
    'PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED = "true"',
    "actorUserId: users.parent2",
    "guardianMembershipId: members.parent2",
    "prisma.reportRecipientRelease.create(",
    "prisma.reportGuardianAcknowledgment.create(",
  ])
    assert.ok(tests.includes(token), token);
});

test("recipient browser discards hidden/bfcache grades and reauthorizes every print", () => {
  const normalizedRecipientUI = recipientUI.replace(/\s+/g, " ");
  for (const token of [
    'document.addEventListener("visibilitychange", onVisibility)',
    'window.addEventListener("focus", onFocus)',
    'window.addEventListener("pagehide", onPageHide)',
    'window.addEventListener("pageshow", onPageShow)',
    'window.addEventListener("afterprint", onAfterPrint)',
    "event.persisted",
    "fetchRef.current?.abort()",
    "printFetchRef.current?.abort()",
    "setRows([])",
    "setPrintAllowed(false)",
    'data-print-authorized={printAllowed ? "true" : "false"}',
    '.published-report-workspace[data-print-authorized="false"] article',
    "fetchCurrentRecipientRows<Subject>(",
    "window.print()",
    "flushSync(() => {",
  ])
    assert.ok(normalizedRecipientUI.includes(token), token);
  // PARENT and STUDENT intentionally cannot open the staff academic page.
  assert.ok(publishedPage.includes('<Link href="/">Back to my schools</Link>'));
  assert.equal(publishedPage.includes("Back to school"), false);
  assert.ok(
    publishedPage.includes(
      "<PublishedReportWorkspace key={schoolId} schoolId={schoolId} />",
    ),
  );
  // An acknowledgment, successful or not, changes what may be displayed.
  // Clear the old child rows before POST; refetch only after it settles.
  assert.ok(recipientUI.includes("fetchRef.current?.abort();"));
  assert.ok(
    recipientUI.includes(
      'setStatus("Rechecking school authorization after acknowledgment…")',
    ),
  );
  assert.ok(recipientUI.includes("setRows([]);"));
  assert.ok(recipientUI.includes("setRefresh((v) => v + 1);"));
  assert.ok(transport.includes("if (signal?.aborted)"));
  assert.ok(transport.split("if (signal?.aborted)").length >= 4);
  for (const marker of [
    "cancellation occurs while the network is pending",
    "cancellation happens before parsing resolves",
  ])
    assert.ok(transportTests.includes(marker), marker);
  for (const token of [
    'cache: "no-store"',
    'credentials: "same-origin"',
    "signal,",
    "if (!response.ok)",
    "payload.reports.length > 100",
    "throw new Error",
  ])
    assert.ok(transport.includes(token), token);
  for (const token of [
    "same-origin, no-store",
    "refuses denied",
    "oversized server projections",
    "aborted request",
  ])
    assert.ok(transportTests.includes(token), token);
});

test("private academic and recipient page HTML sets independent cache and indexing controls", () => {
  for (const path of [
    "/schools/:schoolId/published-reports",
    "/schools/:schoolId/report-publication",
    "/schools/:schoolId/private-report-compositions",
    "/schools/:schoolId/guardian-links",
  ])
    assert.ok(nextConfig.includes(path), path);
  for (const token of [
    "private, no-store, max-age=0",
    "noindex, noarchive, nosnippet",
    "no-referrer",
    "nosniff",
    "async headers()",
  ])
    assert.ok(nextConfig.includes(token), token);
  assert.ok(
    nextConfigTests.includes("keeps the private-page header rules scoped"),
  );
  assert.ok(nextConfigTests.includes("private, no-store, max-age=0"));
});
