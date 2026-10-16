# Fees and Payments

## Phase 9 internal applied waivers (AUTHORED, NOT VERIFIED)

- A separately authorized active same-school School Super Admin may
  append an immutable `FeeWaiverApplication` only after the exact
  `FeeAdjustmentDecision` for that same obligation is APPROVED
  and its original proposal kind is `WAIVER`. A
  `CORRECTION_PROPOSAL`, REJECTED, pending, foreign or already
  applied proposal can **never** be converted to a waiver.
  The School Administrator proposer remains separate from the
  applying School Super Admin. An APPROVED proposal alone still
  has no accounting effect without an explicit application.
- PostgreSQL locks the School row and checks active school owner,
  exact proposal, approved decision, amount and currency; it copies
  `amountMinor`, `currency` and UTC time from immutable source.
  Uniqueness on same-school proposal, decision and UUID request
  prevents double-application and incorrect idempotency replay.
  Ordinary UPDATE/DELETE/TRUNCATE are prohibited.
- **Cross-ledger protection:** when a waiver is applied, SQL checks
  `SUM(existing applied waivers)+SUM(all VERIFIED reference claims)+
  proposed waiver <= original charge`. Human VERIFIED claims
  count even if their manual allocations were reversed. Additional
  SQL INSERT guards on future VERIFIED decisions and manual
  allocations enforce the new adjusted-charge limit under the
  same school lock. No reviewed funds can be waived away
  without a later separately authorized refund workflow.
  This conservatively prevents waiver of already-attested money;
  no actual external bank settlement is inferred.
- Owner-only private no-store `GET/POST
  /api/schools/:schoolId/fee-waiver-applications` creates one
  explicit internal waiver or reads the bounded same-school
  audit list. Strict inputs accept only decisionId, requestKey
  and reason. No external receipt, payer account, bank callback,
  guardian/student access or actual fee mutation.
  New `PHASE9_EFFECTIVE_WAIVER_ENABLED=false` and existing
  `PHASE9_FEE_WRITE_ENABLED=false` both guard writes.
- The separate owner-only manual allocation preview retains
  `originalChargeMinor` and adds `appliedWaiverMinor` and
  `adjustedChargeMinor`; `previewRemainingMinor` subtracts
  NET active manual allocation and applied waiver from original
  charge. These are **internal, manually reviewed previews**
  and not provider-certified settlement, official enforceable
  fee statements or school receipts. Future adjustment reversal
  must be a separately reviewed append-only event; original
  waivers are never silently edited.


## Phase 9 advisory fee adjustment proposals (authored, NOT VERIFIED)

- `FeeAdjustmentProposal` snapshots a reasoned current same-school
  School Administrator's proposed WAIVER or CORRECTION_PROPOSAL for
  one existing immutable FeeObligation, explicitly bounded to the
  original charge and same currency. UUID retry key, actor, school,
  full precision minor units and timestamp remain immutable.
- An independent active same-school School Super Admin may append
  one `FeeAdjustmentDecision` APPROVED/REJECTED judgment and reason.
  Exactly matching reviewer/payload retry reuses the decision. SQL
  independently rechecks real actors and source under School lock,
  tenant-composite foreign keys and no-update/delete/truncate guards.
- **Even APPROVED is ADVISORY ONLY:** there is deliberately no effective
  waiver, repricing, charge adjustment, allocation reduction, refund,
  official amount due, receipt or school/student-facing balance change.
  Executing an adjustment requires a separate accounting ledger and
  independent acceptance, including concurrency and cumulative
  over-credit protection.
- Private no-store `GET/POST /api/schools/:schoolId/fee-adjustment-proposals`
  projects only an active School Administrator's own proposals or the
  School Super Admin's bounded queue; independent
  `POST /api/schools/:schoolId/fee-adjustment-decisions` creates
  one terminal advisory review. No DELETE/PATCH/export, parent/guardian
  or student finance routes.
- `PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED=false` additionally guards
  writes beside `PHASE9_FEE_WRITE_ENABLED=false`. Both default OFF
  pending disposable database and security gates.


## Scope

School-defined fee categories, period-specific fee structures, student fee obligations,
payment evidence, independent verification, receipts, and reconciliation. All records
are tenant-bound and financial history must be attributable and non-silently mutable.

## Phase 9 delivery order (FEE-REQ-001)

1. **Fee configuration foundation — authored, NOT VERIFIED.** One immutable
   `FeeCategory` per school and uppercase code; versioned, explicitly
   priced `FeeStructureRevision` per school/category/session/term and
   `SCHOOL`, `SECTION`, or `CLASS` scope. All classes and sections are
   the actual school's active resources. School Super Admin alone can
   configure this first slice; later bursar/delegated finance permission
   requires a separately defined verified authorization policy.
2. **Student fee obligations — AUTHORED, NOT VERIFIED.** An explicit
   `FeeObligation` for an ENROLLED pupil with matching ACTIVE enrollment
   and current school/category/session/term fee revision. Its PostgreSQL
   INSERT trigger checks the issuer and scope then copies charge
   money and context **from the database**, with one immutable pupil/
   category/term charge, globally unique per-school idempotency key,
   and no repricing. Waiver/discount/adjustment/reversal remains future
   separately reviewed evidence, not mutation of the original charge.
3. **Payment reference evidence and independent review — AUTHORED,
   NOT VERIFIED.** School Administrator submits an immutable *manual bank
   reference claim* for one school obligation. This records no file and
   **does not prove funds have arrived**. A distinct active same-school
   School Super Admin may attest a one-time VERIFIED or REJECTED review
   after independent external bank reconciliation; verified sums cannot
   exceed the recorded original debt. Claim and review retries are
   idempotent only for exactly the original actor and payload. Full
   actual file upload, receipts, provider callbacks, refunds and
   reversals are not yet implemented.
4. **Manual allocation and provisional balance preview — AUTHORED,
   NOT VERIFIED.** One `ManualPaymentAllocation` can apply the exact
   claimed amount from a distinct independently VERIFIED manual
   reference claim against its original school-owned debt, and only once.
   A School Super Admin initiates a reasoned, UUID-idempotent allocation;
   the database locks the school, derives exact money from evidence and
   independently rechecks authorization, verified decision, currency,
   reference digest and no-overallocation cap. An owner-only bounded
   GET derives original debt, manually reviewed amount, allocated amount,
   unallocated reviewed amount and an arithmetic remainder **for internal
   preview only**. This is NOT bank settlement, verified official
   student balance, generated receipt or accepted reconciliation.
   Corrective reversals/refunds remain separate future evidence.
5. **Manual allocation reversal requests and independent review — AUTHORED,
   NOT VERIFIED.** An active same-school School Administrator proposes
   one reasoned request to correct an existing manually allocated
   preview amount. A distinct current School Super Admin approves
   or rejects it. Only APPROVED subtracts the **entire original
   manual allocation** from the internal preview, never altering
   historical fee, claim, review or allocation records. No refund,
   bank movement, official student balance or receipt is created.
6. **Private finance, student/guardian views and release checks — PENDING.**
   Apply verified same-school relationship and minimum-data access,
   actual synthetic PostgreSQL integration tests, privacy/browser checks,
   unchanged CI and strict high-severity dependency audit before release.

## Phase 9 fee configuration implementation contract

- `FeeCategory` identifies an immutable school-specific label/code.
  A new label requires a new category rather than rewriting history.
- `FeeStructureRevision` is a policy proposal, **not** an issued debt,
  verified payment, or receivable; each context has SQL-assigned version.
  `amountMinor` is a strictly positive PostgreSQL BIGINT and the HTTP
  contract accepts/returns its decimal-string representation to avoid
  JavaScript floating-point money loss. Currency is explicit ISO-style
  three-letter uppercase code; no automatic conversion or default charge.
- Scope: `SCHOOL` uses `scopeId=schoolId` with no section/class;
  `SECTION` uses exactly its same-school section; `CLASS` uses an
  active class with an active same-school section. Cross-tenant links
  are prohibited by composite FKs and checked again inside SQL.
- A period may be `PLANNED` or `ACTIVE`; `CLOSED` sessions/terms
  cannot receive new price versions. A fee revision never rewrites
  older revisions or already-created obligations.
- A current active `SCHOOL_SUPER_ADMIN` in the actual school may create
  categories and fee revisions. Client actor/owner identifiers are
  rejected. SQL locks the School row, validates original active member
  and real class/period, assigns revision/timestamp, and rejects
  UPDATE/DELETE/TRUNCATE of fee history.
- All Phase 9 configuration and charge POSTs are **disabled by default**
  unless `PHASE9_FEE_WRITE_ENABLED=true`; do not enable against shared or
  live data. The synthetic DB test stubs it on explicitly.
- First internal-admin APIs: `GET/POST /api/schools/:schoolId/fee-categories`
  and `GET/POST /api/schools/:schoolId/fee-structures`. GET metadata is
  bounded, SQL rechecks current school/member for each query, and both
  routes require actual signed-in sessions, use `private, no-store`,
  and conceal other schools' identifiers.
- Second internal-admin API: `GET/POST /api/schools/:schoolId/fee-obligations`.
  POST requires exact `enrollmentId`, immutable `revisionId`, unique UUID
  `requestKey` and reason, never caller amount/student/actor/currency.
  Server checks the signed-in active School Super Admin, exact enrolled
  pupil/class/session and scope, then PostgreSQL independently re-derives
  all monetary and student fields under the school lock. The revision
  must still be the latest in its own scope. Identical retry returns
  the first immutable charge; changed-key/payload and repeated charge
  for the same pupil/category/term are conflicts. GET returns owner-only
  bounded charge metadata, not payment status or a verified balance.
  A school fee obligation is not equivalent to funds being received.
- These milestones deliberately create **no** payment evidence records,
  payment provider calls, callbacks, receipt APIs, fee waivers,
  student/guardian finance views, or financial settlement side effects.

## Phase 9 manual reference evidence contract (authored, NOT verified)

- New append-only `PaymentEvidence` and `PaymentVerificationDecision`
  tables tie to the exact same-school FeeObligation and actual submitting/
  reviewing school memberships using composite tenant foreign keys.
- Submission: only a signed-in, active same-school `SCHOOL_ADMIN`
  may POST `obligationId`, UUID `requestKey`, uppercase 8–80-character
  `transferReference`, positive integer-string `claimedAmountMinor`,
  and nonempty reason. The PostgreSQL insert guard independently checks
  actor, school, exact debt, upper claim bound and same currency; claims
  remain `SUBMITTED` and are not payment credits.
  Bank references are **not persisted in plaintext**: the service stores
  only a school-bound SHA-256 digest. This digest is a duplicate-detection
  aid, **not** proof of transfer or a secret authentication factor.
  A repeat same request/payload is acknowledged; changed-key/payload,
  repeated transfer reference or foreign school ID is rejected.
- Review: only a separately signed-in, active same-school
  `SCHOOL_SUPER_ADMIN`, not the submitting member, may POST
  `evidenceId`, `action`, and reason. `VERIFIED` additionally
  requires the reviewer to reconfirm the same normalized transfer
  reference and explicitly attest `fundsConfirmed: true` after
  external bank statement matching. `REJECTED` supplies no reference or
  funds confirmation. Database SQL rechecks exact reviewer and evidence
  identity, original reference digest, amount/currency and sum of all
  earlier VERIFIED decisions for the obligation. It rejects an aggregate
  greater than the immutable charge. Every decision is append-only,
  one per claim; exact same reviewer/payload retry reuses the decision.
  **Manual verification is not provider-certified settlement.**
- Public HTTP surface (not production accepted):
  `GET/POST /api/schools/:schoolId/payment-evidence` returns
  no raw bank reference or digest and only shows a School Administrator
  their own submissions (or the School Super Admin the full bounded
  school review queue). `POST /api/schools/:schoolId/payment-verifications`
  creates a separate immutable manual review; no read/export/PUT/DELETE
  action exists on that endpoint. All replies use `private, no-store`.
  `SUBMITTED_EVIDENCE_ONLY` is the permanent submission acknowledgment
  even after later review. Its separate owner/submitter GET projection
  reports `PENDING_VERIFICATION` before a decision, or `VERIFIED` /
  `REJECTED` with the terminal `reviewAction` after manual review;
  these are not provider-certified transfers or receipts.
- All three finance-related switches must be explicitly set to
  `true` for the corresponding writes:
  `PHASE9_FEE_WRITE_ENABLED`, `PHASE9_PAYMENT_EVIDENCE_ENABLED`
  for reference submission, and `PHASE9_PAYMENT_REVIEW_ENABLED` for
  review. **All default to false**. Do not use against live schools,
  shared databases, real payments, or unidentified test environments.
- No payment document upload until private tenant-scoped storage, file
  type/size checking, malware inspection and authorized retrieval are
  established per FILE_UPLOAD_AND_STORAGE_SECURITY.md. No user-supplied
  provider status, callback, real settlement, verified receipt, refunds,
  reversals, payment allocations or financial release is supported.
  Future adjustment/reversal must preserve original evidence and add
  separate immutable transactions. This manual-review foundation alone
  is not a reliable production outstanding-balance calculation.

## Phase 9 manual allocation/preview contract (authored, NOT verified)

- `ManualPaymentAllocation` is an append-only link between one exact
  same-school `PaymentVerificationDecision` with `action=VERIFIED`,
  `confirmedBankFunds=true` and matching hashed reference, its source
  `PaymentEvidence`, and the original `FeeObligation`. The school
  admin who submitted evidence cannot allocate it; only a current active
  same-school `SCHOOL_SUPER_ADMIN` can. No REJECTED or unreviewed
  claim may be allocated; a decision/evidence may only be allocated once.
- Database SQL locks the School row, validates the real active
  allocation member, the exact verified evidence-decision-obligation
  chain and same currency, refuses aggregate over-allocation, copies
  actual amount/currency from immutable trusted evidence, assigns UTC
  allocation time and rejects UPDATE/DELETE/TRUNCATE. School idempotency
  request keys are unique; same actor/request/verification/reason replays
  return the original allocation, changed replay is denied. A forged
  client amount, currency, actor or student ID is rejected by strict API
  input shape. No cash or bank account is modified.
- `GET/POST /api/schools/:schoolId/manual-payment-allocations`
  are private no-store School-Super-Admin-only. GET computes exact
  PostgreSQL numeric-string columns `originalChargeMinor`,
  `independentlyReviewedMinor`, `manuallyAllocatedMinor`,
  `reviewedNotAllocatedMinor`, `previewRemainingMinor`,
  with `NO_MANUAL_ALLOCATION`, `PARTIAL_MANUAL_ALLOCATION`
  or `FULL_MANUAL_ALLOCATION`. The labels intentionally avoid PAID,
  SETTLED, OFFICIAL, RECEIPT and FINANCIALLY CLEARED. The arithmetic
  is an internal *manual reconciliation preview*, **not** a bank
  settlement statement, parent-readable fee balance or financial
  release.
- `PHASE9_MANUAL_ALLOCATION_ENABLED=false` separately keeps this
  POST off unless the existing `PHASE9_FEE_WRITE_ENABLED=true`
  master switch is also set. Do not enable until full disposable-DB
  verification, privacy and strict security gate acceptance.
- No refund, reversal or charge adjustment ledger is included; no
  immutable credit should become production-enforceable or described
  as received funds without separately audited settlement and
  correction models.

## Phase 9 manual allocation reversal/correction contract (authored, NOT verified)

- `ManualAllocationReversalRequest` is an immutable reasoned current
  School Administrator request for one existing same-school allocation.
  PostgreSQL checks actor/tenant/source under School lock, then copies
  the allocation's full minor-unit amount and currency from original
  ledger records. Strict HTTP input accepts allocationId, UUID requestKey
  and reason, never caller money, refund target, paid state or actor.
- Only a distinct current same-school School Super Admin can append
  one immutable `ManualAllocationReversalDecision`: APPROVED or
  REJECTED. PostgreSQL repeats actor/source checks and rejects history
  mutation or a second decision. Same reviewer/action/reason retry
  returns the first decision; changed retry is a conflict.
- Exactly **one** request is permitted for each allocation, including
  if rejected; partial reversal, reopening a rejected request or
  reusing the original verified claim after approval requires a later
  separately audited policy. REJECTED never subtracts allocation;
  APPROVED subtracts its **full amount from internal preview only**.
  The source allocation and VERIFIED human attestation remain
  permanently preserved and are not reusable.
- Private no-store `GET/POST /api/schools/:schoolId/manual-allocation-reversals`
  lists an Administrator's **own** requests or the School Super
  Admin's bounded queue and accepts only Admin requests.
  `POST /api/schools/:schoolId/manual-allocation-reversal-decisions`
  records the independent School Super Admin decision; no PATCH,
  DELETE, actual bank refund, provider callback, or document export.
  Writes require both `PHASE9_FEE_WRITE_ENABLED=true` and new
  `PHASE9_MANUAL_REVERSAL_ENABLED=true`; BOTH default OFF.
- Owner-only preview now separates `grossManuallyAllocatedMinor`,
  `approvedReversedMinor`, NET `manuallyAllocatedMinor` and
  `previewRemainingMinor`. `reviewedNotAllocatedMinor` excludes
  already reversed **non-reusable** claims, and
  `REVERSED_MANUAL_ALLOCATION` explicitly distinguishes a fully
  corrected preview from an untouched obligation. No data is a
  bank-settled financial balance or student/guardian payment status.

## Critical payment states (future obligations)

- Submitted
- Pending verification
- Verified
- Rejected
- Refunded
- Reversed

Upload evidence and provider callbacks must never automatically equate
to verified funds. Payment processing must be idempotent and auditable.
Provider secrets must never be stored in application records.

## Validation status

Migration, Prisma generation/validation, real-session synthetic PostgreSQL
integration, financial lifecycle, browser and unchanged CI/security audit
remain **NOT EXECUTED**. This branch is a non-production candidate only.
See `docs/quality/PHASE9_FEE_CONFIGURATION_CHECKPOINT_20261016.md`,
D-P9-001 / D-P9-002 / D-P9-003 and ADR-P9-001 /
ADR-P9-002 / ADR-P9-003. See
`docs/quality/PHASE9_PAYMENT_EVIDENCE_CHECKPOINT_20261016.md`.
