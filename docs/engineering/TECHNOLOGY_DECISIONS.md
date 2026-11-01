# Technology Decisions

## Decision ID: TECH-001

- Context: The local Phase 1 foundation uses this architecture.
- Options considered: Monolith, modular monolith, microservices.
- Selected choice: TypeScript modular monolith with Next.js for local development and testing.
- Rationale: It reduces unnecessary complexity while preserving explicit module boundaries.
- Trade-offs: Less independent scaling than microservices but simpler coordination for a small team.
- Security implications: Easier to enforce consistent tenant and authorization checks.
- Operational implications: Simpler monitoring and deployment.

## Decision ID: TECH-002

- Context: The local foundation requires durable relational persistence.
- Selected choice: PostgreSQL with Prisma schema and reviewed migrations for local development and testing.
- Rationale: Required for historical, versioned, transactional academic records.

## Decision ID: TECH-003

- Context: Need support for file uploads, reports, and retention.
- Proposed choice: Tenant-aware object storage or file service.
- Rationale: Supports file isolation and storage lifecycle management.

## Decision ID: TECH-004

- Context: Need automation for notifications and retention.
- Proposed choice: Background job system with idempotent processing.
- Rationale: Payment verification and retention require reliability and retry handling.

## Current status

TypeScript, Next.js, PostgreSQL, and the modular-monolith direction are approved for the local foundation and have implementation evidence. Better Auth is currently implemented locally; the external identity-provider strategy remains open. Hosting provider and domain are deferred until local development and testing are complete. File storage and background job choices remain proposed for future implementation.
