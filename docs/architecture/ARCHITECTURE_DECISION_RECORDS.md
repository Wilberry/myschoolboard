# Architecture Decision Records

## ADR-001: Modular domain design

- Status: Approved
- Context: The platform includes many domains with different security and lifecycle needs.
- Decision: Use a TypeScript modular monolith with Next.js for the application and PostgreSQL for persistence. Organize domains behind explicit module boundaries.
- Consequences: Clear separation of concerns and easier testing.

## ADR-002: Relational database with tenant scope

- Status: Approved; locally implemented
- Context: The product requires strong invariants, versioning, historical records, and academic integrity.
- Decision: Use a relational database as the default persistence layer until evidence justifies otherwise.
- Consequences: Strong referential integrity and transactional guarantees.

## ADR-003: Tenant-aware security model

- Status: Partially implemented and locally tested
- Decision: School access must be checked server-side against an authenticated user's active membership. PostgreSQL RLS is not enabled.
- Consequences: Current routes and the protected school details page use application-level checks. This does not verify all future routes, mutations, exports, or background operations.

## ADR-004: Platform and school admin separation

- Status: Policy implemented and unit-tested; no platform administration feature exists
- Decision: Platform Super Admin and School Super Admin remain distinct operational identities.
- Consequences: Clearer access control and safer support models.

## ADR-005: Documentation-first baseline

- Status: Accepted
- Decision: No code implementation begins before the documentation set and requirement traceability are in place.
- Consequences: Slower start but stronger long-term quality.

## ADR-006: Local authentication and provider boundary

- Status: Better Auth implemented locally; external identity-provider decision deferred
- Decision: Use Better Auth for the local email/password development foundation. This does not select the eventual external identity provider or establish production authentication readiness.
- Consequences: Session checks are server-side in implemented routes. Email verification, MFA, production recovery, and provider integration remain unimplemented.

## ADR-007: Hosting and support access

- Status: Hosting deferred; support-access default approved, escalation mechanism unimplemented
- Decision: Defer hosting provider and domain selection until local development and testing are complete. Do not allow unrestricted routine support access. Any exceptional access must be authorized, scoped, time-limited, justified, and audited.
- Consequences: The exceptional-access approval, enforcement, expiry, and audit workflow remains a requirement before support access is built or enabled.

## ADR-008: School-scoped teacher class-subject assignments

- Status: Implemented and locally validated for schema and policy-helper scope; protected academic routes remain outstanding
- Context: Independent class and subject grants cannot establish that a teacher is assigned to their exact combination.
- Decision: Add school-owned class and subject records plus one `TeacherClassSubjectAssignment` per exact school, membership, class, and subject tuple. Enforce tenant consistency with composite foreign keys; use `NO ACTION` for assignment references to membership/class/subject and preserve the existing school deletion cascade.
- Consequences: Status transitions reuse the unique tuple row. Existing `ScopeGrant` data is not migrated or treated as assignment data. The service enforces active membership and `TEACHER` role under transactional row locks. Assignment lifecycle audit events use a composite assignment/teacher foreign key, an insert-time actor membership check, and append-only triggers. Protected academic routes remain outstanding.

## ADR-009: Assignment mutation ordering and audit identity retention

- Status: Approved and validated locally against the disposable PostgreSQL test database
- Context: Assignment authorization could otherwise race with membership revocation, and audit IDs were not associated with the assignment by database constraints. User and membership deletion currently cascade and must not silently rewrite audit history.
- Decision: Lock the school, actor membership, and relevant target rows inside each serializable mutation before checking current state. Enforce event-to-school/assignment/teacher consistency with a composite foreign key; validate actor membership/user/school on event insert. Keep actor IDs as immutable text snapshots without foreign keys. Preserve school cascade deletion as the existing explicit history-cleanup exception. Run database-writing tests only against the guarded disposable test database.
- Consequences: Concurrent revocation either precedes validation and denies/fails the mutation, or waits for a mutation that has already acquired the relevant locks. Actor membership may later be absent while its recorded IDs remain. Privileged database owners can bypass triggers/constraints. The migration and race, trigger, and cascade tests passed on the disposable PostgreSQL test database; CI and production validation remain outstanding.

## ADR-010: Verified class-section ownership for lesson-note review

- Status: Development default authored; migration and tests not yet executed.
- Context: The canonical lesson-note workflow requires HM/Principal review, while the tenant model now provides explicit primary/secondary `SchoolSection` ownership and verified SECTION grants. Merely supplying a valid section ID does not bind a note's class to that section.
- Decision: Map active `HEAD_OF_SECTION` to PRIMARY and `PRINCIPAL` to SECONDARY for the initial review flow, only with verified active same-school SECTION grants matching the note's **stored** `SchoolClass.sectionId`. Submitted-note reads perform a single school/class/section/grant SQL join. A reviewer transition locks/rechecks the same resources, checks `academic:approve`, and creates an append-only actor/reason/version event. APPROVED is not RELEASED. RETURNED requires a new author revision before resubmission; only one review decision is valid for each revision.
- Consequences: Unclassified classes, revoked grants, cross-stage reviewers and inactive assignments/terms cannot be reviewed. Reviewed content is exposed only to the narrowly authorized school reviewer, never students. SQL triggers, a partial unique index, and two ordered enum/constraint migrations provide additional persistence defenses. This is a configurable future policy boundary, not authorization to expand school-wide HM/Principal powers, backfill old classes, or deploy before local evidence.

## ADR-011: School-owned student record and additive session/class enrollment ledger

- Status: Development-only design authored; database migration and tests not executed.
- Context: The attendance and authorized student lesson-note workflows require a trusted, auditable student-to-class-to-session relationship; existing `User` accounts and historic class records do not imply a verified student or guardian relationship.
- Decision: Introduce school-bound `StudentRecord` with a normalized school-unique admissionNumber and a minimal REGISTERED→ENROLLED→WITHDRAWN subset, separate from login `User`. Add `StudentEnrollment` linking an explicit same-school student, ACTIVE academic session, and active class that has been classified into an active school Section; restrict to one ACTIVE student/session enrollment via PostgreSQL partial uniqueness. Model withdrawal by ending the enrollment row (not deleting or changing its class/period). Record register/enroll/withdraw in immutable StudentEvent with exact server-authenticated active school-admin actor and reason, backed by composite school/student/enrollment FKs and SQL trigger verification. No automated existing data import, student identity/account mapping or reader API.
- Consequences: The full admissions inquiry/acceptance, class promotion/transfer, re-enrollment, graduation and student-user/guardian binding are **not yet implemented**, and an administrative enrollment alone grants no attendance, student portal or child-data access. The minimal status model is a reversible initial vertical slice, not a substitute for school-specific later policies. Production/student PII access and local DB verification remain separate gates.

## ADR-012: Attendance immutable exact-enrollment daily snapshot

- Status: Review-only authored design. No local PostgreSQL migration or suite executed.
- Context: A browser-provided class/student set cannot prove actual school enrollment or role ownership, and edits to approved daily marks would destroy historical integrity.
- Decision: Add unique school/class/session/day `AttendanceRegister`, immutable `AttendanceEntry` rows referencing a precise tenant/enrollment/student/class/session composite key, and append-only `AttendanceEvent` actor decisions. Transactionally lock school, active acting membership, session/class/section, Form Teacher responsibility and ordered enrollment rows; require a complete bounded roster with exact active enrollment and original PRIMARY responsibility. Reviewer locks exact stored class section and verified HM/Principal grant before a one-way status decision. Database triggers validate actor relationships and prevent direct history alteration. Deferred event checks prohibit a register/decision without accompanying immutable event; postgres owner rights remain outside application threat boundaries.
- Trade-offs: Development defaults permit at most 500 marks, a single immutable daily submission and one terminal review. No correction is implemented yet: an auditable revision model must separately preserve original mark and actor/reason history. UTC-only nonfuture date validation is temporary until school-local timezone and calendar policy. Only private POST routes are exposed; no teacher/student/public data reads. PostgreSQL RLS is not substituted for per-transaction school scope; full disposable-DB/CI validation remains mandatory.

## ADR-013: Atomically scoped attendance reader projections

- Status: Development candidate authored but not executed or validated.
- Context: A role-only read barrier, a list query without a final membership join, or an independent unverified SECTION grant could expose student names or attendance details across classes or schools.
- Decision: The private Form Teacher roster query resolves active school, user membership, current PRIMARY responsibility, section-class-session ownership and currently active student enrollment inside one SQL statement with capped JSON projection. A distinct HM/Principal queue and detail query binds current reviewer membership, active school, the register's stored class.sectionId and exactly matching verified active SECTION grant and stage; queue contains no pupil data, detail is separately authorized. Empty unauthorized reviewer queues are denied, and no teacher may use the review reader. Each page has a server-side privilege gate and each GET/POST revalidates independently.
- Consequences: Private no-store minimal disclosure without granting teacher-wide student or parent access. Role-specific pages do not replace review of real HTTP headers, browser accessibility, concurrency, audit-trigger correctness, bounded result behavior, tenant leakage, or school-specific attendance configuration. See D-027.

## ADR-014: Audit-preserving attendance correction overlay

- Status: Additive design and code authored; PostgreSQL migration, automated tests and security audit not executed.
- Context: Changing an approved AttendanceEntry destroys the evidence of the original Form Teacher register and HM/Principal decision. Automatically replacing a corrected value can also mask which teacher and reviewer authorized the change.
- Decision: Use immutable AttendanceCorrectionRequest rows (entry, school, register, sequential revision, expected/proposed marks, requester and reason) and separately immutable AttendanceCorrectionDecision rows (request, independent reviewer, approve/return and reason). Never UPDATE original entry or event. Server submission and decision each authenticate the actor, lock school/membership/register/entry and validate exact current roles/verified section. PostgreSQL BEFORE INSERT request trigger locks the entry for direct-write concurrency, checks current PRIMARY Form Teacher responsibility and expected effective mark, sequential version and no previous pending proposal. Independent review trigger checks verified active stage-matched section and forbids self-review; unique decision key and no-UPDATE/DELETE/TRUNCATE triggers preserve both ledgers. This is an overlay, **not** silent replacement of official history.
- Trade-offs: Active academic sessions only, no school-specific correction deadline yet, no pupil UI/export. Direct SQL database superusers remain outside application threat boundaries. Future authorized effective-mark readers must compute the latest approved revision, never expose pending proposals to guardians/students, and retain original provenance in audit. Tests and production release gates remain pending.

## ADR-015: Effective corrected attendance projection via least-privilege joins

- Status: Code authored and unexecuted; documentation of intended implementation, not verified controls.
- Decision: Do not mutate `AttendanceEntry.mark` or add a writable materialized currentMark. For each exact authorized original entry, derive effective mark using the highest `AttendanceCorrectionRequest.revision` that has an immutable `AttendanceCorrectionDecision.approved=true`; pending/returned records never change it. Role-specific SQL joins repeat actor membership, ACTIVE PRIMARY Form Teacher or current verified-section HM/Principal scope and resource ownership at the final sensitive-data query. Correction queue excludes pupil identity/mark/reason; correction detail is separately constrained. Bound returned records and prohibit caching and exports.
- Consequences: Purely additive, audit-reconstructable history; future reports and official extracts must use an independently authorized effective-mark projector and the approved correction ledger, not raw mark replacement. Requires SQL regression checks, performance review, school timezone/correction window design and browser accessibility.


## ADR-016: Submission event enforces a complete enrolled class at PostgreSQL

- Status: Additive security repair authored, pending disposable PostgreSQL execution and complete CI-equivalent.
- Risk: The existing audit-event insertion trigger validates the Form Teacher but only requires EXISTS(AttendanceEntry). A direct SQL caller can otherwise persist an incomplete class roster even when application submission correctly rejects it.
- Decision: Add separate BEFORE INSERT event trigger which, for SUBMITTED only, takes an active school row lock, counts existing immutable entries, all exact eligible active student entry joins, and the complete ACTIVE school/class/session student enrollment roster; all three must agree and remain within 1–500 marks. Existing Event actor, Entry insert, deferred Register presence, one-way decision, immutable UPDATE/DELETE/TRUNCATE and composite keys remain independently enforced. Avoid destructive changes and backfill.
- Trade-offs: Additional count queries occur once per submitted class register and require performance validation with large roster. School timezone, concurrent enrollment changes, trusted DB owner threats and strict role revocation races still require executed disposable-DB tests. Read-only file-presence assertions do not validate PostgreSQL syntax/runtime behavior.


## ADR-017: Append-only school date policy and dual-layer calendar checks

- Status: Authored development candidate; migration/CI not executed.
- Context: A global UTC cutoff does not represent a school's local calendar day or daylight-saving transition; a mutable school setting would lose who changed attendance backdating or correction privileges.
- Decision: Store policy revisions as school-owned immutable snapshots with actor user/member, reason, revision, timezone and two bounded calendar windows. Use school row lock and active school-admin principal for policy changes. Validate timezone in both Node Intl and PostgreSQL `pg_timezone_names`. Read the latest revision when submitting attendance or proposing correction; derive local YYYY-MM-DD via Intl.formatToParts and integer calendar-day comparison. SQL BEFORE INSERT triggers independently apply the same latest version and school lock to SUBMITTED audit events and correction requests. Keep prior UTC nonfuture guard as a stricter upper bound. No update to existing historic marks or reviews.
- Trade-offs: Time-zone-ahead schools cannot submit tomorrow's local day before UTC reaches that day; the deliberate denial is preferable to silently widening previous authorization. Administrative change is versioned but can change future eligibility; prior event validity and corrections remain immutable. Full SQL concurrency/trigger order, Prisma drift, browser, DST/date boundaries, dependency audit and local CI-equivalent tests remain required.


## ADR-018: Explicit calendar closure overlay over immutable attendance

- Status: Authored; PostgreSQL and CI unexecuted.
- SchoolAttendanceDayRevision is a per-date append-only school administrator actor/reason history. A school row lock serializes designation and submission audit; INSERT trigger rejects a designation for dates already containing an attendance register, and event trigger rejects a new SUBMITTED event on the latest explicit non-teaching designation. Default undeclared day is teaching, not inferred from weekend/holiday calendars. Avoid reversing existing attendance/approval/correction history on a later calendar update. No student-level access or weakened role permission.


## ADR-019: Independent, scoped lesson-note release event

- Status: Unverified additive release design.
- LessonNote APPROVED and corresponding immutable APPROVED LessonNoteEvent are prerequisites, never substitutes, for an immutable release event. A school-owned LessonReleaseEvent records RELEASED or WITHDRAWN with exact note/revision, actor user/membership, reason/time. The service transaction and SQL insert trigger both enforce current active assignment, term/session, class/section and reviewer membership with exact verified SECTION grant, HM PRIMARY or Principal SECONDARY. A unique event key and row locks block duplicate release/withdrawal. No student delivery without independently verified identity and enrollment. No historical LessonNoteRevision is updated. Local PostgreSQL, CI and browser verification mandatory.

