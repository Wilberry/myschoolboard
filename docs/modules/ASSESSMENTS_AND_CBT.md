# Assessments and CBT

## Phase 7 exact enrolled-student CBT attempt reservations (internal-only; unverified)

Cumulative `feature/phase7-cbt-attempt-ledger` introduces an immutable `AssessmentAttempt` **reservation** (no question read/answer/submit/score APIs) for a school, separately approved+PUBLISHED and unwithdrawn sealed assessment, and the **exact** school-owned StudentRecord, currently active StudentEnrollment/class/session, unrevoked administrator-attested StudentAccountLink, active STUDENT Membership and signed-in user. It stores school/draft/pupil/enrollment/class/session/student member/link/user, ordinal attemptNumber 1–3, database-clock startedAt and deadlineAt.

The SQL BEFORE INSERT validator holds a school FOR UPDATE serialization lock shared by school-locked publication withdrawal / identity revocation, validates a currently active academic period/section/teacher assignment, exact composite identity and enrollment relationships and approval/publication event states, then assigns **both** the ordinal number and trusted UTC database clock/deadline. Deadline is `min(database start + configured duration, scheduled exam end)`. The client cannot extend time or bypass 1–3 configured attempt slots, and a currently unexpired reservation forbids starting a second one. All attempts count, even when abandoned. Expired reservations can consume the next allowed slot; no reset or deletion of history. ORM/SQL UPDATE/DELETE/TRUNCATE protections retain immutable evidence.

`reserveInternalCbtAttempt` is an **internal-only** authenticated transactional service without any Next route or student UI. It selects one unambiguous currently linked student and matching enrollment, denies missing/duplicate candidate relationships, then inserts with a SERIALIZABLE transaction while PostgreSQL revalidates and sets clocks/number. It returns only the reservation ID/number/start/deadline; no question content or `AssessmentQuestionKey`, `correctIndex`, student answers or grades. The service's availability is NOT student CBT activation: publication itself does not expose an exam. School timezone presentation and proper idempotent admission retries remain future tasks.

Synthetic authenticated disposable-PostgreSQL tests are **AUTHORED, NOT EXECUTED** for no link, no separate approval/publication, wrong actor/school, racing duplicate starts, server clock/attempt number, immutable updates/deletes and terminal link revocation. Source-level node tests included in existing full test scripts are authored but not run. Next safe required slices: independently authorize/resume exact attempt, immutable idempotent answers and final submission/expiry, safe key-blind question projection, strictly private scoring, class record sheets. All require the Phase 6 and cumulative local CI-equivalent gates before student exposure or release. D-040 / ADR-026.


## Phase 7 separately authorized exam publication and terminal withdrawal (development candidate)

Cumulative `feature/phase7-assessment-publication-ledger` adds append-only `AssessmentPublicationEvent` records with PUBLISHED/WITHDRAWN, exact school/draft, active school-Super-Admin actor user/membership, reason and time. **A verified HM/Principal APPROVED assessment review is a prerequisite but is NEVER itself publication.** SQL independently requires that approved event, a sealed 1–50 question configuration, active teacher/class/section/subject/session/term and precise current same-school School Super Admin membership before allowing the first PUBLISHED record. A regular School Administrator, teacher, Form Teacher, HM/Principal or Platform Super Admin alone cannot publish. The service enforces the same current identity and draft state inside a school-locked SERIALIZABLE transaction.

WITHDRAWN is a separate terminal immutable history event available only after PUBLISHED; it is permitted even if the original author assignment later becomes inactive, ensuring an authorized School Super Admin can revoke availability promptly. No republishing a withdrawn draft, historical edits, deletes, or truncate. The restricted no-store School Super Admin publication queue/UI show approved draft configuration metadata, publication/withdrawal state and reasoned explicit decisions without keys, question content or student details. **PUBLISHED currently records administrative authorization only: there is still no student exam question route, CBT attempt, autosave, scoring or report sheet, and no one may interpret it as production CBT enablement.**

Synthetic real-session auth/review/publication/return/withdrawal/forged direct-DB audit tests and static Node guard assertions were **AUTHORED, NOT EXECUTED**. SQL migrations and full local CI-equivalent remain pending. Phase 6 verified student enrollment and identity preconditions are still unverified. See D-039/ADR-025.


## Phase 7 controlled section review and future CBT admission policy (candidate; unverified)

Cumulative `feature/phase7-cbt-attempt-foundation` adds an **append-only terminal** `AssessmentReviewEvent` for an existing immutable, sealed `AssessmentDraft`, with APPROVED or RETURNED, reason, reviewer user + school membership, timestamp and unique school/draft key. The same draft can be decided **once**; a returned or superseded setup requires a **new immutable draft**, not an in-place edit or second decision. An active HM may moderate **only** a sealed draft whose stored class belongs to a verified active PRIMARY section in the same school; an active Principal may moderate **only** an exact verified active SECONDARY section. Both the serializable service and the new SQL insertion trigger independently verify reviewer membership/user, verified SECTION ScopeGrant for the draft's **actual** class.sectionId, active school/session/term/teacher assignment/subject and 1–50 sealed items. Independent CLASS/SUBJECT scopes, school administrator role, Form Teacher responsibility and platform-admin access do not override section scope. Audit UPDATE/DELETE/TRUNCATE is denied.

A no-store reviewer queue and detailed preview return immutable draft metadata and **ordered question text/options and marks only**, never the answer-key table or correctIndex. The user interface requires inspecting the questions and confirming the class/subject, schedule and limits before recording a decision. Review is **NOT exam publication**. Neither an APPROVED event nor the preview enables any student CBT route, attempt, autosave, scoring, answer key exposure or official results.

A separate, pure `cbt-admission-policy.ts` defines provisional UTC elapsed-minute timers, attempt number/count semantics and deadline = min(start + duration, scheduled close), with authored Vitest cases for late entry, exact close, active sessions, invalid limits and retry cap. The pure module does **not** authorize a student or write any attempt. A future real attempt service must independently enforce school publication approval, immutable released draft, authenticated attested STUDENT-to-StudentRecord identity, active exact enrollment/class/session/term, server-managed atomic attempts, idempotent answers and submission, expiry and grade integrity at SQL and service layers.

Review discovery, preview and decision API routes + reviewer workspace and synthetic real-session tests are **authored but not executed**. A real defect in the parent `20261012270000_phase7_assessment_drafts` migration (two malformed PL/pgSQL dollar-quote declarations/one closing delimiter) was repaired in this cumulative branch and pinned by a Node guard; no migration has been run. D-038, ADR-024. Phase 6 dependency and full local CI/audit gate remain BLOCKED.


## Phase 7 immutable assessment configurations (authored; UNVERIFIED)

`feature/phase7-assessment-draft-config` builds on the private question bank and adds immutable **DRAFT-ONLY** `AssessmentDraft`, `AssessmentDraftQuestion` and `AssessmentDraftSeal` records. An active exact school/class/subject/session/term TEACHER assignment can author a QUIZ, TEST or EXAM configuration, containing an explicit title, UTC scheduling window inside the active term, duration 5–180 minutes, maximum attempts 1–3, passing percentage 0–100 and 1–50 ordered existing questions with 1–20 integer marks each. These are **configuration limits, not yet enforced attempt or score workflows**. The service verifies active actor/assignment/term and exact same-owner/assignment/class/subject/session/term **keyed** questions under a serializable transaction. The SQL INSERT guards independently verify the actor, active school/term/section/assignment, valid time window and every selected question's matching tuple and private key. No client-supplied teacher/actor/class/subject/session fields grant authority.

The draft, its positioned marks and its **one-time immutable seal** are created atomically. SQL refuses new items after seal; authorized staff metadata lists only sealed drafts. Duplicate question selections/positions, oversized or malformed windows/marks/attempt limits and wrong school/class/term/assignment are rejected. The teacher UI uses current assignment and term options, selects questions only from that exact tuple and labels everything "draft — not published." A changed configuration requires an independently recorded new draft; no in-place mutation, no attempt/session start, no learner GET, no correctIndex or answer key reveal, no scores and no official report-card publication.

**Authored, NOT executed:** additive `20261012270000_phase7_assessment_drafts` migration, synthetic real-session PostgreSQL tests for exact teacher/tenant/schedule/grade/immutable seal, and Node source guards. Actual Prisma/DB, browser, full CI and `npm audit --audit-level=high` remain pending. Phase 6 prerequisites unverified. This does not complete ASM-REQ-001. See D-037 / ADR-023.


## Phase 7 question bank foundation — authored, NOT VERIFIED

Cumulative development branch `feature/phase7-question-bank-foundation` builds on the unmerged Phase 6 candidate. Only an authenticated active **TEACHER** holding an ACTIVE exact `TeacherClassSubjectAssignment` for the same active school/class/subject/session and active term can create an immutable multiple-choice question. A Form Teacher title by itself, independent CLASS/SUBJECT grants, school administration, foreign school, missing term or legacy NULL-session assignment **do not** grant authorship. The service verifies these inside a serializable transaction with school/membership/assignment/term locks; the additive PostgreSQL question-insert trigger independently binds actual actor ID, role, ACTIVE assignment, class, section, subject, session and term. Client cannot supply author, teacher membership, class, subject or session identifiers.

Each question stores a validated 2–6 nonempty/distinct option array and question prompt. Its **correctIndex is stored exclusively in separate `AssessmentQuestionKey`**, created in the same transaction with composite school/question FK and its own immutable trigger. The authoring POST and teacher-only metadata GET return question text and options **without answer indexes**, and no student question, answer key, scoring, exam delivery, publication, attempt or export endpoint exists. No answer key can be changed or deleted through normal database writes; content replacement will require a separately versioned question lifecycle, not UPDATE. GET reads rejoin current signed-in TEACHER and original active exact assignment and return at most 100 metadata rows, no keys.

An assigned-teacher browser page provides four-option question creation as a conservative UI subset of the server's 2–6 choice capability. Runtime tests on a disposable PostgreSQL database and browser remain pending. Synthetic authenticated integration cases and read-only Node SQL guard tests were **AUTHORED, NOT EXECUTED**. This is a Phase 7 **foundation only**, not ASM-REQ-001 completion, approved CBT, publication or a completed prerequisite Phase 6. D-036/ADR-022.


## Scope

Tests, exams, question banks, CBT, assessment timing, score recording, and grading review.

## Requirements

- Question banks, CBT sessions, and assessment windows must be class- and subject-scoped.
- Attempt limits, autosave, submission, scoring, and resumption rules must be explicit.
- Students must not see answer keys or score data before release.
- Assessments remain distinct from official report cards.

## Controls

- Score validation and grading rules must be enforced.
- Result data should feed the result-sheet engine rather than duplicate a separate system.
