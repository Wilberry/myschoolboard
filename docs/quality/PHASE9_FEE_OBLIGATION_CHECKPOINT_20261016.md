# Phase 9 — Immutable Student Fee Obligation Foundation Checkpoint

**Date:** 2026-10-16  
**Branch:** `feature/phase9-fees-payments-foundation`  
**Committed base:** `18d8b8292fc37e3f131986fe6d8ab9c3038ad2e0` (cumulative Phase 7)  
**Project mandate:** D-023  
**Requirements:** FEE-REQ-001 (partial), TEN-REQ-001 and SEC-REQ-001 scoped controls (authored only)  
**Status:** AUTHORED, **NOT DATABASE / CI VERIFIED**; **exit gate BLOCKED**.

## Independent work and sequence

This branch was created directly from the committed, cumulative Phase 7
head via GitHub repository tools. It does **not** contain uncommitted
changes from `verify/phase8-local`; neither that worktree nor the
original local Phase 1 worktree was touched. No changes were merged to
`main`, no GitHub Actions were dispatched, no draft PR was opened and
nothing was deployed. Phase 8 is not accepted or deployed.

Milestone A (see the preceding fee-configuration checkpoint): explicit
immutable school fee categories and reasoned, versioned school,
section or class fee-structure revisions for a chosen period, currency
and positive minor-unit amount. These are policy, **not debt**.

Milestone B (this checkpoint): explicit, immutable **student obligation**
records referencing exactly one school-owned fee-policy revision and
one ENROLLED pupil's exact ACTIVE class/session enrollment, without
creating any payment or assuming a transfer was received.

## Authored code and migrations

- `prisma/schema.prisma`: `FeeObligation` with immutable
  school/student/enrollment/class/session/term/category/policy version,
  minor-unit BigInt price and three-letter currency, original issuer,
  reason, issued timestamp and school-scoped idempotency key.
- `prisma/migrations/20261016130000_phase9_fee_obligation_ledger/migration.sql`:
  additive table/indexes/composite school FKs to student, active enrollment
  identity and pinned fee-policy identity. Unique school + requestKey and
  pupil/category/session/term issuance constraints. PostgreSQL BEFORE
  INSERT rechecks active school, actual same-school School Super Admin,
  current ENROLLED student/ACTIVE enrollment, active section/class,
  nonclosed academic session/term and current revision scope; an active
  school row lock serializes issuance with policy changes. PostgreSQL
  overwrites any untrusted pupil/class/period/category/amount/currency/
  issue time fields with the trusted source data. UPDATE, DELETE, TRUNCATE
  are guarded by existing immutable-event SQL helpers.
- `src/modules/fees/fee-obligation-service.ts`: authenticates from the
  current Better Auth session, requires same-school active super admin,
  strict caller schema limited to enrollmentId/revisionId/UUID requestKey/
  reason, serializable transaction, same-key/same-payload idempotent
  replay, changed-payload conflict, immutable debt insert; monetary
  values returned as decimal strings. A bounded owner-only metadata
  reader repeats current same-school membership in the final SQL query
  and explicitly denies an unauthorized caller even if no rows exist.
- `app/api/schools/[schoolId]/fee-obligations/route.ts`: private
  `Cache-Control: private, no-store` GET/POST, 201 for new obligation,
  200 for matching exact replay, 404 for concealed wrong role/tenant;
  no PATCH/PUT/DELETE, no student/guardian access or receipt.
- `src/modules/fees/fee-configuration-service.ts` and `.env.example`:
  all Phase 9 finance writes are disabled by default behind
  `PHASE9_FEE_WRITE_ENABLED=false`, including categories, fee-policy
  revisions and explicit student-debt issue. This is a development
  safety switch, not production authorization.
- `src/modules/fees/fee-configuration.integration.test.ts`: synthetic
  authenticated school owner, ordinary school admin, teacher, foreign
  school owner, academic structure, enrolled pupil, policy revisions,
  duplicate/changed replay, forged actor/money, immutable UPDATE/DELETE,
  current policy scope and closed term; feature flag explicitly enabled
  **only inside test code**. Authored, **NOT EXECUTED**.
- `scripts/phase9-fee-configuration-guard.test.mjs`: three source
  invariants verifying composite tenant links, explicit revision/pupil
  identity, no payment/receipt models, SQL history guards, default-off
  behavior, no-store route controls and concealment of unauthorized
  empty finance lists. Registered in existing `npm test` and
  `verify:local:guards`, without removing prior tests.

## Authorization and financial integrity

The current development contract reserves school fee definition
and charge issuance for active same-school School Super Admin; no
delegated school bursar/finance verifier role or external platform
operator automatically gains access. `ISSUED_UNPAID` means **an issued
charge, not an outstanding verified balance, reconciliation, receipt or
proof that funds were received**. No automatic roster charging,
discount, adjustment, fee waiver, refund, reversal, upload or provider
callback is introduced. Later financial evidence and verifier actions
must be separate append-only ledgers with distinct statuses and
authorization, idempotency and privacy gates.

## Actual verification results

- **PASSED:** three committed source-invariant predicates were evaluated
  over the actual GitHub-fetched Phase 9 source texts in an isolated
  JavaScript V8 executor; this is not a Node test run, compiled TS or
  executed SQL.
- **NOT EXECUTED:** actual `node --test`, Vitest or authenticated
  integration tests, Prisma validate/generate, SQL migration/deploy or
  drift checks, PostgreSQL direct statement / race / cascade tests,
  format, lint, typecheck, Next build, browser/UX/privacy and
  `npm audit --audit-level=high`. GitHub Actions were not run.
- **Blocker:** no independently confirmed disposable PostgreSQL and
  local project runtime is available to the GitHub-only development
  tool session. Existing upstream dependency-security findings remain
  release blockers; they were neither bypassed nor accepted.
- **Required before enabling:** verify custom SQL trigger syntax and
  immutability under current migrations, school deletion cascades,
  exact FK school target, deterministic request replay and racing
  issue/version changes, all synthetic session authorization checks,
  unresolved earlier phases, strict full audit and browser checks.

## Documentation / deviations

Updated: `docs/modules/FEES_AND_PAYMENTS.md`,
`docs/database/DATA_MODEL.md`,
`docs/requirements/REQUIREMENTS_TRACEABILITY_MATRIX.md`,
`docs/requirements/CONFIGURATION_CATALOG.md`,
`docs/project/DECISION_LOG.md` (D-P9-001, D-P9-002),
`docs/architecture/ARCHITECTURE_DECISION_RECORDS.md`
(ADR-P9-001, ADR-P9-002), `docs/roadmap/CURRENT_STATUS.md`,
`docs/roadmap/MILESTONE_CHECKLIST.md` and the previous fee-config
checkpoint. No material deviation from Phase 9 scope. The first
School Super Admin-only role, zero implicit fee policy, upper minor-unit
limit, latest-revision issue rule, unique pupil/category/term debt and
default-off behavior are conservative engineering defaults pending
full school/finance acceptance.

## Remaining Phase 9 roadmap work

Next implement distinct tenant-bound **PaymentEvidence** submissions
(proof never equals verified funds) and independently authorized
**PaymentRecord / verification decisions** using append-only evidence,
unique idempotency/source keys, explicit Submitted/Pending verification/
Verified/Rejected/Refunded/Reversed states. Then audited adjustments,
reversals, verified receipts, payment-to-obligation allocation and
reconciliation, precisely computed debt balances and verified
guardian/student views. Live payment providers and real money remain
out of scope until separate business/security/production authorization.
Do not enable `PHASE9_FEE_WRITE_ENABLED` outside approved isolated
synthetic testing. **FEE-REQ-001 and Phase 9 exit remain BLOCKED.**
