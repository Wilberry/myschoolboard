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
