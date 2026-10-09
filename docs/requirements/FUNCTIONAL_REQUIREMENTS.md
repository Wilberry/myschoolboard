# Functional Requirements

This document is the functional baseline for the specification. It is intentionally written as a canonical requirements ledger for future implementation and validation.

## Requirement catalog

| ID | Area | Priority | Delivery phase | Status |
| --- | --- | --- | --- | --- |
| PLAT-REQ-001 | Platform administration | Critical | Phase 3 | Specified |
| TEN-REQ-001 | Tenant isolation | Critical | Phase 2 | Specified |
| SCH-REQ-001 | School structure | Critical | Phase 4 | Specified |
| USR-REQ-001 | Users and roles | Critical | Phase 2 | Specified |
| ADM-REQ-001 | Admissions | High | Phase 4 | Specified |
| TCH-REQ-001 | Teacher assignments | Critical | Phase 5 | Specified |
| ATT-REQ-001 | Attendance | Critical | Phase 6 | Specified |
| LES-REQ-001 | Lesson notes | High | Phase 6 | Specified |
| ASM-REQ-001 | Assessments and CBT | Critical | Phase 7 | Specified |
| RES-REQ-001 | Results and reports | Critical | Phase 8 | Specified |
| FEE-REQ-001 | Fees and payments | High | Phase 9 | Specified |
| COM-REQ-001 | Communications | High | Phase 10 | Specified |
| LIB-REQ-001 | Library | Medium | Phase 10 | Specified |
| SEC-REQ-001 | Security | Critical | Phase 1 | Specified |
| DEL-REQ-001 | Trash and recovery | Critical | Phase 11 | Specified |
| AUD-REQ-001 | Audit and notifications | Critical | Phase 10 | Specified |
| SUB-REQ-001 | Subscriptions | Critical | Phase 3 | Specified |
| OPS-REQ-001 | Engineering and operations | Critical | Phase 1 | Specified |

## Requirement details

### PLAT-REQ-001 — Platform administration

- Description: The SaaS operator must have a dedicated platform administration area.
- Business rationale: Platform operations require tenant lifecycle management, subscriptions, configuration, and oversight without cross-tenant academic access.
- Actors: Platform Super Admin, support staff if approved.
- Acceptance criteria:
  - Platform admin can onboard, view, suspend, reactivate, and close tenants.
  - Platform admin can manage plans, subscription periods, and entitlements.
  - Platform admin can review platform-level audit and operational metrics.
  - Support operations remain explicitly scoped.

### TEN-REQ-001 — Tenant isolation

- Description: Tenant data must be isolated and enforced on all reads and writes.
- Business rationale: Schools must not access each other’s data.
- Actors: All tenant users, platform operators, background jobs.
- Acceptance criteria:
  - Authenticated tenant scope is derived from server-side membership context.
  - Cross-tenant access attempts fail and are logged.
  - Background jobs and exports respect tenant boundaries.

### SCH-REQ-001 — School structure

- Description: Each school must configure its own academic structure and policies.
- Business rationale: Schools differ in section, class, grading, and operational policy.
- Acceptance criteria:
  - Primary and secondary sections are supported.
  - Grading and academic configuration changes are versioned and do not silently rewrite historical results.

### USR-REQ-001 — Users and roles

- Description: The authorization model must distinguish platform and school roles.
- Business rationale: Platform and school authorities must not be interchangeable.
- Acceptance criteria:
  - Platform Super Admin and School Super Admin are distinct.
  - Roles include section-scoped and assignment-scoped restrictions.

### ADM-REQ-001 — Student admissions and records

- Description: Student admissions and records must cover inquiry, registration, acceptance, enrollment, and lifecycle status.
- Business rationale: A school needs a dependable student ledger across history.
- Acceptance criteria:
  - Student lifecycle statuses are explicit.
  - Enrollment changes are auditable.
  - Prior class and academic history is preserved.

### TCH-REQ-001 — Teacher assignments

- Description: Teacher assignments must be controlled by the school and section authority.
- Business rationale: Teachers cannot self-assign classes or subjects.
- Acceptance criteria:
  - Duplicate subject/class assignments are prevented.
  - Timetable and class constraints are validated.
  - Form Teacher is distinct from subject assignment.

### ATT-REQ-001 — Attendance

- Description: Attendance must support teacher submission, approval, correction, and historical preservation.
- Business rationale: Attendance affects operational reporting and parent visibility.
- Acceptance criteria:
  - Attendance approvals are required where policy demands it.
  - Duplicate attendance records are prevented.
  - Corrections preserve original records and reasoning.

### LES-REQ-001 — Lesson notes and schemes of work

- Description: Lesson notes and schemes must track versioning, approval, and release.
- Business rationale: Academic planning requires authorization and correct visibility.
- Acceptance criteria:
  - Notes require approval before release.
  - Students only see notes released for their authorized class and period.

### ASM-REQ-001 — Assessments and CBT

- Description: The platform must support tests, assessments, question banks, CBT, and valid score handling.
- Business rationale: Schools require structured assessment delivery and score integrity.
- Acceptance criteria:
  - Assessments are scoped to class and subject.
  - Score validation, attempt limits, and grading rules are enforced.
  - Solutions and keys are not exposed early.

### RES-REQ-001 — Result sheets and report cards

- Description: Result sheets feed report cards through explicit approval and publication.
- Business rationale: Official academic reporting must remain auditable and versioned.
- Acceptance criteria:
  - HM/Principal approvals are distinct from final School Super Admin publication.
  - Student visibility settings are enforced server-side.
  - Corrections are versioned and auditable.

### FEE-REQ-001 — Fees and payments

- Description: Fee structures, obligations, payments, receipts, and reconciliation must be auditable.
- Business rationale: Schools need a traceable financial record with approved evidence status.
- Acceptance criteria:
  - Uploaded transfer evidence is not treated as verified payment automatically.
  - Payment states are explicit and idempotent.

### COM-REQ-001 — School communication

- Description: Notice boards and class announcements are separate communication channels.
- Business rationale: School-wide and class-scoped communication require different rules.
- Acceptance criteria:
  - Teachers cannot post to the school-wide Notice Board by default.
  - Parents do not see Class Announcements.

### LIB-REQ-001 — Library and resources

- Description: E-library must distinguish catalog records from downloadable digital assets.
- Business rationale: The product must respect permissions, copyright, and file security.
- Acceptance criteria:
  - Digital resources are access-controlled.
  - Catalog and actual asset remain distinct objects.

### SEC-REQ-001 — Security

- Description: Security controls must protect child data, staff data, and financial records.
- Business rationale: Educational records and financial data are sensitive.
- Acceptance criteria:
  - Authentication and authorization are enforced server-side.
  - Sensitive data restrictions and audit logging are implemented.

### DEL-REQ-001 — Trash and recovery

- Description: School Trash and Platform Trash support retention and controlled restoration.
- Business rationale: Deletions must be recoverable but not bypass retention obligations.
- Acceptance criteria:
  - School Trash retains objects for 30 days.
  - Platform Trash retains items for 90 days and is restricted to platform admins.

### AUD-REQ-001 — Audit and notifications

- Description: The system must track consequential actions and relevant notifications.
- Business rationale: Schools need operational accountability and user awareness.
- Acceptance criteria:
  - Audit events capture actor, target, action, timestamp, and result.
  - Notifications are tenant-aware and deduplicated.

### SUB-REQ-001 — Subscriptions

- Description: Tenant subscriptions and entitlements must be managed and enforced.
- Business rationale: A SaaS product needs lifecycle, entitlement, and status controls.
- Acceptance criteria:
  - Subscription plans, periods, and payments are visible to platform administrators.
  - Tenant lifecycle states are explicit.

### OPS-REQ-001 — Engineering and operations

- Description: Engineering operations must be maintainable, secure, and observable.
- Business rationale: A production SaaS requires quality gates, observability, and migration discipline.
- Acceptance criteria:
  - Git, migration, and test practices are documented.
  - Security and operational readiness checks exist.

## Requirement cross-cutting rules

- All stated requirements remain traceable to roadmap phases and tests.
- Requirements are specification-first and may be deferred if phased.
- No requirement is allowed to be silently removed or weakened.
