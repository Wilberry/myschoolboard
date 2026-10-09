# Non-Functional Requirements

## Security and privacy

- Role and permission enforcement must happen on the backend, never only in the UI.
- All tenant access must be validated against server-side user context.
- Sensitive student, guardian, and financial data must be minimized.
- Public QR verification must avoid exposing private report data.

## Performance

- Core school dashboard and list operations should be responsive for standard classroom and admin use.
- Search and report generation should support expected school sizes without excessive latency.
- Batch operations such as retention jobs must be idempotent and safe to retry.

## Availability and reliability

- The platform should target high availability for core operations such as admissions, results, and attendance.
- Mission-critical state transitions must be transactional.
- The system should provide retry-safe job execution for notifications, retention, and payments.

## Scalability

- Design should support increasing tenant volume, class sizes, and report generation demands without redesigning the whole platform.
- Module boundaries should allow independent scaling where justified.

## Accessibility and responsive UX

- Essential workflows must be keyboard navigable and screen-reader compatible.
- The system should support mobile and tablet access for teachers, parents, and students.
- Critical states must be clear, with visible error and empty-state handling.

## Observability

- Logs, metrics, and traces should support investigation without leaking private data.
- Audit trails must be available to authorized platform or school admins.

## Maintainability

- Code and configuration should be organized by module and tenant boundary.
- Architecture should prefer clear modular domain boundaries over premature complexity.

## Testability

- Every critical workflow must have automated test coverage and traceability to requirement IDs.
- Security and tenant-isolation cases must be executed deliberately.

## Backup and restore

- Backup and restore targets must be explicitly defined and supported by validated procedures.
- Restore testing is required before production release.

## Internationalization

- The product should be capable of localization and currency configuration for international expansion.
- Branding and user language should remain configurable without redesign.

## Proposed provisional targets

These targets are provisional until approved by product and operational stakeholders:

- Availability target: production core operations should support resilient uptime, subject to final hosting choice.
- RPO/RTO: must be defined by final deployment and backup policy.
- Accessibility: must meet modern WCAG-aligned expectations for core flows.
- Performance: must support school-level scale without forcing a redesign for basic operations.

## Validation approach

Targets must be validated by actual load, security, and recovery testing before a release-go/no-go decision.
