# Parent and Student Portals

## Implementation boundary (Issue #20, 2026-11-01)

The proposed `GuardianStudentLink` and terminal revocation ledger support future school-verified relationships, but are **not** a parent/student portal or permission to read protected child data. An internal `hasCurrentGuardianRelationship` predicate derives the signed-in guardian and checks the school, active PARENT membership, current enrolment/class/section/session and unrevoked link before returning only a boolean; it does **not** grant generic `child:read` or expose student records. A relationship must be current, same-school, unrevoked, and accompanied by active student enrollment and independently published resource visibility at the time of every request. Revoked or withdrawn relationships must not grant new reads, even in a preexisting browser session. No parent-facing report/attendance/fees routes are enabled by the guardian attestation draft. Database and Chrome privacy acceptance remain outstanding.

## Parent portal

- Unified access to linked children in the same tenant.
- View authorized attendance, releases, fees, school notices, and published report cards.
- Must not access class announcements or other students’ records.

## Student portal

- Personal view of allowed assessments, notes, announcements, assignments, timetable, and publication records.
- Must not access another student’s private information.

## Privacy rule

All portal access must be validated against explicit relationships and server-side policy checks.
