# Attendance

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
