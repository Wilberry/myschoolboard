# Phase 7 Teacher Marking and Provisional Class Sheets — Development Checkpoint

**Date:** 2026-10-12. **Requirement:** ASM-REQ-001 / T-ASM-001, TEN-REQ-001, SEC-REQ-001.
**Base:** `feature/phase7-cbt-objective-scoring`, draft PR #57, cumulatively on #56–#50 and unfinished Phase 6.
**Branch:** `feature/phase7-private-class-record-sheets` (development only).
**Exit gate:** BLOCKED — no database/full local CI-equivalent, strict audit or Phase 6 verification evidence.

## Authored work
- A teacher-authenticated, exact current original assignment `listOwnUnscoredCbtAttempts` metadata queue with private no-store GET and body-free POST to the SQL-only immutable objective scoring service. No numeric client score and no raw pupil answer/key read; no learner grade publication.
- Teacher-only read-only provisional `class-record-service.ts` and private school `assessment-class-records` GET, school teacher `assessment-class-records` page/workspace, `assessment-marking` page/workspace, role-aware school navigation. The final SQL projection requires an active same-school TEACHER holding exact class/subject/session assignment, ACTIVE term/section/class/subject and exact current ENROLLED StudentRecord/ACTIVE StudentEnrollment. Returns private student names/admission number only to that teacher.
- LATERAL only sealed, approved, published and nonwithdrawn subject assessments; best **submitted and already SQL-scored** attempt per assessment chosen by highest percentage then earned marks and attempt number; unscored assessments remain pending and do not dilute scored-only aggregates. Student/parent/official report publication, downloads and score corrections remain absent. Strict 500 pupil, 30 assessment and 15,500 raw row limits, with fail-closed duplicate active enrollment/draft rows.
- Scored results originate from previous additive `AssessmentAttemptScore` SQL trigger, which alone reads private answer keys; this branch introduces **no migration**, no new answer-key field or official result publication.
- Narrowly extends existing `readLessonWritingOptions` teacher picker to include exact assignment classId and subjectId so client does not infer these identifiers. Server never trusts them as authorization.
- Synthetic authenticated real-session tests for queue, body-free scored result, exact teacher vs unauthorized school roles, same-school class sheet with immutable obtained marks and no keys; new Node source guard included in existing full `npm test`, retaining all Vitest and strict security/audit controls.
- Module/roadmap/traceability/authorization D-044 and ADR-030 updated.

## Authored vs executed evidence
**Actually executed:** GitHub connector branch/file/commit operations and a limited structural review across eleven GitHub-fetched files; **15/15 source-presence/static consistency assertions passed** (exact active teacher/final student row auth, assessment publication checks, private/no-store, pending/best attempt, key separation, bounded result, picker IDs, test registration). This is **not** a Node/Vitest/TypeScript/Prisma/Next/PostgreSQL test.
**Authored but NOT executed:** changed synthetic integration and Node regression suites, Next pages, private routes, SQL scorer/lock/trigger tests from parent #57.
**Not executed:** Prisma generate/validate/migrations, PostgreSQL tests, format/prettier, lint/typecheck, whole Node/Vitest suite, Next build, browser/accessibility, `npm audit --audit-level=high` or full local CI-equivalent. GitHub Actions remains billing-blocked. No verified owner-approved disposable DB target in this connector session.
**Safety:** no merges, deployments, production settings, live data, official grades, student result endpoints, answer-key disclosure or security gate relaxation.

## Remaining before operational completion
1. Run all cumulative migrations and tests on agreed disposable PostgreSQL. Fix any FK naming, trigger, auth, deadlock, score/replay/race or schema drift issues. Validate strict dependency audit on the exact commit.
2. Browser/a11y test teacher marking and class sheets, inspect network response privacy and verify role/membership and enrollment revocation races.
3. School-specific CA/exam weight and grade scales, teacher-entered theory/subjective marking, corrected scoring audit/reassessment, final sheet approval, official result/report publication remain separate decisions/features. The class sheet here is explicitly **PROVISIONAL**.
4. Only after passing Phase 6 prerequisites and full Phase 7 acceptance may product owners consider publication/deployment. Do not silently promote this development code to released status.

**Outcome:** substantial Phase 7 requested foundations authored, **NOT VERIFIED OR COMPLETE FOR PRODUCTION**.
