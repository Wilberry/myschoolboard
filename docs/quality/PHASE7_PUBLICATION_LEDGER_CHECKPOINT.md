# Phase 7 School Assessment Publication Ledger — Development Checkpoint

**Date:** 2026-10-12
**Requirement:** ASM-REQ-001 / T-ASM-001 (partial controlled exam publication, not CBT or scoring).
**Base:** `feature/phase7-cbt-attempt-foundation` at `4d48f9ab5bd36b015d57c245d8d64aa70ae4fd1a`, draft PR #52.
**Branch:** `feature/phase7-assessment-publication-ledger`, cumulative nonproduction draft.
**Upstream dependencies:** PR #52 → #51 → #50 → Phase 6 unmerged/unverified. This new PR does not lift any upstream exit gate.

## Authored changes
- Prisma `AssessmentPublicationAction` enum PUBLISHED/WITHDRAWN and append-only school-owned `AssessmentPublicationEvent` model, exact school/draft and current school membership FKs, actor ID/reason/time, unique (schoolId,draftId,action).
- Additive review-only `prisma/migrations/20261012290000_phase7_assessment_publication/migration.sql`: BEFORE INSERT validation locks school + draft; checks currently active same-school SCHOOL_SUPER_ADMIN actor user/membership; requires sealed active exact school/class/section/subject/session/term/teacher assignment and a separate APPROVED HM/Principal `AssessmentReviewEvent` before PUBLISHED. A RETURNED draft cannot be published. Never republish an already published or withdrawn draft. Only PUBLISHED can later be WITHDRAWN, which remains permitted after original teacher revocation for safe authorized withdrawal. No edits, deletes or truncate permitted by normal database DML.
- `src/modules/assessments/publication-service.ts`: signed-in actor, active current school super admin check, SERIALIZABLE school/member/draft row locks, duplicate/return/withdrawal validation, immutable event insertion and 100-row current-authority metadata-only listing. No private answers or student content included.
- Private `assessment-publications` GET and draft decision POST routes, School Super Admin-only page and confirmation-based publication/withdrawal editor, school navigation.
- Added synthetic real-session test cases to `src/modules/assessments/questions.integration.test.ts` for school super admin allowed, SCHOOL_ADMIN/teacher/HM/Principal/foreign denied, only APPROVED published, RETURNED denied, duplicate publish, pre-publish withdraw denied, forged SQL actor, terminal withdrawal and immutable event audit.
- Read-only Node test `scripts/phase7-publication-guard.test.mjs` included in `npm test` and `verify:local:guards`, preserving complete existing Vitest suites and strict audit. D-039, ADR-025, assessment module, authorization rules, traceability and milestone/checkpoint documentation updated.

## Security implications and limitations
- HM/Principal section approval, even if APPROVED, is **never equivalent** to School Super Admin publication. Regular School Admin, Platform Super Admin, Form Teacher and TEACHER cannot publish by role inheritance.
- A PUBLISHED event is a **development-only authorization ledger state**, not an enabled student examination: there are no authenticated student question delivery/attempt/autosave/answer-key/scoring/result-sheet routes in this slice. Explicit active enrolled student relationship, unique attempt clocks/counting and answer confidentiality remain required before enabling CBT.
- Withdrawal never updates, overwrites or deletes a published event. No actual question/mark/key history is changed.
- No hosting selection, external provider, destructive data migration, live data, merge, release, deployment or security gate relaxation.

## Tests authored vs executed — exact provenance
**AUTHORED BUT NOT EXECUTED:** new SQL migration/trigger, Prisma schema, synthetic PostgreSQL authenticated role/review/publication/withdrawal tests, Node invariant tests, protected Next page and browser acceptance tests.

**ACTUALLY EXECUTED:** Connector file/branch/commit operations and one limited inspection of eight GitHub-fetched files with **17/17 structural and string source checks passed** (model/enum, exact FK constraint names, PL/pgSQL delimiters, actor/review/seal checks, terminal withdrawal, no-key/attempt projections and test registration). These are not Node test runs, PostgreSQL parser/trigger tests, Prisma validation or complete CI.

**NOT EXECUTED:** `npm ci`, Prisma generate/validate/migration execution, disposable DB direct-SQL/race/lifecycle tests, Prettier, lint, typecheck, whole Node/Vitest suite, Next build, browser/accessibility, `npm audit --audit-level=high`, or the agreed local CI-equivalent. GitHub Actions remains blocked by billing. The high-severity dependency audit gate and prior advisories remain unwaived.

## Next development / mandatory exit
1. Only on owner-confirmed disposable PostgreSQL, validate all cumulative migrations including review/publication sequences and direct SQL actor/grant revocation/draft return/withdrawal race invariants.
2. Execute every synthetic authenticated suite and full local CI-equivalent security gate, fixing any errors before acceptance.
3. Author a **separate** student CBT admission + immutable attempt/answer-event engine only with server/SQL enforced unrevoked school-attested STUDENT identity, active exact enrollment, separate APPROVED and unwithdrawn PUBLISHED draft, trusted server clock/deadline, atomic attempt limits, idempotent autosave/submission, controlled scoring/marking and no early keys. No production student use until all approvals/verification.
4. Results/class sheets remain separate; do not prematurely conflate assessment publication with official score/report publication.

**Exit gate: BLOCKED — ASM-REQ-001 partially authored, Phase 6 unverified; no release or merge.**
