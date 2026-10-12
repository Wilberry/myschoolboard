# School Setup and Academic Structure

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

## Important constraints

- Academic configuration changes must not mutate previously published official records without an explicit correction workflow.
- The product must support both primary and secondary teaching models without forcing one onto the other.
