# Current Status

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

`feature/phase7-reviewed-manual-gradebook` implements a distinct private, read-only **ACADEMIC_APPROVED_PREVIEW_ONLY** teacher gradebook for exact school/session/term/class/subject. Final SQL binds actual signed-in current TEACHER to matching ACTIVE class/subject/session assignment, active school/class/section/subject/period/term, ENROLLED student and exact ACTIVE class/session enrollment; results bounded 500 students, 30 written components, 15,500 rows and fail closed for duplicate enrollment/ambiguous component rows. This reader does not join assessment answer keys or CBT answers.

For each student/written component, it distinguishes **PENDING_TEACHER_MARK**, **PENDING_ACADEMIC_REVIEW**, **RETURNED_NOT_APPROVED**, **APPROVED_INITIAL**, **APPROVED_CORRECTED**, **APPROVED_CORRECTION_PENDING**, and **APPROVED_CORRECTION_RETURNED**. Effective points derive only from initial independent APPROVED decision and most recent APPROVED correction revision; pending or returned marks never replace prior approved values. No term percent is shown if any manual component lacks approved points, any correction remains pending, or there are no components: status remains INCOMPLETE. Raw partial approved mark sum is separately identified and not an official grade. Teacher workspace and private no-store GET have **no POST, export, override, student/guardian view, CBT score merger or Phase 8 report publication**.

Synthetic authenticated actual-session test cases compare unapproved original, initial APPROVED, pending correction, approved later revision, teacher-only and foreign role/tenant denial; Node source guard included in existing npm test/verify:local:guards. **AUTHORED BUT NOT EXECUTED**. No migration added in this slice (upstream approval/correction migrations remain unexecuted). Phase 6 and 7 prerequisite gates, PostgreSQL, full CI/security audit BLOCKED. D-049/ADR-035.


## Phase 7 independent manual mark corrections — AUTHORED, UNVERIFIED

`feature/phase7-manual-mark-correction-decisions` implements immutable, sequential `AssessmentManualCorrectionRequest` and one terminal `AssessmentManualCorrectionDecision` per request. Original active same-school TEACHER/assignment may propose changed 0..max integer points **only after independently APPROVED initial mark**, with a 5–500 character reason. The school-row-locked PostgreSQL insert guard checks active exact original teacher, school/class/section/subject/session/term, original pupil/enrollment, rejects a second pending request, rejects a proposed value equal to the last approved effective mark and assigns the next revision and UTC timestamp. The reviewer must be the separately verified exact class-section **HEAD_OF_SECTION for PRIMARY** or **PRINCIPAL for SECONDARY**. Shared initial-mark SQL reviewer validation runs again on each terminal correction decision; stale/duplicate decisions and historical UPDATE/DELETE/TRUNCATE are prohibited.

A correction is not an overwrite. The initial mark remains and effective *academic-approved* points are the latest APPROVED correction revision, or the approved initial mark when no correction has been approved; pending and RETURNED revisions remain audit-only. Current exact TEACHER may see their own approved mark history and request correction; verified-section reviewer sees only eligible pending requests via repeated final SQL joins. Private no-store routes and school-gated teacher/reviewer pages authored. Synthetic real-session correction/review/return/race/immutability tests and Node guards authored but NOT EXECUTED. No official result publication or CBT key exposure, no live data or merge. D-048/ADR-034. Local disposable PostgreSQL, full CI, strict audit, prior Phase 6/7 gates BLOCKED.


## Phase 7 manual mark initial academic review — AUTHORED, NOT VERIFIED

`feature/phase7-manual-mark-section-approval` introduces immutable `AssessmentManualMarkDecision` with a unique original proposal link and terminal `APPROVED` or `RETURNED` outcome, reviewer identity, reason and trusted SQL UTC clock. Only an ACTIVE same-school **HEAD_OF_SECTION for PRIMARY** or **PRINCIPAL for SECONDARY** with a **verified SECTION grant for the actual proposal class's current section** may make a decision. School, member, original teacher/assignment, academic term, ENROLLED student and matching ACTIVE enrollment are independently checked inside PostgreSQL. No reviewer can self-approve, forge a user ID, amend a decision or submit a second outcome. The decision is approval of the initial manual mark, not final or publicly released results.

The private reviewer queue final query repeats verified section, role/stage, current student and assignment joins; only its own relevant initial pending proposals are returned. The reviewer UI and private no-store decision API preserve reasons and do not expose answer keys. Synthetic authenticated tests for wrong role/section, duplicate and immutable audit and read-only Node guard authored, NOT EXECUTED. Phase 6/prior Phase 7 DB migration and full strict local CI/security acceptance remain BLOCKED. D-047 / ADR-033; Phase 7 partial.


## Phase 7 teacher-entered written mark proposals (AUTHORED; UNVERIFIED)

`feature/phase7-manual-mark-proposals` adds append-only exact teacher-owned offline/written assessment components plus one bounded, reasoned unapproved mark proposal per ENROLLED pupil in that class and ACTIVE session enrollment. SQL checks actual teacher membership, original class/subject/term assignment, school and student binding, rejects duplicate proposals and historical edits. Private teacher roster and editor authored with no-store routes; no student/official result exposure, no grading total inclusion until independent review. Tests/SQL/authored only and NOT EXECUTED; migration/local CI/dependency audit and Phase 6 prerequisites still blocked. Written mark approval and correction need separate development.


## Phase 7 school grading preview revisions (AUTHORED; NOT VERIFIED)

`feature/phase7-grading-policy-revisions` adds append-only school/session/term/class/subject draft-only grading weights (QUIZ/TEST/EXAM integers sum exactly 100) with SQL current School Super Admin authorization, versioning, immutable history and no production activation. Private admin editor and current teacher-assigned provisional class sheet show latest matching profile and complete-only weighted preview. Missing/unscored categories with positive weight remain PENDING, never zero. Objective scores, historical audit and official results remain unchanged. Synthetic and pure tests authored but NOT EXECUTED; Phase 6 prerequisite, full local CI-equivalent and strict dependency audit BLOCKED.


## Phase 7 teacher marking and provisional class sheets (authored; UNVERIFIED)

`feature/phase7-private-class-record-sheets` adds a private exact-teacher unscored submitted-attempt queue, key-free bodyless marking action linked to SQL-calculated immutable objective scores, and provisional per-student class/subject/term record sheets (best scored attempt per approved, published and not-withdrawn assessment; pending distinct from zero). The final query reauthorizes exact assigned TEACHER/school/session/term/class/subject and returns only currently active student enrollments. Capped 500 active students, 30 assessments and 15,500 result rows with duplicate enrollment rejection; no student marks/results publication, parent access or export. Synthetic tests and source guards AUTHORED not EXECUTED. Phase 6/Phase 7 local CI, DB and security audit BLOCKED; no production release.


## Phase 7 internal objective CBT auto-scoring (AUTHORED, NOT VERIFIED)

`feature/phase7-cbt-objective-scoring` adds immutable `AssessmentAttemptScore` (one per exact school/attempt) with max/earned weighted marks, basis-point percentage, correct count, pass threshold and UTC timestamp. An authenticated current ACTIVE exact original TEACHER for the assessment class/subject/session invokes an **internal-only** serializable scoring function after a terminal submitted attempt on a sealed, APPROVED and PUBLISHED (not withdrawn) active assessment. SQL BEFORE INSERT repeats the exact actor/teacher/assignment/term/submission authorization and **computes all numeric results itself** by joining the private `AssessmentQuestionKey` in the database and selecting each question's highest accepted response revision, counting unanswered questions as zero. The service never selects keys or accepts numeric grades from the client. Score records cannot be updated/deleted/truncated or duplicated; idempotent calls return the one original snapshot. Student scoring/result endpoints and official report publication remain absent. Synthetic correct/latest-response, unauthorized scoring, replay and immutable audit tests plus Node guards AUTHORED BUT NOT EXECUTED; no migrations or full CI/e2e/audit run. This is objective marking only—manual theory marking, review and official results are separate. D-043/ADR-029. Phase 6 and Phase 7 exit BLOCKED.


## Phase 7 key-blind enrolled-student CBT resume (authored, NOT VERIFIED)

Cumulative `feature/phase7-cbt-private-resume-reader` implements `readInternalCbtAttempt`: an **internal-only** single final SQL query for one exact signed-in, active STUDENT membership → unrevoked administrator-attested StudentAccountLink → ENROLLED StudentRecord and ACTIVE exact class/session StudentEnrollment → sealed, separately APPROVED and PUBLISHED/not WITHDRAWN assessment, current teacher assignment/class/section/subject/session/term, and an unsubmitted attempt strictly inside its server deadline. Returns bounded (up to 50) ordered question prompts/options/points and **only that student's latest saved answer option/revision** with an attempt's ID/number/title/server time bounds; no answer key, `correctIndex`, grade, other student, pupil PII or staff questions. After submission, expiry, revocation or withdrawal, the query returns NOT_FOUND. This foundation deliberately creates **no student-facing API or browser path** pending full Phase 6/student/DB security acceptance. Synthetic real-session test cases for owner/wrong actor/tenant/latest revision/after-submission and read-only Node guards are AUTHORED BUT NOT EXECUTED. All previous strict local CI/audit gates still required. See D-042 / ADR-028.


## Phase 7 immutable CBT autosave and terminal submission candidate (authored; UNVERIFIED)

Cumulative `feature/phase7-cbt-answer-submission-ledger` adds additive school/attempt/question/member-bound immutable answer events (idempotency key, SQL-assigned per-question revision and UTC timestamp), one terminal immutable attempt submission, and a shared school/attempt-locked validator rechecking current student identity/enrollment/approved+published unwithdrawn sealed draft/current teacher assignment and deadline. Student save/submit functions are **internal only** and return metadata acknowledgements, not answers, keys, grades or scores. Synthetic tests for replay, changed answer, forged actor/foreign question, submission and audit-tamper protection plus Node invariants AUTHORED, NOT EXECUTED. **No student route, CBT UI, key-blind learner question projection or scoring.** Local migrations, strict audit, full CI and Phase 6 prerequisites remain BLOCKED. No merge, deployment or live data.


## Phase 7 internal-only student CBT attempt reservation ledger (authored; UNVERIFIED)

`feature/phase7-cbt-attempt-ledger` cumulatively builds on #53 and adds an additive immutable `AssessmentAttempt` model/SQL trigger for exact published, unwithdrawn, separately APPROVED school/class/session/term exam; signed-in school STUDENT membership; admin-attested unrevoked one-to-one student link; matching ENROLLED StudentRecord/active exact StudentEnrollment; SQL-atomic maxAttempts 1–3, no concurrent unexpired attempt, trusted UTC deadline bounded by exam close. Internal serializable admission service is **not** exposed as a student API and returns only attempt metadata. No question delivery, autosave, submission, key access, scores or class sheets. Synthetic integration and source guards AUTHORED, NOT EXECUTED. Phase 6 and all local migration/CI/audit acceptance remain blocked. No live data, merge or deployment.


## Phase 7 independent school assessment publication (authored; UNVERIFIED)

`feature/phase7-assessment-publication-ledger` cumulatively adds an immutable School Super Admin-only PUBLISHED/WITHDRAWN event ledger, separate from the prior exact HM/Principal section-approved sealed draft. Service and additive SQL validate active exact school, actor/membership, approved review, teacher assignment, class/section/subject/session/term, seal, no prior publication, withdrawal state and audit immutability. Private publication GET/POST, School Super Admin page and synthetic tests authored. **No student exam delivery/attempt/score or keys read endpoint is present.** Tests, migration and full CI-equivalent NOT EXECUTED; Phase 6 remains unverified and Phase 7 ASM-REQ-001 remains partial. GitHub Actions billing restriction continues; no merge, deployment, live data or security relaxation.


## Phase 7 section assessment moderation and CBT timing preflight (authored; UNVERIFIED)

`feature/phase7-cbt-attempt-foundation` on cumulative PR #51 adds immutable terminal APPROVED/RETURNED academic decisions restricted to exact verified HM PRIMARY/Principal SECONDARY sections, SQL active actor/class/term/assignment audit guard, no-store reviewer queue and ordered key-free draft question preview plus restricted reviewer workspace. Adds pure future CBT deadline/attempt limit planning helper and unit tests; **no student exam publication, attempt API, autosave, scoring or official class-record sheet**. Repairs invalid function dollar-quoting in the parent assessment-draft SQL migration. Synthetic stage/scope/revocation/key-nondisclosure/immutable decision tests and read-only Node guards are AUTHORED, NOT EXECUTED. No disposable PostgreSQL migration, Prisma, Node/Vitest, TypeScript, lint, Next build, browser/accessibility or strict dependency audit run. Phase 6 dependency and Phase 7 ASM-REQ-001 exit gates remain blocked.


## Phase 7 immutable assessment draft configuration (candidate; UNVERIFIED)

`feature/phase7-assessment-draft-config` extends #50 question bank with review-only additive assessment DRAFT records for exact active school/class/subject/session/term TEACHER assignment, configurable UTC time windows, duration (5–180 minutes), max attempts (1–3), passPercent (0–100), and 1–50 positioned privately keyed questions (1–20 points). An immutable seal prevents future question attachments; only sealed drafts appear on private teacher metadata GET. API/UI are teacher-gated and do not provide student exams, keys, scoring or results. Synthetic authenticated database tests and read-only Node invariants **AUTHORED, NOT EXECUTED**. Both Phase 6 dependency and full Phase 7 CI-equivalent/security gates remain **BLOCKED**. No merge, deployment or live data.


## Phase 7 — initial assessment question bank foundation (draft; unverified)

Based on Phase 6 cumulative `feature/phase6-verified-student-lesson-access` at `a71774ae4d1d9ad6bcfb5988fe7d9eaec19e0ba1`, `feature/phase7-question-bank-foundation` authors an additive exact-assignment school/class/subject/session/term MCQ question bank, separate secret and immutable answer keys, protected teacher-only create/metadata GET and authoring UI, synthetic role/tenant/key non-disclosure/immutability tests, and read-only schema invariant tests. **No Prisma migration, disposable DB test, Vitest, Node invariant test, browser, lint, typecheck, build or security audit has run.** Phase 6 remains unverified, so Phase 7 cannot be accepted or enabled for student delivery. ASM-REQ-001 is partially authored only. No merge/deploy/live data/security waiver.


## Phase 6 student-linked lesson delivery and schemes of work (authored; UNVERIFIED)

`feature/phase6-verified-student-lesson-access` adds school-admin-attested immutable StudentRecord→STUDENT Membership binding and terminal revocation, private student lesson list/detail with exact currently enrolled school/class/session and active academic term plus approved RELEASED / NOT WITHDRAWN current revision checks, a student page, and an administrator identity-link workspace. Adds typed SCHEME_OF_WORK documents with immutable week ranges (1–53) through existing exact assigned teacher drafts, immutable revisions, HM/Principal section approval and separate release workflows. Synthetic role, cross-class, revocation, term-close and scheme lifecycle tests plus read-only Node guards are **AUTHORED, NOT EXECUTED**. A limited 12/12 GitHub-fetched **static source-presence inspection** passed; this is neither Prisma validation nor database/Next execution. The release/security gate and Phase 6 status remain **BLOCKED** pending migrations, full local CI-equivalent, browser/accessibility, identity evidence and outstanding security audit findings. No merges, deployment, live data or broadened permissions.


## Phase 6 approved lesson-note release (authored, not verified)

`feature/lesson-approved-release-foundation` extends the cumulative attendance/student/teacher/reviewer work with immutable reasoned RELEASED/WITHDRAWN events on approved lesson revisions. The exact current approved revision, active academic/teacher/section structure and verified HM PRIMARY/Principal SECONDARY scope are validated both transactionally and by additive PostgreSQL SQL; release is independent of review. A restricted reviewer queue and browser controls are authored, and synthetic real-session cases added to existing lesson-review suite for role/stage/duplicate/stale/withdraw/audit denials. **Tests and migration NOT EXECUTED.** No student content read is exposed without an authenticated verified account-to-enrollment mapping. LES-REQ-001 is partially authored, not complete.


## Phase 6 explicit teaching/non-teaching dates (development candidate)

Draft branch `feature/attendance-nonteaching-calendar` builds on #45 and adds a school-owned immutable per-day designation ledger, calendar SQL insertion and audit guards, active administrator mutation API, guarded school policy UI, and denial of new attendance submissions on explicitly closed days. Existing real attendance days cannot be reclassified; default without school/day revision is teaching-day, with no inferred weekends or national holidays. Synthetic admin, role, history and direct-actor tests are **authored but not executed**; database migration and comprehensive local CI are pending. Phase 6 ATT-REQ-001 remains unfinished and unverified.


## Phase 6 school attendance calendar configuration (draft, unverified)

Cumulative `feature/attendance-school-calendar-policy` adds an additive append-only school timezone and submission/correction-window policy revision, SQL role/actor/revision/timezone guard, private School Administrator / School Super Admin editor and POST, current policy admin read, and school-local calendar-day eligibility checks on submission and correction requests with independent direct-SQL triggers. The earlier UTC nonfuture submission safeguard remains intact. Pure DST/timezone/date-boundary Vitest unit and synthetic administrator role, audit immutability and versioning integration tests are **AUTHORED BUT NOT EXECUTED**. A separate, ad hoc Node 22 smoke harness against the SHA-verified byte-identical production `school-date-policy.ts` helper **executed 12/12 checks successfully**; these checks do not run the authored Vitest suite or establish PostgreSQL behavior. School holiday/calendar-day exceptions remain unimplemented. The additive migration is review-only; no database command, typecheck, build, Vitest, real browser, full local CI-equivalent or strict dependency audit has run. All cumulative drafts remain unmerged and unreleased. ATT-REQ-001/TEN-REQ-001/SEC-REQ-001 are not complete.


## Phase 6 attendance roster DB-integrity hardening — draft/unverified

Review identified that `validate_attendance_event_actor` in the earlier migration permits a direct SQL submission with a single individually valid mark, even where a class has additional active enrollments. New `feature/attendance-ledger-integrity-hardening` adds an additive SQL `BEFORE INSERT` submission-event guard with full current active roster counts, 500-entry cap and class/enrollment/pupil relationship comparisons, plus a direct-DB rollback integration test and read-only schema/migration consistency test integrated in standard `npm test`. The existing required full CI-equivalent command sequence and `npm audit --audit-level=high` remain unchanged. **The Postgres tests, Node test runner, migration, format/lint/typecheck/build, full CI, and audit have NOT run.** Ten limited GitHub fetched-file static presence checks passed; this is not proof that the migration works. ATT-REQ-001 and SEC/TEN requirements remain incomplete; no merge/deploy/live data.


## Attendance correction read and UI workspaces (new draft; UNVERIFIED)

`feature/attendance-correction-review-workspaces` builds on the unmerged immutable correction ledger and adds exact Form Teacher-approved-register list/detail reads with original/effective marks, verified HM/Principal section correction queue/detail reads that omit pupil marks/names until authorized detail, private GET endpoints, server-protected request and independent-review browser workspaces, and school navigation. Synthetic real-session tests for authorized projection, stage/grant revocation, foreign-school concealment, PII-free queue and latest-approved overlay are **authored not executed**. The additive migration and all underlying attendance tests/build/audit remain **unexecuted**. No live data, merge, deployment or production disclosure is authorized. D-028/ADR-014 apply; ATT-REQ-001 remains partially authored and unverified.


## Phase 6 immutable attendance corrections — new draft (UNVERIFIED)

`feature/attendance-immutable-corrections` extends the unmerged attendance workspaces with additive revisioned `AttendanceCorrectionRequest` and `AttendanceCorrectionDecision` schema/migration; private POST request and independent review services; exact ACTIVE PRIMARY Form Teacher class/session and HM PRIMARY / Principal SECONDARY verified section checks; SQL actor/revision validation, composite school/entry/register keys, pending-request serialization and immutable no-truncate history. No original mark or prior decision is updated. The existing `AttendanceEvent` Prisma relation map is also corrected to match its migration. Synthetic PostgreSQL integration cases are **AUTHORED NOT EXECUTED**. No correction queue/effective-mark reader/UI, local migrations, full build or security audit has run; school timezone/correction-window policy remains unresolved. Hosted GitHub Actions remains blocked by billing. The cumulative branch is unmerged and **ATT-REQ-001 remains incomplete**.


## Phase 6 attendance role-scoped reads and browser workspaces (draft, unverified)

`feature/attendance-scoped-read-workspaces` builds on the unmerged attendance ledger and adds a SQL single-statement Form Teacher roster reader, exact stored SECTION-grant HM/Principal pending queue/detail readers, authenticated private GET routes, two server-restricted browser workspaces with explicit complete-class marks and reasoned reviews, and role-aware school navigation. Synthetic disposable-database tests were authored for role/stage, tenant, grant revocation, data minimization, queue privacy, navigation and detail disclosure. **No tests, browser checks, migrations, formatting, typecheck, build or npm audit were executed on this branch**. The immutable correction lifecycle, school timezone policies, historical enrollment transitions, full local CI-equivalent checkpoint and hosted billing blocker remain outstanding; this does not complete Phase 6 or authorize production release.


## Phase 6 transactional attendance ledger and section approvals (authored; NOT verified)

The cumulative `feature/attendance-register-ledger` branch adds an additive Prisma schema/migration, exact-relationship register and student-mark foreign keys, database date/class/session uniqueness, append-only event/entry guards, actor-validating submission/decision triggers, and a deferred event-consistency check. Two private POST routes use authenticated active-school Form Teacher PRIMARY responsibility (exact class/session/student enrollment and complete current roster), and verified stage-matched section HM/Principal decision authorization with serializable locks. Unit and synthetic-disposable-PostgreSQL scenarios for cross-school/role denials, absent or duplicate marks, rejected partial roster, revoke-before-submit, concurrent duplicates, approval scope and audit tampering are **AUTHORED BUT NOT EXECUTED**. The historical attendance correction lifecycle, teacher roster UI/read, review queue/UI, full browser verification and local CI-equivalent security gate remain outstanding. PostgreSQL migration is **review-only and unexecuted**; hosted Actions are still blocked by billing. D-026 / ADR-012 document UTC date and terminal-decision development defaults, not completed school-policy decisions or acceptance of security risk.


## Phase 6 attendance permission foundation (draft, not operational)

The `feature/attendance-eligibility-policy` branch based on the unmerged student administrator workspace introduces testable pure predicates for exact student/class/session enrollment, current PRIMARY Form Teacher responsibility, and section-stage-specific verified HM/Principal approval. Authenticated transactional data loading, secure mutation routes, class/date duplicate prevention, immutable attendance submissions/decisions/corrections, UI and PostgreSQL authorization/concurrency tests are **not implemented**. Unit tests are **authored, not executed**; the cumulative branch is unverified and may not be merged or released until the agreed local CI-equivalent checkpoint and mandatory security gate are satisfied.


## Student administration workspace (draft; validation pending)

From verified base `741f8eb028a3d41125b5a509292bd0ce8f6e3237`, `feature/student-admin-workspace` adds an administrator-only student register, bounded history read, and browser controls invoking the existing audited register/enroll/withdraw POST routes. An authenticated active same-school `school:configure` principal and per-query membership/tenant predicates gate all reads. Synthetic disposable-database isolation tests have been authored **but not run**. No migration, full CI-equivalent run or dependency-audit execution is claimed for this candidate. Phase 6 attendance entry, exact active class/session/student verification, Form Teacher permission, section-specific HM/Principal approval and immutable attendance events remain to implement; no attendance endpoint has been exposed. The existing security audit gate remains mandatory and the hosted GitHub Actions billing block remains unresolved.


## Status summary

The project is no longer documentation-only. A verified local Phase 1 foundation has been implemented in the working tree and validated against the repository’s auth, tenancy, migration, and build workflow. The implementation remains local-only and is not a production deployment.

## D-020 teacher-assignment administration read implementation (pending local verification)

The new `feature/assignment-admin-read-api` branch adds an authenticated list/detail teacher-assignment administration API using the D-020/D-023 conservative `school:configure` reader permission. Each final assignment SQL query rechecks active school, membership, authenticated actor and role. List results use selected fields with a 50-record cap and tenant-validated cursor; reads are non-cacheable, generic on denial/error, and never return audit events. Eleven new disposable-PostgreSQL integration cases and a revised mutation-route negative-export check were authored. **No full CI-equivalent database test, lint, typecheck, build, or audit run has been performed on the changed branch.** New code remains an unmerged draft and does not complete TEN-REQ-001, SEC-REQ-001 or TCH-REQ-001.

## Phase 3 platform school onboarding and lifecycle foundation (pending local verification)

On the cumulative `feature/platform-school-onboarding-lifecycle` branch, new schema and a review-only migration add nullable lifecycle state for existing schools and immutable platform lifecycle events. Platform-only transactional onboarding starts new schools as PENDING and inactive; state changes update lifecycle and the existing `isActive` tenant barrier together. A transition policy, two platform API POST handlers, unit and database integration tests have been added. **No migration, test suite, lint, typecheck, build or dependency audit has yet run for this branch.** Staff invitation, plans/subscriptions, tenant read-only/export policy, physical closure/retention and browser/admin UI remain incomplete. The new schema is a development-only additive design and is not deployed.

## Phase 4 academic sessions, terms and class/subject configuration (pending verification)

The cumulative `feature/academic-session-term-foundation` branch adds school-owned `AcademicSession`, `AcademicTerm` and append-only `SchoolConfigurationEvent` schema plus migration. Four create-only school-admin endpoints create PLANNED sessions/terms and active school-owned classes/subjects under transactional `school:configure`, preserving prior teacher-assignment histories. Date/term containment and same-school ownership are validated; five database-backed cases for role/tenant denials, duplicates, range validation and immutable events were authored. **The migrations, PostgreSQL tests, Next build, typecheck, lint and high-severity audit have not been executed on this cumulative candidate.** No UI, section/stream policies, academic session activation or published-record grading recalculation is claimed.

## Phase 4 school setup workspace and tenant-scoped configuration reads (pending verification)

The cumulative `feature/school-setup-workspace` branch adds a restricted school-admin setup page, a client editor for new sessions/terms/classes/subjects, and a read service that rechecks same-school active membership/role in each final query. Four database-backed tests for authorized data selection, other-school concealment, inactive membership and final-query predicates are authored. **No full CI-equivalent validation, browser accessibility/HTTP verification, migration execution, or audit run has been performed** on this candidate. The workspace is not evidence of complete Phase 4, grading configuration, Section/Guardian enrollment models or academic workflow publication.

## Academic session and term activation/closure (pending verification)

The `feature/academic-period-lifecycle` branch adds two protected academic period status routes, reasoned state changes and audit records, and Activate/Close controls in the school-admin setup workspace. The application uses serializable transactions and database partial unique indexes to preserve only one ACTIVE session/term per scope; closing a session is blocked until all its terms are CLOSED. It adds an additive event-type/reason migration and new policy/database regression cases. **No migrations or full CI-equivalent verification have been run on this branch.** Academic session-scoped teacher allocations, Form Teacher responsibility, assessment workflows, and published-grade history remain future Phase 5+ work.

## Phase 5 session-specific teacher assignments (pending local verification)

The `feature/session-aware-teacher-assignments` branch adds nullable academic-session references to existing teacher assignments, preserving every legacy NULL-session row and its uniqueness in a partial index. A separate unique index permits the same teacher/class/subject in different school-owned academic sessions. New create requests may include a session ID, validated as ACTIVE and same-school in the serializable mutation; reactivation repeats this check. Principal resolution excludes closed-session assignments and teacher academic authorization requires the exact session, not a loosely related class/subject pair. The assignment administration GET includes nullable `sessionId`. Policy and database-route regression tests are authored; **the migration, tests and full CI-equivalent checks have not been run**. Form Teacher assignments and timetable constraints remain future Phase 5 work.

## Phase 5 Form Teacher assignment, handover and co-responsibility (unverified)

The cumulative `feature/form-teacher-responsibility` branch introduces separate school-owned session/class Form Teacher responsibilities; unique active PRIMARY and teacher/class/session constraints; optional school-configured SUPPORT relationships (off by default); append-only auditable assignment, handover and end events; and a separately audited school policy toggle. Four protected routes and six DB-backed integration cases are authored. All changes preserve legacy/period teacher-subject assignments and do not automatically grant a Form Teacher access to pupil data or another subject. **No migration, new DB test, full CI, lint, typecheck, build or audit has been run** on this cumulative branch. The next roadmap slice is timetable-slot and conflict integrity, then attendance/lesson planning foundations. PR stays draft, no `main` merge/deploy/release.

## Phase 5 timetable conflict foundation (awaiting local verification)

The `feature/timetable-conflict-foundation` branch authors school-owned room/slot/event models and a migration with PostgreSQL `btree_gist` teacher/class/room overlap exclusions, plus three school-admin-only room/slot/cancellation POST routes and six database-backed regression cases. Scheduling requires the exact ACTIVE school-owned session/term teacher allocation, while cancelled slots remain audit history. **The migration, tests, lint, TypeScript, build, and CI-equivalent audit have not run.** Protected timetable read UI, room lifecycle, actual concurrent collision evidence and Phase 6 lesson attendance remain pending. No merge or deployment is authorized.

## Phase 5 timetable administration workspace (awaiting local verification)

The cumulative `feature/school-admin-timetable-workspace` branch adds a protected, server-rendered weekly timetable view, a client editor for school-owned room/scheduling/cancellation POST flows, and a read helper that repeats active school-membership/role predicates for every selected record collection. An academic setup navigation link is visible only after server permission checks. Five database-backed isolation cases cover active school data, wrong-school and teacher denials, membership revocation, SQL query scopes, and cancelled-booking exclusion. **No new test, actual browser run, build, local PostgreSQL migration, or complete CI-equivalent audit has been executed.** Student timetables, room lifecycle, timetable editing, planned-term previews, capacity/stream allocation and Phase 6 attendance/lesson-note workflows remain open.

## Phase 6 lesson-note author drafts, immutable revisions and submission (unverified)

The cumulative `feature/lesson-note-drafts-and-submission` branch authors `LessonNote`, `LessonNoteRevision`, `LessonNoteEvent` schema and an additive SQL migration, a teacher-only transactional authoring service, five authenticated school-scoped HTTP operations, and six real-session database integration cases. Notes are bound by composite foreign keys to an ACTIVE same-school academic term/session and exact teacher/class/subject assignment. A teacher can create, list/view own notes, revise a DRAFT with a version check and submit it; content and audit events remain immutable. **SUBMITTED does not mean approved or published.** HM/Principal section-scoped review/return, release to verified enrolled students, schemes of work and attendance remain separate Phase 6 slices. No new migration, Vitest integration test, formatter/lint/typecheck/build or CI-equivalent dependency audit has run on this branch. No student data or production environment was accessed.

## Phase 6 teacher lesson-note authoring workspace (awaiting verification)

The cumulative `feature/teacher-lesson-planning-workspace` branch adds a Better Auth guarded teacher lesson-note page, a teacher-specific term/assignment option selector that repeats school/role/member scope in its final DB queries, a draft/revision/submission editor reusing the protected Lesson Note APIs, and home navigation exclusively for active teacher-role memberships. Four direct database-backed option-scope cases are authored, complementing six earlier lesson-note API cases. **No migrations, new tests, browser accessibility flows, lint, typecheck, production build or full CI-equivalent dependency audit were run.** School review/revision-return, signed-off publication, student visibility, schemes of work and attendance enrollment requirements are not implemented.

## Phase 5–6 Section/class ownership prerequisite (unverified)

The cumulative `feature/verified-school-section-ownership` branch adds a school-owned PRIMARY/SECONDARY Section model, nullable same-school class section reference with no legacy inference, two school-admin section-configuration mutations with reasoned audit, and principal filtering of verified foreign/inactive SECTION IDs. Five real-session DB integration cases are authored; **no migration, test, format, lint, typecheck, build or full CI audit was run**. HM/Principal section-scoped review, timetable writes, student enrollments and attendance remain closed until exact class-to-section and stage checks are independently implemented.

## School section/class configuration interface (awaiting local verification)

The cumulative `feature/school-section-setup-workspace` branch extends the protected school admin academic setup reader/editor to list explicit primary/secondary sections and class mapping, create sections and assign unclassified classes through the previously authored audited school-owned APIs. Two new tenant-isolation DB tests are authored. **No migration, DB test, real browser, lint, typecheck, build or full CI-equivalent audit has run**. The new UI does not grant HM/Principal approval or attendance authority, nor reclassify old rows automatically.

## Phase 6 section-scoped lesson-note review (development candidate, unverified)

The cumulative `feature/section-scoped-lesson-review` branch implements HEAD_OF_SECTION PRIMARY-only and PRINCIPAL SECONDARY-only review of SUBMITTED lesson notes tied to the exact active school-owned class section and verified grant. It authors a PostgreSQL status/event enum extension, reasoned immutable review-event trigger validation and a one-decision-per-revision unique index; three private/no-store reviewer routes; and seven real-session DB integration scenarios. A RETURNED note requires a new immutable original-teacher revision before resubmission; APPROVED does not publish. **SQL migration, DB tests, concurrent approvals, formatting, TypeScript, build, real Next/browser and full CI-equivalent audit are not executed**. Reviewer UI, section stage/scopes at other academic routes, enrollments, student release and attendance remain pending; do not call LES-REQ-001 or SEC-REQ-001 complete.

## HM/Principal lesson reviewer workspace (draft, pending verification)

The cumulative `feature/lesson-reviewer-workspace` branch extends section-scoped lesson-review APIs with a restricted Next server reviewer page, guarded school-detail navigation and a client queue/detail UI for reasoned `APPROVE` or `RETURN` using exact revision numbers. Four new synthetic DB-backed navigation tests are authored; prior seven review API tests remain authored but unexecuted. **No new DB test, migration, browser, typecheck, build, format/lint or full local CI audit has run**. Both approval and return preserve immutable history; APPROVED content stays non-public. Enrollment and student release, class-specific attendance, HM/Principal timetable control and production readiness remain out of scope.

## Student enrollment ledger foundation for attendance (unverified)

The cumulative `feature/student-enrollment-ledger-foundation` branch adds school-owned `StudentRecord`, `StudentEnrollment` and immutable `StudentEvent` models plus an additive migration; three private `school:configure` admin-only routes register a distinct student, place them into an ACTIVE session and explicitly section-classified class, and withdraw while preserving historical class/session. No legacy/student User link or historic mapping is inferred; no student/guardian/teacher record list or attendance endpoint exists. PostgreSQL composite tenant FKs and one-ACTIVE-per-student/session partial uniqueness guard accidental cross-school or duplicate enrollments. Six new disposable DB integration scenarios are authored; **migration, tests, concurrent checks, typecheck/lint/format, Next build/browser and full unchanged CI-equivalent audit have not run**. ADM-REQ-001, ATT-REQ-001, TEN-REQ-001 and SEC-REQ-001 remain partial/unverified. A school-owned enrollment history is a prerequisite, not full admission, attendance or release authorization.

## Current evidence

- Published development checkpoint: `checkpoint/phase1-tenant-safe-foundation`; `main` remains unchanged
- Remote review: commit `2c7c6b9a905272ac5f9cc70d06b67367b2c1c791` was verified on [draft PR #1](https://github.com/Wilberry/myschoolboard/pull/1) on 2026-10-11; consult live Git history for subsequent changes
- Application stack: Next.js 16, React 19, TypeScript, Better Auth, Prisma, PostgreSQL
- Database: local PostgreSQL running on port 5433
- CI workflow: present in [.github/workflows/ci.yml](../../.github/workflows/ci.yml). The first draft-PR GitHub Actions run completed with failure; individual failure steps have not yet been confirmed, and the high-severity audit gate remains enabled
- Application implementation: Better Auth local session integration and server-side tenant checks exist for implemented paths
- Fresh validation on 2026-10-11: the full working-tree suite passed 83 tests across 8 files, including the private-storage prototype. A separate exact candidate reconstructed from HEAD plus the selected publication manifest passed 78 tests across 7 files. Prisma Client generation succeeded; all 6 migrations and guarded demo seed succeeded against a tmpfs-backed disposable PostgreSQL service, which was removed afterward. Formatting, lint, typecheck, Prisma validation, and production build passed for the reduced candidate. Route tests invoke handlers directly with real Better Auth sessions and PostgreSQL; Next request context is stubbed. This is not full server/browser E2E.
- Deployment configuration: not implemented; hosting remains explicitly deferred
- Security model: server-side authorization and tenant membership checks enforced; RLS is not enabled
- Academic assignment foundation: school-scoped models, active normalized-name indexes, Better Auth-backed management service, assignment-aware policy helper, transactional row-lock revalidation, and database-enforced audit association are implemented in the current working tree. Four school-scoped mutation routes (create, deactivate, revoke, reactivate) call the transactional service and pass route-level integration coverage. No assignment UI, list/detail route, or academic read route exists; assignment read authorization remains unresolved under D-020. TCH-REQ-001, TEN-REQ-001, and SEC-REQ-001 remain specified and incomplete; Phase 4/5 remain incomplete.
- Dependency audit: full audit reports 8 high package entries from two advisories; production-only audit reports 3 entries from the Prisma/deepmerge-ts advisory. D-022 Option C is approved through 2026-10-18 only for the scoped development feature branch and draft PR, with disclosure and the unchanged CI audit gate; it is not production risk acceptance and does not authorize push. D-015 Option A remains active outside this narrow exception. The checkpoint push and draft PR were separately authorized and completed; no merge, deployment, release, or dependency override is approved. See [assessment](../security/DEPENDENCY_ADVISORY_ASSESSMENT.md).

## Pending local-CI follow-up

On the separate `feature/local-verification-and-health` development branch, a dependency-free liveness endpoint and its focused tests have been added, together with a guarded script to run the unchanged GitHub Actions command sequence locally against the disposable test database. GitHub Actions runners remain unavailable because of an owner-reported billing restriction. **These changes have not yet passed the full local application CI sequence**, so they are not evidence of a completed Phase 1 exit gate. The eight previously identified high-severity dependency findings remain open; no merge, production release, or deployment is permitted by D-022. See [Local CI Verification Runbook](../quality/LOCAL_CI_RUNBOOK.md).

## Additional security follow-up awaiting local verification

On the separate `feature/school-read-response-hardening` branch, the existing authenticated school-details endpoint is hardened with explicit private/no-store responses and exception-safe error logging. Its integration assertions and security-testing documentation are extended. These changes are not yet locally database-tested and do **not** complete TEN-REQ-001 or SEC-REQ-001. No permission, tenant-isolation, or database schema semantics are relaxed.

## Phase 2 school-read tenant hardening awaiting verification

The `feature/recheck-school-membership-on-read` follow-up adds a final database-query filter on authenticated user, active membership, current membership role, and active school to the existing school read helper. Three integration cases were added for inactive schools, removed academic-reader role, and required final-query ownership predicates. This is a defensive improvement against a revoke/role-change window between authorization and the school lookup; it does not establish full transaction-wide read linearizability. **No database-backed tests or full CI-equivalent checks have been executed for this commit.** D-020 assignment-reader policy remains unresolved; no new read routes were introduced.

## Teacher-assignment mutation cache safety awaiting verification

The `feature/no-store-assignment-mutations` follow-up adds an explicit private/no-store header to all four school-scoped assignment mutation routes through their shared HTTP handler. Status codes, authorization, database transactions and append-only audit logic are unchanged. Route-level regression assertions are written, not executed. No new assignment read routes were added; D-020 remains unresolved.

## Policy-aligned school navigation awaiting verification

On `feature/policy-aligned-school-navigation`, the home workspace retains active membership cards but only displays a school-detail link for memberships eligible under the existing school-level `academic:read` policy. Other roles see a non-clickable restricted label instead of a link to a predictable 404. No new permission is granted; the destination remains server-authoritative. Focused role matrix tests were added but not yet executed in the owner's final local verification batch.

## Sanitized school-read denial monitoring awaiting verification

The `feature/safe-school-read-denial-logs` follow-up adds a best-effort, minimal `school_read_denied` operational event for concealed school metadata `404` responses, with randomized request ID only. Two database-backed tests were authored for cross-school/missing-resource parity and logger failure. No tenant or user identifiers are logged, and the denial response remains unchanged if logging fails. **Tests have not been executed for this follow-up.** This is diagnostic logging rather than a protected immutable security audit trail; full SEC-REQ-001 remains open.

## Phase 2 client-session reliability awaiting verification

On `feature/resilient-auth-ui`, sign-in and sign-out buttons now handle explicit provider failure and rejected network requests without getting stuck or falsely refreshing on failed sign-out. A small shared async result helper and four focused unit cases were added. Sign-out displays generic error feedback and disables the button while pending. This is not a replacement for server-side session security, rate limiting, email verification, or browser E2E tests. **The new unit tests and full CI-equivalent checks have not been run.** External identity and production auth posture remain unresolved.

## Phase 2 session-revocation regression coverage (pending local verification)

The `feature/session-revocation-tenant-regressions` follow-up adds four DB-backed integration cases without modifying production code: reusing a cookie after deleting the corresponding Better Auth session must deny school metadata reads and all four teacher-assignment mutations; platform-wide admin status cannot bypass another school's membership; and role demotion must immediately block assignment creation even when the login session is still active. The cases exercise existing server-side checks with real Better Auth sessions and synthetic database fixtures. **They have not been run for this follow-up.** Session durability, global sign-out behavior, cross-deployment cache invalidation, login abuse rate limiting, MFA, and verification policies remain unresolved.

## Phase 2 verified scope authorization (awaiting local verification)

The `feature/require-verified-scope-grants` branch tightens the shared policy so section, class, and subject grants require `verified: true` rather than granting access merely because a matching `ScopeGrant` exists. Four focused regression cases verify rejection of unverified grants, acceptance of exact verified grants, and denial of a verified grant for the wrong resource. Existing child relationship validation and subject-teacher exact active assignment requirements remain unchanged. This permission tightening may affect any future or existing workflow storing an unverified grant; audit such consumers before merge. **Tests have been authored but not executed.** TEN-REQ-001, USR-REQ-001, SEC-REQ-001 remain open.

## Phase 2 school-owned class/subject grant resolution (pending local verification)

The `feature/bind-grants-to-active-school-resources` follow-up prevents verified class or subject scope IDs from granting permission when they belong to another school or refer to inactive resources. Its principal resolver queries the requested school's active class/subject records and filters resolved `ScopeGrant` data accordingly. Two database-backed cases add cross-school and deactivated-resource negative coverage. The [Phase 2 acceptance matrix](../quality/PHASE2_ACCEPTANCE_MATRIX.md) lists complete release gates and local-verification evidence requirements. **The new integration cases and complete application CI sequence have not been run.** SECTION/CHILD model integrity, full HTTP/browser coverage, prod identity #17, immutable general security audit, and dependency risk remain unaddressed; Phase 2 is incomplete.

## Current roadmap phase

Phase 0 documentation baseline is complete.

The local engineering foundation is implemented and its listed local checks have passed for the app shell, Better Auth integration, schema, migration, seed, tenancy helper, and protected school access path. The broader Phase 1 engineering-plan definition of done is not fully met: there is no health endpoint, full HTTP/session integration coverage, CI-run evidence, production logging/audit implementation, or support-access workflow. This is local-development-ready only, not production-ready.

## Phase 1 completion gate

The local repository checkpoint is ready for review within the implemented scope, with these remaining gates:

- external identity-provider strategy remains unresolved
- hosting and deployment remain deferred
- PostgreSQL RLS remains intentionally not implemented
- no unrestricted routine support access; the exceptional access policy is approved, but its approval/enforcement/expiry/audit mechanism is unimplemented

## Outstanding decisions and blockers

- external identity-provider selection and production authentication controls
- hosting provider and domain, deferred until local development and testing are complete
- exceptional support-access mechanism implementation and security review
- payment-provider selection (Phase 9), parent-first report visibility (Phase 8), and QR disclosure (QR verification phase)
- remaining SEC-REQ-001 and TEN-REQ-001 acceptance criteria; these are not marked complete
- high-severity dependency findings must be resolved or explicitly risk-accepted before the configured CI gate can pass
- D-015 Option A still blocks merge, deployment, and release outside the approved D-022 development-only branch/draft-PR exception; the dependency findings require remediation or a separate explicit risk decision

## Next approved action

Continue the next unblocked Phase 2/3/4 roadmap work under D-023. D-020 now provides a conservative `school:configure` development default for assignment administration reads, and D-021 supplies additive academic-session/Form Teacher design direction. Build and test them without inventing historical periods or expanding sensitive access. Resolve actual provider, data migration, high-severity security audit and deployment/release gates separately; the existence of a default is **not** evidence a route or schema was implemented or tested.
