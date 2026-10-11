# Definition of Done

A feature is done only when:

- the relevant requirement IDs are identified and documented
- the acceptance criteria are satisfied
- the authorization and tenant-scope tests pass
- the workflow is covered by automated tests
- the schema or permissions change is reflected in documentation
- relevant audit, notification, and retention behaviors are verified
- any unresolved decision or deviation is documented

## Current status

The local foundation has verified implementation subsets, but the broader platform and security requirements remain incomplete. The new local CI runner and liveness handler must not be declared validated or release-ready until the owner executes the full local verification and reviews its failures, including the unchanged audit gate.
