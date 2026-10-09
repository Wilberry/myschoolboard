# Error Handling and Logging

## Requirements

- Fail closed for authorization and tenant-scoping issues.
- Avoid exposing stack traces or sensitive data in user-facing errors.
- Log operational, audit, and security-relevant events with minimal sensitive payloads.
- Ensure retries and asynchronous jobs are safe to repeat.

## Operational principle

Errors should inform operators and developers without disclosing sensitive records or credentials.
