# School Setup and Academic Structure

## School section configuration workspace (unverified)

The protected existing school setup page now lists same-school PRIMARY/SECONDARY sections, shows each class's explicit section or Unclassified state, and presents forms to create sections and classify **active, unclassified** classes through the administrator-only server routes. Already-classified classes have no UI move action; moving them needs a separate historical reclassification review. The server `readSchoolSetup` selects at most 100 sections and classes, repeating active school administrator membership in the final Section query, and never trusts the form for tenant ownership. Two new database read-isolation scenarios and actual browser keyboard/POST/error handling checks remain **unexecuted**.

## Primary/secondary section ownership (draft, unverified)

The additive `SchoolSection` model stores named, active, school-owned PRIMARY and SECONDARY sections; `SchoolClass.sectionId` is nullable, has a composite same-school foreign key, and is **not backfilled**. Unclassified historical classes are not assumed to belong to either stage. School Admin / School Super Admin may create sections with a reason via `POST /api/schools/{schoolId}/sections` and classify an active unclassified class via `POST /api/schools/{schoolId}/classes/{classId}/section`. Active membership is checked in a serializable transaction with resource locks and an append-only school configuration event. Changing an already assigned section is rejected until an explicit history-preserving reclassification workflow exists.

Verified SECTION ScopeGrant identifiers are now filtered through active sections owned by the requested school in `resolveSchoolPrincipal`; a forged foreign-school section ID cannot supply authority. Future HM/Principal approval, timetable or attendance endpoints **must** also check that each requested class has the appropriate exact `SchoolClass.sectionId` and stage; merely passing a valid sectionId is insufficient. No new HM/Principal student-data or timetable privilege is enabled by this source-only foundation. SQL migration and five database integration cases are authored, **not executed**.

## Configurable Form Teacher policy (draft, pending verification)

A school-owned `allowCoFormTeachers` flag defaults to false; an authorized school administrator may change it through the separately authenticated `PATCH /api/schools/{schoolId}/settings/form-teachers` endpoint, giving a reason recorded in `SchoolConfigurationEvent`. Disabling the flag is rejected while any active SUPPORT responsibilities remain. PRIMARY Form Teacher responsibility is at most one teacher per class/session; any SUPPORT assignment requires an active PRIMARY. Responsibilities are separate from academic subject teaching and grant no student-data rights. The policy API and model are authored but **not yet validated on the local database**.

## Scope

## Scope

This module manages school identity, branding, academic sessions, terms, sections, classes, subject catalogs, grading configuration, and school-specific policies.

## Requirements

- Support primary, secondary, or combined-school structures.
- Keep settings tenant-scoped.
- Version or date-stamp configurations that affect historical records.
- Prevent silent recalculation of previous results when configuration changes.

## Academic sessions, terms, and catalogs — new draft implementation

This development follow-up adds school-owned `AcademicSession` (name, start/end dates, PLANNED/ACTIVE/CLOSED state) and `AcademicTerm` (session, name, positive position, dates and state), both tenant-bound through composite school/session references. The migration enforces valid date order, unique session names per school, unique term names/positions per session and at most one ACTIVE session per school and ACTIVE term per session. **No activation, closing, academic-record calculation or historic assignment backfill is enabled by these create-only handlers.** Existing period-free teacher assignments are preserved without inferred session mappings.

School Administrators and School Super Admins with active same-school membership may create draft academic sessions through `POST /api/schools/{schoolId}/academic/sessions`, terms through `POST /api/schools/{schoolId}/academic/sessions/{sessionId}/terms`, classes through `POST /api/schools/{schoolId}/classes`, and subjects through `POST /api/schools/{schoolId}/subjects`. The classes/subjects reuse existing school-owned models and normalized active-name uniqueness. Creation is a serializable transaction with active school/actor membership revalidation and one append-only `SchoolConfigurationEvent`, whose actor relationship and mutation protection are enforced by database triggers. Term dates must lie within the owning session and a foreign-session ID is concealed as `404`. Anonymous requests `401`, unauthorised/missing target `404`, bad input `400`, duplicates `409`, unexpected faults `500`; responses private/no-store.

These routes are **create-only**, not general academic read authorization or production workflow publication. Section structures, streams, grading-policy versioning, academic-period activation/closure, session-linked new teacher assignments, staff responsibilities and UI remain separate work. The migration and new database tests have not been run in the owner's postponed local CI-equivalent verification.

## School setup workspace — new draft UI

A guarded school setup page at `/schools/{schoolId}/setup` uses active school `school:configure` authority to display the school's latest 100 sessions, terms, classes and subjects. Each final collection query repeats same-school active membership and role conditions, even after the initial principal resolution. Users can create new planned sessions/terms and class/subject catalog entries through the existing protected POST handlers. Only verified success refreshes the view; errors are generic. There is no general academic read endpoint, teacher access, grade history recalculation or period activation from this screen. Four new database-backed read regression tests and browser-level workflow checks are **not yet executed**.

## Academic period activation and closure (new, unverified)

School Administrators and School Super Admins can explicitly transition an academic session from PLANNED to ACTIVE and then CLOSED, and a term from PLANNED to ACTIVE and then CLOSED, through the protected session/term status POST APIs and reason-required controls in the academic setup workspace. All changes use serializable transactions, lock the school, administrator membership, academic session and term in a consistent order, and append a school-owned `SchoolConfigurationEvent` with the operator's justification. The database enforces at most one ACTIVE session per school and one ACTIVE term per session. A term cannot activate unless its parent session is ACTIVE, and a session cannot close while any of its terms remain PLANNED or ACTIVE. CLOSED is terminal; neither API changes dates or historical assignments, results or official records.

The event type enum and nullable event reason are added through a separate additive migration. Existing configuration creation events keep a NULL reason. New policy-unit and disposable-database route tests are authored, not run. Real HTTP/browser behavior and migration verification remain outstanding.

## Important constraints

- Academic configuration changes must not mutate previously published official records without an explicit correction workflow.
- The product must support both primary and secondary teaching models without forcing one onto the other.
