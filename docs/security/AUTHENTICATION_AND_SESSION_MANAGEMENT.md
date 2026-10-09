# Authentication and Session Management

## Requirements

- Authentication must be backed by trusted server-side identity logic.
- Sessions and tokens must be tenant-aware and invalidated on security events.
- Password and recovery flows must follow secure best practices.
- Login and session failures must be rate-limited and logged.

## Important note

No credential or token secret should be stored in application records or audit logs in plaintext.
