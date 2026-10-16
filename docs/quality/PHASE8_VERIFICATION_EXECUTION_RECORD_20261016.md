# Phase 8 current-head verification execution record — 2026-10-16

**Project:** MySchoolBoard  
**Required checkout:** `/home/wilberry/Desktop/project/myschoolboard-phase8`  
**Branch:** `verify/phase8-local`  
**Exact remote code checkpoint:** `a325b5816c3e983e5760a3f3ae93782266f4b2cc`  
**Disposition:** **BLOCKED — NOT ACCEPTED, NOT RELEASED, NOT DEPLOYED.**

## Proven historical evidence (not rerun against this HEAD)

The last fully verified functional checkpoint was `06bfb3a`: 49 PostgreSQL migration checksums, Prisma generation/migration deployment, synthetic database seed, 111/111 Node guards, 319/319 Vitest cases across 41 files, formatting, lint, TypeScript, and Next.js production build passed. Earlier anonymous HTTP privacy smoke was 6/6. The high-severity strict npm audit failed with eight findings. These historical results **cannot** be carried forward as proof of this newer commit.

## Work executed in this connector-based 2026-10-16 continuation

| Activity | Execution result | What it does NOT prove |
| --- | --- | --- |
| Remote GitHub branch/read-only repo inspection | Confirmed working Phase 8 branch and separate dependency experiment; commits confined to `verify/phase8-local` | No actual local worktree Git status or installed project tests |
| Guardian-first multi-subject receipt correction | Exact candidate mock callbacks **2/2 passed** in isolated V8; independent small Node 22 design sanity **6/6 passed** | Not the installed project's `node --test`, browser, PostgreSQL or grade disclosure |
| Full-verification remote Docker guard | Isolated source-predicate checks **12/12 passed**; new registered negative tests authored | No actual `docker context inspect`, Compose, `pg_isready` or migrations |
| Environment inspection | Node `v22.16.0`, npm `10.9.2`, Git `2.47.3` available; neither intended local project checkout nor Docker CLI/socket or PostgreSQL CLI/server mounted; GitHub DNS and npm registry access unavailable in the shell | No successful `npm ci`, ESLint, TypeScript, Next build or npm audit |
| Authenticated browser acceptance | **NOT RUN** (no project install, synthetic approved fixtures, loopback Next test app or Chromium session) | No evidence of guardian-first acknowledgment, role privacy, revocation, real print/PDF, bfcache, focus, accessibility or absence of stale grade disclosure |

No synthetic pupil/guardian academic fixture was provisioned or modified in this execution environment. No report feature flag was enabled. No migrations, seeds, database writes, GitHub Actions, merge, deployment, Phase 1 or Phase 9 changes were performed.

## Mandatory next local verification (run ONLY in the correct clean Phase 8 worktree)

1. Inspect the actual Phase 8 checkout and preserve any existing uncommitted files. Fetch and fast-forward `verify/phase8-local` only if doing so will not overwrite any work. The worktree-pinned safety runner refuses dirty trees, mismatched HEAD, other branch/path or non-disposable test targets.
2. Before any database action, verify local Docker context and `DOCKER_HOST`, the `postgres-test` Compose tmpfs and sole `127.0.0.1:5434` mapping, local process port and the absence of SSH/tunnel/shared-database forwards. Start the disposable service only after these have been independently verified. Never repoint to production, shared data, Phase 1 or Phase 9 services.
3. Configure the **synthetic only** variables from `docs/quality/LOCAL_CI_RUNBOOK.md`; set BOTH `PHASE8_REPORT_RELEASE_ENABLED=false` and `PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED=false`.
4. Run the three focused installed Node harness suites **before** the full checkpoint:

   ```sh
   node --test scripts/phase8-browser-fixture-readiness.test.mjs scripts/phase8-recipient-browser-acceptance.test.mjs scripts/verify-phase8-checkpoint.test.mjs
   ```

5. With the above precautions, run the worktree-pinned safety/preflight entry point and full cumulative checkpoint:

   ```sh
   node /home/wilberry/Desktop/project/myschoolboard-phase8/scripts/verify-phase8-checkpoint.mjs --preflight
   node /home/wilberry/Desktop/project/myschoolboard-phase8/scripts/verify-phase8-checkpoint.mjs --run
   ```

   The full runner performs `npm ci`, Prisma generation, 49+ migration checksum verification, migration deploy, synthetic seed, formatting, lint, TypeScript, Node/Vitest, Next production build and unmodified `npm audit --audit-level=high`; stop on each actual failing gate. Do **not** weaken the audit or reconcile changed checksums silently.

6. With a **separate** complete synthetic academic approval and release fixture created through normal teacher/reviewer/owner workflows, use the *read-only* readiness check with both report disclosure flags still OFF, then run actual authenticated Playwright Chromium acceptance according to `PHASE8_RECIPIENT_BROWSER_ACCEPTANCE_RUNBOOK_20261014.md`. The browser test alone may use temporary gates ON in its disposable localhost test-app process, never as default or outside the synthetic DB. Confirm signed-in session/child identity, exact-subject guardian-first receipt and multi-subject deltas, tenant/role isolation, terminal revocations, history/focus/account switches, native Print and Save as PDF, keyboard/screen reader, and stale-grade denial. Restore both flags OFF when done. Never reuse this database concurrently with Prisma dependency experimentation or Phase 9 mutating tests.
7. Record exact local HEAD, migration count, versioned browser evidence, actual pass/fail counts and strict audit output in a new dated QA result. Until **all** mandatory security, runtime, recipient privacy and operational gates pass, Phase 8 remains **NOT ACCEPTED**.

## Dependency-security isolation

`experiment/phase8-prisma-deepmerge8` remains separate. Its `deepmerge-ts` 8.x candidate lockfile has **not** undergone real npm resolution and Prisma compatibility verification, while the `braces` advisory remains open. Do not merge the override or suppress `npm audit --audit-level=high`. Perform the experimental database tests only after Phase 8 browser/database verification has finished and its disposable instance is no longer in use.

**Requirement status:** RES-REQ-001 / TEN-REQ-001 / SEC-REQ-001 partially implemented, acceptance outstanding; standing mandate D-023 unchanged.
