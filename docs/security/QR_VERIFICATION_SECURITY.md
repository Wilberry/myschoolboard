# QR Verification Security

## Requirements

- QR verification tokens must be opaque and unlinkable to private report-card content.
- The QR token must not contain a student’s data, results, guardian details, or credentials.
- Verification checks must respect revocation, replacement, and supersession rules.

## Public behavior

The public verification endpoint may show minimal information such as:

- issuing school name
- report reference
- session and term
- validity status
- revoked or superseded state

No private student, guardian, or score details should be exposed by default.
