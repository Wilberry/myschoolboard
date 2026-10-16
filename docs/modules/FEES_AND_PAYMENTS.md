# Fees and Payments

## Scope

School-defined fee categories, period-specific fee structures, student fee obligations,
payment evidence, independent verification, receipts, and reconciliation. All records
are tenant-bound and financial history must be attributable and non-silently mutable.

## Phase 9 delivery order (FEE-REQ-001)

1. **Fee configuration foundation — authored, NOT VERIFIED.** One immutable
   `FeeCategory` per school and uppercase code; versioned, explicitly
   priced `FeeStructureRevision` per school/category/session/term and
   `SCHOOL`, `SECTION`, or `CLASS` scope. All classes and sections are
   the actual school's active resources. School Super Admin alone can
   configure this first slice; later bursar/delegated finance permission
   requires a separately defined verified authorization policy.
2. **Student fee obligations — AUTHORED, NOT VERIFIED.** An explicit
   `FeeObligation` for an ENROLLED pupil with matching ACTIVE enrollment
   and current school/category/session/term fee revision. Its PostgreSQL
   INSERT trigger checks the issuer and scope then copies charge
   money and context **from the database**, with one immutable pupil/
   category/term charge, globally unique per-school idempotency key,
   and no repricing. Waiver/discount/adjustment/reversal remains future
   separately reviewed evidence, not mutation of the original charge.
3. **Payment evidence and verification — NOT YET BUILT.** Submitted proof
   is unverified. A separately authorized verifier records a one-time
   outcome with distinct submitted, pending, verified, rejected, refunded
   and reversed semantics, idempotency keys, amount/currency matching,
   and immutable verification/reversal evidence.
4. **Balance and reconciliation — NOT YET BUILT.** Compute payable amount,
   allocated verified sums and outstanding balances from immutable events.
   No fabricated credit, silent refund, unrestricted parent access, or
   receipt before verified evidence. Provider callbacks must be replay-safe.
5. **Private finance, student/guardian views and release checks — PENDING.**
   Apply verified same-school relationship and minimum-data access,
   actual synthetic PostgreSQL integration tests, privacy/browser checks,
   unchanged CI and strict high-severity dependency audit before release.

## Phase 9 fee configuration implementation contract

- `FeeCategory` identifies an immutable school-specific label/code.
  A new label requires a new category rather than rewriting history.
- `FeeStructureRevision` is a policy proposal, **not** an issued debt,
  verified payment, or receivable; each context has SQL-assigned version.
  `amountMinor` is a strictly positive PostgreSQL BIGINT and the HTTP
  contract accepts/returns its decimal-string representation to avoid
  JavaScript floating-point money loss. Currency is explicit ISO-style
  three-letter uppercase code; no automatic conversion or default charge.
- Scope: `SCHOOL` uses `scopeId=schoolId` with no section/class;
  `SECTION` uses exactly its same-school section; `CLASS` uses an
  active class with an active same-school section. Cross-tenant links
  are prohibited by composite FKs and checked again inside SQL.
- A period may be `PLANNED` or `ACTIVE`; `CLOSED` sessions/terms
  cannot receive new price versions. A fee revision never rewrites
  older revisions or already-created obligations.
- A current active `SCHOOL_SUPER_ADMIN` in the actual school may create
  categories and fee revisions. Client actor/owner identifiers are
  rejected. SQL locks the School row, validates original active member
  and real class/period, assigns revision/timestamp, and rejects
  UPDATE/DELETE/TRUNCATE of fee history.
- All Phase 9 configuration and charge POSTs are **disabled by default**
  unless `PHASE9_FEE_WRITE_ENABLED=true`; do not enable against shared or
  live data. The synthetic DB test stubs it on explicitly.
- First internal-admin APIs: `GET/POST /api/schools/:schoolId/fee-categories`
  and `GET/POST /api/schools/:schoolId/fee-structures`. GET metadata is
  bounded, SQL rechecks current school/member for each query, and both
  routes require actual signed-in sessions, use `private, no-store`,
  and conceal other schools' identifiers.
- Second internal-admin API: `GET/POST /api/schools/:schoolId/fee-obligations`.
  POST requires exact `enrollmentId`, immutable `revisionId`, unique UUID
  `requestKey` and reason, never caller amount/student/actor/currency.
  Server checks the signed-in active School Super Admin, exact enrolled
  pupil/class/session and scope, then PostgreSQL independently re-derives
  all monetary and student fields under the school lock. The revision
  must still be the latest in its own scope. Identical retry returns
  the first immutable charge; changed-key/payload and repeated charge
  for the same pupil/category/term are conflicts. GET returns owner-only
  bounded charge metadata, not payment status or a verified balance.
  A school fee obligation is not equivalent to funds being received.
- These milestones deliberately create **no** payment evidence records,
  payment provider calls, callbacks, receipt APIs, fee waivers,
  student/guardian finance views, or financial settlement side effects.

## Critical payment states (future obligations)

- Submitted
- Pending verification
- Verified
- Rejected
- Refunded
- Reversed

Upload evidence and provider callbacks must never automatically equate
to verified funds. Payment processing must be idempotent and auditable.
Provider secrets must never be stored in application records.

## Validation status

Migration, Prisma generation/validation, real-session synthetic PostgreSQL
integration, financial lifecycle, browser and unchanged CI/security audit
remain **NOT EXECUTED**. This branch is a non-production candidate only.
See `docs/quality/PHASE9_FEE_CONFIGURATION_CHECKPOINT_20261016.md`,
D-P9-001 and ADR-P9-001.
