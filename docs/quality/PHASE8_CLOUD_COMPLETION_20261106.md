# Phase 8 cloud completion evidence — 6 November 2026

**Outcome: Phase 8 implemented and locally accepted for development integration.**
**Post-acceptance integration:** PR #106 was merged into development `main`
on 6 November 2026 at `2e12f6098143816e529597ed97abcd268e00434c`.
No production deployment occurred. The remainder records the original cloud
acceptance run, including its then-pending remote integration.

## Source and history

- Requested checkpoint: `e30a6b0d83c00df80d3eaa0296843e635440374d`.
- Reconciliation merge: `e7cd3d3`. It makes original incoming parent
  `baa1fdf1fee33d003f8e24f1e4c7c68eac1ae46b` an ancestor, while preserving
  checkpoint resolutions and main's Phase 1–7 work. Formatting-normalized review
  identified duplicated source and retained the checkpoint's null-safe source
  status, PostgreSQL reviewer aliases, dependency baseline and forward band-width
  repair. The merge tree equals the checkpoint tree. The original local
  unfinished merge was untouched; no reset, force-push or history rewrite.
- Implementation: `3f33d57`; native focus/privacy: `024c954`; owner browser flow:
  `460d14a`; final delayed-sign-out fix and **verified source**: `ce14d17faf37c0c7a58ceac279b29b28d9729a1f`.
- Subsequent acceptance documentation is documentation only.

## Completed features and authorization

RES-REQ-001 now covers the teacher source-preparation → independent verified-section
HM/Principal review → immutable owner academic approval → frozen source/graded
composition → explicit School Super Admin recipient publication workflow.
The new `ReportPublication`, `ReportPublicationWithdrawal` and
`ReportGuardianAcknowledgment` ledgers are immutable, tenant-keyed and audited;
SQL reruns current publication readiness and latest school-adopted grading checks.
Corrections preserve history and require a new reviewed source/approval/composition
and publication; recipient reads suppress superseded versions.

Each publication explicitly versions one school visibility choice: ASSESSMENT_ONLY,
PARENT_ONLY, PARENT_FIRST or PARENT_AND_STUDENT (D-061/ADR-047). No inferred pupil
identity, automatic grade policy, generic child grant or public report link.
Current same-school membership, actual enrolled pupil, active class/section/period,
unrevoked student or verified guardian binding and non-withdrawn publication are
required per recipient row. Guardian acknowledgment is explicit, idempotent,
bound to an exact pupil/publication/link and cannot unlock a later version.
Revoked guardians' acknowledgments stop unlocking student access.

Owner publication and withdrawal screens and recipient report-card display,
acknowledgment and guarded printing are available. HTML/Flight/segment responses
are private/no-store. Client requests abort obsolete scopes; rows conceal on
blur/hidden/page lifecycle/sign-out and reauthorize before reappearing. Polling
requires foreground focus and stops permanently for a mounted view after a
sign-out announcement, even while a delayed server sign-out still has a valid
session. Recipient output contains frozen names and display grades only, not
raw marks, answer keys, internal source/composition JSON or other pupils' data.

## Actual validation at ce14d17

| Check                            | Result                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Locked dependency install        | Passed; final package-lock is byte-identical to the installed aa74a0f lock            |
| Prisma schema/client             | Passed using matching official 7.10.1 WASM parser and in-process JavaScript generator |
| Fresh PostgreSQL bootstrap       | All 49 SQL migrations applied on a newly created disposable DB                        |
| Exact applied migration hashes   | 49/49 passed, read-only repository checksum verifier                                  |
| Synthetic seed and replay        | Both passed; two demo schools, disposable DB only                                     |
| Node security/source guards      | 187 passed; 0 failed, cancelled or skipped                                            |
| Vitest                           | 385 passed in 45 files; 0 failed/skipped                                              |
| Formatting / ESLint / TypeScript | All passed; lint has zero warnings                                                    |
| Production Next build            | Passed from ce14d17                                                                   |
| Strict/full dependency audit     | 0 vulnerabilities                                                                     |
| Production-only dependency audit | 0 vulnerabilities                                                                     |
| Chromium acceptance              | 19/19 checks passed on Chromium 156.0.8078.79                                         |

No GitHub Actions was invoked or used as acceptance evidence. Head commit messages
use [skip ci] to avoid automatic hosted jobs during branch/PR integration.

### Browser matrix

| Scenario                            | Outcome and actual evidence                                                                                                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P8-BR-01                            | PASS: exact teacher API/UI, two enrolled pupils, exact roster, private-preparation status, no answer key                                                                                                                     |
| P8-BR-02                            | PASS: real anonymous/teacher/admin/HM/Principal/owner/student/guardian/foreign-role denials as appropriate; no pupil payload in neutral HTML                                                                                 |
| P8-BR-03                            | PASS: foreign school and mismatched class/subject/session/term fail closed                                                                                                                                                   |
| P8-BR-04                            | PASS: HTML 200 text/html, Flight 200 text/x-component and actual Next segment-prefetch 200 text/x-component all have private, no-cache, no-store, max-age=0, must-revalidate; denied Flight/prefetch has no pupil data       |
| P8-BR-05                            | PASS: an actual authorized request delayed across scope change cannot restore obsolete rows                                                                                                                                  |
| P8-BR-06                            | PASS: native Chromium emits blur, hidden visibility, visible visibility and focus; rows disappear and reauthorize on return                                                                                                  |
| P8-BR-07                            | PASS: actual terminal teacher assignment revoke; API denial 90 ms, foreground DOM concealment 10,009 ms in this run                                                                                                          |
| P8-BR-08                            | PASS: cross-tab sign-out and same-tab sign-out; the latter deliberately delayed server logout 11 s while API still authorized, and no poll restored pupil rows                                                               |
| P8-BR-09                            | PASS: native PDF output for preparation and revoked views contains no pupil markers                                                                                                                                          |
| P8-BR-10                            | PASS: native Back/Forward and duplicate tabs after revocation contain no stale pupil data                                                                                                                                    |
| P8-BR-11                            | Conditional genuine BFCache restoration NOT EXERCISED: pagehide/pageshow persisted=false. Native no-stale-data safety checks pass without weakening no-store                                                                 |
| P8-BR-12                            | PASS in controlled in-process real PostgreSQL integration: a newly enrolled synthetic pupil committed between actual independent readers produces generic 409 with no partial roster; test ends its own enrollment afterward |
| P8-BR-13                            | PASS: keyboard focus, 375px layout, live status/labels and axe WCAG 2 A/AA + 2.1 AA checks with no violations                                                                                                                |
| Owner publication                   | PASS: real screen publishes a new independently approved version with explicit PARENT_FIRST; prior acknowledgment cannot unlock it                                                                                           |
| New-version guardian acknowledgment | PASS: real guardian screen acknowledges the exact new version; only then linked student sees it                                                                                                                              |
| Recipient scope/lifecycle           | PASS: one linked pupil only, wrong roles/foreign school denied; native hidden recipient tab remains concealed across polling and reauthorizes on return                                                                      |
| Official report PDF                 | PASS: actual Chromium PDF contains published pupil name, official-report marker and score after the explicit fresh-access print command                                                                                      |
| Guardian revocation                 | PASS: actual terminal relationship revoke removes parent and parent-first student rows; foreground concealment 10,019 ms; revoked PDF contains no pupil marker                                                               |
| Owner withdrawal                    | PASS: real owner screen writes terminal withdrawal, preserves history and leaves recipients without the withdrawn version                                                                                                    |

Preparation/recipient print content used Chromium's native PDF renderer. The
headless `window.print` command was intercepted only to capture the authorized
print state after the real fresh-access button; no application authorization or
assertion was bypassed. A physical printer/OS print dialog was not tested.
Revocation measurements are observations, not a new approved latency SLA.
Native focus uses a separate normal Chromium profile on Xvfb, connected with
Playwright noDefaults=true; default Playwright focus emulation cannot validate
real tab switching. No genuine BFCache restoration was forced.

## Database, migration and test isolation

Only the confirmed Compose postgres-test service at loopback port 5434 was used
for this task's DB writes. PostgreSQL 17 has `/var/lib/postgresql/data` in tmpfs;
no shared/development/production DB or original laptop database was touched.
New migration: `20261106000000_phase8_recipient_publication`. No previously
applied historical migration was edited by this task. The final 49 hashes match.

Prisma CLI `generate`/`migrate deploy` Rust download remains blocked by the running
instance's domain policy. Instead, official matching npm packages
@prisma/internals and @prisma/client-generator-js 7.10.1 parsed the local schema
with WASM and generated the adapter-based client with skipDownload=true; no Rust
artifact was downloaded or used. Package/TLS/checksum verification stayed enabled.
The explicit pg bootstrap executed the real migration SQL on a fresh disposable
DB and recorded the actual checksum, successful application time and step count.
This is not a claim that prisma migrate deploy ran. Both actual SQL execution
and the independent repository checksum verifier passed.

Fixtures use random school/run IDs, real Better Auth sessions, enrolled synthetic
pupils and administrator-attested relationships. The prior CBT pupil's terminally
revoked identity remains revoked; a fresh pupil went through a new real marking,
academic review, owner approval, packet/composition/publication cycle. A second
newly approved version was staged for the browser's owner-publication check.
Private fixture files are opt-in /tmp/phase8-<run>.json, mode 0600, never committed.
Rollback-isolated DB cases check four visibility modes, school/membership/enrollment/
identity revocation, withdrawal and immutable history without reactivating a
terminal real fixture revocation.

## Reproduction in this cloud instance

Use the existing checkout, not a new worktree. Local helper tools are retained
under /workspace/phase8-tools; they contain no credentials. Generate with
`node /workspace/phase8-tools/generate.mjs` if the normal CLI domain is still
blocked. Normal installs should use npm ci and npm run db:generate once policy
is active. Never disable engine checksums or TLS verification.

Set NODE_ENV=test, TEST_DATABASE_DISPOSABLE=1 and the repository's exact loopback
TEST_DATABASE_URL/DATABASE_URL for the inspected disposable service. Load ignored
.env without printing values. Run npm test, npm run format:check, npm run lint,
npm run typecheck, npm run build, both npm audits and the checksum verifier
(`node --import dotenv/config scripts/verify-migration-checksums.mjs`, with
ALLOW_DEMO_SEED=1 required by its guard). No reset of a shared database is allowed.

For a new browser run, use a fresh unique PHASE8_BROWSER_FIXTURE_FILE matching
/tmp/phase8-<run>.json while running the full suite or questions.integration.test.ts.
Start the exact committed production build on the local Better Auth origin.
Run DISPLAY=:99 plus the same disposable DB flags and fixture path with
`node scripts/verify-phase8-browser.mjs`. The script requires installed Chromium,
Playwright, axe-core, pdftotext and a local display; paths are configurable through
PHASE8_CHROMIUM, PHASE8_PLAYWRIGHT_MODULE and PHASE8_AXE_PATH. Xvfb was installed
locally using signed Debian metadata and verified packages. It must restart after
environment restoration. Browser revocations are terminal; create a new fixture
for another run. Do not reactivate the old one.

## Required checkpoint and integration status

- Phase/milestone: Phase 8 Results and Report Cards; RES-REQ-001 locally accepted.
- Changed modules: results publication service, owner/recipient API and workspaces,
  schema/additive migration, regression/browser fixtures, inventory guards and docs.
- Authorization: school-owner release/withdrawal only; currently verified recipients
  only; no extension of general academic/child permissions. Tenant boundaries,
  immutable history and revoked-link denial preserved.
- Tests added: full approved recipient workflow, all visibility modes, current
  access revocation, real source-reader DB race, browser owner/guardian/print/
  lifecycle/revocation and delayed-sign-out scenarios. All executed results above.
- Documentation: results/portal/authorization, requirement/traceability, D-061/062,
  ADR-047, status/milestones, browser acceptance and this record.
- Deviations/limits: SQL bootstrap and WASM/JS client generation replace unavailable
  Rust CLI operations in this instance; BFCache persisted restoration and physical
  printer dialog were not exercised, with privacy-preserving conditional outcomes
  recorded. No production deployment or broad portal completion is claimed.
- Post-acceptance integration: PR #106 used the established GitHub pull-request
  workflow and merged without a force-push at
  `2e12f6098143816e529597ed97abcd268e00434c` on 6 November 2026.
  The previous `api.github.com` network restriction applied only to the cloud
  runtime; integration was completed using the authorized GitHub connection.
  The exact pre-merge `main` SHA was
  `aa74a0f0265fe113ad8cb4fe9440cd7f51a1b27d`.
- Exit gate: **local implementation/security acceptance PASS; remote development
  integration COMPLETE**. No production deployment, genuine BFCache persisted
  restoration or physical printer/OS dialog acceptance is claimed.
