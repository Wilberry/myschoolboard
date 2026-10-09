# Secrets and Configuration

## Secret rules

- Secrets must be stored using an approved secret manager or equivalent secure storage.
- Payment provider credentials, email credentials, and signing keys must never be stored in application records.
- Environment-specific configuration must remain isolated by runtime environment.

## Configuration principles

- School and platform settings must be explicit, auditable, and tenant-aware.
- Config changes that affect historical data must be versioned and not silently rewrite history.
