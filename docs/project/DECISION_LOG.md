# Decision Log

## D-001: Documentation-first baseline

- Status: Accepted
- Decision: The repository will be treated as a documentation-first product baseline before implementation.
- Rationale: The repository is empty and contains no verified stack or application code.

## D-002: Multi-tenant architecture model

- Status: Proposed
- Decision: Shared SaaS platform with explicit tenant isolation and school-scoped configuration.
- Rationale: Required by product and security specifications.

## D-003: Two distinct super-admin roles

- Status: Required specification
- Decision: Platform Super Admin and School Super Admin are distinct roles with different authorization scopes.
- Rationale: The product requires explicit separation between platform-level and school-level authority.

## D-004: Final publication by School Super Admin

- Status: Required specification
- Decision: Official report cards require final School Super Admin approval before parent access.
- Rationale: This is a mandatory product requirement.

## D-005: 30-day school trash, 90-day platform trash

- Status: Required specification
- Decision: School Trash retention is 30 days; platform Trash retention is 90 days.
- Rationale: Explicitly required by the business specification.

## Unresolved decisions

- Whether support access uses a controlled, temporary override mechanism
- Exact parent-view acknowledgment semantics for the parent-first policy
- Final stack choice and hosting model
- Approved payment integrations and currency policy
- Final public QR verification and school disclosure fields

These unresolved items must be routed to the product owner before implementation.
