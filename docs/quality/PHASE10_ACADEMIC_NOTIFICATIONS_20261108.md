# Phase 10 academic notification checkpoint — 8 November 2026

P10-07 partial; COM-REQ-001, AUD-REQ-001 and SEC-REQ-001. Base commit
`26a8fb3af7667941eea8ddd6b162d232a8c96be9`; existing Phase 10 branch / draft PR #111.

## Implementation and authorization

Seven additional source-owned contracts cover attendance submission/outcomes,
attendance correction requests/decisions, lesson review/release and result-sheet
review. Review work resolves the current verified section authority; outcomes
resolve the actual original teacher or Form Teacher with current exact duties.
Released lessons resolve current explicitly verified enrolled pupils. Guardian
report/financial permissions never grant lesson access. No marks, pupil names,
lesson bodies or review reasons enter notification projections. Local deep links
lead to existing source readers and their independent authorization checks.

The academic capability defaults off (`PHASE10_ACADEMIC_NOTIFICATIONS_ENABLED`).
The disposable worker enables it only after the existing database attestation.
Correction requests/decisions now join transactional immutable source capture:
38 captured source tables and 18 explicit module-recipient contracts. Unsupported
contracts stay pending. Bounded atomic delivery uses one ordered INSERT/SELECT
per recipient page, retaining recipient locks, deduplication and cursor atomicity.
No external provider is enabled.

## Additive database change

`20261108025000_phase10_academic_notifications` adds exact academic predicates,
correction capture and terminal suppression hooks; preserves prior learning,
resource, report and financial predicates. All earlier migration bytes are
unchanged. Adjacent migration manifest records the SHA-256 and inventory 77.
The retained disposable database upgraded forward without a reset. A separate
new nonce/physical-identity-verified PostgreSQL 17 tmpfs instance bootstrapped
all 77 migrations and verified their exact applied checksums.

## Executed verification

- Targeted attendance, lesson and learning suites: **44 passed**; lint and
  TypeScript passed before execution.
- Cumulative Node guards: **207 passed**. Vitest: **493 passed in 54 files**,
  including result-review source assertions and real recipient-revocation race.
- Applied migration checksum verification: **77 exact matches** on retained
  upgrade and independent fresh bootstrap.
- Formatting and production build passed. Migration 77 changes SQL predicates
  only; schema/client remain as previously validated with pinned Prisma JS/WASM.

Three real authenticated Chromium workflows passed: exact teacher submission,
independent review/release and current pupil delivery; actual unified-inbox
read action and explicit source-authorized lesson opening; withdrawal removing
both lesson and notification without redelivery. Guardian and foreign-school
lesson reads deny. Adjacent results JSON records actual outcomes. These checks
use authenticated browser-context APIs for source setup and actual UI for inbox
read/deep-link/lesson opening; they do not assert attendance/result browser or
persisted BFCache acceptance.
Initial attempts failed because the earlier virtual display had exited, then
because the new harness incorrectly expected 201 for existing lesson submit and
review HTTP 200 responses, and 200 for immutable read-interaction HTTP 201.
Assertions were corrected to the established API contracts. The lesson UI
selector was also corrected to open the list item before checking its heading. No source behavior,
security assertion, prior event, fixture identity or migration was reset to pass.

## Remaining work and exit gate

This checkpoint does not close whole-phase acceptance. Lifecycle/subscription
boundary handling, comprehensive permission/authentication security audit and
notifications, remaining worker failure/recovery/load evidence, academic
attendance/result browser workflows and cumulative P10-08 acceptance remain open.
Phase 11 contracts remain separate; no fabricated trash source is emitted.
Production storage/inspection/retention and release gates still apply. Standard
Prisma binary downloads and GitHub API access remain subject to the environment's
restricted network policy; no API PR-description update is claimed.

Exit gate: **PARTIAL**. No main merge, deployment, database reset, migration
rewrite, force push, GitHub Actions or external messaging occurred.
