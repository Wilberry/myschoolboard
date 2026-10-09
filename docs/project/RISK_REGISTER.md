# Risk Register

| Risk ID | Risk | Impact | Likelihood | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | Empty repository baseline | Delivery delay and missing implementation structure | High | Start with documentation baseline and requirement traceability | Open |
| R-002 | Cross-tenant data leakage | Security breach and legal exposure | High | Enforce tenant-bound authorization and isolation tests | Open |
| R-003 | Academic data integrity issues | Incorrect results and audit problems | High | Use explicit workflow states and immutable audit trails | Open |
| R-004 | Unapproved support access | Data exposure and compliance risk | Medium | Require explicit approval and audit logging | Open |
| R-005 | Payment fraud or duplicate callbacks | Financial loss | Medium | Idempotent processing and verification workflow | Open |
| R-006 | Unclear parent-first semantics | Policy ambiguity | Medium | Require product-owner approval before implementation | Open |
| R-007 | Unsuitable stack choice | Costly rework | Medium | Delay final architecture until approved baseline is complete | Open |
| R-008 | Data retention misalignment | Legal and operational exposure | Medium | Explicit retention and purge workflows | Open |
| R-009 | Overly broad permissions | Insider misuse | High | Server-side enforcement and least privilege | Open |
| R-010 | Incomplete testing | Broken releases | High | Build traceability matrix and test catalog before implementation | Open |

## Risk ownership

Risk tracking and escalation are assigned to the product owner, architecture owner, and security reviewer once the team is formed. At this phase, the risk register is specification-only and not implementation-controlled.
