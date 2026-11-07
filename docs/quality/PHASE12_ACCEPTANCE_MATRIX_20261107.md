# Phase 12 acceptance and integration matrix — 7 November 2026

SEC-REQ-001 / OPS-REQ-001; D-023. Baseline main verified remotely at
`d4459d827e8529ea8daddb73f7e842d8c47c12ab`. This branch includes neither
Phase 10 nor Phase 11. Development acceptance is distinct from release readiness.
Historical authored-only entries in the ledger must not override dated acceptance
records; conversely a passing aggregate suite does not prove every listed criterion.

## Requirement coverage

| Requirement | Current evidence and independent checks | Remaining acceptance / release gate |
| --- | --- | --- |
| PLAT-REQ-001 (critical) | Platform lifecycle and subscription route integration suites | Complete platform audit/metrics and explicitly scoped support acceptance |
| TEN-REQ-001 (critical) | Authenticated foreign-school denials across school, academic and finance suites | Current cumulative browser/export/job isolation matrix after Phase 10/11 integration |
| SCH-REQ-001 (critical) | School structure, period, section, configuration and versioned grading tests | Complete configuration journey and school-policy sign-off |
| USR-REQ-001 (critical) | Real BetterAuth sessions, membership/section/assignment separation and verified identity tests | Production privileged MFA, account recovery and provider/session rollout evidence |
| ADM-REQ-001 (high) | Pupil lifecycle, enrollment and verified relationship integration tests | Entire inquiry-to-admission workflow, import/retention acceptance |
| TCH-REQ-001 (critical) | Assignment, timetable and Form Teacher integration tests | Consolidated authenticated browser matrix for handover/conflicts/revocation |
| ATT-REQ-001 (critical) | Immutable ledger, independent approval and correction tests | Complete attendance parent/recipient and browser acceptance evidence |
| LES-REQ-001 (high) | Revision/review/release routes, exact teacher and recipient guards | Consolidate full positive and revoked recipient/browser acceptance |
| ASM-REQ-001 (critical) | Question bank, CBT admission/answers/scoring, manual review/correction tests | Timed load/failure recovery, concurrency limits and complete current browser matrix |
| RES-REQ-001 (critical) | Accepted Phase 8 checkpoint: 19 browser checks; present cumulative academic suite passes | Persisted BFCache was not observed; retain limitation and rerun integrated lifecycle privacy |
| FEE-REQ-001 (high) | Accepted manual accounting PR #108; 11 browser checks; current finance regression | Live provider settlement/refunds are excluded, not implicitly accepted; production private storage/scanner/key operations |
| COM-REQ-001 (high) | Independent Phase 10 branch only; no implementation imported here | P10-01/02 browser acceptance and P10-03–08; independent branch review/integration |
| LIB-REQ-001 (medium) | Specified catalog/asset distinction | Phase 10 resource, private file/copyright and recipient acceptance |
| SEC-REQ-001 (critical) | Role/tenant/verified relationships; bounded JSON finance remediation; strict audit retained | Complete threat-model evidence, MFA, shared abuse limits, file controls, penetration and privacy review |
| DEL-REQ-001 (critical) | Published independent Phase 11 `6ae1c1b`: 421 Vitest, 7 browser, 59 checksums | Full requirement PARTIAL; protected-history disposition and Phase 10 source/notification adapters |
| AUD-REQ-001 (critical) | Immutable academic/finance evidence; independent Phase 10 outbox/inbox | All required event adapters, operational delivery/replay evidence, privileged audit inspection |
| SUB-REQ-001 (critical) | Lifecycle, entitlement and subscription integration suites | Full expiry/grace/service-policy and production operations acceptance |
| OPS-REQ-001 (critical) | Fresh 58-migration bootstrap, checksum checks, regression/static checks; test-only recovery verifier | Operational RPO/RTO and backup cadence, restore exercises, observability, deployment/rollback and load evidence |

## Independent recovered verification

New isolated PostgreSQL source: task-owned tmpfs, no host database port, no
existing mounts; physical container identity and live random nonce checked before
writes. Existing stopped databases were preserved without restart/reset.
Fresh SQL bootstrap: 58 forward migration files; this is not Prisma Rust CLI
execution. Current recovery run: 207 Node guards and 422 Vitest tests in 49 files
passed. Saved previous static/build/checksum/audit results are in the recovered
checkpoint; fresh reruns are reported separately when completed.

## Phase 10 and 11 integration contracts

- Review independently on their own branches. Do not cherry-pick migrations
  blindly: their inventories are respectively baseline + four and baseline + one.
  A later integration must reconcile inventory guards and bootstrap the union,
  preserving every applied migration checksum and original branch ancestry.
- Revalidate every current school/member/identity/enrollment/source permission
  at read, transition and delivery. Trash restoration cannot restore authority,
  old acknowledgments, suppressed notifications or withdrawn publications.
- Capture source events in the same transaction as the authorized transition;
  pin school/source/version, deduplicate by durable event and recipient, and
  check current authorization before disclosure or replay. Never backfill private
  historical content or infer guardian rights from another module's policy.
- Test retention/hold/expiry, delivery leases/retries, terminal revocation,
  withdrawal, history, sign-out, visibility and print privacy against the combined
  production build with synthetic actors. Required Phase 10/11 tests remain gates.

## Release gates

No production readiness, release or main merge is approved. Mandatory outstanding
evidence includes all prior phase acceptance, actual Phase 10/11 integration,
production TLS/secrets/MFA/private storage and scanner controls, centralized abuse
protection, monitoring/incident response, measured load and recovery objectives,
legal retention/disposition, provider-specific acceptance if activated, and explicit
integration/release review. Local synthetic recovery cannot certify production
backup operations. GitHub Actions and deployment were not used.
