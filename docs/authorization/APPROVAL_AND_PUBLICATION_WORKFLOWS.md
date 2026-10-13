# Approval and Publication Workflows

## Attendance workflow

1. Form Teacher submits attendance.
2. HM/Principal reviews the attendance record.
3. Approval or rejection occurs.
4. Corrections retain original record and reason.

## Lesson note reviewer development workflow (not yet validated)

An exact active subject teacher creates numbered immutable drafts and submits a revision. Only the same-school HEAD_OF_SECTION with verified PRIMARY-section grant, or PRINCIPAL with verified SECONDARY-section grant, may see or decide the submitted note attached to that exact class.sectionId. The review decision must contain the revision number, actor, timestamp, and reason in an append-only `LessonNoteEvent`. Approval moves it to APPROVED (not RELEASED); return moves it to RETURNED and requires a **new** immutable author revision before another submission. The review API never exposes unsubmitted drafts or personal pupil records. No student notes may be released under this development checkpoint. Real DB tests and in-product review UX remain outstanding.

## Lesson note workflow

1. Teacher drafts lesson notes.
2. Submission is routed for HM/Principal review.
3. Approval or return for revision occurs.
4. Release is only possible for approved content.

## Result sheet workflow

1. Teacher prepares the class result sheet.
2. HM/Principal reviews and approves, rejects, or returns it.
3. Result data populates the report-card workspace.
4. School Super Admin performs the final publication action.
5. Parent or student access depends on the configured visibility policy.

## Publication policy

The platform must treat HM/Principal approval and School Super Admin publication as separate steps. No report card is considered official until final publication approval is complete.

## Support override policy

Exceptional support access, if approved, must require explicit authorizer, reason, limited scope, duration, audit log, and visibility to the relevant school or customer.


## Phase 8 independent final school-owner approval foundation (development, not released)

1. The original exact teacher prepares a frozen source-evidence revision from current approved/sealed/valid sources.
2. Verified-section PRIMARY Head of Section or SECONDARY Principal independently approves that exact unchanged snapshot.
3. The School Super Admin inspects metadata in a private prepublication reader. This read is advisory only.
4. The School Super Admin may record a separate reasoned, irreversible `APPROVED_AWAITING_RELEASE` decision for the latest academically approved source; SQL rechecks owner/teacher/reviewer/section/school/policy/complete pupil sources under School lock and stores a separate audit ordinal/time. A second source version requires renewed independent academic approval and a new final owner record, never editing old history.
5. **Not yet implemented:** School-approved official grading/report-card artifact, explicit recipient visibility policy, immutable recipient-release event, student/guardian result view, publication download/verification, and safe post-publication amendments. No final school approval alone exposes results; runtime migrations/tests/CI/security must pass before any release.
