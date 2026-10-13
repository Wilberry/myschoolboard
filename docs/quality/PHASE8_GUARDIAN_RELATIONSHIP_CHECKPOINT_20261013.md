# Phase 8 guardian ↔ pupil relationship evidence — no recipient access

**Date:** 2026-10-13. **Branch:** `feature/phase8-owner-private-grade-preview`, cumulative on unmerged Phase 6–8 draft #74 and previous confidential owner-preview commits. **Requirements:** RES-REQ-001, ADM-REQ-001, TEN-REQ-001, SEC-REQ-001 (partial). **Exit:** BLOCKED.

## Implemented/authored

- `GuardianStudentLink` and `GuardianStudentLinkRevocation` Prisma models, with composite exact school-pupil, school-parent membership, school-actor FK, unique attested pupil/guardian pair, immutable historical rows and terminal revoke record.
- **Additive** `prisma/migrations/20261013180000_phase8_guardian_student_link_evidence/migration.sql`; INSERT SQL locks the active school, verifies exact currently active admin actor membership and user ID, existing active same-school `PARENT` membership distinct from attestor, existing ENROLLED child with ACTIVE enrollment, trusted UTC timestamp. Revocation INSERT rechecks active school/admin and existing not-previously-revoked link; SQL forbids UPDATE/DELETE/TRUNCATE histories.
- Strict reasoned attestation `identityVerified: true` (no automatic matching or backfill), School Admin/Super Admin no-store metadata-only link list, terminal revocation and no-report status markers. No guardian-facing path, no report-grade field, no publication, download, export or parent acknowledgment.
- Authored authenticated database integration scenarios for anonymous and wrong-role/foreign-school rejection, identity confirmation, wrong member/child and registered-only child, duplicate pair, independently forged SQL actor, unauthorized and duplicate revocation, immutable mutation rejection, minimal response projection and no-store headers.
- New registered `scripts/phase8-guardian-link-guard.test.mjs` retained in `npm test` and `verify:local:guards` without removing earlier tests.
- Previous private grade preview now uses immutable **source-packet identity** rather than mutable current pupil names/admission IDs; test authored for post-freeze pupil name correction and nonchanged historical view. The raw source packet is never an API response.

## Actually executed

- GitHub connector source commit writes and re-fetches confirmed. New isolated V8 source-guard replay **3/3 checks passed** against fetched updated schema, migration, service, routes and integration source. This was **not** installed Node `--test`, Vitest, SQL, Prisma validation or CI.
- Local `git ls-remote` still cannot resolve github.com from this tool environment; PostgreSQL executables/disposable server unavailable. No school data, real guardian credentials or production data accessed.
- **No GitHub Actions workflows were triggered, rerun or modified**; no pull request opened and no merge/deployment.

## Acceptance gates not met

1. On a confirmed disposable loopback-only PostgreSQL DB, inspect `_prisma_migrations` and checksum history before any Phase 6–8 draft migration. If an earlier draft migration was already applied with a different checksum, stop; do not reset or silently rewrite history.
2. Run `npm ci`, `prisma validate`, generate, ordered migrate deploy and full synthetic Postgres tenant/auth/revocation/SQL actor tampering tests, concurrency and rollback (including guardian link and frozen preview identity). Run Node/Vitest/format/lint/typecheck/Next build/browser and `npm audit --audit-level=high` without weakening original gates.
3. Review access governance: P-004 parent-first acknowledgment and unenumerated four report-card visibility values remain unresolved in the canonical configuration catalog. No guardian report route or release ledger may treat link evidence as sufficient permission. A future reader requires **all** current active membership, child enrollment, unrevoked same-school guardian relationship, separately owner-published immutable composition and school-approved policy for that exact child and academic period.
4. No sensitive data deployment, report release, live access or merge until original Phase 6–8 and Phase 12 exit criteria are met.

**Status: implementation candidate only / security and delivery exit BLOCKED.**
