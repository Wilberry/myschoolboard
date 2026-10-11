# Product Decisions for Approval

## Purpose

This register distinguishes approved local-foundation decisions from deferred product and production decisions. Approval of an architectural direction does not mean its controls or later product features are implemented.

## Decision classification

### Foundation decisions

These decisions shape the local foundation. A decision may be approved for local development while production-specific choices remain deferred.

### Deferred decisions

These decisions matter for later modules or production operations and must be resolved before their owning feature is implemented.

### Non-blocking for the local foundation

These items may remain open without affecting local foundation verification, but they remain tracked in this register and roadmap.

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
| P-013       | Academic assignments | Are subject assignments scoped to an academic year/session, a term, or both? | Recommend one school-owned AcademicSession (academic year/session) reference per subject assignment; model AcademicTerm beneath the session, and add term scope only if staffing authorization must vary by term. | Session only; term only; session and term on each assignment; no period scope | Period-free rows cannot safely represent year-specific authorization; old rows have no reliable period mapping | Proposed; awaiting product-owner approval |
| P-014       | Teacher allocation | May multiple teachers hold the same class-subject assignment in one academic session? | Allow multiple teachers unless an approved staffing policy requires exclusivity; keep uniqueness per teacher, class, subject, and session. | Exactly one teacher; one lead plus explicitly modeled contributors | Exclusive allocation would prohibit co-teaching and cannot be inferred from the current requirement | Proposed; awaiting product-owner approval |
| P-015       | Curriculum eligibility | Must each subject be explicitly enabled for each class before a teacher can be assigned? | Leave unresolved until curriculum requirements establish explicit class-subject eligibility. | Require a ClassSubject eligibility relation; allow any active same-school class and subject pair | Premature eligibility rules could reject valid school configurations | Proposed; awaiting curriculum decision |
| P-016       | Form Teacher responsibility | Is Form Teacher responsibility session-scoped, and may a class have one or multiple Form Teachers at a time? | Model a separate class-responsibility relation scoped to the approved academic period; leave one-versus-many and reassignment rules unresolved. | One Form Teacher per class/session; multiple co-responsible teachers; term-specific responsibility | Cardinality and handover constraints cannot be implemented without an approved staffing policy | Proposed; awaiting product-owner approval |
| P-017       | Membership roles | May one school membership both teach subjects and hold Form Teacher responsibility? | Allow both responsibilities on one membership; authorize each from its own relationship rather than requiring separate memberships. | Require mutually exclusive membership roles; add explicit additive role assignments | Current Membership has one role and one membership per user/school, so exclusive roles could force a schema and identity-model change | Proposed; awaiting product-owner and authorization review |

## Academic Assignment Proposal Details — Not Approved

The following recommendations are proposals only. They do not change TCH-REQ-001, D-016, ADR-008, or the current schema. Do not implement a proposal until its approval is recorded and dependent requirements and tests are reviewed.

### P-013 — Academic period scope

- Exact question: Are subject assignments scoped to an academic year/session, a term, or both?
- Recommendation: Use one school-owned `AcademicSession` for the academic year/session and reference it from subject assignments. Represent `AcademicTerm` as a child of the session. Add term-level assignment scope only if the approved policy requires authorization to change within the session.
- Alternatives: Session only; term only; both session and term on each assignment; retain period-free assignments.
- Trade-offs: Session scope is the smallest coherent basis for year-specific staffing and avoids inventing term-specific authorization. Term scope supports within-year changes but adds assignment cardinality and lifecycle complexity. Session plus term requires an explicit rule for whether assignments apply to one term or all terms.
- Affected requirements and records: SCH-REQ-001, TCH-REQ-001, D-016, ADR-008; `AcademicSession`, `AcademicTerm`, `TeacherClassSubjectAssignment`, and assignment audit-event context; tests for same-session duplicates, cross-session assignments, term boundaries if selected, and tenant isolation.
- Implementation gate: Blocks period-aware assignment schema and authorization. Existing rows have no period and must not be mapped from `createdAt`, status, or independent scope grants.

### P-014 — Teacher allocation cardinality

- Exact question: May multiple teachers hold the same class-subject assignment during the same academic session?
- Recommendation: Permit multiple teachers unless an approved staffing policy explicitly requires one. Keep duplicate prevention on the individual teacher/class/subject/session tuple; do not add uniqueness on class-subject-session alone.
- Alternatives: Exactly one teacher; one lead teacher plus separately modeled contributors.
- Trade-offs: Multiple teachers supports co-teaching and specialist coverage but does not itself resolve timetable conflicts. Exclusive allocation is simpler but may reject valid staffing arrangements.
- Affected requirements and records: TCH-REQ-001, D-016, ADR-008; the assignment unique key and active-assignment queries; tests for multiple memberships on one pair, same-teacher duplicate attempts, and concurrent allocations.
- Implementation gate: Blocks any constraint that prohibits multiple teachers. Retaining the current per-teacher uniqueness rule can proceed only after P-013 determines period scope and D-016 is reconciled with the acceptance wording “duplicate active assignments.”

### P-015 — Class-subject eligibility

- Exact question: Must a subject be explicitly configured as eligible for a class before teacher assignment is allowed?
- Recommendation: Leave unresolved until curriculum requirements define whether schools configure an explicit class-subject offering.
- Alternatives: Add a school-scoped `ClassSubject` relation and require assignments to reference it; allow any active same-school class and subject pair.
- Trade-offs: Explicit eligibility prevents invalid curriculum combinations but introduces catalog setup and migration obligations. Allowing any pair is flexible but cannot validate curriculum appropriateness.
- Affected requirements and records: SCH-REQ-001, TCH-REQ-001, ADR-008; potential `ClassSubject` relation and assignment foreign key; tests for eligible and ineligible combinations and cross-school association prevention.
- Implementation gate: Blocks eligibility enforcement only; do not create `ClassSubject` until curriculum policy approves it.

### P-016 — Form Teacher scope and cardinality

- Exact question: Is Form Teacher responsibility scoped to an academic session or term, and can a class have one or multiple active Form Teachers at once?
- Recommendation: Represent it as a separate class-responsibility relation scoped to the approved academic period. Leave cardinality, handover, and reassignment behavior unresolved.
- Alternatives: One per class/session; multiple co-responsible teachers; one per class/term; another explicitly approved staffing rule.
- Trade-offs: A separate relation preserves the documented distinction from subject teaching and can support attendance authorization. A uniqueness rule chosen prematurely could prevent shared responsibility or legitimate transitions.
- Affected requirements and records: TCH-REQ-001, ATT-REQ-001, D-016, ADR-008; potential `FormTeacherAssignment` relation and its audit/authorization path; tests for cardinality, reassignment, period boundaries, concurrency, and tenant isolation.
- Implementation gate: Blocks Form Teacher persistence and authorization until both period and cardinality rules are approved.

### P-017 — Combined teacher responsibilities

- Exact question: May a person teach one or more subjects and also serve as Form Teacher in the same school?
- Recommendation: Allow both responsibilities on one school membership and authorize subject and class-coordination actions through their respective assignment relationships.
- Alternatives: Make membership roles mutually exclusive; replace the single membership role with additive role assignments.
- Trade-offs: Reusing one membership avoids duplicate identities and is consistent with one membership per user/school. The current `Membership.role` is single-valued, so granting Form Teacher authority through the new relationship needs an explicit policy decision; do not duplicate memberships to work around this without approval.
- Affected requirements and records: USR-REQ-001, TCH-REQ-001, ATT-REQ-001, D-016, ADR-008; `Membership.role`, `TeacherClassSubjectAssignment`, potential `FormTeacherAssignment`, principal resolver and authorization policy; tests for combined responsibilities and least-privilege separation.
- Implementation gate: Blocks combined-role authorization and any membership-role/schema change until product and security review approve the model.

### Cross-cutting migration and release conditions

- No historical assignment period may be inferred from `createdAt`, status, or `ScopeGrant`. Before requiring a period reference, approve authoritative backfill, a bounded legacy/unscoped state, or a controlled cutoff.
- Preserve school-derived tenant scope, composite school relationships, `school:configure` mutation authorization, platform/school role separation, transactional target validation, atomic append-only audit events, and current lifecycle semantics.
- D-020 remains a separate gate; this proposal does not authorize assignment list/detail routes.
- TCH-REQ-001, TEN-REQ-001, and SEC-REQ-001 remain incomplete. The unresolved dependency audit findings remain a release blocker.

## Recommended decision-making process

1. Preserve the approved local stack and authorization defaults recorded above.
2. Complete the exact support-access mechanism before implementing or enabling support access.
3. Resolve parent visibility, payment, and QR disclosure in their owning phases.
4. Select hosting, domain, and external identity strategy only after local development and testing are complete.
5. Keep deferred decisions visible in the roadmap and risk register until resolved.

## Approval notation

Use one of the following statuses when returning a decision:

- Approved: accepted as the implementation default
- Rejected: not approved for the implementation baseline
- Request change: a modified option is required before proceeding
- Deferred: the decision is intentionally delayed with explicit risk acknowledgment

## Owner approval template

- Decision ID:
- Decision result:
- Requested changes or constraints:
- Approver:
- Date:
- Notes:

This register is intentionally separate from technical recommendations so that product ownership can evaluate policy and business impact without conflating it with engineering preference.
