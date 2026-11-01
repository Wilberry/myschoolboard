# Admissions and Student Records

## Guardian relationship attestation foundation — authored, unverified (Issue #20)

A school administrator may explicitly attest an existing active same-school `PARENT` membership to an actual `ENROLLED` `StudentRecord` with a current ACTIVE enrollment, ACTIVE session, and active classified class. The request must assert that the relationship was verified and provide a reason; the server derives the administrator's identity. No automatic email, name, address, admission-number or account matching is permitted. Links and administrator-signed terminal revocations are append-only, school-owned, and database-validated; attempts to create a duplicate pair or reactivate a revoked pair are rejected.

The proposed authenticated `/api/schools/{schoolId}/guardian-links` GET/POST and `/guardian-links/{linkId}/revoke` POST provide **school-administrator-only link metadata and auditable commands**. Responses never include pupil names, grades, contact details or child content and are private/no-store. There is deliberately **no guardian-facing read route or relationship-derived permission**: the generic `child:read` action from the prerequisite draft #102 remains fail-closed. Active status and current enrollment must always be rechecked at every future guarded data read, regardless of historic attestation. Section/class/term, guardian identity revocation, old browser tabs, and school-level publication controls remain independent requirements.

The additive `20261101010000_guardian_student_attestations` migration and synthetic authenticated PostgreSQL route/SQL-integrity tests are **authored, not locally executed**. Do not treat this as Phase 8 parent report availability or Phase 2/4 completion. No automatic backfill or real school data is involved.

## Administrator student workspace candidate (unverified)

The cumulative `feature/student-admin-workspace` development branch adds a private server-rendered school administrator workspace. Active same-school `school:configure` membership is validated by principal resolution and independently repeated in the final school, student, session and class reads. Results are bounded to 50 admission records, 30 enrollment entries per student, 30 active sessions and 100 classified active classes; names and enrollment history appear only in this authenticated administrator UI, never in a public student API. Existing registration, enrollment and withdrawal POST services retain their serializable authorization, enrollment constraints and append-only audit protections. This workspace is not a searchable whole-school register, admission approval flow, historic promotion manager, teacher roster or guardian portal. Disposable PostgreSQL regression tests are authored but not executed; no production data has been read or migrated.


## Tenant-owned student registration and enrollment foundation (unverified)

The Phase 4/6 prerequisite adds a distinct `StudentRecord` with school-scoped, normalized admission number; minimum school-record names; and an explicit REGISTERED → ENROLLED → WITHDRAWN lifecycle subset. It does **not** auto-create login credentials, infer existing pupil identities, import historic admissions, or join parents/students to Better Auth `User` accounts. The new `StudentEnrollment` stores the exact school-owned student, ACTIVE academic session and active classified class (`SchoolClass.sectionId` points to an active same-school PRIMARY/SECONDARY section), start/end timestamps and ACTIVE/ENDED status. A PostgreSQL partial unique index permits **at most one ACTIVE enrollment per student and academic session**; the school/student/session/class composite foreign keys forbid cross-school placements. ENDED historical enrollment rows retain their original class and period.

Three private, authenticated, school-administrator-only POST routes allow initial student registration, one active enrollment for a REGISTERED student, and explicit withdrawal of an ACTIVE enrollment with a reason. Each operation derives the actor from Better Auth, revalidates school-owned membership inside a serializable transaction and writes `StudentEvent` REGISTERED/ENROLLED/WITHDRAWN with actor, target, reason and time. A dedicated PostgreSQL actor/status validation trigger and append-only UPDATE/DELETE/TRUNCATE protections preserve event integrity. Responses return only the minimum identifiers, admission number or enrollment state—not student names/contacts; logs contain neither identifiers nor student personal data. There are **no GET/list/export routes for pupils, teachers, guardians, or reviewers** in this foundation.

This is **not** the complete admission/acceptance/promotion/graduation/transfer workflow: re-enrollment, class movement and archival require a separate history-preserving process. No student record is mapped from existing users or backfilled. The six real-session disposable-DB tests, migration, Next browser checks and full CI-equivalent pipeline are **authored or pending, not executed**. Sensitive pupil access and attendance remain blocked until explicit validated relationships and approval workflow checks exist.

## Scope

Student admissions, record integrity, enrollment, parent linkage, and lifecycle tracking.

## Requirements

- Support a complete admissions lifecycle from inquiry to enrollment.
- Preserve history through promotion, withdrawal, transfer, or graduation.
- Prevent duplicate active enrollments.
- Enforce auditable corrections and lifecycle status updates.

## Critical rules

- Student class history must remain even when current class membership changes.
- No destructive deletion substitutes for withdrawal or graduation.
- All sensitive student data must be access-restricted by role and tenant.
