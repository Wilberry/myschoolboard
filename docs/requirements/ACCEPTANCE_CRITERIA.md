# Acceptance Criteria

## Phase 9 internal effective fee waiver application (AUTHORED; NOT TESTED)

- A signed-in same-school active School Super Admin may apply
  only an independently approved original WAIVER proposal for
  its unchanged original obligation, once, with UUID request
  key and reason. Client cannot choose amount, currency,
  actor or a paid status. Foreign tenant, incorrect reviewer,
  REJECTED, pending and CORRECTION_PROPOSAL are rejected.
- SQL must keep `waived_total+VERIFIED_claims<=original_charge`
  under a School lock across concurrent waiver applications,
  new verified reviews and manual allocations. A reversal of a
  manual allocation does not erase prior human VERIFIED amount
  from this conservative cap. Duplicate source applications,
  forged direct database actors or historic row mutation fail.
- Original charge remains unchanged, and owner-only internal
  preview derives applied waiver, adjusted charge and arithmetic
  remainder in exact decimal minor units. No provider-paid
  status, bank settlement, refund, invoice release, receipt
  or student/guardian finance view may be implied. Actual
  runtime PostgreSQL, Prisma, security and browser validation
  remains mandatory.


## Phase 9 advisory waiver review (unexecuted)

- A current same-school School Administrator may submit a reasoned,
  UUID-idempotent WAIVER/CORRECTION_PROPOSAL for one immutable
  school-owned debt, with amount no greater than the original charge,
  original currency and no caller-supplied actor or settled status.
- Only a different, active same-school School Super Admin may decide
  APPROVED or REJECTED once. Exact replay is safe; foreign-school,
  changed replay, wrong role and direct SQL actor forgery must fail.
- Even APPROVED remains ADVISORY_ONLY; the original obligation,
  manual allocations, reviewed bank claims, internal financial
  preview, payment settlement and receipt must remain unchanged.


## Phase 9 internal manual allocation reversal acceptance (authored; unexecuted)

- Given an original manually verified payment allocation, only an
  active same-school School Administrator can request its **whole**
  internal reversal once, with reason, UUID idempotency and school-
  copied money. Changing a retry or targeting a foreign allocation
  must be rejected.
- Given a pending reversal request, only an independent active
  same-school School Super Admin can append one immutable APPROVED
  or REJECTED terminal decision with reason; exact replay returns
  the original, changed or concurrent duplicates are denied.
- APPROVED must preserve the original claim, reviewer attestation
  and full manual allocation while subtracting the entire amount
  only from the school-owner internal NET preview. REJECTED must
  not affect net amounts; reversed claims must not be reusable.
- A manual reversal must never send funds, invent a bank refund,
  invalidate an original evidence record, grant any student/guardian
  access, or issue a receipt or official balance. Actual PostgreSQL,
  authenticated role, concurrency and financial security tests are
  required before release.


This document records the acceptance standard for the major product workflows.

## Platform onboarding

- Given a valid platform-level request, a platform operator can create or manage a tenant record.
- When a tenant is active, the platform can attach subscription status, settings, and operational status.
- When a tenant is suspended or closed, the status is logged and access must follow the approved policy.

## School configuration

- Given a school is onboarded, the school can configure branding, academic sessions, terms, sections, classes, subjects, and grading policies.
- When a grading configuration changes, the system must not silently rewrite historical results.

## Teacher assignment

- Given a subject or class is assigned, the system rejects duplicate active assignments and conflicting timetable slots.
- Given an unauthorized teacher attempts self-assignment, the request must fail with server-side enforcement.

## Attendance

- Given a Form Teacher submits attendance, the system must create a pending or approved record depending on policy.
- When a duplicate attendance record is attempted, the request must fail.
- When attendance is corrected after approval, a reason and actor must be preserved in history.

## Results and publication

- Given an HM or Principal approves a class result sheet, the approval must not be treated as a final published report.
- When the School Super Admin publishes a report card, the parent or student visibility rules must be enforced based on the school policy.

## Payments

- Given a School Administrator submits a bank transfer reference, an
  immutable `SUBMITTED` claim is created under the same school and exact
  fee obligation; **no payment status or credit is automatically verified**.
- Given an independent School Super Admin reviews a claim, only a matching
  bank reference plus explicit manual funds confirmation may produce a
  one-time VERIFIED decision; REJECTED is distinct and immutable.
  Reusing a review payload is idempotent; changing it must be denied.
- Given a review decision is REJECTED, PENDING or belongs to another
  school, no allocation can be created by an unauthorized role or even
  by a School Super Admin. A current School Super Admin may allocate
  only an independently VERIFIED, bank-attested original school claim,
  once; the SQL guard re-derives amount and currency.
- Given duplicate concurrent allocation requests, at most one durable
  immutable allocation may exist for any source verification and bank
  reference; exact same actor/key/payload retries return the first
  allocation, and changed retries do not overwrite it.
- Given the original debt and one or more manual allocations,
  the owner-only preview uses exact minor-unit arithmetic for charge,
  reviewed amount, allocated amount, unallocated reviewed amount and
  arithmetic remainder, with **no official PAID/SETTLED status or
  receipt**, and no student/guardian balance access.
- Given multiple claims for one obligation, independent verification must
  reject an aggregate verified amount exceeding the original charge.
  Cross-school, other-role, forged reviewer and replayed bank-reference
  attempts must fail, including under concurrent requests.
- No file upload counts as acceptable proof until private tenant storage,
  approved file types, malware controls and scoped readers are verified.
- No school or parent sees a receipt or settled/paid account merely from
  evidence submission or a manual reviewer decision before full
  reconciliation and receipt acceptance.

- Given a payment transfer is uploaded, the system must not automatically mark the payment as verified without a verification decision.
- When a duplicate callback is received, it must be idempotently handled.

## Trash and retention

- Given an item is placed in school Trash, it remains recoverable for 30 days.
- Given the object is expired, it must not be recoverable unless explicitly retained by policy.
- Given platform-level deletion occurs, the object must be retained in platform Trash for 90 days.

## Security

- Given a cross-tenant request is issued, the system must reject it and log the event.
- Given a student attempts unauthorized access to another student’s data, the request must fail.
- Given a QR token is revoked or invalid, verification must fail without displaying private data.

## Documentation and traceability

- Every requirement must map to acceptance criteria, tests, and roadmap milestones.
- No requirement is considered complete without evidence of implementation and validation.
