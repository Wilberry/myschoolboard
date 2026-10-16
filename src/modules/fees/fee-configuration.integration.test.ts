import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));

import { GET as CAT_GET, POST as CAT_POST } from
  "@/app/api/schools/[schoolId]/fee-categories/route";
import { GET as REV_GET, POST as REV_POST } from
  "@/app/api/schools/[schoolId]/fee-structures/route";
import { GET as OBL_GET, POST as OBL_POST } from
  "@/app/api/schools/[schoolId]/fee-obligations/route";
import { GET as EVID_GET, POST as EVID_POST } from
  "@/app/api/schools/[schoolId]/payment-evidence/route";
import { POST as REVIEW_POST } from
  "@/app/api/schools/[schoolId]/payment-verifications/route";
import { GET as ALLOC_GET, POST as ALLOC_POST } from
  "@/app/api/schools/[schoolId]/manual-payment-allocations/route";
import { GET as REVERSE_GET, POST as REVERSE_POST } from
  "@/app/api/schools/[schoolId]/manual-allocation-reversals/route";
import { POST as REVERSAL_DECISION_POST } from
  "@/app/api/schools/[schoolId]/manual-allocation-reversal-decisions/route";
import { GET as ADJ_GET, POST as ADJ_POST } from
  "@/app/api/schools/[schoolId]/fee-adjustment-proposals/route";
import { POST as ADJ_DECIDE } from
  "@/app/api/schools/[schoolId]/fee-adjustment-decisions/route";
import { prisma } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";

const suffix = randomUUID();
const schoolA = `fee-a-${suffix}`;
const schoolB = `fee-b-${suffix}`;
const sectionA = `fee-section-a-${suffix}`;
const sectionB = `fee-section-b-${suffix}`;
const classA = `fee-class-a-${suffix}`;
const classB = `fee-class-b-${suffix}`;
const sessionId = `fee-session-${suffix}`;
const termId = `fee-term-${suffix}`;
const actors: Record<string, string> = {};
const members: Record<string, string> = {};
const cookies: Record<string, string> = {};
const password = "synthetic-fee-configuration-password";
const pupilId = `fee-student-${suffix}`;
const enrollmentId = `fee-enrollment-${suffix}`;
let categoryId: string;
let latestSchoolRevisionId: string;
let obligationId: string;
let evidenceId: string;
let verifiedDecisionId: string;
let rejectedDecisionId: string;
let allocatedManualId: string;
const bankReferenceA = `SYNTH-BANK-A-${suffix.toUpperCase()}`;
const bankReferenceB = `SYNTH-BANK-B-${suffix.toUpperCase()}`;

function request(actor: string, schoolId: string, endpoint: string,
  method: "GET" | "POST", payload?: unknown) {
  context.headers = new Headers(cookies[actor] ? { cookie: cookies[actor] } : {});
  return new Request(`http://localhost/api/schools/${schoolId}/${endpoint}`, {
    method,
    ...(payload === undefined ? {} : { headers: { "content-type": "application/json" },
      body: JSON.stringify(payload) }),
  });
}
async function createCategory(actor: string, payload: unknown, schoolId = schoolA) {
  return CAT_POST(request(actor, schoolId, "fee-categories", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function createRevision(actor: string, payload: unknown, schoolId = schoolA) {
  return REV_POST(request(actor, schoolId, "fee-structures", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function categoryList(actor: string, schoolId = schoolA) {
  return CAT_GET(request(actor, schoolId, "fee-categories", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
async function revisionList(actor: string, schoolId = schoolA) {
  return REV_GET(request(actor, schoolId, "fee-structures", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
async function issueObligation(actor: string, payload: unknown, schoolId = schoolA) {
  return OBL_POST(request(actor, schoolId, "fee-obligations", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function obligationList(actor: string, schoolId = schoolA) {
  return OBL_GET(request(actor, schoolId, "fee-obligations", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
async function submitEvidence(actor: string, payload: unknown, schoolId = schoolA) {
  return EVID_POST(request(actor, schoolId, "payment-evidence", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function evidenceList(actor: string, schoolId = schoolA) {
  return EVID_GET(request(actor, schoolId, "payment-evidence", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
async function reviewEvidence(actor: string, payload: unknown, schoolId = schoolA) {
  return REVIEW_POST(request(actor, schoolId, "payment-verifications", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function allocatePayment(actor: string, payload: unknown, schoolId = schoolA) {
  return ALLOC_POST(request(actor, schoolId, "manual-payment-allocations", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function allocationPreview(actor: string, schoolId = schoolA) {
  return ALLOC_GET(request(actor, schoolId, "manual-payment-allocations", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
async function requestManualReversal(actor: string, payload: unknown, schoolId = schoolA) {
  return REVERSE_POST(request(actor, schoolId, "manual-allocation-reversals", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function reversalQueue(actor: string, schoolId = schoolA) {
  return REVERSE_GET(request(actor, schoolId, "manual-allocation-reversals", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
async function decideManualReversal(actor: string, payload: unknown, schoolId = schoolA) {
  return REVERSAL_DECISION_POST(
    request(actor, schoolId, "manual-allocation-reversal-decisions", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function proposeFee(actor: string, payload: unknown, schoolId = schoolA) {
  return ADJ_POST(request(actor, schoolId, "fee-adjustment-proposals", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
async function feeProposalQueue(actor: string, schoolId = schoolA) {
  return ADJ_GET(request(actor, schoolId, "fee-adjustment-proposals", "GET"),
    { params: Promise.resolve({ schoolId }) });
}
async function decideFee(actor: string, payload: unknown, schoolId = schoolA) {
  return ADJ_DECIDE(request(actor, schoolId, "fee-adjustment-decisions", "POST", payload),
    { params: Promise.resolve({ schoolId }) });
}
const revision = (scope: "SCHOOL" | "SECTION" | "CLASS", scopeId: string) => ({
  categoryId, sessionId, termId, scope, scopeId, amountMinor: "123456",
  currency: "NGN", reason: "Synthetic school fee configuration",
});

describe("Phase 9 school-only immutable fee configuration", () => {
  beforeAll(async () => {
    vi.stubEnv("PHASE9_FEE_WRITE_ENABLED", "true");
    vi.stubEnv("PHASE9_PAYMENT_EVIDENCE_ENABLED", "true");
    vi.stubEnv("PHASE9_PAYMENT_REVIEW_ENABLED", "true");
    vi.stubEnv("PHASE9_MANUAL_ALLOCATION_ENABLED", "true");
    vi.stubEnv("PHASE9_MANUAL_REVERSAL_ENABLED", "true");
    vi.stubEnv("PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED", "true");
    for (const name of ["owner", "admin", "teacher", "foreign"]) {
      const email = `fee-${name}-${suffix}@example.test`;
      const registered = await auth.api.signUpEmail({
        body: { email, name: `Synthetic ${name}`, password },
      });
      actors[name] = registered.user.id;
      const login = await auth.api.signInEmail({
        body: { email, password },
        headers: new Headers({ origin: env.BETTER_AUTH_URL }),
        returnHeaders: true,
      });
      cookies[name] = login.headers.getSetCookie()
        .map(v => v.split(";")[0]).join("; ");
      if (!cookies[name]) throw new Error("Synthetic authenticated session missing");
    }
    await prisma.school.createMany({ data: [
      { id: schoolA, slug: schoolA, name: "Synthetic Fee School A" },
      { id: schoolB, slug: schoolB, name: "Synthetic Fee School B" },
    ] });
    for (const [name, role, schoolId] of [
      ["owner", "SCHOOL_SUPER_ADMIN", schoolA],
      ["admin", "SCHOOL_ADMIN", schoolA],
      ["teacher", "TEACHER", schoolA],
      ["foreign", "SCHOOL_SUPER_ADMIN", schoolB],
    ] as const) {
      const member = await prisma.membership.create({
        data: { schoolId, userId: actors[name], role },
      });
      members[name] = member.id;
    }
    await prisma.schoolSection.createMany({ data: [
      { id: sectionA, schoolId: schoolA, name: "Primary", stage: "PRIMARY" },
      { id: sectionB, schoolId: schoolB, name: "Primary", stage: "PRIMARY" },
    ] });
    await prisma.schoolClass.createMany({ data: [
      { id: classA, schoolId: schoolA, name: "Class One", sectionId: sectionA },
      { id: classB, schoolId: schoolB, name: "Class One", sectionId: sectionB },
    ] });
    const now = Date.now();
    await prisma.academicSession.create({
      data: { id: sessionId, schoolId: schoolA, name: "Synthetic Session",
        startsOn: new Date(now - 86400000), endsOn: new Date(now + 86400000 * 60),
        status: "PLANNED" },
    });
    await prisma.academicTerm.create({
      data: { id: termId, schoolId: schoolA, sessionId,
        name: "Synthetic Term", position: 1,
        startsOn: new Date(now - 86400000), endsOn: new Date(now + 86400000 * 45),
        status: "PLANNED" },
    });
    await prisma.studentRecord.create({
      data: { id: pupilId, schoolId: schoolA,
        admissionNumber: `FEE-SYNTHETIC-${suffix}`,
        givenName: "Synthetic", familyName: "Pupil", status: "ENROLLED" },
    });
    await prisma.studentEnrollment.create({
      data: { id: enrollmentId, schoolId: schoolA,
        studentId: pupilId, classId: classA, sessionId, status: "ACTIVE" },
    });
  });
  afterAll(async () => {
    await prisma.school.deleteMany({ where: { id: { in: [schoolA, schoolB] } } });
    await prisma.session.deleteMany({ where: { userId: { in: Object.values(actors) } } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(actors) } } });
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it("denies anonymous, ordinary school admin, teacher and cross-school owner", async () => {
    for (const [actor, expected] of [["", 401], ["admin", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await categoryList(actor)).status).toBe(expected);
      expect((await revisionList(actor)).status).toBe(expected);
      expect((await obligationList(actor)).status).toBe(expected);
      expect((await createCategory(actor, {
        code: "TUITION", name: "Tuition Fees",
      })).status).toBe(expected);
    }
  });
  it("creates immutable school-owned category, rejecting spoofed actor and duplicate code", async () => {
    for (const bad of [
      { code: "tuition", name: "Tuition" },
      { code: "TUITION", name: "Tuition", actorMembershipId: members.owner },
      { code: "T", name: "Tuition" },
    ]) expect((await createCategory("owner", bad)).status).toBe(400);

    const made = await createCategory("owner", { code: "TUITION", name: "Tuition Fees" });
    expect(made.status).toBe(201);
    expect(made.headers.get("cache-control")).toBe("private, no-store");
    const doc = await made.json();
    categoryId = doc.categories.id;
    expect(doc.categories.status).toBe("CONFIGURATION_ONLY");
    expect(doc.categories).not.toHaveProperty("actorUserId");
    expect((await createCategory("owner", { code: "TUITION", name: "Other" })).status)
      .toBe(409);
    expect((await categoryList("owner")).status).toBe(200);
    expect((await categoryList("foreign")).status).toBe(404);
    await expect(prisma.feeCategory.update({ where: { id: categoryId },
      data: { name: "Changed" } })).rejects.toThrow();
    await expect(prisma.feeCategory.delete({ where: { id: categoryId } }))
      .rejects.toThrow();
    await expect(prisma.feeCategory.create({ data: {
      id: randomUUID(), schoolId: schoolA, code: "FRAUD",
      name: "Invalid Actor", actorMembershipId: members.admin,
      actorUserId: actors.admin,
    } })).rejects.toThrow();
  });
  it("rejects numeric/negative/unbounded money, foreign scope and forged metadata", async () => {
    for (const bad of [
      { ...revision("SCHOOL", schoolA), amountMinor: 42 },
      { ...revision("SCHOOL", schoolA), amountMinor: "0" },
      { ...revision("SCHOOL", schoolA), amountMinor: "1000000000001" },
      { ...revision("SCHOOL", schoolA), currency: "ngn" },
      { ...revision("SCHOOL", schoolA), actorUserId: actors.owner },
      revision("SCHOOL", schoolB),
    ]) expect((await createRevision("owner", bad)).status).toBe(400);
    expect((await createRevision("owner", revision("CLASS", classB))).status)
      .toBe(404);
    expect((await createRevision("owner", revision("SECTION", sectionB))).status)
      .toBe(404);
  });
  it("versions school, section and class fees separately without mutating history", async () => {
    for (const [scope, scopeId] of [
      ["SCHOOL", schoolA], ["SECTION", sectionA], ["CLASS", classA],
    ] as const) {
      const first = await createRevision("owner", revision(scope, scopeId));
      expect(first.status).toBe(201);
      const original = (await first.json()).revision;
      expect(original.amountMinor).toBe("123456");
      expect(original.version).toBe(1);
      expect(original.status).toBe("CONFIGURATION_ONLY");
      const second = await createRevision("owner", {
        ...revision(scope, scopeId), amountMinor: "456789",
        reason: "Synthetic revised school fee amount",
      });
      expect(second.status).toBe(201);
      const revised = (await second.json()).revision;
      expect(revised.version).toBe(2);
      if (scope === "SCHOOL") latestSchoolRevisionId = revised.id;
      await expect(prisma.feeStructureRevision.update({ where: { id: original.id },
        data: { amountMinor: BigInt(2) } })).rejects.toThrow();
      await expect(prisma.feeStructureRevision.delete({ where: { id: original.id } }))
        .rejects.toThrow();
    }
    const own = await revisionList("owner");
    expect(own.status).toBe(200);
    const body = await own.json();
    expect(body.revisions).toHaveLength(6);
    expect(body.revisions.every((v: { amountMinor: unknown }) =>
      typeof v.amountMinor === "string")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("actorMembershipId");
  });
  it("issues explicit same-school debt once; safe replay never fabricates payment", async () => {
    const payload = {
      enrollmentId, revisionId: latestSchoolRevisionId,
      requestKey: randomUUID(), reason: "Synthetic explicitly issued student debt",
    };
    for (const [actor, status] of [["", 401], ["admin", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await issueObligation(actor, payload)).status).toBe(status);
    }
    expect((await issueObligation("owner", {
      ...payload, amountMinor: "1",
    })).status).toBe(400);
    expect((await issueObligation("owner", {
      ...payload, issuerMembershipId: members.owner,
    })).status).toBe(400);
    expect((await issueObligation("owner", {
      ...payload, revisionId: "foreign-revision",
    })).status).toBe(404);
    const issued = await issueObligation("owner", payload);
    expect(issued.status).toBe(201);
    const item = (await issued.json()).obligation;
    expect(item.amountMinor).toBe("456789");
    expect(item.studentId).toBe(pupilId);
    expect(item.enrollmentId).toBe(enrollmentId);
    expect(item.status).toBe("ISSUED_UNPAID");
    obligationId = item.id;
    expect(item.replay).toBe(false);
    expect(item).not.toHaveProperty("issuerUserId");
    const again = await issueObligation("owner", payload);
    expect(again.status).toBe(200);
    expect((await again.json()).obligation.id).toBe(item.id);
    expect((await issueObligation("owner", {
      ...payload, reason: "Changed request under reused key",
    })).status).toBe(409);
    expect((await issueObligation("owner", {
      ...payload, requestKey: randomUUID(),
    })).status).toBe(409);
    const own = await obligationList("owner");
    expect(own.status).toBe(200);
    expect((await own.json()).obligations).toHaveLength(1);
    await expect(prisma.feeObligation.update({
      where: { id: item.id }, data: { amountMinor: BigInt(1) },
    })).rejects.toThrow();
    await expect(prisma.feeObligation.delete({
      where: { id: item.id },
    })).rejects.toThrow();
    await expect(prisma.feeObligation.create({ data: {
      id: randomUUID(), schoolId: schoolA, studentId: pupilId,
      enrollmentId, classId: classA, sessionId, termId, categoryId,
      revisionId: latestSchoolRevisionId, amountMinor: BigInt(1),
      currency: "NGN", requestKey: randomUUID(),
      reason: "Forged invoice by an unauthorized school teacher",
      issuerMembershipId: members.teacher, issuerUserId: actors.teacher,
    } })).rejects.toThrow();
  });

  it("keeps submitted bank reference metadata UNVERIFIED and replay-safe", async () => {
    const claim = {
      obligationId, requestKey: randomUUID(), transferReference: bankReferenceA,
      claimedAmountMinor: "300000", reason: "Synthetic transfer not yet verified",
    };
    for (const [actor, status] of [["", 401], ["owner", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await submitEvidence(actor, claim)).status).toBe(status);
    }
    expect((await evidenceList("teacher")).status).toBe(404);
    expect((await evidenceList("foreign")).status).toBe(404);
    expect((await submitEvidence("admin", {
      ...claim, paymentStatus: "VERIFIED",
    })).status).toBe(400);
    expect((await submitEvidence("admin", {
      ...claim, claimedAmountMinor: "456790",
    })).status).toBe(400);
    expect((await submitEvidence("admin", {
      ...claim, transferReference: "bob@example.test",
    })).status).toBe(400);
    const created = await submitEvidence("admin", claim);
    expect(created.status).toBe(201);
    expect(created.headers.get("cache-control")).toBe("private, no-store");
    const evidence = (await created.json()).evidence;
    evidenceId = evidence.id;
    expect(evidence.status).toBe("SUBMITTED_EVIDENCE_ONLY");
    expect(evidence.claimedAmountMinor).toBe("300000");
    expect(JSON.stringify(evidence)).not.toContain(bankReferenceA);
    expect(JSON.stringify(evidence)).not.toContain("referenceDigest");
    expect(JSON.stringify(evidence)).not.toContain("VERIFIED");
    expect((await submitEvidence("admin", claim)).status).toBe(200);
    expect((await submitEvidence("admin", {
      ...claim, claimedAmountMinor: "299999",
    })).status).toBe(409);
    expect((await submitEvidence("admin", {
      ...claim, requestKey: randomUUID(),
    })).status).toBe(409);
    expect((await evidenceList("admin")).status).toBe(200);
    expect((await evidenceList("owner")).status).toBe(200);
    const ownerList = await evidenceList("owner");
    const row = (await ownerList.json()).evidence[0];
    expect(row.reviewAction).toBeNull();
    expect(row.verificationState).toBe("PENDING_VERIFICATION");
    expect(JSON.stringify(row)).not.toContain(bankReferenceA);
    expect(JSON.stringify(row)).not.toContain("referenceDigest");
    await expect(prisma.paymentEvidence.update({
      where: { id: evidenceId }, data: { claimedAmountMinor: BigInt(1) },
    })).rejects.toThrow();
    await expect(prisma.paymentEvidence.delete({
      where: { id: evidenceId },
    })).rejects.toThrow();
    await expect(prisma.paymentEvidence.create({ data: {
      id: randomUUID(), schoolId: schoolA, obligationId,
      requestKey: randomUUID(), referenceDigest: "a".repeat(64),
      claimedAmountMinor: BigInt(100), currency: "NGN",
      reason: "Forged teacher claim cannot submit",
      submitterMembershipId: members.teacher, submitterUserId: actors.teacher,
    } })).rejects.toThrow();
  });

  it("requires independent explicit school-owner bank reconciliation decision", async () => {
    for (const [actor, status] of [["", 401], ["admin", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await reviewEvidence(actor, {
        evidenceId, action: "REJECTED", reason: "Synthetic bank check rejected",
      })).status).toBe(status);
    }
    expect((await reviewEvidence("owner", {
      evidenceId, action: "VERIFIED", transferReference: bankReferenceA,
      reason: "Synthetic manual bank reconciliation",
    })).status).toBe(400);
    expect((await reviewEvidence("owner", {
      evidenceId, action: "VERIFIED", transferReference: bankReferenceB,
      fundsConfirmed: true, reason: "Synthetic wrong bank transaction",
    })).status).toBe(404);
    const ok = await reviewEvidence("owner", {
      evidenceId, action: "VERIFIED", transferReference: bankReferenceA,
      fundsConfirmed: true, reason: "Synthetic independently matched bank statement",
    });
    expect(ok.status).toBe(201);
    const decision = (await ok.json()).decision;
    verifiedDecisionId = decision.id;
    expect(decision.action).toBe("VERIFIED");
    expect(decision.status).toBe("INDEPENDENT_MANUAL_REVIEW_ONLY");
    expect(decision).not.toHaveProperty("confirmedReferenceDigest");
    expect(decision.replay).toBe(false);
    const retry = await reviewEvidence("owner", {
      evidenceId, action: "VERIFIED", transferReference: bankReferenceA,
      fundsConfirmed: true, reason: "Synthetic independently matched bank statement",
    });
    expect(retry.status).toBe(200);
    expect((await retry.json()).decision.id).toBe(decision.id);
    expect((await reviewEvidence("owner", {
      evidenceId, action: "REJECTED", reason: "Second terminal decision forbidden",
    })).status).toBe(409);
    const persisted = await prisma.paymentVerificationDecision.findUniqueOrThrow({
      where: { id: decision.id },
    });
    expect(persisted.confirmedBankFunds).toBe(true);
    await expect(prisma.paymentVerificationDecision.update({
      where: { id: decision.id }, data: { action: "REJECTED" },
    })).rejects.toThrow();
    await expect(prisma.paymentVerificationDecision.delete({
      where: { id: decision.id },
    })).rejects.toThrow();
    const listed = await evidenceList("admin");
    const reviewed = (await listed.json()).evidence[0];
    expect(reviewed.reviewAction).toBe("VERIFIED");
    expect(reviewed.verificationState).toBe("VERIFIED");

    const second = await submitEvidence("admin", {
      obligationId, requestKey: randomUUID(), transferReference: bankReferenceB,
      claimedAmountMinor: "300000", reason: "Another unverified synthetic claim",
    });
    expect(second.status).toBe(201);
    const secondId = (await second.json()).evidence.id;
    expect((await reviewEvidence("owner", {
      evidenceId: secondId, action: "VERIFIED", transferReference: bankReferenceB,
      fundsConfirmed: true, reason: "Synthetic claim exceeding verified amount",
    })).status).toBe(404);
    const rejected = await reviewEvidence("owner", {
      evidenceId: secondId, action: "REJECTED",
      reason: "Synthetic remaining amount not reconciled",
    });
    expect(rejected.status).toBe(201);
    rejectedDecisionId = (await rejected.json()).decision.id;
    await expect(prisma.paymentVerificationDecision.create({ data: {
      id: randomUUID(), schoolId: schoolA, evidenceId,
      action: "VERIFIED", confirmedBankFunds: true,
      confirmedReferenceDigest: "f".repeat(64),
      reason: "Direct SQL verification forgery",
      reviewerMembershipId: members.admin, reviewerUserId: actors.admin,
    } })).rejects.toThrow();
  });

  it("allocates only independently VERIFIED claims once; shows a manual preview, never PAID", async () => {
    for (const [actor, status] of [["", 401], ["admin", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await allocationPreview(actor)).status).toBe(status);
      expect((await allocatePayment(actor, {
        verificationId: verifiedDecisionId, requestKey: randomUUID(),
        reason: "Synthetic allocation attempt from forbidden role",
      })).status).toBe(status);
    }

    const before = await allocationPreview("owner");
    expect(before.status).toBe(200);
    expect(before.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await before.json()).rows).toMatchObject([{
      obligationId, originalChargeMinor: "456789",
      independentlyReviewedMinor: "300000", manuallyAllocatedMinor: "0",
      reviewedNotAllocatedMinor: "300000", previewRemainingMinor: "456789",
      previewState: "NO_MANUAL_ALLOCATION",
    }]);
    const allocation = {
      verificationId: verifiedDecisionId, requestKey: randomUUID(),
      reason: "Synthetic one-time manual allocation against school debt",
    };
    expect((await allocatePayment("owner", {
      ...allocation, amountMinor: "999999",
    })).status).toBe(400);
    expect((await allocatePayment("owner", {
      ...allocation, paid: true,
    })).status).toBe(400);
    expect((await allocatePayment("owner", {
      ...allocation, verificationId: rejectedDecisionId,
    })).status).toBe(404);
    const concurrentA = allocation;
    const concurrentB = { ...allocation, requestKey: randomUUID() };
    const outcomes = await Promise.all([
      allocatePayment("owner", concurrentA), allocatePayment("owner", concurrentB),
    ]);
    const statuses = outcomes.map(v => v.status).sort();
    expect(statuses).toHaveLength(2);
    expect(statuses).toContain(201);
    expect(statuses.every(v => v === 201 || v === 404 || v === 409)).toBe(true);
    const winnerIndex = outcomes.findIndex(v => v.status === 201);
    const winner = (await outcomes[winnerIndex].json()).allocation;
    allocatedManualId = winner.id;
    const winnerRequest = winnerIndex === 0 ? concurrentA : concurrentB;
    expect(winner.amountMinor).toBe("300000");
    expect(winner.status).toBe("MANUAL_ALLOCATION_PREVIEW_ONLY");
    expect(winner).not.toHaveProperty("allocatorMembershipId");
    expect(winner).not.toHaveProperty("paid");
    expect((await allocatePayment("owner", winnerRequest)).status).toBe(200);
    expect((await allocatePayment("owner", {
      ...winnerRequest, reason: "Changed allocation under existing idempotency key",
    })).status).toBe(409);
    expect((await allocatePayment("owner", {
      verificationId: verifiedDecisionId, requestKey: randomUUID(),
      reason: "Second allocation for the exact verified transfer",
    })).status).toBe(404);
    const actual = await prisma.manualPaymentAllocation.findMany({
      where: { schoolId: schoolA, obligationId },
    });
    expect(actual).toHaveLength(1);
    expect(actual[0].amountMinor).toBe(BigInt(300000));
    expect(actual[0].currency).toBe("NGN");
    await expect(prisma.manualPaymentAllocation.update({
      where: { id: actual[0].id }, data: { amountMinor: BigInt(1) },
    })).rejects.toThrow();
    await expect(prisma.manualPaymentAllocation.delete({
      where: { id: actual[0].id },
    })).rejects.toThrow();

    const after = await allocationPreview("owner");
    const result = (await after.json()).rows[0];
    expect(result).toMatchObject({
      obligationId, originalChargeMinor: "456789",
      independentlyReviewedMinor: "300000",
      manuallyAllocatedMinor: "300000",
      reviewedNotAllocatedMinor: "0", previewRemainingMinor: "156789",
      previewState: "PARTIAL_MANUAL_ALLOCATION",
    });
    expect(JSON.stringify(result)).not.toContain("receipt");
    expect(JSON.stringify(result)).not.toContain("PAID");
    await expect(prisma.manualPaymentAllocation.create({ data: {
      id: randomUUID(), schoolId: schoolA, obligationId, evidenceId,
      verificationId: verifiedDecisionId, requestKey: randomUUID(),
      amountMinor: BigInt(1), currency: "NGN",
      reason: "Synthetic direct-SQL forbidden teacher allocation",
      allocatorMembershipId: members.teacher, allocatorUserId: actors.teacher,
    } })).rejects.toThrow();
    await expect(prisma.manualPaymentAllocation.create({ data: {
      id: randomUUID(), schoolId: schoolA, obligationId,
      evidenceId: actual[0].evidenceId, verificationId: rejectedDecisionId,
      requestKey: randomUUID(), amountMinor: BigInt(1), currency: "NGN",
      reason: "Synthetic forged rejected-decision allocation",
      allocatorMembershipId: members.owner, allocatorUserId: actors.owner,
    } })).rejects.toThrow();
  });

  it("independently approves a manual allocation reversal without money movement", async () => {
    const request = {
      allocationId: allocatedManualId, requestKey: randomUUID(),
      reason: "Synthetic manual allocation correction requires independent review",
    };
    for (const [actor, status] of [["", 401], ["owner", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await requestManualReversal(actor, request)).status).toBe(status);
    }
    for (const [actor, status] of [["", 401], ["teacher", 404],
      ["foreign", 404]] as const) {
      expect((await reversalQueue(actor)).status).toBe(status);
    }
    expect((await requestManualReversal("admin", { ...request,
      amountMinor: "1",
    })).status).toBe(400);
    expect((await requestManualReversal("admin", { ...request,
      paid: true,
    })).status).toBe(400);
    expect((await requestManualReversal("admin", { ...request,
      allocationId: "other-school-allocation",
    })).status).toBe(404);
    const proposed = await requestManualReversal("admin", request);
    expect(proposed.status).toBe(201);
    expect(proposed.headers.get("cache-control")).toBe("private, no-store");
    const submitted = (await proposed.json()).reversal;
    expect(submitted.amountMinor).toBe("300000");
    expect(submitted.status).toBe("REVERSAL_REQUEST_ONLY");
    expect(submitted).not.toHaveProperty("requesterMembershipId");
    expect((await requestManualReversal("admin", request)).status).toBe(200);
    expect((await requestManualReversal("admin", { ...request,
      reason: "Different immutable request reason",
    })).status).toBe(409);
    expect((await requestManualReversal("admin", { ...request,
      requestKey: randomUUID(),
    })).status).toBe(404);
    expect((await reversalQueue("admin")).status).toBe(200);
    const queue = await reversalQueue("owner");
    expect((await queue.json()).requests[0].reversalState).toBe("PENDING_REVERSAL_REVIEW");

    const reviewed = {
      requestId: submitted.id, action: "APPROVED",
      reason: "Synthetic independent correction of manual ledger entry",
    };
    for (const [actor, status] of [["", 401], ["admin", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await decideManualReversal(actor, reviewed)).status).toBe(status);
    }
    expect((await decideManualReversal("owner", {
      ...reviewed, refundMinor: "300000",
    })).status).toBe(400);
    const approved = await decideManualReversal("owner", reviewed);
    expect(approved.status).toBe(201);
    const decision = (await approved.json()).decision;
    expect(decision.action).toBe("APPROVED");
    expect(decision.status).toBe("MANUAL_ALLOCATION_REVERSAL_DECISION_ONLY");
    const replay = await decideManualReversal("owner", reviewed);
    expect(replay.status).toBe(200);
    expect((await replay.json()).decision.id).toBe(decision.id);
    expect((await decideManualReversal("owner", {
      ...reviewed, action: "REJECTED",
    })).status).toBe(409);
    await expect(prisma.manualAllocationReversalRequest.update({
      where: { id: submitted.id }, data: { amountMinor: BigInt(1) },
    })).rejects.toThrow();
    await expect(prisma.manualAllocationReversalDecision.delete({
      where: { id: decision.id },
    })).rejects.toThrow();
    const original = await prisma.manualPaymentAllocation.findUniqueOrThrow({
      where: { id: allocatedManualId },
    });
    expect(original.amountMinor).toBe(BigInt(300000));
    expect(original.verificationId).toBe(verifiedDecisionId);
    expect((await reversalQueue("owner")).status).toBe(200);
    const after = await allocationPreview("owner");
    expect((await after.json()).rows[0]).toMatchObject({
      obligationId, originalChargeMinor: "456789",
      independentlyReviewedMinor: "300000",
      grossManuallyAllocatedMinor: "300000",
      approvedReversedMinor: "300000",
      manuallyAllocatedMinor: "0",
      reviewedNotAllocatedMinor: "0",
      previewRemainingMinor: "456789",
      previewState: "REVERSED_MANUAL_ALLOCATION",
    });
    expect((await allocatePayment("owner", {
      verificationId: verifiedDecisionId, requestKey: randomUUID(),
      reason: "Reversed evidence cannot be allocated again",
    })).status).toBe(404);
    await expect(prisma.manualAllocationReversalRequest.create({ data: {
      id: randomUUID(), schoolId: schoolA, allocationId: allocatedManualId,
      requestKey: randomUUID(), amountMinor: BigInt(1), currency: "NGN",
      reason: "Forged direct SQL teacher reversal request",
      requesterMembershipId: members.teacher, requesterUserId: actors.teacher,
    } })).rejects.toThrow();
    await expect(prisma.manualAllocationReversalDecision.create({ data: {
      id: randomUUID(), schoolId: schoolA, requestId: submitted.id,
      action: "REJECTED",
      reason: "Forged direct SQL teacher reversal approval",
      reviewerMembershipId: members.teacher, reviewerUserId: actors.teacher,
    } })).rejects.toThrow();
  });

  it("keeps a rejected manual reversal from subtracting the allocation preview", async () => {
    const ref = `SYNTH-BANK-C-${suffix.toUpperCase()}`;
    const claim = await submitEvidence("admin", {
      obligationId, requestKey: randomUUID(), transferReference: ref,
      claimedAmountMinor: "100000", reason: "Additional synthetic bank evidence",
    });
    expect(claim.status).toBe(201);
    const eId = (await claim.json()).evidence.id;
    const verified = await reviewEvidence("owner", {
      evidenceId: eId, action: "VERIFIED", transferReference: ref,
      fundsConfirmed: true, reason: "Synthetic independent bank match for secondary claim",
    });
    expect(verified.status).toBe(201);
    const vId = (await verified.json()).decision.id;
    const allocated = await allocatePayment("owner", {
      verificationId: vId, requestKey: randomUUID(),
      reason: "Additional synthetic manual claim allocation",
    });
    expect(allocated.status).toBe(201);
    const aId = (await allocated.json()).allocation.id;
    const proposed = await requestManualReversal("admin", {
      allocationId: aId, requestKey: randomUUID(),
      reason: "Synthetic reversal requested but not approved",
    });
    expect(proposed.status).toBe(201);
    const rId = (await proposed.json()).reversal.id;
    const rejected = await decideManualReversal("owner", {
      requestId: rId, action: "REJECTED",
      reason: "Synthetic independent reviewer retained allocation",
    });
    expect(rejected.status).toBe(201);
    const summary = (await (await allocationPreview("owner")).json()).rows[0];
    expect(summary).toMatchObject({
      originalChargeMinor: "456789",
      independentlyReviewedMinor: "400000",
      grossManuallyAllocatedMinor: "400000",
      approvedReversedMinor: "300000",
      manuallyAllocatedMinor: "100000",
      reviewedNotAllocatedMinor: "0",
      previewRemainingMinor: "356789",
      previewState: "PARTIAL_MANUAL_ALLOCATION",
    });
    const requests = (await (await reversalQueue("admin")).json()).requests;
    expect(requests.some((r: { reversalState: string }) =>
      r.reversalState === "REJECTED_MANUAL_REVERSAL")).toBe(true);
  });

  it("keeps school waiver decisions advisory and original debt invariant", async () => {
    const proposal = {
      obligationId, requestKey: randomUUID(), kind: "WAIVER",
      proposedAmountMinor: "20000", reason: "Synthetic fee waiver review proposal",
    };
    for (const [actor, status] of [["", 401], ["owner", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await proposeFee(actor, proposal)).status).toBe(status);
    }
    expect((await feeProposalQueue("teacher")).status).toBe(404);
    expect((await feeProposalQueue("foreign")).status).toBe(404);
    expect((await proposeFee("admin", { ...proposal, paid: true })).status).toBe(400);
    expect((await proposeFee("admin", { ...proposal, proposedAmountMinor: "999999" })).status).toBe(400);
    const created = await proposeFee("admin", proposal);
    expect(created.status).toBe(201);
    const item = (await created.json()).proposal;
    expect(item.proposedAmountMinor).toBe("20000");
    expect(item.status).toBe("ADVISORY_FEE_ADJUSTMENT_PROPOSAL_ONLY");
    expect((await proposeFee("admin", proposal)).status).toBe(200);
    expect((await proposeFee("admin", { ...proposal,
      reason: "Altered submitted proposal" })).status).toBe(409);
    const queue = await feeProposalQueue("owner");
    expect(queue.status).toBe(200);
    expect(queue.headers.get("cache-control")).toBe("private, no-store");
    expect((await queue.json()).proposals[0].state).toBe("PENDING");
    const reviewed = { proposalId: item.id, action: "APPROVED",
      reason: "Synthetic independent fee policy approval only" };
    for (const [actor, status] of [["", 401], ["admin", 404],
      ["teacher", 404], ["foreign", 404]] as const) {
      expect((await decideFee(actor, reviewed)).status).toBe(status);
    }
    expect((await decideFee("owner", { ...reviewed, settlement: true })).status).toBe(400);
    const ok = await decideFee("owner", reviewed);
    expect(ok.status).toBe(201);
    const decision = (await ok.json()).decision;
    expect(decision.status).toBe("APPROVAL_NOT_EFFECTIVE_FINANCIAL_ADJUSTMENT");
    expect((await decideFee("owner", reviewed)).status).toBe(200);
    expect((await decideFee("owner", { ...reviewed, action: "REJECTED" })).status).toBe(409);
    const sourceDebt = await prisma.feeObligation.findUniqueOrThrow({ where: { id: obligationId } });
    expect(sourceDebt.amountMinor).toBe(BigInt(456789));
    const preview = (await (await allocationPreview("owner")).json()).rows[0];
    expect(preview.originalChargeMinor).toBe("456789");
    expect(preview.previewRemainingMinor).toBe("356789");
    expect((await (await feeProposalQueue("admin")).json()).proposals[0].state)
      .toBe("ADVISORY_APPROVED_NOT_APPLIED");
    await expect(prisma.feeAdjustmentProposal.update({ where: { id: item.id },
      data: { proposedAmountMinor: BigInt(1) } })).rejects.toThrow();
    await expect(prisma.feeAdjustmentDecision.delete({ where: { id: decision.id } }))
      .rejects.toThrow();
    await expect(prisma.feeAdjustmentDecision.create({ data: {
      id: randomUUID(), schoolId: schoolA, proposalId: item.id, action: "REJECTED",
      reason: "Forbidden teacher outcome forgery",
      reviewerMembershipId: members.teacher, reviewerUserId: actors.teacher,
    } })).rejects.toThrow();
  });

  it("keeps finance writes default-off unless test environment explicitly enables them", async () => {
    vi.stubEnv("PHASE9_FEE_WRITE_ENABLED", "false");
    try {
      expect((await createCategory("owner", {
        code: "OFFLINE", name: "Offline Category",
      })).status).toBe(404);
      expect((await issueObligation("owner", {
        enrollmentId, revisionId: latestSchoolRevisionId,
        requestKey: randomUUID(), reason: "Disabled issuance attempt",
      })).status).toBe(404);
      expect((await submitEvidence("admin", {
        obligationId, requestKey: randomUUID(), transferReference: bankReferenceA,
        claimedAmountMinor: "100", reason: "Disabled reference claim",
      })).status).toBe(404);
      expect((await reviewEvidence("owner", {
        evidenceId, action: "REJECTED", reason: "Disabled verification",
      })).status).toBe(404);
      expect((await allocatePayment("owner", {
        verificationId: verifiedDecisionId, requestKey: randomUUID(),
        reason: "Disabled manual allocation",
      })).status).toBe(404);
      expect((await requestManualReversal("admin", {
        allocationId: allocatedManualId, requestKey: randomUUID(),
        reason: "Disabled manual reversal request",
      })).status).toBe(404);
      expect((await proposeFee("admin", {
        obligationId, requestKey: randomUUID(), kind: "WAIVER",
        proposedAmountMinor: "100", reason: "Disabled fee adjustment",
      })).status).toBe(404);
    } finally {
      vi.stubEnv("PHASE9_FEE_WRITE_ENABLED", "true");
    }
  });

  it("rejects closed academic periods and forged direct SQL actor", async () => {
    await expect(prisma.feeStructureRevision.create({ data: {
      id: randomUUID(), schoolId: schoolA, categoryId, sessionId, termId,
      scope: "SCHOOL", scopeId: schoolA, currency: "NGN",
      amountMinor: BigInt(10), reason: "Forged non-owner configuration",
      actorMembershipId: members.teacher, actorUserId: actors.teacher,
    } })).rejects.toThrow();
    await prisma.academicTerm.update({ where: { id: termId },
      data: { status: "CLOSED" } });
    expect((await createRevision("owner", revision("SCHOOL", schoolA))).status)
      .toBe(404);
    expect((await issueObligation("owner", {
      enrollmentId, revisionId: latestSchoolRevisionId,
      requestKey: randomUUID(), reason: "Closed term cannot accept debt",
    })).status).toBe(404);
  });
});
