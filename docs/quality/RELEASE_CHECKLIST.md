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
