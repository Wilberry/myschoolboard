# Tenants and Subscriptions

## Tenant lifecycle states

- Pending
- Active
- Suspended
- Expired
- Closed

## Lifecycle implementation default (2026-10-12)

Platform-managed lifecycle is explicit: a newly onboarded tenant begins Pending/inaccessible; a Platform Super Admin may activate it, then suspend, expire, close, or reactivate (except after Closed), giving a reason for each transition. Every transition updates the existing school access barrier in the same serializable transaction and records an append-only lifecycle event. Legacy schools with unknown status remain unclassified rather than receiving an invented history. No automatic subscription expiration, payment processing, billing, data deletion, or staff invitation is enabled by this foundation. Suspended/expired schools are denied normal academic access pending an explicitly designed restricted account-management/export policy; their data is not silently deleted. Closed is terminal, not a physical DELETE.

## Subscription requirements

- A tenant must have one active plan or an approved lifecycle state.
- Subscription status must be visible to platform administrators.
- Expiration and overdue actions must be auditable.

## Unresolved policies

- Whether suspended or expired tenants retain read-only access
- Whether exports or backups remain available while suspended
- Whether closed tenants can be retained for recovery or legal hold

These remain explicit approval items before implementation.

## Phase 3 immutable plan catalog and subscription periods (2026-10-31)

**Status: SOURCE AUTHORED, NOT LOCALLY EXECUTED. SUB-REQ-001 remains PARTIAL.**
This additive candidate extends the existing school lifecycle with separate
**platform-only configuration**, not automatic feature access or billing.

- `PlatformPlanRevision` is a global, append-only record keyed by plan
  `code` and database-assigned `version`; each revision carries a
  bounded title, explicit feature set (ATTENDANCE, LESSONS, ASSESSMENTS,
  CBT), nullable advisory student/staff limits, operator, reason and time.
  PostgreSQL serializes per-code versions and independently validates the
  current Platform Super Admin on INSERT. Previous plan revisions cannot
  be edited, deleted or truncated.
- `SchoolSubscriptionPeriod` attaches one exact immutable plan revision
  to one school for a half-open UTC interval `[startsAt, endsAt)`. PostgreSQL
  serializes school writes, rejects overlapping periods even for different
  plan revisions, and checks actor, tenant lifecycle and plan existence.
  An additional PostgreSQL GiST exclusion constraint (using the existing
  `btree_gist` extension) enforces non-overlap even if someone attempts
  direct multi-row SQL inserts or a concurrent transaction bypasses HTTP.
  Adjacent periods are allowed. Each record preserves actor, reason and
  timestamp and cannot be directly edited or deleted.
- School subscriptions are not inferred for historical schools and not
  automatically backfilled. The school must have an explicit classified,
  non-CLOSED lifecycle state for a new assignment; PENDING schools may
  be scheduled without becoming accessible. Unknown-lifecycle legacy
  schools fail closed.
- `GET/POST /api/platform/plans` lists at most 100 catalog revisions or
  appends a new version. `GET/POST
  /api/platform/schools/{schoolId}/subscriptions` returns at most 100
  stored periods with server-derived UPCOMING/CURRENT/ENDED labels or
  appends a non-overlapping operator-approved period. All routes require
  a real authenticated, current Platform Super Admin; read/write role
  revalidation is inside a serializable transaction. Responses are
  private/no-store with generic 401/404/400/409/500 errors.
- Existing school privileges remain unchanged. **Catalog features and
  numeric quotas are not enforced by business APIs yet.** A stored CURRENT
  period is not a payment receipt, proof of paid status or automatic
  permission to view another school's records. No auto-expiry suspension,
  invoicing, plan price/currency, external gateway, refunds, fee ledger,
  email or support impersonation is enabled.

**Verification to perform:** additive migration #37 in *only* the verified
disposable PostgreSQL test target, exact checksums, plan/period route
integration tests (including concurrent overlap and direct SQL immutability),
full source guards and Node/Vitest suite, Prisma client generation, format,
lint, typecheck, production build and both npm security audits. Existing
36/36 migration evidence on older SHAs remains valid historical evidence,
but does not validate this new schema. Do not apply the migration to a
shared, live or production database. An independent entitlement-enforcement,
renewal/expiry, school visibility and payment/finance policy decision remains
necessary before claiming a fully functioning subscription service.
