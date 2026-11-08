# Project Status

## Phase 10 catalog and raster assets — 8 November 2026

P10-04/P10-05 implement versioned physical/digital catalog metadata, independent
review, typed audiences, quarantine/inspection, independent rights, private raster
delivery and withdrawal. Seven authenticated Chromium workflows passed.
P10-06/P10-07 and full P10-08 remain outstanding; Phase 10 is not merge-ready.
See the [catalog checkpoint](../quality/PHASE10_LIBRARY_ASSETS_CHECKPOINT_20261107.md).


## Phase 10 notices and class channel — 7 November 2026

Independent development branch / draft PR #111: P10-01/P10-02 now have 12 actual
authenticated native Chromium scenarios, including terminal revocation, retries,
stale responses, sign-out, accessibility and printing. P10-03 adds a separate
class channel and durable class inbox; six class Chromium scenarios passed.
P10-04–08 remain incomplete; Phase 10 is not merge-ready.
See [current checkpoint](../quality/PHASE10_NOTICES_CLASS_ACCEPTANCE_20261107.md).



## Phase 10 engineering analysis — 6 November 2026

**COM-REQ-001 / LIB-REQ-001 / AUD-REQ-001: analysis prepared; implementation and
Phase 10 acceptance remain outstanding.** Verified starting main:
`d4459d827e8529ea8daddb73f7e842d8c47c12ab`, including accepted Phases 8 and 9.
The isolated analysis records actual implementation gaps, separate notice/class
permissions, resource rights/quarantine/storage, transactional in-app notification
and audit architecture, additive schema sequence and work packages P10-01–08.
First safe implementation milestone: owner-published official notices plus
current verified recipient access and deduplicated in-app delivery (P10-01/02).
No runtime/schema/migration/dependency changes, database writes, external sends,
main merge or deployment are part of this analysis. Historical Phase 9 acceptance
below remains unchanged. See
[Phase 10 analysis and verification](../quality/PHASE10_ENGINEERING_ANALYSIS_20261106.md).

## Current Phase 9 local acceptance — 6 November 2026

**FEE-REQ-001: implemented, locally accepted, and merged into development `main` via PR #108.**
Existing Phase 9 history is reconciled with accepted Phases 1–8 on
`integration/phase9-after-phase8-cloud-20261106`. Exact balances, approved manual
receipts, private image evidence, independent review/allocation, explicit waiver
applications, reversals, publication/withdrawal, verified recipient access and
role-specific workflow screens are implemented. Local verification includes 58
migrations on independently verified disposable PostgreSQL, all 207 Node guards,
414 Vitest tests, 11 real browser acceptance scenarios, accessibility, print/privacy,
financial concurrency, build/lint/types/format and zero-vulnerability audit.
Official JS/WASM Prisma paths passed; Rust CLI downloads remain proxy-blocked.
All finance flags default OFF. No live provider or production release.
Remote integration completed on 6 November 2026 via [PR #108](https://github.com/Wilberry/myschoolboard/pull/108).
Verified Phase 9 merge SHA: `a20108c347ae3772eb848cc28bd0f32edb2e88ad`.
Pre-merge `main` was `83676cf9dcae2d416df991956e3dfa411b8ac6a0`.
No production release, live payment provider, external refund or finance-feature activation.
See [current acceptance and limitations](../quality/PHASE9_CLOUD_ACCEPTANCE_20261106.md).
This current entry supersedes the historical authored/unverified Phase 9 notes below.

**Updated:** 6 November 2026

## Phase 9 — disposable PostgreSQL verification boundary hardened (2026-10-18)

The existing cumulative `verify:local` runner is **not sufficient
proof of a truly disposable PostgreSQL server**, since a loopback
socket may be forwarded to a shared/production database. Without
altering that runner or GitHub Actions, the isolated Phase 9 branch
adds `scripts/verify-phase9-disposable.mjs`, mocked safety tests
and strict `verify:phase9:static`, `verify:phase9:preflight` and
`verify:phase9:local` commands. Before any existing
`npm ci`, Prisma migration, seed or full test chain is launched,
this wrapper demands the previous synthetic local test flags,
all Phase 9 finance writes OFF, and a matching random nonce
stored inside the **operator-confirmed physically disposable**
`myschoolboard_test` database.

The new psql step uses a read-only SELECT, strips inherited
libpq overrides, sanitizes Prisma URL query handling,
rejects unsafe query parameters or wrong nonce, and keeps
credentials/nonces out of command-line arguments and logs.
It never creates the marker or modifies a database. Only a
positive read-only attestation starts the unchanged cumulative
local CI runner. This is accident prevention, NOT a substitute
for the operator's independent verification of DB provenance,
and NOT a full database-security acceptance.

**Validation performed here:** isolated JavaScript evaluation
of 2 structural source-guard predicates over freshly fetched
committed files: **2/2 passed**. Mocked actual Node tests were
authored but have NOT been executed in the repository.
There was no PostgreSQL instance/checkout accessible in this
environment, no `psql` binary, no npm dependency install,
no real migrations/seed, no Node/Vitest/Prisma/TS/build,
browser/privacy check or strict dependency audit. All financial
runtime/release gates remain BLOCKED; Phase 8 stays unaccepted.
No main, worktree, actions, shared DB, or deployment changed.
See `docs/quality/PHASE9_DISPOSABLE_DATABASE_VERIFICATION_RUNBOOK.md`
and D-P9-008 / ADR-P9-008.


## Phase 9 — explicit applied fee waivers with anti-overcredit (AUTHORED, NOT VERIFIED; 2026-10-16)

The isolated `feature/phase9-fees-payments-foundation` branch
now contains an immutable `FeeWaiverApplication`, additive
`20261017000000_phase9_effective_fee_waiver_application`
migration, default-OFF private same-school Super Admin GET/POST,
and SQL cross-ledger guards protecting future bank-reference
VERIFIED decisions and manual allocations after a waiver.
Only a distinct independently APPROVED `kind=WAIVER`
school-obligation proposal may be explicitly applied once.
PostgreSQL source-copies exact minor-unit amount/currency and
serializes the sum of applied waivers and ALL human VERIFIED
claims against immutable original debt, including after
manual allocation reversals.

The School Super Admin-only internal balance preview now keeps
original charge, applied waiver, adjusted charge, independently
reviewed claims, gross/approved-reversed/net manual allocations
and an exact arithmetic remainder as separate decimal strings.
**No public paid status, provider-certified money settlement,
receipt, bank refund, guardian/student financial reader,
CORRECTION_PROPOSAL application, or real payment is implemented.**
`PHASE9_EFFECTIVE_WAIVER_ENABLED=false` adds another
default-OFF write switch beside the fee master.

New synthetic real-session overcredit, same-actor/replay,
foreign school, wrong policy/role, fee immutability, history
mutation and post-waiver future verification tests have been
authored. Structural source guards were evaluated but Prisma,
real PostgreSQL migration/races, Vitest, TypeScript, build,
browser/privacy and strict dependency audit remain NOT EXECUTED.
No main merge, other worktree alteration, GitHub Actions,
shared database activity or deployment. FEE-REQ-001,
Phase 8 and Phase 9 acceptance remain NOT VERIFIED/BLOCKED.
See `docs/quality/PHASE9_APPLIED_WAIVER_CHECKPOINT_20261016.md`
and D-P9-007 / ADR-P9-007.


## Phase 9 — advisory waiver/correction proposals (AUTHORED, NOT VERIFIED; 2026-10-16)

Isolated branch `feature/phase9-fees-payments-foundation` now adds
`FeeAdjustmentProposal` and `FeeAdjustmentDecision`, an additive
`20261016230000_phase9_fee_adjustment_proposals` migration, strict
same-school School Administrator proposal and independent School Super
Admin advisory decision APIs, own-only/bounded private no-store reads,
synthetic real-session tests and source invariants. Advisory APPROVED
waiver/correction proposals **do not** change issued debt, allocations,
manual preview balances, settlement, refunds or receipts. All original
fee and bank-reference evidence remains immutable.

`PHASE9_FEE_ADJUSTMENT_PROPOSALS_ENABLED=false` is a new independent
default-off write switch beside the master default-off finance switch.
PostgreSQL migration, Prisma generation, synthetic Vitest, concurrent
SQL and tenant security, typecheck, build, browser/privacy and strict
dependency audit remain NOT EXECUTED. No main, Phase 8 checkout,
shared database, GitHub Actions or deployment was touched.
FEE-REQ-001 and Phase 9 acceptance remain BLOCKED.
See `docs/quality/PHASE9_FEE_ADJUSTMENT_PROPOSALS_CHECKPOINT_20261016.md`,
D-P9-006, ADR-P9-006.


## Phase 9 — audited internal manual allocation reversal (AUTHORED, NOT VERIFIED; 2026-10-16)

The feature branch `feature/phase9-fees-payments-foundation` now
contains an additive `20261016160000_phase9_manual_allocation_reversal_review`
migration, immutable `ManualAllocationReversalRequest` (active current
same-school School Administrator only), separate reasoned
`ManualAllocationReversalDecision` (independent current
same-school School Super Admin only), strict private no-store
GET/POST school reversal request queue and independent decision
POST. PostgreSQL guards are AUTHORED to lock the real school, bind
source and actors, assign original allocation's exact amount/currency,
reject duplicate request/decisions and preserve all history.

Owner-only balance preview now displays gross manual allocations,
approved reversed manual amounts, net active manual allocations and
arithmetic remainder. APPROVED only offsets the full internal manual
allocation, REJECTED leaves it intact. Neither action refunds money,
changes source evidence, downgrades bank review, reuses the reference,
creates an official payment balance or issues a receipt.

The new flag `PHASE9_MANUAL_REVERSAL_ENABLED=false` keeps writes
disabled alongside the `PHASE9_FEE_WRITE_ENABLED=false` master
finance switch. Actual real-session Vitest, Prisma schema validate/
generate, PostgreSQL migration/trigger and concurrent race tests,
typecheck, build, browser/privacy tests and strict dependency audit
remain NOT EXECUTED. No GitHub Actions, deployment, main merge or
shared database work performed. Phase 8 remains separately
unaccepted. Full Phase 9 FEE-REQ-001 remains PARTIAL/BLOCKED.
See `docs/quality/PHASE9_MANUAL_REVERSAL_CHECKPOINT_20261016.md`,
D-P9-005 and ADR-P9-005.


## Phase 9 — manual reviewed-claim allocation preview (AUTHORED, NOT VERIFIED, 2026-10-16)

Following the immutable fee structure, student obligation, submitted
bank-reference claim and independent VERIFIED/REJECTED review foundations,
the isolated Phase 9 branch now includes additive
`20261016150000_phase9_manual_claim_allocation` migration,
`ManualPaymentAllocation` schema, typed service, one private no-store
`GET/POST /api/schools/:schoolId/manual-payment-allocations` endpoint,
synthetic authenticated data tests and source guards.

Only a current same-school School Super Admin may allocate the full
amount of one exact independent VERIFIED manual claim to the original
student debt. Database checks School lock, actor, source decision
attestation and reference, currency and verified sum caps; same
evidence or verification cannot be allocated twice and original claim/
decision/history remain immutable. An owner-only final SQL read returns
original debt, reviewed claim sums, applied allocations, unallocated
reviewed claim sums and preview remainder in decimal minor-unit strings.
Even a zero remainder is `FULL_MANUAL_ALLOCATION`, **never** PAID,
SETTLED, externally confirmed or a receipt. No student/guardian
finance view, provider call, file upload, official account balance,
reversal, refund or receipt is created.

`PHASE9_MANUAL_ALLOCATION_ENABLED=false` independently disables POST
in addition to `PHASE9_FEE_WRITE_ENABLED=false`; previous separate
payment-evidence and review gates also remain OFF by default. The
migration, Prisma generation, actual synthetic PostgreSQL integration,
concurrent direct-SQL attackers, Node/Vitest, TypeScript, browser,
build and strict high-severity dependency audit have **NOT EXECUTED**.
Neither main, the Phase 8 verification worktree nor any shared DB was
modified. FEE-REQ-001 and Phase 9 acceptance remain BLOCKED.
See `docs/quality/PHASE9_MANUAL_ALLOCATION_CHECKPOINT_20261016.md`;
D-P9-004 / ADR-P9-004.


## Phase 9 — unverified bank-reference claims and independent review (AUTHORED; 2026-10-16)

The isolated branch `feature/phase9-fees-payments-foundation` extends
immutable fee configuration and exact student debt with `PaymentEvidence`
and `PaymentVerificationDecision` (additive
`20261016140000_phase9_payment_reference_evidence_review`).
An active same-school SCHOOL_ADMIN may explicitly submit an **unverified**
manual reference claim for a pre-existing same-school obligation and
positive bounded claimed amount, with school-bound SHA-256 reference digest,
UUID request replay protection, immutable actor/time evidence and no raw
bank details/files. An active **different** same-school
SCHOOL_SUPER_ADMIN may independently attest matching bank reference,
`fundsConfirmed: true`, reason and VERIFIED/REJECTED outcome. PostgreSQL
rechecks actor, school, exact debt/reference/currency and caps summed
VERIFIED claim amounts at the original charge. Identical reviewer replay
returns original immutable decision; changed replay is denied.
No actual money is collected; a manual reviewer decision is not an
external bank/provider confirmation, payment settlement or receipt.

Private no-store GET/POST `payment-evidence` projects own school-admin
claims or the school-owner bounded queue; private `payment-verifications`
supports only independent review POST. All Phase 9 finance writes remain
default-off: `PHASE9_FEE_WRITE_ENABLED=false`,
`PHASE9_PAYMENT_EVIDENCE_ENABLED=false`, and
`PHASE9_PAYMENT_REVIEW_ENABLED=false`. No private file storage,
malware scanning, parent/student finance view, actual PaymentRecord,
refund, reversal, allocation, balance or receipt exists.

**Actual source check:** Five combined Phase 9 source-invariant predicates
were evaluated and PASSED over the final GitHub-fetched committed files
in isolated V8, including duplicate PL/pgSQL function checks. This does
**not** execute Node, Prisma, PostgreSQL, synthetic Vitest, TypeScript,
Next browser or `npm audit --audit-level=high`; those gates remain
**NOT EXECUTED / BLOCKED**, and the prior dependency-security findings
remain open. No local Phase 1/8 worktrees were modified, no GitHub
Actions, deployment or main merge. FEE-REQ-001 is PARTIAL.
See `docs/quality/PHASE9_PAYMENT_EVIDENCE_CHECKPOINT_20261016.md`;
D-P9-003 and ADR-P9-003. Next: actual disposable-PostgreSQL
verification before acceptance, then an independent append-only
adjustment/reversal/payment allocation/receipt and balance milestone.


## Phase 9 — explicit immutable student fee obligation slice (AUTHORED, NOT VERIFIED; 2026-10-16)

Following the isolated fee-configuration foundation on
`feature/phase9-fees-payments-foundation`, schema adds `FeeObligation`
and additive `20261016130000_phase9_fee_obligation_ledger` SQL.
An authenticated School Super Admin may explicitly issue a single
charge for one same-school ENROLLED pupil with ACTIVE exact class/session
enrollment and matching latest context-version of fee policy; SQL
revalidates actor/school/section/period, copies exact charge and currency
from the pinned `FeeStructureRevision`, rejects a foreign/revoked/
closed/stale context, imposes one pupil/category/term obligation,
idempotency request key and UPDATE/DELETE/TRUNCATE protections.
The server POST returns decimal-string money and same-key/same-payload
replay metadata; mismatched replay is a conflict. School-owner GET
is bounded, private/no-store and SQL rechecks active school/member.
**All financial mutations are default OFF** behind
`PHASE9_FEE_WRITE_ENABLED=true`; tests explicitly stub the flag in a
disposable fixture. No payer portal, fake payment, auto-issue, balance,
credit, payment-verification decision, receipt or provider integration.

The Phase 9 Node guard's 3 structural predicates **PASSED when evaluated
in isolated V8 against GitHub-fetched committed source**. This is NOT
an executed Node test. Prisma/SQL/real-session Vitest/Next/browser/audit
and full CI remain **NOT EXECUTED**; completion BLOCKED. The original
Phase 1 and active Phase 8 local worktrees were untouched; Phase 8
is not accepted/deployed. Next is payment evidence + separately
reviewed verification and financial ledger under unchanged security
gates. See `docs/quality/PHASE9_FEE_OBLIGATION_CHECKPOINT_20261016.md`.


## Phase 9 — Fee configuration foundation (AUTHORED, NOT VERIFIED; 2026-10-16)

Isolated GitHub branch `feature/phase9-fees-payments-foundation` was created
from the committed, cumulative Phase 7 head `18d8b8292fc37e3f131986fe6d8ab9c3038ad2e0`,
NOT from the moving `verify/phase8-local` verification worktree or its
uncommitted fixes. This deliberately avoids interfering with Phase 8 acceptance.

FEE-REQ-001 **partially authored**: immutable same-school FeeCategory and
school/category/session/term/scope-versioned FeeStructureRevision with SCHOOL,
SECTION and CLASS targets, positive BIGINT minor-unit money, explicit
3-letter currency, SQL current school-super-admin actor guard, planned/active
period checks, school-row-serialized versions, composite tenant FKs, UTC
time evidence and UPDATE/DELETE/TRUNCATE history protections.
Authenticated same-school-owner-only private no-store category/structure
GET/POST and bounded final-query rereads are authored. Synthetic real-session
role/tenant/forgery/foreign scope/version/immutability integration tests and
non-DB structural guard are authored and hooked into unchanged suites.

**Not executed:** Prisma validation/generation, SQL migrations, Node/Vitest,
typecheck, lint, build, browser and `npm audit --audit-level=high`.
No disposable local PostgreSQL runtime or installed repository checkout is
available to this GitHub-only development session. Security and upstream
Phase 6–8 acceptance remain blocked; none is marked complete.
No actual fee debts, payment evidence, verifier decisions, receipts,
balances, live integrations, merged code or deployed finance endpoint.
The next milestone is independently reviewable student fee obligations
pinning an exact fee revision, after validating the configuration SQL and
tenant deletion/revision races on a disposable DB. See
`docs/quality/PHASE9_FEE_CONFIGURATION_CHECKPOINT_20261016.md`
and D-P9-001 / ADR-P9-001.


## Phase 7 reviewed-only manual academic gradebook foundation — AUTHORED, NOT VERIFIED

**Status:** In development. MySchoolBoard has not yet launched.

**Current focus:** Phase 8 was locally accepted and merged into development
`main` via PR #106 on 6 November 2026. Phase 9 — Fees and Payments is also underway.

**Progress:** The foundation for Phases 1–7 is in place. Some subscriptions,
admissions, student examinations, and broader parent/student services are still
being completed; Phase 8 acceptance does not mark those unrelated modules done.


## Phase 8 local acceptance — 6 November 2026

**RES-REQ-001: implemented and locally accepted for development integration.**
Verified implementation source: `ce14d17faf37c0c7a58ceac279b29b28d9729a1f`. Later acceptance commits change
documentation only. Recipient publication, withdrawal, four explicit visibility
policies, verified student/guardian reads, exact-version guardian acknowledgment,
versioned corrections, report display and guarded printing are implemented.

Actual final results: **187/187 Node guards**, **385/385 Vitest tests in 45 files**,
**19/19 Chromium acceptance checks**, formatting, lint, typecheck, production build,
**49/49 exact migration checksums**, and strict/full plus production dependency
audits (**zero vulnerabilities**). No tests were skipped or disabled in the Node
or Vitest runs. All database writes used a confirmed disposable PostgreSQL service.

P8-BR-11's conditional genuine BFCache restoration was not observed:
`pagehide.persisted=false` and `pageshow.persisted=false`. Native Back/Forward,
duplicate-tab and stale-data concealment checks passed with no-store preserved;
this does not claim a genuine persisted restoration was tested. Printed reports
were captured through Chromium's native PDF renderer after the explicit fresh
access check; the headless window.print command was intercepted for capture.
Preparation and revoked-report PDFs contained no pupil markers.

The exact evidence and reproducible commands are in
[PHASE8_CLOUD_COMPLETION_20261106.md](../quality/PHASE8_CLOUD_COMPLETION_20261106.md).
Earlier authored/unverified Phase 8 checkpoints below are historical and are
superseded by this acceptance record, not retroactively changed to passes.
**Remote main integration completed:** PR #106 was merged normally on
6 November 2026 at `2e12f6098143816e529597ed97abcd268e00434c`.
The pre-merge main SHA was `aa74a0f0265fe113ad8cb4fe9440cd7f51a1b27d`.
No production release is authorized.

## Phase 8 immutable private official-result composition evidence (AUTHORED; NOT RUNTIME VERIFIED)

`feature/phase8-private-official-report-composition` adds additive `PrivateOfficialReportComposition` with tenant-keyed links to the exact immutable teacher-reviewed/final-owner-approved source packet and final decision and pinned current school-adopted assessment category weighting, school aggregation revision and report grade-scale revision. PostgreSQL INSERT reruns the school-row-locked final result readiness; computes and freezes every enrolled student's private category scores, grade percentage and adopted grade label by explicitly selected category math/rounding; validates pupil and source completeness, forbids invented scores and duplicates; DB owns context, counts, versions, nonreleased status and time. Owner-only no-store GET/POST and restricted page return metadata ONLY and accept no pupil scores. Historical versions remain immutable; further correction uses new source and approval. **Internal grade evidence is NOT a published report card**, student/guardian result, download, export or school recipient-release decision. D-060/ADR-046.

Focused DB/authorization/privacy/integrity regression tests and Node structural guards AUTHORED. No cumulative Phase 6–8 PostgreSQL, Prisma, full Node/Vitest, TypeScript, build, strict dependency audit or CI acceptance executed here; acceptance and release remain BLOCKED.

## Phase 8 school-adopted report aggregation semantics and private policy-pinned arithmetic (AUTHORED; NOT VERIFIED)

`feature/phase8-report-aggregation-policy` adds immutable per-school `ReportAggregationRuleRevision`, adopted only by the active exact School Super Admin with chosen `EQUAL_ASSESSMENT_BPS` vs `POOLED_CATEGORY_POINTS` calculation method and integer score rounding `HALF_UP/FLOOR/CEILING`. SQL INSERT rechecks current owner and School under school-row lock, assigns trusted revision/time, rejects identical duplicates; UPDATE/DELETE/TRUNCATE guards preserve policy history. A private owner-only no-store GET/POST and UI require deliberate choices (no defaults), accepting no actor/version or pupil marks. New pure deterministic `simulatePrivateReportComposition` uses pinned aggregation and grading-scale IDs/versions and immutable source packet pupil points with adopted exact category weights: rejects duplicate/missing/corrupt/unreviewed sources, missing positive-weight categories, mismatched adopted weight versions, invalid marks or score range. BigInt normalization and explicit rounding yield private calculation samples, **not official student grades**. Existing frozen source packets and prior results remain unchanged. D-059/ADR-045; RES-REQ-001 partial.

Tests and Node guards AUTHORED; no production release, new official report table, student/guardian API, export or PDF. Cumulative Phase 6–8 PostgreSQL/Prisma/Node/Vitest/typecheck/build/CI and dependency audit remain BLOCKED.

## Phase 8 school-specific versioned report grading scales (AUTHORED; NOT VERIFIED)

`feature/phase8-versioned-report-grade-scales` adds additive `ReportGradeScaleRevision`, explicit school-selected immutable grade-label coverage and rounding semantics (1–20 ordered codes/remarks and contiguous integer 0..10000 bands, decimal places 0/1/2, HALF_UP/FLOOR/CEILING and grade-band classification against unrounded vs displayed score). SQL school row lock validates active same-school School Super Admin, grade JSON structure and coverage, duplicate codes, prior unchanged scale, sets trusted version/timestamp; earlier school policies never rewritten. Owner-only private no-store policy adoption/history GET/POST, school-gated UI/navigation and private deterministic policy simulator; **no automatic default grade scale**. Source packets from PR #71 are not recalculated or altered. No official aggregate grade computation, report-card document, student/guardian result reader, School Super Admin recipient-release event or download/export. D-058/ADR-044; RES-REQ-001 partial.

Integration Vitest, pure unit tests and Node guards AUTHORED, NOT validated in PostgreSQL or full CI. Cumulative Phase 6–8 migration, dependency audit and acceptance blockers remain; publication remains DISABLED.

## Phase 8 immutable private report-card source packets (AUTHORED; NOT VERIFIED)

`feature/phase8-private-report-card-source-packets` adds additive `ResultReportCardSourcePacket` with one immutable packet per already independently reviewed and **APPROVED_AWAITING_RELEASE** School Super Admin decision. SQL rebuilds current school-row-locked publication readiness, binds current owner, latest source/adopted grading policy, school/class/subject/session/term and derives sorted allowlisted per-student CBT and independently approved written mark evidence plus adopted grading weight version directly from previously frozen source. Immutable UPDATE/DELETE/TRUNCATE protection and uniqueness preserve all historic packets. Later corrected source/policy requires a new teacher snapshot, HM/Principal review and final owner decision. Private no-store exact-school-owner GET/POST (only finalDecisionId/reason accepted) and school-gated workspace return **metadata only**, never stored `studentSourceCards`. No official percentage, band, pass mark, report document, download, school result release, parent/student visibility, automatic publication, or assumed school-specific grading thresholds. D-057/ADR-043.

Migration `20261013130000_phase8_private_report_card_source_packets`, schema/services/API/workspace and authenticated Node/Vitest/SQL tests have been AUTHORED, not PostgreSQL-runtime-verified. Full cumulative Phase 6–8 database, static, build, CI and dependency security audit gates are outstanding; exit BLOCKED.

## Phase 8 immutable final School Super Admin decision audit (AUTHORED; NOT VERIFIED)

`feature/phase8-immutable-final-publication-decision` adds additive `ResultFinalPublicationDecision` (migration `20261013120000_phase8_final_publication_decision`), a separate final School Super Admin authorizing event **APPROVED_AWAITING_RELEASE** referencing exact immutable academically APPROVED evidence. Before INSERT, SQL calls the locked full final publication readiness predicate, rejects revoked school/owner/teacher/academic reviewer grant or changed policy/pupil sources, assigns exact source academic context, adoption ID, evidence revision, per-context ordinal and trusted timestamp, rejects duplicate/superseded evidence and guards UPDATE/DELETE/TRUNCATE. A current exact active same-school `SCHOOL_SUPER_ADMIN` may POST only evidenceId + reason or GET bounded metadata-only immutable history; private no-store route and owner-only UI included. Neither stores pupil marks nor adds any report card, student/guardian access, release, export, download or official grade computation. Later correction requires new teacher snapshot, independent HM/Principal approval and new owner decision. D-056/ADR-042.

New SQL/Prisma, Node structural guards and synthetic authenticated approval/denial/second-version/revocation/privacy/immutable-history integration tests AUTHORED but not executed. GitHub-source consistency inspection only. Prior cumulative Phase 6–8 migrations, PostgreSQL, Prisma, full Node/Vitest, format/lint/typecheck/build/browser and strict dependency audit remain BLOCKED; GitHub Actions failures lack usable logs. Final public report-card release and student/guardian visibility stay DISABLED.

## Phase 8 SQL-only final publication readiness invariant (AUTHORED; NOT VERIFIED)

`feature/phase8-final-publication-readiness-guard` adds an additive **database-only** function `assert_result_publication_readiness` intended for the separate, future School Super Admin final publication transaction. With an active School lock it validates the exact active same-school School Super Admin membership/user identity, original active teacher assignment/class/section/session/term/subject, current distinct independently APPROVED PRIMARY HM/SECONDARY Principal reviewer and verified exact SECTION grant, latest frozen evidence revision, latest adopted school grading policy and SQL-rebuilt byte-equivalent student source manifest with per-pupil positive-weight category completeness. Missing, revoked, changed or superseded records fail closed. It returns boolean TRUE only to its direct SQL caller; there is **no user-facing API, official report, publication event, write, grade computation or student/guardian access**. D-055/ADR-041.

The additive migration `20261013110000_phase8_final_publication_readiness`, focused structural guard and synthetic PostgreSQL authenticated-context evidence/revocation/stale-policy tests have been authored but **not executed**. The SQL predicate is never by itself publication authorization; a later immutable final publication write must recheck inside the same SERIALIZABLE and school-locked transaction. Cumulative Phase 6–8 PostgreSQL/Prisma/full Node/Vitest/format/lint/types/build, dependency audit and GitHub CI remain UNVERIFIED/BLOCKED.

## Phase 8 owner-only academic-approved publication preflight (AUTHORED; NOT VERIFIED)

`feature/phase8-owner-publication-preflight` adds a private, bounded, metadata-only **GET** and School Super Admin screen for the latest independently academic-APPROVED result source snapshots. Both application membership and final SQL read reverify the active exact school owner; SQL further requires live original teacher/assignment, session/term/class/section/subject, independently APPROVED correct-stage current reviewer with verified exact SECTION grant, latest evidence revision, latest adopted grading policy, unchanged recomputed sourceManifest and per-pupil mandatory category evidence. Only class/subject/period names/IDs, evidence revision, count, adoption ID and review timestamp are exposed. No sourceManifest or student identifiers/marks leave SQL. Revocation, corrected marks, new policy adoption or a later revision remove an item. No POST, school publication, report-card grade, release event, export, student/parent endpoint or visibility is provided. D-054/ADR-040.

Structural Node guard and synthetic authenticated role/tenant/revocation/policy-drift/candidate-selection tests AUTHORED, NOT EXECUTED. No migration in this slice (depends on still-unexecuted cumulative Phase 8 result migration). CI remains failed/unresolved; local PostgreSQL, Prisma, full Node/Vitest, lint/format/types/build, `npm audit --audit-level=high` and release gates remain BLOCKED. This read is **not** permission or durable proof to publish; any future publication mutation must reverify everything transactionally.

## Phase 8 result-evidence integrity hardening (AUTHORED; UNEXECUTED, 2026-10-13)

On draft PR #67, the original Phase 8 SQL-wide QUIZ/TEST/EXAM coverage guard was found insufficient: the class could collectively contain every required grading category while individual pupils lacked one or more positively weighted categories. The still-unapplied `20261013100000_phase8_result_sheet_evidence_review` migration now enforces mandatory weighted category coverage **for every enrolled pupil** at both frozen teacher preparation and independent academic approval. Node guard plus synthetic PostgreSQL negative/positive tests have been **authored, not executed**. The academic integration scenario now also exercises reviewer verified SECTION grant revocation and stale-policy RETURNED → fresh evidence revision. No school-wide fallback marks, publication, or student/guardian result visibility.

Connected GitHub file commits succeeded. Local repository clone unavailable in this environment; no PostgreSQL, Prisma, Node/Vitest, audit, or CI-equivalent execution. A prior GitHub Actions run `38367505489` reported failure without available step logs; root cause unconfirmed. Historical migration is recorded as not applied; any real database that already applied it requires a separate forward migration rather than replacement. Milestone acceptance **BLOCKED**.

## Phase 8 immutable result-sheet source evidence and independent academic review (AUTHORED; NOT VERIFIED)

`feature/phase8-result-sheet-evidence-review` adds an additive **teacher-prepared frozen source-evidence snapshot** (`ResultSheetEvidence`) and separate **academic reviewer decision** (`ResultSheetReview`). It references one explicit current `ResultGradingAdoption` from the School Super Admin; the teacher may not supply marks, sourceManifest, enrollment counts, policy, actor ID or review outcome. A PostgreSQL BEFORE INSERT function acquires the current School row lock, validates the actual original active TEACHER's exact school/class/subject/session/term assignment, current enrolled roster and latest adopted school policy, and rebuilds a JSONB manifest of current sealed/independently approved/PUBLISHED-not-WITHDRAWN submitted+scored CBT and teacher-written effective marks from initial independently APPROVED decisions or latest independently APPROVED correction revisions. No answer keys, raw student options or speculative marks. Every pupil must have completed source evidence, no duplicate active enrollments, at most 500 pupils, and every positively weighted adopted QUIZ/TEST/EXAM category must have source evidence. This is a **frozen evidence manifest**, NOT a computed official report-card grade or published result.

A snapshot gets a DB-generated per-class/subject/term revision, reason, actor, trusted timestamp and immutable original marks/sources. A second snapshot is permitted **only after prior independent review finishes** and the policy adoption or SQL-computed source manifest actually changed; unchanged duplicates and an outstanding undecided revision fail closed. Independent academic reviewer is a currently active **HEAD_OF_SECTION for PRIMARY** or **PRINCIPAL for SECONDARY**, with a VERIFIED SECTION ScopeGrant for the snapshot's actual active class section, and cannot be the teacher. At review INSERT, SQL repeats current teacher/academic/verified reviewer checks and accepts APPROVED only if the snapshot is the latest and the **current adopted policy and recomputed source manifest still match exactly**. A stale snapshot can be RETURNED so the teacher may prepare a new revision; stale or superseded material cannot be approved. A decision is one-time append-only APPROVED/RETURNED, **not final School Super Admin publication**. No pupil/guardian endpoint, result export, official report-card generation, School Super Admin release or official weighted grade is introduced.

Private no-store exact teacher evidence GET/POST, currently verified-section reviewer queue GET and decision POST, school-gated teacher and academic reviewer screens/navigation, synthetic role/tenant/forged-mark/unapproved/evidence-freeze/return/approved-correction/revision and immutable-history integration tests, and Node structural guards are AUTHORED, NOT EXECUTED. Migration `20261013100000_phase8_result_sheet_evidence_review` NOT APPLIED. D-053/ADR-039. RES-REQ-001 partial; Phase 6–7/full local CI/strict dependency audit BLOCKED.

## Phase 8 school grading-policy adoption (AUTHORED; NOT VERIFIED)

`feature/phase8-adopted-grading-policy` introduces `ResultGradingAdoption` as an append-only, versioned School Super Admin decision to **adopt** a specific immutable `AssessmentGradingPolicyRevision` for one exact school/session/term/class/subject. The PostgreSQL INSERT trigger independently verifies active same-school School Super Admin member+user, exact current policy context, active academic session/term/class/section/subject, 100% explicit QUIZ/TEST/EXAM weights and serializes per-context adoption ordinals under the school row lock. Earlier draft revisions and adoptions are never rewritten. Adopting a profile only establishes the academic rule available to later result-sheet preparation; it does NOT approve or publish any result or authorize student/guardian visibility.

Private no-store school-super-admin-only GET adoption history and POST, authenticated school-gated owner workspace and navigation added. Synthetic real-session correct/foreign/role denied, duplicate-adoption, no spoofed user, immutability assertions and Node source guard authored but NOT EXECUTED. Additive migration `20261013090000_phase8_result_grading_adoption` NOT applied. D-052/ADR-038. RES-REQ-001 partial, Phase 6/7 and local CI/security/audit gate BLOCKED.

## Phase 8 private teacher result preparation preflight (AUTHORED; NOT PRODUCTION-VERIFIED)

`feature/phase8-result-preparation-readiness` starts the documented RES-REQ-001 result flow at **teacher source preparation**, without skipping HM/Principal academic review or School Super Admin final publication. A private no-store GET and school-gated teacher page use the **existing** independently authenticated exact school/class/subject/session/term CBT score and academically reviewed written-mark readers. The pure reconciliation function compares both active pupil rosters by immutable studentId plus admission number/given/family names; different, extra, missing or duplicate students and invalid counts fail closed instead of joining mismatched records. It reports missing CBT scores, initial manual academic-review gaps, outstanding correction reviews, absence of any source, and the fact that the current grading revision is merely DRAFT_PREVIEW_ONLY, not formally adopted.

All results remain `PRIVATE_PREPARATION_ONLY`, even if the source marks are otherwise complete. No combined mark formula, automatic grade, result-sheet snapshot, report-card table, teacher/HM/Principal approval, publication event, student/parent result route, file download, correct answer or answer key is authored in this slice. Phase 8 must later specify a **versioned adopted grading policy**, approved result sheet snapshots, independent verified SECTION reviews, independent final School Super Admin release and server-validated parent/student visibility, including post-publication correction amendments. Current Phase 6/7 acceptance remains blocked.

Tests added: pure readiness Vitest, synthetic authenticated teacher/wrong-role/foreign-school response and pre/post academic source review cases, Node source invariant guard registered without removing prior suites. **Executed:** 8/8 ad hoc Node smoke tests on byte-identical `result-readiness.ts` Git blob `14194e365a7387f9515a23c764f0d0b544383809`, isolated `tsc --noEmit` on same file, plus previous 5/5 standalone grading smoke on Git blob `1c16de05cbf7cee6e8b369b099c1b46b3798ad7f`. This is NOT full repository CI or actual Vitest. No migration applied or live data used. D-P8-001/ADR-037; RES-REQ-001 partial.

## Phase 8 cumulative verification before result recipient release (2026-10-13)

The next roadmap work is verification/remediation of the existing Phase 6–8 draft chain, not enabling another report recipient endpoint. A source-level defect in the private SQL composer was identified: missing/null frozen-pupil status could bypass a SQL `<>` condition under three-valued logic. A **new, forward-only** migration `20261013170000_phase8_private_composition_source_status_hardening` replaces only that condition with `IS DISTINCT FROM`; the older applied-or-unapplied migration is untouched. Authored regression cases expect missing, JSON-null, empty and altered statuses to fail closed. This has **10/10 GitHub-source diff checks**, no PostgreSQL execution. CI currently fails before any retrievable job steps; job logs 404, annotations inaccessible and failure cause unconfirmed. See `docs/quality/PHASE8_CUMULATIVE_VERIFICATION_BLOCKERS_20261013.md`. Do not start School Super Admin recipient publication or student/guardian grade visibility until cumulative database, Node/Vitest, dependency security audit and CI gates pass.

## Phase 8 merge integration SQL repair (2026-11-05; NOT ACCEPTED)

After the existing 47 migration checksums, production build, static checks and
strict audits passed locally, focused integration exposed an unquoted SQL
`grant` alias in the academic reviewer queue and an undersized
`ReportGradeScaleRevision.bandBasis` column for `DISPLAY_ROUNDED_BPS`.
A forward-only migration 48 and parser-safe reviewer-scope alias are authored
for local verification. Passing source checks alone is not acceptance; focused
Vitest, cumulative integration, fresh bootstrap and authenticated privacy
checks are still required. No recipient result release is authorized.
