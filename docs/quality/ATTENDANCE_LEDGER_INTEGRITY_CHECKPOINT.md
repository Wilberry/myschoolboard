# Phase 6 Attendance Ledger Integrity Hardening — Development Checkpoint

**Date:** 2026-10-12  
**Baseline:** `feature/attendance-correction-review-workspaces` (draft PR #43) at `e4a6b8a2b81bfa0f1cba69a1c37dbdd87eed076c`  
**Development branch:** `feature/attendance-ledger-integrity-hardening` — cumulative unmerged candidate.

## Phase, requirement IDs, and risk

- Phase 6 / ATT-REQ-001 and T-ATT-001: exact full school/class/session daily attendance roster, student enrollment and immutable author event.
- TEN-REQ-001 and SEC-REQ-001: exact tenant-scope, actor authority, direct-database mutation defense and audit-history integrity.
- Review finding: prior `AttendanceEvent(SUBMITTED)` insertion trigger required an authorized PRIMARY Form Teacher plus **EXISTS one AttendanceEntry**, but did not independently enforce a *complete* ACTIVE enrolled class roster. The application already rejected partial lists. A direct database insert could omit enrolled pupils while satisfying that initial SQL check.
- Additional migration-drift finding: `AttendanceRegister.formTeacherResponsibility` in `prisma/schema.prisma` lacked the explicit composite foreign-key `map` corresponding to the existing `AttendanceRegister_form_teacher_exact_fkey` SQL constraint.

## Changed code and migrations

- **Additive, review-only** `prisma/migrations/20261012200000_attendance_complete_roster_guard/migration.sql`: extra BEFORE INSERT on `AttendanceEvent` for SUBMITTED, tenant row lock, exact active school/class/session counts of `AttendanceEntry` versus `StudentEnrollment` + enrolled `StudentRecord`, individual entry eligibility and 1–500 bound.
- `prisma/schema.prisma`: Form Teacher composite relation is now explicitly mapped to its earlier SQL migration constraint name; no table or historical records touched.
- `src/modules/attendance/routes.integration.test.ts`: synthetic two-pupil class direct transaction tries to submit one individually valid mark and correct actor event. Expect rejection and rollback of register and event. Existing full-roster concurrent HTTP test remains intact.
- `scripts/attendance-ledger-guard.test.mjs`: read-only Node test for SQL/schema constraint, trigger names, exact tenant FK and immutability presence, plus no destructive SQL in the new migration.
- `package.json`: `npm test` now runs the standalone read-only Node guard **before** unchanged Vitest; optional `verify:local:guards` gains the same guard. The GitHub CI ordered steps and mandatory `npm audit --audit-level=high` remain unchanged.
- D-030 / ADR-016, attendance module, database invariants, requirements traceability, current status and milestone checklist updated.

## Permission and history implications

- No new student, parent, guardian, subject-teacher, platform-admin, Form Teacher or section reviewer permissions.
- No existing `AttendanceEntry`, original mark, correction request, approved decision or audit log is overwritten.
- The SQL guard supplements rather than replaces per-entry trigger, Form Teacher actor event trigger, composite foreign keys, deferred audit-presence enforcement, and one-way review constraints.
- No migration application, destructive backfill, seed, live data, deployment, merge or security relaxation.

## Verification evidence — strict authored versus executed distinction

**Authored only, NOT executed in Node/Vitest/PostgreSQL:**
- `scripts/attendance-ledger-guard.test.mjs` read-only Node assertions.
- `routes.integration.test.ts` synthetic direct-DB partial-roster transaction and rollback test.
- New additive PostgreSQL trigger function, migration, and Prisma schema FK mapping.

**Actually executed, limited non-database source inspection:**
- GitHub API read of the candidate schema, migrations, package script and guard-test file; ten simple string/static presence checks **passed** against fetched file contents before the final FK mapping addition.
- This is **NOT** a run of the authored Node test file, PostgreSQL DDL, Vitest, Prisma validator, TypeScript, lint, Next build, CI-equivalent workflow or security audit. The GitHub API confirmed branch and file commits; those operations are not tests.

**Not executed / not verified:**
- No confirmed disposable local PostgreSQL target was available; no migrations, database mutations, seed, DB concurrency or trigger tests run.
- `npm ci`, `prisma generate`, migration deploy, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit --audit-level=high` **not run on this branch**.
- GitHub Actions remains blocked by billing; all dependency security findings remain unresolved until actual gate evidence is produced.

## Next steps and exit gate

1. Run original cumulative migrations in order on the owner-confirmed disposable PostgreSQL test DB; test the full vs partial school roster, FK naming/schema drift, trigger execution, audit rollback, revocation races, direct SQL attempts, and explicit school deletion lifecycle.
2. Run the newly added Node guard and entire previously authored real-session Phase 2–6 suites through **unchanged** local CI-equivalent sequence. Record SHA, commands, test counts and exit codes without selectively dropping failing tests.
3. Correct all Prisma/parser, SQL, type/lint/build and audit findings. Security audit remains an unconditional release gate.
4. Continue school-configurable attendance timezone/day/correction-window policies under conservative defaults after data integrity verification.

**Exit gate: BLOCKED — database migration and CI-equivalent tests unexecuted. ATT-REQ-001/TEN-REQ-001/SEC-REQ-001 not complete.**
