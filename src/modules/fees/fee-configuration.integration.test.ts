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
const revision = (scope: "SCHOOL" | "SECTION" | "CLASS", scopeId: string) => ({
  categoryId, sessionId, termId, scope, scopeId, amountMinor: "123456",
  currency: "NGN", reason: "Synthetic school fee configuration",
});

describe("Phase 9 school-only immutable fee configuration", () => {
  beforeAll(async () => {
    vi.stubEnv("PHASE9_FEE_WRITE_ENABLED", "true");
    vi.stubEnv("PHASE9_PAYMENT_EVIDENCE_ENABLED", "true");
    vi.stubEnv("PHASE9_PAYMENT_REVIEW_ENABLED", "true");
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
    expect(decision.action).toBe("VERIFIED");
    expect(decision.status).toBe("INDEPENDENT_MANUAL_REVIEW_ONLY");
    expect(decision).not.toHaveProperty("confirmedReferenceDigest");
    expect((await reviewEvidence("owner", {
      evidenceId, action: "REJECTED", reason: "Second terminal decision forbidden",
    })).status).toBe(404);
    await expect(prisma.paymentVerificationDecision.update({
      where: { id: decision.id }, data: { action: "REJECTED" },
    })).rejects.toThrow();
    await expect(prisma.paymentVerificationDecision.delete({
      where: { id: decision.id },
    })).rejects.toThrow();
    const listed = await evidenceList("admin");
    expect((await listed.json()).evidence[0].reviewAction).toBe("VERIFIED");

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
    expect((await reviewEvidence("owner", {
      evidenceId: secondId, action: "REJECTED",
      reason: "Synthetic remaining amount not reconciled",
    })).status).toBe(201);
    await expect(prisma.paymentVerificationDecision.create({ data: {
      id: randomUUID(), schoolId: schoolA, evidenceId,
      action: "VERIFIED", confirmedBankFunds: true,
      confirmedReferenceDigest: "f".repeat(64),
      reason: "Direct SQL verification forgery",
      reviewerMembershipId: members.admin, reviewerUserId: actors.admin,
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
