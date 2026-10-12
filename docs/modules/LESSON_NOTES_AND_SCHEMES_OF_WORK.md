# Lesson Notes and Schemes of Work

## HM/Principal lesson-note review workspace (unverified)

The restricted `/schools/{schoolId}/lesson-note-reviews` page independently authenticates with Better Auth and uses the section-bound reviewer SQL query for its initial pending-note list. The existing school-details page offers `Review submitted lesson notes` navigation only when the actor's active `HEAD_OF_SECTION` membership has a verified same-school active PRIMARY-section grant or `PRINCIPAL` has a verified same-school active SECONDARY grant; role alone is not a sufficient navigation hint. The page will return not-found for unauthorized direct navigation regardless of link visibility.

The client reviewer workspace opens one exact permitted SUBMITTED note and its immutable revisions, then sends separate explicit `APPROVE` or `RETURN` decisions with `expectedRevision` and a required 5–500-character reason to the protected reviewer API. Both actions ask for confirmation; stale decisions are rejected and reload the queue. Approval never releases content to students. No other section, school admin, teacher-self-review, parent or student action is exposed. Four new synthetic disposable-DB navigation regression cases are authored; real browser/keyboard/session tests remain **unexecuted**.

## Section-scoped HM/Principal review — development candidate, unverified

Lesson-note review now uses the actual school-owned `SchoolClass.sectionId` and active `SchoolSection(stage)`, not a client-asserted section. A `HEAD_OF_SECTION` reviewer may review only notes attached to a **PRIMARY** section for which their same-school active membership has a verified SECTION grant. A `PRINCIPAL` reviewer may review only a **SECONDARY** section with an exact verified active grant. These are conservative role-to-stage defaults for the canonical HM/Principal primary/secondary responsibilities; neither role gains school-wide `school:configure` permission. Unclassified/inactive classes, foreign section IDs, inactive teachers/assignments/terms/sessions, wrong-stage reviewers, and unverified/revoked grants are denied. Reviewer content reads use one SQL statement joining the target note's class/section to the actor's verified ScopeGrant; list results include only SUBMITTED notes (at most 100), and an exact authorized note detail contains up to 100 immutable revisions. No teacher DRAFT, APPROVED, or RETURNED record appears in the pending queue.

`POST /api/schools/{schoolId}/lesson-note-reviews/{noteId}/decision` accepts `{action:"APPROVE"|"RETURN", expectedRevision, reason}`, requiring a non-empty reason of 5–500 characters. It locks/rechecks the school, actual reviewer membership, note, class, section, and corresponding ScopeGrant in one serializable transaction, authorizes `academic:approve` for the exact section, enforces the matching role/stage and SUBMITTED revision, and writes a reasoned, append-only `LessonNoteEvent` with the reviewer identity. A PostgreSQL review-event trigger separately validates that exact class–section–reviewer grant and matching status; a partial unique index prevents two review decisions on the same note revision. Returned notes require a **new immutable teacher revision** before resubmission; the teacher API resets current state to DRAFT when that new version is saved while retaining the original review and submission events. An APPROVED note is **not RELEASED** and has no student/guardian read API, download, or publication action.

Seven additional real-session/disposable-PostgreSQL reviewer integration cases are authored for denied actors, cross-stage/cross-class access, unclassified notes, return–revise–resubmit–approve, revocation, audit tampering, and term closure. The SQL enum/trigger migration, DB tests, real HTTP/browser behavior, and concurrent decisions are **not run**. The review UI and release flow are separate checkpoints.

## Lesson-note draft and submission foundation (new, unverified)

The Phase 6 development candidate supports an authenticated **TEACHER** with an exact ACTIVE same-school class/subject/**session** assignment and an ACTIVE term in that session. The teacher may create a `DRAFT` note, append immutable content/objective/topic revisions with an explicit expected revision number, list/view **only their own notes** through active resource-scoped queries, and transition the latest draft to `SUBMITTED`. No school admin or other teacher can use these author-only endpoints. **SUBMITTED is not APPROVED or RELEASED.** No student/guardian read endpoint, downloads, class release, publication, or self-approval is added.

The additive `LessonNote`, `LessonNoteRevision` and `LessonNoteEvent` models retain school, session, term, teacher membership, class, subject and exact teacher assignment bindings. Composite foreign keys enforce school/term/assignment ownership, and first/new revisions and workflow events commit atomically with a serializable note mutation. PostgreSQL triggers protect revisions and events from ordinary update/delete/truncate, with actor validation and original-event metadata retained; the note's latest topic and version counter are a current-state index, **not** a replacement for old versions. Draft revision is rejected once submitted, including duplicate/stale submissions. Concurrent editors must provide the expected current revision; stale writes return 409.

The active membership, class, subject, session, term and assignment are rechecked inside writes; reads repeat active ownership constraints in the final database predicate. The conservative default intentionally withholds even author access after teacher-assignment revocation or term closure, while preserving all historical notes and audit events in the database for a future separately authorized archive workflow.

**HM/Principal section-scoped approval and revision-return, school-specific approval policy, schemes of work, student enrollment, and final release/visibility are NOT implemented.** Those require a verified school-owned Section/class relationship and reviewer scope; granting an HM/Principal school-wide note approval without it would contradict the access model. All SQL, route/database tests, actual Next/browser checks, and full CI-equivalent gates remain pending local verification.

## Protected teacher lesson-planning workspace (draft; unverified)

A teacher-facing page at `/schools/{schoolId}/lesson-notes` is linked from the home school card only for active `TEACHER` memberships and independently authenticates with Better Auth on the server. The `readLessonWritingOptions` query returns only the current teacher's ACTIVE session-backed class/subject teaching assignments and corresponding ACTIVE terms, repeating active membership/role/school ownership in each final collection query. The client editor creates DRAFT notes, opens the author's own immutable revision history, saves a new expected-version revision, and submits the current draft for a future reviewer through the already protected lesson-note API. The UI does **not** itself authorize content: every API call checks the real actor and resource, and stale/denied errors are generic.

The editor caps form options at 100 terms and 200 assignments; note lists are capped at 100 and each note's revisions/events at 100 by the service. Keyboard, screen-reader, form-state, failed refresh and actual browser workflows remain to be checked. It has **no reviewer approval/return control, student release button, class announcement or public note URL**. Four synthetic disposable-DB read-isolation cases for teacher ownership/role/active membership/query predicates are authored but not executed.

## Scope

Schemes, planned lessons, weekly topics, approval/revision history, release to class, and visibility management.

## Required workflow

- Teachers create and submit notes for authorized class and subject.
- HM or Principal approves or returns notes for revision.
- Approved notes may be released to students in the authorized class.
- Students see only notes released to their class and term.

## Constraints

- Teachers may not present unapproved notes as official release material.
- Revision history must preserve meaningful versions.
- Class archive or term closure must be handled without silently destroying record history.
