# Phase 9 — Manual Transfer Reference Evidence and Independent Review Checkpoint

**Date:** 2026-10-16  
**Repository:** `Wilberry/myschoolboard`  
**Branch:** `feature/phase9-fees-payments-foundation`  
**Base:** committed Phase 7 `18d8b8292fc37e3f131986fe6d8ab9c3038ad2e0`  
**Mandate:** D-023  
**Requirements:** FEE-REQ-001 partial, TEN-REQ-001 and SEC-REQ-001 controls authored; T-FEE-001 authored only  
**Exit:** **BLOCKED, NOT VERIFIED**. No deployment, release or actual payment processing.

## Completed implementation candidates

1. `prisma/schema.prisma`: `PaymentEvidenceStatus.SUBMITTED`,
   `PaymentVerificationAction.VERIFIED/REJECTED`, immutable
   `PaymentEvidence` and `PaymentVerificationDecision` models.
   Each entry has an exact same-school obligation or evidence reference,
   active real school membership actor, and immutable recorded UTC time.
   School request and reference-digest uniqueness prevent silent replay.
   No provider transaction or receipt model has been added.
2. `prisma/migrations/20261016140000_phase9_payment_reference_evidence_review/migration.sql`:
   additive SQL enums, records and composite tenant foreign keys.
   A claim INSERT trigger checks current active school and
   `SCHOOL_ADMIN`, exact issued `FeeObligation`, positive claimed money
   not exceeding the debt, currency and hashed reference. A separate
   decision trigger requires an active `SCHOOL_SUPER_ADMIN` distinct
   from the original school-admin submitter, matches exactly the
   submitted reference digest, records an explicit boolean bank-funds
   attestation for VERIFIED, and rejects an aggregate of previous verified
   claims plus the proposed amount greater than the original fee debt.
   The School lock serializes concurrent claim and decision writes.
   All financial history rejects UPDATE, DELETE and TRUNCATE.
3. `src/modules/fees/payment-reference-service.ts`: strict authenticated
   `SCHOOL_ADMIN` reference claim via school-locked SERIALIZABLE
   transaction, UUID idempotency key, unique school-bound SHA-256 of
   normalized uppercase bank reference (raw reference never stored),
   client-supplied positive minor-unit string and reason, exact
   same-school obligation lookup, and immutable SUBMITTED response.
   Existing-key/same actor/payload replay returns original; changed
   payload conflicts. Owner review requires a new, authenticated,
   distinct active `SCHOOL_SUPER_ADMIN` with matching reference,
   explicit `fundsConfirmed: true` and reason for VERIFIED, or
   separate REJECTED. Decisions have immutable actor and time,
   exact one-decision-per-claim constraint, and identical same-reviewer
   replay returns the original decision (changed reviewer/payload
   is denied). No external banking connection exists.
4. Private no-store routes:
   `GET/POST /api/schools/:schoolId/payment-evidence` (School
   Administrator only their own submissions, School Super Admin only
   actual-school bounded review queue); the query shows separate
   `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED` projections
   without overwriting the original SUBMITTED claim.
   `POST /api/schools/:schoolId/payment-verifications` accepts
   only one strict reviewer outcome, with 200 for matching retry,
   201 for new decision; no unauthorized empty reads, no patch/delete.
5. `src/modules/fees/fee-configuration.integration.test.ts`: synthetic
   Better Auth sessions, separate school owner and school admin,
   foreign tenant, wrong roles, malformed/oversized amount, reused
   bank ref/request key, unchanged replay, wrong bank reference,
   no funds confirmation, manual decision replay vs changed outcome,
   immutable rows, oververified sums, direct ORM forged actors and
   default-OFF flags. **AUTHORED, NOT EXECUTED against PostgreSQL**.
6. `scripts/phase9-payment-evidence-guard.test.mjs` registered in
   `package.json` `test` and `verify:local:guards` alongside all
   prior suites. Also guards single SQL function bodies, matching
   bank-attestation constraint, no-store endpoints and explicit
   verification state projection. No existing security check removed.
7. `.env.example`: `PHASE9_FEE_WRITE_ENABLED=false` remains the
   master switch; `PHASE9_PAYMENT_EVIDENCE_ENABLED=false`
   and `PHASE9_PAYMENT_REVIEW_ENABLED=false` independently disable
   submission and review. **Never turn these on in shared/production
   environments.** Only an operator-confirmed disposable, synthetic
   database may be used for verification.

## Authorization, privacy and financial limitations

- A submitted transfer **reference** is not proof of bank funds, a file
  upload, a settled PaymentRecord or a student/guardian receipt. No
  actual payment-provider callback, private receipt download, bank
  credential, raw reference, document image or upload storage was added.
- A manual VERIFIED decision records only a School Super Admin's
  independent human bank-check attestation; the system does NOT
  independently check a bank account. The trusted settlement, allocation,
  receipt, refund and reversal requirements are still NOT implemented.
- No student/guardian route or finance data export exists; platform admins,
  teachers, students, guardians and other schools gain no finance access.
  School Admin sees only own claims and School Super Admin sees minimum
  bounded school-wide metadata. Evidence and decision histories cannot
  be silently overwritten.
- Uploaded images/PDFs remain blocked until approved tenant-private
  storage, type and size controls, malware scanning and retrieval
  authorization exist, per file security requirements.
- Future verified balances must account for corrections, refunds and
  reversals in immutable ledgers; current VERIFIED manual decisions
  must not be presented as a production-ready settled account.

## Test execution

- **5/5 PASSED:** repository-fetched source-invariant predicate checks
  executed in an isolated V8 JavaScript tool against the authored
  Phase 9 schema, SQL, service, route and synthetic integration files.
  The checks caught a duplicated/truncated SQL substitution artifact,
  which was fixed and checked again. This is a source consistency
  check, NOT a Node runner, type checker or SQL migration.
- **NOT EXECUTED:** actual Node guard CLI, `npm ci`, Prisma validation
  and generation, cumulative SQL migrations, disposable PostgreSQL,
  role/tenant real-session Vitest, SQL direct-write attacks,
  lock/unique race tests, school-deletion cascade checks, ESLint,
  format, TypeScript, application build, authenticated browser,
  privacy/accessibility review and `npm audit --audit-level=high`.
  Earlier dependency advisories remain unaccepted release blockers.
- No GitHub Actions, PR, main merge, deployment, actual payment, real
  school records, or shared database operation occurred.
- Both original worktrees `myschoolboard` and
  `myschoolboard-phase8` were untouched. Concurrent Phase 8 review
  remains independent and unaccepted.

## Documentation and engineering decisions

Updated fees module specification, requirements acceptance, traceability,
`docs/database/DATA_MODEL.md`, `docs/authorization/PERMISSIONS_MATRIX.md`,
`docs/authorization/AUTHORIZATION_RULES.md`,
`docs/requirements/CONFIGURATION_CATALOG.md`,
`docs/project/DECISION_LOG.md` (D-P9-003),
`docs/architecture/ARCHITECTURE_DECISION_RECORDS.md` (ADR-P9-003),
current status and milestone checklist. The conservative school-admin
claim / separate school-owner review permission is an explicit documented
development default, not implicit production finance authority.
No deviation from the fee requirement to maintain separate evidence and
verification, no provider choice and no security-waiver acceptance.

## Remaining roadmap work

1. Validate ALL cumulative migrations and role/tenant/race/replay behavior
   in an operator-confirmed disposable PostgreSQL environment, preserve
   the full unchanged security/CI audit gate, and repair any failures.
2. Build separately audited `PaymentRecord`/verified allocations,
   outstanding and partial balances, adjustments, refunds/reversals,
   reasoned reconciliation and verified receipts; never silently change
   original obligation or evidence.
3. Add private payment-proof file upload only after storage and malware
   protection review; defer real provider integrations and actual
   payment processing until separately authorized and independently
   accepted. Add student/guardian finance reads only with verified,
   same-school explicit child relationships.
4. End Phase 9 acceptance only after the complete functional security,
   privacy and browser acceptance suite. **FEE-REQ-001 remains partial.**
