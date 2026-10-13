# Results and Report Cards

## Phase 8 school grading-policy adoption (AUTHORED; NOT VERIFIED)

`feature/phase8-adopted-grading-policy` introduces `ResultGradingAdoption` as an append-only, versioned School Super Admin decision to **adopt** a specific immutable `AssessmentGradingPolicyRevision` for one exact school/session/term/class/subject. The PostgreSQL INSERT trigger independently verifies active same-school School Super Admin member+user, exact current policy context, active academic session/term/class/section/subject, 100% explicit QUIZ/TEST/EXAM weights and serializes per-context adoption ordinals under the school row lock. Earlier draft revisions and adoptions are never rewritten. Adopting a profile only establishes the academic rule available to later result-sheet preparation; it does NOT approve or publish any result or authorize student/guardian visibility.

Private no-store school-super-admin-only GET adoption history and POST, authenticated school-gated owner workspace and navigation added. Synthetic real-session correct/foreign/role denied, duplicate-adoption, no spoofed user, immutability assertions and Node source guard authored but NOT EXECUTED. Additive migration `20261013090000_phase8_result_grading_adoption` NOT applied. D-052/ADR-038. RES-REQ-001 partial, Phase 6/7 and local CI/security/audit gate BLOCKED.


## Phase 8 private teacher result preparation preflight (AUTHORED; NOT PRODUCTION-VERIFIED)

`feature/phase8-result-preparation-readiness` starts the documented RES-REQ-001 result flow at **teacher source preparation**, without skipping HM/Principal academic review or School Super Admin final publication. A private no-store GET and school-gated teacher page use the **existing** independently authenticated exact school/class/subject/session/term CBT score and academically reviewed written-mark readers. The pure reconciliation function compares both active pupil rosters by immutable studentId plus admission number/given/family names; different, extra, missing or duplicate students and invalid counts fail closed instead of joining mismatched records. It reports missing CBT scores, initial manual academic-review gaps, outstanding correction reviews, absence of any source, and the fact that the current grading revision is merely DRAFT_PREVIEW_ONLY, not formally adopted.

All results remain `PRIVATE_PREPARATION_ONLY`, even if the source marks are otherwise complete. No combined mark formula, automatic grade, result-sheet snapshot, report-card table, teacher/HM/Principal approval, publication event, student/parent result route, file download, correct answer or answer key is authored in this slice. Phase 8 must later specify a **versioned adopted grading policy**, approved result sheet snapshots, independent verified SECTION reviews, independent final School Super Admin release and server-validated parent/student visibility, including post-publication correction amendments. Current Phase 6/7 acceptance remains blocked.

Tests added: pure readiness Vitest, synthetic authenticated teacher/wrong-role/foreign-school response and pre/post academic source review cases, Node source invariant guard registered without removing prior suites. **Executed:** 8/8 ad hoc Node smoke tests on byte-identical `result-readiness.ts` Git blob `14194e365a7387f9515a23c764f0d0b544383809`, isolated `tsc --noEmit` on same file, plus previous 5/5 standalone grading smoke on Git blob `1c16de05cbf7cee6e8b369b099c1b46b3798ad7f`. This is NOT full repository CI or actual Vitest. No migration applied or live data used. D-051/ADR-037; RES-REQ-001 partial.


## Scope

Result sheets, report-card generation, approval, publication, and visibility policies.

## Mandatory workflow

1. Teacher prepares assessment and result-sheet data.
2. HM or Principal reviews and approves or returns.
3. Approved data populates report-card records.
4. School Super Admin performs final publication approval.
5. Student and parent access follows the configured visibility policy.

## Publication rules

- HM/Principal approval does not equal final report publication.
- A report card is official only after the School Super Admin’s final approval.
- Corrections after approval or publication must be versioned and auditable.
