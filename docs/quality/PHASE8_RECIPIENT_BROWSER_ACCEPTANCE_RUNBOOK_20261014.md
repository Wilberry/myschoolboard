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

## Browser lifecycle and safe-print regression (added after the 60eaa44 checkpoint)

1. With synthetic verified guardian or pupil grades visible, switch to another tab. Check that this tab's DOM no longer contains the previous grade table; returning must issue a new uncached `GET /published-reports` before restoring any grade. Disable the student's membership or revoke the exact guardian link while the tab is hidden; returning must **not** restore sensitive content.
2. Navigate away and use browser Back (including a back-forward cache restoration). Check `pageshow.persisted` behavior, response headers, and that no previous grades flash before the current authenticated authorization completes.
3. Invoke keyboard Ctrl+P with grades visible but **without** clicking the report's explicit Print button. The confidential table must be absent from print preview. Next click the explicit Print button; confirm exactly one fresh same-origin/no-store GET succeeds before permitted grade rows appear in print preview. On print completion, another print must require new authorization.
4. Revoke the recipient relationship after grades have been shown, and then click Print: the new GET must deny and no grade-bearing print preview may be produced. Test this for both `STUDENT_ONLY` and `GUARDIAN_FIRST_ACK`.
5. Confirm recipient Back link returns to the signed-in school home, not an academic staff 404, while non-recipient roles still lack published-report access.
6. Validate browser support for deferred `window.print()`, `afterprint`/timeout behavior, print CSS visibility, live status messages, and a11y. Record browser version, synthetic account, revision SHA and pass/fail evidence. If printing cannot reliably wait for authorized React rows, fail closed and implement a compatible dedicated print view; never fall back to printing stale client state.

These browser checks have not been run in ChatGPT's source-only connector environment.

7. Switch between **separate browser windows** while a synthetic recipient report is displayed (not only tabs). On `focus` return, confirm an old report is cleared and an authenticated uncached GET completes before any grade reappears. Test account/session changes in another window while the recipient page remains open. Verify print, tab-visibility and window-focus listeners do not accidentally show a former account's confidential rows. This remains a manual real-browser acceptance check, not proof from source inspection.

## Further stale-response / account-switch acceptance (2026-10-14)

8. When guardian acknowledgment succeeds or fails in a synthetic session, verify grades **disappear immediately** before the POST finishes and reappear only after a new authenticated recipient GET. Exercise delayed server responses and duplicate receipts. A denied receipt must never leave stale grades available for a Print action.
9. Start a recipient GET, trigger another school/account change or a tab hide while the original GET is pending, then let the earlier response complete. Verify the cancelled request never restores grades, even when headers arrived before cancellation and the body finishes afterward.
10. Navigate between two verified school memberships without closing the application (synthetic records only). Because the report workspace is keyed by school ID, the previous school's child identity or grades must never flash while the new school is being verified. Reject page access when the second school is not independently authorized.
11. Start explicit Print authorization while an earlier GET is pending; delay the earlier response until after the print GET completes. Verify only grades returned by the fresh authorized print GET can appear in print preview. End the print dialog, trigger Ctrl+P again and confirm a separate current verification is required.

These new cases are **not yet performed in a real browser** and do not replace the existing release-gate/a11y/print checklist.

## Server-rendered page HTML headers (added October 14)

12. In a synthetic logged-in browser session, inspect **document navigation** response headers (not only the `/published-reports` API GET). Verify `Cache-Control: private, no-store, max-age=0` and `X-Robots-Tag: noindex, noarchive, nosnippet` plus `Referrer-Policy: no-referrer` for: `/schools/{schoolId}/published-reports`, `/report-publication`, `/private-report-compositions` and `/guardian-links`. Confirm no externally cacheable HTML copy or indexable result page, then test browser-history restoration separately because response headers alone cannot prove bfcache suppression. Check the build's real response headers rather than relying on source assertions.

## Local, read-only unauthenticated HTTP response smoke (2026-10-14)

The separately invoked `npm run verify:local:http` runs six **anonymous GET only** probes against a separately started local Next.js app. It checks that all four confidential page HTML routes refuse anonymous entry (307/308 redirect or 401/404), that the pupil-report API stays 404 when Phase 8 release/read gates are explicitly false, that a query-selected pupil ID gets 400, and that each response has private/no-store, noindex and no-referrer headers. Unlike source-level inspection, it exercises actual HTTP responses. It NEVER passes a cookie, sends a POST, mutates a database or enables a report feature.

Before starting the app, configure the same synthetic, loopback/tmpfs disposable PostgreSQL environment described above and complete `npm run verify:local:preflight`. Explicitly set BOTH `PHASE8_REPORT_RELEASE_ENABLED=false` and `PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED=false`. In the same shell configuration, set `PHASE8_HTTP_SMOKE_BASE_URL=http://localhost:3000/` and `BETTER_AUTH_URL=http://localhost:3000/`. Start the tested Next app in a separate test-only terminal using the existing `npm run dev` or built `npm run start` flow, then run `npm run verify:local:http`. The smoke preflight refuses any mismatch from the exact configured loopback app, wrong port, non-disposable DB environment, missing synthetic test credentials or either disclosure flag not explicitly set to false. If the actual Next response headers/redirects differ, inspect and repair the app; **do not suppress assertions to force a pass**.

This smoke does **not** create guardian/student memberships, prove a signed-in student's successful report delivery, test PDF preview, replace manual accessibility/browser verification or clear npm security findings. Its four isolated mock-transport tests passed under Node 22 in a tool container with a reduced safe-target verifier; real repository execution and live HTTP probes in the user's test worktree remain **pending**. No GitHub Actions configuration was changed.
