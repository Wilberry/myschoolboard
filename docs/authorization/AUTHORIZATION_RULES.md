# Authorization Rules

## Section-scoped assessment review — Phase 7 draft, unverified

The current Phase 7 `AssessmentReviewEvent` candidate permits an active school `HEAD_OF_SECTION` to APPROVE/RETURN a sealed teacher-created assessment configuration from the stored class's **active same-school PRIMARY section** only. A `PRINCIPAL` may do so only for SECONDARY; both require a current verified SECTION ScopeGrant for the exact `SchoolClass.sectionId`. Review queue/detail and decision repeatedly bind the actor and actual class/section plus current teacher assignment, term/session, and subject. Neither an academic role alone, independent verified CLASS and SUBJECT grants, School Administrator, School Super Admin, Form Teacher nor Platform Super Admin are exceptions. One immutable terminal review event per draft cannot be altered or used for student exam publication.

Answer keys remain separate and are not exposed in reviewer metadata or question previews. No official results or student CBT rights are granted by assessment review. See D-038/ADR-024. Database/CI tests not yet executed.


## Rule precedence

1. Tenant and school scope
2. Role definition
3. Section and class scope
4. Subject and assignment scope
5. Relationship-based access
6. Workflow state authorization
7. Explicit exception or approved support override

## Conflict resolution

When two rules conflict, the safe default is the more restrictive rule. For routine ambiguity, use a reversible least-privilege implementation default under [D-023](../project/STANDING_DEVELOPMENT_MANDATE.md) and document it. Escalate only a material conflict affecting school policy, sensitive data, irreversible live-data changes, or production/release boundaries.

## Required checks

- Every server request must validate tenant context.
- All mutations must check active state, record permissions, and workflow state.
- All exports and file downloads must check the same conditions as read access.
- Background jobs and scheduled tasks must use the same authorization policy context as user requests.
- Teacher academic read, edit, and submit actions for a class and subject require an active assignment matching the exact school, membership, class, and subject tuple.
- Section, class, and subject `ScopeGrant` records must have `verified: true` before they authorize access to that resource. In the current DB-backed principal resolver, CLASS and SUBJECT grants must additionally refer to **active** class/subject records owned by the requested school, regardless of the stored `verified` flag. Scope identifiers are not foreign keys; matching strings alone are insufficient cross-tenant authorization. SECTION and CHILD require their own model/relationship checks before any future school-data routes are exposed. A matching but unverified scope is not permission. Teacher academic operations still require an exact, active class-subject assignment independently of these grants.
- Independent class and subject `ScopeGrant` records must never be combined to infer a teacher assignment. The policy helper enforces the assignment check, but protected academic routes must still load the principal through the assignment-aware resolver and pass the requested class and subject.
- Assignment lifecycle mutations use `school:configure`, currently limited by the policy to active School Administrator and School Super Admin memberships. The four implemented assignment mutation routes authenticate with Better Auth, check the school principal at the route boundary, and call the internal service, which repeats authorization transactionally. Platform Super Admin status does not independently grant school mutation authority. Client-supplied actor identifiers are not accepted. Future academic routes must use the same server-side tenant and service checks; D-020 authorizes a development-only default for assignment **administration** reads: active same-school membership with `school:configure`, minimal necessary fields and concealed cross-tenant IDs. No assignment read handler is implemented yet; teacher self-service reads require exact-resource scoping, not a general `academic:read` grant.

- When a subject-teacher assignment is tied to an academic session, teacher access requires an **exact matching sessionId** as well as the existing active same-school class/subject tuple. The principal resolver excludes session-specific assignments if the session is not ACTIVE. A legacy NULL-session assignment is not proof of teaching in a historical or future named academic session.

- SECTION ScopeGrants in a resolved principal now require matching **active same-school SchoolSection** ownership, alongside the existing verified flag. Future class-level section permissions must independently confirm `SchoolClass.sectionId` equals the authorized section and that the stage/actor role are appropriate. A verified but foreign/inactive section, or a class with NULL sectionId, is not section authority.

## Section-scoped lesson reviewer permission (draft, pending database verification)

Reviewing `LessonNote` SUBMITTED revisions now requires a currently active same-school `HEAD_OF_SECTION` membership for a **PRIMARY** class section, or `PRINCIPAL` for a **SECONDARY** section. The actual stored `SchoolClass.sectionId` must point to an active same-school section; the actor must hold a verified SECTION ScopeGrant for **that exact section** and satisfy `academic:approve`. Independent CLASS or SUBJECT scope IDs do not confer approval rights and unclassified classes are excluded. The reviewer queue binds class/section/grant and active actor within a single SQL statement; the write uses serializable membership/section/scope locks and a separately validating PostgreSQL review-event trigger. Returns require a new author revision; approval never publishes to students. This draft has not been tested against a migrated database.

## Required distinctions

- Role-based permissions are not enough; section, class, subject, relationship, and workflow constraints also apply.
- The School Super Admin role is distinct from the Platform Super Admin role.
- Form Teacher authority is distinct from subject-teacher authority.
- Final report publication is a distinct authorized workflow from ordinary HMs or Principals’ approvals.
