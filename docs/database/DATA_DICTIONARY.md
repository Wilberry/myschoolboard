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

## TeacherSubjectClassAssignment

- assignment_id
- teacher_id
- subject_id
- class_id
- tenant_id
- status: active, archived, invalid

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
