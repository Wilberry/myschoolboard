# Phase 7 CBT Answer/Submission Ledger — Development Checkpoint

**Date:** 2026-10-12
**Phase/requirement:** Phase 7 / ASM-REQ-001 / T-ASM-001; TEN-REQ-001 and SEC-REQ-001 prerequisites.
**Baseline:** `feature/phase7-cbt-attempt-ledger` at `9e98b12d6b187883fd14513f8538ef89d84ae75b` (draft PR #54).
**Branch:** `feature/phase7-cbt-answer-submission-ledger`, cumulative nonproduction draft.
**Exit gate:** BLOCKED; Phase 6 verified student enrollment/account binding, prior Phase 7 migrations, full local CI-equivalent and strict security audit unexecuted.

## Files and implementation authored

- `prisma/schema.prisma`: `AssessmentAttemptAnswerEvent` school/attempt/question/student member-bound immutable answer selections; unique (school,attempt,requestKey) for idempotence and (school,attempt,question,revision) for corrected chronological snapshots. `AssessmentAttemptSubmission` is a separate immutable one-per-(school,attempt) terminal event, with actor user/member and server submit timestamp. No student answer key/grade columns.
- Additive `prisma/migrations/20261012310000_phase7_cbt_answer_submission/migration.sql`: school+attempt composite FKs, bounded selection and request key, shared `assert_cbt_attempt_writable` SQL authorization/time validator invoked by both INSERT triggers. SQL serializes on active School FOR UPDATE then AssessmentAttempt FOR UPDATE, rechecks actual stored student/membership and active unrevoked attested link/enrollment, exact current sealed/APPROVED and PUBLISHED not WITHDRAWN draft, active author/class/section/subject/session/term, student user/member consistency, and trusted UTC clock strictly before attempt deadline. Answer validator requires exact selected draft question and 0<=selectedIndex<optionCount, increments per-question revision using SQL under lock, overrides client createdAt. Final submission sets server submittedAt and blocks all future writes. Normal direct UPDATE/DELETE/TRUNCATE rejected using existing immutable history guards.
- `src/modules/assessments/attempt-answer-service.ts`: authenticated **internal-only** `saveInternalCbtAnswer` and `submitInternalCbtAttempt` with strict UUID retry key, exact school/attempt actor membership, current student/attested link/active enrollment/publication recheck, SERIALIZABLE bounded retry for conflicts, exact-payload existing idempotency response or changed-retry conflict. Returns minimal event ID/revision/timestamp or final submitted timestamp: NEVER answer key, correctness, score, student PII or exam question content. No HTTP route or student UI was introduced.
- `src/modules/assessments/questions.integration.test.ts`: synthetic real-session/disposable-PostgreSQL scenarios appended to existing admitted student fixture: teacher denial, exact key replay, conflicting changed replay, revision increment, invalid question/index, forged direct ORM actor, immutable audit update/delete, one terminal final submission with exact idempotency replay and post-submit mutation rejection.
- `scripts/phase7-cbt-answer-guard.test.mjs` adds source-level schema/SQL/authorization/idempotency/immutable/key-free checks to existing `npm test` and `verify:local:guards` while retaining full Vitest and existing mandatory `npm audit --audit-level=high` gate.
- D-041 / ADR-027, assessments module, authorization rules, ASM traceability, roadmap status and milestone checklist updated.

## Authorization, data safety and unverified risks

No STUDENT role-only access, role escalation, identity inference, foreign school/student enrollment sharing or early answer-key exposure. Exact identity is bound to Better Auth session by application and revalidated against the stored actor/attempt by SQL; malicious privileged direct DB writes may still spoof actor IDs and need verified database-access isolation. No mutable latest-answer overwrites; grading must later evaluate the last accepted per-question revision at or before immutable finalization/expiry. The retained immutable attempt start/deadline cannot be backdated by submittedAt or answer events. Exact previous acknowledgements are allowed only if current student/publisher authorization remains valid; this is not a new event after cutoff.

**Known unimplemented scope:** student key-blind question read, student CBT route/interface, attempt resume, server-side expiration snapshot and status, independent scoring/teacher moderation, class record sheets and results publication. These must be separately authorized and tested. No live test/user/student data was accessed.

## Actual verification performed vs authored tests

**Authored, NOT executed:** new SQL migration/three PL/pgSQL functions/triggers, Prisma relations, authenticated disposable-PostgreSQL Vitest integration cases, read-only Node invariant tests and internal runtime services.

**Actually executed:** Connector-backed GitHub source inspection over six fetched files. **20 of 20 limited static string/structure assertions passed** (school/attempt FK maps, 3 SQL function pairs, trusted UTC clock, actor/tenant/academic scope, revocation/withdrawal/timeout, immutable gates, key-free metadata, test registration). A first 19/20 inspection found an overly broad static token check matching a COMMENT rather than returned data; the harmless comment was reworded and the inspection rerun to 20/20. These checks are **not** Node tests, Prisma validation, PostgreSQL parser/execution, concurrency tests, Next runtime or CI evidence.

**NOT executed:** `npm ci`, Prisma validate/generate/deploy/drift, local disposable PostgreSQL migration/direct-SQL tests, full Node/Vitest, format/lint/typecheck, Next build/browser/accessibility, security audit `npm audit --audit-level=high`, or full local CI-equivalent. GitHub Actions billing remains blocked; no approved disposable database is available to this connector session.

## Next work and exit criteria

1. In confirmed disposable PostgreSQL, validate all cumulative migrations, review actor+membership FK names and trigger order, round-trip allowed timestamps, concurrent same/different idempotency keys, final submission races with saves/withdrawals/revocation, rollback and tenant cascade. Prove exact verified identity and no answer keys/PII leak.
2. Separately implement safe student attempt resume and **key-blind** question-content view, with resource-scoped repeated authorization on every GET, only after sufficient read/write constraints and acceptance evidence. Keep no student exam routes before privilege/tenant security gates.
3. Add controlled auto/objective scoring with marking key visible only to server-side graders, immutable score ledger and school/section validation before class record sheet publication.
4. Run unchanged full local CI-equivalent and strict high-severity dependency audit on an exact SHA, attach actual results, fix defects before release. Keep branches draft/unmerged and do not deploy or use live data.

**Milestone:** ASM-REQ-001 partially authored, not tested/accepted. **Exit gate: BLOCKED.**
