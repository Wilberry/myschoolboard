# Phase 10 report/financial notifications and unified inbox checkpoint

P10-07 partial / P10-08 portal subset, COM/LIB/AUD/SEC requirements, D-023.
Base: `e70bc57b1aab5ef92b67af8e0f114cf9efa0b577`, existing Phase 10 branch/PR #111.

## Implemented and privacy boundaries

Six additional source contracts cover report publication, actual guardian report
acknowledgment, fee-account publication, issued receipts, pending payment evidence
and independent bank-review decisions. They use the accepted source predicates,
including current verified relationships, enrollment, active academic context,
independent financial visibility and report correction/supersession rules.
Report notification access also matches the original reader's active subject and
no older-publication fallback. A new publication never reuses an old acknowledgment.

PARENT_FIRST publication produces no initial pupil delivery, even if dispatch is
delayed until after acknowledgment. The real acknowledgment source produces a
separate pupil availability event for that exact pupil/publication/relationship;
it is not a resurrected original delivery. Current school owners receive only
authorized acknowledgment workflow metadata. Reading an alert cannot acknowledge
the report. Guardian and pupil report readers remain the original source of truth.

Financial recipients require the current fee-account publication predicate.
Receipt availability is distinct from a submitted reference claim, verification
and allocation; notifications never assert bank settlement or expose amounts,
references, pupil names or financial details. Pending evidence alerts only an
independent current school owner; decisions alert the current original authorized
submitter. These operational alerts confer no recipient account access. Account
withdrawal and relationship revocation terminally suppress prior disclosure.
Fee/report access grants no library, class-task or official-notice permission.

`PHASE10_REPORT_NOTIFICATIONS_ENABLED` and
`PHASE10_FINANCIAL_NOTIFICATIONS_ENABLED` default off. Existing finance source
capability gates must also be enabled. The disposable local worker enables its
required source capability switches only after nonce attestation; its imported
services perform delivery rather than financial source mutations. The application
server has its own explicit configuration and authorization.

The new private school inbox presents separate official-notice, class and workflow
regions using their own current APIs. Guardian pages do not render the class
region. Existing per-channel interfaces remain available. Source-owned deep links
open the existing authorized report, finance or recipient-account reader.

## Additive migration and revocation race hardening

`20261108024000_phase10_report_financial_inapp` adds the six explicit source
contracts and their tenant-local suppression hooks. All earlier applied migrations
remain unchanged. The inventory is **76**.

Notice, class and module delivery validation now hold a shared lock on the recipient
membership while checking it and inserting the delivery. A revocation cannot slip
between eligibility and insertion to leave a delivery outside terminal suppression.
The new test holds an actual uncommitted pupil revocation, observes PostgreSQL
blocking the worker on that transaction, commits revocation, and verifies no delivery
was created for the revoked pupil. Transaction/permission guards remain enabled.

## Executed verification

- Cumulative sequential run: **207 Node guards, 492 Vitest tests in 54 files**, and
  exact **76 applied migration checksums** passed.
- Targeted learning/source, report and financial suites: **53 tests passed**,
  including the forced real revocation race and actual parent-first unlock.
- The report/financial fixture suites were subsequently rerun: **33 passed**,
  including an additional positive fee-access/negative library-access intersection
  assertion. The unrelated guardian is denied the workflow inbox rather than given
  a misleading empty authorized result.
- Formatting, ESLint, TypeScript and production build passed. Schema models are
  unchanged from the pinned official Prisma JS/WASM generation at migration 75;
  migration 76 adds SQL predicates/triggers only. A newly independently verified
  PostgreSQL 17 tmpfs database bootstrapped all 76 migrations.
- **Three real authenticated Chromium family workflows passed**: parent-first
  notification/read/explicit acknowledgment/pupil unlock; native guardian tab and
  history with 375/768/1280 WCAG A/AA axe checks and report withdrawal; pending
  reference evidence, independent review, guardian-only account/receipt access,
  unrelated/foreign denial, real inbox/deep-link UI and financial withdrawal.
  Source setup uses authenticated browser-context API requests; inbox/read and
  report acknowledgment use actual UI. Adjacent JSON records the outcomes.

The initial family harness expected HTTP 200 for report withdrawal. The server
correctly returned 201 for a newly appended immutable event. That failed run was
retained; the corrected assertion and fresh fixtures passed. No prior withdrawal,
revoked relationship or database was reset. Browser staging always creates new
verified relationships where needed. No persisted BFCache assertion is made.

## Remaining work / gate

P10-07 attendance, lessons, result-review, lifecycle/subscription expiry, complete
permission/security/authentication audit and their notification contracts remain
outstanding. Eleven source contracts are now implemented; capture from the other
registered source tables remains pending delivery rather than silently complete.
New-channel retry/replay/failure/load/paging/recovery and full cumulative browser,
privacy and operational evidence remain P10-08 gates. Phase 11 is still separate.
Production storage/scanner/retention, security and release gates remain open.

Whole Phase 10 is **PARTIAL**, not ready for main integration. No main merge,
production deployment, external provider, database reset, migration rewrite,
force push or GitHub Actions invocation occurred.
