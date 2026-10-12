# Milestone Checklist

## Phase 0 — Documentation baseline complete

- [x] Repository state documented with evidence
- [x] Documentation index and governance files established
- [x] Initial requirements, architecture, security, and roadmap baseline documented
- [x] Current status and blocker tracking updated to reflect the live repo state
- [x] Initial documentation commit created and pushed to origin/main

## Phase 1 — Local foundation implemented and verified

- [x] Approved technology stack selected and validated locally
- [x] Hosting and deployment model explicitly documented as pending
- [x] Engineering standards and local tooling baseline defined
- [x] CI workflow configured in [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [x] Security baseline and secret-handling model defined for development use
- [x] Database strategy and migration approach validated locally and recorded
- [x] Local app skeleton and protected school access path implemented; focused authorization and DB tenant-context tests pass
- [ ] Complete authentication/session integration coverage for HTTP routes and broader tenant operations (remains in Phase 2/security work)
- [ ] Validate the new public liveness route, local CI safety tests, and entire original CI sequence on an explicitly disposable test database; the endpoint/runner are added but the full verification is still outstanding

## Phase 2 — Pending implementation work

- [ ] Run the newly authored D-020 school-admin teacher-assignment list/detail tests on the disposable database, review final-query tenant scoping, and independently verify Next HTTP transport. No development draft alone satisfies this gate.

- [ ] Verify [Phase 2 acceptance matrix](../quality/PHASE2_ACCEPTANCE_MATRIX.md) on the exact cumulative commit using a disposable PostgreSQL test database and real HTTP/browser checks as applicable; current follow-up tests are authored but unexecuted.
- [ ] Validate school-owned active class/subject scope resolution and assess stored unverified/cross-school grants before any merge.
- [ ] Obtain production identity/session policy decisions under P-007 ([issue #17](https://github.com/Wilberry/myschoolboard/issues/17)); leave optional section/child resource reads unavailable until tenant ownership is proven.

- [ ] Auth and role model
- [ ] Tenant isolation controls
- [ ] Authorization audit tests

## Phase 3 — Pending implementation work

- [ ] School onboarding lifecycle
- [ ] Subscription management
- [ ] Platform admin operations

## Future phases

All subsequent phases remain pending until their entry criteria and required product decisions are satisfied. The completed local Phase 1 foundation does not imply that Phase 2 or later requirements are implemented or complete.
