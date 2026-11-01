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

## Migration inventory and runner compatibility

The combined PR #102 + #103 branch contains **38 migrations** (37 accepted foundation migrations and the additive guardian attestation migration). The guarded synthetic browser launcher now requires **exactly 38**, with tests rejecting missing or extra migrations and the existing SHA-256 verification checking every applied migration. The Phase 3-specific preflight helpers deliberately remain frozen at their historical **37-migration** checkpoint; they must not be used as the current guardian-branch bootstrap gate. The general `npm run verify:local:preflight` and `npm run verify:local` remain the authoritative guarded local paths. The local runner now automatically calls **`npm run verify:migration-checksums` after `db:deploy` and before any seed**, so every successfully applied guardian/earlier migration must exactly match its source SHA-256. The original hosted GitHub CI command array remains unchanged; `scripts/verify-local.test.mjs` asserts both the original CI parity and additional local step ordering. **This local checksum stage is implemented but has not yet run against an actual database in this chat.**

Two additional synthetic admin-route regressions deny writes and reads after actor role demotion or school deactivation. The guardian-link integration suite contains **16 authored cases**; these now include the actual authenticated school withdrawal route (with persistent WITHDRAWN student event and ENDED enrollment), proof that a previously valid guardian link becomes ineligible without reactivating history, denial for a second unlinked PARENT in the same school, simultaneous competing revocations of one guardian link (one terminal audit event), and access denial to an administrator demoted after attestation. The new `scripts/issue20-guardian-guard.test.mjs` adds **five source-only** migration, policy, API, concurrency-coverage and privacy checks. Both `npm test` and `npm run verify:local:guards` now include that guard. **These repository test suites have not been executed** in this environment; separate read-back/source-invariant checks passed.

## Required local checks before acceptance

The newly added withdrawal regression must be evaluated against a disposable test database only: it invokes the real signed-in administrator withdrawal handler and preserves the resulting student/enrollment and audit history instead of directly reversing an ENDED enrollment. The second same-school PARENT is a synthetic identity and must never see either linked child's data. These, together with the concurrent-revocation and stale-admin-role scenarios, are only **authored assertions**, not evidence of passed database tests. The race test must be exercised in the guarded disposable PostgreSQL environment; a 500, duplicate audit row, or repeated successful revocation fails acceptance.

On an explicitly disposable local PostgreSQL 17 database, run `npm run verify:local:preflight` first; confirm the guarded loopback-only database target and exact 38-file inventory. Run `npx prisma validate` and `npx prisma generate`, then targeted `npx vitest run src/modules/students/guardian-link.integration.test.ts src/modules/tenancy/context.integration.test.ts src/modules/authorization/policy.test.ts`, and the existing `npm run verify:local` workflow. Run the strict and full dependency audits unchanged. If optional browser fixtures are required, the launcher now expects all **38 exact applied checksums** on a genuinely empty disposable database and the original-tab/Flight/print cases must still be completed. Review fresh outputs for the **exact current stacked SHA**; do not presume previous SHA evidence applies.

**Exit:** BLOCKED. Issue #20 stays open. Phase 8 published report access remains disabled.
