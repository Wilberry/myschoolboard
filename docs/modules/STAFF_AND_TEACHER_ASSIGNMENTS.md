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

## Assignment administration API — read routes authored, pending verification

The four `POST` mutation routes remain implemented. D-020 administrative `GET` list/detail handlers are now **authored on a draft development branch, not yet validated**. Their permission is an authenticated active same-school membership with `school:configure` (School Administrator / School Super Admin), not general `academic:read`; platform status alone confers no school read access. Handler identity is derived from Better Auth, and assignment queries include a **fresh active-school and matching membership/role predicate in the final Prisma lookup**, not merely in the earlier principal resolution. `GET` never creates audit mutation events. Existing POST handlers retain their own transactional revalidation. Client actor/tenant parameters are not accepted. Missing or cross-school assignment IDs, invalid cursors and denied readers are concealed as `404`; missing sessions return `401`, malformed parameters `400`, and unexpected failures generic `500`.

| Method and path | Authorization and ownership | State validation and response | Audit |
| --- | --- | --- | --- |
| `GET /api/schools/{schoolId}/teacher-assignments` | Active same-school membership with `school:configure` only. Final query rechecks school activity, reader identity and role. | At most 50 records in stable `id` order. Optional tenant-validated `?cursor=<assignmentId>`; returns `{ assignments, nextCursor }`. Unknown filters, empty/duplicate cursor, or malformed path are `400`; nonexistent/other-school cursor is concealed `404`. | No mutation event. Only sanitized, best-effort denied-read diagnostics. |
| `GET /api/schools/{schoolId}/teacher-assignments/{assignmentId}` | Same restricted school-administration reader and final database membership/ownership predicate. | Returns `{ assignment }` or concealed `404`. Unexpected query parameters are `400`. | No mutation event. Only sanitized, best-effort denied-read diagnostics. |
| `POST /api/schools/{schoolId}/teacher-assignments` | Active membership with existing `school:configure`; platform role alone grants no school authority. | Validate active teacher membership with role `TEACHER` and active class/subject in the path school. Duplicate tuple returns `409`; absent or cross-school targets return `404`. | One `CREATED` event in the same transaction; audit failure rolls back creation. |
| `POST /api/schools/{schoolId}/teacher-assignments/{assignmentId}/deactivate` | Active membership with `school:configure`; service scopes assignment by both school and ID. | Only an active assignment may be deactivated; absent/cross-school is `404`, invalid state is `409`. | One `DEACTIVATED` event atomically with the status transition. |
| `POST /api/schools/{schoolId}/teacher-assignments/{assignmentId}/revoke` | Same mutation policy and ownership check. | Validate allowed source state and required reason; absent/cross-school is `404`, invalid state or input is `409`/`400`. | One `REVOKED` event atomically with the status transition. |
| `POST /api/schools/{schoolId}/teacher-assignments/{assignmentId}/reactivate` | Same mutation policy and ownership check. | Revalidate that teacher, class, and subject remain active in the path school; missing/inactive targets are concealed as `404`, invalid source state is `409`. | One `REACTIVATED` event atomically with the status transition. |

All read and mutation handlers return `Cache-Control: private, no-store` on success and on all denial/error statuses. Read responses explicitly select only `id`, `schoolId`, `membershipId`, `classId`, `subjectId`, `status`, and `createdAt`; they do **not** return people, emails, assignment event/audit history, or raw relational records. The read routes have 11 authored database-backed integration tests, but **the full route, PostgreSQL, format, typecheck, build and audit pipeline has not yet been run on this branch**. Historical checkpoint results do not validate these changes.

There is no physical-delete route: lifecycle transitions preserve assignment history. There is no audit-event read route. D-020 authorizes only restrictive **assignment administration** readers; this draft does not introduce any teacher self-service or generalized academic read permission. Actual server transport/browser negative tests and final local CI-equivalent verification remain required before merge/release. No schema migration is needed for these reads.
