# Configuration Catalog

## Phase 8 report visibility — four explicit school-selected modes (D-063; development candidate)

**Safe absence:** No `ReportVisibilityPolicyRevision` means no release and no recipient access. Even an adopted policy is **not** a published grade. A School Super Admin must separately record an immutable `ReportRecipientRelease` referencing one explicitly frozen and revalidated official composition. Default deployment switches `PHASE8_REPORT_RELEASE_ENABLED=false` and `PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED=false` deny publication/delivery until cumulative tests and deployment review.

| School-selected mode | Verified student access | Currently linked guardian access | Receipt behavior |
| --- | --- | --- | --- |
| `SCHOOL_ONLY` | Never | Never | Internal release ledger only; no recipients |
| `STUDENT_ONLY` | Yes, with current same-school, active `STUDENT` membership, unrevoked `StudentAccountLink`, exact active enrollment | Never | No guardian receipt |
| `GUARDIAN_ONLY` | Never | Yes, with current same-school, active `PARENT` membership, unrevoked `GuardianStudentLink`, child's exact active enrollment | No receipt required |
| `GUARDIAN_FIRST_ACK` | Only **after** at least one **currently valid guardian** records an immutable receipt for **that exact child and released subject version**, and student's own current link/enrollment remains valid | Yes, for the linked child and exact currently published release | Explicit `ReportGuardianAcknowledgment`; no auto-ack on open |

The active revision is **the highest school version**. A new adoption **suspends** all older-policy recipient reads until School Super Admin releases an exact approved composition again under the new version; a release pins that policy and is **never rewritten**. A corrected and independently reapproved result yields a newly composed artifact and higher release ordinal for the same school/session/term/class/subject; only the newest release may be disclosed. Historical evidence and older receipts remain immutable. No universal score bands, national grade thresholds, parental notification consent, public report URLs or cross-tenant relationship inference are implied. These four modes and explicit receipt semantics operationalize Phase 8 P-004 as configurable **school choice**, not a silently imposed parent-first school default. Actual authorization acceptance remains blocked pending disposable Postgres, TypeScript/Next/browser/security-audit verification.


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
| Student report-card visibility | No adopted revision = no release/recipient access | Tenant | School Super Admin | Exactly SCHOOL_ONLY, STUDENT_ONLY, GUARDIAN_ONLY, GUARDIAN_FIRST_ACK; current exact policy must pin release | Immutable revisions | Results, portal |
| Attendance approval policy | Required for official visibility | Tenant | School Super Admin | Must define who can approve | Versioned | Attendance |
| Lesson-note release policy | Approved notes only | Tenant | HM / Principal / School Super Admin | Only approved notes may be released | Versioned | Lesson notes |
| Fee policy and currency | Nigeria default; configurable | Tenant | School Super Admin | Currency and period must be valid | Versioned | Finance |
| Notice visibility policy | Tenant-scoped | Tenant | School admin | Must respect tenant boundary and audience | Versioned | Communication |
| Parent-child visibility policy | Explicit relationship required | Tenant | School Super Admin | Parent may only access linked children | Versioned | Parent portal |
| QR verification policy | Public minimal verification only | Tenant | School Super Admin | Tokens must be opaque and private | Versioned | Report verification |
| Retention policy | 30d school, 90d platform | Platform and tenant | Platform operator / policy owner | Must align with legal and data retention obligations | Versioned | Trash, audit |

## Policy governance

School and platform policies must remain explicit, auditable, and configurable rather than hidden in code. Any policy change that affects historical records must be versioned or applied with effective-date logic.

## Phase 8 grading-scale adoption development detail (AUTHORED, NOT VERIFIED)

The `Grading scale` tenant configuration is explicitly versioned and School Super Admin-adopted: grade band `minBps`/`maxBps` ranges are inclusive, ascending, gap/overlap-free from 0 through 10000; each band has school-defined code and remark. School must choose one rounding mode (HALF_UP/FLOOR/CEILING), 0/1/2 decimal places for display, and whether raw or displayed rounded scores determine grade-label thresholds. No national/school default grade bands, pass mark or implicit parent access. This does NOT define the official report aggregation formula; later computed reports must pin an exact adopted scale revision without changing history. D-058/ADR-044.
