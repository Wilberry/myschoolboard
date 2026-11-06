# Phase 8 cloud completion evidence — 2026-11-06

Status: implementation in verification; NOT accepted or merged yet.

- Requested base: e30a6b0d83c00df80d3eaa0296843e635440374d.
- Reconciliation: e7cd3d3 merges the original incoming parent
  baa1fdf1fee33d003f8e24f1e4c7c68eac1ae46b into checkpoint ancestry. Formatted
  comparisons found most duplicate files equivalent; retained checkpoint
  resolutions preserve main's Phase 1–7 changes, newer dependencies, null-safe
  grading, PostgreSQL reviewer aliases and forward-only band-width repair.
  The merge tree equals the reviewed checkpoint tree. Original local unfinished
  merge is untouched. No force-push or GitHub Actions was used.
- D-061/ADR-047 add recipient publication, school-selected visibility, immutable
  withdrawal, exact-version verified guardian acknowledgment, recipient report
  workspace and owner publication workspace. RES-REQ-001 is under verification.
- Migration: 20261106000000_phase8_recipient_publication (49 total migrations).
- Environment: existing Node 24.22.1, PostgreSQL 17 Compose test service on
  loopback 5434 with tmpfs data; no shared/development/production database used.
- Prisma CLI engine download still gets network-policy 403. Matching official
  npm @prisma/internals and @prisma/client-generator-js 7.10.1 generated the
  adapter-based client via the local WASM schema parser with skipDownload.
  No engine artifacts were used and no checksum, signature or TLS verification
  was disabled. Dependency integrity was verified by npm's normal locked install.
- SQL bootstrap used an explicit pg runner on a newly created disposable DB,
  executing actual migration SQL and recording exact SHA-256 and successful
  application timestamps in migration history. This was NOT prisma migrate deploy.
- Initial baseline: 383/383 Vitest tests, 45 files; focused recipient workflow:
  19/19 integration tests. Typecheck and production build passed before subsequent
  final refinements. All applicable gates must be rerun on final source.
- Fresh recipient fixture uses a new enrolled pupil and independently reviewed
  marks/evidence, owner approval, packet, composition and publication. Existing
  terminally revoked CBT pupil link remains revoked. Private browser fixture
  output is opt-in /tmp/phase8-<run>.json with mode 0600, never committed.
- Browser, accessibility, real PDF and final exact-source results: pending.
- Exit gate: BLOCKED pending remaining verification. main remains aa74a0f.
