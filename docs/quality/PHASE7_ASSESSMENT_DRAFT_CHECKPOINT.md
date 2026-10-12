# Phase 7 Assessment Configuration — Development Checkpoint

**Date:** 2026-10-12
**Requirement/phase:** ASM-REQ-001 / T-ASM-001 — Phase 7 Assessments, CBT and class record sheets.
**Baseline:** `feature/phase7-question-bank-foundation` at `9bb333cb2c8efc46665c4b9da4096cfb55c0a7ea` (draft PR #50).
**Candidate:** `feature/phase7-assessment-draft-config` (new cumulative development branch, unmerged).

## Implemented files and functions
- Prisma `AssessmentDraft`, `AssessmentDraftQuestion`, `AssessmentDraftSeal`, `AssessmentDraftKind`, exact school/member/teacher assignment/term/class/subject and question composite relations.
- Review-only additive SQL `prisma/migrations/20261012270000_phase7_assessment_drafts/migration.sql`: QUIZ/TEST/EXAM immutable configuration, valid UTC time range within active term, 5–180 minute duration, maximum attempts 1–3, pass percentage 0–100; question positions 1–50, points 1–20 and exact private-keyed question binding.
- DB insertion validation repeats active school, actual teacher identity, exact assignment, active class/section/subject/session/term and private keyed question ownership. The one-time immutable `AssessmentDraftSeal` blocks all later attachments; completed lists require seal.
- `src/modules/assessments/draft-service.ts`: authenticated TEACHER exact-assignment check, same term bounds, 1–50 distinct selected questions with private keys and matching original owner/assignment tuple; create draft + items + seal atomically in SERIALIZABLE transaction.
- Private assessment-drafts POST/GET returns only draft configuration and aggregate count/total marks (not answer keys or student content), school-scoped teacher page and draft editor, role-aware school navigation.
- `question-service.ts` private author metadata GET now supplies original assignmentId so teacher UI filters eligible own questions by exact term/assignment.
- Extended synthetic real-session `questions.integration.test.ts`: role/foreign school, malformed schedule/attempt/scoring range, invalid/duplicate item, unauthorized actor, immutable snapshot/attachment, unique seal and no early answers. Added `scripts/phase7-assessment-draft-guard.test.mjs` to existing complete `npm test` and `verify:local:guards`, preserving previous suites.
- D-037, ADR-023, ASM requirement traceability, assessment module, current status, milestone checklist and checkpoint docs updated.

## Permissions and security
- No permission broadened: active exact TEACHER class/subject/session/term relationship required. No Form Teacher-only bypass, School Super Admin academic override, Platform support override or unverified CLASS+SUBJECT grant combination.
- All write clients lack authority to choose actor, membership, school class/subject or stored assignment relationship. Only question IDs, grading settings and schedule are provided; service resolves and DB validates effective school data.
- Separate keys never appear in teacher draft metadata or student endpoints. There is **no student CBT endpoint, attempt state, score read or write, assessment publication, early solution release, grading approval or official record sheet**.
- Entire Phase 6 and Phase 7 are unverified; no app deployment or live school data.

## Tests authored vs tests executed

**AUTHORED, NOT EXECUTED:** new Prisma/SQL migration, SQL actor/seal/immutable triggers, real-session disposable PostgreSQL integration cases, read-only Node test, TypeScript build and browser UI.

**ACTUALLY EXECUTED:** GitHub branch/file/commit operations and one limited GitHub-fetched source string/structure comparison covering model/FK/constraint declarations, seal placement, no-key route projection, test registration and scripts. **14 of 14 simple static checks passed**. These are not Node/Vitest tests, database runtime evidence or CI; question-bank parent PR #50 separately had 12/12 source presence checks.

**NOT EXECUTED:** `npm ci`, Prisma validation, generation or migration, any disposable PostgreSQL test, `npm run format:check`, lint, TypeScript, Node/Vitest suite, Next build, HTTP/browser/accessibility tests, `npm audit --audit-level=high` or full local CI-equivalent. GitHub Actions billing remains blocked.

## Known limitations and open requirements
- Attempt limits/max score/passPercent are stored **definitions only**. They are not enforcement evidence until a separate secure CBT delivery, submission, scoring and idempotency implementation exists.
- UTC schedule is a conservative internal default, not a school-local exam publishing policy; no student delivery or official result publication in this draft.
- School/day/session/term/teacher/role revocation races, concurrent DB writes, direct SQL seal spoofing, exact-key non-disclosure and tenant cascade require disposable-DB tests.
- Phase 6 prerequisite remains blocked pending local execution and security remediation, so no Phase 7 publication/release acceptance or merge is authorized.
- Full local CI-equivalent and strict high-severity dependency audit remain mandatory on an exact tested commit.

**Exit gate: BLOCKED. ASM-REQ-001 partially authored only, not validated. No merge, deploy, live data or security waiver.**
