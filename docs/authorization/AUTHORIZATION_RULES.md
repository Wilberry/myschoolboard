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
- Teacher academic read, edit, and submit actions for a class and subject require an active assignment matching the exact school, membership, class, and subject tuple.
- Section, class, and subject `ScopeGrant` records must have `verified: true` before they authorize access to that resource. A matching but unverified scope is not permission. Teacher academic operations still require an exact, active class-subject assignment independently of these grants.
- Independent class and subject `ScopeGrant` records must never be combined to infer a teacher assignment. The policy helper enforces the assignment check, but protected academic routes must still load the principal through the assignment-aware resolver and pass the requested class and subject.
- Assignment lifecycle mutations use `school:configure`, currently limited by the policy to active School Administrator and School Super Admin memberships. The four implemented assignment mutation routes authenticate with Better Auth, check the school principal at the route boundary, and call the internal service, which repeats authorization transactionally. Platform Super Admin status does not independently grant school mutation authority. Client-supplied actor identifiers are not accepted. Future academic routes must use the same server-side tenant and service checks; assignment reads remain unresolved under D-020.

## Required distinctions

- Role-based permissions are not enough; section, class, subject, relationship, and workflow constraints also apply.
- The School Super Admin role is distinct from the Platform Super Admin role.
- Form Teacher authority is distinct from subject-teacher authority.
- Final report publication is a distinct authorized workflow from ordinary HMs or Principals’ approvals.
