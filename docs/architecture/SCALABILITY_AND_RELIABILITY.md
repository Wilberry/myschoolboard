# Scalability and Reliability

## Design principles

- Keep domain boundaries modular and testable.
- Use transactional boundaries around sensitive workflows.
- Build background jobs to be idempotent and retry-safe.
- Keep data integrity as a first-class operational property.

## Reliability requirements

- Academic and payment transitions must be atomic and auditable.
- Tenancy checks, permission checks, and records must be validated at the service boundary.
- Retention jobs must be retryable and verifiable.

## Proposed operational scaling

- Start with a maintainable modular architecture for a small team.
- Scale storage and worker capacity with actual tenant growth.
- Prefer explicit database constraints over weak application logic.

## Unresolved decisions

- Exact hosting and failure-zone model
- Database scalability approach
- Final performance SLOs
- Backup frequency and RPO/RTO targets
