# Requirements Traceability Matrix

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


## ASM-REQ-001 / T-ASM-001 — provisional teacher-written assessment mark proposals (PARTIAL / UNVERIFIED)

- Additive `AssessmentManualComponent` and `AssessmentManualMarkProposal` with exact school/term/class/subject/teacher assignment; same-school class/session active student enrollment tuple; separate immutable first per-pupil component proposal, earned integer 0..max, reason and source actor. New SQL `20261012340000_phase7_manual_mark_proposals` validates active TEACHER actor and original assignment, school/term/class/section/subject and actual ENROLLED pupil/ACTIVE enrollment and denies UPDATE/DELETE/TRUNCATE, cross-tenant and duplicate writes.
- Authenticated `manual-mark-service.ts`, private `assessment-manual-components` GET/POST, `[componentId]/students` private key-free exact-teacher roster and `assessment-manual-proposals` POST plus teacher editor/page. A proposal is explicitly UNAPPROVED_NOT_SCORED and **not** read by objective scorer, class-sheet/weighted grade or report APIs.
- `questions.integration.test.ts` synthetic role/tenant, bounded input, component/pupil relation, duplicate, forged direct SQL actor, immutability and exclusion-from-class-sheet cases; `scripts/phase7-manual-mark-proposal-guard.test.mjs` retained in full tests. **Authored only, NOT executed.** Teacher score correction, independent HM/Principal approval and result publication remain open; ASM-REQ-001 partial, Phase 6/CI/security gate blocked.


## SCH-REQ-001 / ASM-REQ-001 / T-ASM-001 — immutable school grading preview profile (PARTIAL / UNVERIFIED)

- Schema `AssessmentGradingPolicyRevision` and additive SQL `20261012330000_phase7_grading_policy_revisions`: school/session/term/class/subject and School Super Admin actor member exact composite FKs, 0–100 QUIZ/TEST/EXAM whole-number weights sum 100, reason, SQL-serialized per-context version, UTC timestamp, immutable UPDATE/DELETE/TRUNCATE protections. Only active same-school School Super Admin may author profiles; no default and no official status.
- Server/private admin editor/route `grading-policy-service.ts`, `assessment-grading-policies`: actual signed-in school super admin under SERIALIZABLE school/member lock, fail-closed wrong actor/scope, bounded no-student-Pii history. Teacher class record service reuses final-query original exact assignment authorization and projects latest policy matching school/session/term/class/subject, separate weighted PREVIEW only.
- Pure `grading-policy.ts` and Vitest tests require complete positively weighted categories; missing/unscored yields `PENDING`, never zero or official grade. Synthetic authenticated school role/tenant/wrong weights/forged actor/immutable revisions and class-sheet preview tests AUTHORED, NOT EXECUTED. `scripts/phase7-grading-policy-guard.test.mjs` added to unchanged full test suite.
- ASM/SCH requirements still partial; school adoption, manual marking and official result publication not implemented/accepted. Phase 6 and mandatory DB/CI/security exit gates blocked.


## ASM-REQ-001 / T-ASM-001 — private teacher marking and provisional class sheets (PARTIAL, NOT VERIFIED)

- `src/modules/assessments/objective-score-service.ts`: signed-in active exact teacher's submitted-unscored attempt metadata GET; internal `scoreInternalSubmittedAttempt` SQL-computed immutable key-only score. `assessment-score-queue` GET and `assessment-scores/[attemptId]` bodyless POST return no raw answers or correct keys; current school/draft teacher/assignment/term and publication state rechecked.
- `src/modules/assessments/class-record-service.ts`, school `assessment-class-records` private GET, teacher `assessment-class-records` and `assessment-marking` pages/workspaces: exact active assigned teacher and same class/subject/session/term active enrollment, approved+published/not-withdrawn drafts, highest percent scored submitted attempt, pending not zero and aggregate scored-only percentages, no student result publication, 500 pupil/30 assessment caps with ambiguous student/class enrollment conflicts.
- Synthetic authenticated integration cases in `questions.integration.test.ts`: teacher queue/scoring idempotence, wrong role/school denial, objective-marked pupil provisional sheet, privacy; `scripts/phase7-class-record-guard.test.mjs` authored in complete test scripts. **All authored, NOT EXECUTED.** Mandatory Phase 6 and local DB/CI/security gate blocked. ASM-REQ-001 remains partially implemented pending teacher/graded-business-policy acceptance and official-result Phase 8.


## Phase 7 internal objective CBT auto-scoring (AUTHORED, NOT VERIFIED)

`feature/phase7-cbt-objective-scoring` adds immutable `AssessmentAttemptScore` (one per exact school/attempt) with max/earned weighted marks, basis-point percentage, correct count, pass threshold and UTC timestamp. An authenticated current ACTIVE exact original TEACHER for the assessment class/subject/session invokes an **internal-only** serializable scoring function after a terminal submitted attempt on a sealed, APPROVED and PUBLISHED (not withdrawn) active assessment. SQL BEFORE INSERT repeats the exact actor/teacher/assignment/term/submission authorization and **computes all numeric results itself** by joining the private `AssessmentQuestionKey` in the database and selecting each question's highest accepted response revision, counting unanswered questions as zero. The service never selects keys or accepts numeric grades from the client. Score records cannot be updated/deleted/truncated or duplicated; idempotent calls return the one original snapshot. Student scoring/result endpoints and official report publication remain absent. Synthetic correct/latest-response, unauthorized scoring, replay and immutable audit tests plus Node guards AUTHORED BUT NOT EXECUTED; no migrations or full CI/e2e/audit run. This is objective marking only—manual theory marking, review and official results are separate. D-043/ADR-029. Phase 6 and Phase 7 exit BLOCKED.


## Phase 7 key-blind enrolled-student CBT resume (authored, NOT VERIFIED)

Cumulative `feature/phase7-cbt-private-resume-reader` implements `readInternalCbtAttempt`: an **internal-only** single final SQL query for one exact signed-in, active STUDENT membership → unrevoked administrator-attested StudentAccountLink → ENROLLED StudentRecord and ACTIVE exact class/session StudentEnrollment → sealed, separately APPROVED and PUBLISHED/not WITHDRAWN assessment, current teacher assignment/class/section/subject/session/term, and an unsubmitted attempt strictly inside its server deadline. Returns bounded (up to 50) ordered question prompts/options/points and **only that student's latest saved answer option/revision** with an attempt's ID/number/title/server time bounds; no answer key, `correctIndex`, grade, other student, pupil PII or staff questions. After submission, expiry, revocation or withdrawal, the query returns NOT_FOUND. This foundation deliberately creates **no student-facing API or browser path** pending full Phase 6/student/DB security acceptance. Synthetic real-session test cases for owner/wrong actor/tenant/latest revision/after-submission and read-only Node guards are AUTHORED BUT NOT EXECUTED. All previous strict local CI/audit gates still required. See D-042 / ADR-028.


## ASM-REQ-001 / T-ASM-001 — append-only CBT answer revisions and final submission (PARTIAL; UNVERIFIED)

- Models `AssessmentAttemptAnswerEvent` and `AssessmentAttemptSubmission` are additive, school/attempt/question/member composite-FK-bound, immutable and no-key/no-score. `20261012310000_phase7_cbt_answer_submission`: shared SQL role/identity/active enrollment/approval/publication/term/teacher/deadline guard, school + attempt locks, server-assigned UTC timestamps, question choices and sequential per-question revision, unique request replay key and one terminal submission.
- Internal-only `src/modules/assessments/attempt-answer-service.ts` authenticates the actual STUDENT session, repeats current school/identity/attempt access, serializable exact-payload autosave retry and single final submit; only metadata acknowledgements. No student-facing API, attempt editor, answer-key read, marking result or report sheet.
- `questions.integration.test.ts` extended with synthetic auth actor mismatch, accepted and changed-payload idempotent replay, revised response number, invalid question/choice, terminal submission and direct ORM audit-mutation denials. `scripts/phase7-cbt-answer-guard.test.mjs` added to Node guard suites while all existing Vitest/security audit checks remain enabled. Both AUTHORED BUT NOT EXECUTED. Exact PostgreSQL server clock, foreign classes, forged SQL and concurrent boundary races require disposable DB.
- ASM-REQ-001 PARTIALLY AUTHORED, NOT VERIFIED; Phase 6 prerequisite and strict local CI/security gate BLOCKED. No real CBT availability.


## ASM-REQ-001 / T-ASM-001 — exact verified-student CBT attempt reservation (PARTIAL / UNVERIFIED)

- Additive Prisma `AssessmentAttempt` and `20261012300000_phase7_cbt_attempt_admission` with school/draft/pupil/enrollment/class/session/student member/unrevoked attested link composite FKs, immutable attempt ordinal/timestamps and SQL approval+publication+active class/term/assignment and student actor/identity checks. Explicit PUBLISHED without WITHDRAWN and exact ACTIVE enrollment required; a STUDENT role, matching name/email or class string alone never enables admission.
- Database-level school lock serializes attempt counts with publication withdrawal and student link revocation. The DB—not browser—assigns attemptNumber and UTC start/deadline <= exam close, refuses >maxAttempts or parallel unexpired reservations and blocks history UPDATE/DELETE/TRUNCATE. Expired attempts still count.
- `src/modules/assessments/attempt-reservation-service.ts`: authenticated internal-only, exact candidate selection and serializable insertion; **no HTTP student endpoint, attempt resume, question delivery, autosave, submit, scoring or score sheet**.
- `questions.integration.test.ts` synthetic real-session attempted bypass/race/revocation and audit immutability test; `scripts/phase7-attempt-admission-guard.test.mjs` added to unchanged full Node/Vitest path. Both AUTHORED, NOT EXECUTED. Local PostgreSQL, security audit and Phase 6 prerequisites remain blocked. ASM-REQ-001 remains only partially authored.


## ASM-REQ-001 / T-ASM-001 — controlled publication/withdrawal subset (authored; NOT VERIFIED)

- `AssessmentPublicationAction`, `AssessmentPublicationEvent` Prisma + `20261012290000_phase7_assessment_publication` SQL: append-only school/draft/actor composite FK, school-Super-Admin-only current actor verification, prerequisite terminal HM/Principal APPROVED sealed draft, active school/class/section/subject/assignment/session/term and immutable PUBLISHED then optional terminal WITHDRAWN sequence. Cannot publish a RETURNED draft or silently republish withdrawn configuration.
- `src/modules/assessments/publication-service.ts` and private `assessment-publications` routes/admin page: school-locked serializable separate admin reasoned publication/withdrawal, bounded approved metadata queue, no keys, question text, student attempts, scores, exports or automatic CBT visibility.
- `questions.integration.test.ts` synthetic stage-approved vs returned, wrong role/foreign school, duplicate, forged role, terminal withdrawal and audit immutability tests; `scripts/phase7-publication-guard.test.mjs` included in `npm test` and `verify:local:guards`. All tests AUTHORED, NOT EXECUTED.
- ASM-REQ-001 still PARTIALLY AUTHORED; Phase 6 verified student identity/enrollment, attempt limits, CBT delivery, autosave, scoring and class record sheets and full security audit remain open.


## ASM-REQ-001 / T-ASM-001 — section academic moderation and attempt planning (authored; unverified)

- Add `AssessmentReviewDecision` APPROVED/RETURNED + `AssessmentReviewEvent` immutable one-decision-per-school/draft, new additive `20261012280000_phase7_assessment_review` composite FKs + SQL actor/verified SECTION/stage/session/term/teacher/seal validator. An HM reviews only PRIMARY and Principal only SECONDARY with exact stored section, not generic class/subject or school roles.
- `src/modules/assessments/review-service.ts`, private assessment-reviews queue/detail/decision GET/POST, reviewer page: sealed draft metadata, exact-section question text/options/positions/marks for moderator only, no key or correctIndex, review reason/confirmation, terminal decision; no publication.
- `src/modules/assessments/cbt-admission-policy.ts` and `.test.ts`: pure UTC duration/close-boundary, 1–3 attempt cap and no parallel active attempt planning; **not an authoritative student admission API**. No AssessmentAttempt table, student exam route, scoring or record sheet introduced.
- `src/modules/assessments/questions.integration.test.ts` synthetic HM/Principal primary/secondary scope, wrong-role/stage/foreign denial, revoked grant, immutable approval and preview key omission. `scripts/phase7-cbt-review-guard.test.mjs` includes parent SQL dollar-quote regression and review invariants in `npm test` and `verify:local:guards`. All tests **AUTHORED NOT EXECUTED**; executed local DB/CI still pending.
- Parent assessment migration PL/pgSQL delimiter bug fixed in cumulative branch. ASM-REQ-001 remains PARTIALLY AUTHORED; Phase 6 prerequisite and mandatory security gate BLOCKED.


## ASM-REQ-001 / T-ASM-001 — assessment configuration subset (authored; NOT EXECUTED)

- Models: `AssessmentDraft` QUIZ/TEST/EXAM UTC term-bound immutable config, `AssessmentDraftQuestion` (ordered exact assignment keyed question IDs and points), `AssessmentDraftSeal` (one-time complete snapshot). SQL guards enforce active TEACHER/school/class/subject/session/term and same-assignment question+key; CHECK: duration 5–180, maxAttempts 1–3, passPercent 0–100, item position 1–50/points 1–20, schedule contains duration; seal denies later additions.
- Server/UI: `src/modules/assessments/draft-service.ts`, private `assessment-drafts` POST/GET, teacher-gated draft editor and school navigation. Uses serializable exact teacher assignment, 1–50 unique selected keyed questions; no key read, student CBT, scores, grading execution, publication or export.
- Tests: extension of `questions.integration.test.ts` for role/tenant, invalid ranges, duplicate selection, sealed draft, forged actor and immutable snapshots; `scripts/phase7-assessment-draft-guard.test.mjs` included in existing Node + Vitest run. **Authored only, NOT executed**. Full local CI and audit blocked, Phase 6 unverified.
- ASM-REQ-001 still partial, NOT accepted; attempt-limit enforcement must be independently implemented in future CBT attempt service, and passing-percent values are definitions only until validated score computation exists.


## ASM-REQ-001 / T-ASM-001 — Phase 7 question bank candidate (authored, UNVERIFIED)

- `AssessmentQuestion` and separate `AssessmentQuestionKey`, migration `20261012260000_phase7_question_bank`: exact school/teacher membership/class/subject/session/term/assignment tuple, validated immutable MCQ prompt/options, secret-key composite FK, independent SQL actor/scope and key-index triggers, immutable UPDATE/DELETE/TRUNCATE protections.
- `src/modules/assessments/question-service.ts`, school assessment-questions POST/GET, teacher question-bank page/editor: current exact ACTIVE TEACHER assignment, no role-only or combined scope access; metadata GET/POST never includes correctIndex or answerKey, capped to 100. **No student read/delivery route.**
- `src/modules/assessments/questions.integration.test.ts` synthetic authenticated role/foreign/class/session/key-secrecy/immutability tests; `scripts/phase7-question-bank-guard.test.mjs` included in existing `npm test` and `verify:local:guards`. **AUTHORED, NOT EXECUTED**.
- This slice implements question creation only; assessment configuration, attempt limits, scoring, grading, class records and proper key publication boundaries remain incomplete. Full local PostgreSQL/CI/audit acceptance and Phase 6 prerequisite also outstanding. ASM-REQ-001 remains **specified + partially authored, not tested/complete**.


## LES-REQ-001 — student identity, released lesson/term access and schemes (candidate, NOT VERIFIED)

- Additive schemas/migrations: `StudentAccountLink`, `StudentAccountLinkRevocation`, school/member/student composite FKs, SQL actor/role/identity attestation and immutable delete/update/truncate guards; typed `LessonDocumentKind` and immutable `LessonNote.weekStart/weekEnd` with DB CHECK and unique exact scheme schedule.
- Server: `src/modules/students/account-link-service.ts` administrator verified-identity attestation/revocation (no string-derived child link); `src/modules/lesson-notes/student-reader.ts` single-query exact active school/student membership/unrevoked student record/enrollment/class/session/term and separate approved/released/not-withdrawn revision; student and administrator private route/page/view.
- Existing author/reviewer/release workflow: schemes use the same school-owned exact teacher class/subject/session term assignment, immutable content revisions, HM PRIMARY / Principal SECONDARY approval and separate release/withdrawal event. Ordinary existing notes default to LESSON_NOTE.
- T-LES student disclosure & scheme: `src/modules/lesson-notes/review.integration.test.ts` extended with synthetic real-session student binding, duplicate, no-link, wrong class, terminal revoke, role revoke, term close, typed scheme week guard, creation, review and release; `scripts/phase6-identity-release-guard.test.mjs` authored and included in unchanged `npm test` + `verify:local:guards`. **Not executed.**
- Status: **Substantial authored implementation, unverified**. Open: operator-confirmed disposable-DB schema/SQL/concurrency tests, actual identity-verification policy/evidence safeguards, accessibility/browser, full local CI-equivalent and dependency security gate. LES-REQ-001 not complete/accepted.


## LES-REQ-001 release workflow candidate (authored, not executed)

`LessonReleaseEvent` immutable schema and `20261012230000_lesson_approved_release` additive SQL actor/scope/approval guards, `lesson-notes/release-service.ts`, release-read, private reviewer GET/POST routes and server-gated release page add separate approved-revision release and withdrawal. No user obtains learner content on approval alone; no student/guardian API is exposed. `review.integration.test.ts` adds synthetic wrong-role/stage, old revision, duplicate, withdrawal and tamper cases (**AUTHORED, NOT EXECUTED**). Actual verified student identity/enrollment visibility, browser tests and full CI remain open. LES-REQ-001 NOT COMPLETE.


## Phase 6 calendar-day closure subset (ATT-REQ-001, SCH-REQ-001; unverified)

`SchoolAttendanceDayRevision` schema, `20261012220000_attendance_school_days` SQL, `policy-service.ts`, `attendance-days` POST, school policy UI and submission-day guard introduce explicit immutable school-date closures. No inferred weekend rule; recorded attendance prevents retroactive redesignation. Tests authored in `policy.integration.test.ts`; all DB tests, migrations and acceptance gates remain **unexecuted**. LES-REQ-001 lesson release and authorized pupil-class/period visibility remain separately outstanding.


## Attendance school calendar and correction windows — ATT-REQ-001 / SCH-REQ-001 (authored, not verified)

- `SchoolAttendancePolicyRevision` Prisma and `20261012210000_school_attendance_policy` additive migration: current school attendance configuration is the latest immutable verified-administrator revision, default UTC/7/30 for schools without revisions. SQL validates actor, revision, timezone, windows and immutable history.
- `school-date-policy.ts`, `policy-service.ts`: school-local calendar-day validation using IANA timezone and conservative UTC upper bound; submission and correction-request mutations read current policy in their serializable school-locked transaction; SQL event/request triggers repeat eligibility without trusting browser input.
- `app/api/schools/[schoolId]/attendance-policy`, `app/schools/[schoolId]/attendance-policy`: authenticated, active tenant `school:configure` admin editor and private POST with reasoned audit. Existing Form Teacher, HM and Principal permissions are not broadened.
- `school-date-policy.test.ts` and `policy.integration.test.ts`: authored, NOT executed. Missing DB migration verification, full CI, browser, holiday/calendar exception policy and historical acceptance. ATT-REQ-001/SCH-REQ-001/SEC-REQ-001 remain **partially authored, incomplete**.


## Attendance SQL bypass hardening — ATT-REQ-001/T-ATT-001 (unverified)

- Finding: prior DB SUBMITTED-event trigger verified original actor and **at least one** attendance entry, but did not require all active class/session enrolled pupils. API full-roster check was insufficient against bypassing the application using direct SQL.
- New migration: `20261012200000_attendance_complete_roster_guard` requires exact full active roster in the immutable SUBMITTED event transaction; bounded count, school lock and per-entry eligibility checks. Original database audit and authorization mechanisms retained.
- Tests: synthetic direct-SQL partial-class transaction rejection and rollback in `routes.integration.test.ts`, read-only `scripts/attendance-ledger-guard.test.mjs` included in `npm test`. **Authored, not run**. Ten GitHub content static-consistency presence checks were executed; these do not meet PostgreSQL, authorization or CI acceptance.
- Status remains **partially authored, unverified**; do not mark security/attendance complete.


## ATT-REQ-001 correction read/workspace extension — still unverified

- `src/modules/attendance/corrections-read.ts` and `corrections-read-http.ts`: Form Teacher current-primary-responsibility approved-register/entry queries and exact HM/Principal active-section pending queue/detail; select originalMark alongside latest APPROVED revision effectiveMark. Pending and RETURNED proposals are excluded from corrected effective value.
- `app/schools/[schoolId]/attendance-corrections` and `attendance-correction-reviews`: two separately server-restricted pages and client editors with explicit reasoned request/review interactions, bounded private projections.
- `corrections.integration.test.ts`: extended synthetic disposable-DB cases on cross-tenant/role denial, queue lacking pupil data, per-item stage/grant checks, pending/returned/approved overlay status and original mark retention. **Authored; not executed**. Related security, lifecycle, timezone, complete browser and local CI-equivalent gates remain pending.


## Correction subset ATT-REQ-001 / T-ATT-001 — authored, unverified

- `prisma/migrations/20261012190000_attendance_immutable_corrections/migration.sql`, schema models and actor/revision/immutability triggers: additive revisioned correction request + independent correction decision; never update original marks.
- `src/modules/attendance/corrections-service.ts`, `corrections-http.ts`: POST correction request on approved class attendance by currently responsible PRIMARY Form Teacher; POST decision by exact verified HM/Principal section; authenticated actor from Better Auth, serializable transactional guards.
- `src/modules/attendance/corrections.integration.test.ts`: synthetic real-session coverage for stale marks, skipped/overlapping revisions, returned and approved review, wrong/foreign/revoked actor, forged direct inserts, immutable events and concurrent request attempts. **Tests authored; NOT EXECUTED**.
- No correction UI, authorized effective-mark read, school configuration, migration/test/local CI gate evidence. ATT-REQ-001, TEN-REQ-001 and SEC-REQ-001 remain **not complete**.


## Attendance reviewer and Form Teacher workspaces — ATT-REQ-001 (additional unverified evidence)

- `src/modules/attendance/read-service.ts`: one-statement authenticated active PRIMARY Form Teacher roster; verified-stored-section Head/Principal queue and detail; bounded 500-pupil view and 100-item queue, generic unauthorized denials; private GET handlers in `app/api/schools/[schoolId]/attendance/roster` and `attendance-reviews`.
- `src/modules/attendance/navigation.ts` and `app/schools/[schoolId]/attendance*`: independently restricted server page options and client submission/review editors. No default pupil mark and no broad student record visibility.
- T-ATT-001 additional evidence: `reads.integration.test.ts` covers active-role exact class access, unauthorized subject-teacher denial, HM/Principal stage and verified scope, queue projection, detail minimization, revocation, query validation and server-page navigation. **Authored, NOT executed**.
- ATT-REQ-001 remains **partially authored and unverified** because corrections, configuration and full CI/browser acceptance are missing; SEC/TEN release gates unchanged.


## Phase 6 attendance mutation candidate — ATT-REQ-001 (unverified)

- Data: `AttendanceRegister`, `AttendanceEntry`, `AttendanceEvent`, composite school/student/enrollment/class/session FKs and SQL append-only audit/decision constraints in `20261012180000_attendance_register_ledger` (migration **authored, not run**).
- Server: `src/modules/attendance/service.ts` exact active roster/PRIMARY Form Teacher submission and HM/Principal section-grant decision functions; POST-only routes under `app/api/schools/[schoolId]/attendance`.
- T-ATT-001: `eligibility.test.ts` role/section policy cases and `routes.integration.test.ts` synthetic disposable database cases for duplicates, forged enrollment, role revocation, actor history, concurrent submissions and reviewer grants. **Tests authored, not executed**.
- Status: **Partially authored, unverified; NOT complete**. There is no teacher roster read/UI, reviewer queue/UI, approved correction/revision history, configured timezone or full acceptance/security evidence. TEN-REQ-001/SEC-REQ-001 remain independently open.


The matrix below links requirements to the canonical domains and expected roadmap phases. This is a specification-first matrix and can be used as the implementation baseline before code exists.

| Requirement ID | Module | Role/Permission | Workflow | Data Entity | API/UI Area | Test Case | Roadmap Phase | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PLAT-REQ-001 | Platform administration | Platform Super Admin | Tenant lifecycle | Tenant, Subscription | Admin console | T-PLAT-001 | Phase 3 | Specified |
| TEN-REQ-001 | Tenant isolation | All roles | Cross-tenant access validation | Tenant scope context | API auth, middleware | T-TEN-001 | Phase 2 | Specified |
| SCH-REQ-001 | School setup | School Super Admin, HM, Principal | Academic structure | School, Class, Subject | Config screens | T-SCH-001 | Phase 4 | Specified |
| USR-REQ-001 | Identity and auth | Platform and school roles | Permission assignment | UserRole, ScopeConstraint | Auth service | T-USR-001 | Phase 2 | Specified |
| ADM-REQ-001 | Admissions | School admin | Student admission lifecycle | Student, Guardian, Enrollment | Student records | T-ADM-001 | Phase 4 | Specified |
| TCH-REQ-001 | Teacher assignments | HM, Principal, Teacher | Assignment and conflict validation | TeacherClassSubjectAssignment | Staff assignment screens | T-TCH-001 | Phase 5 | Specified |
| ATT-REQ-001 | Attendance | Form Teacher, HM, Principal | Submit/approve attendance | AttendanceRegister, AttendanceEntry, AttendanceEvent | Private POST only (no UI/read) | T-ATT-001 | Phase 6 | Partially authored — unverified |
| LES-REQ-001 | Lesson notes | Teacher, HM, Principal | Approval and release | LessonNote | Academic planning | T-LES-001 | Phase 6 | Specified |
| ASM-REQ-001 | Assessments | Teacher, HM, Principal | CBT and assessment scoring | Assessment, Score | Assessment UI | T-ASM-001 | Phase 7 | Specified |
| RES-REQ-001 | Results and report cards | Teacher, HM, Principal, School Super Admin | Approve and publish report cards | ResultSheet, ReportCard | Results area | T-RES-001 | Phase 8 | Specified |
| FEE-REQ-001 | Fees and payments (configuration foundation) | School Super Admin; later school finance verifier and Parent/Guardian TBD | Immutable fee category + session/term/scope price revisions; obligations and distinct payment verification/receipt pending | FeeCategory, FeeStructureRevision (authored); FeeObligation, PaymentRecord and evidence not built | Private fee-category and fee-structure GET/POST only; no finance portal yet | T-FEE-001: Node guard and synthetic tenant/role/immutable revision integration tests authored, NOT executed | Phase 9 | Partially authored; unverified, no debts or payments |
| COM-REQ-001 | Communication | School admin, Teacher, Parent | Notice board and class announcements | Notice, Announcement | Communication UI | T-COM-001 | Phase 10 | Specified |
| LIB-REQ-001 | Library | Teacher, Student, Parent | Resource access | LibraryResource | Library portal | T-LIB-001 | Phase 10 | Specified |
| SEC-REQ-001 | Security | All roles | Security and session controls | UserSession, AuditEvent | Auth and security | T-SEC-001 | Phase 1 | Specified |
| DEL-REQ-001 | Trash and recovery | School admin, Platform Super Admin | Trash retention and restore | TrashRecord | Recovery screens | T-DEL-001 | Phase 11 | Specified |
| AUD-REQ-001 | Audit and notifications | All roles | Audit and notifications | AuditLog, Notification | System operations | T-AUD-001 | Phase 10 | Specified |
| SUB-REQ-001 | Subscription management | Platform Super Admin | Plans and entitlements | Subscription, Plan | Platform admin | T-SUB-001 | Phase 3 | Specified |
| OPS-REQ-001 | Engineering operations | Engineering team | CI, migrations, monitoring | BuildConfig, Migration | DevOps and repos | T-OPS-001 | Phase 1 | Specified |

## Phase 6 LES-REQ-001 implementation evidence (authored, not verified)

- T-LES-001 authoring subset: school-bound TEACHER draft/revision/submit APIs and teacher authoring workspace, immutable content revision/event history; authored integration tests remain unexecuted.
- T-LES-001 review subset: `HEAD_OF_SECTION` PRIMARY and `PRINCIPAL` SECONDARY class-section-aligned reviewer queue/detail and reasoned approve/return transactions, with a verified same-school SECTION ScopeGrant, teacher resubmission after a new revision, and audited persisted decision history. Seven additional real-session DB integration tests are authored, **not executed**.
- LES-REQ-001 remains **partially implemented, not verified and not complete**: no approved-note student release, verified pupil enrollment, comprehensive school-configurable review delegation, final browser verification or full CI-equivalent gate.
- Related isolation evidence for TEN-REQ-001/SEC-REQ-001 remains scoped to authored tests and static inspection; it does not mark those cross-cutting requirements complete.

## Admissions/enrollment dependency evidence — ADM-REQ-001 and ATT-REQ-001 (unverified)

- Phase 4 ADM-REQ-001 registration subset: a school-owned StudentRecord with school-specific admissionNumber, minimal names and REGISTERED→ENROLLED→WITHDRAWN status, and authenticated administrator-only registration. This is an **authored unverified** subset, not full inquiry/acceptance, transfer, promotion or graduation.
- Phase 6 ATT-REQ-001 prerequisite: an explicit school/class/academic-session StudentEnrollment ledger with ACTIVE/ENDED history, no legacy/user auto-link, composite tenant foreign keys, one ACTIVE enrollment per student/session and reasoned immutable actor events. It cannot yet authorize attendance or student-visible notes by itself.
- T-ADM-001/T-ATT-001: six real-session/disposable PostgreSQL route integration tests authored but **not executed**; concurrent uniqueness, class reclassification and student-account linking tests remain future work.
- **Neither ADM-REQ-001 nor ATT-REQ-001 is complete**, and related SEC/TEN release evidence remains outstanding.

## Traceability rules

- Every requirement must attach to a specific module, workflow, and expected test coverage.
- Deferred requirements remain in the matrix and must not be removed.
- Implementation status must be recorded as verified, specified, proposed, resolved, or deferred according to actual evidence.
