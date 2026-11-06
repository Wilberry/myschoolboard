# Constraints and Invariants

## Phase 9 append-only internal fee waivers (AUTHORED; SQL NOT VERIFIED)

- One FeeWaiverApplication must reference an exact school-owned
  FeeObligation, original `kind=WAIVER` FeeAdjustmentProposal
  and independent terminal `action=APPROVED`
  FeeAdjustmentDecision. Only an active same-school School
  Super Admin other than the original School Administrator
  proposer can apply; PostgreSQL copies exact source money
  and stamps time, unique school/proposal, school/decision and
  request UUID. SQL forbids history mutations.
- School-row-locked SQL guarantees
  `sum(applied waiver minor units)+
  sum(independently VERIFIED reference claims)<=
  original immutable obligation minor units`. All VERIFIED
  claims are counted, even those with reversed preview
  allocations; no implicit refunded funds. Companion
  INSERT guards on future payment VERIFICATION and manual
  ALLOCATION enforce the adjusted charge after a waiver.
  Every amount remains PostgreSQL BIGINT/NUMERIC until HTTP
  serializes exact decimal strings.
- CORRECTION_PROPOSAL and REJECTED or undecided waiver proposals
  are not effective adjustments. An approved proposal stays
  advisory until an explicit once-only waiver application;
  no PATCH/DELETE/receipt/refund or external settlement.
- Only privileged current school owner reads the derived
  adjustment balance preview. No student/guardian/teacher/other
  school data access, and all writes are default OFF.
  Actual disposable Postgres concurrency, direct SQL bypass,
  membership revocation and migration tests remain BLOCKED.


## Phase 9 manual allocation reversal (AUTHORED / NOT VERIFIED)

- Only an active same-school School Administrator can append one
  `ManualAllocationReversalRequest` for an existing allocation;
  amount/currency are copied from exact original under School row
  lock. School/requestKey and school/allocation uniqueness make
  replay and concurrent duplicate correction safe.
- One independently current same-school School Super Admin can
  append a one-time APPROVED or REJECTED
  `ManualAllocationReversalDecision`, with exact requester and
  original amount/currency revalidation inside SQL. Both tables
  reject UPDATE, DELETE and TRUNCATE; originals are unchanged.
- Only APPROVED offsets the FULL original allocation in owner-only
  numeric-string preview. Gross allocation, approved reversed sum,
  net active allocation and preview remainder are separate; a
  reversed verified claim cannot be allocated again. REJECTED
  preserves the original allocation. Both outcomes are human
  corrections, not actual bank refunds, cash movements, receipts
  or official student balances.
- One request per allocation is deliberately final, including if
  rejected. A future audited versioning policy is needed for
  repeated or partial corrections. Runtime migration, concurrency
  and financial security gates are NOT EXECUTED.


## Phase 9 manually verified claim allocation (AUTHORED, NOT VERIFIED)

- A submitted manual bank reference is distinct from a VERIFIED
  reviewer attestation, and both are distinct from a newly allocated
  **internal preview credit**. No bank-confirmed settlement, official
  balance, paid student status, receipt, refund or reversal is implied.
- Every `ManualPaymentAllocation` references the same original school,
  obligation, bank-reference evidence and one independently VERIFIED
  payment-review decision through tenant composite foreign keys.
  PostgreSQL holds the school's row lock and checks the actual active
  School Super Admin allocator, distinct original School Administrator
  evidence submitter, matching decision/reference, original debt and
  currency, and SUM(previous allocations)+exact source claim amount
  <= immutable charge.
- A UNIQUE school/evidence and school/verification relation prohibits
  repeated manual credit from the same reference under concurrent
  writes. UUID request keys are unique per school and exact retries
  require the original member, verification and reason. SQL stamps time
  and copies amount/currency from trusted immutable evidence. INSERT
  results cannot be UPDATEd, DELETEd or TRUNCATEd under ordinary writes.
- Owner-only bounded final SQL projection of original obligation amount,
  manually verified claim sum, allocated sum, unallocated reviewed sum
  and arithmetic remainder uses PostgreSQL NUMERIC and decimal strings;
  it is never an official published bank-cleared financial balance.
  Tenant-specific reviewer and read revocation tests plus duplicate
  concurrent SQL writes remain UNEXECUTED.


## Versioned attendance calendar and policy bounds (authored, unverified)

- Each `SchoolAttendancePolicyRevision` row has an exact school and actor membership composite FK, a positive sequential per-school revision, IANA timezone, submissionBackdateDays 0–30, correctionWindowDays 0–365, reason and immutable actor/time history; POST and SQL trigger require active same-school School Administrator / School Super Admin and a valid timezone.
- With no row, policy is `Etc/UTC, 7, 30`. SQL uses `CURRENT_TIMESTAMP AT TIME ZONE` to compute school-local calendar date and limits SUBMITTED events and new correction requests. School row locks serialize policy updates and attendance-write guards; original UTC upper bound remains, so later local days ahead of UTC cannot enlarge permission.
- No update/delete/truncate of policy rows except existing explicit tenant deletion cascade convention. Prior AttendanceEntry and AttendanceEvent immutable audit, exact full-roster guard, section-scoped review and correction version ledger remain unchanged.
- School holidays and local calendar exceptions, retrospective correction after CLOSED session and migration/runtime/lock tests are pending. **No DB migration or test executed yet.**


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
