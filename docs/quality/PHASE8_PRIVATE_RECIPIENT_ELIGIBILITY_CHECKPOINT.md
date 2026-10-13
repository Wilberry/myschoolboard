# Phase 8 — Private Recipient Eligibility Evidence (No Result Access)

**Date:** 2026-10-13
**Branch:** `feature/phase8-private-recipient-eligibility-evidence`
**Base:** `feature/phase8-verified-guardian-relationships` at `4fd2ba286540508fd1f04ed983f7d9b9889831a5` (unmerged).
**Scope:** RES-REQ-001 partial; TEN-REQ-001/SEC-REQ-001 partial; P-004 guardian-first acknowledgment undecided.
**Exit:** **AUTHORED / NOT RUNTIME VERIFIED / NO REPORT RECIPIENT ACCESS**.

## Why this is the next safe roadmap slice

Existing work established teacher-written and CBT marks, frozen academic reviewer evidence, current School Super Admin final result preparation, immutable private grade compositions, school-configurable visibility intent, private release preflight and exact verified STUDENT/PARENT relationship evidence. This milestone allows the school owner to record a separate **historical per-recipient eligibility observation for a specific pupil's unreleased report**, without inventing official publication rules while P-004 and the cumulative quality gates are unresolved.

## Authored implementation

- Prisma `ResultRecipientEligibilityEvidence` and new additive `20261013210000_phase8_private_recipient_eligibility_evidence` migration (no historical migration edited). A record binds exact school, private composition, enrolled pupil, recipient school membership, corresponding existing internal preflight, latest adopted recipient visibility policy and exact unrevoked student account link or most recent immutable guardian VERIFY event. Same-school FKs and an exact composition/pupil/member/policy/proof UNIQUE forbid cross-tenant joins or duplicate review for unchanged evidence. SQL-derived role/version/proof/status/time and immutable UPDATE/DELETE/TRUNCATE triggers preserve history.
- BEFORE INSERT PostgreSQL locks the active School, rechecks exact active same-school School Super Admin actor, invokes the existing locked `assert_result_publication_readiness` on the selected private evidence, denies superseded grading-scale/aggregation revisions, requires the **latest explicitly adopted non-ASSESSMENT_ONLY visibility policy**, validates a matching already recorded private release preflight and current active email-verified role-appropriate account, invokes the existing `inspect_private_report_recipient_relationship`, and binds the exact unrevoked STUDENT link ID or latest guardian VERIFY-event ID. Missing/revoked evidence and stale policy fail closed.
- Protected columns have invalid interim defaults and SQL CHECK conditions so an unset recipient role, blank proof/preflight/policy ID, or a false publication-like status cannot be stored. A current successful internal observation always has status **`INTERNAL_RECIPIENT_RELATIONSHIP_ONLY_NOT_ACCESS`**. Records are audit evidence, **not permission tokens**; release/relationship must be rechecked on every future recipient request.
- Strict authenticated current-owner-only SERIALIZABLE POST accepts only `compositionId`, `studentId`, `recipientMembershipId` and an audited reason; user/proof/policy/status are SQL or session derived. Owner-only, bounded no-store GET and POST responses expose policy revision/recipient role/composition reference/internal status/timestamp only; **no pupil ID, recipient membership ID, relationship proof ID, per-pupil grade JSON, marks, PDF or report download**. Server-guarded School Super Admin page/UI and navigation emphasize *no release*.
- Authored Vitest synthetic integration cases for forbidden school roles, cross-tenant input, forged grades/publication and version fields, wrong recipient role, exact student/guardian current proof and duplication, revoked student link and inactive guardian denial, immutable update/delete/truncate, inactive owner denial and strict response privacy. Added `scripts/phase8-private-recipient-eligibility-guard.test.mjs` to BOTH existing test/local guard commands, without removing any existing checks or modifying GitHub Actions.
- D-064 / ADR-050, result module specification, authorization, traceability and milestone/status documentation updated. Nothing was changed on `main`, deployed or released; branch has no PR.

## Verification evidence and limits

- **Actually performed:** GitHub connector branch/commits/source reads. **46/46 focused GitHub-fetched source invariants** passed (schema reverse relations, SQL lock/current policy/preflight and exact proof, unique+immutable history, metadata-only API, no release, owner gate and registered tests).
- **Actually performed:** isolated V8 replay against exact fetched Node source of the three new guard cases with mocked Node file reads — **3/3 passed**. This is **NOT** the project `node --test`, actual Prisma/SQL compilation, PostgreSQL migration or Vitest. The authored integration cases have **not** run.
- **Not run:** PostgreSQL cumulative migrations/concurrency/revocation/parity/rollback, Prisma validate/generate, real Node/Vitest suite, Prettier/lint/typecheck/Next build, dependency security audit, browser tests, full quality gates or GitHub Actions. No disposable, shared or production school DB accessed. Existing cumulative verification blockers remain unchanged, and no tests were waived.
- **Owner preference preserved:** do **not run or inspect GitHub Actions** now. This development used only normal GitHub repo file/branch operations, with no PR opened, no workflow changed and no `main` push.

## Next roadmap direction

Validate the full cumulative Phase 6–8 implementation on a confirmed disposable loopback PostgreSQL service and pass all Prisma/Node/Vitest/build/audit gates before any report release. The unresolved P-004 parent-first acknowledgment rules must be explicitly settled before recipient publication and must not be inferred from guardian verification. A future separately authorized release decision MUST independently rerun current academic/owner/visibility and per-student relationship checks; future student and guardian report readers MUST verify the actual logged-in recipient and current release on each request, not accept any preflight or eligibility record as a bearer token.

**End state:** immutable internal eligibility review only. **No result publication, parent/student report route, PDF/export, `main` merge, CI run or deployment.**
