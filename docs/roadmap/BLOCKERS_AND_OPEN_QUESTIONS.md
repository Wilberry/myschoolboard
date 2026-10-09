# Blockers and Open Questions

## Blocking decisions for Phase 1

| Decision ID | Question | Why it matters | Recommended default | Latest point in roadmap |
| --- | --- | --- | --- | --- |
| B-001 | Which stack will be used for the initial implementation? | Determines the engineering foundation and scaffolding | Use a modular monolith with approved language/framework choices after product review | Phase 1 start |
| B-002 | What hosting and deployment model will be used? | Drives runtime, backups, CI, and operational strategy | Use a single documented environment model with clear dev/staging/prod separation | Phase 1 start |
| B-003 | Which auth and identity model will be used? | Affects tenant membership, sessions, and security assumptions | Use server-validated auth with explicit tenant scope enforcement | Phase 2 start |
| B-004 | Which payment provider and currencies are approved? | Determines financial workflows and risk exposure | Keep payment provider selection as an explicit approval item | Phase 9 start |
| B-005 | What is the final parent-first report-card acknowledgment policy? | Affects student visibility and business logic | Default to explicit parent acknowledgment record while awaiting approval | Phase 8 start |
| B-006 | What support-access exception model is allowed, if any? | Affects security and support operations | Require explicit approval, limited scope, timebox, and audit record | Phase 3 or support operations |

## Open product and legal questions

- Final school branding and naming model
- Communication channel approvals (email, SMS, WhatsApp)
- Formal privacy and compliance review for Nigeria and future international expansion
- Final QR verification disclosure policy
- Final backup frequency, RPO, and RTO targets
- Retention policy exceptions or legal-hold requirements

## Decision status

These remain unresolved and must be approved before implementation proceeds beyond the documentation foundation. Documentation may continue to describe them as specified, proposed, or unresolved, but the implementation work must not assume a final answer without approval.
