# Test Strategy

## Principles

- Test real behavior, not mock-only behavior.
- Cover tenant isolation, authorization, workflow transitions, and historical data invariants.
- Keep tests aligned to requirement IDs and acceptance criteria.

## Test levels

- Unit tests: scoring, permissions, state transitions, retention checks.
- Integration tests: database constraints, workflow validation, teacher assignments, and attendance.
- End-to-end tests: school onboarding, publication, portal access, QR verification, fees, and trash flows.

## Permission-aligned navigation tests (new, pending local verification)

The school workspace must not provide a functional school-details link to a membership that fails the existing school-level `academic:read` policy. The presentation predicate delegates to the same policy helper, and focused unit tests enumerate allowed/disallowed role cases. Real authorization remains mandatory in the destination route; a navigation hint cannot be treated as an access-control decision.

## Authentication client request failure tests (authored, not yet run)

The shared `authRequestSucceeded` helper is covered by unit cases for success, explicit provider errors, missing response bodies on fulfilled requests, and rejected transport calls. Sign-in and sign-out UI now use this result to avoid permanent loading states and to show generic, non-disclosing error messages; the sign-out UI only refreshes after a successful request. Unit tests await local CI, and **real browser event/keyboard/accessibility tests remain outstanding** before the authentication UI is treated as fully verified.

## Required negative tests

- Cross-tenant access
- Unauthorized teacher assignment attempts
- Parent impersonation and student access bypass
- Unpublished report-card access
- Duplicate enrollment and invalid approval attempts

## Automation status

The Phase 1 foundation has automated policy, route, database, and teacher-assignment tests. The exact reduced checkpoint historically passed 78 tests across 7 files; these do not establish full end-to-end or production readiness. The follow-up liveness tests and local verification-guard tests are authored but await the next complete locally executed CI pass. See [Local CI Verification Runbook](LOCAL_CI_RUNBOOK.md).
