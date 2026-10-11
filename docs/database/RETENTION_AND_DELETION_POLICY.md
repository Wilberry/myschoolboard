# Retention and Deletion Policy

## School Trash

- Items deleted by authorized school users enter the school Trash.
- Retention duration: 30 days.
- Recoverable within authorized scope before expiration.
- School Super Admin may permanently delete items from school Trash.
- Teachers may restore eligible items only within their scope.

## Platform Trash

- Platform-level Trash retains items after school-level deletion for 90 days.
- Only authorized platform-level administrators may access platform Trash.
- School users, including the School Super Admin, cannot access platform Trash.

## Required lifecycle

1. User deletes an item through an authorized workflow.
2. Item is moved to School Trash.
3. Retention job evaluates eligibility and expiration.
4. Expired school items are moved to Platform Trash as approved.
5. Platform Trash expires after 90 days unless a legal hold or approved retention exception applies.

## Constraints

- Retention windows must not become a loophole for indefinite storage.
- Historical academic, financial, and audit records must not be physically deleted in ways that corrupt retention obligations.
- Recovery operations must preserve the object and its ownership metadata.

## Teacher assignment references

- Normal assignment changes use `INACTIVE` or `REVOKED` status transitions, not hard deletion.
- Memberships, classes, and subjects referenced by assignments are protected by restrictive database references and should be deactivated rather than physically deleted.
- School deletion remains governed by the existing tenant-level cascade convention; assignment rows are removed with their owning school. This does not establish any additional legal retention period.
- Assignment lifecycle events are append-only under direct SQL UPDATE/DELETE/TRUNCATE, but are removed by the existing school-level cascade cleanup. No additional audit retention period is defined here.
- By owner decision on 2026-10-10, actor user and membership IDs are retained as immutable event snapshots without foreign keys, so later user or membership deletion preserves the event. School deletion remains the explicit exception and removes school-owned assignment events under tenant cleanup; this does not define any additional retention period.
