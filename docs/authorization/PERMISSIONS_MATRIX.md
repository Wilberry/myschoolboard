# Permissions Matrix

## Phase 9 fee waiver proposal / advisory approval — AUTHORED ONLY

Current active same-school SCHOOL_ADMIN may propose reasoned waiver or
fee correction to an existing immutable school fee debt, bounded to
its original currency and charge. Only a **different**, current
same-school SCHOOL_SUPER_ADMIN may record one immutable APPROVED or
REJECTED advisory decision. Neither role may thereby cancel a student
debt, produce an effective waiver, refund money or issue a receipt.
Admin sees only own proposals; owner sees bounded same-school queue.
All finance writes are default-OFF, and no guardians/students/staff/
platform roles acquire financial access. D-P9-006.


For assignment-administration list/detail reads **only**, the D-020/D-023 development implementation default is authenticated, active, same-school `school:configure` (currently School Administrator and School Super Admin), plus tenant-scoped resource checks and minimum needed fields. This does **not** grant general assignment-administration read to every `academic:read` role, Platform Super Admin, parents, or teachers. Teacher self-service requires a distinct exact-active-assignment-scoped design. Read handlers are not implemented or validated merely by recording this policy.

## Phase 9 interim finance workflow (AUTHORED, NOT VERIFIED)

The configuration catalog continues to reserve fee-category/policy authoring
and explicit pupil-obligation issuance to the current same-school
`SCHOOL_SUPER_ADMIN`, guarded independently in application and PostgreSQL.
For reference-only school operational submissions, an active same-school
`SCHOOL_ADMIN` may record **unverified** transfer-reference evidence for an
existing exact-school obligation and see only their own evidence; this does
**not** authorize fee edits, bank verification, receipts, payment callbacks,
student-linked finance reports, exports or wider financial data reads.
A **different** active same-school `SCHOOL_SUPER_ADMIN` must explicitly
attest the claimed reference against independently observed bank funds to
append one VERIFIED/REJECTED review; no same-user self-review, no automatic
settlement or publication. Teachers, students, guardians, platform support
and Platform Super Admin gain no implied finance access. Both operations
are disabled by default pending database/security acceptance. D-P9-003,
ADR-P9-003. This scoped development policy does not silently create a
delegated bursar role.

## Phase 9 manual allocation scope (AUTHORED, NOT VERIFIED)

Only a current same-school `SCHOOL_SUPER_ADMIN` may allocate a previously
independently VERIFIED manual evidence claim to its original same-school
obligation or read the **internal, provisional** school-wide allocation
preview. `SCHOOL_ADMIN` can submit unverified reference evidence but
cannot allocate, issue receipts, read the full balance preview or bypass
the School Super Admin's separate verification. Student/guardian and
teacher roles gain no fee balance, credit or payment receipt endpoint.
The allocator's same-school identity and exact source evidence are
independently revalidated in PostgreSQL under a school lock. It is
not production payment settlement; writes are disabled by default.
D-P9-004 / ADR-P9-004.

## Phase 9 correction of manual allocation preview (AUTHORED, NOT VERIFIED)

Current same-school `SCHOOL_ADMIN` may submit only one immutable,
reasoned full-manual-allocation reversal **request**. A distinct active
same-school `SCHOOL_SUPER_ADMIN` may independently approve or reject.
Only APPROVED adjusts the internal owner-only preview, not actual
funds, original documents, payment status or receipt. Direct SQL
checks role, school, exact historical allocation, and preserved
amount/currency under the school lock. No student/guardian or staff
refund, transfer, paid-status or official balance rights arise from
this workflow. Both fee and reversal write flags remain OFF.
D-P9-005 / ADR-P9-005.

The matrix below expresses the governing permission model. Server-side governance is mandatory; UI hiding is not sufficient.

| Role | View | Create | Edit | Submit | Approve | Publish | Export | Restore | Delete | Permanently delete | Manage permissions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform Super Admin | Platform + tenant metadata | Tenant lifecycle, plans | Platform settings | N/A | Platform audit and lifecycle | Platform config | Approved exports | Platform Trash if authorized | Tenant records under policy | Platform Trash only if authorized | Platform role assignments |
| Platform support / ops | Restricted tenant metadata | N/A | N/A | N/A | N/A | N/A | Restricted | N/A | N/A | N/A | N/A |
| School Super Admin | School data, results, attendance, notes | School admin records | School configuration only | N/A | Final report publication | Official reports | Approved school exports | School Trash within scope | School records under policy | School Trash only | School admin roles |
| School Administrator | School operational records | School records | Scoped admin data | Some workflow data | Some workflow approvals | N/A | Approved | School Trash within scope | Scoped records | No | School role assignments if allowed |
| HM / Head of Primary | Primary section data | Primary section items | Primary records | Attendance, notes, result sheets | Primary approvals | N/A | Approved | Within scope | Within scope | No | N/A |
| Principal | Secondary section data | Secondary records | Secondary records | Attendance, notes, result sheets | Secondary approvals | N/A | Approved | Within scope | Within scope | No | N/A |
| Form Teacher | Assigned class data | Attendance and class tasks | Class attendance only if authorized | Attendance | N/A | N/A | Class-level | N/A | N/A | No | N/A |
| Subject Teacher | Assigned subject/class data | Assessments and submissions | Scores within scope | Assessment submissions | N/A | N/A | Scoped | N/A | N/A | No | N/A |
| Parent / Guardian | Linked child data, notices, approved results | N/A | N/A | N/A | N/A | N/A | Access only to permitted exports | N/A | N/A | N/A | N/A |
| Student | Personal assessments and notices | N/A | N/A | Assignment submissions | N/A | N/A | No personal data export by default | N/A | N/A | N/A | N/A |

## Important exceptions

- School Super Admin may view academic records but must not edit or modify those records merely due to the role.
- Platform Super Admin may not automatically edit a school’s official academic records.
- Support-access overrides require explicit authorization, reason, scope, duration, and audit logging.
- Parent access is limited to explicitly linked children in the same tenant.
