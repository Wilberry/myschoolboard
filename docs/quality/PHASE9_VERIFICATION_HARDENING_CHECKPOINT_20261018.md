# Phase 9 — Disposable-Database Verification Safety Checkpoint

**Date:** 2026-10-18  
**Repository:** `Wilberry/myschoolboard`  
**Branch:** `feature/phase9-fees-payments-foundation`  
**Starting checkpoint commit:** `87f47973171029ea7cb97449b87f5bbc66d2bc76`  
**Mandate:** D-023 / D-P9-008 / ADR-P9-008  
**Exit status:** NO RUNTIME ACCEPTANCE. FEE-REQ-001 AND PHASE 9 REMAIN BLOCKED.

## Finding and practical fix

The existing `scripts/verify-local.mjs` correctly checks local
test flags, matching `DATABASE_URL` and `TEST_DATABASE_URL`,
`localhost:5434/myschoolboard_test`, synthetic seed credentials,
test Better Auth origin and the exact project CI command order.

**Gap:** the connection string alone cannot distinguish a physically
disposable PostgreSQL instance from a forwarded port connecting to
a shared or live database. Since cumulative local verification
runs migrations AND demo seed, the gap warrants a separate
fail-closed live-DB identity check.

Implemented `scripts/verify-phase9-disposable.mjs` as an optional
stronger Phase 9-only wrapper rather than weakening or replacing
the existing project runner. Before launching any npm command it:
- Executes the existing `assertLocalVerificationTarget`.
- Requires `PHASE9_TEST_DATABASE_NONCE`: 32–128 lowercase hex
  characters generated privately by the operator.
- Rejects all seven true finance-write switches.
- Refuses extra PostgreSQL URI query options (only
  `?schema=public` allowed), URL fragments and absent URI
  credentials. Sanitizes Prisma's URL before use by psql.
- Clears inherited PG* libpq environment overrides, passes
  credential-bearing URI ONLY in child environment and runs
  `psql -X -w -q -t -A` without a shell.
- Sets `default_transaction_read_only=on` and a 5-second
  statement limit. Its **single read-only SELECT** fetches the
  `phase9-local` nonce from
  `public.myschoolboard_disposable_verification_marker`, and
  checks the physical target's `current_database()` equals
  `myschoolboard_test`.
- Rejects a missing marker, wrong nonce, psql absence/error,
  timeout, signal, unsafe URI or enabled finance flags before
  any migration/seed. It never creates the marker or a DB.
- On successful attestation, calls unchanged
  `npm run verify:local`, which still runs npm install/Prisma/
  migrations/demo seed/format/lint/typecheck/Node + Vitest/build/
  `npm audit --audit-level=high` in exact existing order.

Mocked zero-DB Node tests added in
`scripts/verify-phase9-disposable.test.mjs` for URL/nonce
rejections, environment spoofing, fail-closed psql behavior,
read-only argv/env and no-npm-before-attestation ordering.
A separate `phase9-verification-guard.test.mjs` captures
source-level safety and preservation of CI gate order.
Both registered in existing `package.json` `test`
and `verify:local:guards` without removing prior tests.
Three dedicated scripts added: `verify:phase9:static`,
`verify:phase9:preflight`, `verify:phase9:local`.

Detailed operator-safe instructions and attestation SQL are in
`docs/quality/PHASE9_DISPOSABLE_DATABASE_VERIFICATION_RUNBOOK.md`.
The marker MUST be created manually ONLY on an independently
identified, physical disposable DB; copying it from a shared
DB or trusting loopback alone would defeat the protection.
No nonce is committed in `.env.example`; it contains only
an explicit commented placeholder.

## Evidence, precisely scoped

**Completed here:**
- Inspected the actual remote project runner, its tests,
  existing seed-target guard, Phase 9 source code and
  verification scripts at the current isolated feature ref.
- Confirmed current container has Node, but no project checkout
  or PostgreSQL/psql executable and cannot connect to GitHub
  by git transport. Did NOT run any database command.
- Evaluated **2/2** structural source guard predicates from
  `phase9-verification-guard.test.mjs` against fetched remote
  files in an isolated JavaScript environment.
- Authored more extensive `node:test` fake-spawn unit cases,
  but **these were NOT executed through Node in the repo**.
- Committed a fail-closed Phase 9-only verification wrapper,
  tests, package commands, operator runbook, roadmap and
  decision/architecture documentation.

**Still NOT EXECUTED or ACCEPTED:**
- The wrapper's actual psql attestation against a physically
  disposable test DB; repository Node tests; Prisma validation,
  client generation and cumulative SQL migrations.
- Real synthetic authenticated Vitest and direct SQL actor,
  concurrency/overcredit/tenant lifecycle tests.
- Format, lint, TS, Next build, browser privacy, high-severity
  dependency audit, real-money settlement and receipts.
- No CI, GitHub Actions, PR merge, shared DB, production
  payment, original worktree or Phase 8 verification changes.

## Next milestone

On a separately operator-confirmed disposable PostgreSQL instance,
create the marker as documented and run the read-only preflight,
then the real cumulative verification chain, collecting concrete
pass/fail evidence. Fix actual migration, schema and security
failures before adding payment settlement/provider callbacks,
official balances, student/guardian finance views or receipts.
No Phase 9 or Phase 8 production acceptance is implied.
