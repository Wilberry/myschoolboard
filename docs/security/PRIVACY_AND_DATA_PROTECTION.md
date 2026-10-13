# Privacy and Data Protection

## Phase 8 published pupil reports — development security boundary (2026-10-13)

The new result publication and guardian-first receipt implementation is **source authored but not deployed, migrated or runtime-security accepted**. Signed-in parents/students never receive raw private source packets, CBT answer keys, internal marks or unrelated pupil listings. The only recipient-grade query selects current same-school role and exact verified enrollment/attested student or unrevoked guardian relationship, newest owner-released official subject version and still-current explicitly school-adopted visibility mode, with a bounded allowlisted projection. No child identifier or search parameter is accepted from a recipient, and all new report endpoints use private no-store/noindex headers. Guardian-first is opt-in per school: a guardian's exact-released-subject receipt is immutable and student access still requires their own active verified pupil account. No universal parent-first school default; school ownership, membership and policy remain separately checked.

The deployment switches `PHASE8_REPORT_RELEASE_ENABLED` and `PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED` are **false unless explicitly enabled** after disposable-PostgreSQL test/CI/security/privacy review. The printable report operates in the authenticated browser; saving it as PDF creates a copy outside the server's access controls. There is no public report link, QR, static file or supported server download. The project must assess retention, confidential print handling and Nigerian child privacy obligations before real release. D-063/ADR-049.


## Privacy principles

- Collect only necessary personal and operational data.
- Keep guardian, student, and payment data strictly scoped.
- Protect children’s educational records and financial data.
- Give schools and users explicit visibility and retention controls.

## Legal and compliance note

This project must cooperate with Nigerian data protection expectations and future cross-border expansion requirements. Formal compliance review remains a professional legal and compliance function, not a documentation-only guarantee.
