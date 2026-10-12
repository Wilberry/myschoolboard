# Current Status

## Phase 6 attendance roster DB-integrity hardening — draft/unverified

Review identified that `validate_attendance_event_actor` in the earlier migration permits a direct SQL submission with a single individually valid mark, even where a class has additional active enrollments. New `feature/attendance-ledger-integrity-hardening` adds an additive SQL `BEFORE INSERT` submission-event guard with full current active roster counts, 500-entry cap and class/enrollment/pupil relationship comparisons, plus a direct-DB rollback integration test and read-only schema/migration consistency test integrated in standard `npm test`. The existing required full CI-equivalent command sequence and `npm audit --audit-level=high` remain unchanged. **The Postgres tests, Node test runner, migration, format/lint/typecheck/build, full CI, and audit have NOT run.** Ten limited GitHub fetched-file static presence checks passed; this is not proof that the migration works. ATT-REQ-001 and SEC/TEN requirements remain incomplete; no merge/deploy/live data.


## Attendance correction read and UI workspaces (new draft; UNVERIFIED)

`feature/attendance-correction-review-workspaces` builds on the unmerged immutable correction ledger and adds exact Form Teacher-approved-register list/detail reads with original/effective marks, verified HM/Principal section correction queue/detail reads that omit pupil marks/names until authorized detail, private GET endpoints, server-protected request and independent-review browser workspaces, and school navigation. Synthetic real-session tests for authorized projection, stage/grant revocation, foreign-school concealment, PII-free queue and latest-approved overlay are **authored not executed**. The additive migration and all underlying attendance tests/build/audit remain **unexecuted**. No live data, merge, deployment or production disclosure is authorized. D-028/ADR-014 apply; ATT-REQ-001 remains partially authored and unverified.


## Phase 6 immutable attendance corrections — new draft (UNVERIFIED)

`feature/attendance-immutable-corrections` extends the unmerged attendance workspaces with additive revisioned `AttendanceCorrectionRequest` and `AttendanceCorrectionDecision` schema/migration; private POST request and independent review services; exact ACTIVE PRIMARY Form Teacher class/session and HM PRIMARY / Principal SECONDARY verified section checks; SQL actor/revision validation, composite school/entry/register keys, pending-request serialization and immutable no-truncate history. No original mark or prior decision is updated. The existing `AttendanceEvent` Prisma relation map is also corrected to match its migration. Synthetic PostgreSQL integration cases are **AUTHORED NOT EXECUTED**. No correction queue/effective-mark reader/UI, local migrations, full build or security audit has run; school timezone/correction-window policy remains unresolved. Hosted GitHub Actions remains blocked by billing. The cumulative branch is unmerged and **ATT-REQ-001 remains incomplete**.


## Phase 6 attendance role-scoped reads and browser workspaces (draft, unverified)

`feature/attendance-scoped-read-workspaces` builds on the unmerged attendance ledger and adds a SQL single-statement Form Teacher roster reader, exact stored SECTION-grant HM/Principal pending queue/detail readers, authenticated private GET routes, two server-restricted browser workspaces with explicit complete-class marks and reasoned reviews, and role-aware school navigation. Synthetic disposable-database tests were authored for role/stage, tenant, grant revocation, data minimization, queue privacy, navigation and detail disclosure. **No tests, browser checks, migrations, formatting, typecheck, build or npm audit were executed on this branch**. The immutable correction lifecycle, school timezone policies, historical enrollment transitions, full local CI-equivalent checkpoint and hosted billing blocker remain outstanding; this does not complete Phase 6 or authorize production release.


## Phase 6 transactional attendance ledger and section approvals (authored; NOT verified)

The cumulative `feature/attendance-register-ledger` branch adds an additive Prisma schema/migration, exact-relationship register and student-mark foreign keys, database date/class/session uniqueness, append-only event/entry guards, actor-validating submission/decision triggers, and a deferred event-consistency check. Two private POST routes use authenticated active-school Form Teacher PRIMARY responsibility (exact class/session/student enrollment and complete current roster), and verified stage-matched section HM/Principal decision authorization with serializable locks. Unit and synthetic-disposable-PostgreSQL scenarios for cross-school/role denials, absent or duplicate marks, rejected partial roster, revoke-before-submit, concurrent duplicates, approval scope and audit tampering are **AUTHORED BUT NOT EXECUTED**. The historical attendance correction lifecycle, teacher roster UI/read, review queue/UI, full browser verification and local CI-equivalent security gate remain outstanding. PostgreSQL migration is **review-only and unexecuted**; hosted Actions are still blocked by billing. D-026 / ADR-012 document UTC date and terminal-decision development defaults, not completed school-policy decisions or acceptance of security risk.


## Phase 6 attendance permission foundation (draft, not operational)

The `feature/attendance-eligibility-policy` branch based on the unmerged student administrator workspace introduces testable pure predicates for exact student/class/session enrollment, current PRIMARY Form Teacher responsibility, and section-stage-specific verified HM/Principal approval. Authenticated transactional data loading, secure mutation routes, class/date duplicate prevention, immutable attendance submissions/decisions/corrections, UI and PostgreSQL authorization/concurrency tests are **not implemented**. Unit tests are **authored, not executed**; the cumulative branch is unverified and may not be merged or released until the agreed local CI-equivalent checkpoint and mandatory security gate are satisfied.


## Student administration workspace (draft; validation pending)

From verified base `741f8eb028a3d41125b5a509292bd0ce8f6e3237`, `feature/student-admin-workspace` adds an administrator-only student register, bounded history read, and browser controls invoking the existing audited register/enroll/withdraw POST routes. An authenticated active same-school `school:configure` principal and per-query membership/tenant predicates gate all reads. Synthetic disposable-database isolation tests have been authored **but not run**. No migration, full CI-equivalent run or dependency-audit execution is claimed for this candidate. Phase 6 attendance entry, exact active class/session/student verification, Form Teacher permission, section-specific HM/Principal approval and immutable attendance events remain to implement; no attendance endpoint has been exposed. The existing security audit gate remains mandatory and the hosted GitHub Actions billing block remains unresolved.


## Status summary

The project is no longer documentation-only. A verified local Phase 1 foundation has been implemented in the working tree and validated against the repository’s auth, tenancy, migration, and build workflow. The implementation remains local-only and is not a production deployment.

## D-020 teacher-assignment administration read implementation (pending local verification)

The new `feature/assignment-admin-read-api` branch adds an authenticated list/detail teacher-assignment administration API using the D-020/D-023 conservative `school:configure` reader permission. Each final assignment SQL query rechecks active school, membership, authenticated actor and role. List results use selected fields with a 50-record cap and tenant-validated cursor; reads are non-cacheable, generic on denial/error, and never return audit events. Eleven new disposable-PostgreSQL integration cases and a revised mutation-route negative-export check were authored. **No full CI-equivalent database test, lint, typecheck, build, or audit run has been performed on the changed branch.** New code remains an unmerged draft and does not complete TEN-REQ-001, SEC-REQ-001 or TCH-REQ-001.

## Phase 3 platform school onboarding and lifecycle foundation (pending local verification)

On the cumulative `feature/platform-school-onboarding-lifecycle` branch, new schema and a review-only migration add nullable lifecycle state for existing schools and immutable platform lifecycle events. Platform-only transactional onboarding starts new schools as PENDING and inactive; state changes update lifecycle and the existing `isActive` tenant barrier together. A transition policy, two platform API POST handlers, unit and database integration tests have been added. **No migration, test suite, lint, typecheck, build or dependency audit has yet run for this branch.** Staff invitation, plans/subscriptions, tenant read-only/export policy, physical closure/retention and browser/admin UI remain incomplete. The new schema is a development-only additive design and is not deployed.

## Phase 4 academic sessions, terms and class/subject configuration (pending verification)

The cumulative `feature/academic-session-term-foundation` branch adds school-owned `AcademicSession`, `AcademicTerm` and append-only `SchoolConfigurationEvent` schema plus migration. Four create-only school-admin endpoints create PLANNED sessions/terms and active school-owned classes/subjects under transactional `school:configure`, preserving prior teacher-assignment histories. Date/term containment and same-school ownership are validated; five database-backed cases for role/tenant denials, duplicates, range validation and immutable events were authored. **The migrations, PostgreSQL tests, Next build, typecheck, lint and high-severity audit have not been executed on this cumulative candidate.** No UI, section/stream policies, academic session activation or published-record grading recalculation is claimed.

## Phase 4 school setup workspace and tenant-scoped configuration reads (pending verification)

The cumulative `feature/school-setup-workspace` branch adds a restricted school-admin setup page, a client editor for new sessions/terms/classes/subjects, and a read service that rechecks same-school active membership/role in each final query. Four database-backed tests for authorized data selection, other-school concealment, inactive membership and final-query predicates are authored. **No full CI-equivalent validation, browser accessibility/HTTP verification, migration execution, or audit run has been performed** on this candidate. The workspace is not evidence of complete Phase 4, grading configuration, Section/Guardian enrollment models or academic workflow publication.

## Academic session and term activation/closure (pending verification)

The `feature/academic-period-lifecycle` branch adds two protected academic period status routes, reasoned state changes and audit records, and Activate/Close controls in the school-admin setup workspace. The application uses serializable transactions and database partial unique indexes to preserve only one ACTIVE session/term per scope; closing a session is blocked until all its terms are CLOSED. It adds an additive event-type/reason migration and new policy/database regression cases. **No migrations or full CI-equivalent verification have been run on this branch.** Academic session-scoped teacher allocations, Form Teacher responsibility, assessment workflows, and published-grade history remain future Phase 5+ work.

## Phase 5 session-specific teacher assignments (pending local verification)

The `feature/session-aware-teacher-assignments` branch adds nullable academic-session references to existing teacher assignments, preserving every legacy NULL-session row and its uniqueness in a partial index. A separate unique index permits the same teacher/class/subject in different school-owned academic sessions. New create requests may include a session ID, validated as ACTIVE and same-school in the serializable mutation; reactivation repeats this check. Principal resolution excludes closed-session assignments and teacher academic authorization requires the exact session, not a loosely related class/subject pair. The assignment administration GET includes nullable `sessionId`. Policy and database-route regression tests are authored; **the migration, tests and full CI-equivalent checks have not been run**. Form Teacher assignments and timetable constraints remain future Phase 5 work.

## Phase 5 Form Teacher assignment, handover and co-responsibility (unverified)

The cumulative `feature/form-teacher-responsibility` branch introduces separate school-owned session/class Form Teacher responsibilities; unique active PRIMARY and teacher/class/session constraints; optional school-configured SUPPORT relationships (off by default); append-only auditable assignment, handover and end events; and a separately audited school policy toggle. Four protected routes and six DB-backed integration cases are authored. All changes preserve legacy/period teacher-subject assignments and do not automatically grant a Form Teacher access to pupil data or another subject. **No migration, new DB test, full CI, lint, typecheck, build or audit has been run** on this cumulative branch. The next roadmap slice is timetable-slot and conflict integrity, then attendance/lesson planning foundations. PR stays draft, no `main` merge/deploy/release.

## Phase 5 timetable conflict foundation (awaiting local verification)

The `feature/timetable-conflict-foundation` branch authors school-owned room/slot/event models and a migration with PostgreSQL `btree_gist` teacher/class/room overlap exclusions, plus three school-admin-only room/slot/cancellation POST routes and six database-backed regression cases. Scheduling requires the exact ACTIVE school-owned session/term teacher allocation, while cancelled slots remain audit history. **The migration, tests, lint, TypeScript, build, and CI-equivalent audit have not run.** Protected timetable read UI, room lifecycle, actual concurrent collision evidence and Phase 6 lesson attendance remain pending. No merge or deployment is authorized.

## Phase 5 timetable administration workspace (awaiting local verification)

The cumulative `feature/school-admin-timetable-workspace` branch adds a protected, server-rendered weekly timetable view, a client editor for school-owned room/scheduling/cancellation POST flows, and a read helper that repeats active school-membership/role predicates for every selected record collection. An academic setup navigation link is visible only after server permission checks. Five database-backed isolation cases cover active school data, wrong-school and teacher denials, membership revocation, SQL query scopes, and cancelled-booking exclusion. **No new test, actual browser run, build, local PostgreSQL migration, or complete CI-equivalent audit has been executed.** Student timetables, room lifecycle, timetable editing, planned-term previews, capacity/stream allocation and Phase 6 attendance/lesson-note workflows remain open.

## Phase 6 lesson-note author drafts, immutable revisions and submission (unverified)

The cumulative `feature/lesson-note-drafts-and-submission` branch authors `LessonNote`, `LessonNoteRevision`, `LessonNoteEvent` schema and an additive SQL migration, a teacher-only transactional authoring service, five authenticated school-scoped HTTP operations, and six real-session database integration cases. Notes are bound by composite foreign keys to an ACTIVE same-school academic term/session and exact teacher/class/subject assignment. A teacher can create, list/view own notes, revise a DRAFT with a version check and submit it; content and audit events remain immutable. **SUBMITTED does not mean approved or published.** HM/Principal section-scoped review/return, release to verified enrolled students, schemes of work and attendance remain separate Phase 6 slices. No new migration, Vitest integration test, formatter/lint/typecheck/build or CI-equivalent dependency audit has run on this branch. No student data or production environment was accessed.

## Phase 6 teacher lesson-note authoring workspace (awaiting verification)

The cumulative `feature/teacher-lesson-planning-workspace` branch adds a Better Auth guarded teacher lesson-note page, a teacher-specific term/assignment option selector that repeats school/role/member scope in its final DB queries, a draft/revision/submission editor reusing the protected Lesson Note APIs, and home navigation exclusively for active teacher-role memberships. Four direct database-backed option-scope cases are authored, complementing six earlier lesson-note API cases. **No migrations, new tests, browser accessibility flows, lint, typecheck, production build or full CI-equivalent dependency audit were run.** School review/revision-return, signed-off publication, student visibility, schemes of work and attendance enrollment requirements are not implemented.

## Phase 5–6 Section/class ownership prerequisite (unverified)

The cumulative `feature/verified-school-section-ownership` branch adds a school-owned PRIMARY/SECONDARY Section model, nullable same-school class section reference with no legacy inference, two school-admin section-configuration mutations with reasoned audit, and principal filtering of verified foreign/inactive SECTION IDs. Five real-session DB integration cases are authored; **no migration, test, format, lint, typecheck, build or full CI audit was run**. HM/Principal section-scoped review, timetable writes, student enrollments and attendance remain closed until exact class-to-section and stage checks are independently implemented.

## School section/class configuration interface (awaiting local verification)

The cumulative `feature/school-section-setup-workspace` branch extends the protected school admin academic setup reader/editor to list explicit primary/secondary sections and class mapping, create sections and assign unclassified classes through the previously authored audited school-owned APIs. Two new tenant-isolation DB tests are authored. **No migration, DB test, real browser, lint, typecheck, build or full CI-equivalent audit has run**. The new UI does not grant HM/Principal approval or attendance authority, nor reclassify old rows automatically.

## Phase 6 section-scoped lesson-note review (development candidate, unverified)

The cumulative `feature/section-scoped-lesson-review` branch implements HEAD_OF_SECTION PRIMARY-only and PRINCIPAL SECONDARY-only review of SUBMITTED lesson notes tied to the exact active school-owned class section and verified grant. It authors a PostgreSQL status/event enum extension, reasoned immutable review-event trigger validation and a one-decision-per-revision unique index; three private/no-store reviewer routes; and seven real-session DB integration scenarios. A RETURNED note requires a new immutable original-teacher revision before resubmission; APPROVED does not publish. **SQL migration, DB tests, concurrent approvals, formatting, TypeScript, build, real Next/browser and full CI-equivalent audit are not executed**. Reviewer UI, section stage/scopes at other academic routes, enrollments, student release and attendance remain pending; do not call LES-REQ-001 or SEC-REQ-001 complete.

## HM/Principal lesson reviewer workspace (draft, pending verification)

The cumulative `feature/lesson-reviewer-workspace` branch extends section-scoped lesson-review APIs with a restricted Next server reviewer page, guarded school-detail navigation and a client queue/detail UI for reasoned `APPROVE` or `RETURN` using exact revision numbers. Four new synthetic DB-backed navigation tests are authored; prior seven review API tests remain authored but unexecuted. **No new DB test, migration, browser, typecheck, build, format/lint or full local CI audit has run**. Both approval and return preserve immutable history; APPROVED content stays non-public. Enrollment and student release, class-specific attendance, HM/Principal timetable control and production readiness remain out of scope.

## Student enrollment ledger foundation for attendance (unverified)

The cumulative `feature/student-enrollment-ledger-foundation` branch adds school-owned `StudentRecord`, `StudentEnrollment` and immutable `StudentEvent` models plus an additive migration; three private `school:configure` admin-only routes register a distinct student, place them into an ACTIVE session and explicitly section-classified class, and withdraw while preserving historical class/session. No legacy/student User link or historic mapping is inferred; no student/guardian/teacher record list or attendance endpoint exists. PostgreSQL composite tenant FKs and one-ACTIVE-per-student/session partial uniqueness guard accidental cross-school or duplicate enrollments. Six new disposable DB integration scenarios are authored; **migration, tests, concurrent checks, typecheck/lint/format, Next build/browser and full unchanged CI-equivalent audit have not run**. ADM-REQ-001, ATT-REQ-001, TEN-REQ-001 and SEC-REQ-001 remain partial/unverified. A school-owned enrollment history is a prerequisite, not full admission, attendance or release authorization.

## Current evidence

- Published development checkpoint: `checkpoint/phase1-tenant-safe-foundation`; `main` remains unchanged
- Remote review: commit `2c7c6b9a905272ac5f9cc70d06b67367b2c1c791` was verified on [draft PR #1](https://github.com/Wilberry/myschoolboard/pull/1) on 2026-10-11; consult live Git history for subsequent changes
- Application stack: Next.js 16, React 19, TypeScript, Better Auth, Prisma, PostgreSQL
- Database: local PostgreSQL running on port 5433
- CI workflow: present in [.github/workflows/ci.yml](../../.github/workflows/ci.yml). The first draft-PR GitHub Actions run completed with failure; individual failure steps have not yet been confirmed, and the high-severity audit gate remains enabled
- Application implementation: Better Auth local session integration and server-side tenant checks exist for implemented paths
- Fresh validation on 2026-10-11: the full working-tree suite passed 83 tests across 8 files, including the private-storage prototype. A separate exact candidate reconstructed from HEAD plus the selected publication manifest passed 78 tests across 7 files. Prisma Client generation succeeded; all 6 migrations and guarded demo seed succeeded against a tmpfs-backed disposable PostgreSQL service, which was removed afterward. Formatting, lint, typecheck, Prisma validation, and production build passed for the reduced candidate. Route tests invoke handlers directly with real Better Auth sessions and PostgreSQL; Next request context is stubbed. This is not full server/browser E2E.
- Deployment configuration: not implemented; hosting remains explicitly deferred
- Security model: server-side authorization and tenant membership checks enforced; RLS is not enabled
- Academic assignment foundation: school-scoped models, active normalized-name indexes, Better Auth-backed management service, assignment-aware policy helper, transactional row-lock revalidation, and database-enforced audit association are implemented in the current working tree. Four school-scoped mutation routes (create, deactivate, revoke, reactivate) call the transactional service and pass route-level integration coverage. No assignment UI, list/detail route, or academic read route exists; assignment read authorization remains unresolved under D-020. TCH-REQ-001, TEN-REQ-001, and SEC-REQ-001 remain specified and incomplete; Phase 4/5 remain incomplete.
- Dependency audit: full audit reports 8 high package entries from two advisories; production-only audit reports 3 entries from the Prisma/deepmerge-ts advisory. D-022 Option C is approved through 2026-10-18 only for the scoped development feature branch and draft PR, with disclosure and the unchanged CI audit gate; it is not production risk acceptance and does not authorize push. D-015 Option A remains active outside this narrow exception. The checkpoint push and draft PR were separately authorized and completed; no merge, deployment, release, or dependency override is approved. See [assessment](../security/DEPENDENCY_ADVISORY_ASSESSMENT.md).

## Pending local-CI follow-up

On the separate `feature/local-verification-and-health` development branch, a dependency-free liveness endpoint and its focused tests have been added, together with a guarded script to run the unchanged GitHub Actions command sequence locally against the disposable test database. GitHub Actions runners remain unavailable because of an owner-reported billing restriction. **These changes have not yet passed the full local application CI sequence**, so they are not evidence of a completed Phase 1 exit gate. The eight previously identified high-severity dependency findings remain open; no merge, production release, or deployment is permitted by D-022. See [Local CI Verification Runbook](../quality/LOCAL_CI_RUNBOOK.md).

## Additional security follow-up awaiting local verification

On the separate `feature/school-read-response-hardening` branch, the existing authenticated school-details endpoint is hardened with explicit private/no-store responses and exception-safe error logging. Its integration assertions and security-testing documentation are extended. These changes are not yet locally database-tested and do **not** complete TEN-REQ-001 or SEC-REQ-001. No permission, tenant-isolation, or database schema semantics are relaxed.

## Phase 2 school-read tenant hardening awaiting verification

The `feature/recheck-school-membership-on-read` follow-up adds a final database-query filter on authenticated user, active membership, current membership role, and active school to the existing school read helper. Three integration cases were added for inactive schools, removed academic-reader role, and required final-query ownership predicates. This is a defensive improvement against a revoke/role-change window between authorization and the school lookup; it does not establish full transaction-wide read linearizability. **No database-backed tests or full CI-equivalent checks have been executed for this commit.** D-020 assignment-reader policy remains unresolved; no new read routes were introduced.

## Teacher-assignment mutation cache safety awaiting verification

The `feature/no-store-assignment-mutations` follow-up adds an explicit private/no-store header to all four school-scoped assignment mutation routes through their shared HTTP handler. Status codes, authorization, database transactions and append-only audit logic are unchanged. Route-level regression assertions are written, not executed. No new assignment read routes were added; D-020 remains unresolved.

## Policy-aligned school navigation awaiting verification

On `feature/policy-aligned-school-navigation`, the home workspace retains active membership cards but only displays a school-detail link for memberships eligible under the existing school-level `academic:read` policy. Other roles see a non-clickable restricted label instead of a link to a predictable 404. No new permission is granted; the destination remains server-authoritative. Focused role matrix tests were added but not yet executed in the owner's final local verification batch.

## Sanitized school-read denial monitoring awaiting verification

The `feature/safe-school-read-denial-logs` follow-up adds a best-effort, minimal `school_read_denied` operational event for concealed school metadata `404` responses, with randomized request ID only. Two database-backed tests were authored for cross-school/missing-resource parity and logger failure. No tenant or user identifiers are logged, and the denial response remains unchanged if logging fails. **Tests have not been executed for this follow-up.** This is diagnostic logging rather than a protected immutable security audit trail; full SEC-REQ-001 remains open.

## Phase 2 client-session reliability awaiting verification

On `feature/resilient-auth-ui`, sign-in and sign-out buttons now handle explicit provider failure and rejected network requests without getting stuck or falsely refreshing on failed sign-out. A small shared async result helper and four focused unit cases were added. Sign-out displays generic error feedback and disables the button while pending. This is not a replacement for server-side session security, rate limiting, email verification, or browser E2E tests. **The new unit tests and full CI-equivalent checks have not been run.** External identity and production auth posture remain unresolved.

## Phase 2 session-revocation regression coverage (pending local verification)

The `feature/session-revocation-tenant-regressions` follow-up adds four DB-backed integration cases without modifying production code: reusing a cookie after deleting the corresponding Better Auth session must deny school metadata reads and all four teacher-assignment mutations; platform-wide admin status cannot bypass another school's membership; and role demotion must immediately block assignment creation even when the login session is still active. The cases exercise existing server-side checks with real Better Auth sessions and synthetic database fixtures. **They have not been run for this follow-up.** Session durability, global sign-out behavior, cross-deployment cache invalidation, login abuse rate limiting, MFA, and verification policies remain unresolved.

## Phase 2 verified scope authorization (awaiting local verification)

The `feature/require-verified-scope-grants` branch tightens the shared policy so section, class, and subject grants require `verified: true` rather than granting access merely because a matching `ScopeGrant` exists. Four focused regression cases verify rejection of unverified grants, acceptance of exact verified grants, and denial of a verified grant for the wrong resource. Existing child relationship validation and subject-teacher exact active assignment requirements remain unchanged. This permission tightening may affect any future or existing workflow storing an unverified grant; audit such consumers before merge. **Tests have been authored but not executed.** TEN-REQ-001, USR-REQ-001, SEC-REQ-001 remain open.

## Phase 2 school-owned class/subject grant resolution (pending local verification)

The `feature/bind-grants-to-active-school-resources` follow-up prevents verified class or subject scope IDs from granting permission when they belong to another school or refer to inactive resources. Its principal resolver queries the requested school's active class/subject records and filters resolved `ScopeGrant` data accordingly. Two database-backed cases add cross-school and deactivated-resource negative coverage. The [Phase 2 acceptance matrix](../quality/PHASE2_ACCEPTANCE_MATRIX.md) lists complete release gates and local-verification evidence requirements. **The new integration cases and complete application CI sequence have not been run.** SECTION/CHILD model integrity, full HTTP/browser coverage, prod identity #17, immutable general security audit, and dependency risk remain unaddressed; Phase 2 is incomplete.

## Current roadmap phase

Phase 0 documentation baseline is complete.

The local engineering foundation is implemented and its listed local checks have passed for the app shell, Better Auth integration, schema, migration, seed, tenancy helper, and protected school access path. The broader Phase 1 engineering-plan definition of done is not fully met: there is no health endpoint, full HTTP/session integration coverage, CI-run evidence, production logging/audit implementation, or support-access workflow. This is local-development-ready only, not production-ready.

## Phase 1 completion gate

The local repository checkpoint is ready for review within the implemented scope, with these remaining gates:

- external identity-provider strategy remains unresolved
- hosting and deployment remain deferred
- PostgreSQL RLS remains intentionally not implemented
- no unrestricted routine support access; the exceptional access policy is approved, but its approval/enforcement/expiry/audit mechanism is unimplemented

## Outstanding decisions and blockers

- external identity-provider selection and production authentication controls
- hosting provider and domain, deferred until local development and testing are complete
- exceptional support-access mechanism implementation and security review
- payment-provider selection (Phase 9), parent-first report visibility (Phase 8), and QR disclosure (QR verification phase)
- remaining SEC-REQ-001 and TEN-REQ-001 acceptance criteria; these are not marked complete
- high-severity dependency findings must be resolved or explicitly risk-accepted before the configured CI gate can pass
- D-015 Option A still blocks merge, deployment, and release outside the approved D-022 development-only branch/draft-PR exception; the dependency findings require remediation or a separate explicit risk decision

## Next approved action

Continue the next unblocked Phase 2/3/4 roadmap work under D-023. D-020 now provides a conservative `school:configure` development default for assignment administration reads, and D-021 supplies additive academic-session/Form Teacher design direction. Build and test them without inventing historical periods or expanding sensitive access. Resolve actual provider, data migration, high-severity security audit and deployment/release gates separately; the existence of a default is **not** evidence a route or schema was implemented or tested.
