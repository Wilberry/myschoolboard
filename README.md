# MySchoolBoard Local Phase 1 Foundation

This repository now includes a verified local Phase 1 foundation for a multi-tenant school system. The implementation is intentionally local-first and is not a production deployment. It is designed to prove the architecture, tenant scoping, session handling, database migration flow, and security boundaries before any production or hosting decisions are made.

## Purpose

The repository remains the canonical product and engineering source of truth for MySchoolBoard. It captures:

- Product and security requirements
- Authorization and tenant-isolation rules
- Architecture decisions and implementation notes
- Local environment setup and database workflow
- Verified local validation results for the Phase 1 foundation

## Documentation entry point

- [docs/README.md](docs/README.md) — full documentation navigation
- [AGENTS.md](AGENTS.md) — required workflow for future agents
- [CHANGELOG.md](CHANGELOG.md) — project history and verification notes
- [docs/roadmap/CURRENT_STATUS.md](docs/roadmap/CURRENT_STATUS.md) — current implementation status
- [docs/roadmap/IMPLEMENTATION_ROADMAP.md](docs/roadmap/IMPLEMENTATION_ROADMAP.md) — roadmap and Phase 1 status

## Current verified repository state

As of the latest verification pass:

- Repository branch: `checkpoint/phase1-tenant-safe-foundation` (development review branch); `main` remains unchanged
- GitHub checkpoint: commit `2c7c6b9a905272ac5f9cc70d06b67367b2c1c791` is published in [draft PR #1](https://github.com/Wilberry/myschoolboard/pull/1); the excluded prototype and starter assets remain untracked on the original local workspace
- Application stack: Next.js 16, React 19, TypeScript, Better Auth, Prisma, PostgreSQL
- Approved local architecture direction: TypeScript modular monolith, Next.js, PostgreSQL
- Database: PostgreSQL local dev database on port 5433
- Auth: Better Auth is implemented locally; external identity-provider strategy remains open
- Tenant model: active school membership is required for any authorized school access
- Local app: sign-in flow, workspace view, and protected school detail page implemented
- Tests: the full working-tree validation on 2026-10-11 passed 83 tests across 8 files, including the private-storage prototype. The exact reduced candidate reconstructed from HEAD and the selected manifest passed 78 tests across 7 files against a tmpfs-backed disposable test database.
- Build: production build passed in recorded isolated local validation; no production deployment exists
- Local workflow: Prisma generation, all 6 migrations, guarded seed, tests, lint, typecheck, formatting, schema validation, and production build passed in the recorded local validation
- Dependency audit: `npm audit --audit-level=high` fails with 8 high findings; `npm audit --omit=dev --audit-level=high` still reports 3 high Prisma-config/deepmerge findings. The first GitHub draft-PR CI run failed; its individual failing steps must be verified rather than assuming audit was the only failure

## Current status

The project has moved beyond the documentation-only baseline and has a local Phase 1 foundation with the listed local checks verified. The broader Phase 1 engineering-plan definition of done is not fully met, and this is not a production deployment. External identity selection, PostgreSQL RLS, and hosting configuration remain open or deferred.

## Canonical rule

All implementation work must continue to read and follow:

- [AGENTS.md](AGENTS.md)
- [docs/README.md](docs/README.md)
- the current roadmap phase and relevant requirement documents
- the approved decision records and authorization rules

## Important unresolved decisions

The following remain explicitly unresolved or intentionally deferred:

- external identity-provider selection
- PostgreSQL RLS implementation
- high-severity dependency advisories in the Prisma config and Next.js lint dependency chains; compatible fixes were not available from the current dependency metadata
- hosting provider, domain, and deployment model until local development/testing is complete
- exceptional support-access approval mechanism; unrestricted routine access is not allowed
- payment-provider selection, parent-first report visibility, and QR disclosure in their relevant phases

## Local validation summary

The verified local workflow includes:

- Postgres startup via Docker Compose
- Prisma generate and migrate deploy
- seed script execution
- Vitest suite execution
- ESLint, TypeScript, Prettier checks
- Next.js production build

This is a local-development ready state, not a production host-ready state.

## Local database safety

Demo seeding is limited to the local development database or the explicitly disposable test database. Set `ALLOW_DEMO_SEED=1` only when intentionally running `npm run db:seed`. The test target additionally requires `NODE_ENV=test`, matching `DATABASE_URL` and `TEST_DATABASE_URL`, and `TEST_DATABASE_DISPOSABLE=1`.

`npm run db:reset` is restricted to the local development database and requires `ALLOW_LOCAL_DB_RESET=1`. Never point it at a shared or production database. Docker Compose binds its PostgreSQL ports to loopback.

## Note on branding

The provisional product name MySchoolBoard remains a working project label. Public branding should remain configurable and should not be treated as a fixed product identity until product-owner approval is recorded.
