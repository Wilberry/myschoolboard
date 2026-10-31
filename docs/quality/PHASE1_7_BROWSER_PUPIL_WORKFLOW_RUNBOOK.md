# Phase 1–7 browser pupil and lesson release verification

**Status: synthetic prepare, positive browser evidence and guarded
revocation independently executed at
`686891dac5887601df401d35acc4b222159bd403`; scoped results and open
acceptance cases are recorded in the
[browser acceptance matrix](PHASE1_7_BROWSER_SECURITY_ACCEPTANCE.md).**
This is a test-only, staged **real HTTP application workflow**.
It prepares a synthetic enrolled pupil, an administrator-attested
account link, a teacher-submitted lesson, an exact-section
Principal approval and a separate release event. A successful HTTP command
alone cannot mark BR-11 or BR-12 fully passed.

## Production HTTP authentication and rate-limit pacing

The workflow signs synthetic actors in through the local production server's
`/api/auth/sign-in/email` endpoint, extracts exactly one session-token cookie
without logging it, then validates that cookie through
`/api/auth/get-session`. It does not use Better Auth's in-process test-mode
sign-in helper, whose cookie configuration is not interchangeable with the
production-compiled server. Actor sign-ins are serialized with a 10.5-second
gap to respect the configured sign-in rate limit; do not remove or bypass
that pacing. Focused cookie-extraction and workflow-policy regressions are
covered by `scripts/browser-pupil-workflow-policy.test.mjs`.

## Non-negotiable safety requirements

- Work in the **separate, clean** `myschoolboard-format`
  verification worktree, not the original foundation worktree.
  Preserve any currently uncommitted PR #97 formatting and
  checkpoint evidence. Never discard it to switch branches.
- Only use the already verified disposable
  `postgres:17-alpine` Compose service, tmpfs-backed and
  bound to **127.0.0.1:5434**. Inspect the actual Docker
  context, service identity, port and storage before
  executing a test. The workflow checks these conditions
  again and checks the SHA-256 history of all 36 migrations.
- Only use the new **unique PR #97 browser fixture run ID**
  and its private synthetic-only password. Existing
  synthetic accounts must have exact school roles, an
  active SECONDARY assignment and the Principal's
  verified SECONDARY grant.
- Run the Next.js **production build** from this exact
  checkout with the established synthetic environment,
  then `npm run start -- --hostname 127.0.0.1`
  on loopback port 3000. Verify `BETTER_AUTH_URL`
  points to `http://localhost:3000` or
  `http://127.0.0.1:3000`. No public host or tunnel.
- Retain existing `NODE_ENV=test`,
  `TEST_DATABASE_DISPOSABLE=1`, `ALLOW_DEMO_SEED=1`,
  matching exact `DATABASE_URL` and `TEST_DATABASE_URL`,
  `BROWSER_FIXTURE_WRITE=1`,
  `BROWSER_FIXTURE_RUN_ID` and
  `BROWSER_FIXTURE_PASSWORD` environment variables.
  No production or non-test credentials may be used.
- Explicit separate **`BROWSER_PUPIL_WORKFLOW_WRITE=1`**
  is mandatory for the prepare/revoke phases, and
  **`BROWSER_PUPIL_REVOKE=1`** is mandatory for
  revocation. No broad database delete/seed/reset
  commands are part of this workflow.

## Single-session verification launcher

The `npm run verify:browser:session` launcher automates
the safe local setup after the operator has configured
the test-only environment above and the required
synthetic fixture variables below. It requires a clean
verification worktree and an already-running, healthy
`postgres-test` service; it never stashes, switches
branches, cleans, or otherwise changes Git worktree
contents. If the worktree is dirty, stop and use the
intended clean verification worktree without discarding
the existing changes.

The launcher independently verifies the local Docker
context, exact Compose service, configured test database,
loopback-only port 5434, and tmpfs storage. It inspects
the database read-only: an empty database receives only
the reviewed migrations; a non-empty database must have
Prisma migration history and pass exact checksums for all
36 migrations or the launcher stops without changing it.
It then builds the production app, confirms port 3000 is
available, starts the app on loopback, and runs the
existing synthetic fixture preparation with the supplied
unique run ID. The app remains running for browser
verification; stop it with Ctrl-C when finished.

```sh
export BROWSER_FIXTURE_WRITE=1
export BROWSER_FIXTURE_RUN_ID='browser-sec-unique-2026'
export BROWSER_FIXTURE_PASSWORD='a-private-synthetic-only-password'
npm run verify:browser:session
```

The run ID must be new for this database; fixture
preparation refuses an ID whose school or account records
already exist. Treat a failed/partial fixture run ID as
consumed and investigate before retrying with a new ID.
This launcher does not run pupil-link, lesson, or
revocation phases and never revokes student links.

## Staged execution

With the production-compiled localhost app running
and the verified synthetic environment exported:

```sh
npm run verify:local:preflight
npm run verify:migration-checksums
node --test scripts/browser-pupil-workflow-policy.test.mjs

export BROWSER_PUPIL_WORKFLOW_WRITE=1
npm run verify:browser:pupil-workflow -- --phase=prepare
```

**Prepare performs authorized product HTTP calls**, not direct
test fixture SQL mutations, for the following sequence:

1. School A Administrator registers one synthetic
   StudentRecord (REGISTERED with immutable event),
   enrolls it into the active SECONDARY class/session
   (ENROLLED with immutable event), then explicitly attests
   the existing studentA membership via
   `/api/schools/{schoolId}/student-links`
   with `identityVerified: true`.
2. Linked studentA's initial lessons list returns
   **200 with an empty list**. Unlinked studentA initially
   returns 404. No lesson becomes visible just because
   a teacher created or submitted a draft.
3. Teacher A creates a new synthetic lesson against
   the **still ACTIVE secondary assignment**, then submits
   revision 1 using their own session. This works after
   the PR #97 scenario revoked the *primary* assignment.
4. Verified SECONDARY Principal's submitted-note queue
   contains this exact note; verified PRIMARY Head's
   queue does **not**. Only the Principal makes a
   reasoned, immutable academic approval decision.
   Student list stays empty immediately after approval.
5. Principal's release queue contains the approved
   note; PRIMARY Head's queue does **not**. Principal
   explicitly RELEASES the exact revision.
6. The exact linked studentA now sees the approved,
   released note in the list, but the list contains
   **no revision objectives/content**. The detail
   endpoint returns only the requested released
   synthetic revision. Unlinked student, PARENT and
   school-B-only administrator remain **404**.
7. Every school API assertion requires the exact
   expected HTTP status plus
   `Cache-Control: private, no-store`.
   Denials must contain only a generic `Not found`
   error. Failed assertions stop rather than
   returning a false PASS.

This phase emits only synthetic resource IDs and
a success label; it **does not revoke** the student
link yet. It deliberately refuses to run again if
the fixture schools have prior pupil/lesson records.
A partial failure must be investigated before any
retry; do not reset the database, falsify audit
events or reuse the same run ID blindly.

### Browser positive checks before revocation

Using fresh, isolated Chromium contexts and actual
sign-in forms:

- Check BR-11: studentA sees the released lesson
  only at school A `/schools/{schoolA}/my-lessons`;
  the exact pupil lesson API list contains only the
  intended row and detail contains the synthetic
  released content. School B navigation is concealed.
- Check BR-06/07: Principal sees the released
  SECONDARY review/release record; PRIMARY Head
  cannot see/release it. Audit event history and
  already revoked primary teacher assignment remain
  unchanged. The UI must not disclose the note to
  another teacher or reviewer without exact scope.
- Check BR-08/16 negative cases: PARENT/teacher
  and school-B actor cannot read the child's lesson
  or the Principal release queue. Positive guardian
  portal access is **NOT IMPLEMENTED** in this
  Phase 1–7 fixture; do not claim it passes.
- Inspect full streamed HTML and RSC/Flight payloads,
  API status and no-store, browser history, copy/print
  preview and 200%-zoom keyboard focus.
  Record actual actor role, statuses and redacted
  evidence only, never credentials or tokens.

You may rerun the *read-only API assertions*
before revocation:

```sh
npm run verify:browser:pupil-workflow -- --phase=verify
```

The verify phase creates authentication sessions for
synthetic accounts but performs **no school-record
mutation**. The positive student link remains active.

### Revoke only after capturing positive browser evidence

In the **same** verified fixture run, after successful
positive page/history/print observation:

```sh
export BROWSER_PUPIL_REVOKE=1
npm run verify:browser:pupil-workflow -- --phase=revoke
```

The revoke phase first re-verifies positive
student access, then makes the school
Administrator's authorized revocation
POST to `/api/schools/{schoolId}/student-links/{linkId}/revoke`
with a synthetic reason. It asserts that the
**same still-authenticated pupil session** loses
both list and detail access with **404 and
private/no-store**, and that there is exactly
one protected revocation record. It never
unpublishes a lesson, mutates the student's
academic marks or changes another actor's
authorization.

Now test BR-12 and BR-13 in the old student browser
tab: Reload, Back, Forward, duplicate tab, fresh
profile, RSC, browser print and private cache.
No private pupil content should become newly
accessible after link revocation; document
any stale browser snapshot as a separate issue.

At commit `686891dac5887601df401d35acc4b222159bd403`, the guarded workflow
verified same-session list/detail API denial. Separate fresh-browser
post-revocation probes also verified document, API, Back/Forward, duplicate
tab, print after fresh navigation and student-authenticated Flight denial;
the exact statuses and headers are in the acceptance matrix. The original
pre-revocation tab's stale snapshot and print-before-refresh were not
reliably captured and remain outstanding. Fresh navigation results do not
demonstrate erasure of already-rendered browser history.

## Exit criteria

Capture exact branch SHA, sanitized synthetic fixture label, statuses, test
counts, and redacted browser screenshot/console findings. At
`686891dac5887601df401d35acc4b222159bd403`, fixture preparation, positive
browser checks, explicit guarded revocation and fresh-browser post-revocation
checks were executed. The full BR-01..BR-16 gate remains blocked; the
unattributed positive RSC cache headers and unverified old-tab stale content
are recorded limitations. Any unexpected response or audit record leaves
this checkpoint **FAILED or BLOCKED**, not accepted. Do not edit/repair
historical school audit rows.

This proves only narrow pupil + reviewed-lesson
transport behavior if actually run; it does not
establish complete BR-01..BR-16 acceptance,
positive guardian flows, billing/payment security,
accessibility, backup/recovery, production identity,
or release readiness. Full and strict dependency audits were reported at
zero findings for this base commit; this browser execution did not rerun
audits.
No GitHub Actions, deployment or merge to
`main` is part of this procedure.
