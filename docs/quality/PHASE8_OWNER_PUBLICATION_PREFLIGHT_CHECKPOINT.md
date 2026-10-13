# Phase 8 — School Owner Publication Candidate Preflight Checkpoint

**Date:** 2026-10-13
**Requirements:** RES-REQ-001 (partial), TEN-REQ-001 and SEC-REQ-001 (partial).
**Source branch:** `feature/phase8-owner-publication-preflight`.
**Cumulative base:** `feature/phase8-result-sheet-evidence-review`, draft PR #67, based on PR #66 and unfinished Phase 6–7.
**Exit:** BLOCKED for official publication/release.

## Scope implemented (authored, not locally verified)

- `src/modules/results/publication-candidate-service.ts` is a private, bounded read-only owner preflight. The current authenticated user's ID is server-derived; a current active same-school `SCHOOL_SUPER_ADMIN` membership is checked twice, including inside the final SQL query.
- Candidates require current active session/term/class/section/subject, original TEACHER and exact ACTIVE class/subject/session assignment, independently APPROVED section-specific result review by current PRIMARY HEAD_OF_SECTION / SECONDARY PRINCIPAL with a current verified SECTION grant, and distinct teacher/reviewer identities.
- Only the highest result-sheet revision and highest explicit class/subject/term grading adoption are eligible. Recomputed SQL `build_result_sheet_source_manifest` must equal the frozen original JSONB, and every pupil must have a positively weighted adopted QUIZ/TEST/EXAM category. This explicit per-pupil guard also protects the reader from evidence produced under an older migration.
- The GET `/api/schools/[schoolId]/result-publication-candidates` returns no-store, bounded (100) metadata only: evidence/revision/session/term/class/subject/student count/adoption/review timestamps. It never selects pupil IDs/names, raw scores, answer keys, frozen manifests, computed grades or report cards. No POST, School Super Admin final publication event, release control, student/guardian result route, export, or download exists.
- Private school-owner-only page and navigation link. A candidate may become stale at any moment and is **not authorization for publication**. The final publish mutation must independently recheck under locking, append an immutable owner decision and satisfy all acceptance/security/release gates.
- Synthetic authenticated integration tests authored for current approved latest revision, role/tenant exclusion, no pupil/mark leakage, reviewer scope revocation and policy adoption invalidation. Node structural guard added to `npm test` and `npm run verify:local:guards`. No new database migration in this slice.

## Validation provenance

**Executed:** GitHub repository read/write/branch operations and targeted static content checks against the freshly fetched GitHub blobs: **31/31 assertions passed** (authorization and privacy invariants, latest policy/version, source and weighted category gates, no mutation, test registration). Git clone from this isolated execution environment was attempted but DNS resolution failed (`Could not resolve host: github.com`). Local `node` and `npm` exist; PostgreSQL binaries and checked-out repository are absent, so no actual Node test or DB test was run.

**Not executed:** `npm ci`, Prisma validation/generate/deploy, SQL migration or disposable PostgreSQL trigger/revocation concurrency tests, Node guards/Vitest, `npm run verify:local`, ESLint/Prettier/TypeScript/Next build/browser/a11y, `npm audit --audit-level=high`, complete CI/security acceptance. Cumulative prior migrations and Phase 6–7 remain unverified. Existing GitHub Actions runs failed without retrievable step details; do not assert a cause.

## Constraints and next milestone

- No new migration, no dependency updates, and no alteration of existing audit, authorization, grading, or answer-key tables.
- Reader inspection is ephemeral only; a future transactionally protected, immutable, independently authorized School Super Admin final publication ledger remains **NOT IMPLEMENTED**.
- Do **not** enable official report cards or student/guardian results before school-specific publication policy and complete quality/security verification.
- Validate the full cumulative schema and test suite against an owner-approved disposable loopback-only PostgreSQL instance. Fix actual failures, then proceed to immutable final school-owner publication evidence and versioned post-publication correction controls in a separately reviewed development slice.

**Outcome:** Prepublication candidate inspection **AUTHORED; NOT VERIFIED; EXIT BLOCKED**.
