# Assessments and CBT

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
