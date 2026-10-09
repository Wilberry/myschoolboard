# Audit and Notifications

## Audit log

The platform must maintain auditable records for authentication, permissions, student corrections, enrollment changes, attendance, results, publication, fee status, and trash operations.

## Notification system

- In-app alerts are mandatory.
- Email/SMS/WhatsApp are optional integrations only when explicitly approved.
- Notifications must be tenant-aware, deduplicated, and auditable.

## Logging rules

- Avoid storing plaintext credentials, payment secrets, or tokens.
- Logs must minimize exposure of sensitive data while retaining enough context for investigation.
