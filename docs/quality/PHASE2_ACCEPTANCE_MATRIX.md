# Phase 2 Identity, Tenancy, and Authorization Acceptance Matrix

## Purpose and evidence standard

This is the current **review and local verification plan** for TEN-REQ-001, USR-REQ-001, and SEC-REQ-001 from the [requirements matrix](../requirements/REQUIREMENTS_TRACEABILITY_MATRIX.md). The Phase 2 objective is described in the [implementation roadmap](../roadmap/IMPLEMENTATION_ROADMAP.md). It is **not** proof of Phase 2 completion or approval of production identity policy. All post-checkpoint changes must be tested against the exact reviewed cumulative commit on an explicitly disposable database.

Evidence labels: **authored** means source or test is present but unexecuted on the cumulative branch; **historical** refers to the separately validated original 81-file checkpoint; **blocked** requires policy, additional implementation, or real test results. Passing a unit test never substitutes for HTTP/browser or cross-tenant database evidence.

| Gate | Requirement | Reviewable source / test | Pass evidence needed | Status |
| --- | --- | --- | --- | --- |
| P2-01 Missing, invalid, expired, and deleted sessions | USR-REQ-001, SEC-REQ-001 | `src/modules/tenancy/school-route.integration.test.ts`; `src/modules/teacher-assignments/routes.integration.test.ts` | Real Better Auth cookie denied by protected GET and all four mutations after exact session deletion; invalid/expired cookies denied; no state changes | Authored; local DB run pending |
| P2-02 School and user boundary | TEN-REQ-001 | `src/modules/tenancy/context.integration.test.ts`; school route tests | Same-school access only, inactive membership/school denied, cross-school resources indistinguishable from missing, platform admin alone cannot access academic data | Authored; additional scope checks pending |
| P2-03 Verified resource scopes | TEN-REQ-001, SEC-REQ-001 | `src/modules/authorization/policy.test.ts`; `src/modules/tenancy/context.integration.test.ts` | Unverified section/class/subject grants denied; verified class/subject grants resolve only to active resources of the requested school; wrong-school and inactive IDs denied | Authored; local DB and compatibility review pending |
| P2-04 Teacher subject/class assignment | TEN-REQ-001, TCH-REQ-001 | `src/modules/authorization/policy.test.ts`; assignment service and route integration tests | Exact school + class + subject active assignment only; no scope-pair synthesis; revoked/deactivated assignments and class/subject denied; transactional race/rollback and immutable audit tests pass | Historical checkpoint tests; changed cumulative branch pending |
| P2-05 Input integrity and actor identity | SEC-REQ-001 | `src/modules/teacher-assignments/http.ts`; assignment route tests | Server derives session actor and tenant; rejects forged actor/school IDs and invalid payloads; errors conceal resource existence | Authored; local DB run pending |
| P2-06 Parent/student relationship access | TEN-REQ-001, USR-REQ-001 | `src/modules/authorization/policy.test.ts` | Verified same-tenant child grant enforced; unauthorized child accesses denied through real portal routes when implemented | Partial policy unit coverage; portal routes not implemented |
| P2-07 HTTP protection and privacy | SEC-REQ-001 | School GET and assignment handlers and tests | Non-caching response headers on all outcomes; safe generic errors; sanitized denied-read diagnostics despite logger exceptions; framework transport and browser behavior verified | Handler tests authored; browser transport blocked |
| P2-08 Auth lifecycle and admission | USR-REQ-001, SEC-REQ-001 | `src/lib/auth.ts`; `src/components/sign-in-form.tsx`; `src/components/sign-out-button.tsx` | Account admission, verification, password recovery, session expiry/rotation, logout revocation, account/device management, abuse controls, privileged MFA and negative E2E tests | **Blocked:** production identity decision [#17](https://github.com/Wilberry/myschoolboard/issues/17); only local Better Auth foundation |
| P2-09 Immutable operational security audit | SEC-REQ-001 | Assignment event triggers and tenant-aware service tests; school denial diagnostics | Confirm immutable event integrity/retention/access controls for in-scope actions; distinguish diagnostic logs from protected audit records | Partial assignment audit only; general security audit blocked |
| P2-10 Pipeline and dependency security | SEC-REQ-001, OPS-REQ-001 | `.github/workflows/ci.yml`, `scripts/verify-local.mjs`, [runbook](LOCAL_CI_RUNBOOK.md) | Run same workflow command sequence locally, on disposable DB, recording exact results; `npm audit --audit-level=high` must pass without exception/bypass | **Blocked:** 8 high audit findings; hosted runners billing-blocked |

## Additional teacher-assignment administrator read acceptance gate (authored)

| Gate | Requirement | Reviewable source/test | Pass evidence needed | Status |
| --- | --- | --- | --- | --- |
| P2-11 Teacher assignment administration read isolation | TCH-REQ-001, TEN-REQ-001, SEC-REQ-001 | `src/modules/teacher-assignments/read-service.ts`; `read-http.ts`; `reads.integration.test.ts` | Real Better Auth + disposable PostgreSQL tests confirm school-admin-only reads, final-query tenant membership, minimized fields, bounded same-tenant pagination, no-cache, error concealment, revoked sessions/roles and no mutation/audit writes. Verify actual Next HTTP transport separately. | Authored; new tests and full local CI pending |

## Phase 3/4 school onboarding and academic create foundation (authored)

This cross-phase foundation implements new non-production school lifecycle onboarding and auditable **draft** academic configuration writes, not complete Phase 3/4 acceptance. The platform-only onboarding migration and school-admin academic-session, term, class/subject configuration migration must run against the explicitly disposable test DB in lexical migration order. Verify the lifecycle and configuration audit triggers, same-school composite foreign keys, no guessed historic assignment periods, and the existing school `isActive` access barrier. Run the platform lifecycle and academic configuration DB integration suites, then genuine HTTP browser/cookie tests. All work is authored and unexecuted on this branch.

## New tenant-scope validation in this development follow-up

`ScopeGrant.scopeId` is not a database foreign key to a class or subject and a `verified` flag by itself cannot establish a tenant boundary. `resolveSchoolPrincipal` now filters CLASS and SUBJECT grants against **active** class/subject records owned by the requested school. Query only IDs from the server-derived active school membership, never a client-supplied membership or tenant identifier. Added integration cases intentionally create verified school-A grants pointing to school-B class/subject IDs and verify those invalid links are removed before the shared policy executes. A separate test deactivates the valid school-A resources and verifies their scoped permissions no longer resolve.

SECTION and CHILD relationship identifiers do **not yet have complete academic-section/enrollment models** in the current Prisma foundation. The existing child/section policy rules are not promoted to production assurance by these CLASS/SUBJECT checks. Do not implement section, parent, or student data routes until the corresponding same-school resource integrity and ownership controls are present and tested.

The additional class/subject lookups reduce the gap for stale and cross-school scope grants but **do not provide a single serializable snapshot spanning principal resolution and subsequent reads**. Continue using final-query school membership rechecks and transaction-time authorization for mutations.

## Owner-run local verification checkpoint (not run by this PR)

1. Review the exact branch SHA, diff and all draft PRs, keeping original local excluded files intact. Confirm Docker points to the local machine and `postgres-test` on loopback port 5434 is genuinely disposable.
2. Follow [LOCAL_CI_RUNBOOK.md](LOCAL_CI_RUNBOOK.md) to provision `postgres-test`, use synthetic `.test` identities, set test-only environment variables, and run `node --test scripts/verify-local.test.mjs` and `npm run verify:local:preflight`.
3. Run `npm run verify:local` **without altering its audit gate**; it executes npm CI install, Prisma generation/migrations/seed, format, lint, TypeScript, Vitest, production build and `npm audit --audit-level=high`, in that order.
4. Capture failures with the exact command and exit code; remediate, then rerun. After a passing static/database portion, manually exercise sign-in/out, auth cookies, school navigation, denials and tenant boundaries over actual Next.js HTTP transport in a controlled browser. These are distinct from direct-handler integration tests.
5. Reassess active grants stored with `verified: false` and document intended authorization before permitting the more restrictive verified-grant policy into any shared environment. Do not auto-mark grants verified or backfill guessed tenant relationships.
6. Record a requirement-by-requirement pass/fail/blocked result and exact commit SHA in the PR. **Do not mark Phase 2 complete** while production identity (#17), academic read decisions (D-020), general security audit, high-severity dependency remediation, and host/transport tests remain unresolved.

## Release boundary

D-015 continues to block merge and release outside the narrowly scoped D-022 original checkpoint publication exception. D-022 review/expiry is **2026-10-18**; nothing in this matrix extends it or authorizes deployment. Main remains unchanged. Later Phase 3+ modules retain their own product and security entry criteria.
