# Phase 7 Written/Offline Manual Mark Proposals — Development Checkpoint

**Date:** 2026-10-12
**Requirements:** ASM-REQ-001 / T-ASM-001, SCH-REQ-001, TEN-REQ-001, SEC-REQ-001.
**Base:** `feature/phase7-grading-policy-revisions` at `e4edc2c3568cdf75318e3505243649e2f4fcaa4d` (draft PR #59); cumulative on prior Phase 6 and Phase 7 drafts.
**Candidate branch:** `feature/phase7-manual-mark-proposals`; nonproduction and unmerged.
**Exit gate:** BLOCKED; earlier Phase 6 and all cumulative Phase 7 SQL migrations/local CI-equivalent/security audit unverified.

## Authored changes and source files

- Prisma `AssessmentManualComponent` immutable teacher-owned school/session/term/class/subject/assignment + category title/maximum (1–100). `AssessmentManualMarkProposal` immutable first-per-exact student/component whole points (0..maximum) and reason, same-school StudentEnrollment/pupil/actor FKs. Proposals do **not** create official or provisional result records and cannot overwrite other scores.
- Additive `20261012340000_phase7_manual_mark_proposals` SQL: current active school row lock, actual TEACHER membership/user and exact active class/subject/session/term/assignment; independent max mark constraint and active ENROLLED pupil/exact ACTIVE school/class/session StudentEnrollment check. Composite tenant FKs, unique initial student/component mark, SQL UTC timestamps and immutable UPDATE/DELETE/TRUNCATE triggers.
- `manual-mark-service.ts`: signed-in exact assignment teacher component creation; SERIALIZABLE same-school first proposal with one unambiguous matching active enrollment; teacher-only 100-item component reader and final SQL-joined exact teacher/student roster limited to 500 with duplicate enrollment failure. Permission rechecked on empty-roster fallback. No other staff role escalation.
- Private no-store components GET/POST, per-component enrolled-student roster GET and mark-proposal POST; `manual-http.ts` error mapping; school-gated teacher `assessment-manual-marks` page/editor and school navigation.
- Extended synthetic authenticated `questions.integration.test.ts`: wrong/foreign role, invalid marks and forged teacher, exact school/class enrollment/roster, component and mark creation, same-child duplicate conflict, immutable audit, and explicit exclusion from current provisional class sheet. New `scripts/phase7-manual-mark-proposal-guard.test.mjs` added to existing full test and local guards commands without removing Node/Vitest suites or strict audit.
- Docs updated: module specification, current status, milestone checklist, ASM traceability, authorization rules, D-046 and ADR-032, checkpoint.

## Actual execution and blockers

**ACTUALLY EXECUTED:** GitHub connector file, branch and commits; a fetched-source 12-file structural inspection. First pass 19/20 because one inspection looked for a case-mismatched source token; the actual test references were verified present. Corrected inspection **20/20 simple static checks passed**, including 10 FK map references, active teacher + exact student actor/tenant SQL, role/privacy/immutability protections and complete test-suite registration. These are NOT Node/Vitest executions, Prisma validation, migration parser tests or actual concurrency checks.

**AUTHORED, NOT EXECUTED:** additive SQL migration/trigger logic, synthetic real-session disposable PostgreSQL integration cases, read-only Node regression guards, private Next API and teacher UI at runtime.

**NOT EXECUTED:** `npm ci`, Prisma generate/validate/deploy/drift, disposal-DB migration and SQL actor/revocation/concurrency, Node/Vitest suites, format/lint/typecheck, Next build, browser accessibility, `npm audit --audit-level=high` or full agreed local CI-equivalent. GitHub Actions billing remains blocked, and no verified disposable database is available to this connector session.

## Controls and limitations

School administrator, HM/Principal, other teacher, learner, guardian and platform role do not inherit teacher marking permission. A first manual proposal is **UNAPPROVED_NOT_SCORED**. It cannot affect existing immutable objective scores, provisional class records, weighted grade preview, parent/student result, grade export, or official report cards. After first proposal, no second or corrected mark is accepted in this slice: future separately authorized audited correction and HM PRIMARY / Principal SECONDARY review/approval must be implemented and tested before any gradebook adoption. Actual school policy weight/approval and Phase 8 official report publication remain incomplete.

**No live/sensitive data, database application, merge, deployment, production exposure or relaxed security gate. Exit BLOCKED.**
