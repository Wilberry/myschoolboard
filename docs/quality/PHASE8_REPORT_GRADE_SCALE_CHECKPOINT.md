# Phase 8 — Versioned School-Adopted Report Grading Scales

**Date:** 2026-10-13
**Branch:** `feature/phase8-versioned-report-grade-scales`; cumulative base `feature/phase8-private-report-card-source-packets` (draft PR #71 → #70 → #69 → #68 → #67 → #66; preceding Phases 6–7 still not finally verified).
**Requirements:** RES-REQ-001 (partial), TEN-REQ-001 and SEC-REQ-001 (partial).
**Exit:** BLOCKED for official grading/report generation/recipient release/production.

## Implementation authored

- Added additive `ReportGradeScaleRevision` (Prisma and SQL migration `20261013140000_phase8_report_grade_scale_revisions`): school owner must **explicitly adopt** 1–20 labelled, contiguous, non-overlapping `[minBps,maxBps]` integer ranges covering **0–10000** exactly, including duplicates/JSON type protection; the same school adopts displayed precision `0|1|2`, `HALF_UP|FLOOR|CEILING` rounding and `RAW_BPS|DISPLAY_ROUNDED_BPS` threshold basis. No school/national grade labels, pass mark, default bands or assumed rounding are prefilled.
- PostgreSQL BEFORE INSERT locks the active School row, independently checks current exact same-school `SCHOOL_SUPER_ADMIN` actor membership/user, validates grade range structure and coverage, rejects identical re-adoption, and assigns trusted incrementing **per-school version** and timestamp. DELETE/UPDATE/TRUNCATE protections preserve immutable previously adopted scales; unique school/version and FKs retain tenant integrity. These adoptions do **not** mutate historical Phase 8 report-source packets or publish results.
- Added server-authenticated, `Serializable`, strict school owner `POST` and bounded tenant-rechecked `GET` at `/api/schools/[schoolId]/report-grade-scales`, both no-store. School-owner server-gated workspace/navigation permits explicit band JSON entry and selection of rounding and grade threshold policy, shows immutable non-student history. Cross-role and foreign-school access concealed.
- Added **pure private policy simulation**, using integer score basis points, deterministic rounding and exact threshold selection; `status: PRIVATE_POLICY_SIMULATION_ONLY`. No official per-pupil weighted grade, historical packet recalculation, grade release, student/guardian view, report PDF/export, or publication event. Official report composition must later pin both exact adopted weight and exact adopted scale versions to a frozen source packet.
- Authored Vitest pure rounding/gap/overlap/invalid score cases, synthetic authenticated Postgres API/tenant/role/immutable-history tests, and Node structural guard, registered in existing `npm test` and `verify:local:guards`. ADR-044/D-058, module, authorization, configuration, traceability, status and milestone docs updated.

## Verification provenance

**Executed:** GitHub connector source reads/commits; **46/46 targeted fetched-source structural assertions** on the initial edited files, and a more specific follow-up file review found a schema relation field newline error; it was corrected before any migrations. A small **16/16 in-memory JavaScript smoke test** of the *GitHub-fetched byte-exact TypeScript grading-scale source* after stripping type syntax checked threshold boundaries, gaps, overlaps, duplicate labels, three rounding cases and raw-vs-displayed classification. It was **not** the actual Node/Vitest test runner or full project type-check.

**NOT executed:** Prisma validate/generate, cumulative migrations, SQL trigger and concurrent actor/permission checks on a disposable PostgreSQL database, actual Node tests/Vitest, format, ESLint, TypeScript typecheck, Next build/browser/a11y, `npm run verify:local`, `npm audit --audit-level=high`, passing CI. Local `git ls-remote` failed GitHub DNS resolution; no checked-out full repository or loopback PostgreSQL. Existing CI runs remain failed without accessible step evidence. No production/shared DB or real student data was used.

## Next milestone

- First validate the cumulative Phase 6–8 schema/migrations and full suite against a **confirmed disposable loopback-only PostgreSQL** target, remediate any failing gates. Do not rewrite already-applied historical migrations.
- Then implement a separate explicit, school-adopted official category aggregation/rounding rule and **frozen official report-card composition** using the exact current reviewed/owner-approved packet and a **pinned** grading-scale revision. No fallback scale, no unreviewed per-student marks, no retroactive changes.
- Separately implement audit-preserved actual report **release** authorization and validated recipient relationships and school visibility rules; no student/guardian result disclosure, report export, release or `main` merge/deploy here.

**Status: AUTHORED; runtime acceptance and public result release BLOCKED.**
