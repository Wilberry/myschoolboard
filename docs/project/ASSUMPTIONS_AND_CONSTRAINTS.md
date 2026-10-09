# Assumptions and Constraints

## Assumptions

- The product will be delivered as a multi-tenant SaaS operating on a shared platform but isolated tenant data.
- The initial market is schools in Nigeria, with support for future international expansion.
- School policies must be configurable where the product owner allows variation.
- Both primary and secondary models must be supported.
- Official academic records require explicit approval before publication.
- Role-based controls must be enforced server-side.

## Constraints

- No implementation may proceed without documentation and requirement traceability.
- No unapproved tenant access or cross-tenant data exposure may occur.
- No destructive deletion can replace withdrawal, archiving, or audit retention logic.
- School Trash retention is 30 days; platform Trash retention is 90 days.
- Vision, branding, and public identity are not hard-coded into architecture.
- The platform must support legal retention, audit, and recovery obligations without compromising historical integrity.

## Business policy decisions requiring approval

- Whether suspended or expired tenants can still access read-only data
- Whether support access can create an exceptional override mechanism
- Parent-first report-card policy exact behavior and acknowledgment semantics
- Public QR verification display fields and token lifecycle policy
- Payment-provider integration scope and currency handling
- Which third-party communication channels are approved
