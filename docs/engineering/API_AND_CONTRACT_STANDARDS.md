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

## Authenticated school-scoped response caching

The school-details GET and all teacher-assignment mutation responses are required to send `Cache-Control: private, no-store`, including authorization denials and errors. This prevents shared HTTP intermediaries and browsers from persisting school-scoped details or authorization-dependent mutation results. The teacher-assignment response change is authored on a separate development branch and awaits local verification. The policy does not replace server-side authentication, tenant scoping, or transactional authorization.

## Denied school-read operational event

For an authenticated school metadata read denied as `404`, the handler emits a best-effort structured diagnostic event containing only `event: school_read_denied` and a generated random `requestId`. It uses the same event type for absent and cross-tenant schools, and it omits any principal, tenant, resource, cookie, or request identifiers. The HTTP status and body remain generic even when logging fails. This diagnostic event is **not** a durable or immutable audit record; the eventual security audit pipeline requires a separate reviewed design. The implementation and associated integration tests await local verification.

## Current status

The teacher-assignment module records the four implemented mutation contracts and the unresolved list/detail read proposal. Other API contracts remain future work and must follow these standards.
