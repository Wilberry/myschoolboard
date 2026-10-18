# Phase 9 — Confirmed Disposable Database Verification Runbook

**Branch:** `feature/phase9-fees-payments-foundation`  
**Scope:** only LOCAL synthetic test PostgreSQL; no live banking, shared DB,
production or Phase 8 verification worktree.  
**State:** automated nonce attestation and mocked tests AUTHORED; no
database, Node tests, Prisma or CI actually executed in this GitHub-only
development environment.

## Why the existing localhost preflight was insufficient

The existing `scripts/verify-local.mjs` already checks `NODE_ENV=test`,
loopback, `localhost:5434/myschoolboard_test`, disposable flags,
synthetic account credentials and Better Auth URL. These are necessary
but **not proof that the database behind localhost is disposable**:
a forwarded SSH/TCP port can point to a shared/production server using
the same host, port and database name. Running `prisma migrate deploy`
and demo seed against it could irreversibly damage real data.

The Phase 9 wrapper adds a READ-ONLY inspection of a **nonce recorded
inside the actual database** before invoking the unchanged existing
cumulative local CI runner. If `psql` is absent, the marker is absent,
the nonce differs, the DB cannot be reached, a role/URL is unsafe or
any finance write flag is enabled, the wrapper fails CLOSED without
migrating, seeding or attempting the existing test runner.

This is a safety guard against accidents, not a proof of physical
server identity or protection against malicious administrators.
A deliberately copied marker or a compromised port forwarding setup
could defeat it. The operator must still positively identify the
disposable test container/server before creating the marker.

## 1. Operator-only setup of a *known newly provisioned* test DB

1. Provision or verify the ownership of an EMPTY, throwaway
   PostgreSQL server whose TCP endpoint is bound to loopback port
   `5434`. Database name **must** be `myschoolboard_test`,
   schema `public`, with a nonproduction password/user.
   Inspect the actual container ID or machine and confirm the
   server cannot route to production through SSH, a proxy, or a
   remote TCP forward. **Do not** rely on hostname alone.
2. With a separate operator-controlled terminal, generate a NEW
   unique random nonce: `openssl rand -hex 24`.
   Export it as `PHASE9_TEST_DATABASE_NONCE` only in the
   ephemeral test shell. Never commit or share the nonce.
3. In **psql connected explicitly to that confirmed disposable
   database** (no Prisma `?schema=public` URI query), create
   a marker table and insert the nonce, once:

   ```sql
   CREATE TABLE public.myschoolboard_disposable_verification_marker (
     id TEXT PRIMARY KEY,
     nonce TEXT NOT NULL CHECK (nonce ~ '^[a-f0-9]{32,128}$')
   );
   INSERT INTO public.myschoolboard_disposable_verification_marker(id, nonce)
   VALUES ('phase9-local', '<paste-your-private-random-hex-nonce>');
   ```

   Replace only the nonce placeholder. **DO NOT** run this SQL on
   real/school/production/shared databases, and do not copy a marker
   from another environment. A private nonce is a safety boundary,
   not a production authorization credential.
4. The shell running verification must supply all existing local
   CI variables: `NODE_ENV=test`, `TEST_DATABASE_DISPOSABLE=1`,
   `ALLOW_DEMO_SEED=1`, and EXACT same valid
   `DATABASE_URL=TEST_DATABASE_URL` of the form
   `postgresql://<synthetic-user>:<test-only-password>@localhost:5434/myschoolboard_test?schema=public`.
   Configure `BETTER_AUTH_SECRET` (>=32 chars), local
   `BETTER_AUTH_URL`, synthetic `.test` demo email and
   sufficient fake password as required by the existing runner.
   All seven Phase 9 financial-write flags must be OFF/absent.
   Do not enable any actual bank or provider keys.
5. Ensure `psql` is on PATH. The wrapper passes its sanitized
   PostgreSQL URI as an environment variable, not as an argument
   (which could expose credentials in process listings). It removes
   inherited libpq variables, uses `-X -w` and
   `default_transaction_read_only=on`, and reads only the
   marker nonce. Raw psql errors/credentials/nonces are not logged.

## 2. Safe non-database and authenticated preflight commands

In the isolated Phase 9 feature checkout:

```sh
npm run verify:phase9:static
npm run verify:phase9:preflight
```

`verify:phase9:static` requires Node 22 but NO DB and uses
`node --test` for the existing Phase 9 structural guards plus
mocked nonce/psql safety tests; it does **not** prove Prisma, SQL,
TypeScript, Vitest or payment correctness. The **preflight**
performs one read-only psql attestation: no migrations, npm install,
seeding or data changes.

Only after a positive operator-controlled disposable DB identity
check and a successful preflight should the cumulative command run:

```sh
npm run verify:phase9:local
```

This reattests the DB, then invokes the existing strict
`npm run verify:local` command chain without bypassing gates:
`npm ci`, Prisma generation, migration deploy, synthetic demo seed,
format, lint, TS, full Node/Vitest, Next build, and
`npm audit --audit-level=high`. Any failure blocks Phase 9
acceptance; there is **no** skip/force/ignore-vulnerabilities path.

## 3. Evidence and pass/fail rules

Capture a dated local verification log (redact connection secrets):
Git branch/commit and clean worktree, operator-confirmed DB origin,
psql preflight outcome, final migration state, all invoked checks,
actual test counts, audit findings, and unresolved privacy/
authorization issues. Verify tenant isolation, direct SQL role
spoofing, concurrent monetary caps, immutable audit history,
replay protection, correct rendered balance privacy, and rollback.

A passed static guard alone **does not** accept FEE-REQ-001.
Production release additionally requires independent settlement
reconciliation, actual provider callback controls, genuine receipts,
private file storage, verified guardian relationships, and strict
security/dependency gates. Phase 8 remains independently unaccepted.

## 4. Non-negotiable restrictions

Do not use a production/read-replica database, remote port forward,
shared demo DB, or any DB with genuine school/pupil/bank records.
Do not execute a seed or migration from this chat/runtime.
Do not merge Phase 9 to main, start GitHub Actions, deploy,
issue receipts, refund funds or enable Phase 9 finance writes
based on this verification harness alone.

**Relevant code:** `scripts/verify-phase9-disposable.mjs`,
`scripts/verify-phase9-disposable.test.mjs`,
`scripts/verify-local.mjs`,
`scripts/verify-local.test.mjs`, `package.json`.
