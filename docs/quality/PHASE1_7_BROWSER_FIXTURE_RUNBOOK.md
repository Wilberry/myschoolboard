# Phase 1–7 synthetic browser fixture setup

**Status: authored, not executed on an operator workstation.**
This procedure creates *test-only* actor identities and the minimum
academic structure required to exercise the Phase 1–7
[authenticated browser matrix](PHASE1_7_BROWSER_SECURITY_ACCEPTANCE.md).
It does **not** validate real product school onboarding, guardian
association, admission, lesson approval, audit workflow or release.
Do not treat fixture creation as evidence that those workflows pass.

## Scope and protections

- The only permitted database is the project's existing local
  `myschoolboard_test` PostgreSQL 17 Compose service on
  `127.0.0.1:5434`, with tmpfs at `/var/lib/postgresql/data`.
  No shared, staging, production or normal development DB is allowed.
- `scripts/prepare-phase1-7-browser-fixtures.ts` fails closed
  unless `NODE_ENV=test`, `TEST_DATABASE_DISPOSABLE=1`,
  `ALLOW_DEMO_SEED=1`, and both database URLs are **identical**
  local test URLs. A separate **`BROWSER_FIXTURE_WRITE=1`**
  opt-in and valid unique run label are required.
- Before any writes, the script checks the local Unix-socket
  Docker context, identifies exactly one Compose
  `postgres-test` container from this worktree, verifies
  image `postgres:17-alpine`, running/healthy state,
  loopback port binding, tmpfs data mount and absence of
  host-bind mounts. It then runs the read-only checksum
  verifier against every tracked migration. Operators
  must independently inspect Docker context, target and
  `docker port`; URL/labels alone cannot prove there
  is no unusual forwarding or container escape.
- The script fails if either of its two generated school slugs
  or any corresponding user emails already exists. It does
  not update, elevate, delete or reset any existing account
  or school. Use a **new unique run ID** after an incomplete
  fixture run; don't rerun against partial prior data.
- Only synthetic account emails are printed in its manifest.
  The password is taken from a local environment variable,
  never printed or committed. Do not send browser cookies,
  credentials, personal files or raw HAR captures into PRs.
- The script writes only *new isolated synthetic schools
  and accounts*. The user signups are completed first via
  Better Auth, then school/role/academic setup is done
  in one Prisma transaction. If that transaction fails,
  some synthetic signup users may remain: preserve the
  failure, use a new run ID, and inspect before any cleanup.
  There is deliberately no automatic destructive cleanup.

## Local operator sequence

Work only in the clean, separate
`~/Desktop/project/myschoolboard-format` worktree at the
reviewed draft branch's **exact commit**. Do not touch the
original tenant foundation worktree or `main`.

Confirm the Docker context and the Compose `postgres-test`
service are the same disposable target used for the prior
36 migration checks; never recreate or reset an
unknown service. Restore the environment from
[LOCAL_CI_RUNBOOK.md](LOCAL_CI_RUNBOOK.md), then run:

```sh
npm run verify:local:preflight
npm run verify:migration-checksums
node --test scripts/browser-fixture-safety.test.mjs

# Unique lowercase label; use a new one on every run.
export BROWSER_FIXTURE_RUN_ID=browser-oct22a
export BROWSER_FIXTURE_WRITE=1
read -rs -p "Synthetic browser-only password: " BROWSER_FIXTURE_PASSWORD
printf "\\n"
export BROWSER_FIXTURE_PASSWORD
npm run verify:browser:fixtures
```

The command outputs a **synthetic-only JSON manifest**
containing the new school IDs, academic session/term,
classes, section grant IDs, teacher assignment IDs
and test actor emails. Save this output securely
outside Git; it is not a substitute for independently
checking the generated records. Use the environment
password with the account emails; it is not echoed.

## Available accounts and test data

| Actor key | Synthetic membership | Intended browser coverage |
| --- | --- | --- |
| `adminA` | School A Administrator | BR-02, student setup and school configuration |
| `superA` | School A Super Admin | BR-09 publication-policy denial/approval boundary |
| `teacherA` | School A Teacher | BR-04/BR-05 exact active primary + secondary assignment scope |
| `headA` | School A Head of Section | BR-06: verified PRIMARY grant only |
| `principalA` | School A Principal | BR-07: verified SECONDARY grant only |
| `studentA` | School A STUDENT, **initially unlinked** | BR-11/BR-12 after legitimate account attestation |
| `unlinkedA` | School A STUDENT, deliberately unlinked | Negative identity isolation |
| `parentA` | School A PARENT, **no child grant** | BR-16 negative case, not proof of a guardian portal |
| `adminB` | School B Administrator only | BR-02/BR-03 cross-school denial |
| `outsider` | No school membership | Unaffiliated authenticated denial |

The fixture creates one ACTIVE academic session, one ACTIVE term,
PRIMARY and SECONDARY sections, a class in each section,
one subject, and two exact ACTIVE class/subject/session
teacher assignments. It creates **no student admissions,
enrollments, student-account attestations, lesson notes,
reviews, releases or audit events**. Those business records
must be created through the actual authorized
admin/teacher/reviewer API or UI workflows before
BR-11/BR-12 and positive-release checks. Direct fixture
setup of reference academic rows cannot substitute for
the formal onboarding, assignment creation or academic
review audit requirements.

## Running the browser acceptance

Use the existing locally compiled Next app only
(`npm run build` then `npm run start -- --hostname 127.0.0.1`),
bound to loopback, with the same synthetic test environment.

First verify BR-01..BR-03 with fresh browser profiles;
then teacher BR-04/BR-05 and verified section
BR-06..BR-08. Document a before-and-after
change to *only* the synthetic teacher assignment
or verified section grant through a reviewed
test-only change or actual school-admin route.
Never modify another tenant's or a live user's
permissions. The student positive and revocation
cases need separate authorized enrolment/link
and content workflows; report `BLOCKED` until ready.

For each scenario, record response status of
document, RSC and private JSON endpoints, noindex,
cache policy, any private school/student data, browser
Back/Forward state, print preview and keyboard
accessibility. Follow the
[browser evidence report](PHASE1_7_BROWSER_EVIDENCE_2026_10_21.md)
for redaction and status labeling.

**No release/merge acceptance is implied.** The strict
full dependency audit still reports the unpatched
`braces` advisory until a verified remediation or
a separately authorized security-risk decision.
