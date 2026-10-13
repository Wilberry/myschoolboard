# Phase 8 Result Evidence and Independent Academic Review — Development Checkpoint

**Date:** 2026-10-13
**Cumulative base:** `feature/phase8-adopted-grading-policy`, draft PR #66 (itself based on #65 and unfinished Phase 6/7).
**Branch:** `feature/phase8-result-sheet-evidence-review`.
**Requirements:** RES-REQ-001, SCH-REQ-001, TEN-REQ-001, SEC-REQ-001.
**Exit:** BLOCKED. No live database, merge, official report or deployment.

## Authored implementation

- Additive Prisma `ResultSheetEvidence` and `ResultSheetReview`, composite same-school teacher/original assignment/latest adopted policy/evidence/reviewer FKs; sourceManifest `Json` is an immutable DB-built array, not caller input. Migration `20261013100000_phase8_result_sheet_evidence_review` with SQL insert triggers, school row locking, UTC audit timestamps and UPDATE/DELETE/TRUNCATE mutation prohibition. No student/parent access or result release table.
- Teacher writes only assignment ID, term ID and reason. `exactAssessmentTeacher` plus INSERT trigger verifies active exact source teacher/class/subject/section/session/term, explicit latest `ResultGradingAdoption`. SQL builds per-active-ENROLLED-pupil manifest using original approved and currently PUBLISHED/not-WITHDRAWN sealed CBT scores from submitted attempts, plus independently academically APPROVED written scores/last independently APPROVED correction. Only computed pupil/assessment IDs and marks, **no answer keys**; no caller-provided marks or manifests.
- Enforce each enrolled pupil has a complete source and at least one source; reject duplicate enrollment, absent/unscored CBT, missing or returned manual marks, pending manual correction, >500 pupils, and any positively weighted adopted QUIZ/TEST/EXAM category without evidence.
- Unique per school/session/term/class/subject revision. One undecided snapshot blocks another; an approved/returned snapshot can be followed by a fresh version only when SQL-computed source or adopted policy actually changes. Earlier evidence remains immutable.
- Reviewer: currently active independently verified **PRIMARY HEAD_OF_SECTION** or **SECONDARY PRINCIPAL** for the actual class SECTION, never the preparing teacher. Final SQL reevaluates academic source and exact section. APPROVED is allowed only on latest evidence and latest adoption with same recomputed manifest. Stale evidence may be RETURNED, never approved. One immutable terminal decision per evidence.
- Private no-store teacher evidence GET/POST, verified section reviewer GET/decision POST, teacher and academic reviewer pages/navigation; no School Super Admin publication action, report-card rendering, downloads, student/parent endpoint, automatic weighted score, or official grade.
- Synthetic authenticated integration test added for dedicated school/subject: School Super Admin adopts exact policy, teacher creates manual component/mark, HM independently approves, SQL freezes one-pupil manifest, wrong roles/wrong section denied, duplicate and tampering rejected, HM approves; new independently APPROVED manual correction creates a second immutable evidence revision and must be reviewed again. Additional negative cases for incomplete draft, forged marks and wrong school. Node source guard registered with entire existing Node/Vitest sequence. D-053/ADR-039 and module/status/traceability/authorization docs updated.

## Verification provenance

**ACTUALLY EXECUTED:** Connected GitHub API branch, file, commit and draft PR operations; limited GitHub-fetched structural consistency assertions **14/14 passed after correcting three mistaken inspection labels** (reviewer SQL alias was `scope`, reviewer source type for manifest is not caller input, UI case matching). The new Node structural guard initially referenced a nonexistent `grant` alias but was corrected to `scope` in the committed source. No PostgreSQL/Prisma/Vitest execution in this work session.

**AUTHORED, NOT EXECUTED:** SQL migrations/triggers, Prisma schema validation, real-session synthetic Vitest database tests, Node static regression guard, Next routes and browser UI.

**NOT EXECUTED:** full repository checkout/npm ci; Prisma validate/generate/deploy/drift, owner-approved disposable loopback PostgreSQL trigger/race/rollback/revocation; Node/Vitest suites, format/lint/typecheck, Next build, browser/a11y, `npm audit --audit-level=high`, and unchanged `npm run verify:local` CI-equivalent. GitHub Actions billing blocked; Phase 6/7 and prior Phase 8 adoption migration also pending local verification.

## Follow-on sequence

1. Run all cumulative migrations and tests on the documented **disposable loopback-only** DB `localhost:5434/myschoolboard_test`, with explicit preflight variables; fix any SQL/TypeScript/runtime/a11y/security defects under normal development mandate. Do not use shared or production DB.
2. Record independently reviewed result-sheet evidence lifecycle including concurrent review, source invalidation, membership/ScopeGrant revocation and policy change, exactly matching signed-in current school member; validate byte-for-byte frozen source against current review.
3. Next Phase 8 milestone is separately authorized School Super Admin FINAL report publication and server-only verified student/guardian visibility, plus frozen official grade presentation under the explicitly adopted school grading policy. **Not implemented or authorized for release here**.

**Outcome:** Phase 8 explicit grading adoption, frozen source evidence and independent academic review substantially AUTHORED on cumulative draft branches. Formal milestone, SQL, security and release acceptance remain BLOCKED.
