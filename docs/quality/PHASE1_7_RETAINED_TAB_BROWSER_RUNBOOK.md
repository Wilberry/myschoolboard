# Phase 1–7 retained-tab revocation and Flight cache verification

**Status: automation authored for review; NOT YET RUN against a local browser or database on this branch. Phase 1–7 remains NOT ACCEPTED.**

This test keeps the original linked-student Chromium tab open **through**
the separately guarded student-link revocation. It checks the old DOM and
print-mode DOM **before refresh** and independently tests fresh API, Flight,
reload, browser history and new-tab access.

See [browser acceptance](PHASE1_7_BROWSER_SECURITY_ACCEPTANCE.md) and
[pupil workflow](PHASE1_7_BROWSER_PUPIL_WORKFLOW_RUNBOOK.md).

## Safe prerequisites

- Work only in the existing clean verification worktree
  at the exact reviewed Git commit, never in a Phase 8/9 worktree.
- Use a **fresh, unique synthetic browser fixture run ID**. The previous
  test link is terminally revoked. Do not reset or reuse it.
- Load the existing private test environment from
  ~/.config/myschoolboard/phase17-test.env without printing credentials.
- Confirm the exact worktree-specific PostgreSQL 17 test container on
  127.0.0.1:5434 is healthy, tmpfs-backed, and has 36 exact migrations.
  The script repeats the existing Docker and database safeguards.
- BETTER_AUTH_URL must equal http://127.0.0.1:3000. Start the compiled
  Next application in production mode on this loopback address, not on
  a shared or public host.
- The script uses external playwright-core at
  ~/.config/myschoolboard/phase17-playwright/node_modules/playwright-core/index.mjs
  and Chrome at /usr/bin/google-chrome, without adding app dependencies.

## Local execution sequence

The fixture and pupil HTTP prepare steps are **separate**, guarded,
one-time operations. Run the production server **before** the pupil
HTTP prepare phase.

In terminal A:

~~~sh
cd ~/Desktop/project/myschoolboard-format || exit 1
set -a
source "$HOME/.config/myschoolboard/phase17-test.env"
set +a

# Update BROWSER_FIXTURE_RUN_ID only in private config: choose a fresh run.
npm run verify:local:preflight
npm run verify:migration-checksums
npm run build
npm run verify:browser:fixtures
~~~

In terminal B:

~~~sh
cd ~/Desktop/project/myschoolboard-format || exit 1
set -a
source "$HOME/.config/myschoolboard/phase17-test.env"
set +a
NODE_ENV=production npm run start -- --hostname 127.0.0.1
~~~

After the server is ready, return to terminal A:

~~~sh
BROWSER_PUPIL_WORKFLOW_WRITE=1 \
  npm run verify:browser:pupil-workflow -- --phase=prepare
~~~

Install the isolated Chrome automation package if absent:

~~~sh
npm install --prefix "$HOME/.config/myschoolboard/phase17-playwright" \
  --no-save --no-audit --no-fund playwright-core
~~~

The following command carries separate opt-in for one authorized
**synthetic** revocation. The runner checks that positive student access
exists and saves private positive evidence **before** running the revoke
child. It never reuses revoked or partially failed fixtures.

~~~sh
BROWSER_PUPIL_WORKFLOW_WRITE=1 BROWSER_PUPIL_REVOKE=1 \
  npm run verify:browser:retained-tab
~~~

Do not paste credentials, cookies, IDs or raw browser logs into chat or
GitHub. Do not attempt any migration reset or fixture cleanup.

## Evidence meaning and limits

Evidence is stored outside Git under a private directory:
~/.config/myschoolboard/phase17-retained-tab/<synthetic-run-id>/

The runner creates files with mode 0600 and exclusive creation to prevent
overwriting prior evidence:

- positive.json: authorized student lesson list/detail, positive Flight
  and print-mode DOM assertions **before revocation**, plus sanitized
  route-aware cache metadata.
- post-revocation.json: old-tab DOM/print-mode DOM **without reload**,
  generated PDF byte counts, same-session API denial, replayed
  student-authenticated Flight, refreshed UI, browser history and new tab.

Private synthetic IDs and content do not appear in the JSON file bodies;
the fixture run label is limited to the private directory name. The PDF
is **not persisted**. PDF byte count does not prove text inclusion:
printing claims are limited to DOM evidence.

Flight captures categorize routes as student-lessons-page,
school-workspace or other; save status, content type, cache policy, and
whether synthetic lesson markers occurred. They never persist raw Flight
bodies, full URLs, query parameters, cookies or session headers.

A stale original tab can still display content it rendered before
revocation: this must be recorded, not misrepresented as a fresh server
authorization failure or as proof that old browser content was erased.

**No browser execution is claimed merely because these scripts exist.**
BR-12 and BR-14 remain open until owner-run evidence from a new guarded
fixture is reviewed. Other BR cases, including BR-16 positive guardian
access, are not addressed by this script.

The source-only regression tests are available independently:

~~~sh
node --test scripts/browser-flight-evidence.test.mjs
npm run verify:local:guards
~~~
