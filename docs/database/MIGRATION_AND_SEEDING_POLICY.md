# Migration and Seeding Policy

## Migration policy

- Schema changes must be tracked and reviewed.
- Migrations must include backward-compatible and forward-compatible logic.
- Data migrations must preserve historical records and tenant isolation.
- Migration changes affecting academic rules must be reviewed against versioning and approval implications.
- PostgreSQL expression/partial indexes and append-only triggers that Prisma cannot express declaratively must be kept in reviewed SQL migrations and verified against PostgreSQL; Prisma schema diff alone does not detect their drift.
- The class and subject active-name indexes use `lower(btrim(name))` and are conditional on `isActive = true`. The pre-migration duplicate check must use the same expression and must not rewrite existing records.
- Assignment audit event triggers reject ordinary SQL UPDATE, DELETE, and TRUNCATE statements. A database owner able to disable or drop triggers can bypass this control; it is not a defense against privileged schema administration.
- Assignment audit events use a composite foreign key to bind school, assignment, and target teacher membership. An insert trigger validates actor membership, actor user, and school together. Actor IDs intentionally have no foreign keys so user/membership deletion leaves the historical snapshot intact; school cascade deletion remains the approved event-history deletion exception.
- Integration tests must use `TEST_DATABASE_URL` pointing to `localhost:5434/myschoolboard_test`, with `TEST_DATABASE_DISPOSABLE=1`. The Vitest setup replaces `DATABASE_URL` with this guarded URL and fails closed if the explicit disposable-database marker or expected endpoint is absent. The local test database uses an in-memory Docker volume; CI uses its disposable PostgreSQL service container.

## Seeding policy

- Seed data must be clearly labeled as non-production or ops data.
- Seed data must not contain sensitive production-like content.
- Tenant-seeded configuration must be isolated by tenant.

## Current status

The current working tree contains a Prisma schema and additive PostgreSQL migrations, including the teacher assignment audit association migration. The current migration set was applied successfully to the tmpfs-backed disposable PostgreSQL test database during the remediation checkpoint. No development or production database was migrated. Prisma schema validation alone remains distinct from applying or verifying custom SQL migrations.
