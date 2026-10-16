# Phase 9 — Immutable Manual-Review Claim Allocation / Provisional Balance Checkpoint

**Date:** 2026-10-16  
**Repository:** `Wilberry/myschoolboard`  
**Branch:** `feature/phase9-fees-payments-foundation`  
**Prior Phase 9 checkpoint:** `26ad02bf6730d46e9d04013392d771f89fb3d8dc`  
**Scope:** D-023; FEE-REQ-001 partial, TEN-REQ-001, SEC-REQ-001, T-FEE-001 authored.  
**Status:** AUTHORING COMPLETE FOR THIS SLICE; PostgreSQL/runtime/CI ACCEPTANCE NOT EXECUTED. NOT RELEASEABLE.

## Work authored and incrementally committed

- `prisma/schema.prisma`: additive `ManualPaymentAllocation` with
  immutable exact-same-school `FeeObligation`, `PaymentEvidence` and
  `PaymentVerificationDecision` references, active allocator membership
  identity, amount/currency/reason/requestKey and database-stamped time.
  The verification model has an added school+id unique constraint for
  the composite allocation FK.
- `prisma/migrations/20261016150000_phase9_manual_claim_allocation/migration.sql`:
  additive unique indexes, composite foreign keys, School-row-locked
  before-INSERT guard, and historical update/delete/truncate denial.
  SQL checks current active School Super Admin allocator, exact
  independently verified and funds-attested original bank reference,
  original fee obligation and matching currency. The original school
  admin submitter cannot allocate. PostgreSQL copies source claim amount
  and currency and rejects cumulative allocations exceeding unchanged
  original debt. Unique same-school evidence, verification and request
  keys prevent multiple application of the same verified claim,
  including concurrent requests.
- `src/modules/fees/manual-payment-allocation-service.ts`:
  authenticated actor, current school owner lock, strictly shaped POST
  input `verificationId`/UUID `requestKey`/reason (no client money or
  payment state). Exact same-actor/same-request replay returns the
  historical allocation; changed payload or conflicting source
  cannot amend immutable entries. Serializable transaction, guarded
  retry, and decimal-string amount for HTTP output.
- `GET/POST /api/schools/:schoolId/manual-payment-allocations`:
  private no-store current active School Super Admin only, with no
  PATCH/DELETE/PUT, receipt, student/guardian permission or export.
  GET's final SQL rechecks actual actor/school on every record and
  yields at most 200 obligations with exact PostgreSQL NUMERIC-string
  `originalChargeMinor`, `independentlyReviewedMinor`,
  `manuallyAllocatedMinor`, `reviewedNotAllocatedMinor`,
  `previewRemainingMinor` and no/partial/full **MANUAL_ALLOCATION**
  statuses. No data is labeled PAID/SETTLED/official.
- `.env.example`: additional
  `PHASE9_MANUAL_ALLOCATION_ENABLED=false`; submission still requires
  separate `PHASE9_FEE_WRITE_ENABLED=true` master switch. The
  evidence/review switches remain separately default-OFF.
- `src/modules/fees/fee-configuration.integration.test.ts`:
  actual-session synthetic test scenarios authored for exact roles,
  foreign schools, rejected/unverified claims, forged client amount
  or paid status, two concurrent distinct-key allocations for the
  same verified claim, exact replay vs changed payload, forged direct
  database actors, mutation denial, current-school owner-only read,
  amount=300000 applied to original 456789 charge with preview
  remaining 156789, and master feature disable.
- `scripts/phase9-manual-allocation-guard.test.mjs` registered in
  existing `package.json` `test` and `verify:local:guards`
  without removing older suites. Guards schema, SQL authorization,
  one-time allocation, SQL money copying, owner-only no-store reader,
  preview labels and no paid/provider/receipt calls.
- Updated `docs/modules/FEES_AND_PAYMENTS.md`,
  `docs/database/DATA_MODEL.md`,
  `docs/database/CONSTRAINTS_AND_INVARIANTS.md`,
  `docs/authorization/PERMISSIONS_MATRIX.md`,
  `docs/authorization/AUTHORIZATION_RULES.md`,
  `docs/requirements/ACCEPTANCE_CRITERIA.md`,
  `docs/requirements/CONFIGURATION_CATALOG.md`,
  `docs/requirements/REQUIREMENTS_TRACEABILITY_MATRIX.md`,
  `docs/roadmap/CURRENT_STATUS.md`,
  `docs/roadmap/MILESTONE_CHECKLIST.md`,
  D-P9-004 and ADR-P9-004.

## Security interpretation and excluded capabilities

1. **SUBMITTED** evidence is not money; **VERIFIED** is a separately
   attested manual review, not real payment-provider clearance.
2. A `ManualPaymentAllocation` is a school-owner *internal*
   application of reviewed reference evidence to an existing fee.
   It does not assert a bank transfer happened, create a receipt,
   change the legal/accounting standing of a school debt, or
   publish an official student account. Even a zero preview remainder
   must be presented as `FULL_MANUAL_ALLOCATION`, **not PAID**.
3. School admin can submit reference claims, not approve or allocate;
   the current same-school School Super Admin reviews and allocates.
   Neither the wider school staff, platform admins, students, parents
   nor guardians gain access to the provisional owner-only balance
   projection. No raw transfer reference or new bank PII stored.
4. There is no final `PaymentRecord`, adjustment, waiver,
   reversal/refund, actual reconciliation, receipt, real banking
   provider callback, tenant-private proof upload or trusted student/
   guardian finance relationship reader. These require separate
   reviewed ledgers and strict acceptance, not shortcuts.
5. All three earlier Phase 9 write switches remain OFF, and the
   fourth `PHASE9_MANUAL_ALLOCATION_ENABLED` also defaults OFF.
   Do not enable in production/shared environments.

## Verification honesty and remaining exit blockers

The guard predicates can be evaluated against GitHub-fetched text
in an isolated JavaScript tool, but that is NOT a substitute for
`node --test` or actual runtime SQL. **NOT EXECUTED:** `npm ci`,
Prisma schema validation/client generation, migrations against an
operator-confirmed disposable database, current-role revocation and
tenant-deletion behavior, direct SQL attack cases, concurrent serializable
races, synthetic authenticated Vitest integration, format/lint/typecheck,
Next build/browser/privacy tests, `npm audit --audit-level=high`,
and the unchanged full CI/security gates.

Prior dependency issues remain blocking. Phase 8 is still being
verified independently and has not been presumed accepted. Neither
original worktree, `main`, GitHub Actions, deployment, real
payments nor shared databases were touched in this checkpoint.

## Next safe milestones

- Confirm a disposable PostgreSQL/Prisma environment and execute
  the cumulative Phase 6-9 migrations, synthetic finance tests and
  source guard suite; correct real failures before acceptance.
- Design **separate** reasoned append-only fee adjustments and
  reversible/refundable financial transactions (not updates to prior
  claims), real settlement mapping, bank/provider callback anti-replay,
  independent reconciliation and secure receipting. Ensure actual
  accounting currency, overpayment, term closure and credit corrections
  are verified before a payment balance can become official.
- Add guardian/student access only after exact verified same-school
  child relationship proofs and a privacy/security approval.
- FEE-REQ-001 and Phase 9 exit remain PARTIAL/UNVERIFIED.
