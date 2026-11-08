# Phase 11 independent lifecycle outbox — 8 November 2026

DEL-REQ-001 / AUD-REQ-001 / SEC-REQ-001, D-023. Base:
`6ae1c1b2e590c205d532951334ac55ad640a0772`, already-published Phase 11 branch.
Existing PR: [#112](https://github.com/Wilberry/myschoolboard/pull/112), confirmed
from its Git head ref. The accepted independent draft-trash implementation is
retained, not restarted.
Phase 10 and Phase 12 remain on separate branches; no implementation is imported.

## Implemented independent contract

Migration `20261108034000_phase11_lifecycle_outbox` adds `TrashEventOutbox` and
atomic capture of each new actual `TrashEvent`. The version-1 envelope contains
only immutable event/case/school identifiers, actual recorded actor, action,
source version/time and capture time. It contains no draft body, title, reason,
pupil/guardian data, file pointer or supplied recipient list. Direct invented
inserts, tenant changes, rewrites, deletion and truncation are denied. The existing
explicit whole-school cascade convention is unchanged.

No historical envelope is fabricated or backfilled. Outbox failure rolls back
case state, source concealment and event together; the original source remains
readable, and retry produces exactly one event/envelope. This is durable capture,
not a claim of notification delivery. There is no Phase 10 table/service import,
worker acknowledgment, broad audience or external provider activation.

Unexpected database faults were previously mapped to HTTP 409. Only known
integrity/serialization conflicts now map to conflict; unexpected capture/storage
failures return a generic internal failure without false completion. Exact trusted
origin is required for school and platform trash mutations; missing/null/foreign
origins deny before state change. Private responses also vary by Cookie and use
nosniff. In-product teacher, owner and platform scopes remain unchanged.

## Phase 10 integration contract

The future consumer must register `TrashEventOutbox` schema version 1 explicitly,
resolve the real current lifecycle/source authority and record delivery/idempotency
independently. A lifecycle actor is not an inferred recipient. Guardian/report/fee
visibility grants no trash access. Platform metadata recovery authority never
confers academic-body access. Tenant, case and source version must remain pinned;
expired/held/platform-custody records must preserve their actual current restrictions.
No generic deletion adapter or fake source is registered in Phase 10 before the
real Phase 11 source is integrated and its acceptance checks pass.

## Verification evidence

The new PostgreSQL 17 tmpfs server was independently physically/nonce verified,
with no database host port or pre-existing data mount. Its original 59 migrations
were bootstrapped first; the original seven lifecycle scenarios passed with two
new outbox scenarios intentionally excluded until the new table existed. Retained
synthetic history was hashed before migration. The forward upgrade preserved the
exact event digest and produced zero historical envelopes. Another separately
attested empty PostgreSQL server bootstrapped all 60 migrations using its native
SQL client and the canonical exact-checksum verifier.

The first cumulative run failed: the new runner lacked the required private fee
image directory, and the fault test exposed the incorrect generic conflict mapping.
The private directory and error mapping were corrected; both affected suites
passed all 21 scenarios. The finalized cumulative run passed **207 guards and 423 Vitest tests (49 files)**;
all nine lifecycle scenarios also passed with fresh browser fixtures, including
school/platform cross-origin denial. Exact applied checksums (60), pinned official
Prisma JS/WASM schema/client generation, lint, TypeScript, formatting and production
build passed. A strict-TLS dependency audit reports **zero vulnerabilities**.

**Seven authenticated Chromium workflows passed on the final origin-protected
build**: trash/isolation, native blur/history/print privacy, authorized restoration,
platform recovery/holds, responsive axe/keyboard accessibility, actual terminal
authority revocation and real sign-out. Adjacent JSON records results. It identifies
the base HEAD because these changes were tested in the working tree before commit;
no nonexistent implementation SHA is claimed. Fixtures, PDFs and credentials remain
outside Git. Formatting failures while the new portable harness was being authored
were corrected before the final passing static/build checks. No test,
constraint, privilege check or timeout was weakened.

The browser harness now optionally verifies the explicit task-owned container
identity and runs preflight plus fixture-specific authority revocation inside the
matching runner. It does not connect the host's legacy localhost:5434 database.
Legacy guarded mode remains. New results use a separate path so prior evidence
is preserved. Native displays and databases are separate from Phase 10.

## Remaining gate

This does not authorize physically erasing protected lesson revision/audit history.
At platform expiry, explicit `PURGE_BLOCKED` remains visible for authorized policy
disposition. Full protected-history retention/erasure policy, real Phase 10 delivery
and integration review remain open. Phase 12 production gates remain separate. The Phase 10 authentication/logout
hardening in `71f2ed9dce7b3b0be3e053dcc06f404a8008a951` is not present on this branch;
its reconciliation and negative authentication acceptance are explicit integration
dependencies. Normal successful sign-out is locally verified; Phase 10's injected
authentication-failure coverage is not claimed for this independent baseline.
No database reset, real-record destruction, migration rewrite, Actions, force push,
production deployment or main merge occurred. Whole Phase 11 remains **PARTIAL**.

## Subsequent request-boundary hardening (9 November 2026; not yet locally verified)

The school and platform trash mutation endpoints now reject spoofed JSON media
types and unsupported declared charsets. Both routes use a shared bounded
UTF-8 JSON reader: a maximum of 4,096 actual bytes, validated declared
Content-Length when supplied, and a five-second read deadline. The reader
rejects malformed input without logging private request contents. Regression
cases cover invalid media types, oversized actual/declaration lengths and
an ordinary valid declared length that still reaches source authorization.

The numeric Content-Length expression was corrected in follow-up commit
`ca94371`; the valid-length regression was added in `4ca3528`.
These are **new published code changes, not a fresh passing test result**.
Prior local acceptance evidence above applies only to its documented
earlier checkpoint. Run the affected integration suite and cumulative
disposable-PostgreSQL, static and browser gates before acceptance. PR #112
remains draft; no merge or GitHub Actions were invoked.
