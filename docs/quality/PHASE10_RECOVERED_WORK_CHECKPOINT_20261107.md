# Phase 10 recovered implementation checkpoint — 7 November 2026

COM-REQ-001 / AUD-REQ-001; work packages P10-01 and P10-02, D-023.
Branch: `feature/phase10-school-notices-inapp-notifications-20261106`.
Starting analysis commit: `ed0aae8d4fde1aa16d3e2f163c05bef1ed1030e2`.

This preservation checkpoint saves the existing implementation after executor
attachment failures. It is not a full Phase 10 acceptance or main-merge approval.
No existing work was discarded, databases reset, or migrations rewritten.

Implemented: school-owned immutable notice revisions, administrator/owner
separation and independent review (including administrator-author promotion),
explicit publication/withdrawal, pinned versioned visibility, current verified
recipient predicates, transactional domain-event/outbox capture, fenced/paged
in-app delivery, retry/attempt/dead-letter/replay evidence, read/unread, terminal
suppression, private pages/deep links, accessible inbox pagination and owner retry
controls. No teacher class channel or external provider is enabled. Both new
feature flags default OFF. Source and recipient content is excluded from inbox
text and worker logs. Bounded private JSON parsing caps bytes/time and validates
UTF-8 without trusting Content-Length or waiting indefinitely for cancellation.

Four forward migrations extend the preserved 58-migration baseline to 62:
20261107010000_phase10_school_notices_inapp;
20261107011000_phase10_publication_integrity;
20261107012000_phase10_outbox_replay_controls;
20261107013000_phase10_tenant_cleanup_integrity.
They were applied only to the separately verified disposable Phase 10 database;
applied bytes must remain unchanged. The later migrations preserve role snapshots,
current publication/replay integrity and the existing whole-school cleanup
convention without allowing dangling references at commit.

Recovered execution evidence:

- Full local Node guards: 207 passed.
- Full Vitest suite: 50 files / 437 tests passed, including 15 notice/notification
  scenarios and eight bounded-parser cases. Real BetterAuth sessions and
  PostgreSQL cover visibility, tenant denial, immutable history, atomic rollback,
  concurrent replay/delivery, >100-member paging, mid-page lease expiry,
  dead-letter replay, withdrawal and separate student/guardian revocation.
- TypeScript and formatting passed at the saved snapshot.
- ESLint: zero errors; two test-only unused-variable warnings remain.
- Browser acceptance, production build, final fresh bootstrap/checksum/audit and
  complete Phase 10 acceptance documentation remain to finish/confirm.

The last reviewed work includes the subsequent split inbox component and
operational retry UI. Further verification must use this committed checkpoint,
not infer results from the earlier analysis commit. Private fixtures, cookies,
nonces, encrypted artifacts and raw logs are outside Git. The Phase 11 overlay
and Phase 12 finance-handler changes are not included in this branch.

P10-03–08 (class announcements, resources/assets, learning assignments, broader
source adapters/audit inspection and cumulative portal acceptance) remain
outstanding. Production deployment and merging to main are not authorized by
this checkpoint. Exit gate: preserved and partially verified; not merge-ready.

## Resumed verification after preservation commit

Preservation commit `1afc95805411be0b999558b9ca296ac47640fe8f` is confirmed
published on this phase's remote branch. The original worktree was retained.
Earlier stopped tmpfs servers were not restarted/reset. A new task-owned
PostgreSQL container `5d86ae08e403eb06d16cc5e1719e5b1e55ebf6c8fa855ff0f10fb7642664ce78`
was physically checked (no existing mounts or host DB port), nonce-attested and
bootstrapped from all 62 forward migrations. Initial bootstrap staging encountered
a transient PostgreSQL initialization socket gap; it resumed only after confirming
the same newly created database was empty. No existing data was cleared.

Executed again: 207/207 Node guards, 437/437 Vitest tests in 50 files; ESLint,
TypeScript, formatting, production build and 62/62 exact checksums passed.
Strict full dependency audit passed with zero vulnerabilities. The sandbox's
first audit network call failed EPERM; the authorized same-command retry passed.

Extended tests now cover school and enrollment deactivation as well as class
and membership predicates, and assert recipient workspace responses expose no
management drafts/policies/delivery failures. All 15 notice scenarios passed
again after those changes. Two incorrect initial new fixture assertions failed
(recipient workspace is a legitimate feed; ENDED enrollment requires endedAt);
they were corrected to the documented contracts, without relaxing authorization
or database constraints. Both unused-variable lint warnings are resolved.

Authenticated Phase 10 browser acceptance remains unexecuted. This recovery
checkpoint does not complete P10-01/P10-02 acceptance or P10-03–08, and does not
authorize main integration. Main was remotely confirmed unchanged at
`d4459d827e8529ea8daddb73f7e842d8c47c12ab`.
