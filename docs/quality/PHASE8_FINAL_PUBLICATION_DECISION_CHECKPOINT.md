# Phase 8 — Immutable Final School Owner Publication-Approval Decision

**Date:** 2026-10-13
**Branch:** `feature/phase8-immutable-final-publication-decision` (cumulative on #69 → #68 → #67 → #66 and unmerged Phase 6–7).
**Requirements:** RES-REQ-001 (partial), TEN-REQ-001/SEC-REQ-001 (partial).
**Outcome:** AUTHORED, NOT FULLY VERIFIED; release gate BLOCKED.

## Implementation authored

- New additive Prisma `ResultFinalPublicationDecision` and migration `20261013120000_phase8_final_publication_decision`, with a protected school/evidence/adoption/actor relation, exact academic-context and evidence-revision attribution, reason, SQL-computed per-context owner approval ordinal and timestamp. Database retains immutable `APPROVED_AWAITING_RELEASE` decisions with one decision per original evidence and immutable UPDATE/DELETE/TRUNCATE guards. A later policy/source revision cannot rewrite original authorization; it requires a fresh teacher prepared source + independent section review + separately ordered owner decision.
- PostgreSQL BEFORE INSERT calls the prior school-row-locked `assert_result_publication_readiness` for the exact active owner membership/user, independent APPROVED verified PRIMARY Head of Section or SECONDARY Principal, actual class section, active original teacher, latest adopted academic grading policy and current complete pupil marks. It recomputes all sources and mandatory per-pupil categories and compares against the immutable JSONB snapshot. SQL determines context, adoption, evidence revision, status, ordinal and clock; it rejects a second decision on the same evidence.
- The authenticated owner service accepts **only** `evidenceId` and 5–500 char reason, derives school owner member ID and user ID from signed-in session and same-school membership, uses SERIALIZABLE with school row lock. New `/api/schools/[schoolId]/result-final-publication-decisions` private `GET/POST`, server-gated owner-only screen and link expose only bounded non-pupil metadata. SQL owner authorization is repeated for history. No student identity, individual marks, answer keys or sourceManifest in responses. Foreign roles/schools concealed.
- Synthetic authenticated integration scenarios authored: current owner approves frozen latest evidence, denied teacher/HM/Principal/other/student/foreign user, body forgery, duplicate, immutable update/delete/truncate, bounded private response/no pupil leak, revoked verified section reviewer denying next owner decision, grading adoption change invalidating old evidence, new independently reviewed evidence allowing **second** owner decision with ordinal 2 while old immutable approval stays ordinal 1. Node structural guard registered in full unchanged `npm test` and `verify:local:guards`.
- ADR-042/D-056, authorization, result module, status, milestone, requirements traceability and approval workflow updated. No new external service or live data.

## Verification provenance

**Actually executed:** GitHub branch/commit operations and **41/41 targeted source inspections passed** against freshly fetched branch file blobs (schema relations, SQL trust boundaries, source freshness call, immutable triggers, role/tenant/privacy checks, package guard registration, test scenarios). These are **not runtime tests** and do not prove migrations or application behavior.

**Authored but not run:** SQL migration, Prisma validation/generation, authenticated integration tests, Node source guard, routes and UI.

**Not executed:** cumulative disposable-loopback PostgreSQL migrations, trigger/race/rollback, Node/Vitest, Next build, TypeScript/ESLint/Prettier, browser/accessibility, `npm run verify:local`, `npm audit --audit-level=high`, and successful CI. Existing CI runs failed with no available job steps; cause is unconfirmed. Clone to local container failed DNS resolution and the container lacked a PostgreSQL server. Phase 6–8 prereqs remain unverified.

## Mandatory next direction

- Execute all cumulative migration/Prisma/CI/security checks on a confirmed disposable local PostgreSQL instance. Fix discovered TypeScript/SQL/runtime/security failures without reducing audit or authorization checks. Never use a shared/production target or rewrite an applied migration.
- Design final *recipient release* and report-card composition **separately**: explicit school-specific grading/presentation and guardian visibility policy, frozen official output, independently audited release, recipient identity constraints and versioned post-release amendments.
- **No official result calculation, School Super Admin public release, student/guardian access, download, export, live data, merge or deployment is enabled by this draft.** An `APPROVED_AWAITING_RELEASE` entry is an internal final approval awaiting separate verified distribution controls.

**Exit:** BLOCKED.
