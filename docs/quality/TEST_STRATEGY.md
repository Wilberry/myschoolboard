# Test Strategy

## Principles

- Test real behavior, not mock-only behavior.
- Cover tenant isolation, authorization, workflow transitions, and historical data invariants.
- Keep tests aligned to requirement IDs and acceptance criteria.

## Test levels

- Unit tests: scoring, permissions, state transitions, retention checks.
- Integration tests: database constraints, workflow validation, teacher assignments, and attendance.
- End-to-end tests: school onboarding, publication, portal access, QR verification, fees, and trash flows.

## Required negative tests

- Cross-tenant access
- Unauthorized teacher assignment attempts
- Parent impersonation and student access bypass
- Unpublished report-card access
- Duplicate enrollment and invalid approval attempts

## Automation status

The Phase 1 foundation has automated policy, route, database, and teacher-assignment tests. The exact reduced checkpoint historically passed 78 tests across 7 files; these do not establish full end-to-end or production readiness. The follow-up liveness tests and local verification-guard tests are authored but await the next complete locally executed CI pass. See [Local CI Verification Runbook](LOCAL_CI_RUNBOOK.md).
