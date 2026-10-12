# Phase 7 CBT Attempt Reservation — Development Checkpoint

**Date:** 2026-10-12
**Milestone / requirements:** Phase 7 / ASM-REQ-001, T-ASM-001; existing Phase 4 student enrollment, Phase 5 teacher assignment, Phase 6 student-account identity, SEC-REQ-001 and TEN-REQ-001 prerequisites.
**Base:** `feature/phase7-assessment-publication-ledger` at `66db5a84a21c53883f74f886e79fe73a87017819`, draft PR #53, cumulative unmerged.
**Candidate branch:** `feature/phase7-cbt-attempt-ledger`; not deployed or production authorized.
**Exit gate:** BLOCKED (Phase 6 prerequisite and local test/audit acceptance pending).

## Changes authored

- Additive Prisma `AssessmentAttempt` model, with exact composite school/draft, school/StudentRecord, school/StudentEnrollment/student/class/session, school/STUDENT Membership and school/StudentAccountLink foreign keys. Unique `(schoolId,draftId,studentId,attemptNumber)` and server-clock start/deadline; no question, secret, answer or score columns.
- Additive SQL `prisma/migrations/20261012300000_phase7_cbt_attempt_admission/migration.sql` checks an active school, sealed exam, HM/Principal `APPROVED`, school super admin `PUBLISHED` and no `WITHDRAWN`, active original teacher exact assignment, active session/term/class/section/subject, unrevoked administrator-attested student account binding, active enrolled pupil, active exact same-school StudentEnrollment matching the draft's class/session, and actual STUDENT role/user mapping. A School FOR UPDATE lock serializes competing reservations with school-locked publication withdrawal and student binding revocation.
- SQL assigns `attemptNumber`, `startedAt` and `deadlineAt` **itself**, ignoring client values. Clock uses `clock_timestamp() AT TIME ZONE 'UTC'`; deadline is the lesser of server start + configured 5–180-minute duration and configured close. Rejects start outside [opens, closes), more than maxAttempts 1–3 (including abandoned), and parallel still-unexpired reservations. Immutable direct UPDATE/DELETE/TRUNCATE triggers.
- Authenticated `src/modules/assessments/attempt-reservation-service.ts` resolves only one currently unrevoked attested same-school student/enrollment identity and inserts with Prisma SERIALIZABLE transaction; SQL trigger repeats the policy and sets authoritative fields. Returns only ID, draftId, ordinal and UTC start/deadline; **internal-only, deliberately not imported by a Next route or student UI**.
- `questions.integration.test.ts` synthetic authenticated disposable-PostgreSQL scenario authored for approval-only, publication-only/unlinked, wrong user/tenant, first reservation, parallel attempts, server-generated ordinal/clock, immutable attempts and terminal link revocation; read-only `scripts/phase7-attempt-admission-guard.test.mjs` included in existing `npm test` and `verify:local:guards` while preserving all prior Vitest and dependency-audit controls.
- D-040 / ADR-026, assessment module and authorization rules, requirements traceability, roadmap current status/checklist updated.

## Verification provenance

**AUTHORED BUT NOT EXECUTED:** Prisma schema migration; PostgreSQL trigger, locking and FK tests; synthetic authenticated DB integration suite; new Node source guards; server code at runtime.

**ACTUALLY EXECUTED:** GitHub connector branch/file/commit operations and one fetched-source structural comparison across six files: **17 of 17 simple source-presence checks passed** (named composite FKs, SQL release/revocation/actor conditions, trusted UTC clock, locked attempt counter, immutable trigger names, registered tests and no student exposure model). Not equivalent to Node test execution, Prisma validation, PostgreSQL parser/runtime, an authenticated HTTP test, or full CI.

**NOT EXECUTED:** `npm ci`, Prisma validate/generate/migrate/drift, PostgreSQL concurrency/race tests, complete Node/Vitest test suites, format/lint/typecheck, Next build, browser/accessibility, `npm audit --audit-level=high` or agreed local CI-equivalent. GitHub Actions remains billing-blocked and no user-confirmed disposable PostgreSQL target was available to the connector workflow. Existing security findings are not waived.

## Security and tenant boundary

- No live student data or real school users; synthetic fixtures only.
- Student role alone is insufficient: requires permanently attested, unrevoked exact existing STUDENT membership and enrolled StudentRecord with matching active class/session enrollment. Enrollment and account link cannot be invented from name, email or admission strings.
- The school lock is necessary but must undergo multi-transaction tests against revocation, withdrawal, school/user/member lifecycle updates, direct SQL and concurrent admissions; no broader privileges are granted.
- Trusted DB UTC clock and ordinal are assigned by trigger, no browser expiration override. Assumes existing UTC timestamp convention and requires explicit DB session timezone tests.
- No student exam GET, question delivery, autosave, answer submission, attempt resume, scoring, grading or class record sheet. A prior independent publication is a prerequisite, not itself a student-visible exam.
- No automatic completion of a reservation: it conservatively blocks new attempts until its deadline. The next separately audited submission/finalization workflow will have to support earlier completion without editing the attempt row.

## Next implementation and validation direction

1. Add immutable per-attempt response-event and terminal submission/expiration ledgers with database-side ownership, deadline, question set, idempotency/replay controls; ensure no correct answer keys exposed.
2. Add safely scoped, key-blind student question projection only after all student identity and attempt predicates can be rechecked in the same database query; do not expose this prematurely.
3. Add exact teacher moderation/scoring and class sheets with immutable corrections before publication of results; maintain separate school approval.
4. Execute cumulative disposable DB migrations and tests, full local CI-equivalent and `npm audit --audit-level=high`, remediate all failures. Maintain draft branches and no merge/deployment until acceptance.

**Final checkpoint:** Major CBT attempt admission foundation AUTHORED, **UNVERIFIED / BLOCKED**; no production use or student exposure.
