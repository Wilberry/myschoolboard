# Phase 11 independent trash and recovery checkpoint

**Date:** 7 November 2026 (Africa/Lagos). **Requirement:** DEL-REQ-001.
**Base:** accepted main `d4459d827e8529ea8daddb73f7e842d8c47c12ab`.
**Branch:** `feature/phase11-trash-recovery`. D-023 applies; no main merge/release.

## Implemented independent functionality

A new additive lifecycle overlay supports **never-submitted lesson-note/scheme
DRAFTS only**, with exact current original teacher class/subject/session authority
or active same-school School Super Admin restoration authority. Previously
submitted/returned/reviewed/released material, financial records, pupil identities,
assignments, approved results and audit ledgers are not generic deletable objects.
Parents, students, other teachers, School Admin and foreign school actors cannot
use school draft recovery. Platform role alone grants no academic content access.

- Server-derived 30-day school recovery deadline; source hidden from normal own
  lesson list/detail and frozen against revision/submission, including direct SQL.
- Immutable `TrashEvent` actor/reason/DB time/version/request-key evidence and
  SQL-controlled `TrashCase` projection. Cases cannot commit without their initial
  authorized event. Exact concurrent retries return the original operation;
  conflicting payloads/versions deny. Direct event update/delete/truncate and
  case projection mutation are rejected; existing tenant-cleanup exception remains.
- Scope-checked restoration retains original school, note ID, original revision
  bytes, teacher and history. Revoked assignment/member/school/period authority
  does not regain access through Trash; new fresh authority is used for fixtures.
- School owner may end school recovery, transferring to platform custody. This
  ends school-level recovery, **not physical erasure**. 90-day platform retention
  starts at the actual early transfer or original 30-day deadline for late jobs;
  a late worker cannot silently extend retention.
- Platform Super Admin-only queue exposes opaque lifecycle metadata, never topic,
  objectives, draft body, teacher reasons or recipient data. Holds/release are
  immutable events; holds deny restoration and do not reset retention clocks.
- Platform recovery authorization grants a bounded 24-hour school recovery
  opportunity within the original 90-day platform deadline. Actual restoration
  still requires current school/source authority. Platform users never directly
  read or edit academic content; authorization is not an entitlement to it.
- Local authenticated operator expiry batch processes at most 100 cases per stage,
  with school serialization, expected versions and bounded conflict retries.
  Repeated/concurrent evaluation cannot double-transition a version. Recovery
  grants expire to platform custody; platform expiry reaches `PURGE_BLOCKED`.
- Private no-store school/platform APIs and accessible workspaces; teacher candidate
  choices expose only own never-submitted drafts. Native lifecycle concealment,
  foreground access checks, history/sign-out handling and no-permit print privacy.
  All operations default OFF under `PHASE11_TRASH_ENABLED=false`.

## Policy boundary and remaining implementation

**This is a tested independent Phase 11 slice, not full DEL-REQ-001 acceptance.**
The existing lesson revision/event history is protected by accepted immutable SQL
and restrictive references. This branch does not weaken those protections to
satisfy a purge test. At 90-day platform expiry, `PURGE_BLOCKED` explicitly records
that physical disposition requires a separately authorized protected-history
retention policy/adapter. No content is silently deleted or claimed purged.
A legal hold is also retained; releasing it never authorizes erasing academic
history. Outstanding protected records remain visible to platform retention
operators for disposition rather than indefinitely pretending a purge succeeded.

Supported source type is deliberately closed, not an arbitrary table/resource
name. Phase 10 catalog/assets/notices/submissions do not exist on this base and
have no adapters here. Each future adapter must establish its actual source
policy, byte/metadata retention, reference/hold checks, withdrawal/read guards,
scope restoration and approved physical disposition before registration.
No financial/academic event, identity binding or revoked permission is restored
by a generic lifecycle operation.

Phase 10 notification integration is isolated at committed `TrashEvent` IDs,
school, action, ordinal and timestamp. No Phase 10 model/service is imported,
no historical events are backfilled, and no external communication is sent.
The future domain adapter must capture notification events atomically with the
transition and reauthorize audiences. This branch's own immutable lifecycle audit
works without Phase 10. A production scheduler and approved erasure/storage/legal-
hold/backup disposition remain separate integration/release work.

## Schema and authorization evidence

New forward migration `20261106230000_phase11_trash_recovery` adds two models,
indexes, current source-authority predicate, event transition SQL, immutable guards,
deferred initial-audit constraint and source mutation freeze. Original 58 migration
files are unchanged. Full inventory is 59; cumulative inventory guards were updated
without accepting missing/extra migrations. `phase11_now()` has no runtime clock
setting or client override; database boundary tests use transactional DDL that is
always rolled back, retaining PostgreSQL microsecond precision.

The existing cumulative SQL shape guard assumed LANGUAGE occurred after a body
and that every function was PL/pgSQL. It now also validates legal PostgreSQL
LANGUAGE-before-body and SQL-expression functions and volatility attributes,
retaining paired-body counts and the PL/pgSQL single-DECLARE/BEGIN invariant.
No applied migration was edited to appease a textual guard.

## Tests actually executed

| Check                                                        | Outcome                                                                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official pinned Prisma JS/WASM generation, additive schema   | PASS                                                                                                                                                                                      |
| Physical disposable DB provenance and live nonce attestation | PASS; original tmpfs container `0527a75f9ba3feaee0002295535ef00256cbcd3f56c1ab57765824bc30afdcb8`, loopback 5434, no existing mounts                                                      |
| New migration on that verified disposable DB                 | PASS; no reset/rewrite                                                                                                                                                                    |
| Independent fresh empty PostgreSQL bootstrap                 | PASS, 59; new unexposed tmpfs container `80e0554d98fb289c1dcb816ff8e9eeaaa68e241643384529febc1ce84d7d586d`                                                                                |
| Exact applied migration checksums                            | PASS, all 59                                                                                                                                                                              |
| Node guards                                                  | PASS, 207                                                                                                                                                                                 |
| Full Vitest regression                                       | PASS, 49 files / 421 tests                                                                                                                                                                |
| New lifecycle integration scenarios                          | PASS, 7: roles/tenant/default-off; concurrent replay/source freezing; restore/lineage; platform separation/recovery; holds/history; exact 30/90 boundaries; terminal authority revocation |
| Authenticated native Chromium                                | PASS, 7 scenarios; [summary](PHASE11_BROWSER_RESULTS_20261107.json)                                                                                                                       |
| ESLint / TypeScript / Prettier                               | PASS                                                                                                                                                                                      |
| Production build                                             | PASS                                                                                                                                                                                      |
| Strict dependency audit                                      | PASS, zero vulnerabilities                                                                                                                                                                |
| Diff whitespace and historical migration preservation        | PASS                                                                                                                                                                                      |

Browser checks use fresh synthetic teacher authority/draft after terminal test
revocations, real BetterAuth sessions, native tab blur/focus via ordinary Chromium
CDP `noDefaults:true`, authorized restoration and platform recovery/hold UI,
foreign/other-teacher denial, Back navigation, 375px and keyboard/axe checks,
foreground authority revocation, actual sign-out and PDF concealment. Raw private
fixtures/screenshots/PDF/session cookies are outside Git. The browser JSON records
the then-current base HEAD; implementation was tested in the working tree later
committed on this branch, not a nonexistent pre-created commit.

Initial tests exposed nested PostgreSQL-adapter serialization-code handling and
a test timestamp precision assumption; both were corrected without weakening the
assertions. A failed display startup and GET/POST response-observer harness race
were corrected before the passing browser run. Build required explicit Suspense
for the authenticated platform route; no sensitive route caching was added.

## Local execution

Use private independently verified disposable environment variables; all finance
and Phase 11 flags must be OFF during `verify:phase9:preflight`. Suites opt in only
after live attestation. Never reset or point to a shared DB. Standard Prisma Rust
CLI download remains restricted in this cloud runtime; the verified official
JS/WASM/explicit SQL path was used, not checksum bypass. Standard CLI deployment
is not reported as passed. The fresh-bootstrap helper now asserts exact count 59.

`npm run verify:phase11:retention` requires the private disposable environment and
PHASE11_OPERATOR_COOKIE containing an actual current BetterAuth platform session.
The command attests before enabling its flag, verifies the session and current
platform role, runs the bounded batch and reports counts only. It has no public
cron route, user-ID impersonation switch or physical delete operation. Browser
runner: `node scripts/verify-phase11-browser.mjs` with private fixture path and a
local display; fixture staging is opt-in to the lifecycle integration suite.

## Exit and integration status

Independent lifecycle adapter: **PASS** for executed scope. Full Phase 11: **PARTIAL**
until protected-history disposition and actual Phase 10 adapters/notification
integration are implemented and accepted. No security gate is waived and no
production readiness is asserted. Draft PR only; main merge requires review and
explicit authorization. No Actions, force-push, real data deletion, deployment or
main merge occurred. The independent Phase 10/12 worktrees are not part of this
branch or its tested migration inventory.
