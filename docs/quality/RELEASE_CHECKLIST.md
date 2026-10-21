# Release Checklist

Before release, the team must verify:

- Tenant isolation tests pass
- Role and permission tests pass
- Final publication and visibility policies are enforced
- Audit logs and notifications are functional
- Payment verification and retention policies are tested
- Security scans and vulnerability checks are complete
- Backups and disaster recovery procedures are validated
- Documentation remains aligned with the implemented behavior

## Current status

The repository contains a local Phase 1 implementation foundation and draft development PRs, but **no release candidate or deployment**. Local test results do not replace missing production security, operations, and release checks. The full CI-equivalent sequence must be run locally while GitHub Actions is unavailable, including the existing failing `npm audit --audit-level=high` gate; no merge or deployment is approved.

## Phase 1–7 integration merge review — 2026-10-21

The predecessor PR #94 at exact local commit `9eb5e6e` passed
**65/65 Node source guards**, **302/302 Vitest tests**,
**36/36 database migration checksum matches**, lint,
typecheck, production build, and production-only audit
with **zero findings**. Its formatting check **failed**
for the new checksum test file; the next stacked PR
normalizes that test's layout without reducing assertions.
This new formatting change is **not yet locally verified**.

The full strict `npm audit --audit-level=high`
continues to report **five high affected package entries**
from one unpatched, dev-only `braces` vulnerability
in Next's lint dependency graph. No risk exception or
alternate audit gate has been approved. A clean
production-only audit alone does not clear it.

The detailed [Phase 1–7 authenticated-browser security
acceptance matrix](PHASE1_7_BROWSER_SECURITY_ACCEPTANCE.md)
is **PARTIALLY EXECUTED, NOT ACCEPTED**. The
[local browser evidence](PHASE1_7_BROWSER_EVIDENCE_2026_10_21.md)
covers only signed-out and school-B-only negative-access smoke checks. Its required evidence
includes active versus revoked sessions and school membership,
cross-school/verified-section isolation, exact teacher assignment,
student identity binding, no private RSC/browser-history caching
and print/keyboard accessibility. Positive guardian access
is not proven as an implemented Phase 1–7 flow; report
such gaps truthfully rather than calling them passed.

**Do not merge** stacked Phase 1–7 draft branches
into `main` or deploy until current-head formatting/tests/build,
browser release evidence, strict audit remediation or separately
approved security disposition, migration change reconciliation and
explicit owner merge approval are recorded. The standing
non-production development mandate does not imply release approval.

