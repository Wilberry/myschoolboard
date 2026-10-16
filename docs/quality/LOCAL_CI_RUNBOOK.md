# Local CI Verification Runbook

## Purpose and scope

GitHub-hosted Actions jobs for draft PR #1 could not acquire a runner on 2026-10-11. The owner reports an account billing restriction and has chosen **local execution** of the existing CI checks until GitHub Actions is available. This is a delivery workaround, not a bypass of the failing security audit or a production-release exception.

The script `scripts/verify-local.mjs` executes the **same npm commands in the same order** as `.github/workflows/ci.yml`, including the final `npm audit --audit-level=high`. It stops at the first failed command and returns a nonzero exit status. The Node built-in test `scripts/verify-local.test.mjs` checks target guards and compares that command list with the tracked workflow. The GitHub Actions workflow is not modified or disabled.

The script **does not start Docker, create databases, select a shared environment, merge branches, or deploy**. The owner must inspect and start the disposable database deliberately.

## Prerequisites

- Use a checked-out and reviewed branch/commit. Fetch or switch branches without overwriting local untracked work. Record `git rev-parse HEAD` before verifying.
- Install **Node.js 22**, npm, and Docker with Docker Compose. Verify that TCP port **5434** is not forwarded to a shared system or occupied by an unrelated database.
- Use a **disposable local PostgreSQL test instance only**, created from the repository `postgres-test` Compose service. It uses tmpfs and loopback port `127.0.0.1:5434`. **Never point the runner at the development database (port 5433), a production database, shared DB, or an SSH tunnel to one.**
- Use synthetic test credentials only. Environment variables below belong in the local shell; do not commit a credentials file.

## Start disposable PostgreSQL

From the project root, after confirming port 5434 and the Docker context target your own development machine:

```sh
docker compose --profile test up -d postgres-test
docker compose --profile test ps postgres-test
```

The database starts empty on first run. The `postgres-test` service has an ephemeral tmpfs data directory; removing the service discards its data. Do not use the development `postgres` service for CI.

## Configure test-only environment (bash / zsh)

```sh
export NODE_ENV=test
export TEST_DATABASE_DISPOSABLE=1
export ALLOW_DEMO_SEED=1
export TEST_DATABASE_URL='postgresql://myschoolboard:local_test_password@localhost:5434/myschoolboard_test?schema=public'
export DATABASE_URL="$TEST_DATABASE_URL"
export BETTER_AUTH_SECRET='synthetic-local-test-secret-32-characters-minimum'
export BETTER_AUTH_URL='http://localhost:3000'
export DEV_ADMIN_EMAIL='admin@myschoolboard.test'
export DEV_ADMIN_PASSWORD='synthetic-local-test-password-42'
```

These examples are **local test data, not production secrets**. Do not reuse them in staging or production. Shell variables override ordinary `.env` defaults used by Prisma and application tooling.

## Preflight and run (only when ready to verify)

```sh
node --test scripts/verify-local.test.mjs
npm run verify:local:preflight
npm run verify:local
```

The preflight validates environment markers, exact URL equality, PostgreSQL protocol, loopback host, port 5434, database `myschoolboard_test`, local Better Auth origin, and synthetic seed credentials **before** migrations or seeding. Validation of URL strings cannot prove that a localhost port is not tunneled to a shared system; the operator must verify the Docker context and endpoint.

The full runner then executes:

1. `npm ci`
2. `npm run db:generate`
3. `npm run db:deploy`
4. `npm run db:seed`
5. `npm run format:check`
6. `npm run lint`
7. `npm run typecheck`
8. `npm test`
9. `npm run build`
10. `npm audit --audit-level=high`

Expect the last step to fail while the existing eight high-severity dependency package findings remain. **Do not remove, skip, weaken, or fake that result.** An apparently successful test/build stage is not a successful full CI gate. When a step fails, capture its command, exit code, relevant log excerpt, and exact commit SHA without exposing tokens or credentials. Rerun after a reviewed fix.

The Vitest test setup also requires the disposable database guard. Neither this runbook nor the runner authorizes a reset of the development/production database.

## Cleanup and reporting

When the user explicitly finishes with the disposable test service:

```sh
docker compose --profile test stop postgres-test
docker compose --profile test rm -f postgres-test
```

This addresses **only** `postgres-test`; do not run `docker compose down -v`, which could remove the separate development database volume.

Report the exact commit SHA, Node/npm versions, Docker test service confirmation, commands executed and outcomes, test counts, migrations applied, audit findings, and residual blockers. If GitHub billing/runner scheduling is restored later, the **unchanged** GitHub workflow must also be run and reviewed before any production release.

## Additional Phase 8 result-evidence migration preflight (2026-10-13)

Before `npm run verify:local` on the previously specified **disposable loopback-only** test service, inspect `_prisma_migrations` for `20261013100000_phase8_result_sheet_evidence_review`. The unmerged branch corrected three invalid repeated PL/pgSQL `DECLARE` sections in this draft migration, leaving all nine variable names/types intact. An already-applied migration with a different checksum **must not be silently rewritten or replayed**. If the disposable DB was used with earlier branch artifacts, stop and inspect migration history/failed attempts first; a fresh disposable-only test instance may be provisioned according to the documented operator-controlled procedure, never by resetting a shared database.

Run the newly registered structural guard in the normal `npm test`/`verify:local:guards` path before declaring local acceptance. This guard does not replace actual PostgreSQL syntax checking, data/tenant audit tests, Vitest, Prisma migration status or strict `npm audit --audit-level=high`. The existing `npm run verify:local` command order and CI workflow remain unchanged. This checkpoint did **not** execute migrations or seeding.

## Phase 8 worktree-pinned verification entry point (2026-10-16)

After two accidental fast-forwards from the separate original Phase 1 checkout (both safely repaired with its untracked files preserved), the Phase 8 development branch now provides a deliberately stricter **non-destructive entry point** at `scripts/verify-phase8-checkpoint.mjs`.

Invoke the script with its **absolute path**, independent of which folder the terminal opens in:

```sh
# Read-only preflight only; no Docker start, database migration or seed
node /home/wilberry/Desktop/project/myschoolboard-phase8/scripts/verify-phase8-checkpoint.mjs --preflight

# Only after verifying that database is the intended disposable Docker test service
# This runs the existing full npm CI-equivalent pipeline, including the strict audit
node /home/wilberry/Desktop/project/myschoolboard-phase8/scripts/verify-phase8-checkpoint.mjs --run
```

Set the existing synthetic variables in this runbook beforehand, plus **both** `PHASE8_REPORT_RELEASE_ENABLED=false` and `PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED=false`. The wrapper determines the root **from its own file**, never from shell cwd, and rejects anything except the separate `myschoolboard-phase8` checkout on branch `verify/phase8-local` with no staged, unstaged or untracked changes and with local HEAD identical to `origin/verify/phase8-local`. Fetch/fast-forward **only** within the Phase 8 worktree beforehand, and inspect the branch/commit yourself. The wrapper also reads Docker Compose configuration, requires a tmpfs-backed `postgres-test` with a single loopback published 5434-to-5432 port mapping, and checks `pg_isready`. It never restores, resets, cleans, switches or fetches a Git branch, starts/stops Docker, migrates databases in preflight mode, or changes feature flags.

`--run` requires this read-only preflight to pass and then launches the **unchanged** `scripts/verify-local.mjs` sequence from the verified Phase 8 root; its checksum-before-deploy protection, installed guards, full Vitest/Next checks, and final `npm audit --audit-level=high` remain mandatory. This command can modify **only** the explicitly disposable synthetic database as authorized by the existing mandate and the operator's verified local Docker context. No shared/production data, real pupils, branch updates or GitHub Actions are authorized by these commands.

The wrapper has a pure three-test Node regression file in both local guard and full-test npm registrations. Isolated source-level harness assertions 12/12 passed in this chat; **the actual new Node tests and full wrapper pipeline have not been run** in the local worktree yet. A clean worktree alone does not prove the Docker context is local; inspect the active context, external forwards and port before running.
