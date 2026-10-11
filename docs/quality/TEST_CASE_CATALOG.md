# Test Case Catalog

## Example catalog entry

- Test ID: T-TEN-001
- Requirement IDs: TEN-REQ-001
- Scenario: Cross-tenant access attempt
- Preconditions: Two tenant contexts exist
- Steps: User from tenant A requests tenant B data
- Expected result: Request denied and logged
- Security significance: Prevents data leakage
- Automation status: Planned

## Coverage areas

- Permission evaluation
- Enrollment uniqueness
- Score and grading validation
- Results and publication
- Parent-first report access
- QR token revocation
- Trash retention and restoration
- Fee verification workflows
- Teacher assignment tenant foreign keys, tuple uniqueness, lifecycle transitions, restrictive deletion, and exact-pair policy enforcement

## Execution status

The repository contains unit and database integration tests. Teacher-assignment service and route integration tests use only the guarded tmpfs-backed `myschoolboard_test` Compose service on localhost port 5434. Execution status is reported by the relevant validation run and does not imply production-database coverage.
