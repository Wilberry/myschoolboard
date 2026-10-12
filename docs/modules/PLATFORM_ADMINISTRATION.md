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

## Platform-only onboarding and lifecycle foundation (draft, unverified)

A platform-super-admin Better Auth session can use `POST /api/platform/schools` to create a school in `PENDING` state with `isActive=false`. A school-administrator membership is **not** auto-invited or created. `POST /api/platform/schools/{schoolId}/lifecycle` accepts a reason plus an allowed next status (`ACTIVE`, `SUSPENDED`, `EXPIRED`, `CLOSED`). The service revalidates platform authority inside a serializable transaction, locks the actor and school rows, changes the lifecycle and legacy access flag together, and appends an event. Closed schools are terminal. Invalid transitions are `409`; unauthenticated `401`, denied/absent `404`, malformed `400`, and unexpected persistence faults `500`. Responses are private/no-store.

Existing schools are **not** assigned a guessed lifecycle history: `lifecycleStatus=null` remains for legacy data; the new transition service refuses to reclassify an unclassified record until a reviewed explicit reconciliation workflow exists. Existing `isActive` access behavior is preserved. The append-only platform event records actor ID, prior/new state, reason and time, with a database validation trigger and no update/delete/truncate rights at the application layer. Physical school deletion and recovery remain a separate, later-phase policy.

The service and HTTP handlers have been authored and corresponding unit/database tests added, but the migration and tests have **not** been executed against the complete local CI-equivalent pipeline. This is Phase 3 partial implementation, not full onboarding/subscription/retention completion.

## Hard boundaries

- Platform operators do not automatically gain school academic access.
- Platform Trash remains separate from school Trash.
- School users cannot access platform-level recovery or operational audit functions.
