# Phase 10 module-worker recovery and membership insertion

P10-08 partial; COM-REQ-001 / SEC-REQ-001. Base implementation:
`d6ca46262c3f7df46083fe321732e84490b6d9c0`.

## Defect and forward fix

The new 101-recipient fixture exposed a performance defect: inserting each new
membership rescanned every existing school module delivery for revocation. The
30-second scenario and its cleanup hook timed out. No timeout was increased.

Migration `20261108030000_phase10_membership_insert_delivery_scan` removes only
INSERT from the membership suppression trigger. New memberships cannot revoke
existing deliveries: their recipient/teacher/assignment/verified-relationship
references require an already existing membership. Membership UPDATE and DELETE
still perform the full current-authorization scan. All other source suppression
triggers and read-time predicates remain. Applied migration bytes were preserved.

## Synthetic PostgreSQL acceptance

The expanded learning/source suite passes **21 tests**, including the forced real
membership-revocation/delivery lock race and terminal suppression. The new recovery
scenario passed in **6.7 seconds** in its targeted rerun (not a production load SLA):

- 101 additional synthetic eligible owners exercise the 100-membership page bound.
- A fixture-scoped AFTER INSERT trigger raises after delivery insertion. Five
  attempts roll back delivery and cursor together; no partial notification leaks.
- Retry cooldown prevents immediate reprocessing/increment; only that disposable
  fixture's due timestamp advances for subsequent failure attempts.
- Five immutable failure records and DEAD_LETTER state persist.
- Teacher/pupil/parent/foreign replay denies. Concurrent exact owner replay records
  one request; changed reason with the same key conflicts.
- One committed page leaves a cursor; separately invoked concurrent workers resume
  it. All 101 intended members receive exactly one delivery, the revoked pupil
  receives none, and repeated drains do not redeliver.
- Recovery attempt history rejects rewriting. Fault injection is removed in finally.

The independent fresh PostgreSQL 17 tmpfs bootstrap and exact checksum verification
pass all **78 migrations**. Cumulative verification passed **207 Node guards, 494 Vitest tests (54 files),
78 exact applied migration checksums, lint, TypeScript, formatting and production
build**. These results do not imply whole Phase 10 acceptance.

## Remaining gates

Operational lifecycle/subscription boundaries, permission/authentication audit
and notification contracts, cumulative browser/privacy coverage and integration
review remain open. Phase 11 is separate. No main merge, production deployment,
external provider, database reset, migration rewrite, force push or Actions run.

Exit gate: **PARTIAL**.
