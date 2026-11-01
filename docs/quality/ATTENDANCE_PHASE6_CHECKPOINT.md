# Phase 6 Attendance Development Checkpoint — 2026-10-12

## Branch and scope

- Cumulative source baseline: `feature/student-enrollment-ledger-foundation` at `741f8eb028a3d41125b5a509292bd0ce8f6e3237`.
- Cumulative unmerged drafts: #38 (administrator student workspace), #39 (attendance policy), #40 (attendance ledger and POST workflows), #41 (scoped roster/review GET and browser workspaces).
- Candidate branch at authoring: `feature/attendance-scoped-read-workspaces`. This is a development artifact, **not** a release-ready build.

## Phase and requirements

- Phase 4/6 ADM-REQ-001 prerequisite: school administrator student record and explicit verified session/class enrollment.
- Phase 6 ATT-REQ-001 / T-ATT-001: daily class attendance submission, exact Form Teacher authority, HM/Principal approval and historical audit.
- Cross-cutting TEN-REQ-001 and SEC-REQ-001: tenant ownership, role/scope checks, private read projections, failure concealment and database authorization.
- Requirements remain **partially authored and unverified**; no critical security or attendance requirement is marked complete.

## Files and modules changed

- Student admin: `src/modules/students/read-workspace.ts`, `src/components/student-workspace-editor.tsx`, `app/schools/[schoolId]/students/page.tsx` and school navigation (prior cumulative PR).
- Pure attendance permission kernel: `src/modules/attendance/eligibility.ts`.
- Persistence: `prisma/schema.prisma` and review-only migration `20261012180000_attendance_register_ledger`.
- Attendance mutations: `src/modules/attendance/service.ts`, `http.ts` and private submission/decision POST routes.
- Attendance private readers: `src/modules/attendance/read-service.ts`, `read-http.ts`, `navigation.ts`, scoped GET routes.
- Attendance browser: server-gated school pages for Form Teacher and reviewer, separate `attendance-entry-editor.tsx` and `attendance-review-editor.tsx`.
- Decisions/documentation: D-026, D-027, ADR-012, ADR-013, Attendance module, current status, milestone checklist, constraints and traceability.

## Database migration and invariant implications

- Additive, school-owned AttendanceRegister/Entry/Event with exact school/student/enrollment/class/session and Form Teacher composite references.
- One school/session/class/date row, unique event decisions, immutable entry/event rows, one-way register review state, and deferred presence of matching actor-validated event.
- Explicit tenant deletion cascade convention retained; no historical migration/backfill or account linkage.
- Migration **created for review only; NOT executed**. No schema drift, trigger execution, enum, rollback or tenant cascade evidence exists for this candidate.

## Authorization and sensitive data

- Form Teacher POST requires authenticated ACTIVE exact PRIMARY responsibility, currently active class/session/student enrollment and complete roster, checked under serializable locks. No client-supplied pupil, section, actor or permission assertion determines authority.
- Review POST requires exact stored class.sectionId, verified active section grant and HM PRIMARY / Principal SECONDARY role mapping; same checks repeated by database event trigger.
- Form Teacher GET returns minimum active class roster only through the exact active responsibility SQL query. Reviewer GET queue has no pupil names or marks; detail has minimum names and marks only within its exact verified section.
- School Super Admin and Platform Super Admin do not automatically gain Form Teacher author or HM/Principal review rights. No guardian/student/subject-teacher broad roster GET or export.

## Tests authored (not executed)

- `src/modules/attendance/eligibility.test.ts`: exact enrollment, PRIMARY responsibility and stage/section policy.
- `src/modules/attendance/routes.integration.test.ts`: real-session disposable-PostgreSQL workflow cases, denied identities, malformed/cross-class/partial enrollment, UTC day bounds, duplicate/concurrent submissions, review scope, revocation, immutable event and mark tampering.
- `src/modules/attendance/reads.integration.test.ts`: active Form Teacher reader, role/tenant denial, query input validation, pending queue privacy, reviewer detail scope, grant revocation and server page option filtering.
- Previous synthetic student workspace tests are also authored, unexecuted in this cumulative candidate.

## Tests and tooling actually executed

- GitHub branch/commit creation, comparison and draft-PR creation: **confirmed through GitHub connector**, not tests.
- `git ls-remote` attempted in the isolated container: **failed** (GitHub DNS/network resolution unavailable). No complete repository checkout in this execution container.
- No Prisma generator or migration commands executed; no disposable database was provisioned or accessed.
- No Vitest unit or PostgreSQL integration tests executed.
- `npm ci`, `format:check`, `lint`, `typecheck`, `npm test`, `build`, and `npm audit --audit-level=high`: **NOT EXECUTED** on the cumulative branch.
- No local CI-equivalent, browser accessibility or HTTP end-to-end verification executed. GitHub-hosted Actions remains blocked by billing.

## Remaining blockers and work

1. Operator-run agreed local CI-equivalent workflow against **only** verified disposable PostgreSQL. Confirm migration and drift, trigger/cascade/rollback, same-day concurrent writes, revocation races, no inconsistent deferred event history, and the full existing Phase 2–6 suite.
2. Perform format, lint, TypeScript, Next build, browser keyboard and accessibility checks; fix defects without loosening protection.
3. Resolve existing high-severity dependency advisories; `npm audit --audit-level=high` stays an unchanged mandatory gate.
4. Add a separate immutable attendance correction/revision process, configurable school-local timezone/attendance policies and planned enrollment lifecycle; do not revise approved marks destructively.
5. Finish release acceptance, operational monitoring, deployment policy, and broader legal/privacy review before making pupil attendance live.

## Deviations, limitations and exit gate

- Development-only conservative defaults: maximum 500 pupil marks per submitted class register; whole-roster nonempty snapshot; UTC current-day or earlier submission; one terminal APPROVED/RETURNED review; no correction flow yet. Documented in D-026/D-027, not approved production policy.
- No live data, external provider use, merge to main, destructive backfill, seed or deployment.
- **Exit gate: BLOCKED — unexecuted database migration, tests, full CI-equivalent and security gate.** Authored tests are not represented as passing. No audited attendance module is claimed to be production ready.
