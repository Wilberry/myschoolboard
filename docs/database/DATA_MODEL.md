# Data Model

## Logical domains

### Platform and tenancy

- PlatformUser
- Tenant
- TenantSetting
- SubscriptionPlan
- TenantSubscription
- BillingRecord
- TenantStatusEvent
- PlatformAuditEvent
- PlatformTrashRecord

### Identity and authorization

- UserAccount
- UserProfile
- Role
- Permission
- RolePermission
- UserRoleAssignment
- ScopeRestriction
- GuardianRelationship
- StudentAccountLink
- StaffProfile

### Academic structure

- AcademicSession
- AcademicTerm
- Section
- SchoolClass
- Subject
- ClassSubject
- TeacherClassSubjectAssignment
- FormTeacherAssignment
- StudentEnrollment
- SchoolCalendarEvent
- TimetableEntry

### Academic operations

- SchemeOfWork
- LessonNote
- LessonNoteRevision
- AssessmentDefinition
- QuestionBank
- Question
- CBTAttempt
- AssessmentScore
- ResultSheet
- ResultSheetRow
- GradingConfiguration
- ReportCardSnapshot
- ReportPublicationEvent
- QRVerificationToken
- ParentReportView

### Implemented academic foundation

- `SchoolClass` and `Subject` are school-owned records with active flags and timestamps. Active names are unique per school using PostgreSQL `lower(btrim(name))`: case-insensitive with surrounding ASCII spaces removed; internal whitespace remains significant. Inactive records do not reserve a name. No code, section, stream, grade, academic year, or term field is defined.
- `TeacherClassSubjectAssignment` represents one exact school, membership, class, and subject tuple. Its status is `ACTIVE`, `INACTIVE`, or `REVOKED`; transitions update the existing row.
- Composite foreign keys enforce that the membership, class, and subject belong to the assignment's school. The exact tuple is unique regardless of status.
- `ScopeGrant` remains a general-purpose independent scope record. Existing grants are not backfilled or treated as teacher assignments.
- The principal resolver and policy helper use active exact assignment pairs for teacher academic read, edit, and submit checks. No protected academic routes currently use this path, so end-to-end runtime enforcement remains outstanding.
- `TeacherClassSubjectAssignmentEvent` records each successful create, deactivate, revoke, and reactivate with school, actor user/membership, target teacher membership, assignment, status transition, optional reason, and database timestamp. PostgreSQL triggers block ordinary event update/delete/truncate; privileged database owners can bypass them, and school-level cascade cleanup removes the tenant's event rows.
- No audit-event read interface is exposed. Later consumers must authorize by school and must not expose event contents to unauthorized callers.
- The internal assignment service derives identity from the Better Auth session and requires `school:configure` permission. It revalidates the actor inside a serializable transaction and writes assignment changes and events atomically.
- Assignment timestamps are operational fields; the event table is the actor-level history. No protected academic routes currently use the helper, so end-to-end academic enforcement remains outstanding.

### Attendance

- AttendanceSession
- StudentAttendanceRecord
- AttendanceSubmission
- AttendanceApprovalEvent

### Finance

- FeeCategory — authored, immutable school label/code; Phase 9 not verified
- FeeStructureRevision — authored, immutable tenant/period/scope/version/
  exact money policy; **configuration only**, not a pupil debt or payment
- FeeStructure — logical grouping of later effective structures (not a
  separate physical table in the initial Phase 9 foundation)
- FeeObligation — **authored; unverified** immutable explicit per-student/category/
  session/term charge referencing one school-owned current fee-structure revision
  and exact ACTIVE pupil enrollment; trusted SQL snapshots minor-unit amount,
  currency and academic identity with school-bound authorization. No payments
  or verified balances are implied.
- PaymentEvidence — **authored/unverified:** immutable school-obligation-bound
  manual reference claim, bank reference digest, exact positive claimed amount,
  submitter and UUID replay key; SUBMITTED is never verified funds
- PaymentVerificationDecision — **authored/unverified:** independent current
  school-owner VERIFIED/REJECTED attestation, bank confirmation bit and
  reference digest check, unique claim decision and school-locked
  over-credit prevention; not automatically a settlement or receipt
- ManualPaymentAllocation — **authored/unverified** one-time same-school
  allocation from an independently VERIFIED reference claim and its exact
  obligation. PostgreSQL derives minor-unit money, locks School, rejects
  repeated evidence/decision, over-allocated totals and fabricated actors;
  this does **not** establish actual funds settlement or receipt.
- ManualAllocationPreview — derived owner-only numeric-string view
  (no physical table) of immutable charge, independently reviewed
  claims, manual allocations and internal preview remainder; never
  a publicly published fee balance
- PaymentRecord — later actual paid ledger, **not implemented**
- Receipt
- AdjustmentRecord
- ReconciliationRecord

### Communication and lifecycle

- NoticeBoardItem
- ClassAnnouncement
- NotificationEvent
- NotificationDelivery
- AuditLog
- TrashRecord
- RetentionJobExecution
- FileRecord

## Model rules

- All tenant-owned records include tenant_id.
- Academic and financial historical records are versioned or snapshot-based.
- Deletion and archive states are explicit.
- Report publication is separate from earlier approvals.
