# Technology Decisions

## Decision ID: TECH-001

- Context: No code exists in the repository.
- Options considered: Monolith, modular monolith, microservices.
- Selected choice: Modular monolith is the default recommendation for the early stage.
- Rationale: It reduces unnecessary complexity while preserving explicit module boundaries.
- Trade-offs: Less independent scaling than microservices but simpler coordination for a small team.
- Security implications: Easier to enforce consistent tenant and authorization checks.
- Operational implications: Simpler monitoring and deployment.

## Decision ID: TECH-002

- Context: Need a durable, strongly consistent store for academic and financial records.
- Proposed choice: Relational database with explicit integrity constraints.
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

All technology choices are proposed or unresolved because the repository contains no implementation evidence. No final stack decision may be treated as approved until documentation and product-owner review confirm it.
