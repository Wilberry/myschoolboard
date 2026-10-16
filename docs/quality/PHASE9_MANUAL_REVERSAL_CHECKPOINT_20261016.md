# Phase 9 — Immutable Manual Allocation Reversal Request and Review

**Date:** 2026-10-16  
**Repository:** `Wilberry/myschoolboard`  
**Branch:** `feature/phase9-fees-payments-foundation`  
**Previous checkpoint HEAD:** `2589d7180f9dc1270a82e1206d9f8162fbfb099a`  
**Mandate/traceability:** D-023, D-P9-005, ADR-P9-005, FEE-REQ-001 PARTIAL  
**Acceptance:** **UNVERIFIED / BLOCKED**. No actual refund, bank settlement, receipt, or production enablement.

## Implemented candidates

1. `prisma/schema.prisma`: distinct
   `ManualAllocationReversalRequest` and
   `ManualAllocationReversalDecision` with new
   `ManualAllocationReversalAction` APPROVED/REJECTED enum.
   Request source is exactly one same-school manual allocation;
   one request per allocation, even if REJECTED. Decision is
   exactly one terminal outcome per request. Both have immutable
   actor/reason/timestamp evidence and school-composite references.
2. Additive migration
   `20261016160000_phase9_manual_allocation_reversal_review/migration.sql`:
   school lock serializes request and decision with existing fee/
   reference/verification/allocation writes. SQL requires current
   active School Administrator for a request, captures the original
   manual allocation full minor-unit amount/currency, prohibits
   a second request and stamps trusted UTC. Decision SQL requires
   current independent active same-school School Super Admin,
   validates exact request plus original source amount/currency
   and forbids a second terminal decision. UPDATE/DELETE/TRUNCATE
   guards preserve original request, decision, and source history.
   No UPDATE on original allocation or actual funds move.
3. `src/modules/fees/manual-allocation-reversal-service.ts`:
   Better Auth current user, explicit strict payload shapes,
   School-locked serializable transaction, School Administrator
   request, School Super Admin terminal review, UUID idempotent
   request and exact reviewer/action/reason replay. Unauthorized
   actors, unrelated tenants, changed retries, repeat requests
   and forged payload money/actor/status are blocked.
4. Private `GET/POST /api/schools/:schoolId/manual-allocation-reversals`
   with active School Administrator own-only request projection
   and bounded School Super Admin review queue; independent
   `POST /api/schools/:schoolId/manual-allocation-reversal-decisions`
   with APPROVED/REJECTED only. All no-store, no PATCH/PUT/
   DELETE, no student, guardian, teacher or platform access.
5. `src/modules/fees/manual-payment-allocation-service.ts`:
   owner-only final SQL projection updated to return exact
   PostgreSQL NUMERIC decimal strings for original charge,
   reviewed evidence, `grossManuallyAllocatedMinor`,
   `approvedReversedMinor`, NET `manuallyAllocatedMinor`,
   `reviewedNotAllocatedMinor` (only claims not already applied),
   and `previewRemainingMinor`. Only APPROVED reversal
   subtracts the original full allocation from net; REJECTED
   and pending do not. New `REVERSED_MANUAL_ALLOCATION`
   status distinguishes originally allocated but now
   preview-reversed claims from never allocated ones.
6. `.env.example`: `PHASE9_MANUAL_REVERSAL_ENABLED=false`
   independent of `PHASE9_FEE_WRITE_ENABLED=false`; older
   fee, payment review, evidence and allocation switches remain
   default OFF. **Do not activate against shared or live data.**
7. `src/modules/fees/fee-configuration.integration.test.ts`:
   authored synthetic actual-session tests for invalid roles,
   foreign allocation/tenant, forged HTTP amount, request
   idempotency and immutability, private queue, self-review
   denial, terminal replay/conflict, APPROVED original-preservation
   and effective preview remainder, rejected correction without
   net subtraction, post-reversal evidence reuse denial, and
   raw Prisma actor-forgery attempts. **Not executed.**
8. Added `scripts/phase9-manual-reversal-guard.test.mjs` to
   unchanged `package.json` `test` and `verify:local:guards`
   alongside all prior source and Vitest suites.
9. Docs updated: fee module, DB data model/constraints, roles,
   current auth rules, config catalog, acceptance criteria,
   traceability matrix, roadmap current status and checklist,
   decisions D-P9-005 and ADR-P9-005.

## Scope, safety and accounting truth

- Reversing a manual allocation is only a **preview-ledger
  correction**. It cannot authorize actual refunds, a bank
  withdrawal, cancellation of settled payment, outstanding
  balance publication or release of student/guardian receipts.
- The initial conservative policy allows only one full correction
  request per original allocation, including REJECTED. A later
  audited version/reconsideration ledger would be needed for
  partial reversal, repeated dispute or retry after rejection.
- Previous independently VERIFIED human bank attestation and
  bank reference stay recorded and unavailable for any new
  allocation because previous one-evidence/verification unique
  keys are never removed. The net preview may increase, but
  that is **not** a new unpaid bill nor externally confirmed funds.
- School Super Admin previews remain minimum-data scoped and
  privileged. Admin requesters see only their own requests,
  not all school debts. No student/guardian routes or real
  banking providers, file uploads, payment receipts or refunds.
- Security, financial invariants, exact amount/currency, actor
  school isolation and concurrent locks are AUTHORING CLAIMS,
  not proven until actual Postgres integration/race testing.

## Verification and release blockers

- **Source-only:** **9/9 Phase 9 structural source predicates
  passed** against current committed GitHub files in an isolated
  V8 tool: 3 school-fee/obligation, 2 payment evidence/review,
  2 manual allocation, and 2 manual reversal/preview checks.
  The SQL reversal file contains exactly one request and one
  decision trigger function definition. This does NOT execute
  the actual Node `node --test` command, Prisma validation,
  a real DB migration, or Vitest.
- **NOT EXECUTED:** Prisma validate/generate, cumulative Phase 6–9
  PostgreSQL migrations, synthetic authenticated Vitest and
  privileged direct-SQL/concurrent writes, role revocation,
  tenant cascade deletion tests, TypeScript/format/lint/build,
  browser privacy review, `npm audit --audit-level=high`,
  CI, and production-bank reconciliation.
- Original `main` checkout and Phase 8 verification worktree
  remain untouched. No GitHub Actions, PR, merge, deployment,
  real money, real school record, shared/production database
  operation or actual payment provider integration performed.
- Phase 8 remains independent and unaccepted. Phase 9 exit
  FEE-REQ-001 remains partial and cannot be accepted merely
  from static source guard predicates.

## Next authorized roadmap work

Cumulative disposable-PostgreSQL validation is the immediate
financial-security gate. Afterward, design separate auditable
fee adjustments/waivers, true settlement and bank reconciliation,
reversal/refund transaction events, provider callback anti-replay,
verified receipts and relationship-scoped student/guardian finance
access. Do not conflate a human bank-reference attestation or
approved preview correction with bank settlement.
