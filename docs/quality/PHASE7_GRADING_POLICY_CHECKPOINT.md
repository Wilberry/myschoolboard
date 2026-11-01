# Phase 7 School Grading Profile Drafts — Development Checkpoint

**Date:** 2026-10-12. **Requirement IDs:** SCH-REQ-001, ASM-REQ-001 / T-ASM-001, SEC-REQ-001, TEN-REQ-001.
**Base:** `feature/phase7-private-class-record-sheets` at `7a0f3bd686c786aa2f82ec02cafaaaba90083cf6` (draft PR #58).
**Branch:** `feature/phase7-grading-policy-revisions` (cumulative unmerged development only).
**Exit gate:** BLOCKED; Phase 6, cumulative Phase 7 migrations and actual local CI-equivalent audit remain unverified.

## Authored
- Additive Prisma `AssessmentGradingPolicyRevision`, exact school/session/term/class/subject and actor membership relations and explicit migration `prisma/migrations/20261012330000_phase7_grading_policy_revisions/migration.sql` with same-school School Super Admin-only active academic INSERT trigger, SQL-serialized version and trusted UTC timestamp, 0..100 integer QUIZ/TEST/EXAM weights summing 100, immutable UPDATE/DELETE/TRUNCATE protections. No result table, publication/activation or historical score rewrite.
- `grading-policy-service.ts`: authenticated school-super-admin SERIALIZABLE append-only revision and bounded private history; no client-provided actor/school promotion. Private school `assessment-grading-policies` POST/GET, school-gated administrator editor and navigation with active exact academic options.
- `grading-policy.ts`: deterministic pure category mean and weighted preview with no implicit national/school default. Every positive-weight category must have at least one published assessment and ALL its scores; otherwise result is PENDING/null. A zero-weight unscored category does not block another complete category.
- Existing exact-assignment teacher class-sheet SQL additionally projects latest contextual policy version in the same tenant- and staff-scoped SELECT. `class-record-service.ts` and teacher UI add separately labeled weighted preview; existing raw earned/max score remains unchanged.
- Pure Vitest tests and synthetic authenticated integration tests for super-admin vs teacher/parent/student/foreign role denial, invalid 101%-total, strict no-actor spoofing, two revision versions, SQL audit tampering and pending preview; Node invariant guard added to existing full Node/Vitest scripts without relaxing security/audit gates.
- D-045, ADR-031, assessment module, authorization rules, requirements traceability, milestone checklist and current status updated.

## Test provenance
**ACTUALLY EXECUTED:** GitHub connector branch/commit/files and a fetched-source inspection of 12 changed and referenced files with **21/21 simple presence/structural assertions passed**: FK map declarations, SQL author/weight/immutability guards, unique revision version, pure fail-closed policy, no-key projections, route privacy, UI and test registration. This is **not** a Node test run, Prisma validator, PostgreSQL parser or actual CI.
**AUTHORED, NOT EXECUTED:** Vitest pure category calculations, synthetic authenticated PostgreSQL integration/immutability, Node source guard, new migration/SQL trigger, pages/API at runtime.
**NOT EXECUTED:** npm ci, Prisma validate/generate/migrate/drift, PostgreSQL serial race/rollback, test runners, Prettier/lint/typecheck, Next build, browser/a11y, `npm audit --audit-level=high`, full agreed local CI-equivalent. GitHub Actions billing blocked, no confirmed disposable DB connected to this workflow.

## Scope and risks
Only preview grading: actual school policy adoption, CA/exam weight interpretations, subjective marks/teacher corrections, grading thresholds, final report/card approvals and student/guardian result release still open. Passing static gates does NOT make anything safe to deploy. No real student PII, production migration, security weakening, PR merge or rollout.

**Final checkpoint: PARTIAL AUTHORING ONLY; BLOCKED / UNVERIFIED.**
