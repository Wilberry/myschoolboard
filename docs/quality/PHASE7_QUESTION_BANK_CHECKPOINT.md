# Phase 7 Question Bank Foundation — Development Checkpoint

**Date:** 2026-10-12
**Requirement/milestone:** ASM-REQ-001 / T-ASM-001; Phase 7 — Assessments, CBT and class record sheets.
**Base:** `feature/phase6-verified-student-lesson-access` at `a71774ae4d1d9ad6bcfb5988fe7d9eaec19e0ba1`; unmerged Phase 6 candidate.
**Branch:** `feature/phase7-question-bank-foundation`, non-production draft.

## Changes authored
- Additive `AssessmentQuestion` and `AssessmentQuestionKey` Prisma models and review-only `20261012260000_phase7_question_bank` migration. School/assignment/member/class/subject/session/term composite FKs; option check (2–6), independent actor/assignment/key-index triggers; immutable direct UPDATE/DELETE/TRUNCATE.
- `src/modules/assessments/question-service.ts`: authenticated exact active TEACHER + assignment verification, serializable question/key creation, metadata-only current-author list with 100 cap; no key read/return.
- Private school assessment-questions POST/GET, server-verified teacher question bank page, client four-option editor and school navigation. No student access, key exports, scoring, attempts, publication or score records.
- `src/modules/assessments/questions.integration.test.ts`: synthetic real-session/postgres tests for role, tenant, revoked assignment, invalid options, direct SQL spoofing, immutable question/key, and no leaked correctIndex.
- `scripts/phase7-question-bank-guard.test.mjs`: authored read-only Node invariant tests. Integrated into `npm test` and `verify:local:guards` preserving Vitest and strict security gates.
- D-036, ADR-022, assessment module specification, traceability, current status, milestone checklist and this checkpoint.

## Authorization and privacy
- Teacher class/subject/session/term ownership is verified from the stored exact assignment; independent scope grants, school-only membership and client-provided actor identities do not grant access.
- Answer key lives in separate table, is not returned by either protected route, and is immutable. No student CBT delivery or answer reveal is authorized.
- Original school, enrollment, lesson and attendance data untouched; migration is additive only.
- All Phase 6 features, migration and full CI gate remain unverified; Phase 7 feature implementation does not lift Phase 6 dependency.

## Executed versus authored evidence

**Authored, NOT executed:** PostgreSQL migration/triggers, authenticated Vitest integration suite, read-only Node invariant tests, browser checks and Next page behavior.

**Actually executed:** GitHub connector-created branch/commits and one limited fetched-source inspection: **12 of 12 literal source/structure assertions passed** (schema and FK map presence, separate keys, trigger safeguards, service/HTTP projection structure, test registration). These are NOT Prisma validation, database execution, a test-runner result or full CI.

**Not executed on this branch:** `npm ci`, Prisma validation/generation/deploy, Node/Vitest tests, formatting, lint, TypeScript, Next build, browser accessibility, `npm audit --audit-level=high`, or complete local CI-equivalent. GitHub Actions is blocked by billing and there is no verified disposable database available in this connector-only session.

## Known limitations / next work
- Immutable question replacement/versioning, assessment draft configuration, questions attached to exams, grading and attempt rules are still to build; no student publication, scoring or class sheet.
- Accept only approved local disposable PostgreSQL as migration/test target; test DB-level actor scope, duplicate and concurrent writes, school cascade/rollback and key/index constraints.
- Validate student safety, teacher editor accessibility, lost permission races and private response behavior on live Next browser with synthetic accounts.
- Preserve mandatory high-severity audit gate; no waiver/merge/deployment/live data.

**Exit gate: BLOCKED — partially authored ASM-REQ-001; Phase 6 and Phase 7 unverified.**
