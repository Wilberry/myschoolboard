# Phase 10 authentication and account-security evidence — 8 November 2026

P10-07 partial; AUD-REQ-001 / COM-REQ-001 / SEC-REQ-001. Base:
`1e99e24660d3ba9f789f8581aa35f89112772c8a`. Existing Phase 10 branch / draft PR #111.

## Implemented and authorization

Immutable account-security evidence records actual session creation, expiry/owner
changes and deletion transactionally in PostgreSQL, with one durable outbox row.
Session facts have no inferred human actor. Recorded database principal/time are
forced from the database, and direct invented session-source facts are denied.
There is no history backfill. Evidence survives account deletion without cascading
away audit history; retention/disposition remains a production policy gate.

Reviewed BetterAuth hooks record successful email sign-in/sign-up session outcomes,
failed credentials, and authenticated logout intent/outcome. Unknown failures are
restricted platform-security metadata: no guessed school, attempted identity,
password, cookie/token, IP, user agent or request body is copied. Only actual
server-authenticated user and non-bearer session-record IDs are used for known
subjects. HTTP failure capture covers tracked email authentication/logout paths,
including pre-hook failures; direct server API failures use hooks. Async-local
request context prevents duplicate HTTP/direct failure records. Other authentication
providers and credential-change workflows are not claimed covered.

`PHASE10_AUTH_SECURITY_ENABLED=false` controls the new hooks/readers/UI. Session
mutation capture is a database integrity guarantee after migration; it does not
activate providers or public account admission. Ordinary school owners have no
global security authority. `/api/account/security-evidence` derives only the current
account; `/api/platform/security-evidence` locks/rechecks current Platform Super
Admin authority. No supplied user/school selector is accepted. Both return six
minimal projected fields, private/no-store, Cookie-varying, nosniff responses and
bounded 100-row pages. Exact microsecond cursors require authorized row ownership
and matching SELF/PLATFORM scope.

Separate `/account/security` and `/platform/security` screens have discoverable
navigation, human-readable event labels, semantic headings/live status, keyboard
navigation and the existing private abort/epoch/visibility/history/sign-out/print
protections. Account security does not grant school, pupil, financial or platform
academic access. External providers remain disabled. The final strict-TLS dependency audit reports
zero vulnerabilities at all severities.

## Security defects resolved and failure policy

BetterAuth catches session deletion errors and can return logout success while
the original server session remains usable. The new hook confirms actual session
absence and returns an error with immutable failure evidence when deletion failed.
The existing client conceals private content on sign-out intent and reports failure;
it never claims that failed revocation succeeded.

Mandatory audit failure fails the authentication response. Newly created sessions
are compensated where possible; no new cookie is returned on any failed HTTP
response. Session/outbox capture failure rolls back the actual session mutation.
Successful canonical session deletion has immutable database evidence even if a
later semantic audit fails. No sensitive raw adapter error is printed: application
and library diagnostics contain fixed categories. The router's raw-error fallback
is intercepted, without disabling error signals or the security gate.

## Forward migrations

- `20261108032000_phase10_authentication_evidence`: minimal immutable evidence,
  durable outbox, transactional actual Session capture; no token schema changes.
- `20261108033000_phase10_security_evidence_provenance`: actual database stamps,
  source-only session facts and durable-outbox delete/truncate protection.

- `20261108035000_phase10_security_event_shapes`: prevents relabelling invented
  session facts with an application method and requires actual actors/session
  references for successful authentication and logout semantics.

Migrations 80/81 were already applied when event-shape hardening was added;
migration 82 is forward-only. All prior applied bytes remain unchanged. Pinned official Prisma
JS/WASM validation/client generation passed. Independent fresh PostgreSQL 17 tmpfs
bootstrap through 81 plus forward 82 before any application fixtures, and exact
checksums passed **82 migrations**, as did retained forward
upgrades. Standard Rust CLI download remains a separate restricted-network check.

## Executed acceptance

- **207 Node guards; 504 Vitest tests in 55 files**, including eight real authenticated
  security scenarios, passed. Tests cover success/unknown failure and deduplication,
  own/global scope denial, actual still-authenticated role revocation, logout
  deletion failure, audit/outbox rollback, safe error logs, immutable evidence,
  cookie withholding/session compensation and >100-event exact cursor pagination.
- Lint, TypeScript, formatting and production build passed after finalized UI and
  navigation changes. New pages use Suspense around authenticated server reads.
- **Four real authenticated native Chromium workflows passed**: actual sign-in UI
  and self/global privacy; native hidden tab plus Back/Forward, 375/768/1280 axe A/AA,
  deterministic keyboard traversal and concealed PDF printing; platform audit UI
  and actual current-role revocation; delayed private 200 response after cross-tab
  actual logout plus replay of the original cookie denied. Adjacent results JSON
  contains outcomes, without fixtures, cookies or private artifacts.

The first logout fault test exposed incorrect before-hook context nesting, fixed
before the passing reruns. Fault tests exposed the raw router error fallback,
which was intercepted and asserted free of private adapter details. The initial
Chromium keyboard assertion incorrectly assumed focus after an arbitrary Tab;
it now verifies traversal from the known home link to Sign out. No security
assertion, database constraint or timeout was weakened.

The workspace filled during fresh-runner creation. Three confirmed idle Node
relay containers were removed; PostgreSQL containers, tmpfs databases, fixtures,
evidence and worktrees were preserved. The already-created empty fresh database
was nonce-reverified and its missing runner completed, without reset/replacement.

## Remaining acceptance

The immutable security outbox remains pending; no delivery is falsely marked done.
Security notification delivery, membership/ScopeGrant/credential-change audit and
adapters, school operational notifications and remaining cumulative P10-08 gates
are still open. Phase 11 sources remain separate until integration. No production
readiness, main merge, deployment, Actions, force push, database reset, applied
migration rewrite or external messaging is claimed.

Exit gate: **PARTIAL**, not whole-phase acceptance.
