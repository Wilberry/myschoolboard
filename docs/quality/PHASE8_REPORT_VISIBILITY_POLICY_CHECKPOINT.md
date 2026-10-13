# Phase 8 — School Report Visibility Policy Foundation

**Date:** 2026-10-13
**Branch:** `feature/phase8-school-report-visibility-policy`
**Based on:** `feature/phase8-private-official-report-composition`, draft PR #74 HEAD `baa1fdf1fee33d003f8e24f1e4c7c68eac1ae46b`.
**Requirements:** RES-REQ-001 partial; TEN-REQ-001 and SEC-REQ-001 partial; deferred P-004 parent-first acknowledgment decision.
**Exit:** **AUTHORED / RUNTIME AND PUBLICATION BLOCKED.**

## Authorized scope

The owner explicitly requested **no GitHub Actions now** and to continue Phase 8 development. This checkpoint is isolated on a non-default feature branch; **no PR has been opened for this branch** and no workflow run, rerun, job inspection, CI read or GitHub Actions trigger was manually invoked. The repository CI workflow (pull requests plus `main` pushes) was left untouched. Prior draft PR #74 remains unmerged; no `main` changes or deployment.

The next independently useful Phase 8 foundation is school-owned **future report recipient visibility configuration**, not actual recipient release. `docs/requirements/CONFIGURATION_CATALOG.md` requires four supported choices and school-versioned policy; `docs/project/PRODUCT_DECISIONS_FOR_APPROVAL.md` P-004 leaves parent-first acknowledgment undecided.

## Implementation authored

- Additive Prisma model `ReportVisibilityPolicyRevision`, plus `prisma/migrations/20261013180000_phase8_report_visibility_policy_revisions/migration.sql`. One of four explicitly adopted modes: `ASSESSMENT_ONLY`, `GUARDIAN_AFTER_RELEASE`, `STUDENT_AFTER_RELEASE`, `GUARDIAN_AND_STUDENT_AFTER_RELEASE`. No seeded default; no guessed parent acknowledgment behavior; any missing policy remains an **ineligible future release** condition.
- SQL INSERT trigger locks current active School row; verifies the exact current active same-school `SCHOOL_SUPER_ADMIN` membership/user supplied from the server; rejects duplicate most-recent choice; derives school-scoped sequential version and trusted timestamp. Same-school composite actor FK, `@@unique([schoolId,version])` and UPDATE/DELETE/TRUNCATE prevention preserve auditable policy history.
- Strict server-side adoption service `adoptSchoolReportVisibilityPolicy` takes only `recipientMode` plus audit reason and derives actor from authenticated session in SERIALIZABLE locked transaction. `listSchoolReportVisibilityPolicies` rechecks exact current owner both before and within the bounded SQL metadata projection.
- `GET/POST /api/schools/[schoolId]/report-visibility-policies` is current-owner-only, `Cache-Control: private, no-store` and returns **non-pupil policy history only**. New page and UI are server-gated; the dropdown starts empty, requires explicit choice/reason and says it cannot publish any report.
- No report/score/marks/student ID/guardian record is selected or returned; no release action, public report, recipient PDF/export, QR, student or guardian grade-reader route or notification was added. **No policy mode grants access by itself.**
- D-061 / ADR-047, module specification, authorization rules, configuration catalog, roadmap, milestone checklist, requirement traceability and P-004 decision note updated.

## Test evidence and limits

- **Authored** authenticated PostgreSQL integration scenario in existing `src/modules/assessments/questions.integration.test.ts`: forbidden TEACHER/STUDENT/Head/Principal/Admin/cross-school actors; explicit four modes; duplicate denial, client spoofed actor/grades/release rejection, audit immutability and report-composition unchanged; metadata no pupil/grade leakage.
- **Authored** `scripts/phase8-report-visibility-guard.test.mjs` with three structural test cases and registered in the existing `npm test` and `verify:local:guards` scripts without removing earlier guards or modifying CI.
- **Actually executed:** 46/46 GitHub-fetched source consistency checks (migration owner role and lock, schema relations, all four modes, immutable triggers, no release, strict route and no source leakage); **3/3** guard cases passed on subsequent isolated V8 replay with mocked Node file reads. The first replay caught a brittle text line-break assertion, which was corrected before the successful run. These are source inspections/replays **not** real Node test runner or PostgreSQL execution.
- **Not executed:** actual `node --test`, Vitest, Prisma validate/generate/deploy, PostgreSQL migration/transaction/race/rollback tests, format/ESLint/typecheck/Next build/browser/a11y, npm dependency audit, GitHub Actions or successful CI. No test/shared/production school database accessed; no live student/guardian data.
- A prior cumulative Phase 6–8 quality/audit block remains in `docs/quality/PHASE8_CUMULATIVE_VERIFICATION_BLOCKERS_20261013.md`. The user specifically requested no GitHub Actions invocation at this checkpoint; the local disposable-only verification mandate remains a **future pre-release requirement**, not a waived gate.

## Subsequent roadmap direction

1. Confirm full cumulative Phase 6–8 PostgreSQL/Prisma/Node/Vitest/build/security audit acceptance in the documented disposable environment, without running GitHub Actions until the owner permits.
2. After acceptance, specify a separately auditable immutable School Super Admin **recipient report-release** decision that pins exactly approved grade evidence and current visibility policy; publication must still check original teacher/HM-or-Principal academic evidence, active School/owner, result version and enrolled student.
3. Resolve P-004 parent-first acknowledgment semantics separately; enforce exact independently verified student/guardian relationships, and make role-specific student/guardian readers and official report delivery only after release. Keep old history immutable.

**Status:** policy foundation authored. **No result publication, recipient entitlement, `main` merge or deployment.**
