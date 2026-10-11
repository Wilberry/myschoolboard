# API and Contract Standards

## API principles

- All API responses must respect tenant scope and role checks.
- Mutations require explicit authorization and validation.
- Errors must be informative without leaking sensitive internals.
- Workflow transitions must have explicit, auditable states.

## Contract expectations

- Include versioning where needed.
- Use explicit enums for states and approval actions.
- Require idempotency for payment callbacks and critical operations.

## Operational liveness contract

`GET /api/health/live` is a public, dependency-free process liveness probe returning only HTTP `200`, `{"status":"ok"}`, and `Cache-Control: no-store`. It does **not** assert database connectivity, tenant availability, authentication readiness, or production operational readiness. It must not return environment configuration, version information, secrets, tenant identifiers, or detailed exceptions. The handler and focused tests are added in the local-CI follow-up, pending full local verification.

## Current status

The teacher-assignment module records the four implemented mutation contracts and the unresolved list/detail read proposal. Other API contracts remain future work and must follow these standards.
