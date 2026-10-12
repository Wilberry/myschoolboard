# Requirements Traceability Matrix

## Attendance school calendar and correction windows — ATT-REQ-001 / SCH-REQ-001 (authored, not verified)

- `SchoolAttendancePolicyRevision` Prisma and `20261012210000_school_attendance_policy` additive migration: current school attendance configuration is the latest immutable verified-administrator revision, default UTC/7/30 for schools without revisions. SQL validates actor, revision, timezone, windows and immutable history.
- `school-date-policy.ts`, `policy-service.ts`: school-local calendar-day validation using IANA timezone and conservative UTC upper bound; submission and correction-request mutations read current policy in their serializable school-locked transaction; SQL event/request triggers repeat eligibility without trusting browser input.
- `app/api/schools/[schoolId]/attendance-policy`, `app/schools/[schoolId]/attendance-policy`: authenticated, active tenant `school:configure` admin editor and private POST with reasoned audit. Existing Form Teacher, HM and Principal permissions are not broadened.
- `school-date-policy.test.ts` and `policy.integration.test.ts`: authored, NOT executed. Missing DB migration verification, full CI, browser, holiday/calendar exception policy and historical acceptance. ATT-REQ-001/SCH-REQ-001/SEC-REQ-001 remain **partially authored, incomplete**.


## Attendance SQL bypass hardening — ATT-REQ-001/T-ATT-001 (unverified)

- Finding: prior DB SUBMITTED-event trigger verified original actor and **at least one** attendance entry, but did not require all active class/session enrolled pupils. API full-roster check was insufficient against bypassing the application using direct SQL.
- New migration: `20261012200000_attendance_complete_roster_guard` requires exact full active roster in the immutable SUBMITTED event transaction; bounded count, school lock and per-entry eligibility checks. Original database audit and authorization mechanisms retained.
- Tests: synthetic direct-SQL partial-class transaction rejection and rollback in `routes.integration.test.ts`, read-only `scripts/attendance-ledger-guard.test.mjs` included in `npm test`. **Authored, not run**. Ten GitHub content static-consistency presence checks were executed; these do not meet PostgreSQL, authorization or CI acceptance.
- Status remains **partially authored, unverified**; do not mark security/attendance complete.


## ATT-REQ-001 correction read/workspace extension — still unverified

- `src/modules/attendance/corrections-read.ts` and `corrections-read-http.ts`: Form Teacher current-primary-responsibility approved-register/entry queries and exact HM/Principal active-section pending queue/detail; select originalMark alongside latest APPROVED revision effectiveMark. Pending and RETURNED proposals are excluded from corrected effective value.
- `app/schools/[schoolId]/attendance-corrections` and `attendance-correction-reviews`: two separately server-restricted pages and client editors with explicit reasoned request/review interactions, bounded private projections.
- `corrections.integration.test.ts`: extended synthetic disposable-DB cases on cross-tenant/role denial, queue lacking pupil data, per-item stage/grant checks, pending/returned/approved overlay status and original mark retention. **Authored; not executed**. Related security, lifecycle, timezone, complete browser and local CI-equivalent gates remain pending.


## Correction subset ATT-REQ-001 / T-ATT-001 — authored, unverified

- `prisma/migrations/20261012190000_attendance_immutable_corrections/migration.sql`, schema models and actor/revision/immutability triggers: additive revisioned correction request + independent correction decision; never update original marks.
- `src/modules/attendance/corrections-service.ts`, `corrections-http.ts`: POST correction request on approved class attendance by currently responsible PRIMARY Form Teacher; POST decision by exact verified HM/Principal section; authenticated actor from Better Auth, serializable transactional guards.
- `src/modules/attendance/corrections.integration.test.ts`: synthetic real-session coverage for stale marks, skipped/overlapping revisions, returned and approved review, wrong/foreign/revoked actor, forged direct inserts, immutable events and concurrent request attempts. **Tests authored; NOT EXECUTED**.
- No correction UI, authorized effective-mark read, school configuration, migration/test/local CI gate evidence. ATT-REQ-001, TEN-REQ-001 and SEC-REQ-001 remain **not complete**.


## Attendance reviewer and Form Teacher workspaces — ATT-REQ-001 (additional unverified evidence)

- `src/modules/attendance/read-service.ts`: one-statement authenticated active PRIMARY Form Teacher roster; verified-stored-section Head/Principal queue and detail; bounded 500-pupil view and 100-item queue, generic unauthorized denials; private GET handlers in `app/api/schools/[schoolId]/attendance/roster` and `attendance-reviews`.
- `src/modules/attendance/navigation.ts` and `app/schools/[schoolId]/attendance*`: independently restricted server page options and client submission/review editors. No default pupil mark and no broad student record visibility.
- T-ATT-001 additional evidence: `reads.integration.test.ts` covers active-role exact class access, unauthorized subject-teacher denial, HM/Principal stage and verified scope, queue projection, detail minimization, revocation, query validation and server-page navigation. **Authored, NOT executed**.
- ATT-REQ-001 remains **partially authored and unverified** because corrections, configuration and full CI/browser acceptance are missing; SEC/TEN release gates unchanged.


## Phase 6 attendance mutation candidate — ATT-REQ-001 (unverified)

- Data: `AttendanceRegister`, `AttendanceEntry`, `AttendanceEvent`, composite school/student/enrollment/class/session FKs and SQL append-only audit/decision constraints in `20261012180000_attendance_register_ledger` (migration **authored, not run**).
- Server: `src/modules/attendance/service.ts` exact active roster/PRIMARY Form Teacher submission and HM/Principal section-grant decision functions; POST-only routes under `app/api/schools/[schoolId]/attendance`.
- T-ATT-001: `eligibility.test.ts` role/section policy cases and `routes.integration.test.ts` synthetic disposable database cases for duplicates, forged enrollment, role revocation, actor history, concurrent submissions and reviewer grants. **Tests authored, not executed**.
- Status: **Partially authored, unverified; NOT complete**. There is no teacher roster read/UI, reviewer queue/UI, approved correction/revision history, configured timezone or full acceptance/security evidence. TEN-REQ-001/SEC-REQ-001 remain independently open.


The matrix below links requirements to the canonical domains and expected roadmap phases. This is a specification-first matrix and can be used as the implementation baseline before code exists.

| Requirement ID | Module | Role/Permission | Workflow | Data Entity | API/UI Area | Test Case | Roadmap Phase | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PLAT-REQ-001 | Platform administration | Platform Super Admin | Tenant lifecycle | Tenant, Subscription | Admin console | T-PLAT-001 | Phase 3 | Specified |
| TEN-REQ-001 | Tenant isolation | All roles | Cross-tenant access validation | Tenant scope context | API auth, middleware | T-TEN-001 | Phase 2 | Specified |
| SCH-REQ-001 | School setup | School Super Admin, HM, Principal | Academic structure | School, Class, Subject | Config screens | T-SCH-001 | Phase 4 | Specified |
| USR-REQ-001 | Identity and auth | Platform and school roles | Permission assignment | UserRole, ScopeConstraint | Auth service | T-USR-001 | Phase 2 | Specified |
| ADM-REQ-001 | Admissions | School admin | Student admission lifecycle | Student, Guardian, Enrollment | Student records | T-ADM-001 | Phase 4 | Specified |
| TCH-REQ-001 | Teacher assignments | HM, Principal, Teacher | Assignment and conflict validation | TeacherClassSubjectAssignment | Staff assignment screens | T-TCH-001 | Phase 5 | Specified |
| ATT-REQ-001 | Attendance | Form Teacher, HM, Principal | Submit/approve attendance | AttendanceRegister, AttendanceEntry, AttendanceEvent | Private POST only (no UI/read) | T-ATT-001 | Phase 6 | Partially authored — unverified |
| LES-REQ-001 | Lesson notes | Teacher, HM, Principal | Approval and release | LessonNote | Academic planning | T-LES-001 | Phase 6 | Specified |
| ASM-REQ-001 | Assessments | Teacher, HM, Principal | CBT and assessment scoring | Assessment, Score | Assessment UI | T-ASM-001 | Phase 7 | Specified |
| RES-REQ-001 | Results and report cards | Teacher, HM, Principal, School Super Admin | Approve and publish report cards | ResultSheet, ReportCard | Results area | T-RES-001 | Phase 8 | Specified |
| FEE-REQ-001 | Fees and payments | School admin, Parent | Payment and receipt workflow | FeeObligation, Payment | Finance portal | T-FEE-001 | Phase 9 | Specified |
| COM-REQ-001 | Communication | School admin, Teacher, Parent | Notice board and class announcements | Notice, Announcement | Communication UI | T-COM-001 | Phase 10 | Specified |
| LIB-REQ-001 | Library | Teacher, Student, Parent | Resource access | LibraryResource | Library portal | T-LIB-001 | Phase 10 | Specified |
| SEC-REQ-001 | Security | All roles | Security and session controls | UserSession, AuditEvent | Auth and security | T-SEC-001 | Phase 1 | Specified |
| DEL-REQ-001 | Trash and recovery | School admin, Platform Super Admin | Trash retention and restore | TrashRecord | Recovery screens | T-DEL-001 | Phase 11 | Specified |
| AUD-REQ-001 | Audit and notifications | All roles | Audit and notifications | AuditLog, Notification | System operations | T-AUD-001 | Phase 10 | Specified |
| SUB-REQ-001 | Subscription management | Platform Super Admin | Plans and entitlements | Subscription, Plan | Platform admin | T-SUB-001 | Phase 3 | Specified |
| OPS-REQ-001 | Engineering operations | Engineering team | CI, migrations, monitoring | BuildConfig, Migration | DevOps and repos | T-OPS-001 | Phase 1 | Specified |

## Phase 6 LES-REQ-001 implementation evidence (authored, not verified)

- T-LES-001 authoring subset: school-bound TEACHER draft/revision/submit APIs and teacher authoring workspace, immutable content revision/event history; authored integration tests remain unexecuted.
- T-LES-001 review subset: `HEAD_OF_SECTION` PRIMARY and `PRINCIPAL` SECONDARY class-section-aligned reviewer queue/detail and reasoned approve/return transactions, with a verified same-school SECTION ScopeGrant, teacher resubmission after a new revision, and audited persisted decision history. Seven additional real-session DB integration tests are authored, **not executed**.
- LES-REQ-001 remains **partially implemented, not verified and not complete**: no approved-note student release, verified pupil enrollment, comprehensive school-configurable review delegation, final browser verification or full CI-equivalent gate.
- Related isolation evidence for TEN-REQ-001/SEC-REQ-001 remains scoped to authored tests and static inspection; it does not mark those cross-cutting requirements complete.

## Admissions/enrollment dependency evidence — ADM-REQ-001 and ATT-REQ-001 (unverified)

- Phase 4 ADM-REQ-001 registration subset: a school-owned StudentRecord with school-specific admissionNumber, minimal names and REGISTERED→ENROLLED→WITHDRAWN status, and authenticated administrator-only registration. This is an **authored unverified** subset, not full inquiry/acceptance, transfer, promotion or graduation.
- Phase 6 ATT-REQ-001 prerequisite: an explicit school/class/academic-session StudentEnrollment ledger with ACTIVE/ENDED history, no legacy/user auto-link, composite tenant foreign keys, one ACTIVE enrollment per student/session and reasoned immutable actor events. It cannot yet authorize attendance or student-visible notes by itself.
- T-ADM-001/T-ATT-001: six real-session/disposable PostgreSQL route integration tests authored but **not executed**; concurrent uniqueness, class reclassification and student-account linking tests remain future work.
- **Neither ADM-REQ-001 nor ATT-REQ-001 is complete**, and related SEC/TEN release evidence remains outstanding.

## Traceability rules

- Every requirement must attach to a specific module, workflow, and expected test coverage.
- Deferred requirements remain in the matrix and must not be removed.
- Implementation status must be recorded as verified, specified, proposed, resolved, or deferred according to actual evidence.
