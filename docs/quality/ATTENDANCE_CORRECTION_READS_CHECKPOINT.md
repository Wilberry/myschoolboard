# Phase 6 Correction Read/Workspace Checkpoint — 2026-10-12

## Milestone, parentage and requirement status

- Source cumulative branch: `feature/attendance-immutable-corrections` at `00abafd4c4f26e099630c755db2b1a4eabea23e2`, draft PR #42.
- Candidate branch: `feature/attendance-correction-review-workspaces`, unmerged draft.
- Phase 6 / ATT-REQ-001, T-ATT-001, TEN-REQ-001, SEC-REQ-001. Work is **authored, unverified, not complete**.
- No change to documented owner-approved local CI-equivalent policy, dependencies or security audit gate.

## Files and modules authored

- Private authorization-aware readers: `src/modules/attendance/corrections-read.ts` for current exact-primary-responsibility Form Teacher approved-register index and individual entry detail, stage-verified HM/Principal correction queue and individual detail.
- Private GET response handlers: `corrections-read-http.ts` and four GET routes in `app/api/schools/[schoolId]/attendance/corrections`, `attendance/[registerId]/corrections/entries`, and `attendance-correction-reviews`.
- Separate Form Teacher and reviewer server-gated pages under `app/schools/[schoolId]/attendance-corrections` and `attendance-correction-reviews`; client editors and school navigation links.
- Extended `src/modules/attendance/corrections.integration.test.ts` synthetic route assertions for private reads, current Form Teacher restriction, minimal reviewed-student detail, pending-queue exclusion of pupil names/marks/reasons, exact verified-stage reviewer, and effective projection after returned and approved revisions.
- D-029, ADR-015, attendance requirements, current status, milestone checklist and this checkpoint.

## Authorization and immutable audit

- Single-item authorized Form Teacher detail returns both immutable original mark and latest approved corrected effective mark (not pending/returned proposal). Current active school, Form Teacher membership, PRIMARY exact responsibility and active session/class/section are joined in the final SQL sensitive-data query. Historical enrollment is a preexisting immutable exact relation, not a guessed pupil link.
- Correction queue omits pupil marks/names/ID and reason; only current exact section/HM/Principal reviewer can request per-item sensitive details. Authenticated access checked at pages, handlers and final SQL independently; no general teacher, guardian/student, platform support, public or export read.
- Client forms never authorize a correction. Submission and decision services from PR #42 continue to validate exact actor/resource and revision in serializable transactions and PostgreSQL triggers; original marks/events remain unchanged.
- No migrations, existing pupil records or history were modified during this candidate.

## Authored versus executed evidence

**Authored only:** enhanced synthetic real-session disposable-DB coverage for authorized role/current relationship, denied cross-tenant access, empty queues, stage-specific grants, queue privacy, original/effective mark after pending, returned and latest approved corrections. Previous correction request/decision integration tests also authored.

**Executed:** GitHub connector branch creation, code/document file writes and PR operations (repository writes, **not tests**). Isolated container had no repository checkout and GitHub hostname resolution failed on `git ls-remote`. No local disposable PostgreSQL verified, so no migration, seed or database test was executed. No format, lint, TypeScript, Next build, Next real-browser, API over HTTP or strict `npm audit --audit-level=high` was executed on this candidate. GitHub Actions remains blocked by billing.

## Limitations and remaining work

- No complete school attendance timezone/day/correction deadline/closed-period policy; ACTIVE school/session default remains. Pending queue is capped at 100 and approved register index at 100; no pagination/export.
- Run disposable PostgreSQL migration/trigger/composite FK/rollback/concurrency and all earlier student, form teacher, section, lesson and attendance test suites.
- Validate role/grant revocation races, large-roster bounds, HTTP caches, browser keyboard/accessibility, and audit retention under school deletion.
- Run entire agreed unchanged local CI-equivalent; capture tested commit SHA, successful/failed commands, counts, build and dependency audit findings. Do not treat a draft PR as verified or security risk accepted.
- No live data, merging, production deployment or relaxation of strict security controls.

**Exit gate: BLOCKED pending executed migration/tests, browser evidence, complete local CI-equivalent, and security remediation.**
