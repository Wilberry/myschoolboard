# Phase 7 CBT Governance and Attempt Preflight — Development Checkpoint

**Date:** 2026-10-12
**Requirement:** ASM-REQ-001 / T-ASM-001 (partial Phase 7 academic moderation and future CBT admission rules).
**Base:** `feature/phase7-assessment-draft-config` at `1a5cca14e892a089b8d0e8d80dac17fb605645a4` (draft PR #51).
**Branch:** `feature/phase7-cbt-attempt-foundation` (unmerged nonproduction candidate).
**Dependency:** Phase 6 student identity/enrollment, teacher assignment, lesson/attendance security acceptance remains blocked; Phase 7 question-bank and draft migrations unexecuted.

## Implemented / authored

1. **Repair:** `20261012270000_phase7_assessment_drafts/migration.sql` had **two malformed `RETURNS trigger AS $` declarations and one unpaired `$ LANGUAGE plpgsql`**. Corrected all three function declarations and all three closes to PostgreSQL `$$` delimiters. This is source-level syntax repair only; no PostgreSQL parser/migration run.
2. **Academic section review:** Add `AssessmentReviewDecision` and append-only `AssessmentReviewEvent` with terminal one-per-school/draft decision, reason, actor user/membership and createdAt. New additive review-only `20261012280000_phase7_assessment_review` SQL independently requires active school, sealed complete immutable draft, active author/assignment/class/subject/session/term, matching current reviewer user+membership, exact verified SECTION grant for the draft class's actual section, HM PRIMARY / Principal SECONDARY. UPDATE/DELETE/TRUNCATE denied using existing immutable audit triggers. APPROVED never publishes an exam; RETURNED means create a NEW immutable draft.
3. **Server reviewer workflow:** `src/modules/assessments/review-service.ts` adds signed-in, tenant-/section-scoped metadata queue, exact reviewer-only ordered question-content/points preview (no keys or correctIndex), and serializable terminal APPROVED/RETURNED decision with role/grant/school locks and last-write SQL revalidation. Teacher, School Administrator/Super Admin, unrelated stage or foreign section gets no review permission.
4. **HTTP + UI:** Private no-store `assessment-reviews` list, draft detail and decision routes, section-gated reviewer page, question preview and confirmation UI; navigable from existing HM/Principal section area. No answer key read, student question route, attempt state, result record, publication or scoring code.
5. **Pure CBT planning:** `cbt-admission-policy.ts` computes deadline = min(startedAt + duration, scheduledEnd) using UTC elapsed minutes, blocks admission before opening or at close, denies a parallel active attempt, and counts all started attempts toward configured limit 1–3. This is **non-authoritative** and never creates or authenticates student attempts. Real CBT admission must later require explicit separately authorized publication, admin-attested student account link, exact active student/class/session/term enrollment and SQL-atomic attempt counters.
6. **Tests authored:** `cbt-admission-policy.test.ts` pure deadline / retry tests; `questions.integration.test.ts` synthetic real-session HM PRIMARY and Principal SECONDARY, wrong role/stage, foreign school, revocation, immutable audit, preview answer privacy; `scripts/phase7-cbt-review-guard.test.mjs` SQL quote integrity and reviewer source guards registered in the existing `npm test` and `verify:local:guards` path. Existing Vitest and dependency-audit gate unchanged.
7. **Documentation:** Assessment module, authorization rules, requirements traceability, status/checklist, D-038, ADR-024 and this checkpoint.

## Test provenance and safety

**Actually executed:** GitHub connector branch/file/commit calls; limited source comparison of ten latest GitHub-fetched file contents against 17 literal structural checks, **17/17 passed**. This includes balanced `$$` declarations/closures in assessment-draft migration, review schema/migration naming, actor/stage/scope guards, no-answer-key queue/preview and no student attempt/publication table. **This is NOT a Node test, PostgreSQL syntax validation, Vitest, Next build, TypeScript or full CI result.**

**Authored, NOT executed:** Node source-guard tests, pure Vitest CBT policy tests, synthetic authenticated PostgreSQL integration suites, SQL trigger migration and protected Next UI. No actual SQL, student account, school records or exam attempted or modified.

**NOT executed on this branch:** `npm ci`, Prisma validate/generate/deploy/drift, disposable PostgreSQL/transaction/revocation races, format/lint/typecheck, whole Node/Vitest suite, Next build, browser/accessibility, `npm audit --audit-level=high`, agreed local CI-equivalent. GitHub Actions billing remains blocked. Existing high-severity dependency findings remain release blockers.

## Exit criteria / next safe development

- On owner-confirmed disposable loopback PostgreSQL, apply cumulative migrations in exact order and validate trigger quoting, SQL actor/section identities, immutable review uniqueness, school deletion, concurrent revocation and direct SQL bypass; validate all previously authored Phase 2–6 suites.
- Execute the new unit/integration/Node tests, full local CI-equivalent, browser/accessibility and strict dependency security audit; repair every failure without selectively disabling tests.
- Next phase 7 code should add a separately approved/released exam publication ledger (distinct from HM/Principal academic review), exact verified student registration/eligibility, immutable attempt numbering and clock boundaries, idempotent autosave/submit, controlled marking and class sheets. No student data or answers may be exposed until those gates pass.
- Keep all development branches draft/unmerged. Never run migrations against live/shared data, deploy, or relax audit/role/tenant constraints.

**Exit gate: BLOCKED — ASM-REQ-001 partially authored only; Phase 6 unverified.**
