# Issue #20 — Guardian Relationship Foundation (draft checkpoint)

**Date:** 1 November 2026  
**Target:** `feature/issue20-guardian-attestation-20261101`, stacked on draft PR #102 (fail-closed CHILD scope policy).  
**Requirements:** TEN-REQ-001, USR-REQ-001, ADM-REQ-001, SEC-REQ-001; future RES-REQ-001 recipient privacy prerequisite.

## Authored scope

- Add `GuardianStudentLink` and `GuardianStudentLinkRevocation` with school-bound foreign keys, one immutable attestation per parent/child pair, actor/guardian/student validation triggers, reason checks and append-only protections. No historic guesses or links auto-created.
- Require active school administrator identity, currently active PARENT membership, ENROLLED student with ACTIVE enrollment/session/class/section; one explicit `relationshipVerified: true` attestation.
- Add school-admin-only POST/GET metadata and reasoned revoke routes with private/no-store responses. These routes return no pupil personal records or grades; no guardian GET exists.
- Add a session-derived internal boolean relationship predicate that rejects absent/revoked links, inactive PARENT accounts, changed school/section status, withdrawn enrollment and other-school claims; this predicate **does not** enable `child:read` or release content.
- Add synthetic authenticated database integration cases for anonymous/foreign/teacher/parent denials, wrong role, unenrolled/withdrawn pupil, forged direct database actors, duplicate pair, immutable history, and terminal revocation.
- Retain draft #102's unconditional generic `child:read` denial, excluding all unbound CHILD scopes. The ledger is *not* an access grant.

## Verification / safety

**Executed in this chat:** GitHub branch/content publication and source/diff verification only. The development agent cannot reach the owner's local repository or disposable PostgreSQL service. **NOT executed:** migration application/checksums, Prisma generation/validation, local Vitest/HTTP, negative SQL/concurrency/revocation races, formatting, ESLint, TypeScript, Next build, strict/full dependency audit, actual Chrome original-tab/print/Flight privacy and full local checkpoint. These remain **blocking** for merge; hosted GitHub Actions failures are not local acceptance authority under D-051.

**Limitations:** The current model permits multiple separately attested PARENT memberships for one child but does not resolve actual custody/consent policy, historic transfers, parent-facing read, or real-user identity verification. A revoked pair is terminal and cannot be silently reattached. Future guardian access requires **separate** per-request checks of actor, school, school membership, relationship, revocation, student status, active enrollment, actual publication/visible resource, caching and browser history. No student/guardian data release, production operation or main integration.

## Required local checks before acceptance

On an explicitly disposable local PostgreSQL 17 database, verify the migration order/checksums, run `npx prisma validate` and `npx prisma generate`, targeted `npx vitest run src/modules/students/guardian-link.integration.test.ts src/modules/tenancy/context.integration.test.ts src/modules/authorization/policy.test.ts`, then repository's documented full local equivalent including format/lint/types/build and **unchanged strict and full dependency audits**. Review fresh actual results for the exact candidate SHA; do not presume previous SHA evidence applies.

**Exit:** BLOCKED. Issue #20 stays open. Phase 8 published report access remains disabled.
