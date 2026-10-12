# Requirements Traceability Matrix

The matrix below links requirements to the canonical domains and expected roadmap phases. This is a specification-first matrix and can be used as the implementation baseline before code exists.

| Requirement ID | Module | Role/Permission | Workflow | Data Entity | API/UI Area | Test Case | Roadmap Phase | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PLAT-REQ-001 | Platform administration | Platform Super Admin | Tenant lifecycle | Tenant, Subscription | Admin console | T-PLAT-001 | Phase 3 | Specified |
| TEN-REQ-001 | Tenant isolation | All roles | Cross-tenant access validation | Tenant scope context | API auth, middleware | T-TEN-001 | Phase 2 | Specified |
| SCH-REQ-001 | School setup | School Super Admin, HM, Principal | Academic structure | School, Class, Subject | Config screens | T-SCH-001 | Phase 4 | Specified |
| USR-REQ-001 | Identity and auth | Platform and school roles | Permission assignment | UserRole, ScopeConstraint | Auth service | T-USR-001 | Phase 2 | Specified |
| ADM-REQ-001 | Admissions | School admin | Student admission lifecycle | Student, Guardian, Enrollment | Student records | T-ADM-001 | Phase 4 | Specified |
| TCH-REQ-001 | Teacher assignments | HM, Principal, Teacher | Assignment and conflict validation | TeacherClassSubjectAssignment | Staff assignment screens | T-TCH-001 | Phase 5 | Specified |
| ATT-REQ-001 | Attendance | Form Teacher, HM, Principal | Submit/approve attendance | AttendanceRecord | Attendance dashboard | T-ATT-001 | Phase 6 | Specified |
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
