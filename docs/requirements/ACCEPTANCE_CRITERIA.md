# Acceptance Criteria

This document records the acceptance standard for the major product workflows.

## Platform onboarding

- Given a valid platform-level request, a platform operator can create or manage a tenant record.
- When a tenant is active, the platform can attach subscription status, settings, and operational status.
- When a tenant is suspended or closed, the status is logged and access must follow the approved policy.

## School configuration

- Given a school is onboarded, the school can configure branding, academic sessions, terms, sections, classes, subjects, and grading policies.
- When a grading configuration changes, the system must not silently rewrite historical results.

## Teacher assignment

- Given a subject or class is assigned, the system rejects duplicate active assignments and conflicting timetable slots.
- Given an unauthorized teacher attempts self-assignment, the request must fail with server-side enforcement.

## Attendance

- Given a Form Teacher submits attendance, the system must create a pending or approved record depending on policy.
- When a duplicate attendance record is attempted, the request must fail.
- When attendance is corrected after approval, a reason and actor must be preserved in history.

## Results and publication

- Given an HM or Principal approves a class result sheet, the approval must not be treated as a final published report.
- When the School Super Admin publishes a report card, the parent or student visibility rules must be enforced based on the school policy.

## Payments

- Given a payment transfer is uploaded, the system must not automatically mark the payment as verified without a verification decision.
- When a duplicate callback is received, it must be idempotently handled.

## Trash and retention

- Given an item is placed in school Trash, it remains recoverable for 30 days.
- Given the object is expired, it must not be recoverable unless explicitly retained by policy.
- Given platform-level deletion occurs, the object must be retained in platform Trash for 90 days.

## Security

- Given a cross-tenant request is issued, the system must reject it and log the event.
- Given a student attempts unauthorized access to another student’s data, the request must fail.
- Given a QR token is revoked or invalid, verification must fail without displaying private data.

## Documentation and traceability

- Every requirement must map to acceptance criteria, tests, and roadmap milestones.
- No requirement is considered complete without evidence of implementation and validation.
