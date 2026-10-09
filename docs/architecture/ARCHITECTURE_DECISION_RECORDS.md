# Architecture Decision Records

## ADR-001: Modular domain design

- Status: Proposed
- Context: The platform includes many domains with different security and lifecycle needs.
- Decision: Organize the system around domain modules instead of one monolithic school feature set.
- Consequences: Clear separation of concerns and easier testing.

## ADR-002: Relational database with tenant scope

- Status: Proposed
- Context: The product requires strong invariants, versioning, historical records, and academic integrity.
- Decision: Use a relational database as the default persistence layer until evidence justifies otherwise.
- Consequences: Strong referential integrity and transactional guarantees.

## ADR-003: Tenant-aware security model

- Status: Required
- Decision: Every request and background operation must validate tenant scoping and authorization server-side.
- Consequences: Stronger isolation but more explicit access checks in code.

## ADR-004: Platform and school admin separation

- Status: Required
- Decision: Platform Super Admin and School Super Admin remain distinct operational identities.
- Consequences: Clearer access control and safer support models.

## ADR-005: Documentation-first baseline

- Status: Accepted
- Decision: No code implementation begins before the documentation set and requirement traceability are in place.
- Consequences: Slower start but stronger long-term quality.
