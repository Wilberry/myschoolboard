# Phase 6–7 Validation Attempt and Phase 8 Result Preparation Checkpoint

**Date:** 2026-10-13
**Cumulative base:** `feature/phase7-returned-manual-mark-remediation` / draft PR #64, downstream of unmerged Phase 6/7 draft chain.
**Phase 8 candidate:** `feature/phase8-result-preparation-readiness`.
**Requirement:** RES-REQ-001, SEC-REQ-001, TEN-REQ-001; dependencies Phase 6/7.
**Milestone exit:** BLOCKED. This checkpoint does not permit merges, deployments, results publication, or migration to live databases.

## Genuine local execution in this session

The interactive local Linux environment has Node 22.16.0, npm 10.9.2, Git and TypeScript CLI, but has **no MySchoolBoard repository checkout**, no DNS access to github.com (attempted `git ls-remote` failed host resolution), and no `postgres`/`psql` executable or disposable DB target. Consequently we could not run `npm ci`, generate Prisma Client, run migrations or execute authenticated database test suites. The owner's existing `scripts/verify-local.mjs` requires `NODE_ENV=test`, disposable opt-in, exact loopback port 5434 database `myschoolboard_test`, test-only auth credentials and the unchanged `npm audit --audit-level=high` gate. The unsafe option of substituting a shared/production DB was **not used**.

Actual local tests used **manually staged exact GitHub-fetched source files**, and matched their active GitHub blob SHA using local `git hash-object` before executing isolated checks:

1. `src/modules/assessments/grading-policy.ts` SHA **`1c16de05cbf7cee6e8b369b099c1b46b3798ad7f`** — 5/5 standalone Node 22 `--experimental-strip-types --test` smoke tests passed: 100% integer weighting validation, category-average weighted percentage, required EXAM absent means pending, optional zero-weight category, invalid percentage rejection. A first attempted isolated `tsc` invocation requested unavailable local `@types/node` and failed due environment; a follow-up plain isolated `tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler` for the same exact pure module succeeded.
2. `src/modules/results/result-readiness.ts` SHA **`14194e365a7387f9515a23c764f0d0b544383809`** — 8/8 standalone Node 22 `--experimental-strip-types --test` smoke tests passed: independent source reconciliation remains not published, pending objective/corrections, empty evidence, name mismatch, duplicate identities, invalid counters, invalid draft policy revision and absent matching pupil; isolated `tsc` for the same pure module passed.

**Combined isolated source execution: 13/13 smoke tests passed, two standalone TypeScript pure modules passed isolated typecheck.** These are ad hoc Node checks, **not** the repository's Vitest tests, not proof of app/session/SQL correctness and not local CI-equivalent completion. No synthetic student PII, credentials, live DB, or report exposure was used.

## New Phase 8 authoring

- `result-readiness.ts`: pure fail-closed reconciliation of two scoped student rosters by studentId + exact admission number/name. Strict 500 pupil limit, consistent nonnegative counts and draft policy version; status remains `PRIVATE_PREPARATION_ONLY`, never signals official publish. Flags absent assessment, unscored CBT, unapproved manual marks, outstanding correction and unadopted grading policy.
- `preparation-service.ts`: joins **two independently current teacher-/class-/subject-/session-/term-authorized existing readers** with fail-closed identities/scope; no stored report, raw answer or keys.
- Private no-store `result-preparation` GET, school-gated teacher page and browser checklist, school navigation; no POST, export, parent/student access, grade calculation, HM/Principal or School Super Admin publication action.
- Pure Vitest `result-readiness.test.ts`, synthetic authenticated `questions.integration.test.ts` Phase 8 source/role/tenant scenarios, `scripts/phase8-result-preparation-guard.test.mjs` registered in existing full Node/Vitest scripts. These repo tests are **authored not executed**.
- D-051 / ADR-037, Results and Report Cards module, authorization, roadmap, milestone checklist, requirements traceability documented.

## Outstanding gate

On an owner-verified **disposable loopback PostgreSQL** target with full repository checkout/dependencies, run the exact unchanged `npm run verify:local:preflight` and `npm run verify:local` (includes npm ci, generate/deploy/seed, format, lint, TypeScript, Node/Vitest, Next build, strict high audit). Record result logs, migration failures, grade-approval races, parent/student authorization and no-key leakage; repair failures on a development branch and rerun. Hosted GitHub Actions billing blockage and outstanding cumulative unmerged Phase 6/7 PRs remain.

Phase 8 next: versioned **adopted school grading policy**, independently HM/Principal-approved frozen teacher result-sheet evidence, School Super Admin's distinct final publish action and privacy-scoped server-side parent/student visibility. Do not skip any stage based on this read-only preflight.
