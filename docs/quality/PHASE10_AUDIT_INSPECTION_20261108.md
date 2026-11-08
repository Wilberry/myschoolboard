# Phase 10 registered school audit inspection

P10-07 partial implementation, AUD-REQ-001 / SEC-REQ-001, under D-023.
Base learning checkpoint: `7ddcc5b0e662026af142d9ab25008a95224d77ba`.

## Scope and privacy

`PHASE10_AUDIT_ENABLED=false` defaults off. The school owner can inspect a bounded
registry of 33 existing school ledgers through a private API and accessible UI.
Every query repeats current active same-school owner authorization. School
administrators, ordinary staff, reviewers, pupils, guardians and foreign-school
owners receive concealed denials. Platform role alone confers no school access.

Only source type, source ID, exact recorded timestamp, action and recorded actor
reference are selected. Explicit static column mappings avoid selecting JSON
bodies, grades, pupil work, financial details, credential material or reasons.
Actor absence is shown honestly, including automated asset inspection. No guessed
identity or backfilled authentication actor is introduced. Sources retain their
original immutable guards and database history; this reader edits no ledger.

School predicates occur inside every registered source query. Page size is 100,
with at most 101 candidate rows per source. Exact six-digit timestamp cursors retain
PostgreSQL microsecond precision; source/ID tie-breakers prevent overlap or gaps
from JavaScript date rounding. Only code-owned table/column identifiers enter SQL;
source filters and cursor schemas reject arbitrary table names and malformed input.
Private/no-store responses and lifecycle/sign-out concealment protect the UI.

The registry spans assignment/configuration/lifecycle, student, attendance, lesson,
assessment review/publication, results, report publication/acknowledgment, payment
decisions/receipts, notices/classes, catalog/rights/inspection and learning history.
This is an evidence index, not broader authorization to open original sources.
It is not a complete security audit pipeline: BetterAuth failures/login/logout,
session changes and all permission mutations still need explicit P10-07 adapters.
No Phase 11 history is assumed present and no historical notification is backfilled.

## Verification and outstanding work

Three new authenticated PostgreSQL scenarios cover metadata-only projection and
foreign/role denial, >100-policy pagination with exact cursors and filter mismatch,
and actual terminal owner demotion immediately denying access. All fourteen tests
in the shared learning fixture suite pass. Existing tests remain intact.

The final cumulative and optional audit browser outcomes are recorded below after
execution. This slice adds no migration or dependency. Existing source event/outbox
adapters, time-driven subscription boundaries, source-authorized notification
delivery and full P10-08 acceptance remain outstanding. Do not mark AUD-REQ-001 or
Phase 10 complete from audit inspection alone.

## Executed verification

Final cumulative run: **207 Node guards and 485 Vitest tests across 54 files pass**,
with exact 73-migration checksums, formatting, lint, TypeScript and production
build. The five learning Chromium workflows passed again; the additional audit
workflow passed actual owner UI/API access, minimal projection, foreign/staff/
pupil/guardian denial, WCAG A/AA axe checks, cross-tab sign-out concealment and
subsequent unauthenticated API 401. Adjacent JSON records all six actual outcomes.
No database reset, migration change, dependency change, main merge, provider send,
GitHub Actions run or production deployment occurred.
