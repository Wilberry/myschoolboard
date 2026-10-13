# Architecture Decision Records

## ADR-051: Single-pupil SQL projection with inseparable confidential preview audit

- **Decision:** The private-grade preview runs as a single authenticated School Super Admin-only POST, never as an unlogged GET, public link, PDF export or recipient token. Inside a SERIALIZABLE transaction, the service locks active School and derives actor identity. `read_private_owner_one_pupil_grade_preview` rechecks the exact current owner/teacher/HM-or-Principal approval through `assert_result_publication_readiness`, frozen source packet and current adopted grade scale/aggregation, recomputes every frozen class grade for parity, validates **exactly one** currently enrolled pupil matching the class/session, and projects only that pupil's verified name, admission number, category BPS/weights, score, grade/remark and school/session/term/class/subject metadata. It then inserts `ResultPrivateGradePreviewAudit` with DB-confirmed owner/pupil/composition in the **same SQL function**, deriving evidence revision/status/timestamp; no preview can be returned until the insert succeeds. The caller commits before sending HTTP response; a rollback removes the audit and no separate application-only write can be bypassed. Audit rows have no grades; UPDATE/DELETE/TRUNCATE forbidden. The POST-only API rejects cross-origin JSON browser POSTs and returns private no-store response; the page is server-gated and visually states `NOT RELEASED`. A direct SQL invocation of the preview function is also audited. Academic visibility to owner is separate from every form of report publication, student/guardian authorization and undecided P-004. **Status:** authored, PostgreSQL and full runtime testing outstanding. D-065.


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

## ADR-039: SQL-generated immutable teacher evidence and verified-section academic review before publication

- Status: Authored, unverified. The original teacher supplies only class/term assignment and reason, while SQL under a School lock independently builds a complete per-pupil source JSONB manifest from approved/published scored CBT and independently approved manual marks. Each evidence revision pins latest explicitly adopted school grading policy. Only verified exact-section Primary HM or Secondary Principal may append a separate final academic APPROVED/RETURNED decision; approval rechecks latest policy, latest evidence and byte-equivalent recomputed JSONB manifest. RETURN stale source for new immutable revision, never silently adopt changes or publish a result. Prior history immutable. D-053.


## ADR-040: Read-only school owner prepublication inspection is not publication authorization

- Status: Authored/unverified. A tenant-bound server-authenticated `SCHOOL_SUPER_ADMIN` may read only class/subject/period/evidence revision/student-count and academic-review timestamps from the latest APPROVED result source that still matches the current adopted grading-policy version and DB-computed manifest. Query joins repeat active school owner, teacher assignment, session/term, class/section/subject, current verified independent reviewer and per-pupil positive-weight assessment categories. A revoked reviewer grant, new policy adoption, newer evidence, or changed sources remove the candidate. No student name, mark, manifest, student/guardian route, official grade, release event, POST, or export. Freshness in a SELECT never guarantees a later safe publication; future publication INSERT must revalidate under lock and record a distinct immutable School Super Admin final decision. D-054.


## ADR-041: Locked reusable SQL readiness, no result publication event yet

- Status: Authored/unverified. Introduce an additive PostgreSQL `assert_result_publication_readiness(school, evidence, ownerMembership, ownerUser)` returning TRUE only after an active school-row FOR UPDATE lock, exact current School Super Admin authorization, exact original active teacher and academic context, APPROVED independent current verified PRIMARY/SECONDARY section review, latest evidence revision and grading-policy adoption, complete recomputed per-pupil manifest and unchanged frozen JSONB. Callers must supply authenticated server-derived principal identifiers; no direct client IDs and no release based on stale read-only owner candidate pages. This function cannot publish, store results or disclose pupil data; no application API invokes it yet. Future official publication must invoke under SERIALIZABLE + locks inside an append-only final decision transaction, then implement visibility separately. D-055.


## ADR-042: Append-only final owner decision follows locked source revalidation, never implicit exposure

- Status: Authored/unverified. Introduce tenant-keyed `ResultFinalPublicationDecision` as an immutable ledger referencing one frozen teacher result evidence revision and its adopted grading policy. PostgreSQL BEFORE INSERT calls school-locked `assert_result_publication_readiness` after exact same-school authenticated School Super Admin authorization and derives evidence context, status `APPROVED_AWAITING_RELEASE`, monotonically allocated per-context decision ordinal and trusted timestamp itself. Unique evidence and ordinal constraints plus UPDATE/DELETE/TRUNCATE protections preserve audit trail. A private owner-only POST accepts `evidenceId` and reason; a private bounded GET exposes metadata, never marks, pupil identity or raw manifests. No student/guardian/report-card release reader exists. New evidence after policy or independently approved mark corrections requires renewed academic and owner approvals; a previous owner decision stays historical and is not current release authority. D-056.


## ADR-043: Freeze allowlisted pupil source packets without computing unofficially assumed report grades

- Status: Authored/unverified. Tenant-scoped, append-only `ResultReportCardSourcePacket` belongs to one immutable School Super Admin final decision and its exact student-source evidence, source revision and adopted grading-policy version. PostgreSQL BEFORE INSERT calls school-locked full current readiness, rejects superseded/duplicate final decisions, derives all context/actor-stamped trusted date, allowlisted source identities and scores and adopted 100%-sum QUIZ/TEST/EXAM weights. Do not compute final percentages or grade bands before explicit school grade-scale and report-rounding decisions. Protected JSONB source records are server-private; owner-only API and UI expose metadata only. Source packets have no public/guardian/student route and no status transition to released. New academic correction and new owner approval produce a fresh packet; preserve old audit history. Future official report generation and recipient release require separate immutable artifacts, consent/visibility rules and passing quality/security gates. D-057.


## ADR-044: Store school-owned exact grading-band semantics before official report composition

- Status: AUTHORED / UNVERIFIED. `ReportGradeScaleRevision` holds append-only school-owned versioned `bands` (0..10000 integer score basis points, inclusive and complete), explicit `decimalPlaces` 0..2, `roundingMode` HALF_UP/FLOOR/CEILING and `bandBasis` RAW_BPS/DISPLAY_ROUNDED_BPS. PostgreSQL independent validator and school-row-locked BEFORE INSERT trigger reauthorize the exact active School Super Admin user/membership and compute the next version/trusted timestamp. Application uses strict validated inputs with serializable transaction; history reader repeats active owner authorization in the SQL read. No hard-coded grade boundaries, failed-result threshold, percentage defaults or retroactive grade changes. Pure TS calculation is an unprivileged simulation only; final official report grade formula will need a distinct approved policy binding scale version and category aggregation to a particular immutable packet. No student/guardian API, grade release or public report added. D-058.


## ADR-045: Independent aggregation-rule adoption and exact integer-basis-point composition

- Status: AUTHORED / NOT VERIFIED. `ReportAggregationRuleRevision` is a school-scoped append-only owner adoption of `EQUAL_ASSESSMENT_BPS` or `POOLED_CATEGORY_POINTS` plus integer division precision `HALF_UP/FLOOR/CEILING`. DB serializes school-locked versions, rejects duplicate unchanged policies and verifies current same-school owner/user; older policies survive immutable UPDATE/DELETE/TRUNCATE guards. New pure `simulatePrivateReportComposition` accepts an explicit frozen private `ResultReportCardSourcePacket` context, every enrolled pupil's approved CBT/adjusted written source, versioned adopted weights, explicitly selected aggregation revision and separately pinned adopted grade scale. Uses positive safe-integer points and BigInt for divisions, rejects incomplete categories, invalid marks, duplicate assessment/pupil IDs, inconsistent weights, bad policy IDs or missing grade thresholds. Method semantics are precisely documented: EQUAL normalizes and rounds every source, rounds category mean; POOLED rounds combined earned/possible; both apply 100%-sum adopted category weights and round final integer percent basis points, then apply the grade scale's distinct display rounding/threshold basis. Pure result has status `PRIVATE_COMPOSITION_SIMULATION_ONLY` and is **not an authorized official per-pupil grade**, stored report-card artifact, public endpoint or release. Future official immutable composer must validate and freeze all policy references under lock; no default school interpretation. D-059.


## ADR-046: DB-derived immutable official report composition evidence, with release strictly separate

- **Status: authored / unverified.** Define `PrivateOfficialReportComposition` with same-school composite references to the existing frozen source packet, exact final owner decision, adopted grade scale, adopted aggregation policy and acting owner. BEFORE INSERT invokes `assert_result_publication_readiness` (active school lock; original assigned teacher, independent Head of Section/Principal current section, exact latest source/adoption, current active owner), requires caller-selected exact **current** grade-scale and aggregation rule IDs and SQL recomputes grade evidence with integer NUMERIC basis-point fractions, explicit category method and rounding, adopted category weights, exhaustive school grade bands. SQL resets all academic context, policy version, pupil grade array, student count, internal status and trusted timestamp, rejecting corrupt marks, duplicate pupils/source IDs or missing positive-weight categories. Stored composedStudentCards include private pupil identities, per-category scores, raw/displayed score, school-defined grade labels and internal non-release marker; **no HTTP response selects the JSONB.** SQL UNIQUE per frozen packet and UPDATE/DELETE/TRUNCATE protections preserve old audited versions. No recipient release, portal, PDF, export, parent relationship access or automatic historical recalculation is authorized. D-060.

## ADR-047: Separate versioned future report audience intent from release and student/guardian entitlements

- Status: AUTHORED / UNVERIFIED. The additive `ReportVisibilityPolicyRevision` is school-scoped, append-only, owned only by a current exact same-school School Super Admin and serialized by a PostgreSQL School-row lock. It stores `recipientMode` from four explicit choices plus school version, reason, actor and trusted timestamp, with composite same-school actor FK and UPDATE/DELETE/TRUNCATE guards. No automatic default and no policy-to-recipient data path. Strict no-store owner-only GET/POST returns policy history metadata only; neither report grades nor related student identities are selected. Adopting a policy **is not release**; no student/guardian report readers, role grants, relationship creation, publication event, amended report or file export are authored. A future release decision must pin current exact policy version, revalidate latest approved composed evidence and academic authority under school lock, independently check identity plus school/pupil guardian links and the undecided P-004 acknowledgment semantics, and execute only after all quality/security gates are accepted. D-061.

## ADR-048: Internal result-release preflight is historical evidence, not an authorization token

- **Status: AUTHORED / UNVERIFIED.** Add `ResultReleasePreflightAttestation` with same-school composite FK links to the exact private official report composition and adopted school recipient policy, trusted actor/reason/version/timestamp and unique school+composition+visibility policy. PostgreSQL BEFORE INSERT calls `assert_result_publication_readiness` under active School-row lock, revalidates exact owner and independent academic section reviewer plus teacher and unchanged complete source, checks packet and owner decision context against immutable composition, demands the **current** grade-scale, aggregation and non-`ASSESSMENT_ONLY` visibility-policy revisions, and recomputes all per-pupil report cards with `build_private_official_report_cards`; JSONB must match the preserved frozen grades. It derives all protected metadata and `INTERNAL_RELEASE_PREFLIGHT_ONLY_NOT_AUTHORIZATION` status; UPDATE/DELETE/TRUNCATE denied. Backend POST schema accepts only compositionId, visibilityPolicyId, reason, while same-school owner GET returns bounded private metadata. No publication mutation, audience grant, pupil/guardian API or report export is added. A future release must independently redo those tests **inside its own locked transaction**; an old preflight event becomes stale when any policy or source changes, and never constitutes a reusable permit. Parent-first P-004 remains unresolved. D-062.

## ADR-049: Immutable same-school guardian relationship ledger, explicitly separate from grade-reader authorization

- **Status: authored / unverified.** Add `GuardianStudentRelationshipEvent` with exact same-school composite FKs to StudentRecord, PARENT Membership and verified owner Membership, immutable `VERIFY`/`REVOKE` event ordinals per school+student+guardian, School-row-locked BEFORE INSERT validation and trusted actor/ordinal/time/verification flag. Verification requires active ENROLLED pupil with ACTIVE StudentEnrollment, current same-school active PARENT member with `User.emailVerified`, current same-school School Super Admin, explicit proof-reviewed assertion and audit reason; revocation can be recorded even after guardian role or account becomes inactive. Mutation/DELETE/TRUNCATE blocked; subsequent re-attestation requires an intervening revocation and new evidence. No inferred parent matching or auto-seeded links. Existing `StudentAccountLink` and `StudentAccountLinkRevocation` remain the exclusive explicit STUDENT linkage basis. DB-only diagnostic `inspect_private_report_recipient_relationship` is owner-authenticated, checks exact current private composition/pupil ID, active matching school/class/session enrollment, latest adopted school visibility mode, independently verified student link or latest VERIFIED guardian ledger event, current recipient role/account/email verified, and returns only `RELATIONSHIP_VERIFIED_NOT_RELEASED` or `NO_VERIFIED_RELATIONSHIP_OR_POLICY`. It does **not** evaluate P-004, reauthorize academic result release or return private grade JSON; a diagnostic cannot become a grant. The corresponding metadata-only School Super Admin endpoints are never student/guardian result readers. D-063.

## ADR-050: Frozen per-recipient eligibility review is private audit evidence, not report delivery

- **Status: authored/unverified.** `ResultRecipientEligibilityEvidence` stores one immutable school-scoped per-composition/per-pupil/per-recipient audit observation bound by composite FKs to the private official report composition, exact pupil and member, prior private preflight, adopted visibility policy and current owner. Before INSERT SQL locks the active School and independently repeats active owner/user, locked `assert_result_publication_readiness`, latest school grading scale/aggregation, current non-`ASSESSMENT_ONLY` recipient policy, matching internal preflight, email-verified and active recipient account, mode-specific STUDENT/PARENT eligibility, and existing `inspect_private_report_recipient_relationship` for the exact private composition/pupil. It derives the exact unrevoked STUDENT link ID or latest immutable PARENT VERIFY event ID as relationship proof, and all protected version/role/preflight/status/timestamp fields. A compound unique key prevents replay of the same proof/policy; new verified guardian evidence after revocation may produce a distinct historical review while older review never regains authority. UPDATE/DELETE/TRUNCATE blocked. The current-owner private no-store API accepts strict minimal POST and metadata-only GET, and no grade/recipient identifiers are projected in responses. No user-facing `GET report` endpoint, public release, guardian acknowledgment, export, PDF or identity entitlement is created. The historical `id` must **never** become an access capability; eventual release and each read require their own currently verified checks. D-064, P-004 open.

## ADR-051: Recompute and project one pupil's private grade in SQL with append-only view auditing

- **Status: AUTHORED, unverified.** `read_private_owner_one_pupil_grade_preview(school,composition,pupil,ownerMembership,ownerUser)` is a default SECURITY INVOKER, VOLATILE PostgreSQL function used only inside an authenticated SERIALIZABLE School-row-locked transaction. It calls `assert_result_publication_readiness` (same-school owner, latest teacher assignment, independent properly scoped academic reviewer, adopted grading, complete source manifest), rejects superseded school grade-scale/aggregation policy and mismatched exact source packet, recomputes the complete class grade JSON with `build_private_official_report_cards` and checks equality to immutable composition; **only then** selects exactly one student with ACTIVE enrollment for the composition's school/class/session, and projects an explicit allowlist of school/pupil identity, academic labels, category weights/scores, grade and remark. No class roster, raw marks, correction history, answer keys or second pupil is returned. API has **POST only**, owner server gating, same-origin check when Origin is supplied, strict `compositionId/studentId/reason` schema and no-store response. A mandatory same-transaction `ResultPrivateGradePreviewAudit` contains no result values, rejects modifications and records the actor/target/reason/time before grade data leaves the request. This is an administrative **preview, not official publication**; the user/guardian endpoints and acknowledgment decision P-004 remain blocked. D-065.

## ADR-052: Read-only owner-visible subject metadata coverage cannot become release authorization

- **Status: AUTHORED / UNVERIFIED.** The new `inspectPrivateClassTermSubjectCoverage` uses a SERIALIZABLE read transaction, active School-row lock and authenticated exact current School Super Admin membership; validates same-school class, session and term. Subject scope is defined *only* by distinct current ACTIVE teacher assignments with exact non-null session ID, current active teacher membership and active subject, bounded at 500 assignment rows and 500 evidence rows, rejecting truncation rather than falsely claiming completeness. The diagnostic selects latest revision per assigned subject, independent APPROVED review, APPROVED_AWAITING_RELEASE owner decision, exact immutable private composition and current grade-scale/aggregation **metadata**. Output is subject title/ID, a narrowly defined status, version and aggregate count only; not student IDs, marks, grades, source JSON or a published report. There are no writes, new database relations, external shares or report downloads. An academic status is only evidence of existing records: it does not rerun source/role/roster freshness under the full release predicate. NULL-session teacher assignments, unassigned subjects and school curriculum requirements are expressly outside scope; a future adopted class/term subject inventory and independent per-report readiness check are required before claims of *complete* official report cards. D-066, P-004 open.
