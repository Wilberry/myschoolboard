# API and Contract Standards

## API principles

- All API responses must respect tenant scope and role checks.
- Mutations require explicit authorization and validation.
- Errors must be informative without leaking sensitive internals.
- Workflow transitions must have explicit, auditable states.

## Contract expectations

- Include versioning where needed.
- Use explicit enums for states and approval actions.
- Require idempotency for payment callbacks and critical operations.

## Operational liveness contract

`GET /api/health/live` is a public, dependency-free process liveness probe returning only HTTP `200`, `{"status":"ok"}`, and `Cache-Control: no-store`. It does **not** assert database connectivity, tenant availability, authentication readiness, or production operational readiness. It must not return environment configuration, version information, secrets, tenant identifiers, or detailed exceptions. The handler and focused tests are added in the local-CI follow-up, pending full local verification.

## Authenticated school-scoped response caching

The school-details GET and all teacher-assignment mutation responses are required to send `Cache-Control: private, no-store`, including authorization denials and errors. This prevents shared HTTP intermediaries and browsers from persisting school-scoped details or authorization-dependent mutation results. The teacher-assignment response change is authored on a separate development branch and awaits local verification. The policy does not replace server-side authentication, tenant scoping, or transactional authorization.

## Denied school-read operational event

For an authenticated school metadata read denied as `404`, the handler emits a best-effort structured diagnostic event containing only `event: school_read_denied` and a generated random `requestId`. It uses the same event type for absent and cross-tenant schools, and it omits any principal, tenant, resource, cookie, or request identifiers. The HTTP status and body remain generic even when logging fails. This diagnostic event is **not** a durable or immutable audit record; the eventual security audit pipeline requires a separate reviewed design. The implementation and associated integration tests await local verification.

## Teacher-assignment administration reads (authored, not yet verified)

The two D-020 `GET /api/schools/{schoolId}/teacher-assignments` (list) and `GET /api/schools/{schoolId}/teacher-assignments/{assignmentId}` (detail) endpoints now have draft handlers. Both require an authenticated active same-school `school:configure` membership; general `academic:read` and platform role by themselves are not sufficient. The final data fetch repeats school activity, authenticated reader, current active membership, matching role, and school-bound assignment constraints. Response fields are explicitly selected, including nullable `sessionId` to distinguish legacy period-free from new period-bound assignments; no user names/emails, audit events or other relations are included. Collection pagination returns up to 50 assignments in ascending ID order with an optional accessible in-school cursor and `nextCursor` (otherwise null). Invalid filters/paths return `400`, no session `401`, denied/missing/cross-school resources and cursors a non-disclosing `404`, and failures generic `500`. Every response uses `Cache-Control: private, no-store`. No state changes or event writes occur. New integration tests are authored but await execution on the isolated local test DB.

## Form Teacher administration routes (draft, not yet database-verified)

All operations derive their actor from Better Auth, require active same-school `school:configure` membership, recheck the requested school/member under a serializable transaction, conceal foreign or absent resources, and record reasoned append-only audit events. They are **not** teacher self-service APIs.

| Method | Path | Action |
| --- | --- | --- |
| POST | `/api/schools/{schoolId}/form-teachers` | Assign a PRIMARY (unique per class/session) or school-configured SUPPORT teacher to an ACTIVE session/class |
| POST | `/api/schools/{schoolId}/form-teachers/{responsibilityId}/handover` | End a PRIMARY and appoint a replacement in one audited transaction |
| POST | `/api/schools/{schoolId}/form-teachers/{responsibilityId}/end` | Explicitly end an ACTIVE responsibility with a reason, preserving history |
| PATCH | `/api/schools/{schoolId}/settings/form-teachers` | Enable/disable school-specific SUPPORT responsibility with a reason; disable is blocked while active SUPPORT responsibilities exist |

The default `allowCoFormTeachers` setting is false. Each successful mutation returns only minimum responsibility/policy state. No physical delete or student/child/subject access is granted. Responses include `Cache-Control: private, no-store`; invalid JSON/payloads are 400, absent session 401, denied/missing 404, duplicate/invalid state 409, and unexpected faults generic 500. Six new real-session/database tests are authored but not yet executed; actual HTTP/browser and concurrency behavior require verification.

## Timetable administration APIs (authored, unverified)

School-only `school:configure` operators may POST `/api/schools/{schoolId}/timetable/rooms` with `{name, reason}` (upper-case-normalized room); POST `/api/schools/{schoolId}/timetable/slots` with `{termId, assignmentId, roomId?, weekday, startMinute, endMinute, reason}` (ACTIVE term and session, exact session-bound teacher assignment); and POST `/api/schools/{schoolId}/timetable/slots/{slotId}/cancel` with `{reason}`. They use the current Better Auth actor, tenant-scoped serializable SQL checks, atomic insert-only audit events, private/no-store responses, generic `400`/`401`/`404`/`409`/`500` outcomes and no physical delete. The final database GiST exclusions block overlaps among ACTIVE teacher/class/room allocations. There is **no** timetable list, public calendar or student-data read API yet. None of the new migration or tests has been executed.

## Current status

The teacher-assignment module records the four implemented mutation contracts plus newly authored, unverified D-020 administrative read handlers. Other API contracts remain future work and must follow these standards.
