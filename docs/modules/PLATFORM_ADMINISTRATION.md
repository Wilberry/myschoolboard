# Platform Administration

## Scope

Platform administration covers the SaaS operator’s responsibilities for tenant lifecycle, subscriptions, global configuration, operational oversight, security, and platform retention policies.

## Key responsibilities

- Onboard or deactivate schools
- Manage plans and entitlements
- View payment and subscription status
- Review operational and security audit events
- Manage platform-level retention and recovery
- Monitor health and usage metrics
- Investigate tenant issues without exposing unnecessary data

## Platform-only onboarding and lifecycle foundation (tested subset)

A platform-super-admin Better Auth session can use `POST /api/platform/schools` to create a school in `PENDING` state with `isActive=false`. A school-administrator membership is **not** auto-invited or created. `POST /api/platform/schools/{schoolId}/lifecycle` accepts a reason plus an allowed next status (`ACTIVE`, `SUSPENDED`, `EXPIRED`, `CLOSED`). The service revalidates platform authority inside a serializable transaction, locks the actor and school rows, changes the lifecycle and legacy access flag together, and appends an event. Closed schools are terminal. Invalid transitions are `409`; unauthenticated `401`, denied/absent `404`, malformed `400`, and unexpected persistence faults `500`. Responses are private/no-store.

Existing schools are **not** assigned a guessed lifecycle history: `lifecycleStatus=null` remains for legacy data; the new transition service refuses to reclassify an unclassified record until a reviewed explicit reconciliation workflow exists. Existing `isActive` access behavior is preserved. The append-only platform event records actor ID, prior/new state, reason and time, with a database validation trigger and no update/delete/truncate rights at the application layer. Physical school deletion and recovery remain a separate, later-phase policy.

The platform lifecycle and authorization implementation has database-backed integration coverage in the locally executed cumulative Phase 1–7 test suite. The latest Phase 3 disposable-DB checkpoint passed all 37 migrations, 117 Node tests, 327 Vitest tests, build, format, lint, TypeScript and both audits at code SHA `e249955e64fafe5887a536074f8547ff25d3584f`. This is tested Phase 3 **subset** evidence, not full onboarding, subscription, support, metrics, retention or browser acceptance.

## Platform operator subscription console — database-tested, browser pending

The `/platform` route uses a React Suspense boundary around a server-side Platform Super Admin check and an actor-row-locked, serializable school read capped at 100 records. The generic prerendered fallback contains no school data; production build passed, but actual HTTP/Flight cache and browser privacy still require verification.
The `PlatformSubscriptionEditor` records immutable plan revisions and
explicit school subscription periods via separately authorized private
GET/POST endpoints. Closed/unclassified schools cannot be selected for
a new period. All forms include explicit labels, reasons and a distinct
message confirming that no payment, school activation or quota permission
changed. A second actor/role check inside each API transaction remains
required irrespective of UI navigation. Historical periods are viewed,
never overwritten. No production rollout or full platform administration
or authenticated-browser acceptance has occurred; see
[Phase 3 acceptance](../quality/PHASE3_SUBSCRIPTIONS_ACCEPTANCE.md).

## Read-only subscription status — database-tested, browser pending

The operator page includes a private exact-school subscription snapshot:
CURRENT/UPCOMING/ENDED/NONE status, active school lifecycle and school-scoped
aggregate pupil/staff counts compared with advisory current-plan ceilings.
No student/staff identities, paid-status inference, quota enforcement or
school access change. Authenticated route/database integration tests passed
as part of the Phase 3 checkpoint at `e249955`; production browser and
accessibility checks remain pending. See the
[Phase 3 browser matrix](../quality/PHASE3_PLATFORM_BROWSER_ACCEPTANCE.md).

## Hard boundaries

- Platform operators do not automatically gain school academic access.
- Platform Trash remains separate from school Trash.
- School users cannot access platform-level recovery or operational audit functions.
