# Phase 9 — Internal Applied Fee Waivers and Cross-Ledger Cap Checkpoint

**Date:** 2026-10-16  
**Repository:** `Wilberry/myschoolboard`  
**Branch:** `feature/phase9-fees-payments-foundation`  
**Previous checkpoint HEAD:** `5a6400231fde3397a9ade5dcca68136e384639cd`  
**Mandate/traceability:** D-023, D-P9-007, ADR-P9-007, FEE-REQ-001 partial, SEC-REQ-001/TEN-REQ-001  
**Exit status:** AUTHORING ONLY. NOT MIGRATED, SECURITY VERIFIED, MERGED OR DEPLOYED.

## Scope authored

1. **Prisma model:** `FeeWaiverApplication` is an immutable School
   + original FeeObligation + original WAIVER proposal + independent
   APPROVED decision + actual School Super Admin applier row.
   Original debt and other finance records are not rewritten.
   Composite school foreign keys, per-school source/UUID uniqueness,
   reason and source amount/currency/UTC timestamp snapshot.
   `FeeAdjustmentDecision` gains a composite unique school/id index
   required for tenant-bound application FK.
2. **Migration:** `20261017000000_phase9_effective_fee_waiver_application`
   adds the table, unique and composite constraints, School row-locked
   INSERT validator, immutable UPDATE/DELETE/TRUNCATE guards and
   two additional BEFORE INSERT guards on
   `PaymentVerificationDecision` and `ManualPaymentAllocation`.
   The waiver validator requires the exact active school, actual
   current `SCHOOL_SUPER_ADMIN`, distinct original School Admin
   proposer, `kind=WAIVER` and separately
   `FeeAdjustmentDecision.action=APPROVED`.
   It copies original trusted monetary and timestamp fields and
   refuses duplicate source decisions/proposals.
3. **Cross-ledger invariant:** under the SAME school lock, an
   application is rejected if
   `sum(existing waivers) + sum(ALL previous VERIFIED human claims)
   + proposed waiver > original obligation`. Previous human
   VERIFIED claims are counted even when their manual allocation
   was subsequently reversed. Separate SQL guards reject later
   VERIFIED decisions or manual allocations that would exceed
   `original obligation - applied waivers`. This is deliberately
   conservative: it does NOT imply or issue a bank refund.
4. **Service and API:** private no-store
   `GET/POST /api/schools/:schoolId/fee-waiver-applications`.
   Only current same-school School Super Admin. Strict Zod accepts
   solely `decisionId`, UUID `requestKey` and reason; no
   caller money, beneficiary, currency, account or status.
   School-locked serializable transaction and exact same
   actor/decision/reason/key replay. GET final SQL independently
   rechecks active membership and limits to 200. No PUT/PATCH/DELETE,
   external payer, student/guardian reader, receipt or bank movement.
5. **Owner-only internal financial preview:** retains original charge
   and reviewed/manual allocation/reversal columns; adds
   `appliedWaiverMinor` and `adjustedChargeMinor`; adjusts
   `previewRemainingMinor` using exact PostgreSQL numeric
   arithmetic. A FULL_MANUAL_ALLOCATION is **not** a PAID
   or bank-verified settlement status. The original student's
   `FeeObligation.amountMinor` remains unchanged.
6. **Feature isolation:** `PHASE9_EFFECTIVE_WAIVER_ENABLED=false`
   in addition to `PHASE9_FEE_WRITE_ENABLED=false`.
   No new write route is active by default. Existing fee,
   evidence, independent review, manual allocation/reversal
   and advisory proposal switches are also default OFF.
7. **Synthetic acceptance cases authored, not executed:**
   active role/tenant/foreign school restrictions; input money
   spoofing; exact retry and changed key; immutable source;
   current 456789 original fee / 400000 VERIFIED human claims /
   20000 applied waiver yielding adjusted charge 436789 and
   internal preview remaining 336789 after 100000 active manual
   allocation; denial of another 40000 waiver exceeding
   reviewed-claim cap; denial of approved CORRECTION_PROPOSAL
   as WAIVER; denial of future 38000 VERIFIED bank claim
   after the cap falls to 36789; forgery/history mutation
   denials and master default-OFF behavior.
8. **Source guard:** `scripts/phase9-effective-waiver-guard.test.mjs`
   added without removing prior full project tests and included in
   both `package.json` `test` and `verify:local:guards`.
   Three new structural source predicates passed V8 checks
   over fetched committed source files; this is **not** actual
   npm Node/test, Prisma, PostgreSQL or Vitest validation.
9. **Governance:** modules, schema/constraints, authorization,
   config, requirements acceptance/traceability, roadmap,
   D-P9-007 and ADR-P9-007 updated. FEE-REQ-001 remains partial.

## Firm limitations

- This "effective" waiver changes only **INTERNAL calculated
  charge previews**; school fee policies, original debt, human
  payment evidence and independent review history remain
  immutable. It cannot publish official statements or show a
  student/guardian they have paid. Verified human reference
  claims are NOT externally certified settlement.
- Approved `CORRECTION_PROPOSAL` has no execution path.
  To reverse a waiver, grant a further correction or
  recognize refunds, a separate immutable policy and
  accounting event ledger must be designed and validated.
- No financial provider, real-money settlement, refund,
  verified receipt, secure upload or student/guardian
  finance view has been authorized or created.
- All six earlier finance flags and the new waiver flag
  remain disabled by default. No shared/live database work.

## Release-blocking validation NOT EXECUTED

Actual `npm ci` and unchanged project tests, `prisma validate`,
client generation, real migrations on confirmed disposable
PostgreSQL, direct SQL and tenant/actor forgery, concurrent
transaction/race tests, synthetic authenticated Vitest,
membership revocation and tenant deletion checks, TypeScript,
format/lint/build, browser/privacy, strict
`npm audit --audit-level=high`, CI and live bank reconciliations
have **not** run. Source-only checks cannot establish these claims.
Prior dependency-security concerns persist until independently
resolved.

Upstream Phase 8 remains independent and not accepted. Neither
`main`, the original project checkout, the Phase 8 verification
worktree, GitHub Actions, deployments nor shared databases
were changed. Phase 9 acceptance remains BLOCKED.

## Next development direction

Run cumulative migrations, schema/Prisma and security tests in
a known disposable environment, fix any failures, and then
design auditable waiver corrections/reversals and payment-provider
reconciliation with immutable settlement events before secure
receipting and verified relationship-scoped student/guardian views.
