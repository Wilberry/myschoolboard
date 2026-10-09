# Multi-Tenancy

## Tenant model

The product should adopt a shared-infrastructure, isolated-tenant model.

- Shared platform infrastructure
- Tenant-specific configuration and branding
- Tenant-specific user memberships
- Strong server-side enforcement of tenant context
- Explicit data and file boundaries

## Security requirements

- Tenant ID must be derived from authenticated membership and trusted server context.
- The client must not be trusted to provide tenant scope.
- Composite uniqueness constraints must include tenant context where relevant.
- File storage, jobs, reports, and caches must also be tenant-aware.

## Cross-tenant threats

- URL tampering
- Request forging
- Cache poisoning
- Background job leakage
- Export or report leakage
- Duplicate database records with wrong tenant scope

## Mandatory isolation tests

- One tenant cannot access another tenant’s school data.
- Parent-child relationship checks must be tenant-scoped.
- School users cannot access platform Trash.
- Platform operators cannot access school academic data without explicit approval and audit.

## Proposed design trade-offs

- Shared infrastructure reduces cost and complexity.
- Strict tenant-aware checks increase implementation effort but are necessary for security.
