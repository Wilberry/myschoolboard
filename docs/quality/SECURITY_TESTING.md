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

## School-details read response regression coverage (pending local run)

The existing school-details read handler must send `Cache-Control: private, no-store` on both successful and denied/error responses. Its error logger is best-effort only: throwing from `console.error` must not prevent a generic HTTP `500` response or disclose school identifiers. The follow-up tests exercise unauthenticated, authorized, concealed cross-tenant, persistence-failure, and logger-failure cases against the disposable test database. The new tests have been authored but not yet executed against PostgreSQL; see the owner's postponed local CI verification.

## Final school-read membership recheck (authored, not yet verified)

The school metadata GET must include a second active-membership and exact-role predicate in its final school query, even after an earlier server-side principal resolution. New database-backed tests assert the predicate, school deactivation denial, and role-change denial, and preserve existing cross-tenant and no-cache regression coverage. The tests are awaiting the owner's isolated local verification run. This does not resolve all tenant-isolation race risks or complete TEN-REQ-001 / SEC-REQ-001.

## Teacher-assignment mutation caching (authored, not yet verified)

The shared mutation handler must attach `Cache-Control: private, no-store` to every status, including authorized create/lifecycle responses, unauthenticated or forbidden requests, malformed input, duplicate transitions, and internal persistence failures. Route integration tests cover response header behavior without changing existing mutation or audit expectations. Database-backed coverage awaits the owner's local verification run.

## Sanitized school-read denials (authored, pending local verification)

Authenticated school metadata requests that resolve to a concealed `404` (including missing, other-school, or insufficient-role resources) must emit a **best-effort operational security event** with only `school_read_denied` and a generated random request identifier. Never log school IDs, user IDs, email addresses, cookies, query data, session tokens, or raw database error messages. Logger failure must not change the generic `404` response or the `Cache-Control: private, no-store` header. Two new database-backed integration cases check the event's minimal fields, identical missing/cross-school outcomes, and logger failure. They remain **unexecuted** until the owner's local verification checkpoint. These diagnostic events are **not** immutable audit records and do not complete SEC-REQ-001.

## Requirement

Security tests must be executed before release and must continue as part of regression checks.
