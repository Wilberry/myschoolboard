# Phase 10 subscription-boundary observations — 8 November 2026

P10-07 partial; COM-REQ-001 / AUD-REQ-001 / SEC-REQ-001. Based on
`defda20`; existing Phase 10 branch and draft PR #111.

## Implemented

An authenticated current Platform Super Admin can scan at most 100 due persisted
subscription periods per transaction. Database time determines expiry; browser
clocks and supplied tenant/recipient/actor lists are not accepted. Row locks,
SKIP LOCKED and a unique (school, period, kind) identity make concurrent scans and
restarts idempotent. Each observation stores the actual period end separately
from the database observation time and actual authenticated operator. Immutable
source envelope and durable outbox capture occur in the same transaction. No
subscription entitlement, billing, activation, suspension or academic state changes.

The capability defaults off (`PHASE10_SUBSCRIPTION_BOUNDARIES_ENABLED`). The local
`run-phase10-boundary-worker.ts --once|--watch` first verifies the disposable
database nonce, enables this capability only in its process, reauthenticates the
private operator session each pass and stops on authorization/failure. No anonymous
cron, external provider or production scheduler is activated.

`/api/platform/notification-boundaries` POST derives the current operator and
accepts only an empty bounded JSON object with exact trusted origin. GET requires
an explicit school ID, limits evidence to lifecycle/boundary metadata, and uses
bounded keyset pagination over the existing school/time index. Every operation
rechecks and locks current platform authority. Ordinary school administrators,
School Super Admins and recipients receive no platform authority. Responses are
private/no-store, cookie-varying and nosniff; no pupil/academic/financial body,
plan detail, reason, session token or cookie appears in the evidence projection.

## Additive schema

`20261108031000_phase10_subscription_boundaries` adds the boundary ledger, global
period-due index, actual-platform/period/time validation, immutability and source
capture. The immutable school source registry now contains 39 source tables.
Earlier applied SQL is unchanged. Prisma schema/client were validated/generated
with the pinned official JS/WASM workflow; standard binary downloads remain a
separate network constraint. The retained test database upgraded forward and an
independent fresh PostgreSQL 17 tmpfs instance bootstrapped/checksummed all 79
migrations.

## Acceptance and limitations

The first targeted subscription suite passed 11 scenarios, including real database
clock expiry, concurrent deduplication, future-boundary rejection, immutable
history, exact source/outbox capture, suspended-school isolation, private metadata
projection and current platform-role revocation. The cumulative run passed **207 Node guards, 496 Vitest tests in 54 files,
79 exact applied checksums, lint, TypeScript, formatting and production build**.
It includes transactional outbox-failure recovery and bounded body/authorization
assertions. The strict-TLS dependency audit reports **zero vulnerabilities** at
all severities.

The actual CLI also passed first observation, duplicate pass and a still-signed-in
operator's platform-role revocation. Reproduce using
`npm run verify:phase10:boundary-worker` only with the independently attested
disposable environment. Its new synthetic operator and school are cleaned up;
immutable synthetic catalog history is retained. Initial private helper attempts
failed before worker execution due to ES-module handling and a synthetic plan
that violated existing code-length/feature constraints. The helper was corrected;
no database constraint or mandatory gate was weakened.

Boundary source delivery remains pending rather than pretending a school alert
was delivered. A separate inactive-school owner operational inbox is not yet
implemented; ordinary active-school academic/financial guards remain unchanged.
This follows the analysis's safe interim platform-evidence contract. No school
owner or platform academic override is introduced. The operator API/worker do not
constitute browser acceptance of an operational UI. Permission/authentication
security coverage and the remaining P10-07/P10-08 gates remain open.

Exit gate: **PARTIAL**, not ready for main integration. No main merge, Actions,
production deployment, real provider, database reset, migration rewrite or force
push occurred.
