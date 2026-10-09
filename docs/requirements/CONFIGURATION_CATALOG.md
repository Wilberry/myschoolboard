# Configuration Catalog

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
