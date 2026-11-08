# Audit and Notifications

## Audit log

The platform must maintain auditable records for authentication, permissions, student corrections, enrollment changes, attendance, results, publication, fee status, and trash operations.

Teacher assignment lifecycle changes are recorded in `TeacherClassSubjectAssignmentEvent`, including actor, school, target teacher, assignment, transition, database timestamp, and reason when supplied or required. Create, deactivate, revoke, reactivate, and event insert are one transaction; audit insert failure rolls back the mutation.

PostgreSQL triggers reject ordinary direct event updates, deletes, and truncation; a privileged database owner could disable or drop those triggers. The existing school cascade cleanup can remove a school's events, so the events are not immutable against tenant deletion. No audit event read API is exposed. Any later reader must enforce school scope and permission checks. `createdAt` and `updatedAt` on the assignment itself remain timestamps, not history.

## Notification system

- In-app alerts are mandatory.
- Email/SMS/WhatsApp are optional integrations only when explicitly approved.
- Notifications must be tenant-aware, deduplicated, and auditable.

## Logging rules

- Avoid storing plaintext credentials, payment secrets, or tokens.
- Logs must minimize exposure of sensitive data while retaining enough context for investigation.


## Phase 10 implemented audit readers and account-security boundary

The current school-owner audit index and separate account/platform security readers
are described in the [authentication checkpoint](../quality/PHASE10_AUTHENTICATION_SECURITY_20261108.md).
They supersede the historical no-reader statement for their registered sources.
Unknown authentication failures belong to restricted platform metadata; personal
account evidence is not a school disclosure capability. Security event/outbox
capture is implemented; notification delivery and permission/credential-change
coverage remain open. Whole AUD-REQ-001 and COM-REQ-001 remain partial.
