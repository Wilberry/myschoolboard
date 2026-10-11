# Decision Log

## D-001: Documentation-first baseline

- Status: Accepted
- Decision: The repository is being treated as a documentation-first product baseline before implementation.
- Rationale: The repository contains a specification-first documentation baseline and no application implementation evidence.

## D-002: Multi-tenant architecture model

- Status: Proposed
- Decision: Shared SaaS platform with explicit tenant isolation and school-scoped configuration.
- Rationale: Required by product and security specifications.

## D-003: Two distinct super-admin roles

- Status: Required specification
- Decision: Platform Super Admin and School Super Admin are distinct roles with different authorization scopes.
- Rationale: The product requires explicit separation between platform-level and school-level authority.

## D-004: Final publication by School Super Admin

- Status: Required specification
- Decision: Official report cards require final School Super Admin approval before parent access.
- Rationale: This is a mandatory product requirement.

## D-005: 30-day school trash, 90-day platform trash

- Status: Required specification
- Decision: School Trash retention is 30 days; platform Trash retention is 90 days.
- Rationale: Explicitly required by the business specification.

## D-006: Documentation baseline commit on main

- Status: Verified
- Decision: The repository now contains a documentation baseline commit on main.
- Rationale: Repository inspection confirmed the live Git state and the branch was updated accordingly.

## D-007: Phase 1 implementation remains gated

- Status: Superseded by D-010
- Decision: This was the gate before the local foundation work began; it no longer describes the current repository state.
- Rationale: The local foundation and implementation-state decisions are recorded below. Production and later-phase decisions remain gated.

## D-008: Local Phase 1 foundation verified

- Status: Locally implemented and verified for the documented scope
- Decision: The project has a verified local application foundation built with Next.js, Better Auth, Prisma, and PostgreSQL using explicit tenant validation and access checks.
- Rationale: Local migration, seed, test, lint, typecheck, format, and build commands passed. This does not claim production readiness or completion of all SEC-REQ-001 / TEN-REQ-001 acceptance criteria.

## D-009: Production hosting and external identity remain deferred

- Status: Deferred
- Decision: Hosting provider and domain selection remain deferred until local development and testing are complete; external identity-provider selection and production deployment remain unresolved pending owner approval and environment design.
- Rationale: The local validation proves the app foundation, not a hosted production system.

## D-010: Approved local technology direction

- Status: Approved for the local foundation
- Decision: Use TypeScript, Next.js, PostgreSQL, and a modular-monolith architecture for local development and testing.
- Rationale: This is the implemented stack and the approved scope for the current checkpoint; it does not select a hosting provider or domain.

## D-011: Local authentication and identity-provider boundary

- Status: Better Auth implemented locally; external provider deferred
- Decision: Better Auth currently provides local email/password authentication and server-side session validation. Final external identity-provider selection remains open.
- Rationale: Local implementation evidence does not constitute provider approval or production identity readiness.

## D-012: Tenant enforcement and RLS

- Status: Application checks implemented for current access paths; RLS deferred
- Decision: Current protected school access uses server-side active-membership checks and role policy. PostgreSQL RLS is not enabled.
- Rationale: Local integration tests cover implemented tenant-context boundaries; future routes and operations still require the same enforcement and tests.

## D-013: Support-access default

- Status: Default approved; enforcement workflow outstanding
- Decision: No unrestricted routine support access. Any exceptional access must be authorized, scoped, time-limited, justified, and audited.
- Rationale: The policy boundary is approved, but the exact approval, enforcement, expiry, and audit mechanism has not been implemented and remains a security requirement.

## D-014: Later-phase product decisions

- Status: Deferred
- Decision: Payment-provider selection is deferred to Phase 9; parent-first report visibility to Phase 8; QR disclosure to the QR verification implementation phase. Hosting provider and domain remain deferred until local development and testing are complete.
- Rationale: These decisions are outside the verified local foundation and must remain unresolved until their owning phase.

## D-015: Dependency audit remains a checkpoint blocker

- Status: Option A remains active except for the limited development-publication exception approved under D-022 through 2026-10-18.
- Decision: The known dependency findings remain unresolved. D-022 Option C supersedes Option A only for publishing the specifically scoped development-only feature branch and pull request; it does not accept production risk, authorize merging to `main`, production deployment, or release. Preserve the `npm audit --audit-level=high` CI gate and disclose its expected failure.
- Rationale: As reverified on 2026-10-10, no compatible braces patch is published; stable Prisma 6 and 7 still pin the vulnerable deepmerge-ts version; Prisma 8 is only a release candidate and not a compatible update for this foundation. See [Dependency Advisory Assessment](../security/DEPENDENCY_ADVISORY_ASSESSMENT.md). Do not suppress or weaken the CI audit gate.

## D-022: Approved limited development-branch dependency risk exception

- Status: Option C approved for the limited scope below; effective 2026-10-11 through 2026-10-18. D-015 Option A remains active for all other purposes.
- Question: May a reviewed feature branch and pull request for local-development work be published while the two known high-severity advisories remain unresolved and the existing CI audit job fails?
- Approval: Option C approved 2026-10-11.
- Approver: Platform Admin — MySchoolBoard Project Owner.
- Risk owner: Platform Admin — MySchoolBoard Security Risk Owner.
- Authority: Sole Project Owner and Final Decision-Maker.
- Approved scope: Development-only feature-branch publication and draft pull request containing the validated 81-file changed/new manifest (139 projected repository paths), subject to separate push authorization.
- Accepted advisory IDs for this limited exception: GHSA-vfj7-8cjw-p6xm and GHSA-ggr8-5vv4-36mx. The full audit reports 8 high-severity package findings; the production-only audit reports 3. This is a temporary, scoped development-publication risk decision, not a finding that the advisories are harmless or a production security acceptance.
- Compensating controls: Preserve `npm audit --audit-level=high` unchanged in CI and disclose all 8 high-severity findings, including the 3 from production-only audit. Do not bypass, disable, weaken, or misreport the audit gate. Keep the current dependency versions and audit evidence; monitor both advisories and reconsider when compatible remediation becomes available.
- Restrictions: No merge to `main`, production deployment, release, or claim of production readiness under this exception. TCH-REQ-001, TEN-REQ-001, and SEC-REQ-001 remain open. The exception expires or must be reviewed by 2026-10-18.
- Separate authorization: This risk approval does not authorize push, merge, deployment, or release. Push authorization remains separate. The current checkpoint preparation request separately authorizes creating the named local branch, staging the exact manifest, and making one local commit.
- Decision record: The approval identity, scope, expiry, controls, and advisory exposure are also recorded in the [Dependency Advisory Assessment](../security/DEPENDENCY_ADVISORY_ASSESSMENT.md).

## D-016: Canonical teacher assignment persistence

- Status: Implemented and locally validated for the schema and policy-helper checkpoint
- Decision: Persist one assignment row per exact school, membership, class, and subject tuple. Enforce school consistency with composite foreign keys and retain assignment history through status transitions on the same row.
- Rationale: Independent scope grants cannot represent a teacher's exact class-subject authorization. No grants are backfilled. The assignment creation service must validate active teacher role, and protected academic routes remain outstanding.

## D-017: Assignment administration and lifecycle audit

- Status: Service and four mutation routes implemented and locally validated against the disposable PostgreSQL test database; no UI, assignment reads, or academic read routes
- Decision: Derive the actor from the Better Auth session; require the existing `school:configure` policy; validate target membership, class, subject, school, and lifecycle state server-side; write each status change and its actor-level event in one serializable transaction.
- Rationale: Assignment administration must not trust client actor identifiers or mutable timestamps as history. The HTTP handlers authenticate and authorize the school context, then call the service, which locks current authorization and target rows inside the mutation transaction. Composite database constraints bind events to their assignment and teacher; an insert trigger validates the actor snapshot. Append-only triggers block ordinary event changes, while approved school cascade cleanup remains permitted. Mutation-route integration coverage passes against the guarded disposable database. No audit read interface or UI is introduced.

## D-018: Active class and subject name uniqueness

- Status: Implemented and locally validated
- Decision: Active names are unique per school on `lower(btrim(name))`; case differences and surrounding ASCII spaces normalize to the same name, internal whitespace remains significant, and inactive records do not reserve the name.
- Rationale: A read-only duplicate precheck found no existing active collisions in the local development database. Additive partial expression indexes enforce the rule without modifying existing records.

## D-019: Assignment audit actor history and test database isolation

- Status: Approved by the project owner on 2026-10-10
- Decision: Store actor user and membership IDs as immutable historical snapshots without foreign keys. Validate their school/user association when each event is inserted. Later user or membership deletion must not rewrite or remove an event; school deletion remains the existing explicit tenant-cleanup exception. Database-writing tests must use the separately configured disposable `myschoolboard_test` database.
- Rationale: This preserves the current user and membership deletion behavior while retaining actor identity in audit history. Target assignment, school, and teacher membership are enforced with a composite foreign key. The migration and tests passed on the ephemeral test database; the normal development and production databases were not used.

## D-020: Assignment read-route authorization

- Status: Unresolved; product-owner decision required before implementing assignment list or detail routes
- Decision needed: Confirm which active school roles may list and retrieve teacher-assignment administration records and which existing permission governs those reads. `academic:read` exists in the policy helper and authorization rules for academic content, but its approval for assignment-administration records is not established by the permissions matrix.
- Safe interim rule: Do not expose assignment read routes until this decision is recorded. If approved, enforce school membership and resource ownership on the server and require teachers to match the exact active school, class, and subject assignment where applicable. `school:configure` remains the required permission for mutations; platform role alone grants no school authority.
- Rationale: Assignment reads expose staff/class/subject relationships. Reusing an existing policy action for a new resource without explicit product authorization would silently expand access.

## D-021: Academic assignment domain proposals

- Status: Proposed; product-owner approval pending. No schema or application change is authorized by this entry.
- Proposal: Resolve academic-session versus term scope before changing the period-free assignment key; permit multiple teachers per class-subject unless an approved staffing policy requires exclusivity; leave class-subject eligibility unresolved pending curriculum requirements; model Form Teacher responsibility separately with cardinality left open; and prefer multiple responsibilities on one school membership, subject to authorization review.
- Decision detail: P-013 through P-017 in [Product Decisions for Approval](PRODUCT_DECISIONS_FOR_APPROVAL.md) record each exact question, recommendation, alternatives, trade-offs, affected requirements/ADR/schema/tests, and implementation gate.
- Safety constraints: Do not infer historical periods from `createdAt`, status, or `ScopeGrant`. Preserve D-016's current behavior until an approved migration plan exists. Keep D-020 as a separate read-authorization gate and retain the existing tenant, mutation-authorization, lifecycle, and audit controls.
- Rationale: The current schema has no session, term, class-subject eligibility, timetable, or Form Teacher relationship. Selecting constraints before product approval could reject valid staffing arrangements or misclassify historical authorization.

## Unresolved decisions

- Exact support-access escalation, enforcement, expiry, and audit mechanism
- Exact parent-view acknowledgment semantics for the parent-first policy
- Hosting provider and domain selection
- Payment provider, currencies, and reconciliation model
- Final public QR verification and disclosure fields
- External identity-provider selection and production identity strategy
- Remediation or explicit risk acceptance for high-severity dependency advisories
- Limited development-branch/PR dependency-risk exception (D-022), approved through 2026-10-18; D-015 Option A remains active outside that scope
- Whether section, stream, grade, code, or academic-year dimensions belong in class/subject identity
- Whether future audit readers, retention, or export workflows require additional owner-approved policy
- Which roles may read assignment-administration records and which existing permission applies (D-020)
- Academic assignment period scope (P-013), teacher allocation cardinality (P-014), class-subject eligibility (P-015), Form Teacher scope/cardinality (P-016), and combined teacher responsibilities (P-017; D-021)

These items remain unresolved for their relevant phases and must not be represented as implemented or approved by the local foundation.
