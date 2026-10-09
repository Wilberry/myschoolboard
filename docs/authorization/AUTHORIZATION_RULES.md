# Authorization Rules

## Rule precedence

1. Tenant and school scope
2. Role definition
3. Section and class scope
4. Subject and assignment scope
5. Relationship-based access
6. Workflow state authorization
7. Explicit exception or approved support override

## Conflict resolution

When two rules conflict, the safe default is the more restrictive rule. The conflict must be recorded and escalated for product-owner approval if the requirement cannot be resolved without a policy change.

## Required checks

- Every server request must validate tenant context.
- All mutations must check active state, record permissions, and workflow state.
- All exports and file downloads must check the same conditions as read access.
- Background jobs and scheduled tasks must use the same authorization policy context as user requests.

## Required distinctions

- Role-based permissions are not enough; section, class, subject, relationship, and workflow constraints also apply.
- The School Super Admin role is distinct from the Platform Super Admin role.
- Form Teacher authority is distinct from subject-teacher authority.
- Final report publication is a distinct authorized workflow from ordinary HMs or Principals’ approvals.
