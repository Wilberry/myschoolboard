# Phase 8 — Internal Report-Release Readiness Preflight

**Date:** 2026-10-13
**Branch:** `feature/phase8-internal-report-release-preflight`
**Cumulative base:** `feature/phase8-school-report-visibility-policy`, at `d308aa83cd8e966d5b66fa3ba362e6607997e776` (unmerged); downstream of prior Phase 6–8 draft work.
**Requirements:** RES-REQ-001 partial; TEN-REQ-001, SEC-REQ-001 partial; P-004 parent-first acknowledgment still open.
**Exit:** **AUTHORED / RUNTIME AND RECIPIENT RELEASE BLOCKED.**

## Developer mandate and external-action boundary

The user requested continued roadmap development and **no GitHub Actions**. This work was performed on a separate non-default development branch, with no new draft PR, no `main` push, and **no workflow job, rerun or GitHub Actions inspection**. The existing GitHub workflow and strict `npm audit --audit-level=high` gate were not modified. An independent report *preflight* is safer than enabling production/recipient publication with cumulative Phase 6–8 PostgreSQL/Node/CI gates unverified.

## Authored implementation

- Additive Prisma `ResultReleasePreflightAttestation` and `20261013190000_phase8_internal_report_release_preflight` migration, same-school composite foreign keys to exact `PrivateOfficialReportComposition` and explicitly adopted `ReportVisibilityPolicyRevision`, with exact current owner actor and one immutable record per composition/policy revision. DB derives policy version, mode, source/decision/evidence IDs, pupil count, internal non-released status and trusted timestamp. Audit reason 5–500 chars. UPDATE/DELETE/TRUNCATE denied.
- BEFORE INSERT SQL invokes locked `assert_result_publication_readiness`, rerunning active same-school School Super Admin, original teacher assignment, current independently verified proper-section academic review, current adopted score weights, unchanged complete roster/source. It cross-checks exact source packet/owner decision/context, requires **latest school report scale**, **latest category-aggregation rule** and **latest non-`ASSESSMENT_ONLY` school visibility policy** and calls `build_private_official_report_cards` to independently recompute and compare the entire private grade JSONB to the frozen composition. The current check is **not durable release authorization**.
- Strict authenticated `recordInternalReportReleasePreflight` POST accepts only `compositionId`, `visibilityPolicyId` and an audit reason; actor is independently derived from verified session in SERIALIZABLE active-School-locked transaction. Current-owner-only `listInternalReportReleasePreflights` checks role/school again in its bounded SQL, and selects **metadata only**.
- New private/no-store GET/POST route and School Super Admin server-authenticated page/workspace/navigation. No release button, actual publication event, student identity, grade JSON, report file/download, guardian/student recipient API, notification, external share, QR, or public grade disclosure.
- Authored authenticated synthetic integration coverage in `src/modules/assessments/questions.integration.test.ts`: roles, tenant crossing, client spoofed actor/marks/release status, stale adopted visibility, revoked independent section reviewer, duplicate preflight, SQL immutable update/delete/TRUNCATE, revoked School Super Admin and no marks/source leak.
- New registered Node structural guard `scripts/phase8-internal-report-release-preflight-guard.test.mjs` appended to **both existing** `npm test` and `verify:local:guards` without deleting previous guards. D-062/ADR-048, roadmap, milestone, module, authorization and traceability documents updated.

## Actual checks vs unexecuted gates

- **Actually executed:** 39/39 focused fetched-source consistency assertions (Prisma reverse relations/unique keys; SQL school lock, policy pin and recomputation; role and no-grade projection; historical immutable audit; no publication route). Also **3/3 isolated V8 guard test cases passed** against exact fetched Node structural-test text with simulated `readFileSync`. The SQL source contained one function and paired `$$` markers, but **no PostgreSQL parser was run**.
- **Authored, not executed:** Vitest authenticated PostgreSQL workflow tests. **Not run:** full `node --test`, Prisma validate/generate/migrate, PostgreSQL school locks/rollback/concurrent revocation/grading parity, Prettier/ESLint/typecheck/Next build, full dependency audit, browser/security acceptance or GitHub Actions.
- No shared or production database was accessed. No test failing gate was waived. Older unmerged migration history and the previous Phase 6–8 full verification blockers remain documented in `docs/quality/PHASE8_CUMULATIVE_VERIFICATION_BLOCKERS_20261013.md`.
- **Security decision:** Parent-first acknowledgment (P-004) remains unresolved. Even with a successful preflight, nobody may access a report without a **separate current, immutable School Super Admin publication decision**, an explicitly pinned release policy, current school/academic/grade-source revalidation and verified exact recipient-to-pupil relationship. Never use preflight `id` as authorization.

## Next roadmap direction

Complete cumulative Phase 6–8 PostgreSQL/Prisma/Node/Vitest/build/strict dependency-audit acceptance in the explicitly confirmed disposable local environment, without invoking GitHub Actions unless the user lifts that preference. After all gates pass, develop the **separate release decision ledger** and recipient visibility with verified student/guardian relationship and finalized P-004 acknowledgment rules. Other independently safe foundations may be authored without enabling access.

**Status: PREPARATION ONLY. School result publication, student/guardian report access, `main` merge and production deployment remain disabled.**

## Post-authoring trigger-owned field hardening

- Set invalid, **non-persistable** internal SQL/Prisma defaults for trigger-owned fields (`recipientMode='INTERNAL_UNSET'`, evidence/decision/packet ID `''`). The PostgreSQL BEFORE INSERT must replace them with the current exact school policy and authorized frozen source metadata. Table CHECK constraints reject any persisted unset recipient mode or blank trusted source/decision/evidence identifiers, even if a trigger is disabled.
- The authenticated service no longer sends synthetic `ASSESSMENT_ONLY` or blank evidence IDs at all. The request still accepts only exact composition ID, visibility policy ID and audit reason; actor is server authenticated and SQL owns all protected metadata.
- Expanded the Node structural guard to assert the invalid interim defaults and absence of forged/transient service data. Isolated V8 replay of exact current GitHub guard source with mocked Node filesystem **passed 3/3**. It is still **not** an actual `node --test`, Prisma validation, PostgreSQL migration/integration execution, security audit or CI acceptance. No GitHub Actions calls, no PR and no publication.
