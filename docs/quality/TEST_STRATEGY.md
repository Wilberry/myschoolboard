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

## Form Teacher scope and co-responsibility (authored, pending local database)

Form Teacher assign/handover/end and co-responsibility policy mutations are backed by school/session/class/membership composite ownership; unique active PRIMARY and member-per-class/session guards; and actor-verified immutable audit events. The new six-case integration suite checks unauthorized and cross-school requests, duplicate primary, atomic replacement/old-row ending, inactive/closed academic session, school policy gating, prevention of orphaned SUPPORT, explicit reason/event capture, and no accidental access to academic subjects or child records. Tests and the migration have not run. Further concurrent handover/policy-toggle and PostgreSQL transaction rollback stress testing are acceptance requirements before any deployment.

## Timetable conflict verification (authored, not executed)

Run the timetable tests against an explicitly disposable PostgreSQL database with the `btree_gist` extension. Confirm exact same-school active session/term/assignment ownership, teacher/class/room no-overlap exclusions on active slots, adjacency, separate weekdays, invalid durations/weekdays, audit-only cancellation, and denied cross-school requests. Add concurrent overlapping inserts to prove the GiST constraints allow only one winner. Verify all previous tenant, teacher assignment and Form Teacher tests remain passing; do not infer their results from source inspection alone.

## Lesson-note authoring and submission integrity (authored, pending database)

Execute six real Better Auth / disposable PostgreSQL cases testing: unauthorized/foreign admin/teacher attempts and forged school/assignment/term IDs; exact same-school ACTIVE teacher assignment source; own-note list/detail with no other staff data; append-only revisions preserving content/history and rejecting stale expected revision; one-way DRAFT→SUBMITTED without student release or self-approval; SQL trigger rejection of audit/revision tampering; and teacher revocation/term closure removing further author reads/writes while preserving the historical record. Include concurrent revision/submit attempts and Next/browser cookie/accessibility coverage at the local verification checkpoint. These cases are **authored, not executed**, and do not complete LES-REQ-001 or Phase 6 acceptance.

## Teacher lesson-note authoring UI (authored, pending local test)

Four direct disposable-DB option-read integration cases are authored for own-school ACTIVE teacher/term/assignment options, foreign/admin denial, membership revocation and explicit last-query tenant/role predicate checks. The actual browser must verify signed-in navigation, term/assignment option narrowing, accessible labels, draft creation, reloaded note detail, optimistic revision conflict handling, on-screen history, submission confirmation, and no student/HM approval controls. None of these newly authored tests or the full exact-commit CI-equivalent suite has run.

## Section ownership and scope validation (pending local test)

Apply the additive section migration to only an explicitly disposable PostgreSQL target and verify legacy classes retain NULL sectionId and foreign section IDs fail the composite FK. Run five authored real-session section API tests for admin/foreign/anonymous denial, one-time placement, verified SECTION grant ownership filtering, inactive section revocation and immutable audit events. Concurrency/reclassification and downstream exact-class HM/Principal stage/role checks remain separate acceptance gates. None has run yet.

## School section setup UI and reader regression (unverified)

Two new disposable-DB cases extend school setup reader coverage for exact school-owned PRIMARY/SECONDARY sections, class.sectionId, non-disclosure of foreign section records and active admin membership on the final Section query. The school setup browser must validate section creation, stage selection, class selection limited to unclassified active entries, generic conflict/error responses, reload and keyboard semantics. No new tests or end-to-end run has been executed.

## Required negative tests

- Cross-tenant access
- Unauthorized teacher assignment attempts
- Parent impersonation and student access bypass
- Unpublished report-card access
- Duplicate enrollment and invalid approval attempts

## Automation status

The Phase 1 foundation has automated policy, route, database, and teacher-assignment tests. The exact reduced checkpoint historically passed 78 tests across 7 files; these do not establish full end-to-end or production readiness. The follow-up liveness tests and local verification-guard tests are authored but await the next complete locally executed CI pass. See [Local CI Verification Runbook](LOCAL_CI_RUNBOOK.md).
