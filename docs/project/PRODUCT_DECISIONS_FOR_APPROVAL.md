# Product Decisions for Approval

## Purpose

This register contains the product-owner decisions that materially affect the Phase 1 engineering foundation. The recommendations below are proposals, not approved decisions. The product owner should approve, reject, or request changes before Phase 1 implementation begins.

## Decision classification

### Phase 1 blockers

These decisions shape the Phase 1 architecture, scaffold, and security baseline and should be resolved before implementation begins.

### Important but deferrable

These decisions matter for later module work, but they do not need to block the initial engineering scaffold so long as their integration boundaries are documented and their eventual approval is tracked.

### Non-blocking for now

These items may remain open without affecting the initial architecture work, but they should still be tracked in the product decision register and roadmap.

## Decision register

| Decision ID | Classification | Question | Recommended option | Meaningful alternatives | Consequences of delay | Approval status |
| --- | --- | --- | --- | --- | --- | --- |
| P-001 | Phase 1 blocker | Which initial technology stack should be used? | Proposed default: modular monolith in TypeScript with Next.js, PostgreSQL, and a tenant-aware auth layer. | React + custom backend; NestJS API + React; other SSR frameworks | Rework risk, delays in scaffolding, and unclear operational setup | Proposed / awaiting owner approval |
| P-002 | Phase 1 blocker | Which hosting and deployment model is used? | Proposed default: managed app + database hosting with clear dev, staging, and prod environments. | Self-hosted VM; full container orchestration; cloud-native architecture too early | Delayed release readiness, unclear ops plan, weak environment boundaries | Proposed / awaiting owner approval |
| P-003 | Phase 1 blocker | What is the support-access and exceptional admin override policy? | Proposed default: explicit support access only when approved, time-limited, justified, and fully audited. | No support override; implicit local admin override; broad support privilege | Privilege escalation and audit risk | Proposed / awaiting owner approval |
| P-004 | Important but deferrable | What is the final parent-first report-card visibility policy? | Proposed default: parent visibility is granted only after explicit relationship validation and approved report-card publication. | Always show linked child data; hide everything until full approval; broader access model | Incorrect report visibility, privacy complaints, or policy disputes | Proposed / awaiting owner approval |
| P-005 | Important but deferrable | Which payment provider and finance model are approved? | Proposed default: keep payment integration as a later-stage decision with explicit evidence and settlement workflow requirements. | Direct provider integration early; manual evidence-first workflow only; no provider integration until after launch | Finance rework and poor payment evidence controls | Proposed / awaiting owner approval |
| P-006 | Important but deferrable | What QR verification fields are safe to disclose publicly? | Proposed default: minimal public fields only, with private report-card access behind a verified identity session. | Full public report metadata; limited public identifiers; fully secret QR payloads | Privacy leakage or compromised authenticity model | Proposed / awaiting owner approval |
| P-007 | Phase 1 blocker | Which auth provider model is approved? | Proposed default: managed OIDC/OAuth provider with strong tenant and role validation. | Self-managed custom auth; magic link-only pilot; passwordless pilot without admin support | Security drift and custom credential-risk increase | Proposed / awaiting owner approval |
| P-008 | Phase 1 blocker | What are the final tenant and school membership rules? | Proposed default: user membership is explicit, scoped, and tracked per school with active/inactive status. | Single-school assumption; implicit membership via email domain; anonymous school fallback | Cross-school leakage and ambiguous access control | Proposed / awaiting owner approval |
| P-009 | Phase 1 blocker | What is the initial database isolation strategy and migration discipline? | Proposed default: application-enforced tenant scope as the default, with Postgres RLS evaluated as an optional defense-in-depth measure only where it materially reduces risk. | Use RLS everywhere from day one; no RLS; rely solely on app-level filtering | Cross-tenant error risk, stronger migration complexity, and operational confusion | Proposed / awaiting owner approval |

## Recommended decision-making process

1. Review the Phase 1 blocker decisions first: stack, hosting, auth, tenant membership, support access, and database isolation.
2. Review the deferrable items only once the Phase 1 scaffold is ready for module work.
3. Approve or reject each item with explicit notes.
4. Record approved decisions in the canonical decision log and architecture ADRs.
5. Keep unresolved items visible in the roadmap and risk register until resolved.

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
