# Parent and Student Portals

## Phase 8 individually authorized published grades (source authored; recipient delivery disabled pending verification)

With a current school-adopted release policy AND separate reviewed School Super Admin subject-version release, an eligible verified student or parent can view only their own or currently linked child's individually published subject reports. `GET /api/schools/[schoolId]/published-reports` takes **no pupil identifier, filters or search**; the authenticated same-school membership and currently enrolled exact child are verified again in final PostgreSQL SQL with active exact `StudentAccountLink` or `GuardianStudentLink` and no revocation, current policy revision and newest release ordinal. A guardian-first mode provides parent read first and an explicit exact-release receipt; student access requires a presently valid guardian receipt **and** the student's own exact active verified account link. Revoking either identity link removes permission on the next read, without deleting historical releases or receipts. The browser workspace allows printing/saving an authorized report without a server-hosted PDF or public URL. Report access never follows names, emails, admission numbers or a school admin preview.

Live receipt and report endpoints are independently OFF unless `PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED=true` after comprehensive validation; owner release is independently OFF without `PHASE8_REPORT_RELEASE_ENABLED=true`. Four enumerated school choices per D-063/ADR-049; no school is forced to choose parent-first.


## Phase 8 guardian relationship verification foundation (AUTHORED; NOT VERIFIED)

School configuration administrators may explicitly attest an existing active PARENT membership to one currently enrolled pupil within the **same school**, with `identityVerified: true` and a reason. Both parties' identities are selected by exact server IDs, not matched from names, emails, admission numbers or ambiguous family attributes. Multiple children per guardian and multiple guardian accounts per child are possible; each pair has one append-only attestation and at most one terminal immutable revocation. SQL independently rechecks active school/administrator/guardian/enrollment, with school-locked serialization and actor audit. Administration receives only link metadata, never private pupil grades. **No guardian authentication route to any report, report download, parent-first acknowledgement flow or student portal grade read exists yet.** An active unrevoked guardian link is a necessary relationship input, not sufficient permission; future result access must also require exact independently released immutable composition and school-adopted visibility policy, current enrollment and authorization. D-062/ADR-048; migration and authenticated tests authored, not executed.


## Parent portal

- Unified access to linked children in the same tenant.
- View authorized attendance, releases, fees, school notices, and published report cards.
- Must not access class announcements or other students’ records.

## Student portal

- Personal view of allowed assessments, notes, announcements, assignments, timetable, and publication records.
- Must not access another student’s private information.

## Privacy rule

All portal access must be validated against explicit relationships and server-side policy checks.
