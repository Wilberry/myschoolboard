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

## 2026-10-16 Next.js anonymous redirect and cold-route acceptance

The first 2026-10-16 local Docker+Next HTTP smoke found two distinct issues: an initial five-second request timeout while the development server compiled a cold page, and an anonymous HTTP **307** with `Cache-Control: no-store` but no `private`. The smoke now allows up to 60 seconds *per request* for first compilation. RFC 9111 says `no-store` forbids every conforming cache from storing the response. Accept **only** a temporary 307 with `no-store` alone (no `public`, `s-maxage`, positive `max-age`); it must include `noindex` and `no-referrer` and redirect to the **same configured local app's root**. A missing or external Location and all 308 permanent redirects are failures. Nonredirect error pages and recipient API responses still require `private, no-store`. Actual success requires all six live probes, not just the mock-helper unit tests.

The synthetic verification agent should start its existing test Docker Postgres and Next app with both Phase 8 flags explicitly **false**, wait for the app to become responsive, then run `npm run verify:local:http` in the same verified test environment (with `PHASE8_HTTP_SMOKE_BASE_URL="$BETTER_AUTH_URL"`). Record the exact branch SHA, live status and security header values for each route without disclosing cookies or real pupil data. Keep the existing `npm run verify:local` full audit gate separate and unchanged. No GitHub Actions, real recipients or shared DB are allowed.

## 2026-10-16 optional real-Chromium synthetic-account acceptance harness — AUTHORED, NOT EXECUTED

The verified-branch continuation now provides two independent tools. Both use the existing `assertLocalVerificationTarget` disposable Postgres guard, require `schema=public`, and never infer relationships from shared surnames or email addresses.

**1. Read-only fixture readiness:**

With the test Docker `postgres-test` running, synthetic database environment from `docs/quality/LOCAL_CI_RUNBOOK.md`, and BOTH report-disclosure flags still `false`, set `PHASE8_BROWSER_SCHOOL_ID` to the exact disposable test school's generated ID and run `npm run verify:phase8:browser:fixtures`. The inventory returns ONLY booleans and counts: active school, current visibility mode, whether the latest policy has an independently released composition, numbers of active/unrevoked guardian/student linked pupils, and same-child overlap for `GUARDIAN_FIRST_ACK`. It refuses a missing release or unverifiable relationship and deliberately does **not** print pupil IDs, names, grades or credentials. When PHASE8_BROWSER_STUDENT_ID is set, the read-only checker also requires an active enrollment and the exact child inside a non-superseded current-policy frozen subject release; the query selects only a boolean, never marks or pupil JSON. Without an exact child ID this remains a school-level inventory, not proof that a particular child is released. This inventory still does not verify the supplied browser login credentials belong to the attested members; real authenticated browser requests must establish that separately. **The basic two-school demo seed cannot satisfy this check**: it seeds school owners, not student/guardian links or published academic compositions. Create a completely synthetic positive fixture through the existing Phase 7–8 academic, identity, owner approval and explicit release workflows; never bypass SQL/guardian security checks or leave fabricated records in shared data.

**2. Browser acceptance using independently signed-in synthetic PARENT and STUDENT accounts:**

Install Playwright as *test-only tooling outside the MySchoolBoard checkout*, for example in `/tmp/myschoolboard-browser-tools`, without editing this project's `package-lock.json`, dependency overrides or CI workflow. Supply an absolute `PHASE8_BROWSER_PLAYWRIGHT_ENTRY=/tmp/myschoolboard-browser-tools/node_modules/playwright/index.mjs`. If your local Chromium installation requires it, point `PHASE8_BROWSER_CHROMIUM_PATH` at the actual browser executable. The browser runner dynamically loads that external driver only when invoked; there is no added application dependency.

For this browser run **only**, start the Next.js app bound to loopback with the existing disposable synthetic `DATABASE_URL` and `TEST_DATABASE_URL`. Set both `PHASE8_REPORT_RELEASE_ENABLED=true` and `PHASE8_REPORT_RECIPIENT_ACCESS_ENABLED=true` in that isolated test-app process to exercise the existing independently approved frozen synthetic release. **Never enable either flag in a shared, deployed, production or live-school environment.** The browser process must use the same approved synthetic DB/Better Auth environment and set:

```sh
export PHASE8_BROWSER_DISPOSABLE_ACK=I_CONFIRMED_LOCAL_TEST_DB
export PHASE8_BROWSER_SCHOOL_ID='<exact synthetic school id>'
export PHASE8_BROWSER_STUDENT_ID='<exact linked synthetic child id>'
export PHASE8_BROWSER_EXPECT_MODE=GUARDIAN_FIRST_ACK  # or STUDENT_ONLY/GUARDIAN_ONLY
export PHASE8_BROWSER_EXPECT_ACKNOWLEDGED=false
export PHASE8_BROWSER_PARENT_EMAIL='synthetic-parent@example.test'
export PHASE8_BROWSER_PARENT_PASSWORD='<synthetic test password>'
export PHASE8_BROWSER_STUDENT_EMAIL='synthetic-student@example.test'
export PHASE8_BROWSER_STUDENT_PASSWORD='<synthetic test password>'
export PHASE8_BROWSER_PLAYWRIGHT_ENTRY=/tmp/myschoolboard-browser-tools/node_modules/playwright/index.mjs
npm run verify:phase8:browser:acceptance
```

The browser runner requires exact localhost port 3000, a schema-public loopback Docker test URL, synthetic `.test` account emails and the explicit disposable acknowledgment. It does **not** set disclosure flags itself. It starts two isolated browser contexts, signs in via the real login page, verifies each Better Auth session's synthetic email and exact session user against an active same-school role membership and independently attested non-revoked same-child link (even where student pre-ack reports are empty), fetches genuine authorized recipient APIs and rendered grades, verifies the school-policy role boundaries for `STUDENT_ONLY`, `GUARDIAN_ONLY`, or `GUARDIAN_FIRST_ACK` before/after receipt, denies URL child selectors, checks `no-store/noindex`, confirms cached grades cannot print with the raw browser shortcut, checks that a **fresh** authenticated read precedes the explicit Print button, and verifies synchronous DOM redaction on window focus. An optional `PHASE8_BROWSER_FOREIGN_SCHOOL_ID` enables a 404 cross-tenant GET check for a school where the synthetic pupil has no role.

For a **pre-acknowledgment `GUARDIAN_FIRST_ACK` fixture only**, setting `PHASE8_BROWSER_ALLOW_RECEIPT_WRITE=1` makes the harness click the exact published subject acknowledgment button and then verify the linked STUDENT's separately authorized access. This writes one **immutable synthetic receipt** to the disposable database; it is OFF by default. Do not use this option on a reused receipt or the wrong policy. Never use the real parent, pupil or staff credentials.

**Limits:** This script currently exercises genuine authenticated browser/API routing and a stubbed `window.print()` capture to verify what would enter the print pipeline; it does **not** generate or visually inspect a native PDF, run a screen reader, provision test identities, emulate real revocation itself or demonstrate bfcache restoration across a real login change. Those remain manual acceptance tasks from the matrix above, along with checking all four policy changes and multi-child segregation. Browser script and fixture tests are newly AUTHORED; no real Chromium acceptance result is claimed for the latest branch revision. Keep evidence redacted and record exact SHA, Chromium/Playwright version, synthetic fixture identifiers held locally (not in the report), cases and failures. Turn report feature flags OFF after the isolated run; no production/report release follows from a green browser harness.

## 2026-10-16 browser harness correctness hardening — source committed, browser execution outstanding

The browser fixture inventory now accepts an **optional exact synthetic child ID** using `PHASE8_BROWSER_STUDENT_ID`; it must find that child's own active/unrevoked link(s) under the current adopted visibility mode. A different child in the same school must not make the selected fixture appear ready. The standalone headless runner always supplies its expected child ID to this prerequisite; it still checks the actual returned rows against that ID and policy.

The real-browser runner now additionally:
- verifies the Docker Compose `postgres-test` specification is tmpfs-backed with a single `127.0.0.1:5434->5432` port and that the container responds to `pg_isready` **before** loading the browser/Prisma or initiating the optional guardian acknowledgment POST;
- waits for an actual fresh `GET /published-reports` initiated by the authorized Print click, verifies HTTP 200, `no-store/noindex`, nonempty result and exact child/mode, then checks the explicit print callback was authorized and the immediate `afterprint` event removed grade rows/permission;
- synthesizes `pagehide` and `pageshow.persisted` events while authorized grades are visible, asserts synchronous redaction and fresh private HTTP reauthorization; this **does not** emulate a full genuine Chromium bfcache restore or account revocation;
- reports `auditedReceiptWritten` according to an actual successful test-only guardian-first acknowledgment, not merely whether the opt-in environment flag was present.

Pure JavaScript syntax/source checks and exact-child predicate assertions passed in the available tool environment; **full local Node tests, formatting/ESLint, latest-head database/Vitest/Next build and actual real Chromium have not yet run on these commits**. Safety warning: the test browser and Next app require temporary test-only recipient gates `true` only against the verified isolated Docker test database with disposable synthetic identities. Keep both flags `false` by default and after tests; never enable them for real schools. The local operator must separately inspect Docker context and forwarded ports; a loopback bind alone cannot prove a Docker daemon is not remote. No browser-fixture creation, production publication, CI relaxation, merge or deployment was performed.

## 2026-10-16 remote Docker context and simultaneous-work protection

The optional browser command also verifies the active Docker daemon connection uses a **local Unix-domain socket**, refusing `ssh://`, `tcp://` and `http(s)://` endpoints, and checks Compose tmpfs/loopback storage and `pg_isready`. This is defense in depth, not a substitute for local human confirmation that the Docker socket is attached to the expected disposable test instance. New negative tests cover this case; targeted isolated Docker-host predicate assertions **5/5 passed**, actual repo Node/Chromium still pending.

**Do not run the experimental Prisma compatibility test and recipient browser acceptance at the same time against `localhost:5434/myschoolboard_test`.** Both processes reference the same disposable database: Prisma migrations/seed during the experiment could invalidate receipt, link, release and browser verification evidence. Develop the branches simultaneously, but serialize any database-mutating or live-browser verification against the shared test container. Likewise coordinate Phase 9 database tests if they use the same port/service. Keep the signed-in browser verification session test-only, private, and report gates OFF outside the isolated test-app process.

## 2026-10-16 browser session to exact child proof (AUTHORED, NOT CHROMIUM-VERIFIED)

The signed-in browser acceptance harness now fetches `/api/auth/get-session` using each isolated browser context's cookies; it compares the authenticated user to the selected synthetic account and confirms via read-only Prisma that this exact user has an active same-school PARENT/STUDENT membership and currently attested, non-revoked link to the selected enrolled child. A different student's session can no longer pass the `GUARDIAN_FIRST_ACK` pre-receipt empty-result assertion just because some other synthetic student has a link. No receipt or user identity is written or logged. Mock regressions authored; full installed Node/Prisma/Chromium/print/a11y and strict security audit remain pending. Confirm the actual Better Auth get-session response in the isolated browser; fail closed on a mismatch.

## 2026-10-16 exact-subject guardian acknowledgment browser assertion — AUTHORED, NOT EXECUTED IN CHROMIUM

For an explicit `GUARDIAN_FIRST_ACK` test-only receipt, the browser runner now identifies the **actual clicked report table row** through its `data-release-id`, captures a **fresh GET** after the acknowledgment POST, confirms the exact release flipped from unacknowledged to acknowledged, waits for the corresponding rendered row, and verifies the student's newly fetched report contains **exactly that released subject** (not a different previously acknowledged subject or an unrelated child). Negative source tests reject the wrong clicked subject, unchanged acknowledgment, stale pre-receipt student report, and multiple/unrelated post-receipt subjects. The opaque release ID already comes from the authenticated allowlisted recipient API; no new unauthenticated endpoint, mutation, migration or production flag is introduced. The full Node/Vitest, disposable DB, actual signed-in Chromium, native Save as PDF and accessibility checks remain open.
