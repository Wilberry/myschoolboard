# Assessments and CBT

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
