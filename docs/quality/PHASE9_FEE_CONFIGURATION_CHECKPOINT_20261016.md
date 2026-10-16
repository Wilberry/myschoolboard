# Phase 9 Fee Configuration Foundation — Development Checkpoint

**Date:** 2026-10-16
**Branch:** `feature/phase9-fees-payments-foundation`
**Chosen baseline:** committed Phase 7 `18d8b8292fc37e3f131986fe6d8ab9c3038ad2e0`
**Phase 8 independence:** Phase 8 verification branch `verify/phase8-local`
and both local project worktrees were not modified.
**Requirement:** FEE-REQ-001 partial; TEN-REQ-001 and SEC-REQ-001
tenant/authorization protections authored only.
**Exit gate:** **BLOCKED / NOT VERIFIED**.

## Files and implementation

- `prisma/schema.prisma`: FeeScope, immutable FeeCategory and
  FeeStructureRevision relational models. All references (school,
  category, session/term, optional class/section, actor member) bind
  to matching school IDs. Currency and money represented without float.
- `prisma/migrations/20261016120000_phase9_fee_configuration_foundation/migration.sql`:
  additive tables/enums/constraints, unique per-context revision, composite
  school FKs, current actor and period SQL guards, school-level serialized
  version allocation, trusted UTC timestamps, immutable DELETE/UPDATE/TRUNCATE
  triggers. The migration has NOT been applied to any database.
- `src/modules/fees/fee-configuration-service.ts`: authenticated server
  session, active current same-school School Super Admin, transactional
  private category and revision creation, strictly validated request,
  no client actor identity, 1,000,000,000,000 positive minor-unit
  ceiling and decimal strings, final-SQL authenticated metadata reader.
- `app/api/schools/[schoolId]/fee-categories/route.ts` and
  `app/api/schools/[schoolId]/fee-structures/route.ts`: explicit GET/POST,
  `private, no-store`, no edit/delete, school-owner-only metadata.
  **Candidate endpoints, not production enabled/accepted.**
- `src/modules/fees/fee-configuration.integration.test.ts`: synthetic
  Better Auth session tests for anonymous/ordinary admin/teacher/foreign
  school denial, wrong tenant scope, invalid minor-unit/currency/actor,
  independent school/section/class versions, SQL actor forgery, immutable
  history and closed-term denial. Authored, NOT EXECUTED.
- `scripts/phase9-fee-configuration-guard.test.mjs`: structural source
  invariant checks. `package.json` retains and augments full
  `test` and `verify:local:guards` suites; no prior checks removed.
- Updated fee module contract, decision log, ADR, configuration catalog,
  finance logical model, traceability matrix, current status, checklist.

## Security and authorization implications

School owner financial policy authority is separately bound to a
current authenticated same-school School Super Admin and SQL actor
tuple, not Platform Super Admin, teacher, form teacher, academic reviewer,
school ordinary admin, parent or student. No pupil enrollment, parent
relationship, payment information or receipts are returned. SQL foreign
keys and final-query authenticated reads limit cross-school scope.

Every fee configuration revision is financial **policy evidence**, NOT
payment, debt, settlement or receipt. Provider integration and trusted
verification/reconciliation are deliberately absent. Schoolwide fee
policy/currency is explicit, not assigned from national defaults.
Amount cap and SCHOOL/SECTION/CLASS targeting are reversible engineering
defaults recorded in D-P9-001/ADR-P9-001. Future obligations must pin
one exact immutable revision and must not reprice silently.

## Test execution and environment blockers

- GitHub repository inspection and commit operations: executed; tool
  confirms branch and commits. No GitHub Actions dispatched, PR created,
  default branch changed, or deployment performed.
- Node structural guard: **authored, NOT run by Node**.
- Synthetic Vitest/PostgreSQL test suite: **authored, NOT run**.
- Prisma schema validation/generation: **NOT run**.
- Cumulative migrations/drift/SQL triggers and school deletion cascade:
  **NOT run**. Must verify on confirmed disposable
  `localhost:5434/myschoolboard_test` with
  `TEST_DATABASE_DISPOSABLE=1` per existing runbook.
- `npm run format:check`, ESLint, TypeScript typecheck, Next build,
  full `npm test`, and `npm audit --audit-level=high`:
  **NOT run**. Existing Phase 8 dependency security findings
  remain a mandatory unresolved release gate; none was waived.
- Authenticated real browser, privacy, UX/accessibility, printing and
  release readiness: **NOT run**.

## Next authorized development milestone

After validating the cumulative migration in an isolated, disposable
environment, implement **immutable student fee obligation issuance**
for exact same-school ENROLLED pupil/ACTIVE enrollment and pinned fee
revision, duplicate request protection, explicit amount/currency
snapshot and reasoned adjustment/reversal evidence. Then implement
payment upload evidence with independent verified/rejected decision,
idempotent provider-event adapter boundary (no live provider), verified
receipts, allocation, outstanding balance and reconciliation. Add
separate least-privilege finance verification authority only after
its role/workflow contract is defined. Keep all school/guardian reads
private and cross-school-denying; do not mark Phase 9 or Phase 8 accepted.

**Deviations:** none from governing Phase 9 scope. The initial
SCHOOL_SUPER_ADMIN-only configuration authority is the conservative
explicit existing configuration-catalog policy, not an assumed finance
delegation or production approval.
