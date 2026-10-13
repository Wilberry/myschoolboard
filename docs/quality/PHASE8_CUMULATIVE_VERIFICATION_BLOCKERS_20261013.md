# MySchoolBoard — cumulative Phase 6–8 verification / CI diagnostic checkpoint

**As of:** 2026-10-13. **Working draft:** [#74](https://github.com/Wilberry/myschoolboard/pull/74), `feature/phase8-private-official-report-composition`. **Exit:** BLOCKED. No merge, production rollout, student or guardian report access, official recipient release, download/export or weakening of verification gates.

## Roadmap decision

Phase 8 of `docs/roadmap/IMPLEMENTATION_ROADMAP.md` covers result approval, publication and visibility, dependent on Phase 7. The next responsible checkpoint after frozen private report composition is **cumulative verification and remediation**, before starting recipient publication. Phase 12 acceptance still requires every security/quality gate. The existence of authored migrations and static tests is not validation.

## Evidence gathered from GitHub Actions

- PR #74 HEAD at initial diagnostic review: `014f55340990f83f41ef8b2538ff3ca5fec0c88d`. Workflow run [38391897336](https://github.com/Wilberry/myschoolboard/actions/runs/38391897336), `verify`, `failure`, created/started 2026-10-13 11:40:55 UTC, completed 11:40:57 UTC (about **two seconds**).
- GitHub job API returned `steps: null` and no logs URL; the connector's job-step API returned `[]`. An attempt to download the job logs via GitHub's logs endpoint resulted in 404 `BlobNotFound` from the redirected storage URL. The commit check run reports **two annotations**, but their content was not accessible via the connected API.
- These details **do not prove which CI command failed**. In particular, it would be misleading to claim `npm ci`, Prisma, PostgreSQL, Vitest, format, TypeScript, build or audit succeeded or failed; no individual step result is available. The short step-less run suggests inspection of Actions execution/runner availability, workflow validity and the annotations from the GitHub UI is required. Root cause **unconfirmed**.
- `.github/workflows/ci.yml` continues to require local PostgreSQL service, `npm ci`, Prisma generation and migration/seed, format, lint, typecheck, all tests, Next build and `npm audit --audit-level=high`. **Do not disable or relax these checks.**

## Local runtime constraints

- In the isolated tool container, `git ls-remote https://github.com/Wilberry/myschoolboard.git HEAD` failed: `Could not resolve host: github.com`. No checked-out full project, `node_modules` or project lockfile installation was available. Node 22 and Git were present, but PostgreSQL server/psql executable not available.
- **Not run here:** cumulative Prisma migrate/validate/generate, any actual PostgreSQL trigger/rollback/race tests, project `node --test`/Vitest, Prettier, ESLint, TypeScript project typecheck, `next build`, dependency audit or full local verify. No shared/production database was accessed. Do not run DB seeds/migrations until disposable loopback PostgreSQL safety preflight passes.

## Actual issue found and corrected in the draft branch

In migration `20261013160000_phase8_private_official_report_compositions`, the private report-grade SQL composer originally compared `pupil->>'reportStatus'<>'INTERNAL_SOURCE_ONLY_NOT_RELEASED'`. For a missing or JSON-null `reportStatus`, PostgreSQL's three-valued logic evaluates `NULL <> 'expected'` as `NULL`; a PL/pgSQL `IF` containing otherwise false OR conditions can therefore fail to reject this malformed source. This is a **specific logical fail-closed defect**, not a claim that a grade was exposed.

- Added **forward-only** migration `20261013170000_phase8_private_composition_source_status_hardening`: same function signature and complete previous body, except using `pupil->>'reportStatus' IS DISTINCT FROM 'INTERNAL_SOURCE_ONLY_NOT_RELEASED'`. This also rejects absent, JSON-null, empty and altered status values. The prior migration has **not been rewritten**, respecting possibly already applied deployment history.
- Extended authenticated PostgreSQL integration test to send otherwise valid per-pupil source data with each of the four malformed statuses. Expect fail-closed SQL rejection in every case.
- Extended the existing registered Phase 8 Node structural guard to require the forward-only migration, old/new status semantics, preservation of other integrity checks, and the new negative coverage.
- **Actually executed:** source-diff verification against freshly fetched current GitHub blobs: **10/10** checks passed, including byte-identical composer bodies after accounting only for `CREATE OR REPLACE` and the null-safe status change. These are source assertions **not** PostgreSQL execution; run all mandatory database tests before marking fixed in production.

## Required follow-up / gates

1. Retrieve the two GitHub check-run annotations through the Actions UI or an appropriately authorized API and diagnose the pre-step failure. Get successful CI step evidence; do not attribute the failure to npm/code absent logs.
2. Confirm a **disposable, loopback-only** PostgreSQL target with explicit safety preflight, then apply all migrations in order and run the authored revocation/concurrency/rollback and both SQL/TS grading parity tests—including absent/JSON-null source statuses.
3. Run `npm ci`, Prisma validate/generate, format check, lint, typecheck, all Node/Vitest tests, Next build, strict `npm audit --audit-level=high` and `npm run verify:local` on an actual checked-out project. Fix findings in separate safe forward commits without deleting or bypassing coverage.
4. Only when cumulative tests, security, CI and independent policy/recipient checks are green, proceed to a separately audited School Super Admin report-release and configured student/guardian visibility milestone.

**Cumulative Phase 8 publication / all recipient access remains DISABLED.**
