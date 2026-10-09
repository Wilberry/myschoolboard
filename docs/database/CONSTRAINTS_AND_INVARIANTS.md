# Constraints and Invariants

## Mandatory invariants

- All tenant-owned records must include tenant_id and satisfy tenant-bound authorization checks.
- A student cannot have duplicate active enrollments in the same class and session.
- Teacher/class/subject combinations must be unique when active.
- Duplicate attendance records for the same class/date/session must be prevented.
- Assessment scores must remain within configured bounds and precision rules.
- Report cards cannot be published without final School Super Admin authorization.
- Historical records must remain versioned and not silently overwritten by current settings.
- Trash retention must respect the 30-day school and 90-day platform windows.
- Parent-child access must be checked within the same tenant.
- Payment evidence must be distinct from verified payment status.

## Database enforcement

Use database constraints, transactions, unique indexes, and audit records wherever a critical invariant depends on integrity. Application validation alone is insufficient for state transitions that must be protected against concurrent requests or direct API misuse.
