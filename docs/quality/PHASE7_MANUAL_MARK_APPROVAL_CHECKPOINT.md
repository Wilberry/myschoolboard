# Phase 7 Initial Manual Mark Approval Checkpoint — 2026-10-12

**Base:** feature/phase7-manual-mark-proposals (#60). **Branch:** feature/phase7-manual-mark-section-approval.
**Requirements:** ASM-REQ-001, TEN-REQ-001, SEC-REQ-001. **Exit:** BLOCKED.

**Authored:** Prisma ManualMarkReviewAction/AssessmentManualMarkDecision, school/proposal/reviewer composite FKs and unique proposal decision; additive migration 20261012350000_phase7_manual_mark_section_approval, reusable SQL verifier `assert_manual_mark_section_reviewer`, school lock, verified exact SECTION grant HM PRIMARY/Principal SECONDARY, current active original teacher/assignment/term/ENROLLED pupil/ACTIVE enrollment, no self-review, terminal APPPROVED/RETURNED and immutable DML/TRUNCATE. Private no-store reviewer queue final SQL joins, transactional approval API, restricted reviewer UI and school nav; synthetic session/actor/duplicate/tamper test and Node guard. D-047/ADR-033.

**Executed:** Connector read/write and source inspection only; no Node/Vitest/PostgreSQL/Prisma runtime execution, no migrations applied. **Authored but NOT executed:** new migration/triggers, Next API/UI, synthetic Vitest and Node source guards. **NOT executed:** npm ci, Prisma validate/generate/migrate, SQL actor/revocation/races/rollback, whole Node/Vitest, format/lint/typecheck, build, browser/a11y, strict npm audit --audit-level=high or agreed full local CI-equivalent. GitHub Actions billing remains blocked and Phase 6 predecessors unverified.

**Security and limits:** no live data, release, merge, deployment, new cross-school access, official grade publication or security exception. Reviewer choice does not overwrite initial marks; original history preserved. Corrections and approved-only gradebook are separate append-only subsequent slices.
