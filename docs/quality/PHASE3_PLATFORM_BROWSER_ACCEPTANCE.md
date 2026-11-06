# Phase 3 authenticated platform-console browser acceptance

**Status:** EXECUTED — P3-BR-01..10 and P3-BR-12..13 passed at
`55dab6cd659d0200a3db86babbc274c9e5e5d8a8`; P3-BR-11 is **PARTIAL**
because actual 200% browser zoom was not established. This is scoped
browser evidence only; Phase 3 and Phase 1–7 remain open.
The earlier 37/37 migration, 117/117 Node tests, 327/327 Vitest tests
and production-build/audit passes at
`e249955e64fafe5887a536074f8547ff25d3584f` remain historical evidence.

## Execution record — 2026-11-01

- Branch: `verify/pr97-integrated-pupil-workflow`.
- Application/test SHA: `55dab6cd659d0200a3db86babbc274c9e5e5d8a8`.
- Fixture-source SHA: `1f2a58cb8ce00275ea0e9db6c4ca12711ca00993`.
- Synthetic run: `p3b-b81242077a`; browser: Chrome `148.0.7778.96`.
- The existing disposable PostgreSQL 17 target had already passed the
  read-only target guard and exact **37/37** migration checksum check at
  this SHA. No migration deployment or database reset was performed for
  this browser run. The browser matrix added synthetic plan/subscription
  history through the authorized operator UI/API only.
- Cases P3-BR-01..13 were executed; P3-BR-01..10 and P3-BR-12..13
  passed. P3-BR-11's labels, focus, required-field feedback, narrow
  viewport and 2x visual-scale observations passed, but that scale change
  did not establish actual browser zoom at 200%; this subcriterion remains
  open. P3-BR-14, the optional operator-role-revocation browser probe,
  was not run.
- The first private browser result file contains 27 PASS and 7 FAIL
  entries. All seven failures were probe instrumentation limitations:
  one anonymous Flight request used an empty route-state header and
  returned HTTP 500; five Flight response bodies were not retained by
  CDP; and the school-admin probe could not derive a route-state header.
  The original file is preserved unchanged. Follow-up requests replayed
  the actual route-state captured from the operator's `/platform`
  navigation. Anonymous and school-admin responses were private/no-store
  and contained no synthetic school or plan markers. The operator's
  content-bearing response was private/no-store and contained the
  expected operator heading and both synthetic school markers.
- A separate route-attributed prefetch shell returned HTTP 200,
  `text/x-component`, `s-maxage=31536000`, and a 215-byte body with no
  protected school or plan markers. Protected console data was observed
  only in private/no-store responses. No cache policy or authorization
  behavior was changed to obtain these results.
- The anonymous invalid probe is not a route failure: its empty
  `Next-Router-State-Tree` was produced by selecting a prefetch response
  that had no route-state header. With the actual captured route state,
  anonymous Flight returned HTTP 200 `text/x-component`,
  `private, no-cache, no-store, max-age=0, must-revalidate`, with no
  protected markers. The streamed school-admin document remained HTTP
  200 with a 404-style not-found title and `noindex`; it is not reported
  as an HTTP 404.

| Case | Result | Observed outcome |
| --- | --- | --- |
| P3-BR-01 | PASS | Anonymous HTML, print, history and route-state Flight contained no protected names; fresh route-state Flight was private/no-store. |
| P3-BR-02 | PASS | All three anonymous GET APIs returned 401/private/no-store without school metadata. |
| P3-BR-03 | PASS | School admin had no platform link/data; streamed `/platform` was HTTP 200 with 404-style UI and `noindex`. |
| P3-BR-04 | PASS | Five unauthorized GET/POST probes returned generic 404/private/no-store; no mutation was observed. |
| P3-BR-05 | PASS | Platform operator saw the platform link, console heading and both synthetic schools. |
| P3-BR-06 | PASS | Catalog and school status reads were 200/private/no-store, aggregate-only, with PENDING and SUSPENDED states distinct. |
| P3-BR-07 | PASS | Operator form created and reread a plan revision; validation controls were also exercised. |
| P3-BR-08 | PASS | Operator created an explicit subscription period; school remained PENDING/inactive. |
| P3-BR-09 | PASS | Overlap returned 409/private/no-store; adjacent period returned 201; no overlapping history was added. |
| P3-BR-10 | PASS | Switching schools showed no stale School A subscription observation for School B. |
| P3-BR-11 | PARTIAL | Labels, keyboard focus, required-field feedback, 2x visual scale and narrow-screen no-overflow were observed; actual 200% browser zoom was not verified. |
| P3-BR-12 | PASS | Print/history/duplicate-tab observations were captured; after sign-out fresh access returned to sign-in, APIs denied access, and Back/Forward disclosed no fresh protected response. |
| P3-BR-13 | PASS | Route-attributed Flight evidence separated the generic shared-cache shell from private/no-store operator and denial payloads. |

At this exact SHA, fresh `npm test` passed **122/122 Node tests** and
**327/327 Vitest tests across 39 files**, with no skips or failures.
Prettier, ESLint, TypeScript, production build,
`npm audit --audit-level=high`, full `npm audit`, and `git diff --check`
passed; both audits reported **0 vulnerabilities**. These current-SHA
results are distinct from the earlier historical 117/327 suite at
`e249955`. P3-BR-11's unverified browser-zoom subcriterion and full local validation
do not complete
The unverified zoom subcriterion and these scoped browser/engineering
results do not complete PLAT-REQ-001, SUB-REQ-001, SEC-REQ-001,
TEN-REQ-001, USR-REQ-001 or Phase 1–7 acceptance.

## Purpose and scope

Use synthetic identities to exercise the actual compiled, authenticated
`/platform` page, its separate server-guarded JSON APIs and the browser
history/Flight/printing/keyboard surfaces. No school-personal records, real
guardians, real billing, financial data or production roles may be used.

The browser milestone is for **PLAT-REQ-001, SUB-REQ-001, SEC-REQ-001,
TEN-REQ-001 and USR-REQ-001**, and the relevant Phase 1–7 browser
security/privacy boundaries. It does not complete later-phase parent
portals, entitlement enforcement, payment processing, automatic expiry or
the entire platform administration specification.

## Safe fixture prerequisites

- Work only in the clean checked-out
  `~/Desktop/project/myschoolboard-format`, branch
  `verify/pr97-integrated-pupil-workflow`. Record **exact HEAD**.
- Require the existing private
  `~/.config/myschoolboard/phase17-test.env` and the verified
  worktree-owned `postgres-test`, healthy PostgreSQL 17 with tmpfs, no
  host binds and only `127.0.0.1:5434/myschoolboard_test`.
- Run read-only `verify:local:preflight` and
  `verify:migration-checksums`; require **37/37**. Do NOT run the
  original pre-migration or fresh-empty bootstrap preflight after the 37
  migrations are present.
- If there are no suitable **existing synthetic-only** Platform Super
  Admin and school-admin accounts, the dedicated
  `verify:browser:phase3:fixtures` command may prepare two NEW test
  identities and two NEW synthetic schools. It requires a distinct
  `PHASE3_BROWSER_FIXTURE_WRITE=1` opt-in, an unused lower-case run
  label and a separate secret `PHASE3_BROWSER_PASSWORD` of at least
  16 characters. It checks the same strict Docker/DB/commit boundaries,
  then creates only synthetic school A (PENDING, isActive=false),
  school B (SUSPENDED, isActive=false), a synthetic platform operator
  and an ordinary school A administrator. Only the **new synthetic**
  operator is assigned `platformRole=SUPER_ADMIN` for the local test.
  The ordinary user is never elevated. The synthetic password is not
  printed or committed.
- The generator is **NOT** normal product onboarding, and its
  role assignment must never run in a real/shared database. It does
  not create plans/subscription periods. Those writes must be tested via
  the operator's actual browser forms/authorized APIs. If sign-up or the
  transaction fails, there may be partial synthetic accounts; **stop**
  and inspect. Never retry the same run ID or automatically delete/reset.
- This test fixture source and its policy tests are **unexecuted** until
  the operator runs local Node tests, formatting, lint and TypeScript.

A minimal guarded fixture sequence, once the new code passes local tests:

```sh
cd ~/Desktop/project/myschoolboard-format || exit 1
test -z "$(git status --porcelain --untracked-files=all)" || exit 1
(
  set -e
  set -a
  source "$HOME/.config/myschoolboard/phase17-test.env"
  set +a
  npm run verify:local:preflight
  npm run verify:migration-checksums

  # Choose a fresh unique lowercase label, never reuse a failed one.
  export PHASE3_BROWSER_RUN_ID=platform-nov01a
  export PHASE3_BROWSER_FIXTURE_WRITE=1
  read -rs -p "New synthetic Phase 3 browser password: " PHASE3_BROWSER_PASSWORD
  printf '\n'
  export PHASE3_BROWSER_PASSWORD
  npm run verify:browser:phase3:fixtures
  unset PHASE3_BROWSER_FIXTURE_WRITE PHASE3_BROWSER_PASSWORD
)
```

The script prints **only** synthetic school IDs/emails, the source SHA,
test migration count and a note that the password is private. Retain the
manifest in a private, access-restricted evidence directory outside Git.

## Production-compiled local server

Run the application already built at the reviewed SHA and point it
**only** to the verified disposable test database. For a Next.js
production-mode server, load the private test DB/auth secrets and start
the compiled app with `NODE_ENV=production` *in its own process*
on `127.0.0.1:3000`. Keep the fixture-preparation process
`NODE_ENV=test` and do not write fixture accounts through the
production-mode process. Ensure the browser reaches the exact
`BETTER_AUTH_URL` loopback origin. Do not alter auth cookie security
settings, password length rules or production authorization to ease testing.

Use independent Chrome profiles/browser contexts for anonymous, school
administrator and Platform Super Admin; clear/recreate only these
disposable browser profiles, never persistent owner browser data.
Do not install Playwright in the repository or alter the lockfile just
to run manual browser acceptance. If a compatible external Playwright
tool is present, use it only with the same local-only boundary and
without capturing raw cookies, auth headers, student data or full HARs.

## Required browser acceptance matrix

The following matrix defines the required observations; execution
outcomes for the exact SHA above are recorded in the table above.

| Case | Actor and action | Required browser/HTTP observation |
| --- | --- | --- |
| P3-BR-01 | Anonymous GET `/platform` | No platform school/plan names in response, Flight, visible DOM, history or print; redirect or correct not-found UX as documented |
| P3-BR-02 | Anonymous plan, school subscription and status GET APIs | Each returns 401 with `Cache-Control: private, no-store`, no school metadata |
| P3-BR-03 | Signed-in synthetic School A Admin visits `/platform` by direct URL and home navigation | No platform administration link, private school catalog, subscription details or plan editor; streamed 200 with not-found + `noindex` is NOT to be mislabeled as HTTP 404 |
| P3-BR-04 | Same school-only actor requests plan/subscription/status GET/POST | 404/private/no-store with generic failure; no school B metadata; no mutation |
| P3-BR-05 | Signed-in synthetic Platform Super Admin opens home and then `/platform` | Only this role sees platform link; actual page renders operator heading and authorized synthetic school A/B names |
| P3-BR-06 | Platform operator reads catalog and exact-school status API | 200/private/no-store; no student/staff identity, only aggregate counts; PENDING and SUSPENDED lifecycle remain separate |
| P3-BR-07 | Operator creates plan revision using browser form and reads catalog | 201/private/no-store; exact code/version/features shown; preexisting versions unchanged; validation errors generic and accessible |
| P3-BR-08 | Operator assigns explicit period to school A | 201/private/no-store; selected school A shows period and UTC timestamps; school A remains PENDING/inactive |
| P3-BR-09 | Operator attempts overlapping period for school A | 409/private/no-store; no extra history record; adjacent periods may be accepted when dates align exactly |
| P3-BR-10 | Switch selection between school A and school B | No stale school A status/period shown as school B; no cross-school subscription history contamination |
| P3-BR-11 | Keyboard-only form traversal, required input errors, 200% browser zoom, narrow viewport | Functional labels, focus, visible errors/status, no inaccessible control/hidden action; record any usability failures |
| P3-BR-12 | Print / browser Back/Forward / duplicate tab / sign out then fresh access | No protected operator data returned on any new unauthorized HTML, Flight or API request; distinguish previously rendered in-memory snapshots from fresh server disclosure |
| P3-BR-13 | Capture **route-attributed** `text/x-component` requests for operator links and denial | Log precise route, role, status, content type and cache header; never assume generic `s-maxage` belongs to protected operator content without route attribution |
| P3-BR-14 | Server-side role revocation of a strictly synthetic operator (separately guarded, if approved) | Existing signed-in session denied on fresh APIs/HTML and no new protected Flight; no effect on another tenant; DO NOT use direct production account mutation |

## Closing P3-BR-11: genuine Chrome 200% page zoom

**Still PENDING.** The scoped Chrome 148 run at application SHA
`55dab6cd659d0200a3db86babbc274c9e5e5d8a8` proved labels, required
validation, keyboard focus, a narrow viewport and a simulated 2× visual
scale. Repeated automated keyboard shortcuts left `devicePixelRatio` and
`innerWidth` unchanged; **they did not verify browser zoom**. CDP
`Emulation.setPageScaleFactor`, mobile emulation and
`--force-device-scale-factor` are **not interchangeable** with Chrome's
desktop page zoom. Do not turn that historical result into a PASS.

The remaining subcase must be completed on the **same reviewed code SHA**
(or clearly attributed to a new code SHA) and on the existing verified
local synthetic browser fixture. Do not provision another fixture or
reapply migrations to inspect zoom. Preserve the 37/37 migration and
122/327 regression results already obtained for `55dab6c`.

1. Confirm the exact branch, clean worktree, source SHA and Docker target.
   Use the existing local-only production build and private test
   environment. Start the application bound to `127.0.0.1:3000`.
   In Chrome use the **same hostname as the existing configured
   `BETTER_AUTH_URL`** (previous local browser used
   `http://localhost:3000`); mixing `localhost` and `127.0.0.1`
   can invalidate same-origin Better Auth cookies and is not an
   application-authentication failure.
2. Use a disposable Chrome profile and sign in **only** as the existing
   synthetic Platform Super Admin. Visit `/platform` and verify the
   subscription console is rendered. Do not show credentials in
   screenshots or save cookies, HAR archives, response bodies or school
   identifiers. Leave the historical plan/period data unchanged.
3. Hold the desktop browser's **outer window dimensions constant**.
   Open Chrome's three-dot menu and confirm its **Zoom reads 100%**.
   In DevTools Console (on the `/platform` tab) run the safe
   measurement expression below and copy only the **numeric/boolean**
   observation to private evidence. It contains no names or values.
4. Using the **Chrome UI zoom control**, increase **Zoom to 200%**.
   Confirm the menu visibly reads **200%**, not `visualViewport.scale=2`
   produced by a CDP emulation command. Record the 200% setting as an
   operator-observed fact and rerun the same expression at the
   **same outer window size**. Reload `/platform` once and recheck
   that the authorized heading, plan and subscription forms remain
   usable.
5. At 200%, use Tab and Shift+Tab to reach the school selector, plan
   selector, required inputs, submit buttons and the Back link. Confirm
   visible keyboard focus, label association, reachable status/error
   messages and no overlapping/cropped critical controls. Switch between
   the **existing synthetic** schools without saving changes and verify
   the selected school is unambiguous and no stale subscription history
   is presented as belonging to the other school. Test required
   validation without submitting a valid mutation.
6. If there is horizontal overflow, record the **numeric** widths and
   the inaccessible control, but do not automatically fail the whole
   application based only on a long string or a console-only element.
   Horizontal scrolling that makes a required action inaccessible or
   hides its label is a **FAIL**. Distinguish page reflow defects from
   Chrome's own DevTools or toolbar size.
7. Restore 100% zoom (`Ctrl+0` or the Chrome zoom menu), sign out,
   and stop **only** the local test application process. Do not reset,
   reseed or stop an unrelated container.

Run **this exact expression** at 100% and 200%:

```js
(() => {
  const root = document.documentElement;
  const controls = [...document.querySelectorAll("input, select, textarea, button")];
  return {
    routeIsPlatform: location.pathname === "/platform",
    dpr: window.devicePixelRatio,
    innerWidth: window.innerWidth,
    clientWidth: root.clientWidth,
    scrollWidth: root.scrollWidth,
    viewportScale: window.visualViewport?.scale ?? null,
    inputCount: controls.length,
    unlabeledInputs: [...document.querySelectorAll("input, select, textarea")]
      .filter((el) => !el.labels?.length && !el.getAttribute("aria-label"))
      .length,
    platformHeadingPresent: Boolean(document.querySelector("#platform-heading")),
    focusVisibleElement: Boolean(document.activeElement && document.activeElement !== document.body),
  };
})()
```

Before calling P3-BR-11 **PASS**, record all of: actual Chrome
zoom menu **200%**, source SHA and browser version, the 100% and 200%
numeric measurements, observed form/keyboard and error usability,
absence of clipped/inaccessible required controls, and recovery after
reload and return to 100%. As corroboration at unchanged outer window
size, desktop page zoom normally increases the ratio
`dpr_200 / dpr_100` to approximately **2.0** and reduces the CSS
`innerWidth` materially; a 2× `visualViewport.scale` alone is
**not** proof. If a desktop/OS display setup produces different
measurements, preserve the difference and classify it for review,
rather than changing thresholds or inventing a zoom pass.

Write only sanitized P3-BR-11 evidence (source SHA, case, browser
version, 100% and 200% metrics, manually witnessed Chrome-menu zoom
setting, focus/reflow result, PASS/FAIL/BLOCKED and date) in the
private evidence directory. Never commit credentials, private profile
files or user/session data. Update the cumulative acceptance ledger
only after observing this specific subcase; do not generalize a
scoped console zoom pass into full Phase 3 functional or accessibility
acceptance.

Observe all actual response statuses and headers. Next.js streamed not-found
pages may have HTTP 200 while showing a not-found UI with `noindex`;
**record both**. A fully server-returned private API 404 is different.
Do not claim a browser history replay has no stale DOM content if
the browser still holds already-rendered elements; classify that
separately from server-side access control.

Save a minimal private result table with: case ID, timestamp, exact
commit SHA, browser version, synthetic run ID, actor role, route, HTTP
status, content type, route-attributed cache header, expected vs observed
outcome, and PASS/FAIL/BLOCKED. Avoid cookies, passwords, real user
details, identifiable student data, full response bodies and screenshots
containing auth credentials. Evidence with sensitive synthetic state
belongs outside Git in a mode-0700 directory; sanitized result totals
alone may be committed.

## Completion rules

- New fixture preparation is not itself positive browser evidence.
- All essential cases P3-BR-01..13 must have captured results, not
  checkboxes or assertions based on code inspection. P3-BR-14 is an
  optional additional post-revocation browser probe; existing DB tests
  remain valid for the narrower role-revocation boundary.
- After any fixture source code changes, rerun at least the new policy
  Node tests, formatting, lint and typecheck at the new exact code SHA;
  do not quietly attribute the earlier 117/327 results to that SHA.
- No real payments, automatic subscription suspension, enforcement
  of advisory quotas, production role changes, shared data, PR merge
  or deployment are authorized by this runbook.
- Record browser results in the cumulative acceptance ledger. Only
  when executed can browser acceptance move from PENDING to PASS for
  the covered cases. Full Phase 3 and Phase 1–7 acceptance remain OPEN.
