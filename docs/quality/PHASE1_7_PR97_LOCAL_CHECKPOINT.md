# Phase 1–7 PR #97 local checkpoint — 2026-10-22

- Phase and milestone: Phase 1–7 merge readiness; synthetic browser fixture
  preparation verified locally. Full browser/release gate remains BLOCKED.
- Source: PR #97 commit `2dc0fa3`, detached in
  `myschoolboard-format`, plus the two local formatting corrections below.
  Node 22.23.2; npm 10.9.8. Changes are uncommitted.
- Requirement IDs: OPS-REQ-001 (test tooling/migration evidence),
  SEC-REQ-001, TEN-REQ-001, USR-REQ-001 and TCH-REQ-001 (narrow authenticated
  access/revocation evidence). LES-REQ-001/ATT-REQ-001 reviewer entry points
  were exercised only with empty queues. No requirement is marked complete.
- Acceptance scope: fail-closed disposable fixture preparation; exact
  teacher assignment visibility after revocation; cross-school concealment;
  private API no-store responses. BR-01..BR-16 remain incomplete.
- Files/modules changed: formatting only in
  `scripts/browser-fixture-safety.mjs` and
  `scripts/prepare-phase1-7-browser-fixtures.ts`; fixture runbook, this
  evidence checkpoint, traceability and roadmap status documents.
- Database migrations: no SQL/schema changes. Inspected the existing local
  Unix-socket Docker target and exact Compose service, PostgreSQL 17 image,
  tmpfs data directory, absence of host binds and configured loopback port
  5434. Started the stopped service; actual port mapping then confirmed
  `127.0.0.1:5434`. Its database was empty, with no migration metadata.
  Initial checksum command failed. `npm run db:deploy` applied 36 migrations
  successfully; subsequent checksum verification passed all 36 exact hashes.
  No reset, service recreation or historical checksum modification occurred.
- Authorization implications: no policy changes. Generator created only
  fresh synthetic identities and academic references under explicit opt-in.
  Independent SQL confirmed ten users, nine memberships (eight A, one B),
  one unaffiliated account, two verified SECTION grants, two ACTIVE teacher
  assignments, and zero StudentRecord/LessonNote rows before browser checks.
- Tests added: none for formatting-only changes; existing nine safety
  tests passed before and after formatting, zero failures/skips.
- Tests executed: `node --test scripts/browser-fixture-safety.test.mjs`
  9/9 PASS; `verify:local:preflight` PASS; migration checksums 36/36 PASS
  after restoring empty test schema; `verify:browser:fixtures` exit 0.
- Build/lint/type-check: `npm run build`, `npm run lint`, and
  `npm run typecheck` PASS. Initial `npm run format:check` failed for
  the two new scripts; Prettier corrected only line wrapping/import layout;
  repeated full format check PASS. `git diff --check` PASS.
- Browser evidence: local production-compiled server bound to 127.0.0.1,
  Chromium 151.0.7922.34, independent browser contexts, actual UI sign-in.
  School A administrator's own school rendered; A→B and B→A private student
  pages concealed access with streamed HTTP 200, not-found UI and noindex.
  Complete document bodies lacked the tested foreign synthetic school/class
  values. Assignment GET APIs returned 404 and `private, no-store`.
  Teacher question-bank page exposed both exact assignments initially;
  school B page/API access was concealed. School A administrator revoked
  only the primary synthetic assignment via the authorized POST route
  (HTTP 200). Fresh teacher navigation removed that option while retaining
  the independent secondary assignment. SQL confirmed one REVOKED and one
  ACTIVE assignment. Empty question-list GET returned 200/private/no-store.
  Head of Section and Principal each opened lesson-review, lesson-release
  and attendance-review pages and their empty GET queues (200/private/no-store).
  Teacher lesson-release and parent student-lesson pages concealed access
  with not-found/noindex; corresponding GET APIs returned 404/private/no-store.
  These are narrow successful probes, not full BR-06/07/08/16 acceptance.
- Security/tenant isolation: no real school data, no existing account
  modification, no weakened authorization/audit assertions. Password and
  full manifest are outside Git in the private directory
  `/tmp/myschoolboard-pr97-verification`; no credentials in this report.
- Known limitations: no positive pupil enrollment, identity attestation,
  lesson approval/release, question/mark data isolation, section-owned queue
  discrimination, section-grant revocation, separate RSC request capture,
  browser history/cache, print or keyboard/zoom acceptance. Empty queues
  establish route access only. Full regression and dependency audits were
  not rerun; prior audit blocker remains unresolved, not freshly assessed.
- Deviations: stopped tmpfs target required schema restoration; all original
  migration hashes were preserved. Temporary browser harness initially
  lacked its default browser executable; existing Chromium was selected.
  One initial denial probe used GET on the POST-only student endpoint and
  returned 405; corrected probe uses the documented assignment GET route.
  Neither harness issue is classified as an application security failure.
- Documentation updated: fixture runbook, this checkpoint,
  CURRENT_STATUS.md, MILESTONE_CHECKLIST.md and requirement traceability.
- Remaining tasks: finish BR-01..BR-16 with business records created through
  authorized workflows, full regression/audit evidence and integrated review
  against main. No commit, push, merge, deployment or Actions run performed.
- Exit-gate result: fixture preparation PASS; Phase 1–7 merge/release BLOCKED.

## Pupil privacy patch checkpoint — 2026-10-22

- Phase/milestone: Phase 1–7 pupil security test strengthening; base `2812484`.
- Requirements: LES-REQ-001, TEN-REQ-001, SEC-REQ-001; no acceptance completion claimed.
- Reviewed local Downloads generator and exact unified diff; all four anchors
  matched and `git apply --check` passed before application.
- Changed three pupil-workflow scripts: exact-detail denials for unlinked,
  parent and foreign actors; foreign-school student-list denial; wrong-section
  reviewer detail/approval denial with SUBMITTED state preserved; approval-only
  detail denial; wrong-section release denial with zero release events.
  Policy helper/test changes are formatting only.
- Tests added: assertions in the guarded staged HTTP workflow; not executed
  against the application yet. Existing seven policy tests passed.
- Executed format, lint, type-check and policy commands: all exit 0.
  `git diff --check` passed. Build/full regression not rerun for this patch.
- Unmodified `2812484` checks: format failed in these three scripts; lint,
  types, seven policy tests and 36 checksums passed. Formatting now corrected.
- No schema/migrations, authorization policy changes or database operations.
- Security: existing denial/no-store assertions retained; no credentials added.
- Documentation updated: this checkpoint. No milestone completion change.
- Limitations/remaining: execute positive staged pupil workflow, revoked-session
  browser/RSC/history/print/accessibility checks, final regression and audits.
- Deviations: none; generated patch applied cleanly, then formatted.
- Exit gate: patch validation PASS; application/browser acceptance BLOCKED.

## Fixture email normalization and authenticated prepare — 2026-10-22

- Phase/milestone: Phase 1–7 pupil HTTP verification; base `76fdd2c` plus
  reviewed email-normalization patch (working tree, not yet committed).
- Requirements: OPS-REQ-001, LES-REQ-001, TEN-REQ-001, SEC-REQ-001.
- Applied downloaded generator only after exact patch review and successful
  `git apply --check`. Shared helper normalizes synthetic actor email suffixes;
  logical role, membership and school checks remain unchanged.
- Changed fixture/pupil scripts, new email helper and four tests, package test
  commands and this checkpoint. No schema, migration or authorization change.
- Tests: four email regressions and seven pupil-policy tests passed (11/11).
  Full formatting, lint, TypeScript and diff checks passed, each exit 0.
- Existing inspected disposable PostgreSQL service retained; no reset or fixture
  regeneration. Checksum verification again passed all 36 historical migrations.
- Authenticated `prepare` retry exited 0 with the existing production-compiled
  loopback server. Strengthened reviewer-denial, unreleased-detail, linked pupil
  access and unlinked/parent/foreign list/detail assertions executed successfully.
- Database writes: authorized synthetic registration, enrollment, attestation,
  teacher submission, Principal approval and separate release only.
- Security: private/no-store and generic denial assertions retained. Local
  credentials and execution logs remain outside Git.
- Build: earlier `76fdd2c` production build retained; patch affects test tooling.
- Limitations/deviations: positive browser/RSC/history/print/accessibility evidence
  and read-only verify phase remain pending. Revocation was not executed.
- Documentation updated: this checkpoint. Remaining: browser positive evidence,
  verify, separate opted-in revoke and final integrated regression/security gates.
- Exit gate: email fix and positive HTTP prepare PASS; full browser/merge BLOCKED.

## Positive Chromium runner — 2026-10-22

- Phase/milestone: Phase 1–7 positive pupil browser verification.
- Requirements: LES-REQ-001, TEN-REQ-001, SEC-REQ-001.
- Downloaded bundle reviewed outside Git; six helper tests passed. Python
  Playwright installed in isolated Downloads virtual environment; existing
  Chromium executable used. No application dependency changes.
- Preflight and 36 migration checksums passed. Actual browser execution exited
  1 with TimeoutError. Diagnostic repeat localized the timeout to the expected
  school-home link `My released lessons and schemes of work`, after sign-in.
- Source evidence: school home requires school-wide `academic:read` through
  requireSchoolAccess before rendering its STUDENT navigation. This entry
  path needs investigation; no role or tenant checks were broadened.
- No positive browser PASS report produced. Exact private API, RSC, print,
  accessibility and history assertions are not accepted by implication.
- Files changed: this checkpoint only. No new application tests, migrations,
  school-record writes or link revocation. Sign-in sessions were created.
- Existing code format/lint/types/build evidence unchanged; not rerun for docs.
- Remaining: resolve/test student navigation, rerun positive browser evidence,
  then separate authorized revocation and final regression/security gates.
- Exit gate: browser verification FAIL; merge/release BLOCKED.

## Phase 1–7 browser and dependency follow-up — 2026-10-30

- Phase/milestone: Phase 1–7 browser security acceptance and dependency
  remediation; base `verify/pr97-integrated-pupil-workflow` at `d8e80e0`.
- Requirements: OPS-REQ-001, TEN-REQ-001, USR-REQ-001, SEC-REQ-001,
  TCH-REQ-001 and LES-REQ-001. No requirement or milestone is complete.
- Evidence source: owner reports the earlier exact-HEAD local run passed
  106/106 local security guards, 36/36 Prisma migration checksums, production
  build/start, synthetic fixture preparation, authenticated pupil workflow
  prepare/verify, positive Chromium sign-in and released lesson navigation,
  list/detail/content, Back/Forward, duplicate tabs, authorized print preview,
  and basic keyboard focus/navigation. No screenshots, raw HAR, credentials
  or tokens were committed, and those reported operations were not repeated
  in this session.
- HTTP distinction: the School B rendered page showed not-found UI but its
  streamed HTML response returned **HTTP 200**. The corresponding
  student-lessons API returned **HTTP 404** and `private, no-store`. The
  document is not classified as an HTTP 404. No code change was made to
  `notFound()` or streaming behavior.
- Files changed in the active worktree: status, milestone, traceability,
  browser-acceptance, pupil-workflow runbook, dependency-assessment and this
  checkpoint documentation. No application source or package manifests in
  the active worktree changed.
- Isolated dependency change: branch `verify/dependency-security-20261030`,
  commit `b20c40dfc0b752b4bbc85e9128051fae0f2503ed`, updates only
  `package.json` and `package-lock.json`. Versions: Next.js /
  eslint-config-next 16.4.3, Zod 4.6.7 and fast-uri 3.1.9. No migrations.
- Authorization implications: none. No permissions or tenant checks changed.
  No database writes, synthetic record modifications, revocation, deployment,
  GitHub Actions, push or merge occurred.
- Tests on the isolated dependency candidate: strict `npm audit
  --audit-level=high` PASS (zero findings); full `npm audit` PASS (zero);
  `npm run verify:local:guards` PASS (106/106, no skips); `npm run
  format:check` PASS; `npm run lint` PASS; `npm run typecheck` PASS after
  Prisma Client generation; production `npm run build` PASS with dummy
  loopback-only configuration and `NEXT_TELEMETRY_DISABLED=1`.
- Blocked validations: full `npm test` exited 1 because all 37 Vitest
  suites require `TEST_DATABASE_DISPOSABLE=1` and database URLs, which were
  absent; no Vitest case ran. The migration checksum command could not
  connect/compare without disposable database configuration. No Playwright
  module or browser-fixture environment was available, so automated browser,
  RSC, history-after-revocation and print-after-revocation checks were not run.
- Guardian scope: no guardian-child relationship model or guardian portal
  routes exist. Positive guardian access remains NOT IMPLEMENTED; only the
  narrow unlinked-parent denial is reported in existing workflow evidence.
- Known limitations: base `d8e80e0` still contains the vulnerable dependencies;
  the fixed candidate is not integrated. User-reported Chromium evidence has
  no committed raw capture or browser version. Streamed HTTP 200 is a
  confirmed observation, not a confirmed privacy defect. Post-revocation
  browser behavior, private RSC payload inspection, positive guardian flow,
  complete BR-01..BR-16, database-backed regression and integrated review
  remain outstanding.
- Documentation updated: `CURRENT_STATUS.md`, `MILESTONE_CHECKLIST.md`,
  `REQUIREMENTS_TRACEABILITY_MATRIX.md`,
  `PHASE1_7_BROWSER_SECURITY_ACCEPTANCE.md`,
  `PHASE1_7_BROWSER_PUPIL_WORKFLOW_RUNBOOK.md`, this checkpoint, and
  `DEPENDENCY_ADVISORY_ASSESSMENT.md`.
- Deviations: none. Requirements and browser acceptance criteria were not
  weakened.
- Remaining tasks: integrate and revalidate the dependency candidate on a
  clean verification checkout; execute full database-backed CI-equivalent
  and migration-integrity checks in the verified disposable environment;
  run reproducible authenticated Chromium automation for private HTML/RSC,
  history, print, and post-revocation behavior; implement guardian features
  only within the documented relationship and privacy requirements; then
  complete integrated review.
- Exit-gate result: **BLOCKED**; no Phase 1–7 acceptance, merge or release.

## Minimatch advisory remediation follow-up — 2026-10-31

- Phase/milestone: Phase 1–7 dependency security verification; active base
  `verify/pr97-integrated-pupil-workflow` at `de14ead0bb35ec625c8ba488fe18f63d135804a7`.
- Requirements: SEC-REQ-001 and OPS-REQ-001, dependency-audit/tooling subset
  only. No acceptance requirement or milestone completed.
- Finding: exact `npm audit --json` reported 16 moderate affected-package
  entries from GHSA-g3hv-75wg-m249. Installed `minimatch@3.1.5` was resolved
  for ESLint/config-array/eslintrc/import/jsx-a11y/React tooling;
  `minimatch@10.2.6` was nested under TypeScript-ESLint. All seven package
  parents are dev-only. Current package ranges do not include patched 11.0.1+.
- Files changed in candidate: only `package.json` and `package-lock.json` in
  dependency commit `5ca6f63643fc646db1bd3084138751ef632ffbbe` on isolated
  branch `verify/minimatch-ghsa-20261031`; the follow-up documentation is
  a separate commit. No application source or migration changed.
- Dependency choice: one npm `overrides.minimatch = 11.0.3` resolves all
  seven consumers. This overrides their existing 3.x/10.x declared ranges,
  so it is a deliberate compatibility decision, not a semver-compatible
  package update. v11 exports the CommonJS/ESM minimatch functions and
  `Minimatch` class used by consumers and replaces the old regex-based
  matcher with its documented nonrecursive implementation.
- Tests added: none; application behavior and authorization were unchanged.
  Nine representative glob patterns were compared between 3.1.5 and 11.0.3
  with identical outcomes.
- Tests executed on clean-install candidate: `npm ci` PASS;
  `npm audit --audit-level=high` PASS, zero findings; full `npm audit` PASS,
  zero findings; `npm ls minimatch --all` PASS, all consumers 11.0.3;
  `npm run verify:local:guards` PASS (106/106, 0 failures/skips);
  `npm run format:check` PASS; `npm run lint` PASS;
  `npm run typecheck` PASS; `npm run build` PASS (31 static pages) with
  dummy loopback DB URL, dummy auth secret, and telemetry disabled.
- Database/migrations: none accessed or modified. Prisma Client generation
  used a dummy URL on loopback port 1. No migration checksum comparison or
  database-backed Vitest suite was run.
- Security and tenant isolation: no authorization, access-control or
  tenant-scoping code changed. The advisory affects developer lint glob
  matching only; untrusted patterns and dependency behavior still warrant
  review when upgrading these packages. The full audit is clean on this
  isolated dependency candidate only.
- Current follow-on blocker: authenticated browser acceptance was not
  executed. This session has no browser fixture identifiers/password,
  disposable DB environment, or Playwright module. The only running Docker
  target is not the verified worktree-specific `postgres-test`; it was not
  touched. Database-writing fixture prepare/revoke steps remain prohibited
  until the guarded disposable target and private synthetic configuration
  are available. Guardian-to-child relationship/portal functionality remains
  NOT IMPLEMENTED.
- Documentation updated: this checkpoint, `CURRENT_STATUS.md`,
  `MILESTONE_CHECKLIST.md`, `REQUIREMENTS_TRACEABILITY_MATRIX.md`, and
  `DEPENDENCY_ADVISORY_ASSESSMENT.md`.
- Deviations: no tests weakened; no `npm audit fix --force`, framework
  upgrade or database operation used. The semver override is explicit and
  verified against the requested local quality gates, but not against the
  unavailable database/browser gates.
- Remaining tasks: integrate the isolated dependency commit onto an approved
  verification branch and rerun full audit/CI; configure the documented
  disposable database and synthetic fixture environment before running
  browser/private RSC/history/print/revocation acceptance; implement guardian
  features only under the documented relationship/privacy specification.
- Exit-gate result: **BLOCKED** for complete Phase 1–7 acceptance; dependency
  audit passes on isolated candidate.
