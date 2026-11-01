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

## Platform console and verification boundary

The nonproduction `/platform` console provides an operator-only way to
record plan revisions and assign time-limited subscription records. Only
authenticated current Platform Super Admins can read the school-name/status
selector or write through the independently protected private/no-store APIs.
The page isolates request-specific authentication and its single serialized,
actor-row-locked school projection behind a React Suspense boundary. Its
prerendered shell contains only a generic access-check fallback, never school
data. The home page shows its link only to a current platform operator. All
results are bounded; the console does not yet provide cursor pagination for
large deployments.

All plan features and numeric limits remain **catalog metadata**; the forms
do not activate a school or enforce product entitlement. No auto-renewal or
real-money integration is added. The migration-specific read-only preflight
requires 36 exact applied checksums and only the reviewed 37th migration
pending on the verified disposable test container, or the separate strict
empty-bootstrap preflight for a genuinely empty tmpfs database. Migration
#37 has been applied and checksum-verified on the disposable PostgreSQL 17
target; complete automated gates and remaining browser/policy gaps are
recorded in the [acceptance ledger](../quality/PHASE1_7_CUMULATIVE_ACCEPTANCE_LEDGER.md).
See the
[Phase 3 acceptance runbook](../quality/PHASE3_SUBSCRIPTIONS_ACCEPTANCE.md)
for the exact tests and deployment restrictions. No production-browser pass
is claimed for this code.

## Platform-only subscription observation — automated gates passed

A current Platform Super Admin may inspect the private, no-store
`GET /api/platform/schools/{schoolId}/subscription-status`. The reader
projects school lifecycle separately from CURRENT/UPCOMING/ENDED/NONE
subscription status, with aggregate actively enrolled pupil/active staff
counts. Current-plan quotas are advisory only; null means unspecified,
not paid. No individual pupil or staff data is returned. The console labels
billing NOT_TRACKED and entitlement enforcement NOT_ENABLED; a CURRENT
subscription never reactivates a suspended school. Migration and automated
database tests passed on the disposable PostgreSQL target; production-browser
and full UI/accessibility acceptance remain open. See the acceptance ledger.

## Phase 3 immutable plan catalog and subscription periods (2026-10-31)

**Status: DATABASE AND AUTOMATED TEST GATES PASSED; SUB-REQ-001 remains PARTIAL.**
At the tested code SHA recorded in the acceptance ledger, migration #37,
37/37 exact migration checksums, focused DB tests, full Node/Vitest, static
checks, production build and both npm audits passed. This additive
implementation extends the existing school lifecycle with separate
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

**Remaining acceptance:** production-browser, route/cache and accessibility
checks; entitlement-enforcement, renewal/expiry, school visibility and
payment/finance policy decisions. These gates do not authorize deployment to
a shared, live or production database. Do not claim a fully functioning
subscription service until the remaining implementation and acceptance gaps
are resolved.
