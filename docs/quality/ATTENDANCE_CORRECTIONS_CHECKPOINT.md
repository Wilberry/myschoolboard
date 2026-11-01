# Phase 6 Immutable Attendance Corrections — Development Checkpoint

**Date:** 2026-10-12  
**Source branch and verified base commit:** `feature/attendance-scoped-read-workspaces` at `3e42d4ff7d111851e401b363aac3792bb098b61c`  
**Development candidate:** `feature/attendance-immutable-corrections` (unmerged; exact candidate SHA in GitHub PR).

## Phase and requirements

- Phase 6 / ATT-REQ-001 and T-ATT-001 — corrections preserve original daily attendance marks, actors and approval.
- SEC-REQ-001 and TEN-REQ-001 — active role, school boundary, section scope, atomic identity and immutable history.
- ADM-REQ-001 enrollment prerequisite remains partial. No requirement is declared complete.

## Files and modules changed

- `prisma/schema.prisma`: separate correction request/decision models and entry composite index, plus correct existing AttendanceEvent relation map.
- `prisma/migrations/20261012190000_attendance_immutable_corrections/migration.sql`: additive audit-guarded tables, exact composite foreign keys, revision checks and SQL actor authorization.
- `src/modules/attendance/corrections-service.ts`: authenticated PRIMARY Form Teacher request and stage-specific HM/Principal decision transactions.
- `src/modules/attendance/corrections-http.ts` and the two POST-only Next API routes: concealed 401/404/409 mapping, private no-store and no pupil logs.
- `src/modules/attendance/corrections.integration.test.ts`: disposable synthetic PostgreSQL authorization, concurrency, revision, audit spoofing and history checks.
- D-028 / ADR-014, Attendance module, constraints, roadmap, traceability, milestone checklist and this checkpoint.

## Database change and authorization

- A request references one exact existing school/register/entry, snapshots current effective mark, new mark, sequential revision, actor and reason; the original AttendanceEntry is never UPDATEd.
- Original class register must already be APPROVED; session and Section must still be ACTIVE. Form Teacher must have current PRIMARY responsibility for the exact class and session.
- One outstanding request per entry; serializable service and SQL BEFORE INSERT locking enforce revision/current-effective-mark correctness. A declined proposal does not change the effective mark; latest approved revision is intended for a future authorized read overlay.
- Only currently active school HM for verified PRIMARY section or Principal for verified SECONDARY section may approve/return with reason. Separate immutable decision, not the request author; no class grant stand-in or school/platform super-admin override.
- SQL forbids direct UPDATE/DELETE/TRUNCATE of both correction tables (existing explicit tenant deletion cascade convention only).
- No parent/guardian, student, unrelated teacher, general attendance/history GET or export is added.
- No destructive migrations, backfill, student account inference or live data access.

## Tests added versus executed

**Authored, not run:** authenticated real-session synthetic correction integration tests covering role and tenant denials, invalid payloads, mismatched entry, membership and grant revocation, wrong stage, sequential returned/approved mark history, stale expected value, pending duplicate, forged database actor/decision, UPDATE/DELETE/TRUNCATE tampering, concurrent requests.

**Actually executed:** GitHub API branch and commit write operations only. They are *not tests*. No local Git checkout in this isolated container, and GitHub DNS retrieval by `git ls-remote` failed. No disposable PostgreSQL instance was confirmed and no database writing command was run. No Prisma generate/format/validation, migration, Vitest unit/integration, HTTP/browser test, npm lint/typecheck, Next build, or `npm audit --audit-level=high` executed for this cumulative candidate.

## Known limitations, deviations and remaining tasks

1. Correction effective-mark read projection, scoped queue and UI remain to build; this PR's protected POST APIs are not a completed end-to-end user workflow.
2. Correction retrospective deadlines and school-local timezone/calendar are not configured. Current safe interim behavior: ACTIVE session only; no arbitrary school-close override, and all requests require current Form Teacher relationship.
3. Run additive migration in the operator-verified, disposable PostgreSQL test DB only. Test database integrity, revocation/concurrent decisions, trigger SQL and tenant deletion cascade.
4. Complete the unchanged local CI-equivalent sequence and record exact SHA, commands, exit status, test counts, migration applied, format/lint/typecheck/build and **strict** high-severity dependency audit findings; GitHub Actions remains blocked by billing.
5. Review privacy/accessibility and business acceptance before exposure to live pupil data. Existing high-severity advisories and other release gates remain blockers.

**Exit gate: BLOCKED (unexecuted migrations, tests, quality/security gates).** Implementation is authored, not validated, deployed or production ready.
