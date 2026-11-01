# Phase 6 Completion and Exit Tracker — 2026-10-12

## Current culmination — verified student binding and typed schemes (candidate)

- Added `feature/phase6-verified-student-lesson-access` on top of lesson release PR #47. Exact one-to-one administrator-attested enrolled StudentRecord ↔ ACTIVE same-school STUDENT Membership binding (terminal immutable revocation) and authorized private released lesson index/detail are now **authored**.
- LES-REQ-001 student access is restricted to signed-in STUDENT identity, unrevoked verified link, active school/student/enrollment/class/session/term and current approved RELEASED / NOT WITHDRAWN lesson revision. No name/email matching or blanket student rights.
- Schemes of work are typed week-ranged planning records `SCHEME_OF_WORK` sharing exact teacher assignment, revision, section review and independent release/withdrawal. Existing notes retain `LESSON_NOTE` type, no content history rewritten.
- New private school administrator/student pages and synthetic tests for binding, wrong class, revocation, term closure and schemes have been **authored but not executed**.
- Limited 12/12 GitHub-fetched source-consistency checks passed; not a Prisma migration, Node/Vitest test or CI result.

**Implementation coverage:** ATT and LES major workflows are now represented in cumulative code. **Completion and exit gate: BLOCKED** until disposable PostgreSQL migrations/DB concurrency and tenant cases, actual authenticated Vitest/HTTP/browser/accessibility checks, unchanged local CI-equivalent, and strict `npm audit --audit-level=high` pass on one exact commit. GitHub Actions billing remains blocked. Do not declare Phase 6 complete, merge/deploy or begin Phase 7 production use.


## Authoritative roadmap scope
Phase 6 (Attendance and lesson planning) covers ATT-REQ-001 and LES-REQ-001. Features alone do not satisfy exit; prior Phase 2/4/5 tenant, enrollment and teacher-assignment prerequisites and the unchanged SEC/TEN/OPS checks also apply.

| Acceptance area | Cumulative authored implementation | Executed evidence / blocker |
| --- | --- | --- |
| ATT exact Form Teacher full-class/session roster | #39–#44, immutable register, exact active enrollment, audit and SQL full-roster guard | Synthetic tests authored, DB migration unexecuted; role/concurrency tests pending |
| ATT HM/Principal section-scoped review | #40–#41 | Author-only tests, no executed real DB/HTTP |
| ATT corrections and durable history | #42–#43 | Revision overlay + auditor reason authored; no executed DB/HTTP |
| ATT school timezone and correction window | #45 | 12 pure-module Node smoke checks executed (not complete Vitest); SQL migration unexecuted |
| ATT explicitly configured teaching/holiday days | New #46 candidate | Additive per-date non-teaching school-admin revision, SQL guard, UI, synthetic tests authored; none executed |
| LES teacher authoring/immutable revisions | Earlier unmerged cumulative lesson notes | Complete integration/browser/DB verification outstanding |
| LES HM/Principal review | Earlier unmerged cumulative section review | Complete integration/browser/DB verification outstanding |
| LES approved note release | #47 authored immutable separate release/withdrawal | Unexecuted PostgreSQL and HTTP acceptance |
| LES authorized pupil/class/period viewing | New verified student-account-binding and exact released revision reader authored | Unexecuted SQL/identity proof/tenant and authenticated session tests |
| LES schemes of work | Typed week-ranged schemes reuse immutable revision/review/release | Unexecuted migration, teacher/reviewer/student acceptance tests |
| Phase 6 quality gate | Full unchanged local CI-equivalent, audit and real HTTP/browser verification | GitHub Actions blocked by billing; no disposable PostgreSQL supplied to this GitHub-only execution context |

**Phase 6 status: IN DEVELOPMENT; NOT COMPLETE; NOT RELEASE-READY.** No production action, live data, merge, migration application or test-result fabrication.

## Next required gate

No further Phase 6 feature is safe to declare accepted solely from authorship. The next checkpoint must execute the complete **existing** local CI-equivalent process on an owner-confirmed disposable PostgreSQL environment and remediate any schema/SQL/authorization/browser/audit failures. A production student-membership provisioning workflow, administrator evidence policy and documented correction/relink lifecycle remain open prerequisites/policy decisions; **do not infer or bulk-link pupils**. The Phase 6 gate remains BLOCKED until these are resolved and acceptance evidence is attached to the exact tested commit.
