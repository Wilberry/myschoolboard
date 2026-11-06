import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
const context = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("next/headers", () => ({ headers: async () => context.headers }));
import { verifyPhase9DatabaseIdentity } from "@/scripts/verify-phase9-disposable.mjs";
import { prisma } from "@/src/lib/db";
import { auth } from "@/src/lib/auth";
import { env } from "@/src/lib/env";
import { POST as CATEGORY } from "@/app/api/schools/[schoolId]/fee-categories/route";
import { POST as STRUCTURE } from "@/app/api/schools/[schoolId]/fee-structures/route";
import { POST as OBLIGATION } from "@/app/api/schools/[schoolId]/fee-obligations/route";
import { POST as EVIDENCE } from "@/app/api/schools/[schoolId]/payment-evidence/route";
import { POST as VERIFY } from "@/app/api/schools/[schoolId]/payment-verifications/route";
import { POST as ALLOCATE } from "@/app/api/schools/[schoolId]/manual-payment-allocations/route";
import { POST as PROPOSE } from "@/app/api/schools/[schoolId]/fee-adjustment-proposals/route";
import { POST as DECIDE } from "@/app/api/schools/[schoolId]/fee-adjustment-decisions/route";
import { POST as WAIVE } from "@/app/api/schools/[schoolId]/fee-waiver-applications/route";
import { POST as REVERSE } from "@/app/api/schools/[schoolId]/manual-allocation-reversals/route";
import { POST as REVERSE_DECIDE } from "@/app/api/schools/[schoolId]/manual-allocation-reversal-decisions/route";
import { POST as RELEASE } from "@/app/api/schools/[schoolId]/fee-account-releases/route";
import { GET as ACCOUNTS } from "@/app/api/schools/[schoolId]/fee-accounts/route";
import {
  GET as RECEIPTS,
  POST as RECEIPT,
} from "@/app/api/schools/[schoolId]/fee-receipts/route";
import { GET as REPORTS } from "@/app/api/schools/[schoolId]/finance-reports/route";
import { GET as WORKSPACE } from "@/app/api/schools/[schoolId]/finance-workspace/route";
import {
  attestStudentAccount,
  revokeStudentAccountLink,
} from "@/src/modules/students/account-link-service";
import {
  attestGuardianStudentLink,
  revokeGuardianStudentLink,
} from "@/src/modules/students/guardian-link-service";
import sharp from "sharp";
import { POST as UPLOAD } from "@/app/api/schools/[schoolId]/payment-evidence-attachments/route";
import { GET as DOWNLOAD } from "@/app/api/schools/[schoolId]/payment-evidence-attachments/[attachmentId]/route";
const suffix = randomUUID(),
  schoolA = `p9-account-a-${suffix}`,
  schoolB = `p9-account-b-${suffix}`,
  sectionId = `p9-section-${suffix}`,
  classId = `p9-class-${suffix}`,
  sessionId = `p9-session-${suffix}`,
  termId = `p9-term-${suffix}`;
const actors: Record<string, string> = {},
  members: Record<string, string> = {},
  cookies: Record<string, string> = {};
const password = "Synthetic-financial-fixture-42";
const flags = [
  "PHASE9_FEE_WRITE_ENABLED",
  "PHASE9_PAYMENT_EVIDENCE_ENABLED",
  "PHASE9_PAYMENT_REVIEW_ENABLED",
  "PHASE9_MANUAL_ALLOCATION_ENABLED",
  "PHASE9_MANUAL_REVERSAL_ENABLED",
  "PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED",
  "PHASE9_EFFECTIVE_WAIVER_ENABLED",
  "PHASE9_FINANCIAL_READ_ENABLED",
  "PHASE9_ACCOUNT_RELEASE_ENABLED",
  "PHASE9_RECEIPT_ENABLED",
  "PHASE9_EVIDENCE_UPLOAD_ENABLED",
];
let categoryId: string,
  revisionId: string,
  pupilId: string,
  enrollmentId: string,
  obligationId: string,
  raceObligationId: string,
  claimId: string,
  verificationId: string,
  allocationId: string,
  receiptId: string,
  parentLink: string,
  studentLink: string;
const reference = `P9-${suffix.replaceAll("-", "").toUpperCase()}`;
type Handler = (
  request: Request,
  context: { params: Promise<{ schoolId: string }> },
) => Promise<Response>;
function call(
  handler: Handler,
  actor: string,
  body?: unknown,
  schoolId = schoolA,
  query = "",
) {
  context.headers = new Headers(
    cookies[actor] ? { cookie: cookies[actor] } : {},
  );
  return handler(
    new Request(
      `http://localhost/api/schools/${schoolId}/financial-test${query}`,
      {
        method: body === undefined ? "GET" : "POST",
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      },
    ),
    { params: Promise.resolve({ schoolId }) },
  );
}
async function upload(
  actor: string,
  evidenceId: string,
  bytes: Uint8Array,
  key = randomUUID(),
  name = "../../.env",
  type = "image/png",
  extra = false,
  origin: string | null = env.BETTER_AUTH_URL,
) {
  context.headers = new Headers(
    cookies[actor] ? { cookie: cookies[actor] } : {},
  );
  const body = new FormData();
  body.set("evidenceId", evidenceId);
  body.set("requestKey", key);
  body.set("file", new File([new Uint8Array(bytes)], name, { type }));
  if (extra) body.set("actorUserId", actors.owner);
  return UPLOAD(
    new Request("http://localhost/api/upload", {
      method: "POST",
      body,
      headers: origin ? { origin } : {},
    }),
    { params: Promise.resolve({ schoolId: schoolA }) },
  );
}
async function download(
  actor: string,
  attachmentId: string,
  schoolId = schoolA,
) {
  context.headers = new Headers(
    cookies[actor] ? { cookie: cookies[actor] } : {},
  );
  return DOWNLOAD(new Request("http://localhost/api/download"), {
    params: Promise.resolve({ schoolId, attachmentId }),
  });
}
async function accepted(
  handler: Handler,
  actor: string,
  body: unknown,
  key: string,
) {
  const response = await call(handler, actor, body);
  expect([200, 201]).toContain(response.status);
  return (await response.json())[key];
}
async function register(
  name: string,
  role:
    "SCHOOL_SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "STUDENT" | "PARENT",
  schoolId = schoolA,
) {
  const email = `p9-${name}-${suffix}@example.test`;
  const signup = await auth.api.signUpEmail({
    body: { email, name: `Synthetic ${name}`, password },
  });
  actors[name] = signup.user.id;
  const signed = await auth.api.signInEmail({
    body: { email, password },
    headers: new Headers({ origin: env.BETTER_AUTH_URL }),
    returnHeaders: true,
  });
  cookies[name] = signed.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  members[name] = (
    await prisma.membership.create({
      data: { schoolId, userId: actors[name], role },
    })
  ).id;
}
async function pupil(label: string) {
  const id = `p9-pupil-${label}-${suffix}`;
  await prisma.studentRecord.create({
    data: {
      id,
      schoolId: schoolA,
      admissionNumber: `P9-${label}-${suffix}`,
      givenName: `Synthetic${label}`,
      familyName: "FinancePupil",
      status: "ENROLLED",
    },
  });
  const enrollment = await prisma.studentEnrollment.create({
    data: { schoolId: schoolA, studentId: id, classId, sessionId },
  });
  return { id, enrollmentId: enrollment.id };
}
async function issue(enrollment: string, revision = revisionId) {
  return accepted(
    OBLIGATION,
    "owner",
    {
      enrollmentId: enrollment,
      revisionId: revision,
      requestKey: randomUUID(),
      reason: "Synthetic explicit pupil debt",
    },
    "obligation",
  );
}
async function waiver(amount: string, obligation = obligationId) {
  const proposal = await accepted(
    PROPOSE,
    "admin",
    {
      obligationId: obligation,
      requestKey: randomUUID(),
      kind: "WAIVER",
      proposedAmountMinor: amount,
      reason: "Synthetic fee reduction request",
    },
    "proposal",
  );
  const decision = await accepted(
    DECIDE,
    "owner",
    {
      proposalId: proposal.id,
      action: "APPROVED",
      reason: "Synthetic independent fee reduction approval",
    },
    "decision",
  );
  return decision.id;
}
async function bankClaim(
  amount: string,
  ref: string,
  obligation = obligationId,
) {
  return accepted(
    EVIDENCE,
    "admin",
    {
      obligationId: obligation,
      requestKey: randomUUID(),
      transferReference: ref,
      claimedAmountMinor: amount,
      reason: "Synthetic manual reference claim, no real funds",
    },
    "evidence",
  );
}
async function review(evidenceId: string, ref: string) {
  return accepted(
    VERIFY,
    "owner",
    {
      evidenceId,
      action: "VERIFIED",
      transferReference: ref,
      fundsConfirmed: true,
      reason: "Synthetic independent statement matching attestation",
    },
    "decision",
  );
}
async function accountRows(actor: string) {
  const response = await call(ACCOUNTS, actor);
  expect(response.status).toBe(200);
  return (await response.json()).accounts;
}

describe("Phase 9 released financial accounts and school-issued receipts", () => {
  beforeAll(async () => {
    verifyPhase9DatabaseIdentity(process.env);
    for (const flag of flags) vi.stubEnv(flag, "true");
    await prisma.school.createMany({
      data: [
        {
          id: schoolA,
          slug: schoolA,
          name: "Synthetic financial acceptance A",
        },
        {
          id: schoolB,
          slug: schoolB,
          name: "Synthetic financial acceptance B",
        },
      ],
    });
    for (const [name, role, school] of [
      ["owner", "SCHOOL_SUPER_ADMIN", schoolA],
      ["admin", "SCHOOL_ADMIN", schoolA],
      ["teacher", "TEACHER", schoolA],
      ["student", "STUDENT", schoolA],
      ["parent", "PARENT", schoolA],
      ["unrelated", "PARENT", schoolA],
      ["foreign", "SCHOOL_SUPER_ADMIN", schoolB],
    ] as const)
      await register(name, role, school);
    await prisma.schoolSection.create({
      data: {
        id: sectionId,
        schoolId: schoolA,
        name: "Primary",
        stage: "PRIMARY",
      },
    });
    await prisma.schoolClass.create({
      data: {
        id: classId,
        schoolId: schoolA,
        sectionId,
        name: "Synthetic finance class",
      },
    });
    const now = Date.now();
    await prisma.academicSession.create({
      data: {
        id: sessionId,
        schoolId: schoolA,
        name: "Synthetic finance session",
        startsOn: new Date(now - 86400000),
        endsOn: new Date(now + 86400000 * 60),
        status: "ACTIVE",
      },
    });
    await prisma.academicTerm.create({
      data: {
        id: termId,
        schoolId: schoolA,
        sessionId,
        name: "Synthetic finance term",
        position: 1,
        startsOn: new Date(now - 86400000),
        endsOn: new Date(now + 86400000 * 45),
        status: "ACTIVE",
      },
    });
    const category = await accepted(
      CATEGORY,
      "owner",
      { code: "TUITION", name: "Synthetic tuition" },
      "categories",
    );
    categoryId = category.id;
    const revision = await accepted(
      STRUCTURE,
      "owner",
      {
        categoryId,
        sessionId,
        termId,
        scope: "SCHOOL",
        scopeId: schoolA,
        amountMinor: "10000",
        currency: "NGN",
        reason: "Synthetic explicit school fee policy",
      },
      "revision",
    );
    revisionId = revision.id;
    const first = await pupil("Account");
    pupilId = first.id;
    enrollmentId = first.enrollmentId;
    obligationId = (await issue(enrollmentId)).id;
    const second = await pupil("Unrelated");
    await issue(second.enrollmentId);
    const race = await pupil("Race");
    raceObligationId = (await issue(race.enrollmentId)).id;
    context.headers = new Headers({ cookie: cookies.admin });
    studentLink = (
      await attestStudentAccount(schoolA, {
        studentId: pupilId,
        studentMembershipId: members.student,
        identityVerified: true,
        reason: "Synthetic independently attested pupil identity",
      })
    ).id;
    context.headers = new Headers({ cookie: cookies.admin });
    parentLink = (
      await attestGuardianStudentLink(schoolA, {
        studentId: pupilId,
        guardianMembershipId: members.parent,
        relationshipVerified: true,
        reason: "Synthetic independently attested guardian",
      })
    ).id;
    context.headers = new Headers({ cookie: cookies.admin });
    await attestGuardianStudentLink(schoolA, {
      studentId: second.id,
      guardianMembershipId: members.unrelated,
      relationshipVerified: true,
      reason: "Synthetic distinct pupil relationship",
    });
  }, 45000);
  afterAll(async () => {
    if (!process.env.PHASE9_BROWSER_FIXTURE_FILE) {
      await prisma.school.deleteMany({
        where: { id: { in: [schoolA, schoolB] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: Object.values(actors) } },
      });
    }
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });
  it("keeps default-disabled reads and writes closed", async () => {
    for (const flag of [
      "PHASE9_FINANCIAL_READ_ENABLED",
      "PHASE9_ACCOUNT_RELEASE_ENABLED",
      "PHASE9_RECEIPT_ENABLED",
      "PHASE9_EVIDENCE_UPLOAD_ENABLED",
    ]) {
      vi.stubEnv(flag, "false");
      try {
        const response =
          flag === "PHASE9_FINANCIAL_READ_ENABLED"
            ? await call(ACCOUNTS, "owner")
            : flag === "PHASE9_ACCOUNT_RELEASE_ENABLED"
              ? await call(RELEASE, "owner", {})
              : flag === "PHASE9_EVIDENCE_UPLOAD_ENABLED"
                ? await upload("admin", "pending-evidence", new Uint8Array([1]))
                : await call(RECEIPT, "owner", {});
        expect(response.status).toBe(404);
      } finally {
        vi.stubEnv(flag, "true");
      }
    }
  });
  it("does not publish charges or receipt data from role or relationship alone", async () => {
    expect(await accountRows("student")).toEqual([]);
    expect(await accountRows("parent")).toEqual([]);
    for (const actor of ["", "teacher", "admin"]) {
      expect((await call(ACCOUNTS, actor)).status).toBe(actor ? 404 : 401);
      expect((await call(RECEIPTS, actor)).status).toBe(actor ? 404 : 401);
    }
    expect(
      (await accountRows("owner")).find(
        (r: { obligationId: string }) => r.obligationId === obligationId,
      ),
    ).toMatchObject({
      originalChargeMinor: "10000",
      remainingMinor: "10000",
      allocatedMinor: "0",
    });
    expect((await call(ACCOUNTS, "foreign", undefined, schoolA)).status).toBe(
      404,
    );
  });
  it("leaves pending evidence out of the ledger and rejects false confirmation", async () => {
    const claim = await bankClaim("6000", reference);
    claimId = claim.id;
    expect(
      (await accountRows("owner")).find(
        (r: { obligationId: string }) => r.obligationId === obligationId,
      ).remainingMinor,
    ).toBe("10000");
    expect(
      (
        await call(VERIFY, "owner", {
          evidenceId: claimId,
          action: "VERIFIED",
          transferReference: reference,
          fundsConfirmed: false,
          reason: "Synthetic invalid assertion",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(VERIFY, "admin", {
          evidenceId: claimId,
          action: "VERIFIED",
          transferReference: reference,
          fundsConfirmed: true,
          reason: "Synthetic self-review attempt",
        })
      ).status,
    ).toBe(404);
    const image = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 30, g: 90, b: 160 },
      },
    })
      .png()
      .toBuffer();
    for (const origin of [null, "https://foreign.example.test"]) {
      expect(
        (
          await upload(
            "admin",
            claimId,
            image,
            randomUUID(),
            "evidence.png",
            "image/png",
            false,
            origin,
          )
        ).status,
      ).toBe(400);
    }
    for (const actor of ["owner", "student", "parent", "teacher", "foreign"]) {
      expect((await upload(actor, claimId, image)).status).toBe(404);
    }
    expect(
      (
        await upload(
          "admin",
          claimId,
          new TextEncoder().encode('<svg onload="alert(1)"></svg>'),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await upload(
          "admin",
          claimId,
          image,
          randomUUID(),
          "wrong.jpg",
          "image/jpeg",
        )
      ).status,
    ).toBe(400);
    expect(
      (await upload("admin", claimId, new Uint8Array(5 * 1024 * 1024 + 1)))
        .status,
    ).toBe(400);
    const wide = await sharp({
      create: {
        width: 4097,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    expect((await upload("admin", claimId, wide)).status).toBe(400);
    expect(
      (
        await upload(
          "admin",
          claimId,
          image,
          randomUUID(),
          "image.png",
          "image/png",
          true,
        )
      ).status,
    ).toBe(400);
    const key = randomUUID(),
      uploaded = await upload("admin", claimId, image, key);
    expect(uploaded.status).toBe(201);
    const attachment = (await uploaded.json()).attachment;
    expect(attachment.mediaType).toBe("image/png");
    expect(JSON.stringify(attachment)).not.toContain("private-evidence");
    expect((await upload("admin", claimId, image, key)).status).toBe(200);
    const changed = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 200, g: 1, b: 1 },
      },
    })
      .png()
      .toBuffer();
    expect((await upload("admin", claimId, changed, key)).status).toBe(409);
    for (const actor of ["student", "parent", "teacher", "foreign"]) {
      expect((await download(actor, attachment.id)).status).toBe(404);
    }
    const imageResponse = await download("owner", attachment.id);
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(imageResponse.headers.get("cache-control")).toContain("no-store");
    expect(imageResponse.headers.get("content-disposition")).toContain(
      "attachment;",
    );
    const metadata = await sharp(
      Buffer.from(await imageResponse.arrayBuffer()),
    ).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect((await download("owner", attachment.id, schoolB)).status).toBe(404);
    expect((await download("owner", "../../.env")).status).toBe(400);
    expect(
      await prisma.paymentVerificationDecision.count({
        where: { schoolId: schoolA, evidenceId: claimId },
      }),
    ).toBe(0);
    expect(
      (await accountRows("owner")).find(
        (r: { obligationId: string }) => r.obligationId === obligationId,
      ).remainingMinor,
    ).toBe("10000");
    await expect(
      prisma.paymentEvidenceAttachment.update({
        where: { id: attachment.id },
        data: { sha256: "0".repeat(64) },
      }),
    ).rejects.toThrow();
    verificationId = (await review(claimId, reference)).id;
    expect((await upload("admin", claimId, changed)).status).toBe(404);

    expect(
      (await accountRows("owner")).find(
        (r: { obligationId: string }) => r.obligationId === obligationId,
      ).remainingMinor,
    ).toBe("10000");
  });
  it("allocates once under racing exact retries without double credit", async () => {
    const payload = {
      verificationId,
      requestKey: randomUUID(),
      reason: "Synthetic audited manual allocation",
    };
    const responses = await Promise.all([
      call(ALLOCATE, "owner", payload),
      call(ALLOCATE, "owner", payload),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    allocationId = (await responses[0].json()).allocation.id;
    expect(
      await prisma.manualPaymentAllocation.count({
        where: { schoolId: schoolA, verificationId },
      }),
    ).toBe(1);
    expect(
      (await accountRows("owner")).find(
        (r: { obligationId: string }) => r.obligationId === obligationId,
      ),
    ).toMatchObject({ allocatedMinor: "6000", remainingMinor: "4000" });
    expect(
      (await call(ALLOCATE, "owner", { ...payload, requestKey: randomUUID() }))
        .status,
    ).toBe(404);
  });
  it("issues only an owner-approved receipt for the immutable verified allocation", async () => {
    const payload = {
      allocationId,
      requestKey: randomUUID(),
      reason: "Synthetic school-approved receipt issuance",
    };
    for (const actor of ["admin", "teacher", "student", "parent", "foreign"]) {
      expect((await call(RECEIPT, actor, payload)).status).toBe(404);
    }
    expect(
      (await call(RECEIPT, "owner", { ...payload, amountMinor: "9999999" }))
        .status,
    ).toBe(400);
    const outcomes = await Promise.all([
      call(RECEIPT, "owner", payload),
      call(RECEIPT, "owner", payload),
    ]);
    expect(outcomes.map((r) => r.status).sort()).toEqual([200, 201]);
    receiptId = (await outcomes[0].json()).receipt.id;
    expect(
      (
        await call(RECEIPT, "owner", {
          ...payload,
          reason: "Changed receipt reason",
        })
      ).status,
    ).toBe(409);
    expect(
      (await call(RECEIPT, "owner", { ...payload, requestKey: randomUUID() }))
        .status,
    ).toBe(409);
    const rows = (await (await call(RECEIPTS, "owner")).json()).receipts;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: receiptId,
      amountMinor: "6000",
      currency: "NGN",
      receiptNumber: "MSB-00000001",
      status: "ACTIVE_MANUAL_ALLOCATION_RECEIPT",
    });
    for (const field of [
      "referenceDigest",
      "transferReference",
      "submitterUserId",
      "snapshot",
    ])
      expect(JSON.stringify(rows)).not.toContain(field);
  });
  it("enforces all visibility policies and versioned explicit school release", async () => {
    for (const [visibility, pupilAllowed, parentAllowed] of [
      ["STAFF_ONLY", false, false],
      ["GUARDIAN_ONLY", false, true],
      ["STUDENT_ONLY", true, false],
      ["STUDENT_AND_GUARDIAN", true, true],
    ] as const) {
      const rollback = Symbol("rollback policy fixture");
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.feeAccountRelease.create({
            data: {
              id: randomUUID(),
              schoolId: schoolA,
              obligationId,
              requestKey: randomUUID(),
              action: "PUBLISHED",
              visibility,
              reason: "Synthetic explicit school visibility",
              actorMembershipId: members.owner,
              actorUserId: actors.owner,
            },
          });
          for (const [user, expected] of [
            [actors.student, pupilAllowed],
            [actors.parent, parentAllowed],
          ] as const) {
            const rows = await tx.$queryRaw<
              Array<{ allowed: boolean }>
            >`SELECT "can_read_fee_account"(${schoolA},${obligationId},${user}) AS allowed`;
            expect(rows[0].allowed).toBe(expected);
          }
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    }
    const input = {
      obligationId,
      requestKey: randomUUID(),
      action: "PUBLISHED",
      visibility: "STUDENT_AND_GUARDIAN",
      reason: "Synthetic explicit account release",
    };
    expect((await call(RELEASE, "admin", input)).status).toBe(404);
    const issued = await accepted(RELEASE, "owner", input, "release");
    expect(issued.revision).toBe(1);
    expect((await call(RELEASE, "owner", input)).status).toBe(200);
    expect(
      (await call(RELEASE, "owner", { ...input, visibility: "STAFF_ONLY" }))
        .status,
    ).toBe(409);
    for (const actor of ["student", "parent"]) {
      const response = await call(ACCOUNTS, actor);
      expect(response.headers.get("cache-control")).toContain("no-store");
      const rows = (await response.json()).accounts;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        studentId: pupilId,
        obligationId,
        remainingMinor: "4000",
      });
      expect(JSON.stringify(rows)).not.toContain("SyntheticUnrelated");
      expect(
        (await (await call(RECEIPTS, actor)).json()).receipts,
      ).toHaveLength(1);
    }
    expect(await accountRows("unrelated")).toEqual([]);
    expect(
      (
        await call(
          RECEIPTS,
          "parent",
          undefined,
          schoolA,
          `?receiptId=foreign-receipt`,
        )
      ).status,
    ).toBe(200);
    expect(
      (await call(ACCOUNTS, "parent", undefined, schoolA, "?userId=forged"))
        .status,
    ).toBe(400);
  });
  it("applies approved waivers explicitly and reports exact amounts without currency mixing", async () => {
    const decisionId = await waiver("2000");
    await accepted(
      WAIVE,
      "owner",
      {
        decisionId,
        requestKey: randomUUID(),
        reason: "Synthetic explicit waiver application",
      },
      "waiver",
    );
    expect((await accountRows("parent"))[0]).toMatchObject({
      originalChargeMinor: "10000",
      waivedMinor: "2000",
      allocatedMinor: "6000",
      remainingMinor: "2000",
    });
    const response = await call(REPORTS, "owner");
    expect(response.status).toBe(200);
    const rows = (await response.json()).reports;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      currency: "NGN",
      obligations: "3",
      originalChargeMinor: "30000",
      waivedMinor: "2000",
      allocatedMinor: "6000",
      remainingMinor: "22000",
    });
    for (const actor of ["admin", "parent", "student", "teacher"]) {
      expect((await call(REPORTS, actor)).status).toBe(404);
    }
    const csv = await call(REPORTS, "owner", undefined, schoolA, "?format=csv");
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(await csv.text()).toContain('"22000"');
  });
  it("serializes concurrent verification caps and cross-ledger waivers", async () => {
    const refA = reference + "-RACEA",
      refB = reference + "-RACEB";
    const a = await bankClaim("7000", refA, raceObligationId),
      b = await bankClaim("7000", refB, raceObligationId);
    const results = await Promise.all([
      call(VERIFY, "owner", {
        evidenceId: a.id,
        action: "VERIFIED",
        transferReference: refA,
        fundsConfirmed: true,
        reason: "Synthetic concurrent bank review A",
      }),
      call(VERIFY, "owner", {
        evidenceId: b.id,
        action: "VERIFIED",
        transferReference: refB,
        fundsConfirmed: true,
        reason: "Synthetic concurrent bank review B",
      }),
    ]);
    expect(
      results.filter((r) => r.status === 201 || r.status === 200),
    ).toHaveLength(1);
    const decisionId = await waiver("2000", raceObligationId),
      claim = await bankClaim("2000", reference + "-RACEC", raceObligationId);
    const outcomes = await Promise.all([
      call(WAIVE, "owner", {
        decisionId,
        requestKey: randomUUID(),
        reason: "Synthetic concurrent fee reduction",
      }),
      call(VERIFY, "owner", {
        evidenceId: claim.id,
        action: "VERIFIED",
        transferReference: reference + "-RACEC",
        fundsConfirmed: true,
        reason: "Synthetic concurrent bank review C",
      }),
    ]);
    expect(
      outcomes.filter((r) => r.status === 201 || r.status === 200),
    ).toHaveLength(1);
    const total = await prisma.$queryRaw<
      Array<{ total: string }>
    >`SELECT ((SELECT COALESCE(SUM(e."claimedAmountMinor"),0) FROM "PaymentEvidence" e JOIN "PaymentVerificationDecision" d ON d."schoolId"=e."schoolId" AND d."evidenceId"=e."id" AND d."action"='VERIFIED' WHERE e."schoolId"=${schoolA} AND e."obligationId"=${raceObligationId})+(SELECT COALESCE(SUM("amountMinor"),0) FROM "FeeWaiverApplication" WHERE "schoolId"=${schoolA} AND "obligationId"=${raceObligationId}))::text AS total`;
    expect(BigInt(total[0].total)).toBeLessThanOrEqual(BigInt(10000));
  });
  it("withdraws access with a new immutable revision and never mutates old release history", async () => {
    const input = {
      obligationId,
      requestKey: randomUUID(),
      action: "WITHDRAWN",
      visibility: "STAFF_ONLY",
      reason: "Synthetic financial visibility withdrawal",
    };
    await accepted(RELEASE, "owner", input, "release");
    expect(await accountRows("parent")).toEqual([]);
    expect((await (await call(RECEIPTS, "student")).json()).receipts).toEqual(
      [],
    );
    await accepted(
      RELEASE,
      "owner",
      {
        ...input,
        requestKey: randomUUID(),
        action: "PUBLISHED",
        visibility: "STUDENT_AND_GUARDIAN",
        reason: "Synthetic new explicit visibility revision",
      },
      "release",
    );
    expect(
      await prisma.feeAccountRelease.count({
        where: { schoolId: schoolA, obligationId },
      }),
    ).toBe(3);
    const row = await prisma.feeAccountRelease.findFirstOrThrow({
      where: { schoolId: schoolA, obligationId },
    });
    await expect(
      prisma.feeAccountRelease.update({
        where: { id: row.id },
        data: { visibility: "STAFF_ONLY" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`TRUNCATE "FeeAccountRelease"`,
    ).rejects.toThrow();
  });
  it("preserves receipts while approved allocation reversals correct the current balance", async () => {
    const proposed = await accepted(
      REVERSE,
      "admin",
      {
        allocationId,
        requestKey: randomUUID(),
        reason: "Synthetic manual allocation correction request",
      },
      "reversal",
    );
    await accepted(
      REVERSE_DECIDE,
      "owner",
      {
        requestId: proposed.id,
        action: "APPROVED",
        reason: "Synthetic independent reversal approval",
      },
      "decision",
    );
    expect((await accountRows("parent"))[0]).toMatchObject({
      allocatedMinor: "0",
      reversedMinor: "6000",
      waivedMinor: "2000",
      remainingMinor: "8000",
    });
    expect(
      (await (await call(RECEIPTS, "parent")).json()).receipts[0].status,
    ).toBe("REVERSED_MANUAL_ALLOCATION_RECEIPT");
    await expect(
      prisma.feeReceipt.update({
        where: { id: receiptId },
        data: { amountMinor: BigInt(1) },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.feeReceipt.delete({ where: { id: receiptId } }),
    ).rejects.toThrow();
  });
  it("conceals financial data after current membership, school and enrollment revocation", async () => {
    for (const target of ["member", "school", "enrollment"]) {
      const rollback = Symbol("rollback access fixture");
      await expect(
        prisma.$transaction(async (tx) => {
          if (target === "member")
            await tx.membership.update({
              where: { id: members.parent },
              data: { isActive: false },
            });
          if (target === "school")
            await tx.school.update({
              where: { id: schoolA },
              data: { isActive: false },
            });
          if (target === "enrollment")
            await tx.studentEnrollment.update({
              where: { id: enrollmentId },
              data: { status: "ENDED", endedAt: new Date() },
            });
          const rows = await tx.$queryRaw<
            Array<{ allowed: boolean }>
          >`SELECT "can_read_fee_account"(${schoolA},${obligationId},${actors.parent}) AS allowed`;
          expect(rows[0].allowed).toBe(false);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    }
    context.headers = new Headers({ cookie: cookies.admin });
    await revokeGuardianStudentLink(schoolA, parentLink, {
      reason: "Synthetic terminal financial guardian revocation",
    });
    expect(await accountRows("parent")).toEqual([]);
    expect(await accountRows("student")).toHaveLength(1);
    context.headers = new Headers({ cookie: cookies.admin });
    await revokeStudentAccountLink(schoolA, studentLink, {
      reason: "Synthetic terminal financial identity revocation",
    });
    expect(await accountRows("student")).toEqual([]);
    expect((await (await call(RECEIPTS, "student")).json()).receipts).toEqual(
      [],
    );
  });
  it("scopes the staff workflow and stages a fresh enrolled browser pupil without restoring revoked identities", async () => {
    const admin = await call(WORKSPACE, "admin");
    expect(admin.status).toBe(200);
    const data = await admin.json();
    expect(data.accounts).toEqual([]);
    expect(data.reports).toEqual([]);
    expect(data.config).toBe(null);
    for (const actor of ["parent", "student", "teacher", "foreign"]) {
      expect((await call(WORKSPACE, actor)).status).toBe(404);
    }
    if (process.env.PHASE9_BROWSER_FIXTURE_FILE) {
      const path = process.env.PHASE9_BROWSER_FIXTURE_FILE;
      if (!/^\/tmp\/phase9-[A-Za-z0-9_-]+\.json$/.test(path))
        throw Error("Private fixture path required");
      await register("browserstudent", "STUDENT");
      await register("browserparent", "PARENT");
      const fresh = await pupil("Browser");
      context.headers = new Headers({ cookie: cookies.admin });
      await attestStudentAccount(schoolA, {
        studentId: fresh.id,
        studentMembershipId: members.browserstudent,
        identityVerified: true,
        reason: "Synthetic fresh financial browser identity",
      });
      context.headers = new Headers({ cookie: cookies.admin });
      await attestGuardianStudentLink(schoolA, {
        studentId: fresh.id,
        guardianMembershipId: members.browserparent,
        relationshipVerified: true,
        reason: "Synthetic fresh financial browser relationship",
      });
      await writeFile(
        path,
        JSON.stringify({
          schoolA,
          schoolB,
          suffix,
          actors,
          members,
          cookies,
          password,
          categoryId,
          revisionId,
          sessionId,
          termId,
          classId,
          sectionId,
          browserPupilId: fresh.id,
          browserEnrollmentId: fresh.enrollmentId,
        }),
        { mode: 0o600, flag: "wx" },
      );
    }
  });
});
