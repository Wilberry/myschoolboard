# Phase 10 transactional source capture and learning/resource in-app adapters

P10-07 partial, COM-REQ-001 / LIB-REQ-001 / AUD-REQ-001 / SEC-REQ-001, D-023.
Base: `f432199786c94465f8010dd93d3b885d4d8bd581`. Existing Phase 10 branch/PR #111.

## Implemented

Thirty-six registered immutable school source tables now capture one minimal
`SchoolSourceEvent` and durable `SchoolSourceOutbox` entry in the source transaction.
The envelope stores source type/ID, schema version, recorded action, actual recorded
actor when available, original source time and capture time. No academic body,
pupil work, financial amount/reference, credential or file pointer is copied.
Absent source actors remain absent. No historical record is backfilled. Ordinary
direct envelope inserts and evidence UPDATE/DELETE/TRUNCATE are rejected; the
repository's explicit whole-school cleanup convention remains unchanged.

The first five registered recipient adapters cover learning-task review/release,
pupil work, teacher feedback, catalog release and approved asset release. They
delegate to current exact teacher/section/pupil and resource/rights predicates;
guardians and foreign schools deny. Source review work ceases to notify when it is
no longer current. Unknown source types remain pending and are never treated as
generic school broadcasts or silently marked delivered. Existing notice/class
channels, outboxes and permission models remain separate.

`PHASE10_MODULE_INAPP_ENABLED=false` defaults off. The source feature flags must
also be enabled. The authenticated current-owner worker uses bounded atomic
100-member pages, school/outbox locks, SKIP LOCKED, unique delivery tuples, five
bounded failures, delayed retries and immutable attempts/replay history. A failed
transaction cannot advance delivery/cursor independently. Owner-authenticated
private APIs expose delivery/replay; current recipients read only their own
currently authorized inbox and append idempotent read/unread decisions. Deep links
are constructed locally from source-owned IDs and reauthorize at the destination.
Learning and library interfaces reuse the private inbox component. The disposable
development worker reauthenticates its operator session each loop and now includes
these adapters; no anonymous worker or external provider is activated.

Tenant-local row triggers append terminal suppressions when school, membership,
scope, academic context, pupil identity/enrollment or resource/workflow authority
ceases to permit a delivery. School and ScopeGrant ownership changes inspect both
old and new school contexts. Withdrawal removes disclosure without rewriting the
original delivery or source event. Rights expiry is checked using database time.

## Additive schema

- `20261108022000_phase10_source_event_capture`: immutable minimal envelopes and
  durable source outbox, capture from 36 existing ledgers, no history backfill.
- `20261108023000_phase10_learning_resource_inapp`: five explicit recipient
  contracts, private deliveries/interactions/suppressions/attempts, tenant-local
  authorization revocation hooks and reasoned replay keys.

All earlier applied migration bytes remain unchanged. The complete inventory is
75. A new independently nonce/physical-identity-verified PostgreSQL 17 tmpfs
database bootstrapped every migration; the retained isolated database upgraded
through both migrations without a reset.

## Actual validation

Nineteen authenticated PostgreSQL scenarios pass in the learning/source fixture
suite. New checks cover exact concurrent source retry with one envelope/outbox,
transaction rollback of source/envelope/outbox together, invented envelope and
history rewrite denial, concurrent delivery/deduplication, real read/unread,
feedback notifications, guardian/foreign denial, pending retention of unsupported
source contracts and terminal suppression on actual pupil membership revocation.
Browser staging creates a separately verified fresh pupil and guardian relationship;
the revoked test membership is never reactivated.

The sequential cumulative run passed **207 Node guards, 490 Vitest tests in 54
files**, and exact **75 applied migration checksums**. Formatting, ESLint,
TypeScript, official pinned Prisma JS/WASM schema/client generation and production
build passed. The dependency lock is unchanged from the strict-TLS zero-vulnerability
audit at the learning checkpoint. The initial overlapping DB verification jobs
produced SSI conflicts; those runs are failed evidence, not acceptance passes.
Rerunning sequentially as prescribed by Vitest configuration passed without
weakening transaction/authorization guards. The multi-worker workflow has an
explicit bounded 20-second test timeout because it drains many atomic pages;
its actual sequential duration was approximately eleven seconds.

Seven authenticated native Chromium workflows passed against the production
build: five task/pupil-work/privacy workflows, actual module delivery/deduplication/
read-unread/deep-link workflow, and owner-only audit/accessibility/cross-tab sign-out.
See the adjacent browser-results JSON. These results do not claim persisted BFCache,
all module failure/recovery paths or the outstanding terminal browser scenarios.

## Remaining P10-07/P10-08 gates

Capture is not delivery acceptance for all 36 sources. Attendance, lessons,
results/report acknowledgment, financial-account/receipt and operational lifecycle
recipient adapters remain outstanding. Parent-first report delivery must use the
actual acknowledgment predicate; finance recipients require the unchanged account
publication predicate. Unknown events stay pending until their explicit contracts
and tests are implemented. Time-driven subscription boundaries, complete direct
permission-change audit, BetterAuth success/failure/logout/session audit and
restricted platform-security inspection remain outstanding. Phase 11 contributes
no guessed source events; its actual integrated lifecycle contracts must be tested.

New-channel failure injection/retry/replay, >100-recipient paging/recovery/load,
broader terminal browser revocation, delayed response, printing and cumulative
portal acceptance still require P10-08 evidence. Production scanner/storage/retention
and release gates remain separate. No main merge, provider send, deployment,
database reset, migration rewrite, force push or GitHub Actions run occurred.

Exit gate: verified development slice; **whole Phase 10 remains PARTIAL**.
