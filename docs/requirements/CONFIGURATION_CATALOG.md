# Configuration Catalog

## Phase 9 bank-reference evidence and review — unverified development defaults

School Administrator may submit an **unverified** reference-only
bank-transfer claim against a previously issued same-school
`FeeObligation`. Only a different current same-school School Super
Admin may independently verify or reject after personally confirming
the bank statement. No automatic paid/receipt status or provider
callback is inferred. Original claims and review decisions are
immutable. One school-scoped bank-reference digest cannot be reused
to claim a second debt. Verified claims may not cumulatively exceed
the original charge; refunds/reversals require separate future audit
events, never overwriting history. No raw bank reference, document
upload or confidential account data is persisted.

Two additional independent switches default to OFF:
`PHASE9_PAYMENT_EVIDENCE_ENABLED=false` for reference claims and
`PHASE9_PAYMENT_REVIEW_ENABLED=false` for reviewer attestations.
Both also require `PHASE9_FEE_WRITE_ENABLED=true` in an approved
disposable synthetic test environment. There is no school-facing
option to bypass these environment security controls.
D-P9-003 / ADR-P9-003; no provider choice or production approval.


## Phase 9 fee configuration development contract (not verified)

Each school explicitly defines durable fee category codes and reasoned
revisions for an existing category/session/term and SCHOOL/SECTION/CLASS
scope; only a current same-school SCHOOL_SUPER_ADMIN may write in this
initial candidate. The editable business choice is a *new version*, never
an UPDATE of prior price evidence or an automatic repricing of obligations.
Amounts use positive BIGINT minor units (initial conservative maximum
1,000,000,000,000) and explicit upper-case three-letter currency;
there is no auto-charge, auto-assignment or automatic payment verification.
Fees may be configured for PLANNED or ACTIVE, never CLOSED periods.
No extra fee authority, provider or historic default is assumed.
Explicit student charge issuance pins one immutable exact-scope fee revision
and the enrolled pupil's school, class and academic term. No automatic issuance:
only a reasoned same-school School Super Admin action with one UUID replay key;
current scope/period/enrollment validated again in PostgreSQL. A later policy
revision does not alter an issued amount. This is a development-only default.

`PHASE9_FEE_WRITE_ENABLED=false` disables fee-category, fee-structure and
student-obligation POSTs unless explicitly set to `true` in a strictly
isolated synthetic test environment. It is not a school-level option or
a production risk acceptance.

D-P9-001 / D-P9-002; ADR-P9-001 / ADR-P9-002.
Neither migration, runtime behavior nor production adoption is verified.


## Attendance school calendar policy (development-only implementation default)

| Setting | Default (no revision) | Scope / editor | Constraints | Audit / enforcement |
| --- | --- | --- | --- | --- |
| Attendance IANA timezone | Etc/UTC | School Administrator or School Super Admin with active same-school school:configure | Must be recognized by both Node Intl and PostgreSQL | Immutable, actor-attributed SchoolAttendancePolicyRevision |
| Daily attendance historical entry | Previous 7 local calendar days | Same | Configurable 0–30 days; submission cannot exceed school-local **or UTC** current day | Transactional server check and independent PostgreSQL BEFORE INSERT audit-event guard |
| Attendance correction window | 30 local calendar days from attendance date | Same | Configurable 0–365 days, while original session/class/section remain active and Form Teacher/reviewer authority holds | Transactional request check plus independent PostgreSQL BEFORE INSERT correction-request guard |

These are restricted engineering defaults, not an authorized national or individual school policy. School holidays, extraordinary closures, retrospective approvals, or non-teaching-day exceptions have not been implemented. Changes append a new auditable revision and never rewrite historic register marks or decisions. D-031 / ADR-017 describe the narrower-than-existing-UTC safeguard.


This catalog lists the major configurable policies that must be supported at the school or platform level.

| Setting | Default | Scope | Authorized editor | Validation rules | Versioning | Modules affected |
| --- | --- | --- | --- | --- | --- | --- |
| Tenant branding | Configurable | Tenant | School Super Admin / platform operator | Branding metadata must be valid and non-empty | Versioned | School setup, UI |
| School type | Combined or primary/secondary | Tenant | School Super Admin | Must align with supported academic sections | Versioned | School structure |
| Academic session policy | Active session required | Tenant | School Super Admin | Session dates must be valid and non-overlapping | Versioned | Academic structure |
| Grading scale | School-defined | Tenant | School Super Admin | Must align with result rules and published history | Required for result history | Results |
| Score weighting | School-defined | Tenant | HM / Principal / School Super Admin | Weight totals must be valid and cannot silently affect historical results | Required | Results, assessment |
| Student report-card visibility | Assessment-only access | Tenant | School Super Admin | Must be one of four supported values | Versioned | Results, portal |
| Attendance approval policy | Required for official visibility | Tenant | School Super Admin | Must define who can approve | Versioned | Attendance |
| Lesson-note release policy | Approved notes only | Tenant | HM / Principal / School Super Admin | Only approved notes may be released | Versioned | Lesson notes |
| Fee policy and currency | Nigeria default; configurable | Tenant | School Super Admin | Currency and period must be valid | Versioned | Finance |
| Notice visibility policy | Tenant-scoped | Tenant | School admin | Must respect tenant boundary and audience | Versioned | Communication |
| Parent-child visibility policy | Explicit relationship required | Tenant | School Super Admin | Parent may only access linked children | Versioned | Parent portal |
| QR verification policy | Public minimal verification only | Tenant | School Super Admin | Tokens must be opaque and private | Versioned | Report verification |
| Retention policy | 30d school, 90d platform | Platform and tenant | Platform operator / policy owner | Must align with legal and data retention obligations | Versioned | Trash, audit |

## Policy governance

School and platform policies must remain explicit, auditable, and configurable rather than hidden in code. Any policy change that affects historical records must be versioned or applied with effective-date logic.
