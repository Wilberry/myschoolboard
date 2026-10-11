# Security Testing

## Required areas

- Tenant isolation tests
- Authorization bypass tests
- File upload security tests
- QR verification abuse tests
- Duplicate callback and payment verification tests
- Session hijack and permission escalation tests
- Teacher class-subject cross-pair and cross-school assignment authorization tests, including inactive and revoked assignment denial
- Assignment creation races against actor/teacher membership revocation and class/subject deactivation; audit association constraint failures; and school cascade deletion with existing events.
- Database-writing integration tests must pass the fail-closed Vitest database guard and use only the disposable `myschoolboard_test` database on localhost port 5434. Do not use the ordinary development or production `DATABASE_URL`.
- The four implemented assignment mutation routes have handler-level integration coverage in `teacher-assignments/routes.integration.test.ts`: unauthenticated requests; authorized school administrators; platform roles without school authority; absent, inactive, or insufficient-role memberships; wrong-school assignment/class/subject/teacher IDs; deleted and inactive targets; duplicate creation; invalid lifecycle transitions; concurrent revocation and competing transitions; audit-write failures with transaction rollback; and stable generic error responses.
- For read routes, test only after the reader permission and role scope are approved. Verify both list and individual-resource queries are constrained by the server-derived school context and do not disclose whether a cross-school ID exists.
- For mutation routes, verify handlers reject client-supplied actor and tenant IDs and always call the transactional service. Assert exactly one audit event for each successful mutation and no event or partial state change after failed authorization, validation, concurrency, or audit persistence. The current integration suite also verifies logger failure cannot turn a denial into an allowed response.
- Denied cross-tenant access must remain denied even if security logging fails. Log only the event type, fixed mutation label, generated request ID, and an error type where relevant; never log tenant/resource identifiers, cookies, tokens, credentials, request bodies, or personal data. Logging failure must not change the denial response or expose resource existence; exercise this with a simulated logger failure.

## Requirement

Security tests must be executed before release and must continue as part of regression checks.
