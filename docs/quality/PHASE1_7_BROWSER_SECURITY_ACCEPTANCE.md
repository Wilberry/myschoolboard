# Phase 1–7 authenticated-browser security acceptance (synthetic only)

**Status: NOT EXECUTED.** This is an evidence-gathering protocol, not proof
that the current app is browser- or production-ready. The cumulative local
Vitest and source-guard checkpoint is documented separately. Perform every
test against **one exact reviewed commit**, running on a **local-only**
instance with a verified disposable PostgreSQL database. Follow
[LOCAL_CI_RUNBOOK.md](LOCAL_CI_RUNBOOK.md) for DB/container checks.
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
