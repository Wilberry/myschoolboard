# Threat Model

## Threat categories

- Cross-tenant access attacks
- Authentication bypass
- Role escalation
- Stale or forged records
- Payment fraud and duplicate callback attempts
- QR token abuse
- Malicious file uploads
- Data leakage via exports and notifications

## Mitigations

- Server-side auth and authorization checks
- Database constraints and transactional invariants
- Token validation, hash verification, and revocation handling
- Rate limiting and verification checks
- Secure file and upload processing
- Monitoring, audit, and incident response
