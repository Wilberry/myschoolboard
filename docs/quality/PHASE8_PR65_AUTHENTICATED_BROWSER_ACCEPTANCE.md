# Phase 8 PR #65 — authenticated browser acceptance (synthetic only)

## Current cloud acceptance — 2026-11-06

Source `ce14d17faf37c0c7a58ceac279b29b28d9729a1f`, Chromium 156.0.8078.79.
19/19 browser checks passed with enrolled synthetic pupils and separately attested
guardians, plus the real DB source-reader roster-race integration check.
P8-BR-01–10, 12 and 13 have current passing evidence. P8-BR-11's genuine persisted
BFCache restoration remains NOT EXERCISED because native navigation reported
persisted=false. Its required no-stale-data safety behavior passed; no-store was
preserved. See PHASE8_CLOUD_COMPLETION_20261106.md for the full matrix and limits.
The historical OPEN/NOT ACCEPTED runs below remain historical and are superseded
for this implementation source. No PR/main merge or production release is claimed.


**Status: OPEN / NOT ACCEPTED.** This matrix separates the scoped local
automated checks from the missing authenticated browser evidence for private
teacher result-source preparation (RES-REQ-001, D-P8-001, ADR-037). It is
not a production-release checklist or proof that report cards can be published.

## Source identity and evidence boundaries

- Exact previously **locally tested** integration source:
  `57750b13311f85ee734e84ded282b63e11036795`.
- Latest separately **authored, not locally executed** source-hardening branch:
  `verify/phase8-readiness-boolean-guard-20261104`. Pin its final commit
  with `git rev-parse HEAD` before performing any further checks.
- Predecessor evidence: 38 exact PostgreSQL migration checksums, 154 Node
  tests, 351 Vitest tests across 41 files, formatting/lint/TypeScript/build
  and high/full audits passed. The predecessor's unauthenticated HTML,
  RSC/Flight and route-segment probes observed private no-store headers.
  **These outcomes are not inherited by changed source commits.**
- `npm ci` and seed replay were skipped on the previously populated test
  runner. Record this explicitly whenever citing that checkpoint.
- The current hardening branch adds pure roster/counter checks,
  five stubbed source-reader service tests, and five HTTP-route tests
  with a stubbed reader for private success, generic authorization failures,
  malformed queries and concealed conflicts. These tests are **authored,
  not yet passed**. Mocked checks do not verify PostgreSQL authorization,
  real signed-in sessions or browser behavior.
- Original Phase 8 PR #65 stays draft. `main` is unchanged. No result
  publication, report-card release, guardian results, real student data or
  production deployment is authorized.

## Preflight before any browser run

1. Work only from a clean exact-commit checkout. Record SHA, branch,
   `git status --short`, and the production build source identity.
   Never mix a built snapshot from one commit with scripts from another.
2. Inspect the *worktree-owned*, disposable PostgreSQL 17 database,
   Docker context (local Unix socket), network namespace, tmpfs mount,
   published ports and host mounts. Protect the separate Issue #20 fixture.
   Never run migrations or seed against a shared/production target.
3. Keep the app bound to a verified local test origin; if using the
   worktree's isolated namespace/proxy, verify its ownership and existing
   browser-fixture guards. Do not mount the host Docker socket into the
   application process unnecessarily.
4. Use a *new, unique* synthetic run ID, credentials and school IDs in a
   privately stored fixture. Do not print or commit credentials, session
   cookies, student markers or private network/database URLs.
5. Preserve already-terminally-revoked assignments and audit evidence.
   Do not reactivate one to obtain an authorized-before-revoked test.
   Capture positive evidence on a fresh active assignment first.
6. Run the exact-SHA local suite including `npm run format:check`,
   `npm run lint`, `npm run typecheck`,
   `npm exec -- vitest run src/modules/results/result-readiness.test.ts
   src/modules/results/preparation-service.test.ts`,
   full Node/Vitest, Prisma, build, exact migration checksums and
   dependency audits. A nonzero exit keeps acceptance blocked.

## Browser matrix

For each case record **PASS**, **FAIL**, or **NOT EXERCISED** with browser
version, exact built SHA, synthetic fixture ID (not credentials), request
method/route, HTTP status, content type, cache headers, visible/printed
synthetic pupil markers *present/absent* and time of observation. The initial
state of every case below is **NOT EXERCISED on the new hardening SHA**.

| ID | Real authenticated scenario | Required observation |
| --- | --- | --- |
| P8-BR-01 | Active exact-assignment TEACHER, exact school/class/subject/session/term | Teacher-only dashboard link is reachable; readiness API returns `PRIVATE_PREPARATION_ONLY`; only this enrolled roster; no score merger, official grade, key or publication action |
| P8-BR-02 | Anonymous, nonmember, PARENT, STUDENT, school admin, Principal/HM where not separately permitted | Same protected page/API cannot disclose synthetic pupil names, admission numbers or private source blockers; denied or neutral streamed shell has no private payload |
| P8-BR-03 | School B actor against School A; mismatched class, subject, session, term or inactive academic period | Private API fails closed with generic denial; HTML/RSC/segment responses do not contain foreign identifiers |
| P8-BR-04 | HTML, RSC/Flight and partial segment prefetch (authorized and denied) | Independently inspect status and actual private `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, content type and body. A streamed HTTP 200 shell is **not** proof of authorized data |
| P8-BR-05 | Loaded private roster, then change assignment/term while old request is in flight | Old response never repopulates a different scope or becomes visible; load only the newly authorized exact scope |
| P8-BR-06 | Loaded private roster; blur, hide, switch tabs; return | Student rows concealed while hidden; returning tab reauthorizes before showing fresh data; no stale student markers during transition |
| P8-BR-07 | Fresh active assignment; record server revocation timestamp then leave original teacher tab foregrounded | Request denial and DOM concealment measured from server revocation; no stale roster after denial; record measured maximum latency, **do not invent an unapproved latency SLA** |
| P8-BR-08 | Sign out in the same tab and separately in another active tab | Rows immediately concealed on sign-out notification; old tab cannot repopulate them; fresh API is denied |
| P8-BR-09 | Browser print/PDF before revocation and after revocation | The preparation roster is **not printable even while authorized**; print-block notice/neutral output appears, and no pupil name or admission marker enters either PDF |
| P8-BR-10 | Back/Forward navigation and duplicate tabs after revocation | No stale pupil markers in rendered content, Flight payloads or print. Record `pagehide.persisted` and `pageshow.persisted` separately |
| P8-BR-11 | Actual BFCache restoration, only if browser permits it under existing privacy protections | If `pageshow.persisted=true` occurs, restored private content must be concealed before it can be used; if `no-store` prevents restoration, mark this exact scenario **NOT EXERCISED**, while recording the separate Back/Forward no-leak result |
| P8-BR-12 | Mismatched source rosters from two independently authorized source readers | API returns generic `CONFLICT`/denial without any partial roster; source inconsistency cannot be labeled ready |
| P8-BR-13 | Keyboard, focus changes, response status, narrow layout and assistive announcements | Private content is inaccessible after concealment and status text announces denial/print block without disclosing pupil details |

### Important mismatch-roster fixture restriction

The source reconciliation's pure tests and stubbed-reader tests demonstrate
failure handling **without a real database**. They do not close P8-BR-12
at HTTP/DB level. To exercise a *real* mismatched roster, create an entirely
separate, explicitly owned, disposable synthetic database/fixture or a
controlled in-process integration test that observes its own transaction.
A browser-connected web server on a different PostgreSQL connection **cannot
read uncommitted changes in another connection's rolled-back transaction**.
Do not mutate or corrupt the existing shared seeded fixture, use real minors'
data, or create forged approval/publication audit rows.

### BFCache, no-store and revocation semantics

The intended privacy outcome is **no restored stale sensitive data**, not
"force the browser to restore from BFCache." Preserve the no-store headers
rather than weakening privacy for a test. For each Back/Forward run, separately
record whether genuine `pageshow.persisted=true` happened. When it did not,
the BFCache-restoration-specific criterion remains NOT EXERCISED.

The source UI uses a bounded 10-second foreground authorization poll and
a 5-second request timeout; this is **not** instantaneous remote revocation.
Record exact revocation-to-denial and revocation-to-DOM-concealment intervals.
Any maximum latency requirement must come from an approved acceptance policy,
not from a test author's assumption.

## Evidence recording / exit gate

Record actual results as a matrix under an append-only dated checkpoint;
do not put authentication cookies, credentials or raw student-data payloads
in GitHub comments. Note fixture limitations and any replayed/non-fresh
scenario. If a code change is required, commit it on the dedicated isolated
branch and rerun applicable checks on the **new exact SHA**.

**Exit gate stays BLOCKED** until the relevant real-session cases have clear
outcomes, failed cases are fixed, and unexercised cases are transparently
evaluated against privacy-preserving acceptance requirements. Only then
propose a Phase 8 integration PR into development `main` under D-051.
No GitHub Actions, production migration, real-school data or deployment is
part of this acceptance matrix.

## Dated browser execution checkpoint — 2026-11-05

**Outcome: NOT ACCEPTED; exit gate remains BLOCKED.** The following was
observed in local Chromium against the guarded synthetic fixture, run
`p8b-1105-812b190b`. Browser: Chromium 150.0.7871.250 (Electron 43.7.7).
The app process was confirmed to originate from the dedicated Phase 8
worktree, whose observed HEAD was
`1b5b89b83bdb8d57068752b6b4df93f3c5636614`; the running build did not embed
an independently verifiable source SHA, so this is worktree evidence, not
clean exact-SHA certification. The fixture had two available teacher
assignments, both with zero enrolled pupils. Synthetic fixture account
passwords were rotated and prior sessions revoked before the checks.
No credentials, session tokens or student records are recorded here.

| ID | Outcome | Actual observation and remaining limitation |
| --- | --- | --- |
| P8-BR-01 | NOT EXERCISED | The teacher-only result-preparation page loaded and its exact-scope API returned `200` JSON with `PRIVATE_PREPARATION_ONLY` and `Cache-Control: private, no-store`. The page response was `200` with `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. Both assignments had zero pupils, so exact enrolled-roster filtering and private pupil-source boundaries were not exercised. |
| P8-BR-02 | PASS | Direct page requests as Head of Section, Principal, same-school School Admin, Student, Parent, foreign-school administrator and School Super Admin returned streamed not-found UI (document status `200`, no private preparation or pupil-data markers). Corresponding APIs returned generic `404` with private/no-store caching. Anonymous page access redirected to sign-in; its API returned `401` private/no-store. A `200` streamed shell was treated as not-found, not as authorization. |
| P8-BR-03 | NOT EXERCISED | A foreign-school administrator was denied as recorded in P8-BR-02. Class, subject, session, term and inactive-period mismatch cases were not exercised because no suitable synthetic assignment/roster existed. |
| P8-BR-04 | NOT EXERCISED | The authorized HTML/API and authorized teacher RSC/Flight response (`200 text/x-component`, private/no-store) were inspected. Replaying a captured Flight request as Head returned a not-found Flight response (`200 text/x-component`) without private markers. Partial-segment prefetch was not exercised; the empty roster also precluded pupil-payload boundary testing. |
| P8-BR-05 | NOT EXERCISED | Changing the exact assignment/term while an old request was in flight could not be meaningfully tested without a non-empty authorized roster. |
| P8-BR-06 | NOT EXERCISED | Blur/focus concealed and re-fetched the page; opening a second tab caused the original tab to conceal. Because the fixture had no pupils, the required stale pupil-row concealment could not be tested. |
| P8-BR-07 | NOT EXERCISED | No non-empty active assignment was available for a server-revocation-to-denial or revocation-to-DOM-concealment measurement. |
| P8-BR-08 | NOT EXERCISED | Cross-tab sign-out concealed the original view, and subsequent protected-page access returned to sign-in. Same-tab sign-out and stale pupil-row behavior were not independently exercised; no pupil rows were present. |
| P8-BR-09 | NOT EXERCISED | Dispatching `beforeprint` concealed the page and `afterprint` re-fetched it. Real print preview/PDF could not be generated because Chromium reported `Page.printToPDF` unavailable; printable-output behavior remains unverified. |
| P8-BR-10 | NOT EXERCISED | Back/Forward navigation and duplicate-tab behavior were exercised, but the empty-roster fixture could not establish that stale pupil markers are absent. `pagehide.persisted` was `false`; `pageshow.persisted` was not observed. |
| P8-BR-11 | NOT EXERCISED | Genuine BFCache restoration was not observed; no-store behavior was preserved. |
| P8-BR-12 | NOT EXERCISED | No suitable independent synthetic source rosters were available to exercise a real mismatched-roster request. |
| P8-BR-13 | NOT EXERCISED | Keyboard focus indication passed and Chromium 200% zoom showed no horizontal overflow. Assistive-technology announcement behavior was not tested; empty-roster limitations also apply. |

Guardian-child relationship/permission revocation, stale pupil rows after
revocation, student-row visibility and mismatched source rosters remain
pending; the fixture had zero pupils and no verified guardian-child
relationship. No data or audit history was fabricated. The attempted real
print-preview/PDF check was blocked by the browser protocol limitation above.
These observations do not accept guardian acknowledgment or official
student/parent report-card publication, neither of which is implemented.
