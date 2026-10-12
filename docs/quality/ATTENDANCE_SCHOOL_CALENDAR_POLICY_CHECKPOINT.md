# Attendance School Calendar Policy — Phase 6 Development Checkpoint

**Date:** 2026-10-12  
**Base:** `feature/attendance-ledger-integrity-hardening` at `6171139800fab143fe8664bf09e74ed409b89e87` (draft PR #44)  
**Candidate:** `feature/attendance-school-calendar-policy` (unmerged, not deployed)  
**Requirements:** ATT-REQ-001, SCH-REQ-001, T-ATT-001, TEN-REQ-001 and SEC-REQ-001 (partial authorship only).

## Deliverables authored

- Prisma additive `SchoolAttendancePolicyRevision` with school, admin actor user + membership, sequence, timezone, allowable prior submission/correction calendar days, reason and time.
- Review-only migration `prisma/migrations/20261012210000_school_attendance_policy/migration.sql`: SQL active administrator and timezone verification, exact next revision, immutable no-update/delete/truncate history, tenant school lock and independent date checks on new SUBMITTED events and new correction requests. No existing school, pupil, entry, mark, historic decision or policy was migrated.
- `src/modules/attendance/school-date-policy.ts`: pure IANA-calendar-day helper with DST-safe YYYY-MM-DD conversion and conservative double upper bound (both local and existing UTC day). Default no-revision: Etc/UTC, submit within 7 prior days, correct within 30 prior days.
- `src/modules/attendance/policy-service.ts`: transactional same-school `school:configure` admin policy revisions, PostgreSQL timezone lookup, latest revision read and private admin display. `service.ts` and `corrections-service.ts` now read and enforce the versioned school policy inside their existing school-locked serializable transactions.
- Private POST route `/api/schools/[schoolId]/attendance-policy`, school administrator attendance policy screen and setup navigation.
- Authored `school-date-policy.test.ts` (local time, UTC overlap, DST, invalid dates, age bounds) and `policy.integration.test.ts` (synthetic admin vs foreign/teacher, invalid timezone, immutability, sequential versions, revocation and forged direct DB actor).
- Extended read-only Node SQL/schema guard in `scripts/attendance-ledger-guard.test.mjs`. The existing `npm test` suite retains Vitest and the guard; GitHub CI steps and strict high-severity audit gate are unchanged.
- D-031, ADR-017, module specification, configuration catalog, database invariants, requirements traceability, roadmap status and checklist updated.

## Authorization, safety and limitations

- Only active same-school School Administrator/Super Admin with `school:configure` may author a new policy; the original policy revision is never overwritten and its author/reason remain recorded. No Form Teacher or HM/Principal access is broadened by policy configuration.
- A new policy revision controls **future** submission/correction eligibility, never rewrites prior immutable attendance marks, audit events, approvals or corrections.
- Direct-write SQL layer checks current active school and calendar window, but database owners with elevated privileges remain outside the application trust boundary; transaction and trigger tests are required before security claims.
- The old SQL rule forbidding a submission date after UTC today remains unchanged. A local timezone ahead of UTC can be more restrictive, intentionally, until complete migration/validation work permits a separately reviewed change.
- School holidays, public holidays, exceptional closures and closed-session retrospective corrections remain disabled/not implemented. Calendar windows are conservative configurable engineering defaults, not verified school-specific business-policy decisions.
- Existing direct-SQL full-roster security guard from PR #44 remains mandatory. No access to student/guardian data, exports or live records was added.

## Verification provenance

**Authored but NOT executed:** `school-date-policy.test.ts`, `policy.integration.test.ts`, extended Node source-guard assertions, Prisma schema and additive SQL migration. No actual Node/Vitest/Prisma parser/Next/browser command was run against the cumulative repository.

**Executed:** Connector-backed GitHub branch/file writes (not tests); one limited in-tool comparison of six GitHub-fetched candidate source files against 10 literal source-consistency assertions, **10 of 10 passed**: policy defaults align with migration, both mutation services read policy, both SQL triggers authored, actor/immutability guard present, timezone checks and UTC safeguard retained. This does not prove behavior, SQL validity, trigger execution or regression safety.

**Not executed:** no configured disposable PostgreSQL target or full checkout was available in this tool session; no migration deployment, seed, DB tests or records accessed. No `npm ci`, `db:generate`, `db:deploy`, `db:seed`, `format:check`, `lint`, `typecheck`, `npm test`, `build`, `npm audit --audit-level=high` or local CI-equivalent was run. GitHub Actions remains blocked by billing.

## Local checkpoint exit plan

1. On owner-verified disposable loopback PostgreSQL only, use unchanged local CI-equivalent preflight, then check additive migration order, Prisma drift, SQL timezone table, trigger validation, locks, school cascade and date-window equivalence.
2. Execute all new unit/integration suites and prior Phase 2–6 tenant, identity, student, Form Teacher, reviewer, correction and direct-SQL bypass tests. Include timezone/DST boundary, role/grant revocation and policy revision races.
3. Run unchanged full CI-equivalent `npm ci`, Prisma generate/deploy/seed, Prettier, lint, typecheck, all Node + Vitest tests, Next build and high-severity dependency audit. Record tested SHA, command exit codes and test counts. Do not waive high findings.
4. Repair all deficiencies found before requesting any merge/release; complete school holiday/non-teaching day rules and browser accessibility when documented scope permits.

**Exit gate: BLOCKED — tests, database migration, browser, full build and mandatory security audit unexecuted.** No merge, deployment, data backfill, live users or relaxed security requirements.
