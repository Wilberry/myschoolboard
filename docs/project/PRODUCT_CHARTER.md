# Product Charter

## Product vision

MySchoolBoard is a subscription-based multi-tenant SaaS for schools that need a unified operational platform for admissions, academic management, reporting, parent communication, fees, and administration. The initial market is Nigeria, with architecture designed to support future international expansion.

## Mission

Create a reliable, secure, configurable school management system that supports day-to-day school operations while preserving strict data separation between tenants.

## Business goals

- Replace fragmented school administration tools with one source of truth.
- Support both primary and secondary school workflows without forcing one model onto another.
- Keep tenant data isolated and auditable.
- Offer configurable school policies rather than hard-coded assumptions.
- Support school operations, academic records, communications, and finance in one platform.
- Maintain a scalable but operationally simple architecture.

## Product principles

1. One source of truth for each academic and administrative record.
2. Strict tenant separation.
3. Least-privilege access and explicit approval flows.
4. No unauthorized self-assignment of school responsibilities.
5. Historical records survive transfer, promotion, graduation, and withdrawal.
6. Material changes are auditable.
7. Notifications are actionable and relevant.
8. Configurable policies replace hard-coded exceptions.
9. Every feature has explicit acceptance criteria and tests.
10. Primary and secondary teaching structures are both first-class.
11. Product branding is configurable.
12. UI actions must reflect valid server-authorized operations.

## Scope summary

### In scope

- Tenant onboarding and subscription lifecycle
- School and academic-structure configuration
- Student admissions and enrollment
- Staff and teacher assignment management
- Attendance and approval workflows
- Lesson planning and note approval
- Assessments, CBT, results, and report cards
- Fees, payments, and reconciliation
- Communication, notices, announcements, and dashboards
- Trash and restoration lifecycle
- Audit and notifications
- Security and tenant isolation

### Non-goals for initial planning

- Building a full generic LMS for all education models
- Unapproved content distribution beyond licensed resources
- A single universal grading system imposed on all schools
- A product that ignores parent and student privacy constraints
- Automatic access escalation for platform staff without explicit approval

## Success definition

The product is successful when schools can operate core academic and administrative workflows with auditable records, configured policy controls, and secure tenant separation.

## Product ownership status

This project is currently documentation-first. Product-owner decisions marked as unresolved should be treated as explicit blockers until approved.
