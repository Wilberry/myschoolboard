# Admissions and Student Records

## Scope

Student admissions, record integrity, enrollment, parent linkage, and lifecycle tracking.

## Requirements

- Support a complete admissions lifecycle from inquiry to enrollment.
- Preserve history through promotion, withdrawal, transfer, or graduation.
- Prevent duplicate active enrollments.
- Enforce auditable corrections and lifecycle status updates.

## Critical rules

- Student class history must remain even when current class membership changes.
- No destructive deletion substitutes for withdrawal or graduation.
- All sensitive student data must be access-restricted by role and tenant.
