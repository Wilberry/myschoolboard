# Constraints and Invariants

## Database submission-event exact roster guard (unexecuted)

Additive migration `20261012200000_attendance_complete_roster_guard` strengthens direct SQL writes: to commit a `SUBMITTED` attendance event, entries must match **all** currently active `StudentEnrollment` + `ENROLLED` students for that exact school/session/class, not merely contain one valid student. Every entry must still be backed by active, same-class/session enrollment whose startedAt is not after the attendance date. The event refuses zero or over-500 marks, acquires a school lock, and rejects mismatches using SQLSTATE 23514; no original immutable table is modified. This is in addition to, not a replacement for, exact composite FKs, the per-entry insertion validator, the active owning PRIMARY Form Teacher event validator, the deferred register event constraint, and existing complete roster API checks. Transactional enrollment races and direct SQL writer edge cases remain part of the disposable-PostgreSQL acceptance gate. **Designed and authored, not executed.**


## Correction history invariants (authored; DB verification outstanding)

- `AttendanceCorrectionRequest` references one exact school/register/entry tuple and snapshots the actor, reason, expectedMark, proposedMark and sequential revision; `AttendanceCorrectionDecision` references that exact school/register/request tuple with reasoned separate reviewer identity and approval/return.
- On request INSERT, PostgreSQL locks the immutable original entry and independently verifies current PRIMARY Form Teacher school/class/session authority, APPROVED register, ACTIVE session/class/section and latest effective mark. No overlapping pending revisions or stale expected/proposed marks are allowed, including direct SQL attempts. Sequential `revision` and one decision per request are unique.
- On decision INSERT, SQL validates the reviewer is an active, independent HM in the stored class's PRIMARY section or Principal in the SECONDARY section, holding an exact currently verified SECTION grant. No teacher, support, foreign membership or School/Platform Super Admin override.
- Both ledger tables reject direct UPDATE, DELETE and TRUNCATE while preserving the existing explicit school-deletion cascade convention. Original `AttendanceEntry.mark` and `AttendanceEvent` are never overwritten.
- For authorized effective-mark readers, only the **highest-revision APPROVED** request's proposedMark supersedes the original; RETURNED/PENDING requests never alter effective attendance. No general correction GET exists yet. Migration/trigger proof and destructive-event/cascade tests remain **unexecuted**.


## Attendance ledger invariants (proposed migration, not verified)

- One `AttendanceRegister` per school/session/class/calendar date; duplicate concurrent submits are forbidden by a DB unique index, not merely request checking.
- The register's original school/session/class/date and PRIMARY Form Teacher responsibility are never rewritten; register status can change only once from SUBMITTED to APPROVED or RETURNED.
- Each `AttendanceEntry` points to the same exact school/student/enrollment/class/session tuple, enforced through composite FKs. Entry and audit event rows are append-only; PostgreSQL validation additionally requires ACTIVE exact enrollment, school, class and section at initial insert.
- A deferred database constraint trigger requires a valid SUBMITTED event and marks on new registers, and a matching immutable APPROVED/RETURNED event for each decision. Audit event insertion independently validates the stored PRIMARY Form Teacher author or the exact HM/Principal verified active section.
- Approval does not modify any mark or publish pupil records. Corrections require a future separately audited revision model; direct SQL edits/deletes/truncation are refused outside the existing explicit school-removal cascade convention.
- Submission rejects partial active rosters and uses UTC calendar-day as a conservative nonfuture gate pending a school timezone setting. No historic enrollment or attendance has been backfilled. These invariants and triggers are **authored but not executed or independently validated**.


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
