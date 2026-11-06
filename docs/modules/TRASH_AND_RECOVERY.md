# Trash and Recovery

## School-level retention

- School Trash stores deleted items for 30 days.
- Restore is allowed only when the user has relevant scope authority.
- School Super Admin may permanently delete items from school Trash.
- Teachers cannot permanently delete from Trash.

## Platform-level retention

- Platform Trash retains eligible items for 90 days.
- Access is restricted to authorized platform administrators.
- School-level users cannot access Platform Trash.

## Recovery rules

- Recovery operations must be auditable.
- Recovery must preserve tenant ownership and record lineage.
- Expired objects must be purged through idempotent retention jobs.

## Current independent implementation

See [Phase 11 tested scope and policy boundaries](../quality/PHASE11_TRASH_RECOVERY_CHECKPOINT_20261107.md). Never-submitted lesson draft recovery is implemented; protected history is never physically erased, and source-specific Phase 10 adapters remain pending. Platform recovery authorization does not grant academic content access.
