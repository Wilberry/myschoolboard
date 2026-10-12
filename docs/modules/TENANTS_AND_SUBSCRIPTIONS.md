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
