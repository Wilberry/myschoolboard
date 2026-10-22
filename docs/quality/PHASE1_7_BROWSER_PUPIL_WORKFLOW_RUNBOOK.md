# Phase 1–7 browser pupil and lesson release verification

**Status: authored, NOT locally executed on this branch.**
This is a test-only, staged **real HTTP application workflow**.
It prepares a synthetic enrolled pupil, an administrator-attested
account link, a teacher-submitted lesson, an exact-section
Principal approval and a separate release event. Browser UI,
RSC/history/printing and keyboard acceptance must still be tested
in an actual browser. A successful HTTP command alone cannot
mark BR-11 or BR-12 fully passed.

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

## Exit criteria

Capture exact branch SHA, sanitized synthetic
fixture label, statuses, test counts, and redacted
browser screenshot/console findings. The commands
are **authored, not executed** in this PR. Any
unexpected response or audit record leaves this
checkpoint **FAILED or BLOCKED**, not accepted.
Do not edit/repair historical school audit rows.

This proves only narrow pupil + reviewed-lesson
transport behavior if actually run; it does not
establish complete BR-01..BR-16 acceptance,
positive guardian flows, billing/payment security,
accessibility, backup/recovery, production identity,
or release readiness. The unchanged strict
`npm audit --audit-level=high` blocker remains.
No GitHub Actions, deployment or merge to
`main` is part of this procedure.
