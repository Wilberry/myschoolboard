# Phase 8 — Final Owner Publication Readiness SQL Foundation

**Date:** 2026-10-13
**Branch:** `feature/phase8-final-publication-readiness-guard` (cumulative on Phase 8 draft PR #68 → #67 → #66 and unmerged Phase 6–7).
**Requirements:** RES-REQ-001 partial; TEN-REQ-001 and SEC-REQ-001 partial.
**Status:** AUTHORED, NOT RUNTIME-VERIFIED. EXIT BLOCKED.

## Scope of changes

- Additive database migration `prisma/migrations/20261013110000_phase8_final_publication_readiness/migration.sql` defines an **internal** `assert_result_publication_readiness(schoolId,evidenceId,ownerMembershipId,ownerUserId)` predicate. It creates NO table, student-visible report, publication event, result mutation, API endpoint, export, download, grades, or final School Super Admin action.
- Under an active school row `FOR UPDATE` lock it verifies that the server-passed owner membership/user match the currently active same-school `SCHOOL_SUPER_ADMIN`. A later publish service MUST obtain the userId from its authenticated server session and the membership ID from current same-school membership, never browser-supplied identifiers.
- It rechecks the original current TEACHER, assignment, class, section, subject, active session/term; separately independently APPROVED result sheet review by a CURRENT PRIMARY Head of Section or SECONDARY Principal with verified grant on the actual SECTION, distinct from the original teacher; latest result evidence revision and latest explicit school-adopted grading policy; independently recomputes the whole enrolled pupil source manifest, validates completeness and each pupil's positive-weight categories, and compares the current JSONB to the immutable stored evidence.
- A past private School Super Admin candidate listing or a TRUE result does not confer any durable right to publish. The future final publication INSERT must invoke these predicates **again within its own school-locked SERIALIZABLE transaction**, create a separately immutable audited School Super Admin decision, and enforce publication/visibility policy. No such INSERT exists in this slice.
- Synthetic authenticated-context PostgreSQL integration cases were added to existing `questions.integration.test.ts`: current owner succeeds; reviewer role, forged owner/user pairing, foreign school, previous revisions, revoked academic reviewer SECTION grant and newer school policy adoption fail. A Node structural guard is registered in `npm test` and `npm run verify:local:guards`.

## Verification provenance

**ACTUALLY EXECUTED:** GitHub connected branch/file operations; **25/25 targeted GitHub-fetched-source structural assertions** checking owner/teacher/reviewer/scope/current adoption and revision/source/student completeness, SQL no-write boundaries, test presence and package guard registration. These are static inspection checks only.

**NOT EXECUTED:** `npm ci`, `prisma validate/generate/migrate`, the new SQL predicate in real PostgreSQL, synthetic Vitest, Node guards, `npm run verify:local`, ESLint/Prettier/TypeScript/Next.js build/browser tests, security audit including `npm audit --audit-level=high`, or GitHub CI acceptance. The isolated local container has `node`/`git` but could not resolve `github.com` for clone and lacks a PostgreSQL server/checkout. The newest head SHA CI run **38377300536** reports **failure** (job `verify`), but the job API returned **no steps**, so its root cause remains unverified. Earlier GitHub CI failures were similarly unavailable. Cumulative Phase 6–8 migration/test gates are still blocked.

## Safety and follow-on

- No production/shared DB and no live school/pupil data used. No merge/deploy; no official report publication, result download, student/guardian visibility, grade formula or result-release action.
- Check migration state before applying historical migrations; never rewrite migration files already applied in an environment. Use only the recorded disposable loopback-only PostgreSQL workflow, then run the full unchanged security and acceptance gates.
- Following verification, prepare a separate immutable School Super Admin final result publication decision with a reasoned audit history and atomic readiness recheck. Result/report-card visibility and versioned post-publication correction stay separate, school-policy-controlled later work.

**Exit: BLOCKED.**
