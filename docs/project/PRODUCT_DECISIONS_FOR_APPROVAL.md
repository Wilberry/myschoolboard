# Product Decisions for Approval

## Purpose

This register contains the product-owner decisions that materially affect the Phase 1 engineering foundation. The recommendations below are proposals, not approved decisions. The product owner should approve, reject, or request changes before Phase 1 implementation begins.

## Decision register

| Decision ID | Question | Recommended option | Meaningful alternatives | Consequences of delay | Approval status |
| --- | --- | --- | --- | --- | --- |
| P-001 | Which initial stack should be used? | Proposed default: modular monolith in TypeScript with Next.js, PostgreSQL, and a tenant-aware auth layer. | React + custom backend; NestJS API + React; other SSR frameworks | Rework risk, delays in scaffolding, and unclear operational setup | Proposed / awaiting owner approval |
| P-002 | Which hosting and deployment model is used? | Proposed default: managed app + database hosting with clear dev, staging, and prod environments. | Self-hosted VM; full container orchestration; cloud-native architecture too early | Delayed release readiness, unclear ops plan, weak environment boundaries | Proposed / awaiting owner approval |
| P-003 | What is the support-access policy? | Proposed default: explicit support access only, time-bound, justified, and audited. | No support override; implicit local admin override; broad support privilege | Privilege escalation risk and compliance issues | Proposed / awaiting owner approval |
| P-004 | What is the final parent-first policy? | Proposed default: parent visibility is only granted after explicit relationship validation and approved report-card publication. | Always show all linked child data; hide everything until full approval; allow broader parent access | Incorrect report visibility, privacy complaints, or policy conflicts | Proposed / awaiting owner approval |
| P-005 | Which payment provider and finance model are approved? | Proposed default: keep finance integration as a controlled later-stage decision governed by settlement and evidence workflow requirements. | Direct provider integration early; manual evidence-first model only; no provider integration until after launch | Finance rework and poor payment evidence controls | Proposed / awaiting owner approval |
| P-006 | What QR verification fields are safe to disclose publicly? | Proposed default: minimal public fields only, with private report-card access behind a verified identity session. | Full public report metadata; limited public identifiers; fully secret QR payloads | Privacy leakage or compromised authenticity model | Proposed / awaiting owner approval |
| P-007 | Which auth provider model is approved? | Proposed default: managed OIDC/OAuth provider with strong tenant and role validation. | Self-managed custom auth; magic link-only pilot; passwordless pilot without admin support | Security drift and custom credential-risk increase | Proposed / awaiting owner approval |
| P-008 | Is support access allowed for non-technical staff? | Proposed default: no direct access without explicit approval and time-bounded justification. | Limited support access with review; no override path; broad unrestricted access for ops | Security and audit risk especially for academic records | Proposed / awaiting owner approval |
| P-009 | What are the final tenant and school membership rules? | Proposed default: user membership is explicit, scoped, and tracked per school with active/inactive status. | Single-school assumption; implicit membership via email domain; anonymous school fallback | Cross-school leakage and ambiguous access control | Proposed / awaiting owner approval |
| P-010 | What is the initial database and migration approval status? | Proposed default: PostgreSQL with migration-based schema management. | MySQL, SQLite, or documents for early prototype without a clear production path | Weak data integrity and increased migration overhead | Proposed / awaiting owner approval |

## Recommended decision-making process

1. Review each decision in order, starting with stack, hosting, and auth.
2. Approve or reject each item with explicit notes.
3. Record approved decisions in the canonical decision log and architecture ADRs.
4. Keep unresolved items visible in the roadmap and risk register until resolved.

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
