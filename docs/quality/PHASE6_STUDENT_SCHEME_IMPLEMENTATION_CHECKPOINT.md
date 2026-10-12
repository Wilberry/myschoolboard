# Phase 6 Completion Candidate — Verified Student Lessons and Schemes

**Date:** 2026-10-12
**Source baseline:** `feature/lesson-approved-release-foundation` at `e52cf17c0de4c606058f35c24f4ace6d217ea17b` (draft PR #47).
**Development branch:** `feature/phase6-verified-student-lesson-access`, cumulative unmerged.
**Phase/requirements:** Phase 6, LES-REQ-001, ATT-REQ-001, SEC-REQ-001 and TEN-REQ-001. Phase 4 enrollment and Phase 5 teacher assignment are prerequisites.

## Changes authored

- `prisma/schema.prisma`: StudentAccountLink, StudentAccountLinkRevocation with one-to-one same-school links and event attestation; LessonDocumentKind and immutable typed lesson/scheme first/last week.
- `prisma/migrations/20261012240000_student_account_identity/migration.sql`: composite school-bound FKs, role-verified administrator attestation, active enrolled student and STUDENT membership checks, terminal immutable revoke, no inferred/bulk past account linking.
- `prisma/migrations/20261012250000_lesson_scheme_kind/migration.sql`: additive LESSON_NOTE default, SCHEME_OF_WORK ordered teaching weeks, immutable kind/schedule, no revision rewrite.
- `src/modules/students/account-link-service.ts`: strict authenticated administrator identity attestation, duplicate prevention, reasoned revocation and bounded administrator link list.
- `src/modules/lesson-notes/student-reader.ts`: private list and detail with exact active authenticated STUDENT membership ↔ unrevoked school-owned identity binding ↔ same-school active student enrollment/class/session/term ↔ approved and explicitly released, not withdrawn, current immutable revision. No broad academic:read fallback.
- Private school-scoped /student-links and /student-lessons APIs and server-protected school student/admin pages; student lesson list is metadata-only; content is disclosed on a separate authorized detail GET.
- `src/modules/lesson-notes/service.ts`, `lesson-note-editor.tsx`, reviewer/release/student read/UI updated to distinguish schemes with teacher-owned weekStart/weekEnd, using existing immutable review/release pipeline.
- `src/modules/lesson-notes/review.integration.test.ts` extended with synthetic real-session learner linking, foreign/incorrect-class denials, explicit release, withdrawal, revocation, term closure, scheme drafting/approval/release and immutable week guard.
- `scripts/phase6-identity-release-guard.test.mjs` authored and added to existing `npm test` / `verify:local:guards` Node source checks while retaining all Vitest suites and security gates.
- D-034/D-035, ADR-020/021, module specification, requirements traceability, roadmap status/checklist and Phase 6 exit tracker updated.

## Database and tenant safety

The identity binding is explicitly attested by active school administrator with a manually confirmed relationship. Existing STUDENT membership IDs are not inferred from name, email, admission number, user similarity or school-only membership. StudentAccountLink unique school/student and school/member constraints block ambiguous one-to-many mapping; revocation is a distinct immutable record, not a bool update. Direct raw SQL actor/role/active enrollment validation supplements transactional service checks. No production users are linked or backfilled.

The student content reader uses active school, matching user→member, same-school unrevoked attested StudentRecord, active student enrollment, class, active academic session, active term, active teacher assignment, approved note, immutable approved revision and separate released event with no withdrawal. Release and withdrawal remain independent of approval.

Schemes reuse versioning and class/subject/term review restrictions rather than introducing a parallel unapproved student document store. PostgreSQL CHECK requires SCHEME_OF_WORK has valid weeks 1–53, ordinary notes do not have week values, and schedule/type are immutable. Existing records default to LESSON_NOTE.

## Tests authored versus actually executed

**Authored; NOT executed:** extended real-session/disposable-PostgreSQL Vitest cases for binding/role/tenant/class/session/term, wrong/no binding, no release, withdrawal, link revocation, exact week range, teacher scheme review/release; new read-only Node source guards and both SQL migrations.

**Actually executed:** GitHub connector branch/commit/file operations and a limited, ad hoc comparison of GitHub-fetched source strings across nine files: **12 of 12 static source-presence checks passed** (matching explicit identity FK map names, unique identity links, actor checks, release and withdrawal joins, scheme range checks, and test script preservation). These are **NOT** an execution of Node tests, Vitest suites, Prisma migration/parser validation, Next server/HTTP/browser tests or full CI.

**Not executed on cumulative branch:** `npm ci`, Prisma validate/generate/migrate, disposable PostgreSQL trigger/concurrency tests, all Node and Vitest tests, Prettier, lint, TypeScript, Next build, browser accessibility/end-to-end, and `npm audit --audit-level=high`. GitHub Actions remains blocked by billing. No usable, verified disposable database was available to this connector-only execution context.

## Remaining gaps, risks and exit criteria

1. Operator-confirmed disposable PostgreSQL migration chain with Prisma drift and SQL trigger tests. Resolve any generated-client/typecheck/lock contention/schema-mapping failures. New per-student access joins require query-plan inspection at representative synthetic sizes.
2. Execute tests for role revocation races, forged SQL attestation/release, direct audit UPDATE/DELETE/TRUNCATE, simultaneous link/identity reads, cross-tenant term/enrollment, scheme week overlap and stage-specific HM/Principal decisions.
3. Verify school administrator out-of-band identity attestation procedures and durable evidence standards before production identity links; the application records attestation, not independent biometric/registry proof. Reassignment after terminal revocation remains intentionally denied, pending a separately audited lifecycle policy.
4. Test lesson/scheme student and reviewer browser accessibility, school navigation, keyboard/screen readers and private no-store HTTP behavior.
5. Run the exact agreed local CI-equivalent with recorded tested commit SHA, command exit codes and test counts; mandatory high-severity dependency audit findings cannot be waived. Amend any defects found, do not merge/deploy, and leave ATT/LES requirements incomplete until documented passing acceptance evidence exists.

**Implementation coverage:** Major Phase 6 attendance and lesson/scheme workflows authored in cumulative draft branches.
**Exit gate:** BLOCKED — no executed database, full CI, browser or strict security gate for this candidate.
**Prohibited actions not taken:** no live records, customer data, backfill, merge, deployment, audit waiver or production configuration changes.
