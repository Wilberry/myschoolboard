# Phase 10 notice acceptance and class announcement checkpoint

COM-REQ-001 / AUD-REQ-001; D-023. Date: 7 November 2026 (Africa/Lagos).
Branch: `feature/phase10-school-notices-inapp-notifications-20261106`, draft PR #111.
Original accepted main remains `d4459d827e8529ea8daddb73f7e842d8c47c12ab`.
This extends preserved implementation `77de805`; it neither rebuilds that slice
nor imports independent Phase 11/12 changes. Phase 10 as a whole remains partial.

## Delivered and executed

P10-01/P10-02 now have actual authenticated native Chromium evidence, not only
API/SQL tests. Twelve scenarios passed against the production build: administrator
authoring; independent owner return/revision/review/publication; administrator
approval/publication denials; all four explicitly versioned audiences; verified
student/guardian readers; foreign-school denials; deduplicated delivery and explicit
read/unread; dead-letter replay after five recorded failures; native Back/Forward,
hidden-tab conceal/recheck and deliberately delayed responses; keyboard, three
viewport widths and axe WCAG A/AA; withdrawal; terminal membership and enrollment
changes; actual cross-tab sign-out; private HTML and native PDF concealment and
fresh-checked explicit printing. No browser automation focus emulation was accepted
as native concealment evidence. See the [12-check result](PHASE10_NOTICE_BROWSER_RESULTS_20261107.json).

Ordinary PDF initiation contained no notice title; the explicit print action
rechecked access and its captured Chromium PDF contained the authorized title.
Its window.print call was intercepted only by the harness to capture native PDF
output. Raw PDFs, fixture identities/passwords/cookies and browser profiles remain
private outside Git. Genuine persisted BFCache was not asserted. Exported bytes
or printed paper cannot be revoked retrospectively.

P10-03 now implements a **separate class channel**: exact active subject assignment
or actual Form Teacher responsibility; immutable revisions; current independently
verified PRIMARY Head of Section / SECONDARY Principal review; original author
release; explicit owner moderation/author withdrawal; exact enrolled verified
pupil reader. Parents have no class feed, draft, count, inbox, read-state or
publication grant. Official-notice and financial/report visibility grants are not
used to authorize class content. Revoked author/reviewer/school/class/period/pupil
authority fails closed; preserved source history grants no continuing access.

Class notifications have transactional source-event capture, bounded 100-member
pages, unique source/recipient deliveries, keyset inbox pages of 50, explicit
immutable read/unread, terminal suppression, immutable attempts, five failures,
30-second retries, dead letters and reasoned idempotent owner replay. The local
worker revalidates its real operator session every loop and current owner per
transaction; no anonymous cron or user-ID impersonation endpoint was added.
Class pages use short database row-lock transactions with SKIP LOCKED, not a
long-lived external-I/O lease: crash rolls back cursor, deliveries and attempt
atomically. No asset/provider I/O occurs inside that transaction. Delivery retries
do not change academic publication or reinstate suppressed notifications.

A separate accessible staff/reviewer/pupil workspace, owner metadata-only
moderation/retry controls, private class inbox and reauthorized release links are
implemented. All sensitive routes/segments are no-store, with the established
abort/epoch/lifecycle/sign-out/foreground/print guards. School navigation links
point to the two separate channels. Six authenticated Chromium class scenarios
passed: author/review/release; guardian and foreign-school denials; deduplicated
class inbox/read/deep link; Back/Forward, native focus, responsive/axe; actual Form
Teacher workflow; and withdrawal. See the [class result](PHASE10_CLASS_BROWSER_RESULTS_20261107.json).
Class-specific native terminal-revocation, delayed-I/O/print and broad load evidence
still need expansion for P10-08; shared-hook notice coverage is not a claim that
every class-browser scenario ran.

## Schema and validation boundary

Four additive forward-only class migrations follow the existing 62:

- `20261107230000_phase10_class_announcements`
- `20261107231000_phase10_class_inapp`
- `20261107232000_phase10_class_delivery_integrity`
- `20261107233000_phase10_class_replay`

Existing applied migrations were not rewritten. Eight new models and current
SQL predicates/immutable history/source guards are introduced. School-composite
FKs are deferred to commit for existing explicit whole-school cleanup, without
allowing a dangling cross-school reference to commit. Suppression operates on the
changed tenant with indexed lookups. A separate forward migration supplies
source-kind validation, composite suppression uniqueness and interaction indexes.
The next adds audited replay request keys; source history is never overwritten.

The cumulative SQL shape guard now handles declared SQL-expression functions and
valid volatility/language placement, while preserving paired body counts and
single PL/pgSQL DECLARE/BEGIN checks. This is the previously tested guard correction
from the independent lifecycle branch, not a Phase 11 feature integration.

Database writes used physically inspected, task-owned tmpfs PostgreSQL and live
nonce checks, never the existing development database. Upgrade source:
`5d86ae08e403eb06d16cc5e1719e5b1e55ebf6c8fa855ff0f10fb7642664ce78`.
A separate empty server bootstrapped all 66 migrations and passed 66 exact applied
checksums. Prior stopped databases were left untouched. Tests never reset a DB.

Actual completed checks before the final verification addendum: 207 guards and
446 Vitest tests in 51 files; then the extended 10-test class suite and 15-test
notice fixture suite passed separately. Production build, lint and typecheck
passed after correcting route context typing. Official pinned Prisma JS/WASM
schema validation/client generation passed. Standard `prisma validate` remains
BLOCKED by proxy 403 fetching its schema-engine checksum from binaries.prisma.sh;
no checksum-ignore or TLS bypass was used. Strict full dependency audit passed,
zero vulnerabilities. Final cumulative counts are recorded below only after exit.

Initial harness failures (response bodies discarded by refresh, navigation races,
forced-focus contexts and overlapping display/test runs) were resolved. An initial
new class migration attempt rolled back before recording because an authority FK
needed its existing full composite key; the corrected migration was then applied
once. No applied checksum was edited. Incorrect new fixture fields and TypeScript
route contexts were corrected without weakening production constraints or tests.

## Remaining work and exit gates

P10-01/P10-02: implemented with executed local SQL/authenticated/browser evidence;
production scheduler/provider activation and P10-08 cumulative release gates remain.
P10-03: implemented and locally exercised; additional class stress/revocation
browser contracts remain tracked. P10-04/P10-05 (catalog, independent rights,
quarantine, inspection and authorized assets), P10-06 (learning assignments and
permitted submissions), P10-07 (existing-module event adapters/audit inspection)
and full P10-08 are **not complete**. No copyrighted file is ingested or exposed.
Email, SMS, WhatsApp and external push remain disabled. No production-ready or
whole-Phase-10 acceptance claim, main merge, deployment, Actions or force-push.

GitHub API probe still failed CONNECT with proxy 403. Normal branch publication
can update PR #111's source diff; editing its description via API remains blocked.
No assertion that its description, labels or review state was changed is made.

## Final verification addendum for this implementation checkpoint

- Node guards: **207 passed**, zero failures/skips.
- Vitest: **447 passed in 51 files**, zero failures/skips. This includes the
  10-test class suite (fixture staging is opt-in) and existing 15 notice scenarios.
- Authenticated Chromium: **12 notice checks + 6 class checks passed**.
- Formatting / ESLint / TypeScript / production build: **PASS**.
- Independent fresh SQL bootstrap: **66 forward migrations PASS**; exact applied
  checksums on both the upgraded source and fresh target: **66/66 PASS**.
- Official pinned Prisma JS/WASM schema validation and generation: **PASS**;
  standard Rust CLI validate: **BLOCKED**, proxy 403, not passed or bypassed.
- Full strict dependency audit: **PASS**, zero vulnerabilities.
- Historical applied migration preservation and whitespace review: **PASS**.
- All other Phase 10 packages remain subject to the outstanding gates above.

Reproduction uses private `PHASE10_DISPOSABLE_IDENTITY_FILE` and synthetic
`PHASE10_BROWSER_FIXTURE_FILE`, local Node 22 runners, native Chromium with
`connectOverCDP({noDefaults:true})`, and independent X displays. Each identity file
is tied to a physically verified tmpfs container and its network namespace; do
not run these URLs from the host or substitute an arbitrary localhost database.
The disposable control script performs only terminal, fixture-owned transitions
and bounded delivery failure injection after live attestation. It never resets
or reactivates records. Browser result HEADs identify the tested base with dirty
working-tree implementation; this checkpoint's implementation commit seals that
reviewed work rather than falsely claiming it pre-existed those runs.
