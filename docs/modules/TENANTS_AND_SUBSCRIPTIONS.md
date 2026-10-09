# Tenants and Subscriptions

## Tenant lifecycle states

- Pending
- Active
- Suspended
- Expired
- Closed

## Subscription requirements

- A tenant must have one active plan or an approved lifecycle state.
- Subscription status must be visible to platform administrators.
- Expiration and overdue actions must be auditable.

## Unresolved policies

- Whether suspended or expired tenants retain read-only access
- Whether exports or backups remain available while suspended
- Whether closed tenants can be retained for recovery or legal hold

These remain explicit approval items before implementation.
