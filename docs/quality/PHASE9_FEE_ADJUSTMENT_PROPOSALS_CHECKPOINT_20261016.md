# Phase 9 — Fee Adjustment and Waiver Advisory Governance Checkpoint

**Date:** 2026-10-16  
**Repository:** `Wilberry/myschoolboard`  
**Branch:** `feature/phase9-fees-payments-foundation`  
**Previous checkpoint:** `44e8599246fccbad523e975837242854ddc82799`  
**Mandate:** D-023, D-P9-006, ADR-P9-006, FEE-REQ-001 PARTIAL  
**Status:** AUTHORING ONLY; DATABASE/RUNTIME/SECURITY ACCEPTANCE BLOCKED.

## Authored development

- `prisma/schema.prisma`: `FeeAdjustmentKind`,
  `FeeAdjustmentDecisionAction`, tenant-bound immutable
  `FeeAdjustmentProposal` and `FeeAdjustmentDecision`. Proposal
  snapshots original fee obligation, school, requesting School Admin,
  WAIVER/CORRECTION_PROPOSAL, bounded minor units, currency, reason,
  UUID request key and time. Review is a separate terminal
  School Super Admin APPROVED/REJECTED decision with actor, reason
  and timestamp.
- Additive migration
  `20261016230000_phase9_fee_adjustment_proposals/migration.sql`:
  composite same-school foreign keys, uniqueness, nonmutating
  audit triggers, School lock and source fee/amount/currency
  validation, exact active SCHOOL_ADMIN proposer and independent
  active SCHOOL_SUPER_ADMIN reviewer. No adjustment application.
- `src/modules/fees/fee-adjustment-proposal-service.ts`:
  actual Better Auth identity, strict Zod input, school-locked
  Serializable transactions, school-only bounded owner/admin
  reader, exact same-actor idempotency replay, changed replay
  conflict, independent terminal review. Client cannot set
  currency, actor, account paid status or receipt.
- Private no-store
  `GET/POST /api/schools/:schoolId/fee-adjustment-proposals`
  and separate
  `POST /api/schools/:schoolId/fee-adjustment-decisions`.
  School Administrator sees own proposals; owner sees bounded
  school queue. No PATCH/PUT/DELETE or family financial data.
- `PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED=false` newly
  default-OFF; also requires existing
  `PHASE9_FEE_WRITE_ENABLED=true`. Other fee/payment switches
  remain default OFF.
- Synthetic authenticated role/tenant/amount/idempotency, forged
  SQL actor, immutable proposal/decision and original fee/preview
  nonmutating cases authored in existing Phase 9 integration test.
  New source guard is registered in existing npm test/local guard
  commands; prior checks remain.
- Docs: fee specification, school permissions, rules, data model,
  roadmap/checklist, configuration catalog, acceptance, D-P9-006
  and ADR-P9-006.

## Accounting and security boundary

An APPROVED proposal is explicitly **NOT AN EFFECTIVE WAIVER**.
It never changes the immutable original pupil fee, verified
payment evidence, manually allocated preview, settlement,
refund, official balance or receipt. The proposal amount is
advisory governance evidence only. A separate and independently
verified effective accounting adjustment ledger must be designed
before changing any payable amount, with concurrency and
overcredit protection. Parent/student/guardian access and actual
payment provider banking workflows remain out of scope.

## Verification status

- **2/2 source-only checks PASSED**, evaluated in isolated V8
  against committed GitHub schema, migration, route, service,
  test and feature flag files. No SQL migration executed.
- **NOT RUN:** npm ci, Prisma validate/generate, cumulative
  migration against disposable PostgreSQL, Node test command,
  synthetic authenticated Vitest, direct SQL actor/concurrency
  tests, role revocation, tenant deletion, TS/lint/format/build,
  browser/privacy, strict dependency audit, CI, production
  financial reconciliation.
- No changes to main or Phase 8 verification worktree; no GitHub
  Actions, shared DB, deployment, PR or real payment.
- Phase 8 remains independently unaccepted. Phase 9 FEE-REQ-001
  also remains PARTIAL/UNVERIFIED.

## Next safe development

Validate the full cumulative SQL and TypeScript/Prisma/runtime
stack in a confirmed disposable environment, resolve dependency
security issues, and only then build an effective append-only
adjustment ledger with net charge and over-credit invariants.
Real settlement, refunds, provider anti-replay, secured receipts
and verified student/guardian finance access remain future
separately accepted milestones.
