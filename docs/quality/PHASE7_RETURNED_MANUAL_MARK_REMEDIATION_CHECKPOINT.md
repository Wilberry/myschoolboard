# Phase 7 Returned Initial Manual Mark — Workflow Remediation Checkpoint

**Date:** 2026-10-12
**Base:** `feature/phase7-reviewed-manual-gradebook`, draft PR #63; cumulative parent PRs #62, #61, #60.
**Candidate:** `feature/phase7-returned-manual-mark-remediation`.
**Requirements:** ASM-REQ-001 / T-ASM-001, TEN-REQ-001, SEC-REQ-001.
**Exit gate:** BLOCKED. Phase 6 and cumulative Phase 7 local test/audit prerequisites remain unverified.

## Corrected development behavior

Initial manual academic review produces an immutable APPROVED or RETURNED event. Before this follow-up, RETURNED marked the initial teacher assessment terminally, but the correction service only accepted APPROVED initial decisions, making RETURNED teacher marks irrecoverable. The UI said "Return for correction workflow" without an available path.

This additive source correction lets the original active same-school TEACHER make a new reasoned changed correction request after **either** terminal initial review. It still requires a current active school/class/section/subject/term/teacher assignment and exact enrolled child/session, no concurrent pending correction, a score different from last approved or original reference, and DB-assigned immutable revision. Both the teacher context and verified PRIMARY HM/SECONDARY Principal correction review queue include such requests.

The approved-only gradebook returns **RETURNED_NOT_APPROVED** before any rework, **RETURNED_CORRECTION_PENDING** after a teacher request (effective approved points remain null) and **APPROVED_CORRECTED** only after the same independent reviewer has APPROVED a correction, with the earlier RETURNED original preserved permanently. Pending and returned marks cannot produce completed grade percentages. No official/student/parent publication.

## Files and verification

- Patched correction SQL predicate in cumulative review-only `20261012360000_phase7_manual_mark_correction_ledger`; immutable history and exact verified section actor guards retained.
- Patched `manual-correction-service.ts` writer/read+review queues, teacher UI display, and approved-only gradebook current-effective SQL/status.
- Added synthetic returned→correction requested→queue→independent APPROVED→gradebook marks, original RETURNED retained test. Updated existing Node correction guard rather than relaxing full Node/Vitest or security audit.
- D-050 / ADR-036, specs, authorization/traceability and roadmap updated.
- **ACTUALLY EXECUTED:** Connector GitHub source/commit operations and one limited eight-file static fetched-source inspection **18/18 assertions passed** for reviewed initial gate, no concurrent pending, reviewer reuse, nullable effective mark, pending states, original retained, tests and existing Vitest runner. This is NOT running tests, compiler, Prisma or PostgreSQL.
- **AUTHORED BUT NOT EXECUTED:** synthetic authenticated database integration tests and Node guard, Next UI/service, SQL migration logic.
- **NOT EXECUTED:** Prisma validation/migrations, local synthetic PostgreSQL direct SQL/race/revocation, full Node/Vitest, format/lint/typecheck, Next build/browser/a11y, `npm audit --audit-level=high`, full local CI-equivalent. Hosted GitHub Actions blocked by billing; no verified disposable DB in connector workflow.

**No merge, deployment, live-user data, irreversible migration, score rewrite, official results release, staff/student access expansion or audit weakening.** Phase 7 remains partially authored, NOT VERIFIED.
