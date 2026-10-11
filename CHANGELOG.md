# Changelog

## 2026-10-09 — Initial documentation baseline

- Added the initial documentation set for the multi-tenant school management SaaS specification.
- Established the canonical project documentation structure and governance model.
- Recorded the repository baseline as a documentation-first specification project.
- Added functional, security, architecture, roadmap, and requirements traceability documentation.

## 2026-10-09 — Repository status correction

- Corrected stale statements that referred to an empty repository with no Git history.
- Updated the documentation to reflect the live Git state: the repository contains a documentation baseline commit on main.
- Clarified that the repository is documentation-only and not an application implementation.

## 2026-10-09 — Phase 1 planning and approval register

- Added the proposal-level engineering plan for the first implementation foundation.
- Added the product-owner approval register for Phase 1 decisions.
- Clarified the distinction between the original baseline commit and the current live documentation state.

## 2026-10-09 — Local Phase 1 foundation and verification

- Added a local Next.js/TypeScript application foundation using Better Auth, Prisma, and PostgreSQL.
- Added the initial Prisma schema and migration, local PostgreSQL configuration, and synthetic development seed.
- Added server-side authorization and tenant-context checks and focused tests.
- Added a protected school-details path and CI quality workflow.
- Recorded the approved local stack separately from unresolved external identity, hosting/domain, RLS, and later-phase product decisions.
- Verified database generation/deployment and seed, 17 tests, lint, typecheck, formatting, and production build locally.
- This checkpoint does not claim production readiness or complete all SEC-REQ-001 / TEN-REQ-001 acceptance criteria.
- Final review found 8 high-severity dependency audit findings (3 remain with production-only audit); the configured CI audit gate is not passing.

## 2026-10-11 — Reduced checkpoint reconciliation

- Excluded the local private-storage prototype from the proposed first GitHub checkpoint; the prototype remains in the working tree and is not required by the application.
- Excluded unused Next.js starter assets from the candidate manifest: the app favicon and unused page CSS module, plus the unreferenced public SVG assets.
- Removed the unused `PRIVATE_STORAGE_ROOT` setting from the environment example, runtime schema, and CI workflow.
- Reconstructed the exact candidate from HEAD plus the selected manifest: 28 modified tracked files and 53 selected new files, with 58 unchanged HEAD paths retained. In that isolated tree, all 6 migrations and guarded demo seed succeeded, 78 tests across 7 files passed, and formatting, lint, typecheck, and production build passed. The known dependency audit blocker remains.
- D-022 Option C was subsequently approved for 2026-10-11 through 2026-10-18, strictly for a development branch and draft PR. D-015 Option A remains active outside that narrow exception; merge, deployment, and release remain prohibited.

## 2026-10-11 — Development checkpoint published for draft review

- Published the exact 81-path checkpoint (53 added, 28 modified) to `checkpoint/phase1-tenant-safe-foundation` at commit `2c7c6b9a905272ac5f9cc70d06b67367b2c1c791`; `main` was not changed.
- Opened [draft PR #1](https://github.com/Wilberry/myschoolboard/pull/1) with D-022 risk disclosure and no merge or deployment.
- The first GitHub Actions run completed with failure. The audit gate remains enabled, and its 8 high findings (3 production-only) remain unresolved; the failed step(s) must be confirmed separately.
- The historical local reduced-candidate validation remains 78 passing tests across 7 files and 6 applied migrations. No CI or production-readiness claim follows from these historical results.

## 2026-10-11 — Local verification and liveness follow-up (unverified)

- Prepared an independent feature branch with a public, dependency-free liveness probe and two focused tests.
- Prepared a guarded local execution script for the unchanged GitHub CI npm command sequence, separate preflight/guard tests, and a disposable-database runbook. Hosted GitHub Actions remain unavailable under the owner-reported billing restriction.
- The full application verification has **not** run for this follow-up. The dependency findings, D-022 expiry, and merge/deployment restrictions remain unchanged.

## 2026-10-11 — School-read membership recheck (awaiting verification)

- Hardened the protected school metadata lookup to recheck the authenticated membership's active state and precise role in the same final database fetch, rather than relying only on an earlier resolved principal.
- Added three database-backed integration cases for school deactivation, loss of reader role, and required final-query membership constraints.
- No Prisma migration or academic-read policy change; all tests remain pending the owner's eventual disposable-database local verification checkpoint.

## 2026-10-11 — Assignment mutation response cache hardening (unverified)

- Added `Cache-Control: private, no-store` to successful and error responses from all four teacher-assignment lifecycle and create mutation routes.
- Added database-backed response cache assertions across `201`, `200`, `400`, `401`, `404`, `409`, and `500` outcomes, pending the owner's local verification run.
- No changed permissions, routes, migrations, audit triggers, or dependency/CI gates.

## 2026-10-11 — School workspace navigation alignment (unverified)

- Replaced misleading school-details links for membership roles denied by the existing school-level `academic:read` policy with a non-clickable restricted label.
- Added a presentation-only policy-based helper and role-matrix unit tests; the protected school details route remains authoritative.
- No academic permissions, tenant visibility, or database models were expanded. Local verification is deferred per the owner's instruction.

## 2026-10-11 — Sanitized school read denial logging (unverified)

- Added a best-effort `school_read_denied` operational event for authenticated, concealed school metadata denials with a generated request ID and no sensitive school, user, or cookie fields.
- Added two database-backed regression cases covering a missing versus cross-school request and thrown diagnostic logger behavior.
- No schema migration, new permissions, changes to HTTP response bodies/status, CI audit gate, or merge/deployment authorization; these tests are still pending local verification.

## 2026-10-11 — Authentication UI request resilience (unverified)

- Added shared client auth request handling to distinguish successful fulfilled calls from error responses and rejected network/transport requests.
- Updated sign-in to restore the pending state and show generic failure feedback; updated sign-out to prevent repeated requests, display failures, and refresh only after successful logout.
- Added four helper unit tests and updated sign-out error/loading styling. All new tests remain deferred to the owner's local verification checkpoint.
- No Better Auth server policy, session schema, tenant authorization, database migration, or CI audit gate changes.

## 2026-10-11 — Session revocation and tenant-boundary tests (awaiting verification)

- Added two school-route integration tests for replaying a revoked Better Auth cookie and confirming that an elevated platform role alone cannot access another school's metadata.
- Added two teacher-assignment route integration tests covering revoked authenticated sessions on all four mutations and demotion of an administrator with an otherwise active session, with no audit-event or assignment-state changes after denial.
- Existing session handling, production code, Prisma migrations, permission rules, and CI audit gate are unchanged. All four new tests remain pending the owner-requested disposable PostgreSQL verification checkpoint.

## Current status

- Repository state: local Phase 1 foundation and documentation are being checkpointed; consult live Git history/status for commit and push state.
- Local app, migration, seed, CI workflow, and tests: present and locally verified to the extent described above.
- Hosting provider, domain, external identity provider, and production deployment: deferred or unresolved.
- PostgreSQL RLS: not enabled.
