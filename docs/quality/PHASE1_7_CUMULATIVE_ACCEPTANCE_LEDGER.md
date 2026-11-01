# Phase 1–7 cumulative acceptance ledger

## Phase 3 disposable-database acceptance — 2026-11-01 (DB/CI GATES PASSED; PARTIAL)

**Final code/test SHA:** `e249955e64fafe5887a536074f8547ff25d3584f`
on `verify/pr97-integrated-pupil-workflow`.

The worktree-owned PostgreSQL 17 Alpine `postgres-test` container was
confirmed healthy, tmpfs-backed, without host data binds, and published only
on `127.0.0.1:5434`. A separate stopped Prisma 7 worktree container also
claimed that host port; it was not started, removed or modified. After
starting only this worktree's existing container with
`--no-deps --no-recreate`, the protected local target preflight passed.
Read-only inspection confirmed `myschoolboard_test`, role `myschoolboard`,
PostgreSQL 17.11 and zero migration records. The hardened empty-bootstrap
preflight passed at code SHA
`bfc22dbb078a58ce62c8ffbfdcbc0fb79a8167b3`, requiring the empty public
schema and exactly 37 reviewed migration files. After deployment, the
empty-schema guard was hardened further to enumerate additional
namespace-scoped PostgreSQL objects (operator classes/families, collations,
conversions, text-search objects and statistics objects) and unit tests were
expanded. The latest guard's six Node unit tests passed at the final SHA; the
empty-bootstrap preflight was not rerun against the now-migrated database.
No reset, seed, truncate or data deletion was used.

At that preflighted SHA, `npm run db:deploy` applied all 37 migrations,
including `20261101000000_phase3_platform_subscriptions` (#37). Exact
checksum verification passed **37/37** then and again at the final code/test
SHA above. At the final SHA, focused subscription policy, subscription
database integration and school-lifecycle integration tests passed **19/19**.
The complete `npm test` passed **117/117 Node tests** and **327/327 Vitest
tests across 39 files**, with no skips or failures. Prettier, ESLint,
TypeScript, production build, `npm audit --audit-level=high`, full `npm audit`
and `git diff --check` all passed; both audits reported **0 vulnerabilities**.

The initial production build exposed an incompatible `force-dynamic` /
`force-no-store` route export under Next.js Cache Components. The platform
page now isolates request-specific authentication and the serialized,
actor-row-locked school projection inside a React Suspense boundary with a
generic access-check fallback; no school data is in the prerendered shell.
The production build succeeds and reports `/platform` as partially
prerendered. No production deployment or browser-level route/cache
acceptance was performed.

**Status:** Phase 3 database/schema and automated test gates pass at the
stated evidence boundaries. PLAT-REQ-001 and SUB-REQ-001 remain **PARTIAL**;
entitlement enforcement, payment processing, automatic expiry, complete
platform management and browser/accessibility verification remain open.
Phase 1–7 overall acceptance remains **NOT ACCEPTED** because other
requirements and browser evidence gaps remain. See the [Phase 3 acceptance
runbook](PHASE3_SUBSCRIPTIONS_ACCEPTANCE.md).

## Phase 3 tmpfs recovery guard — 2026-11-01 (historical source checkpoint)

The Phase 3 test Compose service was absent at the 6bbfbb5 checkpoint.
Because this PostgreSQL container stores data on tmpfs, stopping it can
erase the 36 previously applied migrations. The existing 36-applied/one-pending
migration preflight is **not** relaxed. Instead, a separate read-only
`verify:phase3:empty-bootstrap-preflight` command was authored for an
**actually empty** verified disposable PostgreSQL 17 container. It requires
the exact clean verification branch, worktree-specific Docker ownership,
local test-only URL/environment, exact public schema and database identity,
zero preexisting database objects in the public schema, exactly 37 valid
local migration files and the reviewed Phase 3 SQL structure. A database
with any existing Prisma history, school data, user-defined routines/types/
operators/extensions or unknown schema is rejected by the empty path and
must never be reset to force it. The initial source checkpoint had no
Docker/PostgreSQL runtime evidence; the later executed results are recorded
above. Migration #37 has since been applied only to the certified disposable
test database.
See [Phase 3 acceptance](PHASE3_SUBSCRIPTIONS_ACCEPTANCE.md).

## Phase 3 migration preflight attempt — 2026-11-01 (BLOCKED)

At exact commit
`cbc83fd511fb2c9eba536882215a2431efa31b8f` on
`verify/pr97-integrated-pupil-workflow`, the reviewed 11-file Phase 3 change
was committed and pushed normally. The local verification-target preflight
passed using the private synthetic test configuration. The read-only Phase 3
migration preflight then failed closed because this worktree's
`postgres-test` Compose service was not running or present; the local Docker
daemon socket was available, but `docker compose --profile test ps -q postgres-test`
returned no container. No PostgreSQL connection was made by
the migration preflight, migration #37 was not deployed, and no applied
migration checksums were verified for this commit. Do not infer the 36/36
historical checksum result at `686891d` applies to this SHA.

At the exact source SHA above, the two Phase 3 Node guard/preflight test files
passed **14/14**, Prettier check passed, ESLint passed, TypeScript passed and
`git diff --check` passed. No DB-backed Phase 3 integration tests, complete
Node/Vitest suite, production build or npm audits were run because the guarded
database precondition failed. Phase 3 database acceptance remains BLOCKED;
resume only after the exact healthy, loopback-only, tmpfs-backed PostgreSQL
17 test container is available and the protected preflight passes.

## Subscription status and advisory usage — historical source checkpoint

PR #98 now includes an operator-only, no-store subscription status
endpoint and console panel: school lifecycle and subscription timing
separately, current plan metadata, and aggregate enrolled pupil/staff counts.
Billing remains NOT_TRACKED and entitlements NOT_ENABLED. Suspended schools
are not reactivated. At the time this checkpoint was written, role/tenant
tests were authored but current-SHA PostgreSQL/browser evidence was not yet
available. Subsequent database and automated test results are recorded at
the top of this ledger. SUB-REQ-001 and PLAT-REQ-001 remain PARTIAL.

## Phase 3 console and migration-preflight extension — historical source checkpoint

The current PR #98 development branch adds a server-role-locked `/platform`
console, a current-operator-only navigation link, accessible plan and school
subscription forms, and a **read-only** migration preflight. The new
`verify:phase3:migration-preflight` command requires a clean exact SHA, the
correct disposable Docker service and URL, 36 exact historical applied
checksums and **only** migration #37 pending before any separate deployment
may be considered. The original source checkpoint predated local Node/Prisma
execution. The migration file was repaired after discovering duplicated malformed SQL
in an intermediate development commit; the current reviewed file contains
exactly two CREATE TABLE, four CREATE FUNCTION and six CREATE TRIGGER
statements and a valid PostgreSQL GiST exclusion constraint. The corrected
migration has since been applied on the certified disposable target; see
[Phase 3 acceptance runbook](PHASE3_SUBSCRIPTIONS_ACCEPTANCE.md).
This is not a production release verification.

## Current Phase 3 implementation checkpoint — historical authored state

The existing PR #98 branch now includes a Phase 3 immutable plan catalog and
school subscription period foundation: additive migration #37,
platform-only no-store GET/POST, SQL actor/tenant and overlapping-period
guards, policy tests, authenticated real-session integration tests, and
a read-only source guard. At that time, the code had not been run on the
disposable database or a compiled browser. Later database, test, build and
audit results are recorded at the top of this ledger. Catalog features and
quotas remain recorded configuration, **not enforced entitlements**. School
lifecycle and academic privileges remain independent of subscription
assignment. The historical 36/36, 311/311, 95/95 and 108/108 results below
retain their original provenance and do not validate this new commit.
Continue remaining Phase 3 UI/entitlement and Phase 4/7 functional
requirements before final cumulative acceptance. No new PR.

**As of:** 2026-10-31  
**Status:** IN PROGRESS — Phase 1–7 is **NOT ACCEPTED**; no merge or deployment authorized by this ledger.  
**Consolidation PR:** [#98](https://github.com/Wilberry/myschoolboard/pull/98); prerequisite [#97](https://github.com/Wilberry/myschoolboard/pull/97).  
**Additional unverified browser candidate:** [#99](https://github.com/Wilberry/myschoolboard/pull/99) (stacked separately).

This ledger reconciles **existing tests and code**, not a new claim of test execution.
Do not restart passing checks merely because older per-feature documents say
"authored, not executed": many were written *before* the cumulative local
database regression. Equally, do not infer complete functionality from green
tests on the currently implemented subset.

## 1. Test evidence we must preserve

| Exact tested source | Existing observation | Evidence boundary |
| --- | --- | --- |
| Application SHA `686891dac5887601df401d35acc4b222159bd403` | Operator-reported `npm test`: **95/95** Node guards; **311/311** Vitest tests across **37/37** files, zero skipped/failed | Proves the existing tests against a confirmed disposable PostgreSQL test environment; does not test unimplemented workflows |
| Same application SHA | Protected local preflight; **36/36** exact applied migrations; full and strict dependency audits reported zero; format, lint, typecheck and production build passed | Migration/audit/static/build gate at this SHA; no production release claim |
| Same application SHA | Production-compiled Chrome and synthetic authenticated pupil: positive released lesson list/detail; cross-school/unlinked/parent denial; protected API `private, no-store`; guarded revocation then same-session API 404 and fresh-browser Flight/page/history/print checks | **Scoped** BR-03/11/12/14/15/16 subcases only; old pre-revocation tab and two unattributed Flight cache responses unresolved |
| PR #98 HEAD before this ledger, `6b5b044560704e3b4d8acfadb03b3f9264962514` | Operator-reported focused browser workflow **9/9**, local security guards **108/108**, format, lint, typecheck and `git diff --check` passed | These are *not* another full DB/test/build/audit run at the newer SHA; script/docs differences are reviewed separately |
| PR #99 head before this ledger, `a6c04dc3717fbad9ee0ebd676486b70a2d260de3` | Seven source-only Flight unit assertions passed in an isolated JS execution and runner syntax checked | **No** actual retained-tab browser, guarded revocation or database test executed at this SHA |

**Source of evidence:** [browser acceptance record](PHASE1_7_BROWSER_SECURITY_ACCEPTANCE.md),
[local PR #97 checkpoint](PHASE1_7_PR97_LOCAL_CHECKPOINT.md),
[dependency advisory assessment](../security/DEPENDENCY_ADVISORY_ASSESSMENT.md),
and the owner-provided 2026-10-31 terminal outputs. GitHub-hosted CI runs
sampled at several PR heads report failures, not confirmed green checks.
The failure cause has **not** been established from job logs. Maintain the
CI audit gate; distinguish runner issues from application failures.

## 2. Acceptance by canonical requirement

Status terminology:

- **PARTIAL — TESTED SUBSET:** the identified functionality has local tests;
  its full requirement/role/browser matrix is not accepted.
- **FUNCTIONAL GAP:** canonical functionality is not implemented, not merely
  waiting for another test run.
- **RELEASE-ONLY DEFERRED:** production enablement belongs to a later exit
  gate; it must not be mistaken for a working public feature.

| Phase | Requirement | Code and previous test coverage | Remaining acceptance evidence or implementation |
| --- | --- | --- | --- |
| 1 | **OPS-REQ-001** | Guarded disposable-target preflight, 36 exact migrations, Node and Vitest checks, build, formatting, lint, typecheck and audits previously passed | Verify the final cumulative integration SHA, current CI gate, and documented operational/release prerequisites. **PARTIAL — TESTED SUBSET** |
| 1–2 | **SEC-REQ-001 / TEN-REQ-001** | Authorization/tenancy integration tests, school API denial guards, scoped real-browser student denial/revocation | Complete logged-out, cross-school, staff/role, HTML/RSC, sign-out, cache and history matrix BR-01..BR-15; review platform audit scope and exact final-query authorization. **PARTIAL — TESTED SUBSET** |
| 2 | **USR-REQ-001** | Better Auth session/role tests; active membership, section and assignment scope tests; verified synthetic user sessions | BR-01/05/07/10/13 full authenticated and signed-out browser evidence, privileged identity rollout deferred under P-007. **PARTIAL — TESTED SUBSET** |
| 3 | **PLAT-REQ-001** | Platform-only school onboarding/lifecycle and append-only lifecycle events have existing tests. The Phase 3 candidate also adds an operator console and observational subscription status; source guards pass at `cbc83fd511fb2c9eba536882215a2431efa31b8f`, but guarded database acceptance is blocked. | Dedicated platform view/metrics and full management, staff onboarding and platform audit access remain incomplete. Subscription foundation has not passed DB/browser acceptance; **PARTIAL / FUNCTIONAL GAP** |
| 3 | **SUB-REQ-001** | The Phase 3 candidate adds a `PlatformPlanRevision` catalog, immutable school subscription periods, private/no-store platform routes and migration #37. At `cbc83fd511fb2c9eba536882215a2431efa31b8f`, 14/14 Node source-guard/preflight tests pass; no database connection or migration deployment occurred because the required disposable service was unavailable. | PostgreSQL migration/37-checksum and DB-backed authorization, cross-school, overlap, immutability and revoked-session tests remain unverified. Entitlement enforcement, payment processing and automatic expiry remain unimplemented. **PARTIAL — DB ACCEPTANCE BLOCKED** |
| 4 | **SCH-REQ-001** | Sections, academic periods, class/subject setup, lifecycle and configuration have DB-backed coverage; 36 migrations applied | Verify browser role/section setup, historical policy behavior, and remaining applicable tenant constraints. **PARTIAL — TESTED SUBSET** |
| 4 | **ADM-REQ-001** | `StudentRecord`, exact enrollment, school-admin registration/enroll/withdraw routes and immutable lifecycle history have DB integration tests; pupil login link is a separate attested record | Canonical inquiry→acceptance workflow and history-preserving promotion/transfer/graduation are not complete in the documented implementation. Distinguish these **functional gaps** from already-tested enrollment safety. |
| 5 | **TCH-REQ-001** | Teacher assignments, verified grants, Form Teacher responsibility, timetable exclusion constraints, audit events, and related API tests are in the existing suite | Confirm full live browser usability, revocation/race, timetable constraint UX and unresolved large-campus pagination policy as applicable. **PARTIAL — TESTED SUBSET** |
| 6 | **ATT-REQ-001** | Attendance roster, immutable corrections, section decisions, school day/time policy and related real-session integration tests are in the existing suite | Complete section-specific browser scenarios, history/print, sign-out, access revocation and teacher/section authorization BR-05..BR-08/14/15. **PARTIAL — TESTED SUBSET** |
| 6 | **LES-REQ-001** | Teacher note drafts/revisions, independent HM/Principal review, explicit release/withdrawal, student-link + exact enrollment reader; positive student and denial/revocation HTTP evidence | Unreleased/draft/withdrawal scope, other-pupil boundaries, old-tab content/print, route-attributed positive Flight caching and remaining BR-11/12/14 checks. **PARTIAL — TESTED SUBSET** |
| 7 | **ASM-REQ-001** | Question bank, sealed drafts, academic review, school publication, student attempt/answer/submit/resume **internal-only** services, objective scoring, teacher provisional and reviewed-manual class record tests are in the 37-file suite | **Functional gap:** no verified student-facing CBT attempt/question/resume/answer/submit API and browser UI in the application tree. Confirm exact key-blind delivery, attempt limits, expiration, race/idempotency, teacher mark boundaries, and BR-04/09 before declaring full CBT delivery. Phase 8 official reports stay separate. **PARTIAL / FUNCTIONAL GAP** |

The [functional requirements](../requirements/FUNCTIONAL_REQUIREMENTS.md),
[implementation roadmap](../roadmap/IMPLEMENTATION_ROADMAP.md),
[assessments specification](../modules/ASSESSMENTS_AND_CBT.md),
[admissions specification](../modules/ADMISSIONS_AND_STUDENT_RECORDS.md),
[platform administration](../modules/PLATFORM_ADMINISTRATION.md)
and [subscriptions specification](../modules/TENANTS_AND_SUBSCRIPTIONS.md)
remain canonical. This table does not change their scope.

### Guardian boundary without moving Phase 10 into Phase 7

- Mandatory **now**: no school/child information to an unverified, unrelated
  or cross-school PARENT membership, even if a user has a valid session.
  Existing negative unlinked-PARENT lesson API/page checks are scoped evidence.
- Positive parent/student multi-service portals, notices, fees and published
  report cards are covered by later phases, including Phase 10. They must
  remain **NOT IMPLEMENTED** where absent. Do not mark BR-16 fully passed.
- If an earlier-phase feature needs a guardian relationship *prerequisite*,
  scope and test only its verified same-school ownership/active/revoked
  relationship, without inventing a complete Phase 10 portal.

## 3. Browser verification evidence disposition

| Rows | Prior executed evidence | Open work |
| --- | --- | --- |
| BR-01/02/04/05/06/07/08/09/10/13 | Existing unit/DB guards and some historical browser fixture checks | The complete current production-browser role, cache/RSC, revoked-grant and sign-out matrix remains **BLOCKED** |
| BR-03 | School B administrator to School A pupil API denial observed (404/no-store) | Wider student, lesson, HTML/RSC and browser route matrix |
| BR-11 | Linked released lesson list/detail positive; wrong school and unlinked denials | Other student, unpublished/withdrawn, changed period and exact scope cases |
| BR-12 | Same-session API denial and fresh-browser revoked page/Flight/history/print | Retained original tab **before** refresh or print and alternate identity/enrollment revocation |
| BR-14 | Authorized lesson print and fresh post-revocation print | Old-tab print, teacher class record/attendance print, *route-attributed* missing/s-maxage Flight responses |
| BR-15 | Student page focus and simulated zoom probe | Full keyboard-only staff/assessment/attendance workflow |
| BR-16 | Unlinked PARENT negative denial | Broader verified-relationship boundaries and later positive portal work (not a Phase 1–7 portal completion claim) |

The BR matrix itself remains the authoritative case-by-case record;
earlier scoped subcases **must not be relabeled as full-row PASS**.

## 4. Closure sequence — reuse evidence before rerunning

1. **Retain** the 2026-10-31 311/311 + 95/95 + 36/36 evidence at its
   exact application SHA as the historical benchmark, not an untested
   current-HEAD PASS. Retain 108/108 source guards and focused HTTP browser
   evidence as separate later provenance.
2. **Finish material product gaps** in the current cumulative Phase 1–7
   integration branch: first Phase 3 plan/subscription/entitlements and
   incomplete Phase 4 admission lifecycle; then complete safe student-facing
   Phase 7 CBT delivery/consumption. Track module-specific unit/DB/browser
   tests for each added behavior. Do not introduce an external billing
   gateway, real money or fabricated historic records.
3. **Close browser evidence gaps** using the existing synthetic fixture/runbook,
   including #99's guarded retained-tab implementation only after it passes
   local static/DB/Chrome checks. Resolve unattributed Flight cache headers
   by exact route, not speculation.
4. **Run one cumulative acceptance pass at the eventual candidate SHA:**
   guarded Docker/disposable target; all 36 exact migrations (or updated,
   reviewed additive migrations); complete Node/Vitest, formatting, lint,
   TypeScript, build, strict and full audit; actual Chrome role/scope/privacy,
   sign-out, history, print and accessibility. Do not repeat already-passed
   historical subchecks outside a targeted regression need.
5. Review `main...candidate` (not merely the final small stacked PR diff)
   for migration/tenant/identity/audit changes, test scope, and reproducibility;
   classify hosted CI failures by actual job evidence.
6. **Only after acceptance and the separate required owner authorization
   for merging to `main`**, integrate one cumulative Phase 1–7 candidate,
   and close already-superseded drafts with links to the integration commit.
   Do **not** claim each closed historical PR was merged independently.
   Keep Phase 8 (#65–#74) and Phase 9 branches out of this candidate.

**Current exit decision: BLOCKED / NOT ACCEPTED.** No GitHub PR merge,
database migration, production deployment, shared-data operation or
GitHub Actions manual dispatch was performed by this ledger.
