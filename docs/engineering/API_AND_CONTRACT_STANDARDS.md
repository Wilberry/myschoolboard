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

## Current status

The teacher-assignment module records the four implemented mutation contracts and the unresolved list/detail read proposal. Other API contracts remain future work and must follow these standards.
