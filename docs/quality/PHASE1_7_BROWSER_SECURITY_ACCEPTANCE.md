# Phase 1–7 authenticated-browser security acceptance (synthetic only)

**Status: PARTIALLY EXECUTED; NOT ACCEPTED.** Initial synthetic browser
checks are recorded in
[PHASE1_7_BROWSER_EVIDENCE_2026_10_21.md](PHASE1_7_BROWSER_EVIDENCE_2026_10_21.md).
This is an evidence-gathering protocol, not proof that the current app is
browser- or production-ready. The cumulative local
Vitest and source-guard checkpoint is documented separately. Perform every
test against **one exact reviewed commit**, running on a **local-only**
instance with a verified disposable PostgreSQL database. Follow
[LOCAL_CI_RUNBOOK.md](LOCAL_CI_RUNBOOK.md) for DB/container checks.
The opt-in [synthetic browser fixture runbook](PHASE1_7_BROWSER_FIXTURE_RUNBOOK.md)
provides separate teacher, Head, Principal and pupil accounts for this
matrix, but **does not itself execute a browser test or approve a school
workflow**. The staged
[positive pupil and lesson-release HTTP runbook](PHASE1_7_BROWSER_PUPIL_WORKFLOW_RUNBOOK.md)
describes how to prepare the missing *authorized business records* without
directly fabricating their audit events, and how to revoke a synthetic
student link **only after** actual browser-visible positive access is
captured. These commands still require local execution and do not
substitute for Chromium/RSC/history/printing checks.
Do not use actual pupils, guardians, contact records or payment data.

## Owner-reported browser evidence — 2026-10-30

At base commit `d8e80e0`, the owner reports that synthetic pupil workflow
preparation and verification passed, and Chromium displayed the released
lesson list, detail and content for the linked student. Reported browser
checks also covered Back/Forward, duplicated tabs, authorized print preview,
and basic keyboard navigation/focus. The School B student-lessons API denied
access with HTTP 404 and `Cache-Control: private, no-store`.

The School B rendered page showed a not-found UI, but its streamed HTML
document returned **HTTP 200**. Record this as a streamed 200 with a 404
presentation, not an HTTP 404. This is consistent with the documented
Next.js streaming behavior; do not change the route solely to force a
non-streamed status. The report does not include captured RSC payloads or
post-revocation history/print results, and it is not a reproducible automated
browser report. The BR-01..BR-16 gate remains partial and not accepted.

## 2026-10-31 authenticated-browser execution attempt — BLOCKED

Exact verification checkout: `verify/pr97-integrated-pupil-workflow`,
`686891dac5887601df401d35acc4b222159bd403`. The worktree was clean.
The exact worktree Compose target passed `assertLocalDockerFixtureTarget`:
local Unix-socket Docker context, this worktree's `postgres-test`, PostgreSQL
17 Alpine, running/healthy, database `myschoolboard_test`, loopback-only
`127.0.0.1:5434`, tmpfs database storage and no host bind were verified.

The guarded test-environment preflight did **not** pass. This worktree has no
`.env`, `.env.local`, `.env.test` or `.env.test.local`; required test-only
database, auth, fixture-write, unique fixture-run, and pupil workflow settings
were absent. `npm run verify:local:preflight --if-present` exited 1 with
`Local CI requires NODE_ENV=test`. No credentials or fixture password were
printed or copied from another worktree. The prior private fixture directory
was absent. Although Chrome 148.0.7778.96 is installed, no application was
listening on `127.0.0.1:3000`, and the repository does not have the Playwright
package installed.

No database connection, fixture preparation, migration verification,
application start, browser request, or student-link revocation was performed.
No HTTP status was observed in this attempt. In particular, there is no new
evidence for the streamed-document 200 / not-found UI distinction, private
HTML/RSC, browser history, duplicate tabs, printing, or accessibility.
`BROWSER_PUPIL_REVOKE=1` was not set, and no revocation occurred. The reported
baseline of 36/36 migration checksums and the non-browser test suites is
provided by the operator; it was not rerun here.

| Case | Result on this exact checkout |
| --- | --- |
| BR-01 through BR-10 | BLOCKED — guarded environment/app unavailable; no browser status or payload evidence |
| BR-11 | BLOCKED — no authenticated positive student browser session; preserve positive link and lesson state |
| BR-12 | BLOCKED — no positive-browser evidence captured; revocation prerequisites unmet; no revocation performed |
| BR-13 through BR-15 | BLOCKED — browser app unavailable; history/cache/print/accessibility not inspected |
| BR-16 negative parent boundary | BLOCKED — not exercised in this attempt |
| BR-16 positive guardian portal | NOT IMPLEMENTED — no verified guardian-to-child portal capability is established by this matrix |

This is an environment blocker, not an application pass or failure. Restore
the private synthetic-only configuration locally in this verification
worktree, then rerun the documented guarded preflight and migration check.
Capture positive authenticated browser access first; only then may the
separately guarded synthetic revocation phase be considered. Do not copy or
paste credentials into chat or use another worktree's environment.

## 2026-10-31 authenticated-browser execution — scoped evidence, NOT ACCEPTED

The earlier blocked attempt above is historical and is superseded by this
later execution. Exact tested application commit:
`686891dac5887601df401d35acc4b222159bd403`, branch
`verify/pr97-integrated-pupil-workflow`. The private test configuration
existed with mode 0600 and was sourced only in protected subshells. The
repository disposable-target preflight passed. Read-only migration integrity
passed **36/36 exact applied migrations**. Docker identity was rechecked:
this worktree's healthy PostgreSQL 17 Alpine `postgres-test`, database
`myschoolboard_test`, loopback `127.0.0.1:5434`, tmpfs, no host bind.
Production-compiled app and Chrome 148.0.7778.96 were used locally.

The synthetic pupil/lesson prepare phase used the guarded product HTTP
workflow. Positive browser evidence was saved privately before revocation.
Only after that evidence existed, the separate `BROWSER_PUPIL_WORKFLOW_WRITE=1`
and `BROWSER_PUPIL_REVOKE=1` guards were enabled. The workflow recorded one
synthetic student-link revocation and confirmed that the same authenticated
student session lost list and detail API access. Read-only post-revocation
state was one enrolled student, one approved lesson, one release event, zero
active student links and one revocation. No records were reset or deleted.
The reports stay outside the repository; no credentials, cookies, tokens,
fixture identifiers or lesson text are included here.

| Probe | Actual result |
| --- | --- |
| Linked student's lesson-list API before revocation | HTTP 200; `Cache-Control: private, no-store`; only the intended lesson row; no objectives or content in the list |
| Linked student's lesson-detail API before revocation | HTTP 200; `private, no-store`; the intended released content and objectives were present |
| School B administrator requesting School A lesson list | HTTP 404; `private, no-store`; generic not-found body and no lesson markers |
| Linked student using the wrong-school lesson page | Document HTTP 200; not-found UI and `noindex`; no tested lesson markers |
| Unlinked student page and unlinked parent page | Each document HTTP 200; not-found UI and `noindex`; no tested lesson markers |
| Unlinked student and parent lesson-list/detail APIs | HTTP 404; `private, no-store`; generic not-found bodies and no lesson markers |
| Positive browser navigation and duplicate tab | Back/Forward restored the authorized lesson flow; duplicated tab returned HTTP 200 and showed the authorized lesson |
| Positive print | Browser PDF was generated (78,212 bytes) and contained the authorized lesson |
| Focused accessibility probe | Visible keyboard focus was observed; at 640×480 with simulated 200% zoom, no horizontal overflow was observed |
| Same authenticated student session after guarded revocation | Lesson-list and detail APIs each returned HTTP 404, `private, no-store`, generic not-found bodies and no lesson markers |
| Post-revocation document, history and duplicate tab | Direct page HTTP 200 with not-found UI and `noindex`; Back and Forward each returned HTTP 200 without lesson markers; duplicate tab HTTP 200 without lesson markers |
| Post-revocation print after fresh navigation | No lesson marker in print rendering; PDF 10,419 bytes |
| Post-revocation student-authenticated Flight/RSC | HTTP 200, `text/x-component`; `private, no-cache, no-store, max-age=0, must-revalidate`; no tested lesson markers |

The streamed page status is recorded independently from its UI and private
API status: these page responses were **HTTP 200**, not HTTP 404. The
not-found UI plus `noindex` is consistent with the documented streamed
Next.js behavior; no route correction is justified by that status alone.

Positive RSC inspection found six HTTP 200 Flight responses with no tested
lesson-topic marker. Four carried
`private, no-cache, no-store, max-age=0, must-revalidate`; one had no
`Cache-Control` header; one carried `s-maxage=31536000`. The temporary
evidence did not retain the route for those responses, so the latter two
responses cannot be attributed to a route or classified as private lesson
data. Neither contained the tested lesson topic. This cache-policy
attribution remains an open investigation; it is not evidence of a confirmed
disclosure and is not considered resolved.

The post-revocation browser checks were rerun cleanly and exited zero. An
earlier temporary browser process exited nonzero during asynchronous request
listener cleanup after writing its report; its results are not used in place
of the clean rerun. The original pre-revocation browser tab's stale
back-forward snapshot and print-before-refresh after revocation were not
reliably captured. Do not claim that revocation erases historical browser
content. Fresh post-revocation page, API, history, duplicate-tab, print and
Flight results do not prove erasure from an already-rendered old tab.

| ID | Overall status | Executed evidence and remaining scope |
| --- | --- | --- |
| BR-01 | BLOCKED | No logged-out direct protected-route and RSC suite |
| BR-02 | BLOCKED | No School A administrator role/page-boundary suite |
| BR-03 | BLOCKED | School B administrator-to-School A lesson-list API denial passed; the broader student/lesson page and payload matrix remains untested |
| BR-04 | BLOCKED | Teacher assessment-question, draft and class-record privacy not tested |
| BR-05 | BLOCKED | Teacher assignment revocation and retained independent-assignment checks not tested in this execution |
| BR-06 | BLOCKED | Positive Primary Head section-scoped review queues not tested |
| BR-07 | BLOCKED | Positive/revoked Secondary Principal section-grant queues and RSC not tested |
| BR-08 | BLOCKED | Full unauthorized reviewer/teacher release and correction-route matrix not tested |
| BR-09 | BLOCKED | Grading-policy and assessment-publication role boundaries not tested |
| BR-10 | BLOCKED | Student-link management UI and denied-role matrix not tested |
| BR-11 | BLOCKED — scoped pupil subcases passed | Linked released lesson list/detail, wrong-school and unlinked denials passed; other-pupil, draft/withdrawal and full exact academic-scope cases remain untested |
| BR-12 | BLOCKED — revocation subcases passed | Same-session API denial and fresh-browser page/API/Flight/history/duplicate/print checks passed; old-tab stale snapshot and print behavior remain unverified |
| BR-13 | BLOCKED | Sign-out and post-sign-out cache/history behavior not tested |
| BR-14 | BLOCKED — lesson-print subcases passed | Authorized and post-revocation fresh-navigation print probes passed; teacher class-record/attendance printing and the unattributed RSC cache policy remain open |
| BR-15 | BLOCKED — focused student-page probes passed | Visible focus and narrow simulated-zoom overflow probe passed; full keyboard-only school, assessment and attendance workflows were not tested |
| BR-16 | NOT IMPLEMENTED — positive guardian portal; negative subcase passed | Unlinked parent page/API concealment passed. No verified guardian-child relationship, linked guardian flow or relationship-revocation capability is implemented or claimed |

No broader requirement is marked complete from these scoped scenarios.
Phase 1–7 authenticated-browser acceptance remains **BLOCKED / NOT ACCEPTED**
pending the untested BR cases, old-tab revocation behavior, RSC cache-policy
attribution, positive guardian capability and remaining phase exit gates.

## Setup and reproducibility

1. Record exact Git SHA, local Node/npm versions, browser name/version,
   local origin, Docker context, test Compose service, database-migration
   state and synthetic fixture label. Start the application using the
   existing documented nonproduction environment. Avoid exposing it
   on a public hostname, LAN interface or tunnel.
2. Prepare two synthetic **active** schools A and B with distinct names;
   primary and secondary sections, classes, active sessions and terms;
   one exact active teacher/class/subject assignment in A; an approved
   lesson note released to its exact class; one synthetic enrolled
   student with an administrator-attested active student account link.
   Record fixture creation and cleanup commands. Do **not** import
   real academic records or run a reset on an unknown database.
3. Sign in with **isolated browser profiles**: school A administrator,
   school A School Super Admin, school A teacher, verified Primary
   Head of Section, verified Secondary Principal, correctly linked
   school A student, unrelated school B user and an account without
   school membership. Also reserve a profile with no authentication.
   Ensure an actor with a revoked grant, assignment or student link
   can be tested without overwriting another actor's session.
4. Record actual response status, tested page URL, observable outcome,
   console/security errors, response cache headers and execution time
   for each case below. Inspect the **Network** panel's document,
   RSC/flight and private API responses: hiding a navigation link
   alone is not authorization. A displayed fallback is not proof of
   access until the protected content has completed server checks.
5. Never attach raw cookies, JWT/session tokens, bearer headers,
   credentials, realistic student names, screenshots of child records
   or raw HAR files. Redact any such data first. Synthetic test ID
   labels and status codes are sufficient evidence.

## Browser verification cases

| ID | Actor and action | Expected security result |
| --- | --- | --- |
| BR-01 | Logged-out browser opens `/`, then direct school A private URLs | Sign-in UI contains no school/child data; protected URLs redirect to sign-in or conceal access; no private RSC payloads |
| BR-02 | School A administrator accesses `/schools/A` and `/schools/B` by direct address and browser link | A allowed within configured role; B concealed, including its name, classes, subject IDs and navigation |
| BR-03 | School B user (with a valid independent session) uses a known school A identifier in `/schools/A/students` or `/schools/A/lesson-notes` | Access denied; no school A data in response body, RSC stream, browser cache or error message |
| BR-04 | School A teacher opens `/schools/A/assessment-questions`, `/schools/A/assessment-drafts`, and `/schools/A/assessment-class-records` | Only the teacher's exact active class/subject/session/term appears; no CBT answer keys or other teacher's pupils/marks |
| BR-05 | Same teacher attempts school B path and loses exact active assignment in school A | School B stays denied. Revoked exact assignment disappears even after refresh and a new navigation; independent still-active assignment remains permitted only for its own rows |
| BR-06 | Primary Head of Section accesses `/schools/A/lesson-note-reviews`, `/schools/A/lesson-releases`, `/schools/A/attendance-reviews` | Only reviewed PRIMARY section with a verified active grant appears; no SECONDARY or missing-section data |
| BR-07 | Secondary Principal repeats BR-06, then loses verified SECTION grant | Only permitted SECONDARY rows before revocation; queues/details/API concealed immediately after revocation; no stale RSC result after refresh |
| BR-08 | Teacher, administrator, foreign-school user and unverified reviewer directly request `/schools/A/lesson-releases` and `/schools/A/attendance-correction-reviews` | Unavailable routes/data concealed; no partial release decision, private correction reason or audit content |
| BR-09 | School A School Super Admin opens `/schools/A/assessment-grading-policies` and `/schools/A/assessment-publications` | School-bound administrative access only; no unauthorized academic mark edits or publication by a teacher, principal, student or unrelated actor |
| BR-10 | School A administrator accesses `/schools/A/student-links`; ordinary teacher/student/foreign user attempts same route directly | Only authorized school configuration role can verify or revoke binding; other roles see no student-link or identifying records |
| BR-11 | Correctly linked STUDENT opens `/schools/A/my-lessons`; same account tries school B URL | Only released/approved revisions for active exact class, session, term and enrollment shown; never draft/submitted content, other pupils' lessons or answer keys |
| BR-12 | Revoke the student's explicit binding, deactivate membership or withdraw exact enrollment, then use old tab, browser Back, Refresh and direct `/schools/A/my-lessons` | No new server response reveals lessons; any sensitive browser history/back-forward restoration and print surface must be inspected and recorded separately; `/api/schools/A/student-lessons` must deny with private/no-store |
| BR-13 | After a valid account signs out, use direct protected URLs, Back, Reload, duplicated tab and an independent browser profile | Server authorization denied; private HTTP/RSC payloads do not become visible from another session. Document any residual browser-history screen even if its API calls are denied |
| BR-14 | Open private teacher class records/attendance and student lesson pages; inspect Network response headers and browser print preview | Private data must not leak in shared cached responses; print only authorized current content; no printable answer keys, unrelated school names or student data |
| BR-15 | Navigate sign-in, school setup, assessment and attendance workflows using keyboard only; inspect at narrow viewport and 200% zoom | Labels, focus order, visible keyboard focus, alerts and actionable controls remain usable; document accessibility violations and any role-specific inaccessible task |
| BR-16 | Test a PARENT/GUARDIAN account against the Phase 1–7 portal and a synthetic unlinked child | No child data without a verified same-school relationship. **There is not yet evidence of a complete guardian portal here**; label missing positive guardian workflow **NOT IMPLEMENTED/BLOCKED**, not PASS |

All paths with `/schools/A` and `/schools/B` are **templates**:
substitute actual verified synthetic school identifiers in the local
application, not literal letters. API prefixes are
`/api/schools/<schoolId>/...`.

### Next.js streamed-denial and dev-error diagnostics

The school route subtree has a server-side `Suspense` boundary with a
school-neutral fallback. Next.js documents that **streamed**
`notFound()` UI may legitimately retain HTTP **200** because the
response headers have already been sent; non-streamed not-found
pages normally return **404**. Next.js inserts a
`<meta name="robots" content="noindex">` marker in streamed
not-found HTML. **Do not require an HTTP 404 on every streamed
HTML document or remove the Suspense boundary to manufacture one.**
See the [Next.js not-found docs](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
and [streaming status docs](https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes).

For a cross-school browser denial, record the following
**independently**:

1. The document's actual HTTP status and whether the user
   sees a not-found UI rather than unauthorized school content.
   If it is a streamed 200, inspect the complete final HTML and
   document head for `<meta name="robots" content="noindex">`.
2. The complete response body and network RSC/flight payload
   **after streaming completes**. Verify that neither the foreign
   school's name, classes, student IDs nor private payload values
   appear. Do not interpret an initial neutral loading fallback
   as a completed access-denial verdict.
3. The equivalent private JSON API call must return the
   independently tested denial HTTP status (normally 401 or 404)
   and `Cache-Control: private, no-store`. A JSON API returning
   200 with private data is **not** excused by streamed HTML.
4. Verify that sign-out, a revoked membership or grant, and
   a different browser profile do not restore foreign-school data
   through navigation, RSC cache, browser history, printing or
   the Back/Forward cache.
5. Reproduce any Next.js `uncached data` or prerender diagnostic
   using the **same commit** on a local-only, production-compiled
   Next server against the *verified disposable database*, not
   only `next dev`. Capture the first useful exact error/digest,
   stack file and affected URL after redacting tokens, personal
   data and connection strings. A warning present in development
   mode alone does not prove the production build or browser is
   broken; a reproducible production error remains a release
   blocker.

All of the above must be observed in the **actual browser**.
Tests using Node `fetch` or mocked route handlers can provide
supporting HTTP evidence but cannot substitute for RSC/browser
history and rendered-content assertions. A streamed 200 with
correct not-found UI and no leakage can be classified
`FRAMEWORK-EXPECTED / VERIFY NOINDEX` until all required
evidence is collected; it must never be counted as a
fully passing acceptance case prematurely.

### Production browser evidence status and next-wave priority

The independent production-built run at exact PR #96 checkpoint
`7e1c609` confirms the **observed** streamed HTTP 200 /
not-found UI / `noindex` combination, RSC 404 fallback marker
without school names, and protected private JSON API denials.
See [browser evidence](PHASE1_7_BROWSER_EVIDENCE_2026_10_21.md).
These **specific negative-access observations** are complete;
BR-01 and BR-03 remain **PARTIAL** pending browser history,
identity revocation and broader private-payload evidence.
No change to `notFound()`, `Suspense` or cache-component
authorization is justified by the HTTP status alone.

For the next local-only **production-compiled** browser session,
prioritize fixtures and tests in this sequence:

1. **Role-safe setup:** inspect the existing disposable
   `postgres-test` container and verify Prisma migrations and
   checksums; inventory existing synthetic schools, users
   and memberships. Provision only missing synthetic
   identities through existing guarded authentication and
   school-configuration paths. Require exact active
   school, PRIMARY/SECONDARY section and verified grants;
   do not alter a real account or use an unreviewed SQL
   bypass to fabricate an approved release.
2. **School and teacher:** complete BR-02, BR-04 and BR-05
   with an exact active teacher subject/class/session
   assignment, then revoke **only that synthetic
   assignment**. Observe direct page, JSON and RSC
   before/after and confirm unrelated active assignments
   retain their own access.
3. **Academic reviewer:** complete BR-06 through BR-08
   with a verified PRIMARY Head of Section and
   SECONDARY Principal, then revoke a synthetic verified
   SECTION grant. Verify actual class-section binding,
   not role-label display or a hidden navigation link.
4. **Pupil identity and content:** complete BR-10
   through BR-12 using a verified enrolled synthetic
   student; require independent academic approval
   and explicit release before student-visible content.
   Compare an exact bound student with an unlinked
   student and a revoked link. Verify no withdrawn
   content or CBT keys leak to the client.
5. **Browser client/privacy:** complete BR-09,
   BR-13 through BR-15 across fresh profiles, Back/
   Forward/Reload, RSC cache, print preview and
   keyboard/200%-zoom checks. Record full status
   code + `noindex`/no-store distinction for
   streamed pages versus private APIs.
6. **Guardian boundary:** perform BR-16 negative
   access only if a guarded synthetic guardian can
   be represented; classify any missing positive
   portal feature `NOT IMPLEMENTED`, not `PASS`.
   Do not invent child or guardian relationships.

For each step, capture the test fixture label, synthetic
actor role/school (not credentials), redacted route,
document/RSC/API status, exact privacy assertion
and result. If the necessary synthetic setup
cannot be created safely, report `BLOCKED:
MISSING VERIFIED SYNTHETIC FIXTURE` for that
case and implement a narrowly scoped test-only
fixture helper in a separate reviewed development
branch; never skip silently or promote direct
Prisma modifications into product permission flows.

### Response and mutation checks

- For every protected GET, inspect document + RSC response as well as
  JSON API calls. Inspect `Cache-Control: private, no-store` for
  private JSON API routes and report any missing policy. Do not
  assume HTML/RSC cache behavior from an API header alone.
- Verify failed attempts create **no** forbidden assignment, student
  binding, review/publication, grade correction or release audit event.
  Compare sanitized, synthetic before/after event counts if relevant.
- Check stale-session behavior after membership deactivation, school
  deactivation, section-grant revocation and auth session deletion.
  Hiding the sidebar link alone never counts as revocation enforcement.
- For class records and CBT flows, inspect network output to ensure
  question-answer keys, other students' selections and provisional
  marks never enter unintended client payloads.
- At least one scenario per mutation type should use a denied actor,
  a wrong school ID and an obsolete revision or reassigned role.

## Evidence record and pass conditions

For each ID BR-01 through BR-16, record `PASS`, `FAIL`, `BLOCKED`
or `NOT IMPLEMENTED` with browser version, synthetic actor class,
direct path/response status, observed UI, cookie-independent cache/RSC
evidence, issue link and reviewer. Include redacted screenshots only
when needed. A check that could not be run does not count as PASS.

**Gate remains BLOCKED** unless all in-scope implemented flows pass,
issues involving private data are resolved and outstanding product
boundaries (notably positive guardian flows and production identity
controls) are accurately classified against the release scope.
Browser evidence does not waive the unchanged strict
`npm audit --audit-level=high` finding, missing risk authorization,
migration integrity, deployment approvals or other Phase 1–7 exit
criteria. No person should claim these browser checks completed
merely because a source or direct-handler test passed.
