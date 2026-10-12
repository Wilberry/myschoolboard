# Phase 7 Reviewed Manual Gradebook Foundation — Development Checkpoint

**Date:** 2026-10-12
**Base:** feature/phase7-manual-mark-correction-decisions (draft PR #62), chained on #61/#60 and Phase 6/7 cumulative drafts.
**Branch:** feature/phase7-reviewed-manual-gradebook.
**Requirements:** ASM-REQ-001, TEN-REQ-001, SEC-REQ-001. **Exit gate:** BLOCKED.

## Authored
- No new migration: derives a teacher-only private academic gradebook from original immutable ManualMarkProposal, terminal section ManualMarkDecision and latest independently APPROVED ManualCorrectionRequest + Decision.
- `src/modules/assessments/reviewed-manual-gradebook-service.ts`: final SQL repeats signed-in active TEACHER and exact school/class/subject/session/term/section assignment, active enrolled pupil and matching StudentEnrollment. No correct keys, CBT answers or sibling school/teacher content. Returns individual component statuses PENDING_TEACHER_MARK/PENDING_ACADEMIC_REVIEW/RETURNED_NOT_APPROVED/APPROVED_INITIAL/APPROVED_CORRECTED/APPROVED_CORRECTION_PENDING/APPROVED_CORRECTION_RETURNED, preserving original vs effective approved marks. Pending/returned corrections never replace earlier approved points.
- Partial approved sums are for academic inspection only. A complete percentage is NULL until all present manual components are approved and no correction remains pending. No grade when no components. Bound 500 pupils, 30 manual components and 15,500 raw rows, fail closed on repeated active enrollment.
- No-store school `assessment-reviewed-manual-gradebook` GET, school-gated teacher page and accessible browser preview, explicit no student/parent result, export, official report, grade publish or CBT/teacher manual score merger.
- Authored synthetic real-session denied roles/foreign school, pending/approved/correction-status/completion test sequence and Node read-only guard registered in existing full tests. D-049/ADR-035 and module/authorization/traceability/roadmap docs updated.

## Evidence
**ACTUALLY EXECUTED:** GitHub connector reads/commits and 20/20 limited static source checks across seven fetched files (final teacher joins, review and pending semantics, row bounds, route privacy, UI interpolation correction, test registration). These are not tests of runtime functionality.
**AUTHORED NOT EXECUTED:** private read/query/Next UI, synthetic authenticated tests, Node guard.
**NOT EXECUTED:** Prisma validate/generate/migrations, disposable PostgreSQL trigger review and concurrency, whole Node/Vitest suite, lint/typecheck/Prettier/Next build, browser/a11y, `npm audit --audit-level=high` and agreed complete local CI-equivalent. Hosted actions billing blocked; Phase 6 prerequisites unverified.
**No live data, production migrations, merge, deployment or security check exemptions.** Not an official Phase 8 report and not authorized for student/guardian disclosure. Phase 7 remains PARTIAL/UNVERIFIED.
