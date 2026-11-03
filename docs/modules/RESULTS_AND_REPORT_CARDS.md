# Results and Report Cards

## Phase 8 private teacher result preparation preflight (AUTHORED; UNVERIFIED)

The teacher-only private/no-store preparation read reconciles independently
authorized CBT and reviewed written-mark sources for the exact school,
class, subject, session and term. It fails closed for identity, roster or
counter mismatches and reports source-readiness blockers. It never combines
scores into grades, persists official results, exposes answer keys, approves
or publishes results, or enables student/guardian result access.

Pure readiness, authenticated source-review/role/tenant, and Node source
invariant tests are authored. Full repository acceptance is pending.
RES-REQ-001 remains partial under D-052/ADR-037.


## Scope

Result sheets, report-card generation, approval, publication, and visibility policies.

## Mandatory workflow

1. Teacher prepares assessment and result-sheet data.
2. HM or Principal reviews and approves or returns.
3. Approved data populates report-card records.
4. School Super Admin performs final publication approval.
5. Student and parent access follows the configured visibility policy.

## Publication rules

- HM/Principal approval does not equal final report publication.
- A report card is official only after the School Super Admin’s final approval.
- Corrections after approval or publication must be versioned and auditable.
