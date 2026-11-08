# Phase 10 catalog and private learning assets checkpoint

LIB-REQ-001 / SEC-REQ-001, P10-04/P10-05; D-023 and the selected Phase 10 analysis.
Base: `66f0a7df0e2c776948c95ce7501726a03994153f`. Existing Phase 10 branch / PR #111.
Whole Phase 10 is still PARTIAL. P10-06/P10-07 and full P10-08 remain outstanding.

## Implemented

Physical books and digital resources have separate immutable catalog kinds,
versioned bibliographic metadata/provenance, independent school-owner review,
explicit release/withdrawal and typed SCHOOL/SECTION/CLASS/STUDENT audiences.
Students require current verified identity and enrollment matching the target.
Guardians and foreign-school actors are denied. Staff catalog access never grants
an asset by itself. Owner-proposed metadata also requires a different owner review.
No lending/circulation, remote fetching or copyrighted fixture is introduced.

The private image workflow separates original quarantine, immutable PENDING and
CLEAN/REJECTED/ERROR inspection evidence, independent rights attestation, and
explicit release. Rights pin the exact catalog-release audience and immutable
asset, record source/license and permitted use, and may expire. Even an owner
proposing an asset cannot attest their own rights. A missing inspection profile
fails closed. PDF, SVG, archives and other active formats remain unsupported.

PNG/JPEG ingress bounds actual multipart bytes before parsing, rejects missing or
foreign public origin, duplicate/unknown parts, unsupported declarations, over
5 MiB inputs and stalled/aborted reads. The trusted configured public origin is
used behind reverse proxies, rather than Next's internal bind URL. Raster checks
require actual format match, single frame, at most 4096 pixels per side and strict
terminal structure; normalization strips metadata into PNG, at most 10 MiB. APNG
control chunks and MPO signatures are denied. Raster inspection is not an
antivirus certification. No email/SMS/WhatsApp/push integration is enabled.

Storage is separate from finance and public/build/Git paths, private and owned by
the process, tenant-namespaced by a hash and keyed by server UUIDs. Exclusive
no-follow writes and no-follow/hash/size/mode/link-count verified reads reject
symlink, hardlink, corruption and cross-tenant paths. Caller filenames are ignored.
Current source/revision authority is checked before storage and after asynchronous
writes. Reads reauthorize after actual private I/O, before returning bytes; rights,
expiry, current author/reviewer, enrollment, catalog withdrawal, asset withdrawal
and supersession all deny. Correcting and then withdrawing an asset never restores
an older asset release. HEAD uses the same authorization; range requests deny.
Responses use private/no-store, attachment, nosniff and CSP sandbox headers.

Twenty proposals per current actor/school/hour is a conservative development quota,
checked before storage and atomically under the school lock. Exact concurrent retry
keys return one durable asset; changed payloads conflict. Rejected/failed immutable
versions cannot become clean by editing their history. New deliberate proposals
are distinct versions. Quarantine and ambiguous orphan files are private and never
served; this slice performs no irreversible orphan/retention deletion. Production
retention, scanner/storage topology and recovery operations remain release gates.

Staff/owner/pupil catalog interfaces expose current approved metadata and only
currently authorized asset links. Curator upload, independent rights review,
explicit release/withdrawal and inspection states are accessible; no public object
URL is returned. Private lifecycle, stale-response, sign-out and fresh print guards
are reused. Optional ISBN and explicit UTC rights expiry fields are supported
without changing the defaults of existing notice/class forms.

## Schema and tests

Five forward-only migrations extend the 66-migration checkpoint to 71:
`20261107234000_phase10_catalog_metadata`,
`20261107235000_phase10_private_learning_assets`,
`20261107235500_phase10_asset_supersession`,
`20261107235900_phase10_library_staff_scope`,
`20261107235910_phase10_current_resource_targets`.
Ten models, composite source/tenant constraints, immutable guards and current
resource predicates are additive. Previously applied migration bytes are unchanged.
All flags default OFF independently of metadata: PHASE10_LIBRARY_ENABLED,
PHASE10_ASSETS_ENABLED and PHASE10_RASTER_INSPECTION_ENABLED. Storage requires
an explicit private root; finance data never becomes a library asset.

Actual executed evidence before the final addendum:

- Authenticated PostgreSQL catalog/asset and real filesystem scenarios passed:
  independent review, four typed targets, immutable history, guardian/foreign
  denial, concurrent exact upload, unavailable inspector, wrong formats and
  polyglots, rights, expiry, post-I/O withdrawal, guarded HEAD/range, owner-proposed
  independent rights, supersession and quota.
- Four initial filesystem/multipart tests passed: normalization/metadata removal,
  path/hash/symlink/hardlink/mode and tenant denials, bounded same-origin parsing,
  duplicate fields and deceptive Content-Length actual-byte overflow.
- Full regression: 207 guards and 467 Vitest tests in 53 files PASS before the
  final two focused reverse-proxy/stale-revision regression assertions.
- Official pinned Prisma JS/WASM schema validation/generation, lint/types/build
  and 71 exact source checksums PASS at the tested snapshot. Standard Prisma
  Rust CLI is still blocked by the recorded binaries.prisma.sh proxy 403; its
  checksum guard was not bypassed.
- New independently inspected tmpfs server
  `ced6a6340ab153f22b39b1ca83064337d4fcbed58279a5bec1202142fe216c81`
  bootstrapped all 69 migrations and passed 69 exact checksums. No original or
  shared database was reset or restarted.
- Seven authenticated native Chromium scenarios PASS, including actual downloaded
  PNG, private headers, independent rights, guardian/foreign denials, history,
  native hidden-tab concealment, three widths/axe, both withdrawal paths and
  unrelated same-school staff denials for class-scoped metadata and bytes.
  [Browser summary](PHASE10_LIBRARY_BROWSER_RESULTS_20261107.json).

Initial browser execution exposed inconsistent dynamic parameter names for two
asset-release routes; their route parameter names were aligned. It then exposed
use of the internal server URL for origin comparison, corrected to the trusted
public configuration. Focused regression tests retain both the reverse-proxy
case and rejection of stale upload revisions before any storage write. No role,
tenant, rights or inspection gate was relaxed. No production/real copyright data,
main merge, deployment, database reset, force-push or Actions were used.

## Remaining acceptance

P10-04/P10-05 now have the implemented local raster/catalog workflow and browser
proof. Broader scanner/storage recovery, pending/orphan operations, full abuse/load,
privileged accessibility/privacy variants and event adapter coverage still require
P10-07/P10-08 and production operations review. The implementation deliberately
never claims an orphan was safely purged. No PDF or external storage provider is
activated to satisfy a test. Existing-module notifications/audit inspection and
learning assignment/submission functionality remain to implement. GitHub API
access is still proxy-blocked; a branch push can update PR #111's source diff but
is not evidence its description/review state was edited.

## Security review and resumption addendum — 8 November 2026

Candidate review identified that a generic staff check could broaden a CLASS or
STUDENT audience. Two forward migrations now require exact current teaching/Form
Teacher/verified section scope for scoped staff readers, preserve only the
owner/curator's specific review/source authority, and require the target itself
to remain active even for owners/curators. No applied migration was edited.
Regression tests deny unrelated same-school teachers and owner/curator access to
inactive targets. Chromium proves actual same-school unrelated staff cannot read
a class-scoped catalog entry or its licensed bytes while the intended pupil can.

Focused regressions also passed for public-origin validation behind an internal
bind address and denying stale upload revisions before storage writes. The latest
focused library/filesystem run passed **23 tests**. An independent fresh server
bootstrapped all **71** migration files and passed **71** exact checksums.
The earlier 69-file bootstrap remains historical evidence, not renamed.

Automatic approval review hit an account usage limit before the documentation
update/commit command executed. Existing work was preserved; resumed inspection
confirmed all three worktrees and disposable servers intact. The interrupted
full-suite log has no completed result and is not counted as a pass. A fresh
full-suite run is in progress; its actual outcome is recorded only after exit.

## Completed resumption verification — 8 November 2026

The fresh resumed cumulative run completed: **207 Node guards**, **471 Vitest
checks in 53 files**, zero failures/skips. The current typed-target version has
**seven passing authenticated Chromium checks**. Formatting, lint, TypeScript,
production build, exact applied checksums and independent fresh **71-file** SQL
bootstrap passed. Strict dependency audit returned **zero vulnerabilities**.
Standard Prisma Rust CLI remains blocked as recorded; official pinned JS/WASM
validation/generation passed. No automatic-approval failure was bypassed. The
prior interrupted full run was not counted. Phases 11 and 12 worktrees remain
unchanged. P10-06/P10-07 and full P10-08 remain outstanding; no main merge.
