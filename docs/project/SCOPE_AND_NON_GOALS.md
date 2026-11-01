# Scope and Non-Goals

## In scope

### Platform

- Platform administration for SaaS operator
- Tenant onboarding, lifecycle management, and subscriptions
- Platform-level security oversight and operational audit

### School operations

- School identity and branding configuration
- Academic sessions, terms, sections, classes, subjects
- Teacher and staff assignment management
- Student admissions, enrollment, promotion, transfer, withdrawal
- Attendance and approval workflows
- Lesson notes and schemes of work
- Assessments, CBT, result sheets, report cards, and publication
- Fees, receipts, and payment verification
- Notices, class announcements, parent/student portals
- Trash, audit, and retention workflows

## Out of scope or deferred

- Full-scale ERP for all school non-academic operations beyond the specified SaaS scope
- Open-ended integration ecosystem not tied to approved product requirements
- Generic AI revenue or decision support features without explicit requirement justification
- Content distribution of copyrighted educational materials without authorization
- Universal grading or curricular policy assumptions not configured by the school

## Explicit exclusions

- No assumption that a single teaching model fits all schools
- No silent automatic publication of report cards
- No hidden privilege escalation across tenants
- No destructive deletion as a substitute for record lifecycle management
- No cross-tenant access by platform operators without explicit approval and audit records

## Scope governance

The [Product Charter](PRODUCT_CHARTER.md), [Functional Requirements](../requirements/FUNCTIONAL_REQUIREMENTS.md), [Traceability Matrix](../requirements/REQUIREMENTS_TRACEABILITY_MATRIX.md), and [Implementation Roadmap](../roadmap/IMPLEMENTATION_ROADMAP.md) collectively define authorized product scope. A feature need not be repeated verbatim in this summary to be in scope. The [Standing Development Mandate](STANDING_DEVELOPMENT_MANDATE.md) authorizes routine feature implementation, tests, engineering defaults, and draft development PRs within that scope. Only a materially new business goal, an irreversible/unsafe policy change, or a production/release exception needs a separate owner decision. Actual school-user workflow approvals and cross-tenant restrictions remain unchanged.
