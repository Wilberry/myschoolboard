# Phase 9 — Cloud integration and local acceptance, 6 November 2026

## Scope and history

FEE-REQ-001 / T-FEE-001, roadmap Phase 9, D-023 and D-P9-009.
The owner's current task authorizes development integration and local verification,
not production deployment or live financial processing.

- Existing remote foundation: `f9f4ff3819c7b2f0fcc1bab47253b64e7ff5f9fd`.
- Accepted Phases 1–8 remote main: `83676cf9dcae2d416df991956e3dfa411b8ac6a0`.
- Dedicated branch: `integration/phase9-after-phase8-cloud-20261106`.
- Reconciliation merge: `442f5678e9455e50ba17fc6e5af21b8fd5dd8060`.
  Both histories remain ancestors. Conflicts retain current main's dependencies,
  all accepted Phase 8 schema/models/routes/tests and additive Phase 9 models,
  scripts and historical documentation. No history rewriting or force-push.

## Completed implementation

- School/category/session/term/scope fee revisions and explicit enrolled-pupil
  charges preserve the original foundation and immutable debt snapshots.
- Administrator reference claims and bounded private PNG/JPEG supporting images
  remain uncredited evidence until independent owner bank-reference review.
- Owner allocation is exact and once-only, including concurrent retries and after
  reversal. A duplicate-source service defect returning an incorrect conflict
  classification was resolved without weakening the existing assertions.
- Approved waiver proposals require an explicit separately authorized application.
  Reviewed-money/waiver caps serialize under the school lock. Advisory correction
  proposals never silently reprice charges. Full approved allocation reversals
  append history; they do not send funds or make source evidence reusable.
- Exact NUMERIC balances distinguish charge, applied waiver, gross allocations,
  approved reversals, net allocations and remaining debt. No JavaScript float
  accounting; money crosses the API as exact minor-unit strings.
- Immutable owner-issued school receipts acknowledge independently reviewed manual
  allocations. Reversed allocations visibly invalidate receipt accounting effect.
  No provider certification, bank settlement or actual refund is represented.
- Explicit versioned publication/withdrawal and four recipient visibility modes.
  Current active school/member/enrollment and independently verified student or
  guardian identity authorize each row. Foreign tenants, teachers, unrelated or
  revoked identities cannot read accounts or receipts.
- Owner-only reports aggregate the complete ledger by period and currency; private
  CSV exports escape spreadsheet formulas. Admins have original charge submission
  targets and their own evidence/requests, without owner financial reports.
- Real finance and recipient pages include role-specific forms, receipts, balances,
  exact currency formatting, accessible scroll regions, visible focus and touch
  controls. Privacy handling clears stale data on blur/hidden/lifecycle/sign-out,
  rejects delayed responses, rechecks foreground access and guards printing.

## Database boundary and migrations

The preexisting PostgreSQL server at port 5433 was left untouched. Verification
used a new PostgreSQL 17-alpine container `phase9-cloud-postgres-20261106`, ID
`0527a75f9ba3feaee0002295535ef00256cbcd3f56c1ab57765824bc30afdcb8`, with new
**tmpfs** storage, no existing mounts, loopback port 5434 and database
`myschoolboard_test`. Its fresh empty origin and private nonce marker were
independently verified. Credentials and nonce remain outside the repository in
0600 files. Every financial fixture suite and browser runner performs live
read-only nonce attestation before enabling any finance flags.

The psql verifier now uses discrete validated PGHOST/PGPORT/PGDATABASE/PGUSER/
PGPASSWORD after clearing inherited libpq options; the original PGDATABASE URI
incorrectly selected a Unix socket. Secrets never appear in argv or output.

All **49 accepted main migrations** and **7 original Phase 9 migrations** are
byte-for-byte preserved. Two new forward migrations add:

1. `20261106210000_phase9_financial_accounts_receipts` — release ledger, exact
   balance view, current recipient authorization function and immutable receipts.
2. `20261106220000_phase9_private_payment_attachments` — immutable private image
   metadata, same-school/current-submitter/pending-review SQL authorization.

The cumulative chain contains **58 migrations**. First the original 56 were
applied to the new nonce-attested database, then both forward migrations.
Exact applied SHA-256 checksums pass for all 58. No applied migration was edited.
A separate **new, unexposed tmpfs container**, ID
`dc41fe00bccd65a479cdbefbada87b97e2322d7c05db65a6cd0b79bcfe142d94`,
`phase9-empty-7db62ffc-66b1-4da6-9edf-b18bb42dd9ed`, independently passed empty
bootstrap and checksum verification for all 58 migrations via the create-only
`scripts/verify-phase9-fresh-bootstrap.mjs`. Existing databases were not reset.

## Executed local checks

| Check | Actual result |
| --- | --- |
| Locked dependency installation (`npm ci`) | PASS |
| Live read-only disposable nonce preflight | PASS |
| Official Prisma 7.10.1 WASM schema validation | PASS, 83 models, required Phase 8 and Phase 9 models present |
| Official Prisma in-process JS client generation | PASS; official pinned generator, skipDownload, driver adapter runtime |
| Fresh full SQL bootstrap | PASS, all 58 migrations |
| Exact applied migration checksums | PASS, 58 exact applied migrations |
| Synthetic seed and repeated seed | PASS twice, no database reset |
| Repository Node guards | PASS, 207 tests, no skips |
| Full Vitest regression | PASS, 48 files / 414 tests, no skips |
| ESLint / TypeScript / Prettier | PASS |
| Next.js production build | PASS |
| Strict dependency audit (`npm audit --audit-level=high`) | PASS, zero vulnerabilities |
| Real authenticated Chromium browser acceptance | PASS, all 11 scenarios below |
| `git diff --check` | PASS |

Rust Prisma CLI downloads are still denied by the running proxy at
`binaries.prisma.sh` (HTTP 403). Standard `npm run db:generate`, CLI migrate deploy
and the CLI-dependent cumulative wrapper are **not reported as passed**.
Schema validation/generation used official Prisma JS/WASM packages; SQL execution
used PostgreSQL directly with exact successful migration records/checksums.
No checksum bypass variable, fabricated pass, migration reset or GitHub Actions
was used. This is a documented tool-path limitation, not skipped financial SQL,
authorization, bootstrap or regression verification.

## Real browser acceptance

Runner: `scripts/verify-phase9-browser.mjs`; summary:
[PHASE9_BROWSER_RESULTS_20261106.json](PHASE9_BROWSER_RESULTS_20261106.json).
Isolated newly enrolled synthetic pupils and independently verified identities
were used. Terminal revocations were never restored. Failed harness iterations
used fresh fixtures; they did not overwrite existing immutable financial history.

| Scenario | Result |
| --- | --- |
| Owner-issued charge; admin reference claim remains uncredited; no implicit publication | PASS |
| Private image upload; owner retrieval; recipient denied; no automatic credit | PASS |
| Independent bank review, allocation, approved receipt and explicit recipient publication | PASS |
| Proposal approval has no effect until waiver application; exact remaining balance and owner-only CSV | PASS |
| 375px layout, keyboard access, WCAG A/AA axe checks for owner and recipient | PASS, zero violations |
| Native Chromium tab blur/focus, synchronous concealment, fresh access, PDF receipt/balance and no-permit print denial | PASS |
| Admin reversal request and independent owner approval; corrected balance and reversed receipt warning | PASS |
| Owner withdrawal removes recipient accounts/receipts; new explicit publication restores authorized release | PASS |
| Actual cross-tab sign-out, delayed pre-sign-out response rejection, no stale data after next poll, signed-out API 401 | PASS |
| Actual terminal guardian-link revocation; current API and foreground poll concealment; revoked PDF has no receipt | PASS |
| Terminal synthetic owner membership deactivation; workspace/report 404, foreground concealment and print redaction | PASS |

The native lifecycle tests use ordinary headful Chromium connected with
`noDefaults:true` under Xvfb. Standard automation's forced-focus behavior is not
used to claim real tab visibility acceptance. `window.print` is intercepted only
after the actual fresh-read Print control to capture Chromium PDF output, verified
with `pdftotext`. Direct/no-permit and revoked print paths are concealed.
HTTP response observation forwards actual upstream bytes/status/headers unchanged;
it does not fabricate financial responses or bypass application authorization.

## Financial and privacy evidence

Original 14 Phase 9 database tests and the new 12 account/workflow integration
scenarios cover real BetterAuth sessions and PostgreSQL, including strict input,
tenant/role/current-identity denial, default-off flags, direct SQL integrity,
immutable source history, invalid waiver/correction decisions, exact replay,
concurrent allocation/verification/waiver caps, receipt independence and reversal,
all visibility modes, current membership/school/enrollment checks and terminal
student/guardian revocation. Three money/CSV tests cover exact values above the
JavaScript safe-integer limit, currency precision and formula injection.

Uploads enforce a same-origin multipart boundary, bounded stream before parsing,
no caller paths or URLs, decoded MIME and dimensions, normalized metadata-free PNG,
private directory/file ownership and modes, no-follow file reads, content hash,
current scoped authorization before and after I/O, attachment disposition and
private no-store/nosniff/CSP responses. Invalid, oversize, mismatched and unauthorized
uploads/downloads are tested. Image inspection is not antivirus certification.

No unresolved financial security or privacy failure remains in executed local
acceptance. All eleven feature flags remain OFF in `.env.example`.

## Limitations and exact integration status

- Development manual school accounting only: no live payment provider, automated
  banking, provider settlement certification, external refunds or production release.
- Correction proposals remain advisory; arbitrary repricing, partial/reopened
  reversals, waiver undo and reusing reversed verified evidence need a separately
  specified append-only policy. No such operation is silently performed.
- Private image storage is a single-node filesystem adapter. Production topology,
  backup, retention and deployment hardening remain production work.
- Worklists are bounded to 200 recent entries, options to 600; reports and account
  amounts use complete ledgers. Already exported paper/PDF cannot be recalled.
- `api.github.com` is denied by the current proxy. Normal GitHub PR creation and
  merge cannot be completed through that API in this runtime. The owner explicitly
  authorized publishing verified branch/commit details for a separate PR step if
  API access remains unavailable. Do not bypass this with a direct main push.

**Local Phase 9 acceptance: PASS. Development PR integration: pending external
GitHub workflow. Production deployment: not performed or authorized.**
At the last remote verification, `main` remains
`83676cf9dcae2d416df991956e3dfa411b8ac6a0`. No Phase 9 merge SHA exists yet.
See the final verification addendum for committed implementation and published
branch SHAs. No GitHub Actions, forced push, existing-data reset or production
operation occurred.

## Final verification addendum

Verified implementation committed as
`87e2bb5c8b733773beefd6f80c43f0a7b2303b8e`.
Both `83676cf9dcae2d416df991956e3dfa411b8ac6a0` and
`f9f4ff3819c7b2f0fcc1bab47253b64e7ff5f9fd` are confirmed ancestors.
The final full regression after the origin/accessibility fixes passed all
207 guards and 414 application tests in 48 files. Final lint, type checking,
format checking and diff whitespace checks passed. The browser summary's
`source` field is the then-current pre-commit HEAD `442f567...`; the tested
implementation was in the working tree and is now preserved in `87e2bb5...`.
It is not represented as a browser execution against a previously nonexistent
commit. Subsequent evidence/PR-description commits change documentation only.

The branch is ready for the normal development PR workflow on local acceptance.
The remaining integration step is external GitHub PR creation/review/merge;
no Phase 9 main merge has been performed, and no merge SHA is claimed.
