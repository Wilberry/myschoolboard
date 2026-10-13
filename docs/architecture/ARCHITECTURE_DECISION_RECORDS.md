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


## ADR-020: Student identity binding is explicit and separately revocable

- Status: Additive code/migration authored; unexecuted.
- Mechanism: School admin selects an existing ENROLLED StudentRecord with an ACTIVE enrollment and an existing active STUDENT Membership belonging to the same school. A strict acknowledgement and recorded reason establish staff attestation (not automated identity proof). DB unique composite school/student and school/member ownership, SQL actor validation and immutable original link plus terminal revocation enforce a stable mapping. The student GET joins logged-in Membership userId, exact unrevoked link, active StudentRecord/Enrollment, matching class/session/term, approved immutable revision and RELEASED not WITHDRAWN event in one query. A separate preliminary membership check conceals unauthorized empty queues, without weakening final-row joins. No parent access or inferred child link. Test, migration and verification gates remain blocked.

## ADR-021: Academic planning schemes share immutable lesson review/release

- Status: Additive code/migration authored; unexecuted.
- Mechanism: Extend LessonNote with a defaulted typed `LESSON_NOTE|SCHEME_OF_WORK` discriminator and immutable nullable weekStart/weekEnd columns. PostgreSQL CHECK enforces ordered weeks 1–53 for schemes, no weeks for normal notes; composite partial unique index prevents duplicate exact scheme/class/subject/term/week-range. Existing lesson version, approval and release controls stay mandatory for both kinds; the editor, review queue, release queue and student reader expose the explicit kind and scheme weeks. Original approved/released content, actor and review are never rewritten. Schedule overlaps with different week endpoints and business-specific scheme templates are future policy decisions, not a privilege bypass.


## ADR-022: Separate immutable question content from secret marking keys

- Status: Implementation candidate; additive migration and tests NOT executed.
- Context: Returning marking keys from ordinary question list or joining a question by class grant alone exposes exam solutions early. In-place question/key edits destroy accountability.
- Decision: AssessmentQuestion is an immutable school-owned exact teacher-assignment/class/subject/session/term MCQ snapshot; AssessmentQuestionKey is a separate immutable one-to-one composite school/question-bound correctIndex. Only an active TEACHER with the current exact assignment can insert both transactionally. Database BEFORE INSERT validations independently verify tenant/actor/assignment, active academic relationships, options, key index; immutable triggers block normal update/delete/truncate. Staff GET projects question content only through the original currently active author assignment and omits key; there are no student or key GETs.
- Consequences: A later controlled question-replacement/version lifecycle, assessment configuration, marking service, key-reveal rules and verified CBT attempts are separately required. No release or role broadening. Full disposable-DB + source/code CI and security audit required before milestone completion.


## ADR-023: Sealed, draft-only assessment configurations

- Status: Code/migration authored; no runtime verification.
- Context: A mutable question list can invalidate attempted exams after students start, and role-only assessment configuration can mix classes/subjects or expose keys. Stored attempt limits are meaningless without a later enforcement state machine.
- Decision: Materialize teacher-authored AssessmentDraft as an immutable typed configuration for a precise active assignment/term, plus immutable question-position/point rows and an atomic unique AssessmentDraftSeal. SQL inserts validate the actual current actor, assignment, period, matching private-keyed questions and bounded grading/schedule constraints. A school row lock makes post-seal additions fail even by direct SQL. Teacher GET only returns sealed metadata and aggregate marks/count, never the private key; no student-facing route or publication status exists.
- Consequences: New versions require new draft snapshots; future CBT attempt service must explicitly enforce maxAttempts, timer, idempotence, question delivery and delayed marking key access. Full Prisma/SQL/lock and browser tests plus dependency audit are prerequisites, not waived by draft PR.


## ADR-024: Terminal section review and non-authoritative CBT attempt policy

- Status: Authored, not executed.
- Use append-only one-per-school/draft AssessmentReviewEvent with exact school/draft FK and active reviewer school membership FK; service and PostgreSQL independently verify a sealed draft with active teacher assignment and academic period plus stored class.sectionId and verified SECTION scope (HM PRIMARY, Principal SECONDARY). Approval, return and reason live in immutable event history. A NEW draft is required to correct a returned configuration. No report publication/status mutation/answer key release.
- Reviewer read projections are separately scoped by actor-to-section-to-draft joins, omitting AssessmentQuestionKey. The question preview is private/no-store and cannot be used by students. No blind approval solely by metadata; question content is available for moderator inspection without marking keys.
- CBT timer helper computes UTC elapsed-time expiry bounded by scheduled close and counts every attempt and active attempt conflict. This module is only pure planning, not runtime permission. Future student CBT requires distinct controlled publication, unrevoked admin-verified identity binding and exact active enrollment, transactional attempt numbering/counting and immutable events, no early key disclosure and complete CI/DB acceptance. Parent migration quoting regression has been fixed in this branch; production/run status remains BLOCKED.


## ADR-025: Distinct immutable school publication ledger for assessment configurations

- Status: Additive Phase 7 proposal implemented in draft code, not runtime-verified.
- Split HM PRIMARY/Principal SECONDARY academic moderation from School Super Admin publication. AssessmentPublicationEvent is a school-bound immutable PUBLISHED/WITHDRAWN sequence with exact school/draft and school/member actor FKs. SQL validator serializes events on school and draft rows, checks active SCHOOL_SUPER_ADMIN actor identity, APPROVED reviewed sealed draft with active teacher/session/term/section/class/subject for PUBLISHED, forbids duplicate publication and terminally forbids republishing after withdrawal. WITHDRAWN requires prior publication but does not require the original author still active, supporting immediate admin safety revocation.
- A separate service transaction repeats identity/state checks, and the private super-admin queue contains only approved draft metadata. This ledger is deliberately not an exposure, delivery, scoring or CBT attempt path; later student delivery must independently verify approved publication still effective, time/attempt limits, unrevoked student-account link and exact active enrollment. No new early answer-key access. Local PostgreSQL/CI/security gates remain blocked.


## ADR-026: Immutable database-clock CBT admission tied to verified pupil enrollment

- Status: Authored, not executed.
- Model: AssessmentAttempt has same-school FK edges to immutable draft, enrolled student record, exact enrollment identity tuple (school,enrollment,student,class,session), same-school STUDENT Membership and admin-attested StudentAccountLink. One sequence number unique per school/draft/student, stored actual student actor user, start and deadline. No student content/answers/keys or public routes.
- Enforcement: SQL BEFORE INSERT serializes on School row used by identity-revocation and publication withdrawal services, checks APPROVED reviewed/sealed/unwithdrawn PUBLISHED exam, active teacher assignment/academic period/class/section, signed-in STUDENT membership association, unrevoked attested pupil link and active matching enrollment, then independently calculates ordinal attemptNumber and UTC deadline = min(server clock + duration, exam close). Direct UPDATE/DELETE/TRUNCATE denied and all started attempts count to maxAttempts; second unexpired reservation fails.
- Service performs authenticated unambiguous exact student/enrollment selection then SERIALIZABLE insert, returning only non-answer reservation metadata. Transaction revalidation at SQL remains authoritative. Crucially this is **not** CBT live delivery: next independent append-only answer submission and idempotency workflow must precede any public attempt route, and local disposable DB tests must prove lock order, revocation/withdrawal races, UTC boundaries and constraint validity. D-040.


## ADR-027: Append-only CBT answer revisions, replay semantics and terminal submission

- Status: Authored schema/SQL/service and synthetic tests, not executed.
- Motivation: Mutable answer rows, user-supplied timestamps and answer keys returned to browser create audit bypasses and early solution disclosure. A per-question ordered append-only event ledger supports revisions without erasing history.
- Mechanism: Distinct AssessmentAttemptAnswerEvent (unique school/attempt/requestKey and unique school/attempt/question/revision) and AssessmentAttemptSubmission (one per school/attempt). DB BEFORE INSERT invokes one `assert_cbt_attempt_writable` SQL function holding School FOR UPDATE then AssessmentAttempt FOR UPDATE, checking signed-in member identity as supplied by authenticated service and stored attempt, same active enrolled pupil and unrevoked student link, active academic original assignment, separate APPROVED+PUBLISHED/NOT WITHDRAWN events and trusted UTC deadline. Answer validator checks sealed selected question choice count but never reads AssessmentQuestionKey, assigns per-question revision/time under lock; submission validator sets server time and prevents later writes. Immutable UPDATE/DELETE/TRUNCATE triggers protect event history. Service uses SERIALIZABLE with bounded serialization retry and idempotency key replays only for exact original payload.
- Boundaries: No student exam/read/answer API, authoritative scoring, terminal deadline-expiry event, attempt completion status overwrite or class record sheet. Replay acknowledgement after cutoff is not a new write and remains gated to current identity. Full SQL concurrency, tenant isolation, browser and dependency gate execution remains required. D-041.


## ADR-028: Key-blind attempt resume is a final-query join, not a role check

- Status: Authored; unverified. Final bounded SQL query joins the logged-in STUDENT user ID to stored attempt membership/student attestation/unrevoked ACTIVE enrollment, active academic structure, reviewed and published nonwithdrawn exam, and absence of terminal submission. Current server UTC deadline enforced. LATERAL latest response by descending revision returns only own selection. It never joins the secret key table or exposes other students. No HTTP student route; additional SQL/CI/security validation required before use.


## ADR-029: SQL-only immutable secret-key objective marking

- Status: Authored; unverified. Exact active original TEACHER initiates internal-only submitted-attempt scoring. The PostgreSQL trigger, not TS/HTTP/client, reads private AssessmentQuestionKey and latest per-question answer revision, recomputes total/earned/pass/percentage and writes one immutable score. No student result visibility, answer key API, edits or automatic publishing. Requires local DB/CI evidence.

## ADR-030: Live provisional, teacher-scoped record sheet from immutable objective scores

- Status: Development candidate not verified. Private teacher GET uses a final SQL exact Membership→TeacherClassSubjectAssignment→School/Class/Section/Subject/Session/Term join and current ENROLLED matching class/session StudentEnrollment to project minimal student identity. LATERAL sealed approved PUBLISHED/not-withdrawn draft and one highest-score submitted attempt per draft produce a bounded read-only provisional record; pending not zero, scored-only aggregate. A separate bodyless teacher scoring POST delegates to SQL trigger-only key reading; key, answer revisions and result publication are never returned. Ambiguous enrollment duplication and excessive breadth fail closed. Full local SQL, CI, a11y, security and school business aggregation acceptance pending.


## ADR-031: School-owned immutable draft weights and complete-only provisional grade preview

- Status: Authoring candidate; no SQL/runtime acceptance.
- Store an append-only AssessmentGradingPolicyRevision keyed by exact school/session/term/class/subject/version; current School Super Admin membership and active academic structure independently checked in SQL BEFORE INSERT. A School row lock allocates ordinal version and immutable audit triggers reject history tampering. Every revision contains integer QUIZ/TEST/EXAM percentages totaling 100, an actor and a reason.
- Teacher final class-sheet query projects latest context-matching profile **only through existing exact assigned teacher + student enrollment authorizations**. A pure deterministic function averages scored assessment percentages per kind, applies explicit weights, and returns PENDING/null unless every positive-weight kind has a complete set of scored assessments. No implicit default, no score mutation, no official result release or access broadening. Mandatory disposable SQL, unit/integration, browser, audit and Phase 6 verification still required.


## ADR-032: Teacher-written marks as disjoint immutable proposals pending review

- Status: Additive Phase 7 proposal; unverified. Separate AssessmentManualComponent teacher-owned exact assignment/term and AssessmentManualMarkProposal exact same-school component/class/session/ENROLLED pupil/ACTIVE enrollment with one initial reasoned bounded integer mark per student. SQL insert triggers lock School, independently verify current original TEACHER membership, active session/term/class/section/subject and enrollment/mark limits; normal update/delete/truncate rejected. A private final-query roster prevents wrong-class name access, with bounded 500 and duplicate-student conflict.
- Crucially there is no marking/publishing activation, no teacher self-approved corrections, no use of these proposals in objective SQL scoring or weighted/official sheets. Future reviewed HM/Principal decisions must adopt or return proposals via separate immutable audit events before any revised gradebook results. Full disposable-DB, authenticated concurrency, CI and security audit required.


## ADR-033: Terminal section-verified original manual mark approval

- Status: Authored/unverified. One SQL append-only APPROVED/RETURNED decision per original proposed mark, enforced by active school row serialization, current original teacher and child enrollment, independent active PRIMARY section HM/SECONDARY section Principal with exact verified ScopeGrant and user/member. Self-review blocked, no in-place changes or official result publishing. D-047.

## ADR-034: Manual mark corrections append reviewed versioned requests

- Status: Authored not verified. Original initial-approved manual mark stays immutable; SQL school-serialized current original teacher may append a non-identical bounded revision only when no other pending request, and independent verified exact-section HM PRIMARY/Principal SECONDARY reviewer decides once. Effective academic approved points follow latest approved correction, never pending or returned. Immutable record and role/tenant controls mandatory; no official Phase 8 publication. D-048.

## ADR-035: Private approved-only manual gradebook is a derived read, not result publication

- Status: authored/unverified. Final SQL exact teacher/academic enrollment joins a manual component with initial immutable APPROVED mark and latest independently APPROVED correction; pending, returned or absent marks remain explicitly unapproved. No grades published or mutated. Completion requires all components approved and no pending correction. Strict bounded no-key no-export reader. D-049. Phase 8 official reports separate.

## ADR-036: Returned initial marks are recoverable by independently approved correction

- Status: Authored/unverified. Permit an original teacher to request a changed audited mark after either terminal APPROVED or terminal RETURNED initial academic decision. PostgreSQL still requires exact assignment/enrollment, one pending revision and independent current verified-section reviewer approval. Effective grade stays null for returned initial until a correction is approved; immutable original RETURNED decision persists. No official grade publication. D-050.

## ADR-037: Phase 8 preparation reconciles private sources but cannot imply result approval

- Status: Authored unverified. Existing separately exact teacher-scoped CBT and academically reviewed manual read models feed a fail-closed identity/counter reconciliation. It never combines objective/manual scores without an adopted versioned policy, never persists a report or authorizes student/parent visibility; full HM/Principal and School Super Admin two-stage official results workflow remains separate. D-051.

## ADR-038: Explicit school grading adoption is immutable and separate from result publication

- Status: authored, unverified. A School Super Admin may append an actor-attributed versioned adoption of an exact school/class/subject/session/term grading revision, enforced again by SQL school locking, active context, role and uniqueness. Historical result evidence references a concrete adoption; adopting a later revision cannot rewrite prior evidence. No report/publication authorization. D-052.
