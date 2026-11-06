# Phase 8 Explicit School Grading Adoption — Checkpoint

**2026-10-13** — branch `feature/phase8-adopted-grading-policy`; base `feature/phase8-result-preparation-readiness`, draft PR #65.
**Requirement:** RES-REQ-001; SCH-REQ-001, TEN-REQ-001, SEC-REQ-001.
**Exit:** BLOCKED; unverified cumulative Phase 6–7 predecessor SQL migrations, full local CI and strict audit.

Authored additive Prisma `ResultGradingAdoption`, exact same-school immutable grading-policy composite FK, school and reviewer actor FKs, per-school/class/subject/session/term ordinal and unique policy adoption constraint. Additive SQL `20261013090000_phase8_result_grading_adoption` validates active exact School Super Admin membership/user and academic structure, allocates an ordinal under `School FOR UPDATE`, server timestamp, disallows UPDATE/DELETE/TRUNCATE. No official result or report table.
Private owner-only serializable adoption action, bounded history, no-store route, UI/navigation, synthetic real-session wrong role/tenant, duplicate and immutability cases and Node structural guard authored.

**Actually executed:** GitHub connector file/commit operations and limited source/structure review only. **Authored, NOT executed:** migration, tests, Next route and browser UI. **Not executed:** owner-verified disposable PostgreSQL migrations, Prisma validate/generate, Node/Vitest, TypeScript/lint/format/build, browser/a11y and `npm audit --audit-level=high`. No live data, merge/deploy, early keys or student/parent report access.

Next separate Phase 8 candidate: freeze teacher evidence referencing adopted policy ID and independently verify exact-section HM/Principal decision. No School Super Admin final **publication** in this slice.
