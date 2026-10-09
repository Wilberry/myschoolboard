# Permissions Matrix

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
