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
workflow**.
Do not use actual pupils, guardians, contact records or payment data.

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
