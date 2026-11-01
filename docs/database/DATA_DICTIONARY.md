# Data Dictionary

## Tenant

- tenant_id: unique tenant identifier
- name: school or platform-managed tenant name
- status: pending, active, suspended, expired, closed
- created_at: creation time

## UserAccount

- user_id: unique user identifier
- tenant_id: owning tenant
- email: user email
- status: active, disabled, locked

## StudentEnrollment

- enrollment_id: unique key
- student_id: student reference
- class_id: class reference
- session_id: academic session context
- status: active, transferred, promoted, withdrawn, graduated
- effective_from, effective_to

## SchoolClass

- id: school-scoped class identifier
- schoolId: owning school
- name: display name; active normalized names are unique per school using lower-case and surrounding ASCII-space trimming
- isActive, createdAt, updatedAt

## Subject

- id: school-scoped subject identifier
- schoolId: owning school
- name: display name; active normalized names are unique per school using lower-case and surrounding ASCII-space trimming
- isActive, createdAt, updatedAt

## TeacherClassSubjectAssignment

- id
- schoolId
- membershipId: must identify a membership in the same school
- classId: must identify a class in the same school
- subjectId: must identify a subject in the same school
- status: ACTIVE, INACTIVE, or REVOKED; transitions reuse the unique tuple row
- createdAt, updatedAt: timestamps, not a complete actor-level audit trail

## TeacherClassSubjectAssignmentEvent

- id
- schoolId
- actorUserId, actorMembershipId
- teacherMembershipId: target teacher membership
- assignmentId
- eventType: CREATED, DEACTIVATED, REVOKED, REACTIVATED
- previousStatus, newStatus
- reason: optional except service-required deactivate/revoke reason
- createdAt: database-generated event timestamp
- PostgreSQL rejects direct UPDATE and DELETE; school tenant cascade cleanup may remove events

## ResultSheet

- result_sheet_id
- class_id
- session_id
- term_id
- state: draft, submitted, approved, returned, corrected, published

## PaymentRecord

- payment_id
- tenant_id
- student_id
- amount
- currency
- status: submitted, pending_verification, verified, rejected, refunded

## QRVerificationToken

- token_id
- report_card_id
- token_hash
- status: active, revoked, superseded
- created_at, expires_at
