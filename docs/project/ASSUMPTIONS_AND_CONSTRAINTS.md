# Assumptions and Constraints

## Current verified state

The repository began as a documentation-only baseline, but subsequently gained a local Next.js/Better Auth/Prisma/PostgreSQL foundation and unmerged Phase 2 draft branches. See [Current Status](../roadmap/CURRENT_STATUS.md) for dated validation evidence and explicitly unexecuted tests. The platform is in active development and is **not** production-ready.

## Assumptions

- The product will be delivered as a multi-tenant SaaS operating on a shared platform with isolated tenant data.
- The initial market is schools in Nigeria, with support for future international expansion.
- School policies must be configurable where the product owner allows variation.
- Both primary and secondary models must be supported.
- Official academic records require explicit approval before publication.
- Role-based controls must be enforced server-side.
- The public product name is provisional and should remain configurable.

## Constraints

- Implementation must follow the canonical requirements and update traceability as necessary; the standing development mandate authorizes routine, documented feature work without separate per-feature approval.
- No unapproved tenant access or cross-tenant data exposure may occur.
- No destructive deletion can replace withdrawal, archiving, or audit retention logic.
- School Trash retention is 30 days; platform Trash retention is 90 days.
- Vision, branding, and public identity are not hard-coded into architecture.
- The platform must support legal retention, audit, and recovery obligations without compromising historical integrity.
- The documentation baseline must remain consistent with the live repository state and cannot claim implemented product features without evidence.

## Business policy decisions to resolve at their owning phase

- Whether suspended or expired tenants can still access read-only data
- Whether support access can create an exceptional override mechanism
- Parent-first report-card policy exact behavior and acknowledgment semantics
- Public QR verification display fields and token lifecycle policy
- Payment-provider integration scope and currency handling
- Which third-party communication channels are approved
- Production hosting/domain and external identity-provider choices when required for launch; the local Phase 1 development stack is already approved and implemented
