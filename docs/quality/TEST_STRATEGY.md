# Test Strategy

## Principles

- Test real behavior, not mock-only behavior.
- Cover tenant isolation, authorization, workflow transitions, and historical data invariants.
- Keep tests aligned to requirement IDs and acceptance criteria.

## Test levels

- Unit tests: scoring, permissions, state transitions, retention checks.
- Integration tests: database constraints, workflow validation, teacher assignments, and attendance.
- End-to-end tests: school onboarding, publication, portal access, QR verification, fees, and trash flows.

## Permission-aligned navigation tests (new, pending local verification)

The school workspace must not provide a functional school-details link to a membership that fails the existing school-level `academic:read` policy. The presentation predicate delegates to the same policy helper, and focused unit tests enumerate allowed/disallowed role cases. Real authorization remains mandatory in the destination route; a navigation hint cannot be treated as an access-control decision.

## Authentication client request failure tests (authored, not yet run)

The shared `authRequestSucceeded` helper is covered by unit cases for success, explicit provider errors, missing response bodies on fulfilled requests, and rejected transport calls. Sign-in and sign-out UI now use this result to avoid permanent loading states and to show generic, non-disclosing error messages; the sign-out UI only refreshes after a successful request. Unit tests await local CI, and **real browser event/keyboard/accessibility tests remain outstanding** before the authentication UI is treated as fully verified.

## Platform onboarding lifecycle tests (authored, awaiting local DB)

The Phase 3 platform foundation now includes a pure transition-policy test (including forbidden Closed-to-Active reopening) and a disposable PostgreSQL route integration suite: unauthenticated and non-platform actors cannot create schools; an authorized platform operator creates a Pending/inactive school; state changes are reasoned, event-audited and adjust `isActive`; duplicate slugs and forbidden transitions fail; direct audit event update/delete is denied by PostgreSQL triggers. The new SQL migration and tests are unexecuted and must not be treated as production evidence. Existing tenant records are intentionally not auto-backfilled to a guessed lifecycle status.

## Academic session and catalog safety (authored, awaiting local verification)

Create-only academic session/term and class/subject handlers must use active `school:configure` membership, tenant-owned academic identifiers and serializable writes with append-only change events. Five database-backed integration tests were authored: deny anonymous/academic-only/foreign-school roles; create planned sessions/terms and events; reject term dates outside the session, bad dates and duplicate positions/names; enforce same-school class and subject records; reject an inactive school membership; and deny direct audit update/delete. The migration, these tests, full CI-equivalent pipeline and real Next transport have not run.

## School setup UI and read isolation (authored, awaiting local verification)

The `readSchoolSetup` server helper revalidates `school:configure`, active school membership and per-collection school ownership. Four direct database integration cases check exact school data, cross-school and insufficient role denial, membership revocation, and the final Prisma predicate on academic-session reads. Browser end-to-end verification of the setup editor forms, refresh behavior, keyboard labels and denied navigation remains pending; server-rendered links are hints and may not replace authorization in the data-fetch service.

## Academic period transition safety (authored, awaiting local verification)

Period status endpoints use `school:configure` and server-derived Better Auth identities; transitions require a reason and serializable audit-atomic writes. New pure policy tests cover valid and terminal-invalid transitions; database tests check unauthenticated/cross-school denial, activation ordering (session before term), rejection of closing a session while terms remain active/planned, and exact audit event type/actor/reason persistence. The database partial unique constraints prevent two ACTIVE sessions per school or two ACTIVE terms per session; verify concurrency behavior in the postponed local test run. These new unit/DB/HTTP/UI tests have **not** run.

## Session-specific teacher-assignment access (authored, awaiting local verification)

Existing assignment mutations retain legacy NULL-session behavior and permit an optional, same-school ACTIVE academic session ID. New policy regression checks confirm exact session/class/subject authorization with separate legacy behavior; route integration cases cover duplicate protection within the same period, legacy/period-bound coexistence, foreign/planned/closed session rejection, and revocation plus session-closure removing teaching authority. The new migration and tests are authored but not executed, and real HTTP/browser academic resources remain outside this checkpoint.

## Required negative tests

- Cross-tenant access
- Unauthorized teacher assignment attempts
- Parent impersonation and student access bypass
- Unpublished report-card access
- Duplicate enrollment and invalid approval attempts

## Automation status

The Phase 1 foundation has automated policy, route, database, and teacher-assignment tests. The exact reduced checkpoint historically passed 78 tests across 7 files; these do not establish full end-to-end or production readiness. The follow-up liveness tests and local verification-guard tests are authored but await the next complete locally executed CI pass. See [Local CI Verification Runbook](LOCAL_CI_RUNBOOK.md).
