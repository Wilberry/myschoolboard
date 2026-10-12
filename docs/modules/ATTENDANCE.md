# Attendance

## SQL complete-class roster hardening (draft; no PostgreSQL execution)

The cumulative `feature/attendance-ledger-integrity-hardening` adds a third **additive** migration `20261012200000_attendance_complete_roster_guard` which rejects an `AttendanceEvent(SUBMITTED)` insert unless the count of attendance entries exactly matches the count of currently active enrolled pupils in the same school/class/session, and every included mark itself still matches eligible enrollment and an enrolled pupil. The roster must contain 1–500 entries. The trigger acquires a tenant school row lock before counting and retains the existing role, primary Form Teacher, audit-presence, one-way review, and immutable-entry/event guards. This closes a direct-SQL gap: the prior audit trigger required only **at least one** mark, while the normal API already demanded the complete roster. Existing academic records are untouched; no backfill or deployment is authorized.

A new read-only `node:test` guard verifies database-trigger and Prisma/migration declaration presence and is added to `npm test` and the optional local guard script without removing Vitest or the audit gate. A synthetic PostgreSQL transaction test was **authored** to attempt an incomplete two-pupil roster followed by a forged valid submission event, and assert the whole transaction rolls back. **Neither the Node guard nor the PostgreSQL case has been executed under the repository's toolchain.** Ten source-presence consistency checks over GitHub-fetched files were executed separately and passed; they are **not** database, migration, parser, or CI evidence. See D-030 / ADR-016.


## Correction effective-mark readers and role-separated browser workspaces (draft; unverified)

The cumulative `feature/attendance-correction-review-workspaces` branch adds private authenticated GET readers and server-rendered Form Teacher and section reviewer pages. Current ACTIVE PRIMARY Form Teacher responsibility for the **exact stored school/class/session** is required for both the approved-register index and the per-register entry detail, including historical entries whose enrollment later ENDED. Entry detail presents both immutable `AttendanceEntry.mark` (original) and an effective value derived **only from the highest revision with an APPROVED AttendanceCorrectionDecision**; pending or RETURNED proposals never change effective attendance. Outstanding proposals are indicated but cannot be resubmitted over. Form Teacher UI requires an explicit different mark and reason. It does not publish corrections to pupils or guardians.

Reviewer GET queue omits pupil names/IDs, marks and reasons. Single-request detail projects the minimum pupil identity, original/expected/proposed values and requester reason **only** if the currently active reviewer role and exact verified school-owned SECTION scope match the register's stored class section (HM PRIMARY, Principal SECONDARY). A distinct reviewer UI requires a reason and explicit confirmation of reviewing original evidence. Server page navigation and every GET/POST enforce active relationships independently; non-permitted empty queues are concealed as 404. Capped result sets: 100 approved registers, 100 pending requests and 500 pupil entries; private no-store responses, no general export or public student access.

Synthetic PostgreSQL cases for role revocation, stage/tenant denial, queue minimization, original-vs-effective reads and pending-vs-approved behavior are **authored but NOT EXECUTED**. Browser accessibility and HTTP end-to-end, migration, security audit and local CI-equivalent remain pending. This is not a production-ready correction workflow or Phase 6 completion.


## Immutable attendance correction ledger (Phase 6 draft; unexecuted)

The cumulative `feature/attendance-immutable-corrections` candidate adds an **additive, review-only** `AttendanceCorrectionRequest` and `AttendanceCorrectionDecision` ledger. The original `AttendanceEntry.mark`, submission, and section approval **never change**. A current active PRIMARY Form Teacher responsible for the register's exact school/class/session may request a reasoned correction for a specific attendance entry of an APPROVED register in an ACTIVE academic session. The requested `expectedMark` must match the current effective value (original mark, or latest approved correction); `proposedMark` must differ. Revisions are sequential; another request for the entry is blocked while a decision is pending. The pupil's enrollment may have ended since attendance, but the immutable original entry and its composite exact-enrollment references must already exist; no prior enrollment is inferred or manufactured.

A different active HM (PRIMARY) or Principal (SECONDARY) with a verified SECTION scope for the register's **stored class.sectionId** may APPROVE or RETURN a request with a separate immutable reasoned decision. A returned request leaves the effective mark unchanged; an approved one becomes the latest effective mark for future *authorized* reads. PostgreSQL composite FKs, row-locked revision/effective-mark trigger, authenticated actor relationship triggers, unique one-decision-per-request constraints and UPDATE/DELETE/TRUNCATE protections backstop the serializable application services. Two private POST routes allow request/decision; no general GET/export of correction or pupil history is exposed by this slice. No bulk backfill or direct `AttendanceEntry` UPDATE. An active school/session/section and current PRIMARY Form Teacher/reviewer grant are required; closed-session correction is denied by default pending explicit configurable school policy.

**Not completed:** effective-mark read projection, permitted correction history/queue reader and browser workspaces, policy-configured correction window and timezone, proof of revocation race safety, migration execution, CI-equivalent/full database tests and production suitability. The authored disposable-DB suite includes actor spoofing, stale expected marks, sequential revisions, concurrency, immutable history and section-scope denial; it is **NOT EXECUTED**. See D-028 / ADR-014.


## Form Teacher and section reviewer read/workspace candidate (unverified)

The cumulative `feature/attendance-scoped-read-workspaces` branch adds private GET roster and review endpoints plus browser pages. Only an active TEACHER/FORM_TEACHER membership holding ACTIVE PRIMARY Form Teacher responsibility for the **exact school/class/session** can read that class's current, active enrollment roster (admission number, minimal names, student/enrollment IDs). This is an intentionally narrow child-data exception based on the verified teacher-to-class responsibility and active student enrollment, not teacher-wide `academic:read`, a class grant, or any parent link. Roster authorization and pupil projection share a single SQL statement. No general student GET, exports or guardian routes are added.

An active Head of Section sees only submitted PRIMARY registers in their exact active verified SECTION grants; an active Principal sees only SECONDARY. The pending queue omits minor identities and marks; a second exact-scope GET supplies minimum mark/name detail for deliberate review. Each final SQL query binds the actor, school, stored class section and verified grant together. Unauthorized empty queues return 404, not an apparent authorized 200. All responses are private/no-store and errors conceal foreign IDs. The server-rendered entry/reviewer pages independently gate navigation and revalidate each POST/GET. The Form Teacher UI requires an explicit mark for every pupil (no default attendance) and displays the conservative UTC date restriction; the reviewer UI requires a decision reason and warns that returned/approved records are terminal.

Tests for principal/head cross-stage denial, unrelated subject teachers, revoked memberships/grants, empty queues, parameter validation, minimal roster projection, queue privacy, scoped detail, and server page-options have been **authored, not executed**. Actual browser/keyboard/accessibility testing remains pending. No parent/student/export access, account linking or correction/version history is implied. D-027 / ADR-013 describe this unverified limited read design.


## Phase 6 attendance register submission and section review candidate (unverified)

The cumulative `feature/attendance-register-ledger` branch adds an **additive, review-only migration** for `AttendanceRegister`, `AttendanceEntry` and `AttendanceEvent`. A school/class/session/date unique key prevents duplicate daily registers. Exact composite foreign keys bind each mark to its school-owned, specific student enrollment AND the register's class/session; they also bind the Form Teacher submitter to the original PRIMARY responsibility. No existing students or historic classes are linked or backfilled. PostgreSQL guards prevent direct mark/event UPDATE/DELETE/TRUNCATE, prevent register deletion/rewrite, allow at most one SUBMITTED→APPROVED/RETURNED state change, and require a matching actor-validated append-only submit/decision event at commit.

Two private POST-only routes (`/api/schools/:schoolId/attendance` and `/api/schools/:schoolId/attendance/:registerId/decision`) use authenticated actor identity and serializable transactions with school/membership/academic resource locks. Submission accepts **only enrollment IDs and enumerated marks**, rejects duplicate IDs, absent/mismatching/inactive enrollments, oversized lists and partial class rosters; it requires the acting current PRIMARY Form Teacher responsibility for exactly the stored class/session. A conservative *UTC current-date limit* prevents prospective attendance until school-specific time zones/policies are configured. A reviewer with an exact, currently verified section grant may approve/return only PRIMARY as HM or SECONDARY as Principal. Returned and approved states are terminal; no silent resubmission replaces original marks. The service emits minimal IDs/status/count, **no student names**, with generic concealed denials and private no-store headers.

**Unfinished:** authenticated Form Teacher class-roster read and attendance UI, scoped reviewer queue/read and UI, configurable school timezone/holidays/attendance-day policy, reasoned corrections and audited replacement revisions, parent/student reads, exports, operational health and browser accessibility. These POST endpoints are development candidates; callers cannot safely obtain enrollment IDs from a teacher-facing read yet. **No migration, synthetic database integration test, policy unit test, format/lint/typecheck/build or audit was executed on this candidate.** This is not Phase 6 completion, production authorization or a release. See D-026 / ADR-012 and T-ATT-001.


## Exact eligibility policy kernel (development draft; not connected to API)

The cumulative `feature/attendance-eligibility-policy` branch adds a pure fail-closed predicate for exact ACTIVE school/student/class/session enrollment and active school, session, classified class and same-school Section. Submission additionally needs the acting active school teacher or Form Teacher membership's own ACTIVE PRIMARY Form Teacher responsibility for exactly that school, membership, class and session (SUPPORT is not sufficient). Approval needs an active HM for PRIMARY or Principal for SECONDARY, with the exact active section's verified SECTION grant. Teacher role alone and independent class/subject grants are insufficient. Input must come from server-verified row ownership in a single attendance mutation transaction, **never from browser-supplied flags**. Unit tests cover mismatches and approval separation but have **not been executed**. There is deliberately no attendance write/read endpoint, database table, immutable attendance event or approval/correction workflow yet; the policy is not an operational authorization barrier until integrated with transactional reads and database constraints.


## Student/class/session eligibility foundation (draft, unverified)

A new school-owned `StudentRecord` and `StudentEnrollment` ledger supplies a future authoritative roster relationship: student, ACTIVE school session, explicitly classified active class, and school-owned Section. Student registration, initial enrollment and withdrawal are restricted to the School Admin / School Super Admin in private POST endpoints with immutable actor/reason audit events. Duplicate ACTIVE enrollment for a school/student/session is disallowed by a PostgreSQL partial unique index, and no historical enrollment is inferred. This is a **prerequisite only**, not an attendance register: there are no Form Teacher entry, HM/Principal approval, attendance correction, public class roster or guardian/student attendance reads yet. Attendance services must later join an ACTIVE exact student/class/session enrollment and current teacher/Form Teacher/section authority before any attendance data is created, read or approved. Migration/tests remain unverified.

## Scope

Daily attendance capturing, approval, correction, and historical preservation.

## Required workflow

1. Form Teacher submits attendance.
2. HM or Principal reviews and approves or rejects.
3. Approved attendance becomes official where required by policy.
4. Corrections preserve original record and author info.

## Controls

- Duplicate attendance entries for the same class/date/session are prevented.
- Attendance history remains associated with the correct student, class, and date.
- Student departure or class change does not erase historical attendance records.
