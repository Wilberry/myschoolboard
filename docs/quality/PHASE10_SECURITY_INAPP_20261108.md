# Phase 10 account/platform security notifications — 8 November 2026

P10-07 partial; COM-REQ-001 / AUD-REQ-001 / SEC-REQ-001. Base:
`71f2ed9dce7b3b0be3e053dcc06f404a8008a951`. Existing Phase 10 branch / PR #111.

## Implemented

The actual authentication/security outbox now delivers durable in-app alerts.
Known account facts resolve only their current subject account. Unknown identity
failures resolve only current Platform Super Admins through a separate restricted
platform channel. School membership, school-owner status and guardian/report/fee
visibility never grant platform security access. No guessed school/recipient,
password, token, attempted email, session ID, reason or request body enters the
notification projection. Generic local deep links reauthorize at the destination.

`PHASE10_SECURITY_INAPP_ENABLED=false` adds an explicit default-off capability;
the existing authentication and in-app capability gates also apply. New personal
and platform inbox regions keep channel APIs separate, with current authorization,
unread counts, exact read/unread idempotency, bounded pagination and the existing
abort/epoch/focus/history/sign-out/print concealment. Read is not access approval.

Authenticated current platform operators process at most 100 eligible users per
atomic page. SKIP LOCKED, source/recipient uniqueness and committed cursors protect
concurrent workers and crash recovery. Five bounded failures, retry cooldown,
immutable attempt records and reasoned idempotent operator replay are implemented.
Shared user locks protect current role/existence without opposing worker locks.
Actual role revocation/deletion appends terminal suppression; regrant does not
resurrect an old delivery. Source evidence and interaction/attempt history remain
immutable. Unknown historical source types are not treated as broad broadcasts.

Private APIs accept no recipient/user/school selector. Mutation bodies are bounded
to 4 KiB and five seconds, require exact trusted origin and JSON type, and reject
unknown fields. Account and platform read/state routes repeat their own channel
scope; knowing a delivery UUID grants nothing. Responses are private/no-store,
Cookie-varying and nosniff.

The disposable local CLI attests the database before enabling capabilities and
reauthenticates every pass through the actual isolated app. This preserves the
app's production secure-cookie configuration without renaming/bypassing cookies.
Only explicit localhost:3001 or 127.0.0.1:3001 HTTP origins are accepted, redirects
are rejected, and session identity/expiry is validated. No cookie is forwarded to
an external destination. Current platform authority is then rechecked/locked in
PostgreSQL. No anonymous cron, user-ID impersonation flag or external provider.

## Additive schema and actual checks

`20261108040000_phase10_security_inapp` adds queue retry/cursor fields, immutable
private deliveries/interactions/suppressions/attempts, exact recipient validation
and terminal user-revocation hooks. Earlier applied migration bytes are unchanged.
Pinned official Prisma JS/WASM schema/client generation passed. The independent
fresh database received all 83 migrations before any application fixtures and
verified exact checksums; retained forward upgrade also passed without reset.

- Six authenticated PostgreSQL scenarios pass: default-off/role denial; concurrent
  delivery/read deduplication; personal/platform separation and terminal revoke/
  regrant; five after-insert failures with no partial page, cooldown/dead-letter/
  concurrent replay and 101 recipients; personal pagination/foreign cursor and
  spoofed/untrusted/oversized requests; forced actual uncommitted role-revocation
  blocking with zero delivery to the revoked recipient.
- Two worker trust-boundary tests pass: no external credential forwarding and
  denial of mismatched, expired or malformed authoritative session responses.
- Cumulative **207 Node guards, 512 Vitest tests in 57 files, 83 exact migration
  checksums, lint, TypeScript, formatting and production build** passed.

The new malformed-expiry test exposed an invalid-date acceptance bug and it was
fixed before passing. Initial cumulative guards found an accidental numeric
migration-count edit touching the existing 1825-day policy assertion. Read-only
HEAD/migration/policy evidence established the original value; only the erroneous
assertions were restored after review, retaining the exact 83-migration gate and
unchanged five-year SQL policy. No gate, timeout or applied migration was weakened.

Five real authenticated native Chromium workflows passed: actual sign-in and
self/global denial; native tab/history, responsive axe, keyboard and private PDF;
actual separate inbox delivery/deduplication/read/unread/deep links plus real CLI;
current-role revocation concealing both audit and alerts and stopping the still-
signed-in CLI operator; delayed response after cross-tab logout and old-cookie
replay denial. Adjacent results JSON records the actual outcomes. Source setup
uses authenticated browser APIs and actual UI actions; no persisted BFCache
assertion is made. Initial attempts identified two harness issues: the existing read
confirmation was dismissed, and the real production authentication rate limiter
returned 429. The harness now confirms the intended synthetic action and honors
bounded Retry-After delays. Each rerun uses fresh actors; prior records remain.

## Remaining gates

This slice does not close P10-07/P10-08: school operational notification delivery,
remaining permission/credential-change adapters, full cumulative source/browser/
privacy/load acceptance and integration review remain open. Phase 11 is separate;
no fake trash source is activated. Production retention, real scheduler, provider
and release gates remain mandatory. No main merge, deployment, Actions invocation,
force push, database reset or history rewrite occurred.

Exit gate: **PARTIAL**, not whole-phase acceptance.
