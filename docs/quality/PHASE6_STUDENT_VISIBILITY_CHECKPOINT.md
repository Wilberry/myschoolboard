# Phase 6 Verified Student Lesson Visibility — Development Checkpoint

**Date:** 2026-10-12  
**Baseline:** `feature/lesson-approved-release-foundation` (draft PR #47)  
**Candidate:** `feature/lesson-verified-student-release-read` (unmerged)  
**Requirements:** LES-REQ-001, ADM-REQ-001, TEN-REQ-001, SEC-REQ-001.

## Changes authored (NOT validated as production)

- `StudentIdentityLinkEvent` schema and additive `20261012231000_student_identity_links` SQL actor/sequence/one-account-per-student and history protections.
- School admin only `student-links.ts`, private identity mutation API and manual confirmation page; source student and student membership must already exist and belong to the exact school. No inferred name/admission/email match and no automatic student account creation. Revocations are separate immutable events and remain possible for an inactive student membership.
- `student-release-read.ts`: final parameterized SQL joins current authenticated STUDENT membership, latest LINKED event, ENROLLED school-owned student record, ACTIVE started student enrollment in exact class/session and ACTIVE academic term, verified approval and separate RELEASED event for immutable current lesson revision and NOT WITHDRAWN event. Teacher/class/subject assignment and school remain active. Student and guardian role-only access is denied. No export, file download or public API.
- Private no-store `released-lessons` GET and student page. School-admin verification page linked from school student management.
- Synthetic authenticated integration cases added to `review.integration.test.ts` for no link, foreign/teacher denial, school-admin attestation, exact active secondary student/class/session, approval only vs RELEASED, withdrawal, ENDED enrollment, revoked link, forged SQL actor and immutable identity audit.
- D-034 / ADR-020 and LES requirement/status/checklist/exit tracker updated.

## Security caveat

School-administrator attestation is intentionally a **non-production engineering workflow**. Actual minor identity proofing, school consent/data processing, account provisioning/recovery and real-user release policy require separate privacy/business approval. The code does not create or infer links; do not activate against live identities. The current query refuses access without explicit verified link. Historical immutable author, approval, release and withdrawal records are never overwritten.

## Executed versus authored

- **Executed (limited, NOT a test suite):** GitHub-fetched source comparison of seven files against 23 literal code-invariant presence checks. All 23 were observed. This does NOT establish SQL correctness, Prisma validation, authenticated session behavior, concurrency or no data leakage.
- **Authored but NOT executed:** new SQL migration and triggers, review integration scenarios, private authenticated route and browser, Prisma schema and service changes.
- **Not executed:** disposable PostgreSQL migrations, real HTTP/browser, fixture tests, Node invariant script, full Vitest, format/lint/typecheck, Next build, npm audit --audit-level=high, and full local CI-equivalent. GitHub Actions is blocked by billing.
- No merge, deployment, live pupil data, vendor connections or weakened security gate.

## Mandatory local checkpoint

On the explicitly operator-confirmed disposable PostgreSQL database only, verify migration order, Prisma schema drift, School deletion cascade, identity actor validation, same-pupil dual account race, link revocation/membership deactivation, exact enrolled class and term reader, withdrawal behavior, grant revocation and auth transport. Run the unchanged full local CI-equivalent, strict high-severity dependency audit and browser accessibility checks; capture actual command exit codes, counts and tested commit.

**Status: Phase 6 LES-REQ-001 is partially authored, UNVERIFIED. The roadmap phase is NOT COMPLETE.** Schemes-of-work planning and the entire cumulative local CI-equivalent gate remain outstanding.
