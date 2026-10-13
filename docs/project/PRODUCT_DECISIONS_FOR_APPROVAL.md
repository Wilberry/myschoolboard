# Product Decisions and Development Defaults

## Purpose

This register distinguishes established design requirements, reversible development defaults, school-configurable policies, and choices reserved for production or irreversible changes. Under the Project Owner's [Standing Development Mandate](STANDING_DEVELOPMENT_MANDATE.md) (D-023, 2026-10-12), engineers may implement documented roadmap features using secure, reversible, testable defaults **without repeated per-feature approvals**. Development authorization never implies feature completion, school-specific adoption or production risk acceptance.

## Decision classification

### Foundation decisions

These decisions shape the local foundation. A decision may be approved for local development while production-specific choices remain deferred.

### Deferred decisions

These decisions are tracked in their owning phases. They block **only** the exact unsafe, irreversible, sensitive-data, external-provider, or production action requiring a material choice; they do not freeze independent module work or additive/configurable implementation.

### Non-blocking for the local foundation

These items may remain open without blocking unrelated roadmap implementation. They remain tracked in this register and roadmap and can be handled through reversible defaults under D-023.

## Decision register

| Decision ID | Classification        | Question                                                                  | Recommended option                                                                                                                      | Meaningful alternatives                                          | Consequences of delay                                      | Approval status                                                              |
| ----------- | --------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| P-001       | Phase 1 foundation    | Which initial technology stack and architecture direction should be used? | TypeScript modular monolith, Next.js, and PostgreSQL.                                                                                   | React + custom backend; NestJS API + React; other SSR frameworks | Rework risk if this direction changes                      | Approved for local development and testing                                   |
| P-002       | Production operations | Which hosting provider, domain, and deployment model should be used?      | Defer until local development and testing are complete.                                                                                 | Managed app/database; self-hosted VM; other approved environment | Production release planning remains open                   | Deferred; no provider or domain selected                                     |
| P-003       | Before support access | What is the support-access and exceptional admin override policy?         | No unrestricted routine access. Exceptional access must be authorized, scoped, time-limited, justified, and audited.                    | No support override; other explicitly governed model             | Privilege escalation and audit risk                        | Default approved; exact escalation/enforcement/audit mechanism unimplemented |
| P-004       | Phase 8               | What is the final parent-first report-card visibility policy?             | Keep report visibility subject to approved publication and validated parent relationship; finalize acknowledgment semantics in Phase 8. | Other explicitly approved parent visibility policy               | Incorrect report visibility or privacy exposure            | Deferred to Phase 8                                                          |
| P-005       | Phase 9               | Which payment provider and finance model are approved?                    | Decide provider, currency, and reconciliation workflow in Phase 9.                                                                      | Approved provider options or evidence-first workflow             | Finance rework and payment risk                            | Deferred to Phase 9                                                          |
| P-006       | QR verification phase | What QR verification fields are safe to disclose publicly?                | Decide minimal disclosure and token lifecycle when QR verification is implemented.                                                      | Approved limited disclosure alternatives                         | Privacy leakage or compromised authenticity model          | Deferred; implementation phase to be assigned                                |
| P-007       | Identity strategy     | Which external identity provider model is approved?                       | Better Auth is implemented for local email/password development; make the external provider decision separately.                        | Approved OIDC/OAuth provider or another reviewed strategy        | Production identity and recovery design remain open        | Better Auth local implementation verified; external provider deferred        |
| P-008       | Phase 1 foundation    | What are the initial tenant and school-membership rules?                  | Explicit active membership per school; access checks derive scope from authenticated user and requested resource membership.            | Single-school or other approved model                            | Cross-school leakage and ambiguous access control          | Approved local model; enforcement coverage is limited to implemented paths   |
| P-009       | Phase 1 foundation    | What is the initial database isolation strategy and migration discipline? | Application-enforced tenant scope for implemented paths; use reviewed Prisma migrations. PostgreSQL RLS is not enabled.                 | Enable RLS as an additional defense-in-depth control             | Cross-tenant error risk if future access paths omit checks | App-level approach approved for local foundation; RLS deferred               |
| P-010       | Academic structure   | What identifies a class or subject beyond display name?                    | Enforce active same-school uniqueness on lower-case names trimmed of surrounding ASCII spaces; defer codes and section/stream/year-group dimensions. | Approve additional identity fields or whitespace normalization | More detailed class structure may require a later migration | Active-name rule implemented; remaining identity dimensions deferred |
| P-011       | Assignment administration | What actor-level audit is required for assignment lifecycle changes?       | Record actor, school, target, assignment, transition, timestamp, and reason in a dedicated event table written atomically with mutations. | Expand event data or define approved readers                     | Audit queries and retention need future policy                 | Implemented locally; direct UPDATE/DELETE blocked, school cascade deletion remains |
| P-012       | Assignment audit history | How should actor membership references behave after user or membership deletion? | Preserve actor user and membership IDs as immutable event snapshots without foreign keys; validate the association at insert time. School deletion remains the existing event-history deletion exception. | Retain memberships or block user deletion while referenced by events | Historical actor context may be incomplete if IDs are not retained | Approved by project owner on 2026-10-10 |
| P-013       | Academic assignments | Are subject assignments scoped to an academic year/session, a term, or both? | Recommend one school-owned AcademicSession (academic year/session) reference per subject assignment; model AcademicTerm beneath the session, and add term scope only if staffing authorization must vary by term. | Session only; term only; session and term on each assignment; no period scope | Period-free rows cannot safely represent year-specific authorization; old rows have no reliable period mapping | D-023 default: AcademicSession for new assignments; no legacy backfill         |
| P-014       | Teacher allocation | May multiple teachers hold the same class-subject assignment in one academic session? | Allow multiple teachers unless an approved staffing policy requires exclusivity; keep uniqueness per teacher, class, subject, and session. | Exactly one teacher; one lead plus explicitly modeled contributors | Exclusive allocation would prohibit co-teaching and cannot be inferred from the current requirement | D-023 default: co-teaching permitted; one teacher/pair/session unique          |
| P-015       | Curriculum eligibility | Must each subject be explicitly enabled for each class before a teacher can be assigned? | Use active, same-school class and subject validation by default; add optional school-configurable curriculum eligibility. | Require a ClassSubject eligibility relation; allow any active same-school class and subject pair | Premature eligibility rules could reject valid school configurations | D-023 default: active same-school pairs; optional curriculum config            |
| P-016       | Form Teacher responsibility | Is Form Teacher responsibility session-scoped, and may a class have one or multiple Form Teachers at a time? | Model separate session-scoped class responsibility, with a primary holder, auditable handover and configurable co-responsibility. | One Form Teacher per class/session; multiple co-responsible teachers; term-specific responsibility | Cardinality and handover constraints cannot be implemented without an approved staffing policy | D-023 default: separate responsibility; configurable cardinality               |
| P-017       | Membership roles | May one school membership both teach subjects and hold Form Teacher responsibility? | Allow both responsibilities on one membership; authorize each from its own relationship rather than requiring separate memberships. | Require mutually exclusive membership roles; add explicit additive role assignments | Current Membership has one role and one membership per user/school, so exclusive roles could force a schema and identity-model change | D-023 default: combined responsibilities, separate authorization               |

## Academic Assignment Development Defaults — D-023

The Project Owner has authorized the following **reversible implementation defaults** under D-023 and D-021; engineers may build additive schema, services, UI, and tests within the documented requirements without repeated approval requests. The descriptions below preserve alternatives for school-level configuration and historical context. They **do not** mark TCH-REQ-001, D-016, ADR-008, or new academic-period schema as implemented or tested. Do not fabricate historic period mappings, relax tenant checks, or perform destructive migrations to match a proposed default.

### P-013 — Academic period scope

- Exact question: Are subject assignments scoped to an academic year/session, a term, or both?
- Recommendation: Use one school-owned `AcademicSession` for the academic year/session and reference it from subject assignments. Represent `AcademicTerm` as a child of the session. Add term-level assignment scope only if the approved policy requires authorization to change within the session.
- Alternatives: Session only; term only; both session and term on each assignment; retain period-free assignments.
- Trade-offs: Session scope is the smallest coherent basis for year-specific staffing and avoids inventing term-specific authorization. Term scope supports within-year changes but adds assignment cardinality and lifecycle complexity. Session plus term requires an explicit rule for whether assignments apply to one term or all terms.
- Affected requirements and records: SCH-REQ-001, TCH-REQ-001, D-016, ADR-008; `AcademicSession`, `AcademicTerm`, `TeacherClassSubjectAssignment`, and assignment audit-event context; tests for same-session duplicates, cross-session assignments, term boundaries if selected, and tenant isolation.
- Implementation direction: Add a school-owned `AcademicSession` and child `AcademicTerm` to new period-aware workflows and support session-scoped **new** assignments. Existing period-free rows have no authoritative session; use a reviewed, additive legacy state and do **not** infer a backfill from `createdAt`, status, or independent grants. A mandatory backfill or destructive constraint remains separately gated.

### P-014 — Teacher allocation cardinality

- Exact question: May multiple teachers hold the same class-subject assignment during the same academic session?
- Recommendation: Permit multiple teachers unless an approved staffing policy explicitly requires one. Keep duplicate prevention on the individual teacher/class/subject/session tuple; do not add uniqueness on class-subject-session alone.
- Alternatives: Exactly one teacher; one lead teacher plus separately modeled contributors.
- Trade-offs: Multiple teachers supports co-teaching and specialist coverage but does not itself resolve timetable conflicts. Exclusive allocation is simpler but may reject valid staffing arrangements.
- Affected requirements and records: TCH-REQ-001, D-016, ADR-008; the assignment unique key and active-assignment queries; tests for multiple memberships on one pair, same-teacher duplicate attempts, and concurrent allocations.
- Implementation direction: Support multiple teachers for one class-subject-session by default; prevent duplicates for the same teacher/class/subject/session. Do not introduce a global exclusive-teacher uniqueness constraint. Timetable conflicts and school-configurable co-teaching rules require their own tests; historical period-free rows are preserved.

### P-015 — Class-subject eligibility

- Exact question: Must a subject be explicitly configured as eligible for a class before teacher assignment is allowed?
- Development default: Permit a teacher assignment only between an active class and active subject **in the same school** unless that school's configured curriculum explicitly restricts eligibility. Model optional curriculum eligibility separately; do not assume a global `ClassSubject` requirement for every primary/secondary school.
- Alternatives: Add a school-scoped `ClassSubject` relation and require assignments to reference it; allow any active same-school class and subject pair.
- Trade-offs: Explicit eligibility prevents invalid curriculum combinations but introduces catalog setup and migration obligations. Allowing any pair is flexible but cannot validate curriculum appropriateness.
- Affected requirements and records: SCH-REQ-001, TCH-REQ-001, ADR-008; potential `ClassSubject` relation and assignment foreign key; tests for eligible and ineligible combinations and cross-school association prevention.
- Implementation direction: Implement school-scoped, configurable eligibility when the curriculum module is built. Until then, validate active same-school class and subject; do not invent a mandatory `ClassSubject` relation or reject otherwise-valid schools solely because a curriculum catalog has not been configured.

### P-016 — Form Teacher scope and cardinality

- Exact question: Is Form Teacher responsibility scoped to an academic session or term, and can a class have one or multiple active Form Teachers at once?
- Development default: Use a separate school/class/session Form Teacher responsibility relation, distinct from subject teaching. Support a primary responsible teacher with auditable handover, while designing co-responsibility/cardinality as a school-configurable option; do not impose a destructive uniqueness rule on historical records.
- Alternatives: One per class/session; multiple co-responsible teachers; one per class/term; another explicitly approved staffing rule.
- Trade-offs: A separate relation preserves the documented distinction from subject teaching and can support attendance authorization. A uniqueness rule chosen prematurely could prevent shared responsibility or legitimate transitions.
- Affected requirements and records: TCH-REQ-001, ATT-REQ-001, D-016, ADR-008; potential `FormTeacherAssignment` relation and its audit/authorization path; tests for cardinality, reassignment, period boundaries, concurrency, and tenant isolation.
- Implementation direction: Add a separate, tenant-bound and auditable Form Teacher responsibility model. Implement safe, tested school-configurable cardinality/handover rules without broadening subject-teaching access or rewriting historical assignments; do not enable unverified rights to pupil data.

### P-017 — Combined teacher responsibilities

- Exact question: May a person teach one or more subjects and also serve as Form Teacher in the same school?
- Recommendation: Allow both responsibilities on one school membership and authorize subject and class-coordination actions through their respective assignment relationships.
- Alternatives: Make membership roles mutually exclusive; replace the single membership role with additive role assignments.
- Trade-offs: Reusing one membership avoids duplicate identities and is consistent with one membership per user/school. The current `Membership.role` is single-valued; derive additional Form Teacher authority from a verified active responsibility relation rather than fabricating duplicate memberships or assigning unrelated permissions.
- Affected requirements and records: USR-REQ-001, TCH-REQ-001, ATT-REQ-001, D-016, ADR-008; `Membership.role`, `TeacherClassSubjectAssignment`, potential `FormTeacherAssignment`, principal resolver and authorization policy; tests for combined responsibilities and least-privilege separation.
- Implementation direction: Permit one membership to have both subject-teaching and Form Teacher responsibilities, with distinct active assignment checks for each action. Use additive authorization relationships and negative tenant-isolation tests; no role escalation follows merely from the combined labels.

### Cross-cutting migration and release conditions

- No historical assignment period may be inferred from `createdAt`, status, or `ScopeGrant`. Before requiring a period reference, approve authoritative backfill, a bounded legacy/unscoped state, or a controlled cutoff.
- Preserve school-derived tenant scope, composite school relationships, `school:configure` mutation authorization, platform/school role separation, transactional target validation, atomic append-only audit events, and current lifecycle semantics.
- D-020 now has a **restricted development default** for assignment administration reads: active same-school members with `school:configure`, minimal data, and tenant-safe concealment. Do not make these routes available to teachers through general `academic:read`; implement separate teacher self-service only with exact-assignment checks.
- TCH-REQ-001, TEN-REQ-001, and SEC-REQ-001 remain incomplete. The unresolved dependency audit findings remain a release blocker.

## Recommended decision-making process

1. Implement the next documented roadmap slice using secure, reversible, testable engineering defaults under D-023; do not ask for repeated routine engineering approval.
2. Record meaningful alternatives and school-configurable policy parameters as the owning module is implemented.
3. Require actual owner decisions only for conflicts with material business or privacy consequences, irreversible real-data changes, new external services affecting real users or funds, or production/release exceptions.
4. Defer hosting, domain and external identity provider selection until needed for release architecture; continue local development with the current stack.
5. Keep outstanding decisions visible without asserting that tests, validations or deployments have passed.

## Decision notation and reserved owner review

- **Development default under D-023:** may be implemented additively within the roadmap, with explicit tests and documentation; not proof of production validation.
- **School-configurable:** do not impose a universal business rule when primary and secondary schools may differ.
- **Deferred external/production decision:** do not select a real provider or activate live processing prematurely; independent local implementation continues.
- **Reserved owner decision:** a material new business rule, sensitive-data disclosure, irreversible real-data change, production deployment, merge/release or security exception. Ask one focused question when actually needed.

Decision records for those rare reserved items should include the decision ID, recommended option, trade-offs, scope, owner response and date. See [Standing Development Mandate](STANDING_DEVELOPMENT_MANDATE.md).

**P-004 Phase 8 implementation note (2026-10-13):** The four school recipient-preference modes are now *configurable development-only intent* in `ReportVisibilityPolicyRevision`; none grants live report access, parent-first acknowledgment or release. P-004's actual parent-first acknowledgment rules remain **unresolved** and are isolated from this additive foundation. Future result publication and student/guardian access remain blocked until that rule, verified relationship enforcement and cumulative security/release checks are accepted.
