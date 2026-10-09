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
- TeacherSubjectClassAssignment
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

### Attendance

- AttendanceSession
- StudentAttendanceRecord
- AttendanceSubmission
- AttendanceApprovalEvent

### Finance

- FeeStructure
- FeeObligation
- PaymentRecord
- PaymentEvidence
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
