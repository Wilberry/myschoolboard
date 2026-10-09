# Migration and Seeding Policy

## Migration policy

- Schema changes must be tracked and reviewed.
- Migrations must include backward-compatible and forward-compatible logic.
- Data migrations must preserve historical records and tenant isolation.
- Migration changes affecting academic rules must be reviewed against versioning and approval implications.

## Seeding policy

- Seed data must be clearly labeled as non-production or ops data.
- Seed data must not contain sensitive production-like content.
- Tenant-seeded configuration must be isolated by tenant.

## Current status

No migration tooling or schema is present in the repository; this policy is defined for future implementation and approval.
