# Security Testing

## Active school-owned scope grants (authored, pending local verification)

The `resolveSchoolPrincipal` loader must not trust a CLASS or SUBJECT `ScopeGrant.scopeId` as proof of school ownership merely because its grant is verified. Only identifiers resolving to **active** classes or subjects in the requested school can enter the resolved principal. New disposable-DB integration cases deliberately create verified school-A grants for school-B class/subject IDs, verify that the invalid grants are filtered, and then deactivate the valid school-A resources to confirm those grants cease to authorize reads. These cases have **not** been executed on the cumulative branch. SECTION/CHILD resource binding, concurrency guarantees across multiple queries, and production read routes remain separate unverified responsibilities; do not infer them from these tests.

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

## Session invalidation and principal revalidation (authored, pending local tests)

Protected school metadata GET and all four teacher-assignment mutation POST handlers must not authorize a previously valid session after its **exact database session record is deleted**. New integration tests sign in using Better Auth, resolve that session ID, delete only the disposable test session, and replay its cookie. The GET must return a non-caching `401`; every assignment mutation must return non-caching `401` without creating an event or altering an existing assignment. Additional tests assert that elevating an unrelated school's user to Platform Super Admin never supplies another-school access, and demoting an administrator while their session remains active revokes assignment-create permission. All four cases are *authored, not executed* against the disposable PostgreSQL database. They do not establish browser sign-out, real-world session revocation propagation across deployments, or full SEC-REQ-001 / TEN-REQ-001 acceptance.

## Unverified scope grant denial (new, pending local verification)

The server policy must treat a section, class, or subject `ScopeGrant` with `verified: false` as untrusted and **deny** the corresponding resource-specific academic read. Unit regression cases cover all three scope types with both unverified and verified grants; an otherwise verified grant for another resource also remains denied. Parent-child verification checks and the exact teacher class-subject assignment rule remain unchanged. These cases are authored but not executed on the cumulative branch. The rule is a tightening of least-privilege behavior, not authorization to add scope-grant management routes or broaden school access. Review existing data before migration/release to identify any workflows relying on unverified grants.

## D-020 assignment-administration reader isolation (pending local verification)

The new list/detail GET handlers permit only Better Auth sessions with active same-school `school:configure`, and the **final** assignment query repeats the reader's active membership and school role, not just the earlier principal check. The list caps responses at 50, verifies cursor ownership before pagination, denies forged/missing/cross-school cursors identically, and rejects unexpected filters. Detail reads conceal foreign/missing IDs. Responses return only minimum assignment identifiers/status/time, include private/no-store, and never disclose users or audit events. Eleven new direct-handler/database integration cases cover positive admin/Super Admin reads, academic-only/teacher/platform/other-school denial, inactive school/membership, revocation, pagination, missing/cross-tenant identifiers, malformed input, final-query predicate, and logger/DB failure. The old negative export test was updated to allow only the new intended GET while retaining no DELETE handlers. **These tests are authored but unexecuted**; real Next HTTP/browser tests and the full CI-equivalent run remain pending.

## Form Teacher tenant and responsibility integrity (authored, pending local verification)

Six new real Better Auth/disposable PostgreSQL integration cases exercise the Form Teacher administration and handover service: deny anonymous, teacher-self-service and foreign-school actors; reject forged class/membership IDs; maintain one active PRIMARY; hand over PRIMARY with an exact actor/reason audit trail; require school policy for SUPPORT; block disabling co-responsibility or ending PRIMARY while SUPPORT remains; end SUPPORT with historical audit preservation; deny direct audit-event update/delete; reject new responsibilities for CLOSED sessions. A currently active primary Form Teacher is separately tested to **not** gain subject academic access or child personal-data access without its own exact subject assignment/verified child relationship. The model enforces same-school FK ownership and unique active class/session assignments. All new cases remain unexecuted; concurrent transactions, HTTP transport and production acceptance remain separate gates.

## Requirement

Security tests must be executed before release and must continue as part of regression checks.
