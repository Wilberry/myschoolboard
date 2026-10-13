# Results and Report Cards

## Phase 8 SQL-only future final publication predicate (AUTHORED; NOT VERIFIED)

`assert_result_publication_readiness` is a DB-only precondition for a **future** versioned School Super Admin final publication decision, not publication itself. It locks the active school; reauthenticates exact active owner user/membership and original teacher assignment; verifies latest independently APPROVED primary Head of Section / secondary Principal decision with currently verified exact SECTION grant; checks current class/session/term/subject, latest result evidence and adopted grading version, complete pupil source evidence and mandatory per-pupil positive-weight assessment categories; rejects any source JSONB difference from frozen evidence. A stale prepublication GET or a TRUE from this function does **not** authorize a later INSERT without transactionally rerunning all checks. No result marks/grades/official status are created; no student/guardian endpoint, export, download or publication route exists. D-055/ADR-041. Migration and tests authored only; full local PostgreSQL/security/CI acceptance blocked.

## Phase 8 School Super Admin read-only prepublication snapshot inspection (AUTHORED; NOT VERIFIED)

This internal school owner-only metadata GET inspects **only** the latest APPROVED academic result evidence per class/subject/session/term, with current exact owner/teacher/reviewer scope, current latest school-adopted grading policy, and recomputed sourceManifest equality, including per-enrolled-pupil mandatory grading categories. Returning a candidate is **not** final report approval or official report-card generation. No user-supplied inputs beyond the authenticated school route, no student names, marks, manifest, computed percent, keys, report download, publish button, student/guardian visibility or release event. Revoked section reviewers, changed source marks, or a new school adoption make old snapshots ineligible. This inspection is not transactional publication authorization; a future final publication must independently recheck in SQL under locking and write immutable audited School Super Admin decision. D-054/ADR-040. New tests AUTHORED but no database or CI execution; cumulative Phase 6–8 verification and publication exit gates BLOCKED.

## Phase 8 immutable result-sheet source evidence and independent academic review (AUTHORED; NOT VERIFIED)

`feature/phase8-result-sheet-evidence-review` adds an additive **teacher-prepared frozen source-evidence snapshot** (`ResultSheetEvidence`) and separate **academic reviewer decision** (`ResultSheetReview`). It references one explicit current `ResultGradingAdoption` from the School Super Admin; the teacher may not supply marks, sourceManifest, enrollment counts, policy, actor ID or review outcome. A PostgreSQL BEFORE INSERT function acquires the current School row lock, validates the actual original active TEACHER's exact school/class/subject/session/term assignment, current enrolled roster and latest adopted school policy, and rebuilds a JSONB manifest of current sealed/independently approved/PUBLISHED-not-WITHDRAWN submitted+scored CBT and teacher-written effective marks from initial independently APPROVED decisions or latest independently APPROVED correction revisions. No answer keys, raw student options or speculative marks. Every pupil must have completed source evidence, no duplicate active enrollments, at most 500 pupils, and every positively weighted adopted QUIZ/TEST/EXAM category must have source evidence. This is a **frozen evidence manifest**, NOT a computed official report-card grade or published result.

A snapshot gets a DB-generated per-class/subject/term revision, reason, actor, trusted timestamp and immutable original marks/sources. A second snapshot is permitted **only after prior independent review finishes** and the policy adoption or SQL-computed source manifest actually changed; unchanged duplicates and an outstanding undecided revision fail closed. Independent academic reviewer is a currently active **HEAD_OF_SECTION for PRIMARY** or **PRINCIPAL for SECONDARY**, with a VERIFIED SECTION ScopeGrant for the snapshot's actual active class section, and cannot be the teacher. At review INSERT, SQL repeats current teacher/academic/verified reviewer checks and accepts APPROVED only if the snapshot is the latest and the **current adopted policy and recomputed source manifest still match exactly**. A stale snapshot can be RETURNED so the teacher may prepare a new revision; stale or superseded material cannot be approved. A decision is one-time append-only APPROVED/RETURNED, **not final School Super Admin publication**. No pupil/guardian endpoint, result export, official report-card generation, School Super Admin release or official weighted grade is introduced.

Private no-store exact teacher evidence GET/POST, currently verified-section reviewer queue GET and decision POST, school-gated teacher and academic reviewer screens/navigation, synthetic role/tenant/forged-mark/unapproved/evidence-freeze/return/approved-correction/revision and immutable-history integration tests, and Node structural guards are AUTHORED, NOT EXECUTED. Migration `20261013100000_phase8_result_sheet_evidence_review` NOT APPLIED. D-053/ADR-039. RES-REQ-001 partial; Phase 6–7/full local CI/strict dependency audit BLOCKED.


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
