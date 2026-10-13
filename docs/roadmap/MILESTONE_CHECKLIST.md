# Milestone Checklist

## Phase 8 private teacher result preparation preflight (AUTHORED; NOT PRODUCTION-VERIFIED)

`feature/phase8-result-preparation-readiness` starts the documented RES-REQ-001 result flow at **teacher source preparation**, without skipping HM/Principal academic review or School Super Admin final publication. A private no-store GET and school-gated teacher page use the **existing** independently authenticated exact school/class/subject/session/term CBT score and academically reviewed written-mark readers. The pure reconciliation function compares both active pupil rosters by immutable studentId plus admission number/given/family names; different, extra, missing or duplicate students and invalid counts fail closed instead of joining mismatched records. It reports missing CBT scores, initial manual academic-review gaps, outstanding correction reviews, absence of any source, and the fact that the current grading revision is merely DRAFT_PREVIEW_ONLY, not formally adopted.

All results remain `PRIVATE_PREPARATION_ONLY`, even if the source marks are otherwise complete. No combined mark formula, automatic grade, result-sheet snapshot, report-card table, teacher/HM/Principal approval, publication event, student/parent result route, file download, correct answer or answer key is authored in this slice. Phase 8 must later specify a **versioned adopted grading policy**, approved result sheet snapshots, independent verified SECTION reviews, independent final School Super Admin release and server-validated parent/student visibility, including post-publication correction amendments. Current Phase 6/7 acceptance remains blocked.

Tests added: pure readiness Vitest, synthetic authenticated teacher/wrong-role/foreign-school response and pre/post academic source review cases, Node source invariant guard registered without removing prior suites. **Executed:** 8/8 ad hoc Node smoke tests on byte-identical `result-readiness.ts` Git blob `14194e365a7387f9515a23c764f0d0b544383809`, isolated `tsc --noEmit` on same file, plus previous 5/5 standalone grading smoke on Git blob `1c16de05cbf7cee6e8b369b099c1b46b3798ad7f`. This is NOT full repository CI or actual Vitest. No migration applied or live data used. D-051/ADR-037; RES-REQ-001 partial.


## Phase 7 returned-original-mark correction remediation — AUTHORED, UNVERIFIED

`feature/phase7-returned-manual-mark-remediation` resolves the returned-proposal dead end in the original manual grade review workflow. A **terminally RETURNED initial manual mark** may now be amended only through a new immutable reasoned `AssessmentManualCorrectionRequest` by its current exact assigned teacher, followed by the same independently verified PRIMARY HEAD_OF_SECTION or SECONDARY PRINCIPAL academic decision. SQL requires the original initial review to exist (APPROVED or RETURNED), the same active original teacher/enrollment/school and mark limits, a changed bounded value, and no already pending correction. It does **not** change or overwrite the original mark or returned decision.

Current teacher correction context shows a returned original's approved value as **not yet approved**; the verified reviewer queue includes its correction request. The approved-only gradebook remains incomplete while returned initial marks or correction requests lack approval; when the first correction is independently APPROVED, its points become the reviewed effective mark even if the immutable initial decision remains RETURNED. New `RETURNED_CORRECTION_PENDING` status makes the interim state explicit. Synthetic returned-first/reviewed-correction flow authored; Node regression guard updated. No official/student result, CBT key or report publication. Actual SQL/Node/Vitest/full CI checks NOT RUN, Phase 6/7 acceptance BLOCKED. D-050/ADR-036.


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


### Phase 7 written/offline manual marks: unapproved proposals (UNVERIFIED)

- [ ] Run cumulative `20261012340000_phase7_manual_mark_proposals` on owner-confirmed disposable PostgreSQL; verify all exact school/assignment/student enrollment FK mappings, actor and point SQL triggers, concurrent duplicate proposals and immutable DML/truncate rules.
- [ ] Execute real-session teacher/other teacher/school-admin/HM/Principal/student/foreign school denial, active assignment/term/class/subject revocation, student withdrawal/cross-class/multiple enrollment, over-max/negative/decimal marks, forged SQL actor and row-count caps.
- [ ] Browser-test keyboard/a11y and last-query roster authorization; no unapproved marks in current objective class sheet or weighted preview, no public export/official result.
- [ ] Next reviewed correction/teacher marking workflows: immutable reasoned change requests, verified exact-section HM/Principal approval, separate policy-governed adoption into approved gradebook, and controlled Phase 8 result/report publishing; never directly overwrite a teacher proposal.
- [ ] Execute full local CI-equivalent and `npm audit --audit-level=high` without waivers, including all previous Phase 6/7 tests; do not merge or deploy until accepted.


### Phase 7 grading policy revision drafts and provisional preview (UNVERIFIED)

- [ ] Validate additive `20261012330000_phase7_grading_policy_revisions` on explicitly disposable PostgreSQL after cumulative migrations: exact cross-tenant context FKs, SQL actor/role/active period, row-serialized versioning under concurrent requests, weights sum 100, immutable history, school deletion lifecycle.
- [ ] Execute pure weight tests for missing required category, unscored component, zero-weight optional category, multiple assessment category average, integer/rounding and malformed weights.
- [ ] Execute synthetic real-session school super admin vs teacher/HM/Principal/admin/foreign actor, immutable revisions, latest contextual teacher-only preview, no revision/no score PENDING, no answer key or official-result disclosure.
- [ ] Review school-specific CA/exam marking policy, subjective/manual score corrections, teacher/head/principal validation, explicit official report-card policy and Phase 8 release separately; do NOT treat provisional preview as official.
- [ ] Run all local CI-equivalent, Prisma, browser/a11y, SQL injection/tenant/migration and `npm audit --audit-level=high` checks; no release/merge until all dependencies pass.


### Phase 7 restricted marking and class-sheet milestone (UNVERIFIED)

- [ ] Execute cumulative `20261012320000_phase7_cbt_objective_scoring` in verified disposable DB; prove private SQL key-only marking from highest submitted response revision, unanswered zero, weighted score/pass percentage and immutable duplicate/race behavior.
- [ ] Test teacher marking queue and POST actual signed-in exact assignment, no numeric client payload, foreign tenant/role denial, revocation/withdrawal, private no-store and no early solution exposure.
- [ ] Test class sheet current teacher/class/subject/session/term, only active ENROLLED pupils, unscored pending distinct from zero, best scored submitted attempt per reviewed/published assessment, withdrawn exclusion, no duplicate school-enrollment counting, strict row caps/response privacy.
- [ ] Browser/accessibility test private marking and class sheet workspaces. Confirm no student/parent/official grade endpoint or CSV export; resolve school-specific CA/exam weights, manual/theory marks, grade boundaries, approval and archival as separately audited future decisions.
- [ ] Run unchanged full disposable PostgreSQL local CI-equivalent, strict `npm audit --audit-level=high`, all Phase 6 prerequisite suites and cumulative migrations. Do not mark ASM-REQ-001 complete or merge/deploy until verified.


## Phase 7 internal objective CBT auto-scoring (AUTHORED, NOT VERIFIED)

`feature/phase7-cbt-objective-scoring` adds immutable `AssessmentAttemptScore` (one per exact school/attempt) with max/earned weighted marks, basis-point percentage, correct count, pass threshold and UTC timestamp. An authenticated current ACTIVE exact original TEACHER for the assessment class/subject/session invokes an **internal-only** serializable scoring function after a terminal submitted attempt on a sealed, APPROVED and PUBLISHED (not withdrawn) active assessment. SQL BEFORE INSERT repeats the exact actor/teacher/assignment/term/submission authorization and **computes all numeric results itself** by joining the private `AssessmentQuestionKey` in the database and selecting each question's highest accepted response revision, counting unanswered questions as zero. The service never selects keys or accepts numeric grades from the client. Score records cannot be updated/deleted/truncated or duplicated; idempotent calls return the one original snapshot. Student scoring/result endpoints and official report publication remain absent. Synthetic correct/latest-response, unauthorized scoring, replay and immutable audit tests plus Node guards AUTHORED BUT NOT EXECUTED; no migrations or full CI/e2e/audit run. This is objective marking only—manual theory marking, review and official results are separate. D-043/ADR-029. Phase 6 and Phase 7 exit BLOCKED.


## Phase 7 key-blind enrolled-student CBT resume (authored, NOT VERIFIED)

Cumulative `feature/phase7-cbt-private-resume-reader` implements `readInternalCbtAttempt`: an **internal-only** single final SQL query for one exact signed-in, active STUDENT membership → unrevoked administrator-attested StudentAccountLink → ENROLLED StudentRecord and ACTIVE exact class/session StudentEnrollment → sealed, separately APPROVED and PUBLISHED/not WITHDRAWN assessment, current teacher assignment/class/section/subject/session/term, and an unsubmitted attempt strictly inside its server deadline. Returns bounded (up to 50) ordered question prompts/options/points and **only that student's latest saved answer option/revision** with an attempt's ID/number/title/server time bounds; no answer key, `correctIndex`, grade, other student, pupil PII or staff questions. After submission, expiry, revocation or withdrawal, the query returns NOT_FOUND. This foundation deliberately creates **no student-facing API or browser path** pending full Phase 6/student/DB security acceptance. Synthetic real-session test cases for owner/wrong actor/tenant/latest revision/after-submission and read-only Node guards are AUTHORED BUT NOT EXECUTED. All previous strict local CI/audit gates still required. See D-042 / ADR-028.


### Phase 7 CBT immutable autosave and submission (unverified)

- [ ] Apply cumulative `20261012310000_phase7_cbt_answer_submission` only on approved disposable PostgreSQL and validate all composite FKs, PL/pgSQL lock order, trigger/row deletion lifecycle, Prisma drift and SQL parser.
- [ ] Execute synthetic authenticated exact enrolled student/foreign actor/revoked membership/binding/withdrawn publication/wrong class, stale term/teacher, not-in-draft question and out-of-options selectedIndex denials.
- [ ] Verify serialized answer revisions and request-key replay: exact same event acknowledged once, changed replay rejected, concurrent same-key and different-key requests, terminal submission, duplicate submit and all post-submit or post-deadline writes rejected.
- [ ] Verify trusted UTC DB save/submittedAt clocks cannot be backdated and audit UPDATE/DELETE/TRUNCATE blocked. No marking key or student score exposed in replies.
- [ ] Build independently authorized, minimum-data **key-blind** question and resume read, safe real student HTTP delivery only after Phase 6 local verification; subsequently implement restricted scoring/teacher moderation/class record sheets and separate result publication.
- [ ] Run all local CI-equivalent tests and `npm audit --audit-level=high` with no security-waivers, record exact tested commit and results. Keep all PRs draft/unmerged.


### Phase 7 internal CBT admission reservations (authoring checkpoint; unverified)

- [ ] Validate cumulative additive migration `20261012300000_phase7_cbt_attempt_admission` on owner-confirmed disposable loopback PostgreSQL: school/draft/student/member/link/enrollment composite FKs, SQL checked 1–3 attempt numbers and immutable deadline, no direct SQL actor/enrollment/clock spoofing or tampering.
- [ ] Execute real-session synthetic student/teacher/admin/foreign school attempts, absent/revoked admin-attested student binding, wrong class/session/term/enrollment, rejected approval-only or withdrawn exam and invalid window tests. Confirm failed attempts leave no reservations.
- [ ] Race two starts for the same pupil/draft: at most one reservation. Confirm last-write terminal publication withdrawal / student-account revocation and direct identity/enrollment changes deny admission, including SQL transaction races.
- [ ] Ensure server UTC clock sets startedAt/deadlineAt, ignores fabricated timestamps/attemptNumber, handles exact closing boundary, counts abandoned reservations and respects maxAttempts. No student API currently exists.
- [ ] Next: independently reviewed, idempotent resume/answer/autosave/submit/expiry ledger and key-blind student question projection, safe scoring and official class record sheet workflow. Do not enable student CBT until Phase 6 prerequisite, disposable database acceptance, full CI-equivalent and strict high-severity audit all pass.


### Phase 7 assessment publication authorization (unverified)

- [ ] On confirmed disposable PostgreSQL, validate `20261012290000_phase7_assessment_publication` with preceding cumulative migrations and Prisma drift, actor/membership FKs, immutable append-only event/withdrawal checks and school deletion lifecycle.
- [ ] Execute synthetic logged-in School Super Admin vs normal School Admin, Teacher, HM, Principal, foreign school and Platform roles. Ensure an APPROVED sealed draft is required; a RETURNED draft must never be published.
- [ ] Execute forged direct SQL actor, duplicate/parallel publish, rejected withdrawal before publish, terminal withdrawal, revoked membership and audit mutation/rollback tests. No early question/key/score/student disclosures.
- [ ] Browser-test private School Super Admin publication workflow/accessibility and no automatic CBT activation; confirm returned draft and withdrawn assessment never enter a future student queue.
- [ ] Add verified student publication reader only AFTER Phase 6 identity/enrollment CI evidence and separate CBT attempt clock/number SQL enforcement; complete full local CI-equivalent/security audit before milestone signoff.


### Phase 7 assessment section review and CBT admission-preflight checkpoint (unverified)

- [ ] On confirmed disposable PostgreSQL, apply cumulative migrations including repaired assessment-draft migration, new `20261012280000_phase7_assessment_review`, verify all dollar-quote delimiters, Prisma drift, SQL exact reviewer actor + verified section, active teacher/term, audit mutability denial and tenant school deletion.
- [ ] Execute synthetic authenticated HM PRIMARY/Principal SECONDARY review cases: wrong-section actor, direct spoofed actor on unreviewed draft, expired/revoked scope or assignment, duplicate/parallel terminal decisions, immutable event and no key disclosure in queue/preview.
- [ ] Execute CBT admission policy tests for server-minute deadlines, late entry, exact close, active/abandoned attempts and maxAttempts 1–3. These are pure rules only; independent SQL enforcement must precede any student use.
- [ ] Browser-test private reviewer preview, confirmation/accessibility and no score, answer-key, attempt or student question API exposure.
- [ ] Next safe milestone: separately controlled exam publication/release, verified exact enrolled student attempt ledger with atomic count and timing, idempotent autosave and submit; no student delivery before full local CI-equivalent and Phase 6 verification.
- [ ] Run unchanged high-severity dependency audit and full local CI-equivalent on one commit with all cumulative suites. Never mark ASM-REQ-001 complete based on static checks.


### Phase 7 assessment draft configuration (unverified)

- [ ] On confirmed disposable PostgreSQL, validate additive draft + seal migration, FK and SQL actor/term/question-key constraints after cumulative Phase 6 + question bank migrations; verify school deletion and rollback.
- [ ] Execute synthetic authenticated teacher/foreign/admin/assignment-revocation, duplicate or foreign question, schedule outside term, duration/attempt/percentage/point range and forged SQL actor cases.
- [ ] Verify create-with-items-and-seal atomicity; direct SQL post-seal insert/update/delete/truncate rejected and unsealed draft absent from metadata GET.
- [ ] Perform teacher form keyboard accessibility and raw HTTP privacy checks: neither questions nor configured draft endpoints expose correct answer keys or student exam attempts.
- [ ] Build a separately approved CBT assessment publication, verified active student enrollment, idempotent attempts/autosave/submit, per-attempt max and scoring/score validation before any live CBT/result exposure. Full unchanged local CI-equivalent and strict dependency audit remain mandatory.


### Phase 7 assessment question bank — unverified development checklist

- [ ] Validate additive `20261012260000_phase7_question_bank` on approved disposable PostgreSQL against the full cumulative migrations and Prisma generate/validate/drift; verify new school/assignment composite foreign keys and actor triggers.
- [ ] Execute synthetic real-session question POST and teacher-only list tests: foreign school, role-only teacher, revoked assignment, wrong term/session, malformed duplicate options, forged direct SQL actor, immutable question/key, no early key disclosure.
- [ ] Browser-test authoring accessibility and review metadata-only projection; inspect raw HTTP responses/caches and ensure no question keys or student exam routes are exposed.
- [ ] Build assessment configurations, bounded scoring/attempt rule definitions, and a separate future gated CBT delivery model before attempting a student release.
- [ ] Run unchanged full local CI-equivalent and `npm audit --audit-level=high` on the owner-confirmed disposable test environment. Do not mark Phase 7 or Phase 6 completed based on draft code.


### Phase 6 learner visibility and schemes of work acceptance (UNVERIFIED)

- [ ] On the owner-confirmed disposable PostgreSQL DB, apply all cumulative Phase 6 additive migrations in order, run Prisma drift comparison, confirm link/revocation FK and trigger validation, existing tenant lifecycle, typed scheme constraint and immutability.
- [ ] Execute synthetic authenticated STUDENT/Membership vs enrolled StudentRecord tests: unbound role, school/class/session/term mismatch, withdrawn or reclassified pupil, revoked link/membership, approved but not released, withdrawn release, stale revision, direct SQL forged link/actor and concurrency races.
- [ ] Execute teacher-owned scheme week-bound, same-class subject/term assignment, return/revise/submit, exact HM PRIMARY/Principal SECONDARY stage/section approval and separate immutable release/withdrawal tests. Confirm no pupil access before explicit release.
- [ ] Independently test admin attestation workflow and evidence, duplicate link and permanent terminal revocation; do not infer student linkage from names, email or admission-number string equivalence.
- [ ] Execute Next browser/accessibility and all earlier student, teacher, attendance, corrections, calendar, lesson-review suites; mandatory local CI-equivalent including `npm audit --audit-level=high` without disabling existing security gates.
- [ ] Mark ATT-REQ-001 and LES-REQ-001 complete only after executing and recording passing acceptance results against exact commit, including no outstanding high-severity audit blockers.


### Phase 6 approved lesson release (unverified)

- [ ] Apply only to disposable PostgreSQL and run release/withdrawal trigger and audit tamper tests, including concurrent reviewers, stage/scope revocation and stale approved revision.
- [ ] Run teacher-author, HM/Principal reviewer and independent release suites against real authenticated synthetic sessions. Check no student/parent content endpoints are reachable from released metadata.
- [ ] Implement explicit verified STUDENT membership → StudentRecord identity linkage and per-school/session/class/term enrollment reader with no inferred links.
- [ ] Run full browser accessibility and unchanged local CI-equivalent verification and strict dependency audit; leave LES-REQ-001 incomplete until all acceptance cases pass.


### Phase 6 teaching-day calendar acceptance (all unverified)

- [ ] Run additive SchoolAttendanceDayRevision migration on disposable PostgreSQL; test same-date write locking, forged membership, sequential revision, immutable history and no retroactive reclassification when any AttendanceRegister exists.
- [ ] Execute synthetic active administrator/foreign teacher denial and direct-SQL SUBMITTED event non-teaching-day tests, plus existing all-roster/section-review/correction suites.
- [ ] Browser-test bounded calendar list, explicit reasoned designation, denied status, UTC/timezone boundaries and accessibility.
- [ ] Preserve mandatory strict dependency audit and full local CI-equivalent; do not call Phase 6 complete before executed exit evidence.


### School timezone and attendance-window policy — unverified checklist

- [ ] Confirm additive migration `20261012210000_school_attendance_policy` applies cleanly **only** on operator-confirmed disposable PostgreSQL, including PostgreSQL timezone name table, SQL lock order, role validation, immutable policy history and UTC legacy boundary.
- [ ] Execute pure `school-date-policy.test.ts` across DST changes and UTC/local midnight overlap; verify calendar-day arithmetic rather than time duration.
- [ ] Execute synthetic policy integration suite for admin role, cross-school denial, version history, forged raw DB actors, stale revisions, membership revocation, direct SQL UPDATE/DELETE/TRUNCATE and school cascade behavior.
- [ ] Add live HTTP/Next UI keyboard and accessibility tests for policy editor; confirm audit actor, reason and version without ever altering historic attendance.
- [ ] Run unchanged full local CI-equivalent with explicit disposable DB, including format, lint, typecheck, whole Vitest/Node tests, build, and strict `npm audit --audit-level=high`; no waivers.


### Direct-SQL incomplete-roster prevention (unverified)

- [ ] Apply review-only `20261012200000_attendance_complete_roster_guard` **after** the earlier attendance migrations, only against confirmed disposable test PostgreSQL; assert full two-pupil register + immutable SUBMITTED event succeeds and a one-pupil direct-write attempt atomically rolls back.
- [ ] Run the read-only Node SQL/schema invariants through the existing `npm test` command; preserve all Vitest suites and `npm audit --audit-level=high`.
- [ ] Verify concurrency with enrollment changes, currently active student status transitions, Form Teacher revocation, stopped school/session, direct SQL tamper and explicit tenant deletion cascade. Capture exact test SHA, commands and output.
- [ ] Retain blocker until full local CI-equivalent is executed successfully; GitHub Actions billing remains separately blocked.


### Attendance correction readers / browser workspaces (verification still required)

- [ ] Run Form Teacher exact-class approved-register and effective-mark reads on disposable PostgreSQL, including withdrawn historical student entry access only via current class/session PRIMARY responsibility.
- [ ] Run pending correction queue/detail tests for empty unauthorized queues, no pupil identities or marks in index, stage-specific reviewer grants, foreign-school concealment, immediate scope revocation.
- [ ] Verify Form Teacher correction request and separate HM/Principal correction approval screens, explicit mark/reason, keyboard accessibility, stale mark/error messaging and immutable original on actual Next browser.
- [ ] Execute all new and existing Phase 2–6 tests, migration integrity, full build and unchanged high-severity dependency audit gate; record exit codes and exact tested commit.


### Phase 6 immutable correction candidate (all unchecked; unverified)

- [ ] Apply additive correction migration to **only** confirmed disposable PostgreSQL; verify exact composite keys, PostgreSQL trigger SQL, locking and school cascade behavior without live data.
- [ ] Execute authored synthetic correction API tests, inspect assertion counts and verified principal/stage/pupil boundaries; add stronger concurrent decision-revocation tests before release.
- [ ] Confirm original AttendanceEntry and original events cannot change, returned/pending revisions are excluded from effective marks and a newly approved later revision is the only newest effective value.
- [ ] Build least-privilege effective-mark reads, correction review queue, correction screens and school-configured correction windows/timezones.
- [ ] Execute unchanged complete local CI-equivalent and strict `npm audit --audit-level=high` gate; no risk acceptance or waiver inferred.


### Scoped attendance read and UI candidate — still pending verification

- [ ] Validate the Form Teacher roster endpoint only returns enrollment/name/mark inputs for an active exact PRIMARY responsibility in the same school/session/class, with no teacher-wide access.
- [ ] Validate pending-review queue excludes student PII and details require exact active, verified HM PRIMARY/Principal SECONDARY section ownership in each final SQL query.
- [ ] Run the newly authored real-session database read-suite (including inactive membership, revoked ScopeGrant, empty unauthorized queues and server page choices) against the explicitly disposable PostgreSQL database.
- [ ] Check browser navigation, full-roster marking, submit/duplicate/stale feedback, review detail, keyboard/focus and screen reader controls in local Next; run unchanged local CI-equivalent verification and audit gate.


### Attendance register candidate — pending Phase 6 exit checks

- [ ] Review and apply the additive attendance migration on **only** the operator-confirmed disposable PostgreSQL test DB; verify schema drift, composite tenant relationships, trigger validation, deferred events and school-deletion cascade.
- [ ] Run authored attendance policy unit tests and authenticated PostgreSQL API integration suite, including class/date collisions, duplicate/partial roster, role/grant revocation, direct event/entry tampering and concurrent submissions; retain command output and tested commit SHA.
- [ ] Run unchanged CI-equivalent preflight, format, lint, typecheck, full tests, Next build and `npm audit --audit-level=high`; audit findings remain mandatory blockers.
- [ ] Add Form Teacher-scoped active roster read and UI, HM/Principal submitted-queue reader and decision UI, explicit immutable correction/revision model and school timezone policy before marking ATT-REQ-001 complete.


## Phase 0 — Documentation baseline complete

- [x] Repository state documented with evidence
- [x] Documentation index and governance files established
- [x] Initial requirements, architecture, security, and roadmap baseline documented
- [x] Current status and blocker tracking updated to reflect the live repo state
- [x] Initial documentation commit created and pushed to origin/main

## Phase 1 — Local foundation implemented and verified

- [x] Approved technology stack selected and validated locally
- [x] Hosting and deployment model explicitly documented as pending
- [x] Engineering standards and local tooling baseline defined
- [x] CI workflow configured in [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [x] Security baseline and secret-handling model defined for development use
- [x] Database strategy and migration approach validated locally and recorded
- [x] Local app skeleton and protected school access path implemented; focused authorization and DB tenant-context tests pass
- [ ] Complete authentication/session integration coverage for HTTP routes and broader tenant operations (remains in Phase 2/security work)
- [ ] Validate the new public liveness route, local CI safety tests, and entire original CI sequence on an explicitly disposable test database; the endpoint/runner are added but the full verification is still outstanding

## Phase 2 — Pending implementation work

- [ ] Run the newly authored D-020 school-admin teacher-assignment list/detail tests on the disposable database, review final-query tenant scoping, and independently verify Next HTTP transport. No development draft alone satisfies this gate.

- [ ] Verify [Phase 2 acceptance matrix](../quality/PHASE2_ACCEPTANCE_MATRIX.md) on the exact cumulative commit using a disposable PostgreSQL test database and real HTTP/browser checks as applicable; current follow-up tests are authored but unexecuted.
- [ ] Validate school-owned active class/subject scope resolution and assess stored unverified/cross-school grants before any merge.
- [ ] Obtain production identity/session policy decisions under P-007 ([issue #17](https://github.com/Wilberry/myschoolboard/issues/17)); leave optional section/child resource reads unavailable until tenant ownership is proven.

- [ ] Auth and role model
- [ ] Tenant isolation controls
- [ ] Authorization audit tests

## Phase 4 — Academic structure foundation authored, not yet verified

- [ ] Test period activation and closure against actual PostgreSQL partial unique indexes and race conditions; verify role denial, required reasons, immutable event history and the school setup browser controls.

- [ ] Verify school setup workspace navigation, server-side role checks, final-query tenant predicates, create forms, non-cacheable API responses and 100-row display caps in local browser and disposable-DB tests.

- [ ] Apply academic session/term/configuration event migration on only a disposable PostgreSQL test DB; inspect FK ownership, date checks, unique positions and audit immutability.
- [ ] Run new same-school administrator create tests, malformed date and term-range tests, cross-school denials and existing teacher-assignment regression suite.
- [ ] Finish school configuration UI, current session activation/closure workflow, sections/streams, grading-policy versioning, and session-scoped teacher assignment evolution without fabricating legacy period mappings.

## Phase 3 — Pending implementation work

- [ ] Run and review platform lifecycle migration and transaction/audit tests on the explicitly disposable local database.
- [ ] Finish platform-operator school management views, staff enrollment, subscription plans/entitlements and tenant recovery policies; onboarding lifecycle source alone does not complete PLAT-REQ-001/SUB-REQ-001.

- [ ] School onboarding lifecycle
- [ ] Subscription management
- [ ] Platform admin operations

## Phase 5 — Form Teacher and timetable integrity

- [ ] Validate the administrator timetable page, school-isolated server reads, room/slot creation, weekday/minute input conversion, AJAX error handling, cancellation history, accessibility and Next HTTP session transport against the reviewed cumulative commit.
- [ ] Verify the read cap behavior and add school-configurable large-campus timetable pagination before marking a full timetable module complete.

- [ ] Apply timetable GiST extension/constraint migration on an explicitly disposable PostgreSQL DB; prove exact tenant foreign keys and concurrency-safe teacher, class and room conflict rejection.
- [ ] Run slot-create/cancel route tests and existing teacher/Form Teacher tenant/audit suites; verify exact active session/term/teacher relationship and preserved cancellation audit.
- [ ] Add school-admin timetable listing and editing UI plus room lifecycle policies, then progress to Phase 6 attendance and lesson planning.


- [ ] Apply the Form Teacher schema/migration on an explicitly disposable local test database, inspect PostgreSQL partial unique indexes and school-bound foreign keys, and confirm legacy subject assignments remain untouched.
- [ ] Verify six new real-session route/DB scenarios, audit event immutability, support-policy transition rules, school membership deactivation, atomic handover, and denial of unauthorized subject/child access.
- [ ] Implement and test tenant-owned timetable slots and conflicts (teacher, class, room, and academic period) without assuming school-specific bell times or a fixed curriculum; proceed to Phase 6 attendance/lesson notes only after safe timetable foundations.

## Phase 5 — Session-aware staffing foundation authored

- [ ] Validate nullable session FK, the legacy partial unique index and new period-specific unique key on an explicitly disposable PostgreSQL database; preserve all pre-existing NULL-session rows and audit events.
- [ ] Test active same-school session requirements at assignment create/reactivation and exclusion of closed sessions from teacher policy principals.
- [ ] Continue with separately authorized Form Teacher responsibility, school-configurable curriculum eligibility and timetable conflict detection.

### Attendance register candidate — pending Phase 6 exit checks

- [ ] Review and apply the additive attendance migration on **only** the operator-confirmed disposable PostgreSQL test DB; verify schema drift, composite tenant relationships, trigger validation, deferred events and school-deletion cascade.
- [ ] Run authored attendance policy unit tests and authenticated PostgreSQL API integration suite, including class/date collisions, duplicate/partial roster, role/grant revocation, direct event/entry tampering and concurrent submissions; retain command output and tested commit SHA.
- [ ] Run unchanged CI-equivalent preflight, format, lint, typecheck, full tests, Next build and `npm audit --audit-level=high`; audit findings remain mandatory blockers.
- [ ] Add Form Teacher-scoped active roster read and UI, HM/Principal submitted-queue reader and decision UI, explicit immutable correction/revision model and school timezone policy before marking ATT-REQ-001 complete.

## Phase 6 — Lesson notes and attendance (safe foundation under development)

- [ ] Apply additive student registration/enrollment migration only to the confirmed disposable local PostgreSQL test DB; validate same-school composite FKs, active-only uniqueness index, SQL StudentEvent state/actor checks and cascade behavior.
- [ ] Run six real-session registration/enrollment/withdrawal DB cases and previous Phase 2–6 tenant, identity, Section, assignment, lesson review suites. Add concurrent duplicate admission/session enrollment attempts and revocation races before release.
- [ ] Build full audited admissions promotion/transfer/graduation lifecycle and a narrow school-admin student overview, then use **verified active student/class/session enrollment** plus explicit Form Teacher/section authority for attendance; no student/guardian read until their identity relationships are verified.

- [ ] Check the HM/Principal reviewer page via actual Next browser: verified section-only navigation, direct URL denial, pending queue and complete submitted revision, required reason/confirmation, successful approve/return, stale-status generic error and no student release.
- [ ] Run four new school-section reviewer navigation DB cases together with seven reviewer service cases, earlier lesson teacher authoring cases, ScopeGrant tests and audit triggers on disposable PostgreSQL.

- [ ] Migrate reviewer status/event enum values and review reason constraint on disposable PostgreSQL; confirm existing lesson-note author events remain valid, review-event triggers enforce stage/exact section and partial unique index rejects duplicate review decisions.
- [ ] Run seven real-session reviewer DB scenarios plus earlier lesson authoring/section security tests; add concurrent stale-version reviewer races, revocation race and rollback evidence.
- [ ] Verify returned-note re-edit permissions, APPROVED-not-released behavior, generic errors and private no-store responses through real Next HTTP, then add scoped reviewer UI and separate student-release controls only after verified enrollment.

- [ ] Verify the school section setup forms in the local browser, including creation, active class classification, a previously classified class having no move action, cross-school rejection, safe error messages and keyboard labels.
- [ ] Run two additional section-reader SQL predicate/isolation tests together with the section mutation tests and all previous Phase 2–6 suites.

- [ ] Apply SchoolSection schema/migration to disposable PostgreSQL and verify previous classes remain unclassified (NULL) and other-school section IDs are rejected.
- [ ] Run five section creation/class placement/grant tests and real cross-section/stage denial tests before enabling scoped HM/Principal lesson-note approvals or timetable mutations.

- [ ] Verify teacher lesson-note UI home navigation and server page authorization, active school-owned teacher assignment/term options, note creation/edit/reload/submit, browser keyboard/accessibility, and revision conflict handling.
- [ ] Run four option-reader database tests and the six author API integration cases against only the explicitly disposable test DB; reject all foreign roles, private student requests and inactive assignment/period access.

- [ ] Apply draft lesson-note tables, exact composite tenant FKs and immutable revision/event triggers on **only** an explicitly disposable PostgreSQL DB; verify rollback and revision concurrency.
- [ ] Run six authored teacher-only lesson-note API integration cases plus earlier Phase 2–5 tests; verify no teacher self-approval, no student reads and no leakage across classes/schools.
- [ ] Add verified school-owned Section/class/reviewer scope before HM/Principal lesson-note approval or revision-return; add enrollment and pupil-class-term ownership before attendance and released lesson visibility.
- [ ] Build teacher authoring workspace and school approver queue as separately scoped features after server permissions are in place.

## Future phases

All subsequent phases remain pending until their entry criteria and required product decisions are satisfied. The completed local Phase 1 foundation does not imply that Phase 2 or later requirements are implemented or complete.
