# Staff and Teacher Assignments

## Scope

Teacher profiles, subject assignments, class assignments, form-teacher responsibility, and authorization enforcement.

## Key rules

- Teachers cannot self-assign classes or subjects.
- Form Teacher is separate from subject teaching.
- Subject assignment and form-teacher assignment are not interchangeable.
- Duplicate assignment, conflicting timetable slots, and unauthorized section assignment must be prevented by validation and constraints.

## Important distinction

- Subject assignment = teacher is authorized for a class-subject relationship.
- Form Teacher assignment = teacher has class coordination duties for a specific class.

## Canonical assignment foundation

- `SchoolClass`, `Subject`, and `TeacherClassSubjectAssignment` are implemented in the local schema. Each assignment is unique by school, membership, class, and subject across all statuses; reactivation changes the existing row.
- Composite foreign keys prevent assignment membership, class, and subject references from crossing school boundaries. `ScopeGrant` remains independent and is never backfilled or combined to infer an assignment.
- The teacher policy helper requires an active exact-pair assignment for academic read, edit, and submit. The resolver excludes inactive or revoked assignments and inactive classes or subjects.
- The internal service derives the actor from the Better Auth session, uses the existing `school:configure` authorization policy (active School Administrator or School Super Admin membership), and rechecks that membership in the transaction. Platform role alone grants no school mutation authority.
- The service validates that the target membership is active and has role `TEACHER`, and that the class and subject are active and belong to the same school. A normal foreign key cannot enforce the teacher role condition.
- Deactivate memberships, classes, and subjects rather than physically deleting referenced records. School deletion continues to cascade as tenant cleanup.
- Each successful mutation writes an actor-level event in the same serializable transaction. Mutations lock the school, actor membership, and relevant target rows before checking active state; concurrent revocation either commits first and causes denial/conflict or waits until the mutation commits. PostgreSQL composite constraints bind the event to its school, assignment, and target teacher; an insert trigger validates actor membership/user/school. Actor IDs remain immutable history after user or membership deletion. School cascade cleanup can delete tenant events per the approved retention policy. There is no audit-event read API.
- Active class and subject names are unique per school after case-folding and trimming surrounding ASCII spaces. Inactive names do not reserve uniqueness; internal whitespace is significant.
- Later screens must call this server-side service and must not accept actor IDs as proof of identity or reimplement authorization. No assignment UI or academic read route is included. Four assignment-administration mutation routes are implemented below.
- Section/stream/year-group semantics remain unresolved and are not modeled.

## Mutation API contract — implemented; read routes remain proposed

The `POST` mutation routes below are implemented. The `GET` collection and detail rows are **not yet implemented or registered as handlers**. D-020 now supplies a conservative **development implementation default** for administration reads: authenticated active same-school membership with `school:configure`, never general `academic:read`. This does not claim the endpoints are tested or enabled. Implemented handlers authenticate with a server-side Better Auth session, derive the actor from that session, and derive tenant context from the `{schoolId}` path parameter. Client-supplied actor or tenant IDs are rejected. Handlers call the service layer, which repeats mutation authorization and target checks within its transaction. Cross-school or nonexistent resource IDs return the same concealed `404` response. Unauthenticated requests return `401`; malformed input returns `400`; invalid lifecycle state or duplicate creation returns `409`; unexpected persistence or audit failures return a generic `500`.

| Method and path | Authorization and ownership | State validation and response | Audit |
| --- | --- | --- | --- |
| `GET /api/schools/{schoolId}/teacher-assignments` | Active same-school membership with `school:configure` is the D-020 development reader default (currently School Administrator / School Super Admin), with the minimum necessary fields; do not use broad `academic:read`. | Scope every query to the path school. Return only assignments and fields authorized by the eventual read policy. | No mutation event. Denied cross-tenant attempts are safely logged. |
| `GET /api/schools/{schoolId}/teacher-assignments/{assignmentId}` | Same active same-school `school:configure` reader default; verify assignment ownership using both path `schoolId` and `assignmentId` and conceal cross-school IDs. | Cross-school, deleted, or nonexistent assignment returns concealed `404`. | No mutation event. Denied cross-tenant attempts are safely logged. |
| `POST /api/schools/{schoolId}/teacher-assignments` | Active membership with existing `school:configure`; platform role alone grants no school authority. | Validate active teacher membership with role `TEACHER` and active class/subject in the path school. Duplicate tuple returns `409`; absent or cross-school targets return `404`. | One `CREATED` event in the same transaction; audit failure rolls back creation. |
| `POST /api/schools/{schoolId}/teacher-assignments/{assignmentId}/deactivate` | Active membership with `school:configure`; service scopes assignment by both school and ID. | Only an active assignment may be deactivated; absent/cross-school is `404`, invalid state is `409`. | One `DEACTIVATED` event atomically with the status transition. |
| `POST /api/schools/{schoolId}/teacher-assignments/{assignmentId}/revoke` | Same mutation policy and ownership check. | Validate allowed source state and required reason; absent/cross-school is `404`, invalid state or input is `409`/`400`. | One `REVOKED` event atomically with the status transition. |
| `POST /api/schools/{schoolId}/teacher-assignments/{assignmentId}/reactivate` | Same mutation policy and ownership check. | Revalidate that teacher, class, and subject remain active in the path school; missing/inactive targets are concealed as `404`, invalid source state is `409`. | One `REACTIVATED` event atomically with the status transition. |

All four mutation handlers return `Cache-Control: private, no-store` for successful responses and all denial/error statuses (`400`, `401`, `404`, `409`, and `500`). The response body and status codes are otherwise unchanged. These added regression assertions are awaiting the owner's postponed local database verification.

There is no physical-delete route: lifecycle transitions preserve assignment history. There is no audit-event read route. D-020's documented administrative-reader default permits **new development implementation and negative tests**, but it does not permit teacher self-service reads, wider academic permissions, or production exposure without security validation. The implemented create and lifecycle handlers call the existing service functions and do not introduce another authorization path.
