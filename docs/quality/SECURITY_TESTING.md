# Security Testing

## Phase 8 school results and parent-first receipt acceptance — unexecuted (2026-10-13)

New authored tests cover owner-only visibility-policy adoption and separate publication, school-only recipient denial, changed-policy suspension, current guardian-only positive read, verified guardian-first per-release receipt and active link revocation, anonymous and foreign-school denials, duplicate release/receipt races, direct forged SQL actor, immutable audit mutation, and no keys/marks/raw frozen source in recipient responses. `scripts/phase8-report-publication-guard.test.mjs` is registered in the existing full test and local guard chains. **3/3 isolated source-replay cases and 5/5 in-memory negative mutations pass**; this cannot substitute for Node, database or full CI acceptance. Live release/read switches remain false.

Exit must include a fresh disposable loopback Postgres, migration checksum preflight, Prisma validate/deploy, actual SQL trigger/rollback/serializable tests, a separate **positive still-linked student** fixture for STUDENT_ONLY and GUARDIAN_FIRST_ACK, browser/no-cache/print/a11y checks, TypeScript/lint/format/build and strict `npm audit --audit-level=high`. No GitHub Actions may be started for this user-requested checkpoint. See `PHASE8_END_TO_END_PUBLICATION_CHECKPOINT_20261013.md`.


## Active school-owned scope grants (authored, pending local verification)

The `resolveSchoolPrincipal` loader must not trust a CLASS or SUBJECT `ScopeGrant.scopeId` as proof of school ownership merely because its grant is verified. Only identifiers resolving to **active** classes or subjects in the requested school can enter the resolved principal. New disposable-DB integration cases deliberately create verified school-A grants for school-B class/subject IDs, verify that the invalid grants are filtered, and then deactivate the valid school-A resources to confirm those grants cease to authorize reads. These cases have **not** been executed on the cumulative branch. SECTION/CHILD resource binding, concurrency guarantees across multiple queries, and production read routes remain separate unverified responsibilities; do not infer them from these tests.

## Draft lesson-note ownership and immutable revision history (unverified)

The teacher-only note service must derive the actor from Better Auth and require an active exact tenant-owned class/subject/session assignment in an ACTIVE term. Revision/submit writes lock the school, teacher membership, academic term, assignment, and current note inside serializable transactions; an expected revision check prevents lost updates. Composite school/term/assignment FKs and PostgreSQL validation/immutability triggers protect the author note, revision and workflow ledger. **Submitted notes are never student-visible and cannot be self-approved**. The six authored real-session disposable-DB scenarios cover anonymous/admin/foreign/other-teacher denials; exact school/term/assignment binding and forged input rejection; own-notes reads; immutable numbered revision chain and stale updates; submit-only transition and no reopening; direct revision/event tamper rejection; and denial after assignment revocation/term closure. All remain unexecuted, as do true concurrent editors, rollback and real HTTP browser checks.

## Active same-school SECTION grant checks (authored, unverified)

New `SchoolSection` is a tenant-owned PRIMARY/SECONDARY resource; nullable `SchoolClass.sectionId` is constrained by a composite same-school FK. The principal resolver discards foreign and inactive SECTION ScopeGrants even if verified. Five disposable-DB integration tests are authored for unauthorized/foreign section changes, active creation and one-time class placement, verified foreign-section grant denial, deactivation revocation and append-only configuration events. Future HM/Principal approvals must additionally check the class belongs to the exact active stage-appropriate section, not trust independent scope IDs. **No tests or migrations executed**.

## HM/Principal exact-section lesson-note review enforcement (authored, unverified)

Seven new real Better Auth/disposable-PostgreSQL scenarios cover anonymous/teacher/admin/foreign/no-grant denials; primary-only HEAD_OF_SECTION and secondary-only PRINCIPAL queues and details; refusal to review unclassified or unrelated-section notes; one RETURN per revision with reasoned immutable audit; new teacher revision before resubmission; approval without student release; verified SECTION grant revocation and section inactivity; forged reviewer event insertion, UPDATE and DELETE rejection; and no review of closed-term content. The reader joins the **actual class.sectionId** and the reviewer verified grant in one SQL statement. The mutation transaction locks/rechecks school, membership, note, class, active section and ScopeGrant and the SQL trigger validates reviewer role/stage/grant again. The schema adds a partial unique index on reviewed (note,revision) to prevent contradictory review outcomes. No test, migration, concurrency stress, browser, or full pipeline run has occurred.

## Lesson-note reviewer UI boundary (authored, pending local/browser verification)

A reviewer role is insufficient for a navigation link; the active school, reviewer membership, verified SECTION grant and required PRIMARY/SECONDARY stage must all match. The protected reviewer page uses the same owner-bound SQL filter as its underlying GET/POST API, so bypassing the link or editing client state cannot cross section boundaries. Four new disposable PostgreSQL navigation tests cover positive matching grants, teacher/foreign denials, grant revocation and final query scope with inactive section. Real Next browser session/cookie, keyboard, CSRF configuration, race/revocation, and HTTP response tests remain pending.

## Student registration/enrollment private ledger (authored, not verified)

The new StudentRecord and StudentEnrollment use composite school-bound student/session/class FKs. An ACTIVE enrollment requires an ACTIVE academic session and an active class explicitly associated with an active school-owned Section; historic classes with NULL section may not receive pupils through this route. PostgreSQL partial uniqueness independently prevents two ACTIVE rows for the same school/student/session, even across concurrent writers. The school-admin-only registration/enroll/withdraw services revalidate identity and resources inside serializable transactions and insert actor/reasoned `StudentEvent` records with SQL actor/state validation and append-only mutation/truncate guards. Six real-session disposable DB tests are authored for anonymous/foreign/teacher denials, school-specific admission code, exact classified class/session ownership, partial uniqueness and cross-tenant FK, historical withdrawal/record preservation and attempted audit forging/update/delete. Real concurrency, actual migration, user association and pupil-record reader permission tests remain outstanding; there is **no GET/roster or student portal API**.

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

## Timetable identity, foreign resource, and overlap cases (authored)

Six disposable-DB integration cases validate anonymous/teacher/foreign-school denial, forged academic term/assignment IDs, room normalization, overlapping teacher/class/room conflicts, adjacent and different-day slots, cancellation releasing the interval while preserving audit events, update/delete audit tamper rejection, and denial of new slots after term closure. Cross-school term/session/class/assignment and optional room FKs, active teacher membership and private/no-store responses are mandatory. PostgreSQL `btree_gist` exclusion constraints are the concurrency backstop; **actual migration and concurrent race tests remain pending local execution**.

## Timetable administration view isolation (authored, awaiting local test)

The server-only `readTimetableSetup` rechecks the Better Auth user, active school `school:configure` membership and the current role before disclosing timetable data. School, active term, room, teacher assignment and slot data queries each repeat the same-school, active-membership role predicate and enforce explicit field selection/caps. A teacher or foreign administrator is not authorized just because they know a path. Five disposable-DB integration cases are authored: own-school active summary, foreign/teacher denial, revoked membership, final SQL tenant/role predicates and cancelled-slot exclusion. Browser interaction with time inputs, collision errors, cancellation confirmation, and HTTP/session cookie protection remains unverified.

## Requirement

Security tests must be executed before release and must continue as part of regression checks.
