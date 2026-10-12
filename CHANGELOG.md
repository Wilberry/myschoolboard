# Changelog

## 2026-10-12 — School-owned section/class association (unverified)

- Added named primary/secondary Section model and nullable same-school Class.sectionId, preserving old unclassified classes without guessed backfills.
- Added school-admin-only section creation and initial class placement with serialized authorization, reasoned audit and no silent reclassification.
- Principal SECTION grants now require active same-school ownership. Five disposable-DB regression scenarios are authored; **not executed**. Reviewer/student/attendance routes and HM/Principal timetable expansion remain restricted.
- No `main` merge, deployment or security audit waiver.

## 2026-10-12 — Teacher lesson-note authoring workspace (unverified)

- Added protected `/schools/{schoolId}/lesson-notes` and teacher-role home navigation, with scoped active academic term/class/subject/session assignment form options, own-note list and immutable revision viewer.
- Added a client editor to create DRAFT notes, append expected-version revisions and submit current drafts through the existing authenticated APIs. No release or school approval route was added.
- Four new synthetic/disposable PostgreSQL option isolation tests were authored. **No browser, database, CI audit, build or migration verification has run.** No student-facing release, `main` merge or deployment.

## 2026-10-12 — Teacher-owned lesson-note drafting and submission (unverified)

- Authored draft-only `LessonNote`, immutable numbered `LessonNoteRevision`, and append-only `LessonNoteEvent` data with composite tenant/session/term/class/subject/assignment FKs. No historic teaching assignment or student record is rewritten.
- Added authenticated exact-active-teacher APIs to create, list/view own notes, revise with optimistic expected-version protection and submit for separate approval. Submitted does **not** imply official release.
- Six real-session disposable-PostgreSQL integration cases cover denial, ownership, stale versions, history immutability and access after revocation/term closure. **No migration, tests or full CI-equivalent verification have run.** HM/Principal approval and released student reads remain blocked pending verified section/enrollment scope.
- No `main` merge, production release, deployment or `npm audit` bypass.

## 2026-10-12 — Protected school timetable administration workspace (unverified)

- Added a school administrator timetable screen linked from academic setup, with room configuration, exact teacher-assignment scheduling and audited cancellation through existing POST APIs.
- Added a server-side timetable snapshot reader with active same-school membership/role filters in each final SQL query and capped minimal data projections; five disposable PostgreSQL isolation tests were authored.
- No student timetable, public read API, new schema, deployment, audit waiver or merge. Local database, Next browser/accessibility, format/lint/typecheck/build and unchanged audit checks remain **not yet executed**.

## 2026-10-12 — Tenant-scoped timetable conflict foundation (unverified)

- Added TimetableRoom/TimetableSlot/TimetableEvent and school-bound composite academic term/assignment relationships, plus PostgreSQL btree_gist exclusions for concurrent ACTIVE teacher/class/room time conflicts.
- Authored three protected administration endpoints for room configuration, scheduled slots and audited cancellation, and six disposable-DB regression cases for denials, overlap, adjacency, cancelled history and active-term checks.
- **No migration, automated tests, full static/build checks or dependency audit was executed.** No historical teacher records were changed or production data accessed.

## 2026-10-12 — Form Teacher responsibility, co-teaching policy and handover (unverified)

- Authored separate tenant/session/class scoped Form Teacher responsibilities (PRIMARY and optional SUPPORT) with PostgreSQL primary/duplicate-active constraints and a dedicated append-only event ledger.
- Added school-admin-only assignment, handover, end-responsibility and school-specific co-responsibility policy APIs, with serializable authorization, active session/class/teacher membership checks and immutable actor/reason audit.
- Added six disposable-DB integration cases, including dual Form Teacher/subject teacher permission separation, cross-school denials, historical handover, SUPPORT policy gating and event tamper rejection. **These cases and the migration have not yet run**.
- No destructive update to historical teacher-subject allocations, academic publication, child access, `main` merge, deployment or audit bypass.

## 2026-10-12 — Session-aware subject teacher assignments (unverified)

- Extended teacher-class-subject assignments with nullable school-owned academic session references and a safe split between legacy NULL-session uniqueness and distinct period-based uniqueness; no historic period was guessed or backfilled.
- Existing create/reactivate mutation services require any supplied session to be ACTIVE and owned by the target school. Tenant principal resolution excludes assignments attached to nonactive periods; teacher academic policy now requires an exact session match.
- Updated administration GET to show nullable `sessionId`; added policy and database route regressions for period isolation and legacy coexistence. No migration, full test, typecheck, build or audit has yet been executed for this cumulative development candidate.

## 2026-10-12 — Academic period activation and closure (unverified)

- Added reasoned session/term PLANNED→ACTIVE→CLOSED status transitions, with school-admin-only HTTP handlers, serializable membership revalidation, audit event types and stored justifications.
- Enforced activation of a parent session before its term and closure of all terms before session closure; database partial unique indexes protect single-active-period constraints.
- Added school setup Activate/Close controls, pure transition tests and disposable-database integration cases, all **awaiting** full local validation.
- No legacy teacher assignment period mapping, grading-history rewrite, physical deletion, `main` merge, CI audit change or production deployment.

## 2026-10-12 — School setup workspace (unverified)

- Added a school-scoped academic setup page with an interactive creation form for planned sessions/terms and school-owned class/subject catalogs.
- Added a server-side snapshot reader limited to 100 records per collection, repeating school ownership and administrator membership checks in final Prisma queries, and a permission-conditional school-detail navigation link.
- Added four disposable PostgreSQL read-isolation cases for active administrator access, cross-school denials, revocation and final query constraints. The local full CI, migration, route transport and browser UX/accessibility tests have **not** run.
- No change to `main`, academic publication, teacher assignment history, payment data, dependency audit or production permissions.

## 2026-10-12 — Academic sessions, terms and catalogs (unverified)

- Added additive, tenant-scoped `AcademicSession` and `AcademicTerm` models with date checks, uniqueness, one-active-period guards, and a dedicated append-only `SchoolConfigurationEvent` ledger.
- Added four school-admin-only create endpoints for PLANNED sessions/terms and active class/subject catalogs, with school actor revalidation inside serializable transactions, contained term dates, and no silent period assignment to historic teacher rows.
- Added five disposable-DB integration cases for authorization, tenant ownership, date validation, duplicates and audit integrity. These are **authored but not executed**; session activation/closure, school configuration UI, curriculum/sections and period-aware staffing remain subsequent roadmap tasks.
- No production migration, `main` merge, deployment, CI audit bypass or dependency risk acceptance.

## 2026-10-12 — Platform school onboarding and lifecycle foundation (unverified)

- Added a nullable legacy-safe School lifecycle status, dedicated append-only platform lifecycle event ledger and an additive SQL migration with actor validation and mutation/truncate protection triggers.
- Authored platform-only Better Auth onboarding and school status transition services and POST handlers; create is Pending/inactive, and approved state changes update `isActive` atomically with lifecycle and event.
- Added transition-policy unit cases and disposable-DB integration cases. Subscription plans, school staff invitation, tenant management UI, expired/suspended export policy and production verification are not implemented.
- **No migration or application verification was run for this follow-up.** No change to `main`, CI audit gate, production credentials, or live tenant data.

## 2026-10-12 — D-020 school-scoped assignment administration reads (unverified)

- Implemented draft `GET` list/detail handlers for teacher-assignment administration with `school:configure` membership checks and **final-query** active school/role revalidation; cross-school identifiers/cursors remain concealed.
- Added limited-field, non-cacheable read responses and 50-record cursor pagination; no audit-event read route or physical deletion was exposed.
- Authored eleven database-backed integration cases and reconciled the mutation-route export regression test for the added collection GET.
- No schema migration, production auth-policy expansion, CI workflow adjustment, merge or deployment. Local database tests and complete CI-equivalent verification are **pending** under the owner's agreed local-run process.

## 2026-10-12 — Standing roadmap-led development governance (documentation only)

- The Project Owner authorized D-023 and [Standing Development Mandate](docs/project/STANDING_DEVELOPMENT_MANDATE.md) to remove per-feature/per-branch approval loops for routine work already specified in the charter, requirements, and roadmap.
- Clarified AGENTS.md, charter, scope, decision register, architecture/roadmap status and security assessment so development can proceed using documented reversible, configurable, least-privilege defaults.
- Adopted D-020's restricted `school:configure` development default for future teacher-assignment administration reads and D-021/P-013–P-017's additive academic staffing design defaults; **no read handler, new school policy, migration or feature implementation is claimed by this documentation change**.
- Preserved the historical D-022 2026-10-18 exception record without treating it as a recurring engineering deadline or expanding its security risk acceptance; all high-severity dependency findings and the unchanged high-severity audit gate remain active release concerns.
- No merge, deployment, production risk acceptance, production-auth policy activation, or database operation occurred as part of this governance revision.

## 2026-10-09 — Initial documentation baseline

- Added the initial documentation set for the multi-tenant school management SaaS specification.
- Established the canonical project documentation structure and governance model.
- Recorded the repository baseline as a documentation-first specification project.
- Added functional, security, architecture, roadmap, and requirements traceability documentation.

## 2026-10-09 — Repository status correction

- Corrected stale statements that referred to an empty repository with no Git history.
- Updated the documentation to reflect the live Git state: the repository contains a documentation baseline commit on main.
- Clarified that the repository is documentation-only and not an application implementation.

## 2026-10-09 — Phase 1 planning and approval register

- Added the proposal-level engineering plan for the first implementation foundation.
- Added the product-owner approval register for Phase 1 decisions.
- Clarified the distinction between the original baseline commit and the current live documentation state.

## 2026-10-09 — Local Phase 1 foundation and verification

- Added a local Next.js/TypeScript application foundation using Better Auth, Prisma, and PostgreSQL.
- Added the initial Prisma schema and migration, local PostgreSQL configuration, and synthetic development seed.
- Added server-side authorization and tenant-context checks and focused tests.
- Added a protected school-details path and CI quality workflow.
- Recorded the approved local stack separately from unresolved external identity, hosting/domain, RLS, and later-phase product decisions.
- Verified database generation/deployment and seed, 17 tests, lint, typecheck, formatting, and production build locally.
- This checkpoint does not claim production readiness or complete all SEC-REQ-001 / TEN-REQ-001 acceptance criteria.
- Final review found 8 high-severity dependency audit findings (3 remain with production-only audit); the configured CI audit gate is not passing.

## 2026-10-11 — Reduced checkpoint reconciliation

- Excluded the local private-storage prototype from the proposed first GitHub checkpoint; the prototype remains in the working tree and is not required by the application.
- Excluded unused Next.js starter assets from the candidate manifest: the app favicon and unused page CSS module, plus the unreferenced public SVG assets.
- Removed the unused `PRIVATE_STORAGE_ROOT` setting from the environment example, runtime schema, and CI workflow.
- Reconstructed the exact candidate from HEAD plus the selected manifest: 28 modified tracked files and 53 selected new files, with 58 unchanged HEAD paths retained. In that isolated tree, all 6 migrations and guarded demo seed succeeded, 78 tests across 7 files passed, and formatting, lint, typecheck, and production build passed. The known dependency audit blocker remains.
- D-022 Option C was subsequently approved for 2026-10-11 through 2026-10-18, strictly for a development branch and draft PR. D-015 Option A remains active outside that narrow exception; merge, deployment, and release remain prohibited.

## 2026-10-11 — Development checkpoint published for draft review

- Published the exact 81-path checkpoint (53 added, 28 modified) to `checkpoint/phase1-tenant-safe-foundation` at commit `2c7c6b9a905272ac5f9cc70d06b67367b2c1c791`; `main` was not changed.
- Opened [draft PR #1](https://github.com/Wilberry/myschoolboard/pull/1) with D-022 risk disclosure and no merge or deployment.
- The first GitHub Actions run completed with failure. The audit gate remains enabled, and its 8 high findings (3 production-only) remain unresolved; the failed step(s) must be confirmed separately.
- The historical local reduced-candidate validation remains 78 passing tests across 7 files and 6 applied migrations. No CI or production-readiness claim follows from these historical results.

## 2026-10-11 — Local verification and liveness follow-up (unverified)

- Prepared an independent feature branch with a public, dependency-free liveness probe and two focused tests.
- Prepared a guarded local execution script for the unchanged GitHub CI npm command sequence, separate preflight/guard tests, and a disposable-database runbook. Hosted GitHub Actions remain unavailable under the owner-reported billing restriction.
- The full application verification has **not** run for this follow-up. The dependency findings, D-022 expiry, and merge/deployment restrictions remain unchanged.

## 2026-10-11 — School-read membership recheck (awaiting verification)

- Hardened the protected school metadata lookup to recheck the authenticated membership's active state and precise role in the same final database fetch, rather than relying only on an earlier resolved principal.
- Added three database-backed integration cases for school deactivation, loss of reader role, and required final-query membership constraints.
- No Prisma migration or academic-read policy change; all tests remain pending the owner's eventual disposable-database local verification checkpoint.

## 2026-10-11 — Assignment mutation response cache hardening (unverified)

- Added `Cache-Control: private, no-store` to successful and error responses from all four teacher-assignment lifecycle and create mutation routes.
- Added database-backed response cache assertions across `201`, `200`, `400`, `401`, `404`, `409`, and `500` outcomes, pending the owner's local verification run.
- No changed permissions, routes, migrations, audit triggers, or dependency/CI gates.

## 2026-10-11 — School workspace navigation alignment (unverified)

- Replaced misleading school-details links for membership roles denied by the existing school-level `academic:read` policy with a non-clickable restricted label.
- Added a presentation-only policy-based helper and role-matrix unit tests; the protected school details route remains authoritative.
- No academic permissions, tenant visibility, or database models were expanded. Local verification is deferred per the owner's instruction.

## 2026-10-11 — Sanitized school read denial logging (unverified)

- Added a best-effort `school_read_denied` operational event for authenticated, concealed school metadata denials with a generated request ID and no sensitive school, user, or cookie fields.
- Added two database-backed regression cases covering a missing versus cross-school request and thrown diagnostic logger behavior.
- No schema migration, new permissions, changes to HTTP response bodies/status, CI audit gate, or merge/deployment authorization; these tests are still pending local verification.

## 2026-10-11 — Authentication UI request resilience (unverified)

- Added shared client auth request handling to distinguish successful fulfilled calls from error responses and rejected network/transport requests.
- Updated sign-in to restore the pending state and show generic failure feedback; updated sign-out to prevent repeated requests, display failures, and refresh only after successful logout.
- Added four helper unit tests and updated sign-out error/loading styling. All new tests remain deferred to the owner's local verification checkpoint.
- No Better Auth server policy, session schema, tenant authorization, database migration, or CI audit gate changes.

## 2026-10-11 — Session revocation and tenant-boundary tests (awaiting verification)

- Added two school-route integration tests for replaying a revoked Better Auth cookie and confirming that an elevated platform role alone cannot access another school's metadata.
- Added two teacher-assignment route integration tests covering revoked authenticated sessions on all four mutations and demotion of an administrator with an otherwise active session, with no audit-event or assignment-state changes after denial.
- Existing session handling, production code, Prisma migrations, permission rules, and CI audit gate are unchanged. All four new tests remain pending the owner-requested disposable PostgreSQL verification checkpoint.

## 2026-10-11 — Require verified scoped academic grants (unverified)

- Updated the shared authorization policy to reject section/class/subject `ScopeGrant` records whose `verified` flag is false. Matching an identifier alone no longer establishes that scoped permission.
- Added a table-driven policy regression for all three scope types with verified/unverified variants, plus a wrong-resource verification case. Existing teacher assignment and child verification constraints remain intact.
- No database migration, new grant-management route, expanded privileges, or change to the CI security audit. All new tests remain pending final local verification; any legacy reliance on unverified grants needs review before merge.

## 2026-10-12 — Tenant-owned class and subject grant resolution (unverified)

- Hardened the school-principal resolver so verified CLASS/SUBJECT scope IDs must identify active classes/subjects in the requested school; grants pointing to another tenant or inactive resources are excluded from the policy principal.
- Added disposable-PostgreSQL regression cases for forged cross-school scope IDs and deactivated school-owned resources. No migrations, new academic routes, permission expansion, or production auth settings.
- Added a Phase 2 acceptance matrix recording local CI, HTTP/browser, identity and dependency blockers. These new tests and the full local pipeline are **not yet executed**; D-015/D-022 restrictions remain active.

## Current status

- Repository state: local Phase 1 foundation and documentation are being checkpointed; consult live Git history/status for commit and push state.
- Local app, migration, seed, CI workflow, and tests: present and locally verified to the extent described above.
- Hosting provider, domain, external identity provider, and production deployment: deferred or unresolved.
- PostgreSQL RLS: not enabled.
