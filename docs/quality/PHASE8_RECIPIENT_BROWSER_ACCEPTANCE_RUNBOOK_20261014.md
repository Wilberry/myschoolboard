# Phase 8 recipient browser / privacy / printable report acceptance

**Status: execution required; not a release approval.**  
**Context:** `verify/phase8-local` in a separate worktree; synthetic loopback-only `myschoolboard_test` at `localhost:5434`; no real pupils, no shared database, no GitHub Actions.

## Preconditions (must all hold)

1. `git status --short --branch` confirms the intended verification worktree and revision. Do not alter the separate Phase 1 checkout.
2. Verify the `postgres-test` Docker Compose service uses loopback port 5434, a tmpfs, and `myschoolboard_test`. Run `npm run verify:local:preflight` with the project's established `NODE_ENV=test`, `TEST_DATABASE_DISPOSABLE=1`, `ALLOW_DEMO_SEED=1`, equal loopback `DATABASE_URL`/`TEST_DATABASE_URL`, test-only Better Auth secret, `BETTER_AUTH_URL=http://localhost:3000`, and synthetic `.test` admin credentials.
3. Before any deploy, run `npm run verify:local:checksums`. Do not edit/checksum-resolve applied migration files when there is drift; stop and review a forward-only path. Never reset a non-disposable database.
4. Keep `PHASE8_REPORT_RELEASE_ENABLED=false` and `PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED=false` as **deployment defaults**. Only synthetic test fixtures within the disposable DB may temporarily enable them. Never use a live-school dataset.
5. After `npm ci` and `npm run db:generate`, run `npm run verify:local:guards` and `npm test`; new cases cover `GUARDIAN_FIRST_ACK` positive/negative, `STUDENT_ONLY` positive, both relationship revocations, denied HTTP cache headers, and server-rendered empty report shell. Then `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`. `npm run verify:local` repeats the full sequence and **must still fail at the high audit gate** until compatible upstream fixes are validated.

## Real-browser acceptance matrix (synthetic account sessions only)

| Case | Verify in signed-in browser | Expected |
| --- | --- | --- |
| Unauthenticated or wrong-school recipient | Open school published-reports URL and private GET | Login/404; no grade, pupil roster, answer key, packet JSON or cached static output |
| SCHOOL_ONLY | Owner explicitly adopts but does not release | Neither parent nor student sees grades; a policy alone is no publication |
| GUARDIAN_ONLY | Owner separately releases exact complete frozen composition | Only current independently attested parent sees exactly their child and released subject |
| GUARDIAN_FIRST_ACK before receipt | Sign in as current verified STUDENT | No released grade visible; absence of receipt does not create student permission |
| Guardian acknowledgment | Sign in as current verified PARENT, inspect exact subject and confirm receipt | Explicit action for exact release and child only; duplicate/replayed receipt denied |
| GUARDIAN_FIRST_ACK after receipt | Switch to verified STUDENT session | Only the exact corresponding released subject grade appears; no siblings, other school or raw marks |
| Guardian deactivation or terminal link revocation | Deactivate parent or revoke link in synthetic fixture; reload student's portal | Guardian's old receipt no longer enables student access; frozen history remains |
| STUDENT_ONLY | Owner adopts later revision and separately re-releases | Linked student sees only latest release; no parent receives grade |
| Student account revocation | Revoke verified student link; reload | Grade disappears and cannot be fetched; history is not edited |
| New policy without new release | Adopt a newer mode, do not publish it | Old release does not reappear under new mode |
| Query-selected child | GET published-reports with `?studentId=...` or another search filter | 400 generic error, private no-store/noindex; never list another pupil |
| Privacy/print | Open authorized report, keyboard navigate, screen-reader read column headers/caption, print preview / Save as PDF | Child/session/term/class header and the specific released subject(s), score, grade, remark and version; navigation, receipt buttons and other print-hide controls absent in print; no publicly hosted file |
| Denied/error responses | Inspect Network tab with cache disabled and enabled | Generic 400/401/404/409; private no-store, noindex, no private grades in URL, prefetch, shared cache, console, static HTML or error messages |
| Multiple children and subjects | Use independently verified synthetic guardian links to two pupils | Each child segmented into the correct school/session/term/class; no unlinked sibling, unrelated class or draft grades |

**Accessibility:** Keyboard access for all controls including print, form labels, disabled state and live status, correct table headings and caption, readable contrast, print page breaks, and no accidental acknowledgment triggered by reading. Record browser/viewport/version, exact account roles, test fixture IDs, and a redacted evidence log. Avoid saving screenshots or printable documents containing actual student personal data.

**Deliverable:** record results in a dated QA note with revision SHA, synthetic DB migration count, completed cases, failures, privacy/security findings, and any compensating fixes; rerun full suite after changes. Do not mark Phase 8 accepted, merge, deploy or turn on server disclosure flags while the strict `npm audit --audit-level=high` gate is failing or any mandatory recipient/print case lacks evidence. No GitHub Actions are necessary to execute this locally.
