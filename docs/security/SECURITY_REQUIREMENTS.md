# Security Requirements

## Core requirements

- Every API and mutation must enforce tenant and permission checks.
- Authentication must be server-side authoritative.
- Credentials and tokens must be protected, hashed, and rotated as required.
- Sensitive data must be minimized and access-controlled.
- Audit logs must be protected and readable only by authorized roles.

## Security principles

- Least privilege
- Tenant isolation
- Explicit workflow approval
- Immutable audit trails
- Secure file handling
- No selective weakening of access checks for tests or convenience
