# Phase 8 confidential school-owner grade preview — implementation checkpoint

**Date:** 2026-10-13  
**Branch:** `feature/phase8-owner-private-grade-preview` stacked on unmerged draft PR #74 head `baa1fdf1fee33d003f8e24f1e4c7c68eac1ae46b`  
**Requirements:** RES-REQ-001 (T-RES-001), tenant isolation TEN-REQ-001, authorization/privacy SEC-REQ-001 (all partial).  
**Status:** SOURCE AUTHORED; RUN-TIME ACCEPTANCE BLOCKED. No public recipient release.

## Delivered source changes

- Read-only `readPrivateGradePreview` for a **single school-keyed immutable composition**. Requires authenticated exact active same-school `SCHOOL_SUPER_ADMIN` in the final SQL SELECT. Selects only owned pupil names/admission identifiers and frozen category/raw/display grade results (not raw `composedStudentCards` JSONB, source cards, CBT answers, mark-level points or private keys).
- Route `GET /api/schools/[schoolId]/private-official-report-compositions/[compositionId]/preview`. Rejects query parameters, uses private/no-store/noindex/nosnippet and concealment of unauthorized/foreign IDs. No write or download operation.
- An explicit inspect/hide panel in the existing gated school-owner composition history. Displays clearly **NOT PUBLISHED**, policy revisions, one exact subject composition and pupils' scores. No automatic load of sensitive grades without opening the panel.
- Fail-closed row type/bounds, expected completeness and uniqueness checks. Historical immutable composition calculations remain unchanged; there is **no new migration**.
- Existing authenticated PostgreSQL integration suite extended for role denial, cross-school denial, absent evidence, owner revocation, known-good frozen projection, minimal returned fields and no raw source/keys.
- New registered `scripts/phase8-private-grade-preview-guard.test.mjs` in both unchanged existing test and guard script chains; prior guards, migration checks and strict security audit retained.

## Actually executed in this checkpoint

- GitHub connector fetched new files and retained the branch commit records.
- **3/3 new structural Node guard bodies replayed successfully** against freshly fetched branch files using isolated V8 with a mocked file reader. This is a source check; it was **not** the installed Node test runner and is not authenticated SQL execution.
- Locally verified `git ls-remote https://github.com/Wilberry/myschoolboard.git HEAD` cannot resolve github.com. Node and a global TypeScript CLI exist, but no checkout/dependencies or disposable PostgreSQL instance was available. No live school/student records used.
- **No GitHub Actions invoked, re-run, enabled or scheduled.** No PR opened for this branch, avoiding the repository's automatic `pull_request` verification workflow.

## Not executed / blockers

- `npm ci`, Prisma validate/generate/migrate, all Phase 6–8 PostgreSQL migrations with checksum preflight, SQL trigger/authorization/concurrency/rollback and student/guardian negative tests, Node/Vitest, format/lint/typecheck/Next build, browser/accessibility checks, strict `npm audit --audit-level=high`, or successful CI.
- The cumulative Phase 6–8 draft prerequisites are **unmerged and unverified**. Existing step-less CI failures on #74 remain unconfirmed; do not infer a code or dependency root cause from absent logs.
- Result release, official printable report-card export, guardian/student access and deployment are **disabled**. A school-owner preview is not consent to disclose grades to recipients.

## Next roadmap direction — verification, then controlled release and visibility

1. On an explicitly **disposable loopback PostgreSQL** only, inspect `_prisma_migrations` before applying any draft Phase 7–8 SQL; refuse silent checksum rewriting/reset of any existing environment. Apply migrations in order and execute existing exact-section approval/revocation, grading parity, source completeness and the new confidential preview tests.
2. Run the repository's unchanged local CI-equivalent script and strict dependency audit; repair actual failures, do not weaken guard suites or gate levels. Verify school-owner-only browser access, hide behavior, denied recipient/network paths and zero caching of pupil data.
3. Design a **separate immutable, school-adopted report visibility policy** and an independently audited owner recipient-release event pinned to the exact frozen composition. Release transaction must repeat current approver/school/evidence/tenant authorization and recipient readers must require verified same-school child/student account linkage with current enrollment plus school visibility policy. Never interpret the current private status as released.
4. The configuration catalog mentions *four supported visibility values* but does **not name or define all four**; P-004 parent-first acknowledgment semantics remain unresolved. Do not invent school policy choices, silently use `Assessment-only access` to grant results, or expose a recipient route. This precise release-policy ambiguity blocks only recipient disclosure; routine independent development/verification continues under D-023.

**Exit gate: BLOCKED.** No merge, deployment, release, print/export or data sharing. Next release acceptance must include actual PostgreSQL, Node/Vitest, lint/types/build, audit, browser and working CI evidence.

## Final source-check hardening

- Fresh GitHub-source isolated V8 replay: **3/3** preview structural guard cases passed; `package.json` contains the new guard in both full `test` and `verify:local:guards` commands.
- **3/3 deliberate negative mutations** were rejected by the guard: removing exact owner role, removing active membership revocation check, and removing full class-count validation. This demonstrates guard sensitivity to these source edits; it does **not** establish the correctness of the PostgreSQL query at runtime.
- The private GET route is explicitly `force-dynamic` with `revalidate = 0` as well as private/no-store/noindex response headers. No PR or Actions run was started.

## Owner workflow refinement and parent-guard regression

- Owner history now identifies each frozen composition using its same-school class and subject **metadata** (not student/mark data), reducing the risk of inspecting an ambiguously labeled class. This metadata is read only after the same final-query active school-owner authorization.
- The existing parent `phase8-private-official-composition-guard.test.mjs` was also replayed against current GitHub sources in isolated V8: **4/4 structural cases passed**. This is not the installed Node runner nor PostgreSQL verification.
