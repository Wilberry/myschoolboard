# Blockers and Open Questions

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
