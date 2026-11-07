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
