# Phase 10 learning assignments and submissions checkpoint

P10-06, COM-REQ-001 / LIB-REQ-001 / SEC-REQ-001; D-023. This extends
`674e756` on the existing Phase 10 branch and draft PR #111. Whole-phase
acceptance remains incomplete; do not merge this development checkpoint.

## Implemented behavior and authorization

The school owner explicitly adopts an immutable versioned learning policy with
a validated school timezone. Form tasks, text/image references, late work and
resubmission default off. Original teacher authority pins the actual subject or
explicit Form responsibility, class, session and term. Immutable task revisions
require independent current section review and explicit original-author release.
Publication denies stale policy, elapsed deadlines and revoked source authority.
Due times are entered in UTC and displayed in the pinned school timezone.

Current verified intended pupils read released tasks and append their own text
or previously approved task-image references. The server derives identity and
enrollment. Guardians cannot read or impersonate submissions; foreign schools
deny. Teacher feedback is immutable and restricted to the current exact original
teacher. Returned work may receive a new revision only under explicit policy;
acceptance never writes assessment scores or report grades. Twenty pupil revisions,
three approved references, 20,000 text characters and 100-row keyset feedback pages
bound requests. Source rights intersect task scope per recipient, including after
revocation; attaching an image never broadens its licensed audience.

Private UI/API surfaces reuse lifecycle concealment, abort/epoch stale-response
guards, current authorization and private/no-store responses. Withdrawals revoke
content and submitted-work reads without deleting history. There are no external
providers, raw pupil file uploads, automatic grades or irreversible cleanup.

## Migrations and defect correction

Two additive migrations bring the exact inventory to 73:

- `20261108020000_phase10_learning_assignments`: policies, tasks, immutable
  revisions/events/resources and pupil submission/feedback ledgers with SQL guards.
- `20261108021000_phase10_submission_resource_identity`: qualifies the requested
  asset ID inside the nested submission-resource check. A positive image test
  found that the original unqualified ID rejected an authorized reference. The
  already-applied migration is preserved byte for byte; the correction replaces
  only the function through a forward migration.

An independently verified new PostgreSQL 17 tmpfs database bootstrapped all 73
migrations. The ongoing isolated database upgraded through both migrations with
nonce attestation. No existing database was reset or migration rewritten.

## Actual verification

Eleven real-session PostgreSQL tests pass: owner/default policy, independent review,
concurrent exact retry, guardian/foreign/forged identity denial, return/resubmission,
late policy, Form scope, immutable evidence, withdrawal/current membership,
stale policy/timezone, cursor ownership and positive per-pupil image intersection.
An earlier ten-test cumulative run passed 207 Node guards and 481 Vitest tests
across 54 files, exact 72 checksums, formatting, lint, TypeScript and production
build. The final 73-migration cumulative results are recorded in the verification
addendum below after execution; earlier results do not establish the new gate.

Five authenticated native Chromium workflows passed against the production build:
owner opt-in and author/return/revise/review/release; actual pupil submission and
teacher feedback/resubmission/acceptance; guardian/foreign/identity denial;
native hidden-tab and Back/Forward with 375/768/1280 WCAG A/AA axe checks; and
withdrawal denying both task and submission access. See the adjacent results JSON.
The harness waits for nested private forms and respects actual auth rate limits.
No assertion of persisted BFCache or physical print revocation is made.

## Remaining acceptance and integration work

P10-07 source adapters and authorized audit inspection remain outstanding, including
task/library events. P10-08 must add terminal task identity/enrollment/authority
revocation, delayed task/submission response, sign-out and print scenarios, broad
pagination/concurrency/load/recovery evidence and cumulative integration review.
No Phase 11 workflow is assumed integrated. Raw student file ingestion is disabled;
approved task-image references are the implemented optional attachment path.
Production storage/scanner/retention decisions remain separate release gates.
The standard Prisma binary CLI and GitHub API have previously returned proxy 403;
WASM schema/client verification and Git transport are separate evidence.

Exit gate: P10-06 development implementation verified in the listed scope;
whole Phase 10 acceptance is **PARTIAL**, not ready for main integration.

## Final local verification addendum

The final 73-migration run passed **207 Node guards, 482 Vitest tests in 54
files**, exact applied checksums, formatting, ESLint, TypeScript and production
build. The pinned official Prisma JS/WASM schema/client generator completed
without binary download; this does not claim standard binary CLI execution.
Strict-TLS npm audit with the configured environment CA returned **zero
vulnerabilities at every severity**. The initial inner-container certificate error
and sandbox connection denial were resolved by the normal approved host command
with CA trust; neither TLS verification nor audit severity was weakened.
The source manifest pins the implementation and migration bytes used here.

Remote `main` was read through Git transport on 8 November and remains
`d4459d827e8529ea8daddb73f7e842d8c47c12ab`. Phase 11 and Phase 12 worktrees
remain clean at their published checkpoints. No main merge, production deployment,
database reset, provider send or GitHub Actions run was performed.
