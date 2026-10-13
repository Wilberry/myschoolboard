# Phase 8 — Private Class/Term Subject Evidence Coverage (No Publication)

**Date:** 2026-10-13
**Branch:** `feature/phase8-private-subject-coverage-review`
**Cumulative base:** `feature/phase8-private-owner-grade-preview` at `2681e8691bb8216b7cbbb942dbfb3082a56f755a`, unmerged.
**Requirements:** RES-REQ-001, TEN-REQ-001, SEC-REQ-001 partial.
**Exit:** AUTHORED AND SOURCE-INSPECTED; RUNTIME / OFFICIAL RELEASE STILL BLOCKED.

## Roadmap and boundary

After frozen teacher/manual/CBT assessment source, current section-reviewed/owner evidence and a private one-pupil grade preview, schools need to *see remaining subject-level work* within a class and term without prematurely claiming a full report card. The new tool is a School Super Admin diagnostic of **existing records**, not completeness of an approved curriculum or current publishability. P-004 parent-first report acknowledgment remains unresolved. No permission requests or school-specific default policies were invented.

## Implementation

- `src/modules/results/private-subject-coverage-service.ts`: authenticated exact active same-school `SCHOOL_SUPER_ADMIN` obtains a SERIALIZABLE School-row-locked read of an exact active class, school session and term belonging to that session. Only current ACTIVE `TeacherClassSubjectAssignment` records **explicitly assigned to the exact session**, with active `TEACHER` role membership and active subject, contribute to the current diagnostic. Null-session assignments and unassigned subjects are not silently treated as configured curriculum. More than 500 matching assignment rows or 500 fetched evidence rows result in a closed conflict rather than silently truncated results.
- For each distinct assigned subject, selects latest teacher result-sheet revision and checks existence of exact independent `APPROVED` review, exact `APPROVED_AWAITING_RELEASE` School Super Admin decision and exact `INTERNAL_OFFICIAL_EVIDENCE_NOT_RELEASED` composition. It distinguishes absent evidence, absent academic review, absent owner decision, missing composition, superseded school grade scale/aggregation, and existing current-policy composition **metadata only**. The highest state is intentionally `PRIVATE_COMPOSITION_METADATA_PRESENT_NOT_RELEASED` and does **not** rerun every subject's teacher/reviewer/roster/grade JSONB parity gate. No grades, pupils or another student's academic information are selected.
- `GET /api/schools/[schoolId]/private-subject-coverage` requires **exactly** one `sessionId`, `termId`, and `classId` query parameter; duplicate/unknown/missing keys rejected. Owner-only bounded metadata results with `Cache-Control: private, no-store`. No POST/PUT/DELETE publication action, student/guardian result reader, PDF, download, rank, school-wide average, pass threshold or invented required curriculum list.
- Server-gated `/schools/[schoolId]/private-subject-coverage` and clear admin UI explain that a green/current metadata state is *not* official release readiness or report-card completeness. Existing school owner navigation gained a link.
- Authored synthetic PostgreSQL/Vitest integration case in `src/modules/assessments/questions.integration.test.ts` for forbidden teacher/section/guardian/student/admin roles, foreign-school ID, mismatched class/term, current owner, no-store, null/missing data semantics, strict metadata privacy and revoked School Super Admin membership. Registered `scripts/phase8-private-subject-coverage-guard.test.mjs` in both **existing** `npm test` and `verify:local:guards` without deleting old coverage or changing CI.
- D-066 / ADR-052, module, authorization, requirement traceability, roadmap/status and milestone documentation updated. The latest subject-scope hardening requires exact current active `TEACHER` role, not merely an active former teacher membership.

## Verification provenance and limitations

- **Executed:** three focused guard cases passed (**3/3**) by replaying exact current GitHub structural-test source in isolated V8 with mocked Node filesystem reads. Additional independently evaluated latest-source assertions passed (**9/9**), covering exact role, tenant/session, boundedness, privacy, no publication and registration. These are **source inspections**, **not actual `node --test`, Vitest or PostgreSQL execution**.
- **Authored but unrun:** authenticated database integration assertions in the existing assessment test suite.
- **Not executed:** cumulative migrations, PostgreSQL transaction/authorization tests, Prisma validate/generate, actual Node/Vitest suites, prettier/lint/typecheck, Next.js build, strict `npm audit --audit-level=high`, browser/session tests, CI or deployment. No school data or database accessed.
- **Owner instruction honored:** No GitHub Actions were run, rerun or inspected. This work only used ordinary GitHub source/branch actions; no workflow edit, new PR, `main` merge or production release.

## Next safe direction

Design an **explicit school-owned versioned subject/curriculum inventory** (exact session/class/term and required subjects) before any official *multi-subject* report completeness claims. Then compare such adopted subject requirements against frozen, independently approved per-subject evidence **only after full cumulative disposable PostgreSQL/Node/Prisma/build/security acceptance**. Resolve parent-first P-004 and independently validate recipient-release/relationship conditions before any result publication or guardian/student report reader.

**End status: private assignment-derived subject coverage metadata only; official results, parent/student report access, downloads, `main` merge and deployment remain DISABLED.**
