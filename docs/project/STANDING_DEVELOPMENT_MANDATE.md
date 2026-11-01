# Standing Development Mandate

**Effective:** 2026-10-12  
**Authorized by:** MySchoolBoard Platform Admin, sole Project Owner  
**Decision:** [D-023](DECISION_LOG.md) — continuous, roadmap-led implementation

## Purpose

MySchoolBoard is an **actively implemented** primary and secondary school management SaaS. The [Product Charter](PRODUCT_CHARTER.md), [Scope](SCOPE_AND_NON_GOALS.md), [Functional Requirements](../requirements/FUNCTIONAL_REQUIREMENTS.md), [Traceability Matrix](../requirements/REQUIREMENTS_TRACEABILITY_MATRIX.md), [Implementation Roadmap](../roadmap/IMPLEMENTATION_ROADMAP.md), [Authorization Rules](../authorization/AUTHORIZATION_RULES.md), and [Security Requirements](../security/SECURITY_REQUIREMENTS.md) are the development specification. The roadmap determines **what to build and in what sequence**, not a series of requests for separate permission to start each module.

The Project Owner gives standing authorization for **routine development within those documented boundaries**. Agents and engineers should implement the next coherent roadmap slice, use professional, reversible engineering defaults where the specification is silent, document the decision, and move forward without recurring owner approvals for every commit, branch, or draft PR.

## Work authorized without repeated approval

- Research and inspect the repository and requirements, design and implement documented features, refactor code, add tests, repair defects, and improve usability, accessibility, security, and observability.
- Create or modify development code, migrations intended for review, synthetic fixtures, non-production configuration, requirements traceability, architecture/decision records, and draft documentation.
- Commit and push **reviewed development changes to non-default feature branches** and create/update **draft PRs**. The repository is public: review every change for credentials, personally identifiable data, private files, proprietary assets, and generated database data **before** publication.
- Select established secure engineering approaches, reversible defaults, and **school-configurable** policy choices when a detailed product choice is not explicit. Record rationale, trade-offs, and tests in the relevant decision/spec; keep material future choices discoverable without stopping unrelated work.
- Continue work on independent, safe modules when another feature, external provider, or production decision is unresolved. Prepare interfaces, mock adapters, and tests without pretending an unselected provider or unfinished flow is operational.
- Use the owner-approved local disposable-database verification workflow when authorized to execute database-writing checks; never infer that a development or shared database is disposable.

## Engineering decision rules

1. **Follow existing requirements first.** Do not redefine the charter, module behavior, authorization matrix, or school-facing approval/publication workflow silently.
2. **Default to least privilege and tenant isolation.** Access to school, staff, parent, student, payment, or academic data must be granted by active membership plus resource ownership and any required verified relationship. A Platform Super Admin does not automatically gain school academic access.
3. **Prefer reversible, additive, configurable changes.** Document reasonable assumptions and their consequences. Do not infer a historic academic period, manufacture student relationships, rewrite preserved audit history, or assign existing school records to a guessed tenant.
4. **Do not hold the entire roadmap hostage to a narrow ambiguity.** Implement unaffected parts and conservative scaffolding; isolate only the exact material decision, migration, disclosure, or external integration that actually needs clarification.
5. **Record architectural defaults in the decision log** and update tests, acceptance evidence and traceability. "Development default" means an engineering implementation assumption, **not** verified school policy or production risk acceptance.
6. **Do not overstate verification.** Document what was authored, what actually ran, what failed, what is blocked, and the tested commit SHA. The owner has elected to run the GitHub CI-equivalent commands locally until GitHub runner billing permits hosted jobs.

## Exceptions requiring an explicit owner decision

Ask only where the answer cannot safely be inferred or represented by a reversible/configurable default, especially:

- New business goals outside the charter and requirements, or conflicting school policies that materially alter legal, academic, financial, or student/guardian rights.
- Production or shared-environment deployment, release, **merging to `main`**, changes to branch protection or financial/billing settings, or accepting a failing security gate as release-ready.
- Live-user access, support impersonation/override, broadening access to sensitive school or minor records, or introducing external communication/payment providers that send real data or money.
- Destructive or non-reversible changes to real data (including migrations/backfills without an authoritative mapping), deletion or alteration of historical academic/financial/audit records, or secrets/credentials publication.
- Disabling/weakening tests, tenant/role checks, immutable audit protections, `npm audit --audit-level=high`, or other mandatory security controls.

For an isolated exception, document the options, select the safest interim behavior (typically deny/no-op/not exposed), continue other work, and ask **one focused question** when the answer is actually required. The permission to implement a feature does **not** override a school user's in-product approval process.

## Decisions and release gates

- **D-020 development default:** administrative teacher-assignment list/detail reads, if implemented, use `school:configure` with active school membership, server-derived tenant scope, minimum needed fields, and concealment of foreign IDs. Do **not** repurpose broad `academic:read` or grant teachers unrestricted assignment-administration reads. Teacher self-service views require a separately scoped design.
- **D-021 / P-013–P-017 development direction:** use school-owned academic sessions and terms; model multiple teachers for a class/subject/session; keep class-subject eligibility school-configurable (do not require a new `ClassSubject` constraint before curriculum design); represent Form Teacher responsibility separately with configurable cardinality/handover; allow a membership to have both subject teaching and Form Teacher responsibilities with distinct authorization. Additive models may proceed; no fabricated backfills or unreviewed destructive uniqueness constraints.
- **P-007 identity direction:** retain Better Auth as the current development auth/session boundary. Implement production-ready patterns in testable modules, but do not enable public admission, external identity, privileged MFA enforcement, email sending, or real account migration on shared/production systems before provider and rollout decisions.
- **D-015:** the unresolved dependency findings remain genuine security/release blockers; maintain the unmodified audit gate. **D-022** is an accurately preserved, time-limited historical exception for publication of the original 81-file checkpoint, with review/expiry **2026-10-18**. This standing mandate does **not renew, extend, retroactively alter, or expand the security risk acceptance in D-022**. Its date is not a recurring engineering milestone or a reason to stop ordinary local development.
- A development feature branch or draft PR is **not** a release. It must explicitly state any unexecuted tests, security findings, blocking dependencies and policy assumptions. All production gates remain mandatory.

## Workflow and authority boundaries

Read [AGENTS.md](../../AGENTS.md), then the relevant roadmap, requirements and module documents; pick the next unblocked vertical slice, implement it with tests, create a reviewable development commit/PR, and update the project status. Do not ask permission for the same routine development category again.

This mandate governs **engineering authorization**, not school-level approvals. Result approval, report-card publication, attendance correction, financial verification, exceptional support access, and other in-product workflow approvals remain enforced as specified.

See [D-023](DECISION_LOG.md). In case of a contradictory historical "awaiting approval" sentence, this later, owner-authorized mandate controls **routine non-production development only**; older decisions retain their historic meaning and all sensitive/production restrictions continue to apply.
