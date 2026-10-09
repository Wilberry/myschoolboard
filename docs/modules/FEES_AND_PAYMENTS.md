# Fees and Payments

## Scope

Fee structures, amounts, obligations, payment evidence, verification, receipts, and reconciliation.

## Key requirements

- Payment evidence is distinct from verified payment status.
- Bank transfer upload does not constitute automatic confirmation of funds.
- Payment processing must be idempotent and auditable.
- Payment provider secrets must never be stored in application records.

## Critical states

- Submitted
- Pending verification
- Verified
- Rejected
- Refunded
- Reversed

These must remain explicit and not collapsed into a single status.
