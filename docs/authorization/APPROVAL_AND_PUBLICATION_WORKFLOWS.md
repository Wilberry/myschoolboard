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
