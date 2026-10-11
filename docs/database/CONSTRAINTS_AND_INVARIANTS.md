# Constraints and Invariants

## Mandatory invariants

- All tenant-owned records must include tenant_id and satisfy tenant-bound authorization checks.
- A student cannot have duplicate active enrollments in the same class and session.
- One persisted teacher assignment row represents one exact school, membership, class, and subject tuple; the tuple is unique across all statuses. Status changes reuse that row.
- Duplicate attendance records for the same class/date/session must be prevented.
- Assessment scores must remain within configured bounds and precision rules.
- Report cards cannot be published without final School Super Admin authorization.
- Historical records must remain versioned and not silently overwritten by current settings.
- Trash retention must respect the 30-day school and 90-day platform windows.
- Parent-child access must be checked within the same tenant.
- Payment evidence must be distinct from verified payment status.
- Assignment composite foreign keys must bind the membership, class, and subject to the assignment's school.
- Referenced memberships, classes, and subjects cannot be physically deleted while assignments refer to them; ordinary lifecycle changes deactivate or transition status.
- School deletion retains the existing tenant cascade convention and removes school-owned assignment data as part of tenant cleanup.
- Active class and subject names are unique per school by `lower(btrim(name))`; case and surrounding ASCII spaces are normalized, internal whitespace is significant, and inactive records do not reserve names.
- Every successful assignment lifecycle transition has an actor-level event in the same transaction as the assignment mutation.
- Assignment audit events reference the exact school, assignment, and target teacher membership through a composite foreign key. An insert trigger validates that the actor membership belongs to the recorded school and actor user.
- Actor user and membership IDs are immutable historical snapshots without foreign keys; later user or membership deletion does not rewrite an event. School deletion still cascades away school-owned assignment history under the existing tenant cleanup policy.
- Audit triggers reject ordinary updates, deletes, and truncation in PostgreSQL. Privileged database owners can disable them or alter constraints. No audit reader is exposed by this service.

## Database enforcement

Use database constraints, transactions, unique indexes, and audit records wherever a critical invariant depends on integrity. Application validation alone is insufficient for state transitions that must be protected against concurrent requests or direct API misuse.
