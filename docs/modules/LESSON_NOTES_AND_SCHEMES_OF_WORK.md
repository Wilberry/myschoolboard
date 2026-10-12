# Lesson Notes and Schemes of Work

## Lesson-note draft and submission foundation (new, unverified)

The Phase 6 development candidate supports an authenticated **TEACHER** with an exact ACTIVE same-school class/subject/**session** assignment and an ACTIVE term in that session. The teacher may create a `DRAFT` note, append immutable content/objective/topic revisions with an explicit expected revision number, list/view **only their own notes** through active resource-scoped queries, and transition the latest draft to `SUBMITTED`. No school admin or other teacher can use these author-only endpoints. **SUBMITTED is not APPROVED or RELEASED.** No student/guardian read endpoint, downloads, class release, publication, or self-approval is added.

The additive `LessonNote`, `LessonNoteRevision` and `LessonNoteEvent` models retain school, session, term, teacher membership, class, subject and exact teacher assignment bindings. Composite foreign keys enforce school/term/assignment ownership, and first/new revisions and workflow events commit atomically with a serializable note mutation. PostgreSQL triggers protect revisions and events from ordinary update/delete/truncate, with actor validation and original-event metadata retained; the note's latest topic and version counter are a current-state index, **not** a replacement for old versions. Draft revision is rejected once submitted, including duplicate/stale submissions. Concurrent editors must provide the expected current revision; stale writes return 409.

The active membership, class, subject, session, term and assignment are rechecked inside writes; reads repeat active ownership constraints in the final database predicate. The conservative default intentionally withholds even author access after teacher-assignment revocation or term closure, while preserving all historical notes and audit events in the database for a future separately authorized archive workflow.

**HM/Principal section-scoped approval and revision-return, school-specific approval policy, schemes of work, student enrollment, and final release/visibility are NOT implemented.** Those require a verified school-owned Section/class relationship and reviewer scope; granting an HM/Principal school-wide note approval without it would contradict the access model. All SQL, route/database tests, actual Next/browser checks, and full CI-equivalent gates remain pending local verification.

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
