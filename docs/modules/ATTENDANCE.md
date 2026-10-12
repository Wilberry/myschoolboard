# Attendance

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
