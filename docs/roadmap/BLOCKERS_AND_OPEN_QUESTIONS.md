# Blockers and Open Questions

## Phase 8 recipient visibility configuration and private preview verification (2026-10-13)

- **Private grade preview source authored:** current active exact-school School Super Admin read-only preview of frozen unreleased grades and same-school pupil identity with no-store response. Full PostgreSQL, Prisma, Vitest, browser, lint/types/build and security-audit acceptance have NOT run; historical Phase 6–8 unmerged drafts remain an upstream release blocker. No recipient route or report release.
- **Visibility policy specificity for next slice:** `docs/requirements/CONFIGURATION_CATALOG.md` mentions *four supported* report-card visibility values but does not enumerate or define their exact semantics. `P-004` parent-first acknowledgment remains deferred. A reversible deny-by-default future adoption model may be designed, but none of these unspecified choices may be inferred to grant a student/guardian result. Implement/review explicit versions, release event, current verified student/guardian links and recipient read filters before enabling any disclosure. This ambiguity does not prevent independent tests, safe scaffolding or other roadmap work.
- **No GitHub Actions requested:** do not trigger/retry workflows to validate this checkpoint. Local CI-equivalent verification remains next, on an explicitly disposable loopback PostgreSQL target with migration checksum checks.


## Approved and deferred decisions

| Decision                                          | Status                                                                                                                                | Scope / remaining work                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TypeScript, Next.js, PostgreSQL, modular monolith | Approved for local foundation; implemented                                                                                            | Does not select hosting or establish production readiness                  |
| Better Auth                                       | Implemented locally                                                                                                                   | External identity-provider strategy remains open                           |
| Server-side tenant authorization                  | Implemented for current paths and locally tested                                                                                      | RLS is not enabled; all future operations need equivalent checks and tests |
| Hosting provider and domain                       | Deferred until local development and testing are complete                                                                             | No provider/domain selected and no deployment exists                       |
| Support access                                    | Default approved: no unrestricted routine access; exceptional access must be authorized, scoped, time-limited, justified, and audited | Exact approval, enforcement, expiry, and audit mechanism is unimplemented  |
| Payment provider and currencies                   | Deferred                                                                                                                              | Resolve in Phase 9                                                         |
| Parent-first report visibility                    | Deferred                                                                                                                              | Resolve in Phase 8                                                         |
| QR disclosure                                     | Deferred                                                                                                                              | Resolve in the QR verification implementation phase                        |

## Open product and legal questions

- Final school branding and naming model
- Communication channel approvals (email, SMS, WhatsApp)
- Formal privacy and compliance review for Nigeria and future international expansion
- Final QR verification disclosure policy
- Final backup frequency, RPO, and RTO targets
- Retention policy exceptions or legal-hold requirements

## Decision status

These remain unresolved for their owning phases. They do not invalidate the local foundation, but they must not be treated as implemented or decided before the relevant work begins.
