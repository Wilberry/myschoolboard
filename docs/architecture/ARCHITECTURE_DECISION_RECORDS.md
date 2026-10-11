# Architecture Decision Records

## ADR-001: Modular domain design

- Status: Approved
- Context: The platform includes many domains with different security and lifecycle needs.
- Decision: Use a TypeScript modular monolith with Next.js for the application and PostgreSQL for persistence. Organize domains behind explicit module boundaries.
- Consequences: Clear separation of concerns and easier testing.

## ADR-002: Relational database with tenant scope

- Status: Approved; locally implemented
- Context: The product requires strong invariants, versioning, historical records, and academic integrity.
- Decision: Use a relational database as the default persistence layer until evidence justifies otherwise.
- Consequences: Strong referential integrity and transactional guarantees.

## ADR-003: Tenant-aware security model

- Status: Partially implemented and locally tested
- Decision: School access must be checked server-side against an authenticated user's active membership. PostgreSQL RLS is not enabled.
- Consequences: Current routes and the protected school details page use application-level checks. This does not verify all future routes, mutations, exports, or background operations.

## ADR-004: Platform and school admin separation

- Status: Policy implemented and unit-tested; no platform administration feature exists
- Decision: Platform Super Admin and School Super Admin remain distinct operational identities.
- Consequences: Clearer access control and safer support models.

## ADR-005: Documentation-first baseline

- Status: Accepted
- Decision: No code implementation begins before the documentation set and requirement traceability are in place.
- Consequences: Slower start but stronger long-term quality.

## ADR-006: Local authentication and provider boundary

- Status: Better Auth implemented locally; external identity-provider decision deferred
- Decision: Use Better Auth for the local email/password development foundation. This does not select the eventual external identity provider or establish production authentication readiness.
- Consequences: Session checks are server-side in implemented routes. Email verification, MFA, production recovery, and provider integration remain unimplemented.

## ADR-007: Hosting and support access

- Status: Hosting deferred; support-access default approved, escalation mechanism unimplemented
- Decision: Defer hosting provider and domain selection until local development and testing are complete. Do not allow unrestricted routine support access. Any exceptional access must be authorized, scoped, time-limited, justified, and audited.
- Consequences: The exceptional-access approval, enforcement, expiry, and audit workflow remains a requirement before support access is built or enabled.

## ADR-008: School-scoped teacher class-subject assignments

- Status: Implemented and locally validated for schema and policy-helper scope; protected academic routes remain outstanding
- Context: Independent class and subject grants cannot establish that a teacher is assigned to their exact combination.
- Decision: Add school-owned class and subject records plus one `TeacherClassSubjectAssignment` per exact school, membership, class, and subject tuple. Enforce tenant consistency with composite foreign keys; use `NO ACTION` for assignment references to membership/class/subject and preserve the existing school deletion cascade.
- Consequences: Status transitions reuse the unique tuple row. Existing `ScopeGrant` data is not migrated or treated as assignment data. The service enforces active membership and `TEACHER` role under transactional row locks. Assignment lifecycle audit events use a composite assignment/teacher foreign key, an insert-time actor membership check, and append-only triggers. Protected academic routes remain outstanding.

## ADR-009: Assignment mutation ordering and audit identity retention

- Status: Approved and validated locally against the disposable PostgreSQL test database
- Context: Assignment authorization could otherwise race with membership revocation, and audit IDs were not associated with the assignment by database constraints. User and membership deletion currently cascade and must not silently rewrite audit history.
- Decision: Lock the school, actor membership, and relevant target rows inside each serializable mutation before checking current state. Enforce event-to-school/assignment/teacher consistency with a composite foreign key; validate actor membership/user/school on event insert. Keep actor IDs as immutable text snapshots without foreign keys. Preserve school cascade deletion as the existing explicit history-cleanup exception. Run database-writing tests only against the guarded disposable test database.
- Consequences: Concurrent revocation either precedes validation and denies/fails the mutation, or waits for a mutation that has already acquired the relevant locks. Actor membership may later be absent while its recorded IDs remain. Privileged database owners can bypass triggers/constraints. The migration and race, trigger, and cascade tests passed on the disposable PostgreSQL test database; CI and production validation remain outstanding.
