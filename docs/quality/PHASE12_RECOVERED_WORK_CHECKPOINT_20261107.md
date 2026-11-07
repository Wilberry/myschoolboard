# Phase 12 recovered quality checkpoint — 7 November 2026

SEC-REQ-001 / OPS-REQ-001; standing mandate D-023.
Branch: `quality/phase12-production-readiness`.
Verified starting main: `d4459d827e8529ea8daddb73f7e842d8c47c12ab`.

This checkpoint preserves reviewed independent quality work after executor
attachment failures. It is not production readiness or approval to merge.
Phase 10 and Phase 11 implementations are not included or assumed accepted.

Implemented improvements:

- Bounded private JSON reader used by 13 existing finance mutation handlers:
  64 KiB actual streamed bytes, 10-second read deadline, strict UTF-8, generic
  errors and nonblocking cancellation. Existing content-type, authorization,
  tenant, idempotency and financial approval contracts remain in their handlers.
- Eight regression cases cover chunking, split UTF-8, exact limits, deceptive
  headers, malformed/empty content, failed/stalled cancellation and stalled
  streams without accepting a valid-looking incomplete prefix.
- Test-only encrypted backup/recovery verifier creates a new empty unexposed
  tmpfs target, rejects wrong-key/tampered AES-256-GCM artifacts, compares
  restored row/schema hashes and checks source data unchanged. It accepts only
  physically verified task-owned disposable servers and never resets/cleans
  an existing DB. Its current end-to-end run FAILED at restored-target
  fingerprinting; recovery is not reported as passed. Preserve that result and
  remediate the verifier/target configuration without weakening integrity tests.

Recovered actual checks:

- Independent fresh baseline SQL bootstrap: 58 accepted migrations.
- Node guards: 207 passed.
- Full application regression: 49 files / 422 tests passed.
- TypeScript, ESLint, formatting and production build passed in the saved logs.
- Exact migration checksum verification and dependency audit passed; audit zero
  vulnerabilities. No migration, dependency or production configuration changed.
- End-to-end encrypted recovery: FAIL at restored-target fingerprint execution;
  no successful full-recovery claim. Private keys/cookies/dumps remain outside Git.

Remaining work includes resolving recovery, completing the full critical-
requirement acceptance matrix, independent security/performance/observability
checks, Phase 10/11 integration contracts, final evidence, and draft PR preparation.
Production hosting/TLS/key management, backup cadence and RPO/RTO, complete earlier
phase acceptance, operations and explicit release authorization remain gates.
No Actions, main merge, force-push, shared DB modification or deployment occurred.

Exit gate: recovered and committed independent improvements; incomplete overall
Phase 12 acceptance and not production-ready.

## Resumed verification and recovery remediation

Preservation commit `938335609cfb0d90d1fc0354679ffcd18995f7dc` is confirmed
published. Old stopped databases were left untouched. A new task-owned tmpfs
PostgreSQL container
`7e27dbbc2d23880be4e7cce3ea4bf06d2a2988259aac86685d24a77e76f563ad`
was independently inspected (no existing mounts or host DB port), nonce-attested
and bootstrapped from 58 migration files. Repeated local results: 207 Node guards,
422 Vitest tests in 49 files, lint, types, format, production build and 58 exact
migration checksums PASS. Strict full dependency audit PASS, zero vulnerabilities,
after the same authorized retry of the sandbox-blocked network call.

The recovery verifier's nonce-check deadlock is fixed: synchronous psql cannot
share the TCP relay's blocked event loop, so the relay now runs in its own thread.
Wrong-key and modified ciphertext rejection and actual restore proceed. The first
retry correctly failed while the full suite was concurrently writing; the second,
quiescent retry still FAILED strict schema equality. All restored table row hashes
match. Diagnostic comparison found 287 function definitions and 326 index definitions
match, and 453 constraints exist on each side; PostgreSQL reparses some CHECK
expressions into equivalent flattened AND / array-cast forms during restore.
The strict hash has NOT been weakened or declared passed. A reliable canonical
constraint/trigger/schema comparison and expanded negative restore tests remain
required. No source database reset or production recovery claim is made. Test
artifacts/keys remain private outside Git; each attempt used a new empty target.

The [acceptance matrix](PHASE12_ACCEPTANCE_MATRIX_20261107.md) covers all 18
catalog requirements, prior-phase evidence limitations, Phase 10/11 integration
contracts and outstanding release gates. Phase 11 `6ae1c1b` remains published,
with its independent slice locally accepted and full DEL-REQ-001 PARTIAL. No Phase
10/11 implementation was imported into this quality branch. Browser/performance,
complete security/operations and integrated acceptance remain outstanding.
