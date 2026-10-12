# Milestone Checklist

## Phase 0 — Documentation baseline complete

- [x] Repository state documented with evidence
- [x] Documentation index and governance files established
- [x] Initial requirements, architecture, security, and roadmap baseline documented
- [x] Current status and blocker tracking updated to reflect the live repo state
- [x] Initial documentation commit created and pushed to origin/main

## Phase 1 — Local foundation implemented and verified

- [x] Approved technology stack selected and validated locally
- [x] Hosting and deployment model explicitly documented as pending
- [x] Engineering standards and local tooling baseline defined
- [x] CI workflow configured in [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [x] Security baseline and secret-handling model defined for development use
- [x] Database strategy and migration approach validated locally and recorded
- [x] Local app skeleton and protected school access path implemented; focused authorization and DB tenant-context tests pass
- [ ] Complete authentication/session integration coverage for HTTP routes and broader tenant operations (remains in Phase 2/security work)
- [ ] Validate the new public liveness route, local CI safety tests, and entire original CI sequence on an explicitly disposable test database; the endpoint/runner are added but the full verification is still outstanding

## Phase 2 — Pending implementation work

- [ ] Run the newly authored D-020 school-admin teacher-assignment list/detail tests on the disposable database, review final-query tenant scoping, and independently verify Next HTTP transport. No development draft alone satisfies this gate.

- [ ] Verify [Phase 2 acceptance matrix](../quality/PHASE2_ACCEPTANCE_MATRIX.md) on the exact cumulative commit using a disposable PostgreSQL test database and real HTTP/browser checks as applicable; current follow-up tests are authored but unexecuted.
- [ ] Validate school-owned active class/subject scope resolution and assess stored unverified/cross-school grants before any merge.
- [ ] Obtain production identity/session policy decisions under P-007 ([issue #17](https://github.com/Wilberry/myschoolboard/issues/17)); leave optional section/child resource reads unavailable until tenant ownership is proven.

- [ ] Auth and role model
- [ ] Tenant isolation controls
- [ ] Authorization audit tests

## Phase 4 — Academic structure foundation authored, not yet verified

- [ ] Test period activation and closure against actual PostgreSQL partial unique indexes and race conditions; verify role denial, required reasons, immutable event history and the school setup browser controls.

- [ ] Verify school setup workspace navigation, server-side role checks, final-query tenant predicates, create forms, non-cacheable API responses and 100-row display caps in local browser and disposable-DB tests.

- [ ] Apply academic session/term/configuration event migration on only a disposable PostgreSQL test DB; inspect FK ownership, date checks, unique positions and audit immutability.
- [ ] Run new same-school administrator create tests, malformed date and term-range tests, cross-school denials and existing teacher-assignment regression suite.
- [ ] Finish school configuration UI, current session activation/closure workflow, sections/streams, grading-policy versioning, and session-scoped teacher assignment evolution without fabricating legacy period mappings.

## Phase 3 — Pending implementation work

- [ ] Run and review platform lifecycle migration and transaction/audit tests on the explicitly disposable local database.
- [ ] Finish platform-operator school management views, staff enrollment, subscription plans/entitlements and tenant recovery policies; onboarding lifecycle source alone does not complete PLAT-REQ-001/SUB-REQ-001.

- [ ] School onboarding lifecycle
- [ ] Subscription management
- [ ] Platform admin operations

## Phase 5 — Form Teacher and timetable integrity

- [ ] Validate the administrator timetable page, school-isolated server reads, room/slot creation, weekday/minute input conversion, AJAX error handling, cancellation history, accessibility and Next HTTP session transport against the reviewed cumulative commit.
- [ ] Verify the read cap behavior and add school-configurable large-campus timetable pagination before marking a full timetable module complete.

- [ ] Apply timetable GiST extension/constraint migration on an explicitly disposable PostgreSQL DB; prove exact tenant foreign keys and concurrency-safe teacher, class and room conflict rejection.
- [ ] Run slot-create/cancel route tests and existing teacher/Form Teacher tenant/audit suites; verify exact active session/term/teacher relationship and preserved cancellation audit.
- [ ] Add school-admin timetable listing and editing UI plus room lifecycle policies, then progress to Phase 6 attendance and lesson planning.


- [ ] Apply the Form Teacher schema/migration on an explicitly disposable local test database, inspect PostgreSQL partial unique indexes and school-bound foreign keys, and confirm legacy subject assignments remain untouched.
- [ ] Verify six new real-session route/DB scenarios, audit event immutability, support-policy transition rules, school membership deactivation, atomic handover, and denial of unauthorized subject/child access.
- [ ] Implement and test tenant-owned timetable slots and conflicts (teacher, class, room, and academic period) without assuming school-specific bell times or a fixed curriculum; proceed to Phase 6 attendance/lesson notes only after safe timetable foundations.

## Phase 5 — Session-aware staffing foundation authored

- [ ] Validate nullable session FK, the legacy partial unique index and new period-specific unique key on an explicitly disposable PostgreSQL database; preserve all pre-existing NULL-session rows and audit events.
- [ ] Test active same-school session requirements at assignment create/reactivation and exclusion of closed sessions from teacher policy principals.
- [ ] Continue with separately authorized Form Teacher responsibility, school-configurable curriculum eligibility and timetable conflict detection.

## Phase 6 — Lesson notes and attendance (safe foundation under development)

- [ ] Apply additive student registration/enrollment migration only to the confirmed disposable local PostgreSQL test DB; validate same-school composite FKs, active-only uniqueness index, SQL StudentEvent state/actor checks and cascade behavior.
- [ ] Run six real-session registration/enrollment/withdrawal DB cases and previous Phase 2–6 tenant, identity, Section, assignment, lesson review suites. Add concurrent duplicate admission/session enrollment attempts and revocation races before release.
- [ ] Build full audited admissions promotion/transfer/graduation lifecycle and a narrow school-admin student overview, then use **verified active student/class/session enrollment** plus explicit Form Teacher/section authority for attendance; no student/guardian read until their identity relationships are verified.

- [ ] Check the HM/Principal reviewer page via actual Next browser: verified section-only navigation, direct URL denial, pending queue and complete submitted revision, required reason/confirmation, successful approve/return, stale-status generic error and no student release.
- [ ] Run four new school-section reviewer navigation DB cases together with seven reviewer service cases, earlier lesson teacher authoring cases, ScopeGrant tests and audit triggers on disposable PostgreSQL.

- [ ] Migrate reviewer status/event enum values and review reason constraint on disposable PostgreSQL; confirm existing lesson-note author events remain valid, review-event triggers enforce stage/exact section and partial unique index rejects duplicate review decisions.
- [ ] Run seven real-session reviewer DB scenarios plus earlier lesson authoring/section security tests; add concurrent stale-version reviewer races, revocation race and rollback evidence.
- [ ] Verify returned-note re-edit permissions, APPROVED-not-released behavior, generic errors and private no-store responses through real Next HTTP, then add scoped reviewer UI and separate student-release controls only after verified enrollment.

- [ ] Verify the school section setup forms in the local browser, including creation, active class classification, a previously classified class having no move action, cross-school rejection, safe error messages and keyboard labels.
- [ ] Run two additional section-reader SQL predicate/isolation tests together with the section mutation tests and all previous Phase 2–6 suites.

- [ ] Apply SchoolSection schema/migration to disposable PostgreSQL and verify previous classes remain unclassified (NULL) and other-school section IDs are rejected.
- [ ] Run five section creation/class placement/grant tests and real cross-section/stage denial tests before enabling scoped HM/Principal lesson-note approvals or timetable mutations.

- [ ] Verify teacher lesson-note UI home navigation and server page authorization, active school-owned teacher assignment/term options, note creation/edit/reload/submit, browser keyboard/accessibility, and revision conflict handling.
- [ ] Run four option-reader database tests and the six author API integration cases against only the explicitly disposable test DB; reject all foreign roles, private student requests and inactive assignment/period access.

- [ ] Apply draft lesson-note tables, exact composite tenant FKs and immutable revision/event triggers on **only** an explicitly disposable PostgreSQL DB; verify rollback and revision concurrency.
- [ ] Run six authored teacher-only lesson-note API integration cases plus earlier Phase 2–5 tests; verify no teacher self-approval, no student reads and no leakage across classes/schools.
- [ ] Add verified school-owned Section/class/reviewer scope before HM/Principal lesson-note approval or revision-return; add enrollment and pupil-class-term ownership before attendance and released lesson visibility.
- [ ] Build teacher authoring workspace and school approver queue as separately scoped features after server permissions are in place.

## Future phases

All subsequent phases remain pending until their entry criteria and required product decisions are satisfied. The completed local Phase 1 foundation does not imply that Phase 2 or later requirements are implemented or complete.
