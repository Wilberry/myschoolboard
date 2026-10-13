# Phase 8 — Immutable Private Official-Result Composition Checkpoint

**Date:** 2026-10-13
**Branch:** `feature/phase8-private-official-report-composition`
**Cumulative base:** draft PR #73 (aggregation) → #72 (grade scales) → #71 (private frozen source) → #70 (final owner decision) → #69 (locked readiness) → #68 (owner inspection) → #67 (independent reviewed teacher evidence) → #66 (school-adopted weights), with preceding unmerged Phase 6–7 foundations.
**Requirements:** RES-REQ-001 partial; TEN-REQ-001 and SEC-REQ-001 partial.
**Milestone state:** AUTHORED, **NOT** PostgreSQL/CI-VERIFIED; publication exit BLOCKED.

## Scope authored

- New Prisma `PrivateOfficialReportComposition` with immutable audit actor/reason/time; one-per-frozen-packet composite school-scoped links to the exact final School Super Admin approval, source packet, current separately adopted report aggregation and grade-scale policies. A new approved teacher source/academic review/owner decision and new packet are required for later corrections; earlier compositions are never rewritten.
- Additive `20261013160000_phase8_private_official_report_compositions` migration. The INSERT trigger invokes the existing PostgreSQL `assert_result_publication_readiness`, which locks the active school row and verifies the signed-in exact school owner, current independently verified PRIMARY HM or SECONDARY Principal actual-section academic review, original teacher assignment, exact latest school assessment weighting adoption, complete and unchanged frozen pupil source evidence. SQL then verifies *explicit, exact, current* school aggregation and grading-scale revisions (no fallback/older rule), computes an allowlisted per-pupil composed grade JSONB directly from the existing immutable packet, and sets student count, context, chosen policy versions, non-released status and trusted clock itself.
- Composition uses SQL NUMERIC integer-basis-point rounding to mirror the existing pure TypeScript engine: equal normalized assessment means or pooled category points, selected HALF_UP/FLOOR/CEILING precision, adopted QUIZ/TEST/EXAM category weighting (sum 100%), separately adopted grade band/display rounding and band-basis. Rejects invalid/null rule modes, duplicate student/source IDs, malformed/unscored/negative/fractional/out-of-range points, missing positive-weight category, inconsistent weighting version or pupil count. INSERT controls: one composition per packet, same-tenant FKs, immutable UPDATE/DELETE/TRUNCATE, no grades accepted from browser.
- Owner-only private no-store `GET/POST /api/schools/[schoolId]/private-official-report-compositions` and current owner-gated workspace/navigation. Request **only** sourcePacketId, aggregationRuleId, gradeScaleId, reason. POST response and bounded history GET return metadata only; sensitive `composedStudentCards` JSONB is never selected, returned, downloaded or made accessible to pupils/guardians. School-specific grading policy does not imply any recipient release, public report card, export or print view.
- Integration cases authored: current exact owner succeeds with SQL-computed grades matching the private TypeScript engine; direct SQL parity for both aggregation modes; role and cross-school denial; strict anti-forgery input; stale source packet denied; duplicate decision; immutable update/delete/TRUNCATE; no marks/identities leaked to HTTP. Node structural guard registered in `npm test` and `verify:local:guards` with all preceding gates retained. D-060/ADR-046, requirements traceability, roadmap, module/authorization and milestone records updated.

## Verification provenance

**Executed in the connected GitHub source environment:** GitHub branch/commits and **59/59 targeted fetched-source integrity/authorization/SQL-boundary assertions** as of the initial completed service and SQL implementation. Subsequent changes tightened explicit rejection of NULL policy modes and empty kind, and added the exact final-owner composite FK and additional SQL/TS parity cases. A further **42/42 targeted GitHub-fetched-source assertions** passed after all edits, checking school-keyed final-decision FK, explicit NULL-mode rejection, SQL grade computation, current exact policy checks, source-integrity guards, role/privacy boundaries and new authenticated synthetic parity/revocation scenarios. These were source checks and code authorship, **not** an actual PostgreSQL/Node runtime pass.

**NOT executed:** `npm ci`, Prisma validate/generate/migrate, cumulative disposable-loopback PostgreSQL migration and trigger/lock/concurrency/rollback tests, full Node/Vitest including the newly added parity tests, format/lint/typecheck/build/browser/accessibility, `npm run verify:local`, `npm audit --audit-level=high`, passing GitHub CI. No local repository checkout (GitHub DNS failure), no PostgreSQL server in the current runtime, no shared or production database used and no live student data. Historical migrations are not to be rewritten if they have been applied anywhere; first inspect migration state and create forward repairs if necessary.

## 2026-10-13 post-draft hardening

- Explicitly reject NULL expected class size inside the otherwise fail-closed PostgreSQL composition helper (additional integration negative case). The prior latest-policy/mode NULL and missing assessment-kind hardening remains.
- Post-hardening GitHub-fetched source assertions passed **11/11** (three paired SQL functions, NULL handling, pinned policies, authorization/reviewer revocation and SQL/TS parity test registration). These are source assertions, **not executed PostgreSQL integration tests**.
- Draft PR #74 CI run [38391796445](https://github.com/Wilberry/myschoolboard/actions/runs/38391796445) completed **failure**; GitHub job `verify` exposed no steps and no logs via the connected API. Root cause **unconfirmed**, CI acceptance BLOCKED. No production merge or release.

## Next authorized development

1. **First:** Resolve full cumulative Phase 6–8 local/PostgreSQL/CI/security gates. Any unexpected regression must be fixed before promoting official report workflows.
2. Later: separate School Super Admin recipient **release** policy and immutable publish event, explicit report visibility option and independently verified student/guardian relationship, confidential report-card rendering/download, versioned post-publication corrections and revocation of superseded views.
3. A private `INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED` row is **not** official result publication, cannot create parent/student entitlement, and does not authorize release if policy or reviewer status changes later.

**Exit state: BLOCKED — no merge, deployment, recipient release or grade disclosure.**
