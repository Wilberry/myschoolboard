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

No automated tests exist yet. This is a specified strategy for future implementation.
