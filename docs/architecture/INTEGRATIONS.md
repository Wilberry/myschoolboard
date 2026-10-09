# Integrations

## Approved or required integration categories

- Authentication and identity provider
- Email delivery provider
- Payment provider for approved methods
- File storage and document generation service
- Monitoring and observability platform
- Optional SMS/push/WhatsApp channels

## Decision status

No concrete integrations are verified in the repository. All integrations are therefore pending explicit product-owner approval and can be documented as proposed, not implemented.

## Integration safety requirements

- No provider secret may be stored in application records.
- All provider callbacks must be verified and idempotent.
- External integrations must be tenant-aware.
- Payment evidence must remain separate from verified payment status.
