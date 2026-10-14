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

## Phase 8 draft migration syntax correction and checksum safety (2026-10-13)

- **Draft/unmerged only:** `20261013100000_phase8_result_sheet_evidence_review` is absent from `main`. Its three PL/pgSQL result-evidence functions incorrectly repeated `DECLARE` before each variable. The draft branch now contains one `DECLARE` section per function, as PostgreSQL 17 PL/pgSQL requires. The change is exactly nine removed `DECLARE ` prefixes; no academic rule, table, function signature, trigger or authorization condition is changed. New `scripts/phase8-plpgsql-declaration-guard.test.mjs` is registered in `npm test` and `verify:local:guards`.
- **Do not assume absence from `main` proves that no other environment has applied it.** Before any cumulative migration run, verify the target is the explicitly confirmed disposable loopback PostgreSQL database and inspect its `_prisma_migrations` history/checksum for this migration. On an already-applied target, **do not edit or reapply historical migration bytes or use a reset workaround**; stop and reconcile with a reviewed forward-only migration plan, preserving existing tenant and audit records. On fresh disposable databases the corrected draft migration can be validated normally. No database was accessed as part of this checkpoint.
- The separate later `20261013170000_phase8_private_composition_source_status_hardening` remains an additive forward-only repair. It cannot repair a syntax-invalid **earlier** migration if that earlier migration prevents deployment from reaching the new file. Migration order and Prisma checksum history must be checked before declaring Phase 8 accepted.
- **Exit remains blocked:** PostgreSQL deployment/rollback/integration, Prisma, full test/build and dependency audit must pass. See `docs/quality/PHASE8_CUMULATIVE_VERIFICATION_BLOCKERS_20261013.md`.

## 2026-10-14 recorded migration checksum safety before local redeploy

The Phase 8 verification branch contains four historical **unmerged** SQL-alias corrections, which may have different bytes from any environment that previously applied the original drafts. Before `db:deploy` against the explicitly disposable `localhost:5434/myschoolboard_test` target, the local runner now calls `npm run verify:local:checksums`, validating completed `_prisma_migrations.checksum` entries against SHA-256 hashes of the exact checked-in `migration.sql` bytes. It also stops on missing/unfinished migration history and refuses nonempty public schemas without a migration ledger. Records marked rolled back are not considered completed applications. All comparisons are read-only; neither a checksum mismatch nor migration failure permits editing the old checksum, resetting a shared database, or reapplying a draft migration against real pupil data. A mismatch requires a reviewed forward-only reconciliation or an independently provisioned brand-new disposable database. This **new check has not yet been executed** against a database in this chat.

