# Phase 8 — Confidential Multi-Subject Term Preview for One Pupil

**Date:** 2026-10-13
**Feature branch:** `feature/phase8-private-term-grade-preview`
**Base:** `feature/phase8-private-owner-grade-preview` (unmerged).
**Requirements:** RES-REQ-001 (partial), TEN-REQ-001 (partial), SEC-REQ-001 (partial).
**Decision:** D-066 / ADR-052.
**Exit:** **AUTHORED / FULL RUNTIME AND OFFICIAL PUBLICATION BLOCKED.**

## Roadmap rationale and safe scope

Earlier Phase 8 cumulative work authored internal school-specific grading weights, immutable teacher-prepared source and section approval, School Super Admin prepublication review, school-adopted grading scales and aggregation rules, immutable per-subject private grade compositions, recipient visibility intent and verified account relationships. The preceding milestone implemented an audited one-pupil **single-subject** grade preview. This checkpoint builds the next independently useful private school-administration step: viewing **that one pupil across multiple assigned term subjects** for prepublication inspection.

The school curriculum has **not** yet adopted a versioned `official term subject coverage` policy. Thus this new preview is intentionally labeled `ACTIVE_SESSION_ASSIGNMENTS_ONLY_NOT_OFFICIAL_COMPLETENESS`: the distinct currently ACTIVE exact-session teacher assignment subjects are only a bounded, temporary coverage scope. This cannot certify a complete official report, calculate rankings or promotion, or allow a recipient download. P-004 parent-first acknowledgment is still undecided.

## Authored implementation

- `src/modules/results/private-term-grade-preview-service.ts`: Strictly parse exact `sessionId`, `termId`, `classId`, `studentId` and 5–500 character `reason`. Resolve current session identity with `assessmentUserId()`, require exact active same-school `SCHOOL_SUPER_ADMIN` membership and lock active School inside a SERIALIZABLE transaction (`maxWait: 5000`, `timeout: 30000`). Verify exact AcademicTerm in session, active SchoolClass and matching actively enrolled `StudentRecord`. No actor/mark/policy/recipient selection by browser.
- Select distinct ACTIVE `TeacherClassSubjectAssignment` subjects in the exact school/class/session and active Subject, sorted deterministically and bounded by 100 distinct subjects (internal transaction-safety bound, **not school curriculum policy**). Deny no subjects or an overflow. Require a private `PrivateOfficialReportComposition` per expected subject, choose the newest evidence revision and **deny ties** to avoid ambiguous approved evidence.
- For EACH subject in the same transaction, call the existing VOLATILE `read_private_owner_one_pupil_grade_preview` SQL function (already part of the prior migration). That function independently rechecks current School Super Admin + original teacher + current independently verified Primary Head of Section/Secondary Principal approval, current adopted grading/aggregation, exact frozen source manifest/class roster, recomputes all class grades for parity, projects only the requested pupil and **inserts immutable `ResultPrivateGradePreviewAudit` before returning**. A failed/missing/stale subject or failed audit raises inside the outer transaction; **all** subject previews/audits roll back. The caller receives neither partial subject grades nor partially committed audit history.
- Only after all selected subject previews match the same pupil's identity and exact academic session, term and class does the service return `PRIVATE_TERM_OWNER_PREVIEW_NOT_RELEASED`, subject count/audit count and a narrowly allowlisted per-subject grade/remark/percent and version summary. There is no official term mean, ranking, pass threshold, promotion or recipient entitlement.
- New `POST /api/schools/[schoolId]/private-term-grade-previews` route: no GET, strict JSON, no query string, rejected foreign Origin, `Cache-Control: private, no-store`. Current-owner server-gated UI `app/schools/[schoolId]/private-term-grade-previews/page.tsx` and `src/components/private-term-grade-preview-workspace.tsx` display confidential student/term identifiers and a subject table with emphatic `NOT RELEASED` and incomplete-curriculum warnings. Restricted School Super Admin navigation added.
- New integration tests in existing `src/modules/assessments/questions.integration.test.ts` deny teacher, pupil, parent, HM, Principal, administrator and foreign tenant; reject forged publishing/grade fields, mismatched Origin, terminated enrolment, revoked owner; check one successful synthetic subject returns metadata-only pupil grades with one DB audit, then create a synthetic second active assigned subject lacking approved evidence and assert the whole call returns conflict with **no additional audit**. Fixture cleanup is explicit.
- Registered `scripts/phase8-private-term-grade-preview-guard.test.mjs` in both existing `npm test` and `verify:local:guards` without removing any prior guard, changing CI workflow or adding migration. Updated decision log, ADR, milestone, status, authorization, result module and traceability documents.

## Verification: separate facts from claims

- **Already executed:** GitHub connector branch/file commits and exact source fetching. The new Node-style structural guard's four cases passed **4/4 in isolated V8 replay with mocked Node file reads** on initial source. This verifies source assertions only.
- **Authored but NOT run:** Vitest PostgreSQL synthetic tenant/grade/audit rollback scenario. It cannot substantiate transaction semantics until executed.
- **NOT run:** real `node --test`, Prisma validate/generate, cumulative Phase 6–8 PostgreSQL migrations/transactions/rollback, Vitest, TypeScript/ESLint/Prettier/Next build, browser tests, `npm audit --audit-level=high`, or GitHub Actions. No test/shared/production school database was accessed.
- **Owner instruction:** Do not run or inspect GitHub Actions. This branch is non-default and has no new PR, merge, deployment, public grade or recipient report reader.
- No previous Phase 6–8 verification gate was removed or waived. Official publication and any student/guardian grade access remain blocked.

## Next roadmap checkpoint

The next independently safe Phase 8 design/development slice is a **versioned school-adopted official subject coverage/completeness policy** for exact class/session/term (rather than inferring an official report curriculum from teacher assignments), still without enabling release. Full cumulative PostgreSQL/Node/Prisma/build/audit acceptance and the final P-004 parent-first acknowledgment rules must precede any separately audited School Super Admin actual publication or authenticated student/guardian report access.

**End state:** confidential owner-only multi-subject preview AUTHORED. No official report, public result, parent or pupil report reader, PDF/export, PR, `main` change, deployment or GitHub Actions operation.

## Final source-only validation checkpoint (2026-10-13)

- At the latest audited feature-branch source, **37/37 independent source assertions** passed: exact active-school/Super Admin authorization, matching pupil+term/class, distinct active teacher assignments, bounded subject scope, newest unique private source per subject, reuse of atomic audited one-pupil SQL, no external source/mark projection, owner-gated no-store POST, no release, explicit provisional completeness label and all existing test registrations.
- The new Node-style structural guard passed **4/4 cases** when its exact fetched source was executed through isolated V8 with mocked Node filesystem reads. A stale source-string assertion for the updated safe optional SQL-result narrowing was corrected and retested. This is not the actual Node runner and says nothing about PostgreSQL or TypeScript acceptance.
- Diff against the previous branch shows **16 files, no `.github/workflows/` changes**, no new database migration, and no report-card recipient route. The branch remains unmerged; no PR was opened and **GitHub Actions were neither run nor inspected**.
- **Still blocked:** actual Prisma/PostgreSQL migration/transaction/revocation/rollback verification, `node --test`, Vitest, typecheck, lint, format, application build, dependency vulnerability audit, school-adopted official subject coverage, P-004 acknowledgment and any report release/deployment.
