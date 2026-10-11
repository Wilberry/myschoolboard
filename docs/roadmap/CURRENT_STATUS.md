# Current Status

## Status summary

The project is no longer documentation-only. A verified local Phase 1 foundation has been implemented in the working tree and validated against the repository’s auth, tenancy, migration, and build workflow. The implementation remains local-only and is not a production deployment.

## Current evidence

- Published development checkpoint: `checkpoint/phase1-tenant-safe-foundation`; `main` remains unchanged
- Remote review: commit `2c7c6b9a905272ac5f9cc70d06b67367b2c1c791` was verified on [draft PR #1](https://github.com/Wilberry/myschoolboard/pull/1) on 2026-10-11; consult live Git history for subsequent changes
- Application stack: Next.js 16, React 19, TypeScript, Better Auth, Prisma, PostgreSQL
- Database: local PostgreSQL running on port 5433
- CI workflow: present in [.github/workflows/ci.yml](../../.github/workflows/ci.yml). The first draft-PR GitHub Actions run completed with failure; individual failure steps have not yet been confirmed, and the high-severity audit gate remains enabled
- Application implementation: Better Auth local session integration and server-side tenant checks exist for implemented paths
- Fresh validation on 2026-10-11: the full working-tree suite passed 83 tests across 8 files, including the private-storage prototype. A separate exact candidate reconstructed from HEAD plus the selected publication manifest passed 78 tests across 7 files. Prisma Client generation succeeded; all 6 migrations and guarded demo seed succeeded against a tmpfs-backed disposable PostgreSQL service, which was removed afterward. Formatting, lint, typecheck, Prisma validation, and production build passed for the reduced candidate. Route tests invoke handlers directly with real Better Auth sessions and PostgreSQL; Next request context is stubbed. This is not full server/browser E2E.
- Deployment configuration: not implemented; hosting remains explicitly deferred
- Security model: server-side authorization and tenant membership checks enforced; RLS is not enabled
- Academic assignment foundation: school-scoped models, active normalized-name indexes, Better Auth-backed management service, assignment-aware policy helper, transactional row-lock revalidation, and database-enforced audit association are implemented in the current working tree. Four school-scoped mutation routes (create, deactivate, revoke, reactivate) call the transactional service and pass route-level integration coverage. No assignment UI, list/detail route, or academic read route exists; assignment read authorization remains unresolved under D-020. TCH-REQ-001, TEN-REQ-001, and SEC-REQ-001 remain specified and incomplete; Phase 4/5 remain incomplete.
- Dependency audit: full audit reports 8 high package entries from two advisories; production-only audit reports 3 entries from the Prisma/deepmerge-ts advisory. D-022 Option C is approved through 2026-10-18 only for the scoped development feature branch and draft PR, with disclosure and the unchanged CI audit gate; it is not production risk acceptance and does not authorize push. D-015 Option A remains active outside this narrow exception. The checkpoint push and draft PR were separately authorized and completed; no merge, deployment, release, or dependency override is approved. See [assessment](../security/DEPENDENCY_ADVISORY_ASSESSMENT.md).

## Pending local-CI follow-up

On the separate `feature/local-verification-and-health` development branch, a dependency-free liveness endpoint and its focused tests have been added, together with a guarded script to run the unchanged GitHub Actions command sequence locally against the disposable test database. GitHub Actions runners remain unavailable because of an owner-reported billing restriction. **These changes have not yet passed the full local application CI sequence**, so they are not evidence of a completed Phase 1 exit gate. The eight previously identified high-severity dependency findings remain open; no merge, production release, or deployment is permitted by D-022. See [Local CI Verification Runbook](../quality/LOCAL_CI_RUNBOOK.md).

## Additional security follow-up awaiting local verification

On the separate `feature/school-read-response-hardening` branch, the existing authenticated school-details endpoint is hardened with explicit private/no-store responses and exception-safe error logging. Its integration assertions and security-testing documentation are extended. These changes are not yet locally database-tested and do **not** complete TEN-REQ-001 or SEC-REQ-001. No permission, tenant-isolation, or database schema semantics are relaxed.

## Current roadmap phase

Phase 0 documentation baseline is complete.

The local engineering foundation is implemented and its listed local checks have passed for the app shell, Better Auth integration, schema, migration, seed, tenancy helper, and protected school access path. The broader Phase 1 engineering-plan definition of done is not fully met: there is no health endpoint, full HTTP/session integration coverage, CI-run evidence, production logging/audit implementation, or support-access workflow. This is local-development-ready only, not production-ready.

## Phase 1 completion gate

The local repository checkpoint is ready for review within the implemented scope, with these remaining gates:

- external identity-provider strategy remains unresolved
- hosting and deployment remain deferred
- PostgreSQL RLS remains intentionally not implemented
- no unrestricted routine support access; the exceptional access policy is approved, but its approval/enforcement/expiry/audit mechanism is unimplemented

## Outstanding decisions and blockers

- external identity-provider selection and production authentication controls
- hosting provider and domain, deferred until local development and testing are complete
- exceptional support-access mechanism implementation and security review
- payment-provider selection (Phase 9), parent-first report visibility (Phase 8), and QR disclosure (QR verification phase)
- remaining SEC-REQ-001 and TEN-REQ-001 acceptance criteria; these are not marked complete
- high-severity dependency findings must be resolved or explicitly risk-accepted before the configured CI gate can pass
- D-015 Option A still blocks merge, deployment, and release outside the approved D-022 development-only branch/draft-PR exception; the dependency findings require remediation or a separate explicit risk decision

## Next approved action

The next Phase 5 work should address the remaining TCH-REQ-001 criteria for timetable/class constraints and the distinction between Form Teacher and subject-teacher assignments, subject to the Phase 4 academic-structure decisions. Keep assignment list/detail routes gated on D-020 and the high-severity dependency audit blocker explicit.
