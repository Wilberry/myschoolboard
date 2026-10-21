# Phase 1–7 browser security evidence — 2026-10-21

**Verification outcome: PARTIAL / NOT ACCEPTED.** Local operator
report based on draft PR #95 exact commit
`097a42d803badf718fb12183ccc8589e0da91462`.
These are observed **synthetic, localhost-only** browser and API
checks; this file does not attest to passing the full
[BR-01..BR-16 matrix](PHASE1_7_BROWSER_SECURITY_ACCEPTANCE.md).

## Environment and provenance

- The operator verified a **separate clean**
  `myschoolboard-format` git worktree at the exact commit;
  the original Phase 1 foundation worktree was untouched.
- PostgreSQL 17 Compose `postgres-test` service was healthy,
  tmpfs-backed and bound only to `127.0.0.1:5434`.
  The previously reviewed 36 Prisma migrations were up to date,
  and the read-only checksum verifier confirmed all 36 file hashes.
- The **guarded synthetic demo seed** was used to create local
  schools. A separate synthetic account restricted to school B
  was created and given a test-only school B membership.
  No live school, pupil or guardian record was imported.
- The application was started as `next dev` on loopback
  `127.0.0.1:3000`, exercised through a browser and
  stopped afterward. Local Next startup generated two config
  edits, both reverted; final git worktree remained clean.
- The database remained a disposable local test service.
  Do not reuse its sessions, data or credentials for release.

## Recorded outcomes (partial)

| Case | Evidence | Result |
| --- | --- | --- |
| BR-01 | Signed-out home rendered a sign-in interface. Signed-out student-lessons JSON API returned HTTP **401** with `Cache-Control: private, no-store`, without either demo school's name | PARTIAL; other protected document, logout/history cases not exercised |
| BR-03 | Synthetic school-B-only administrator opened own school page; direct school-A URL displayed a not-found page without the school names. Foreign-school lesson-notes JSON API returned **404**, `Cache-Control: private, no-store` and no school-name disclosure in its body | PARTIAL; production streaming, full RSC payload and cache/history evidence missing |
| BR-02, BR-04..BR-16 | Required distinct reviewer, teacher, verified linked student and guardian-like profiles, revocation, privacy, browser history, print and accessibility paths not prepared or not completed | NOT RUN |

**Important HTTP observation:** Direct school-A **HTML
document** navigation from school B returned HTTP **200**
while displaying a not-found page. The installed
`app/schools/[schoolId]/layout.tsx` wraps the private
school pages in `Suspense` with a generic placeholder.
The [Next.js docs](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
state that a streamed `notFound()` response may be
HTTP 200, because headers already streamed. The
[loading docs](https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes)
explain that streamed 404 UI should contain a
`<meta name="robots" content="noindex">` tag.

This is a **plausible framework-level soft 404**,
not evidence of successful unauthorized access.
However, the operator did **not** confirm the final
`noindex` marker, complete RSC/flight privacy or
a production-compiled response. These remain
`NOT VERIFIED`, not PASS. JSON API denial status
and no-store are separate and were observed.

**Dev diagnostic:** During local `next dev`,
an uncached-data/prerendering error was reported.
Its full error message and stack were **not
preserved** in the handover; root cause unknown.
The prior production `npm run build` passed.
The exact route and redacted console stack must be
captured and compared against a production-compiled
local server before proposing any runtime patch.
Do not disable `cacheComponents`, remove auth
checks or bypass Suspense solely to silence
a development-mode diagnostic.

## Remaining checkpoint

1. Confirm all data on the developer laptop remain synthetic.
   Recheck Docker service identity and the disposable DB guard.
   Never reset/seed another service or expose the test origin
   beyond loopback.
2. Rerun the school-B cross-school scenario in a **local,
   production-compiled** Next server at an exact recorded SHA.
   Preserve actual document status, `noindex`, complete
   HTML/RSC response observations, JSON API status/no-store,
   sanitized terminal errors and browser version.
3. Prepare minimum required synthetic roles and the
   exact class/section/term/student link fixtures using
   reviewed test-only creation paths, then perform the
   remaining browser matrix. Do not elevate or associate
   any real account; do not confuse UI link visibility
   with backend authorization.
4. Record stateful role/assignment/student-binding
   revocation **before and after**, including Back,
   Reload, duplicate tabs, print preview and
   accessibility observations. Any denial must not
   disclose private school or child information.
5. Re-run `npm test`, `npm run build`, both
   dependency audit variants and formatting on
   the **current exact release candidate head**.
   The five high dev-tooling `braces` audit
   package findings are still unresolved. No
   exception or final merge has been authorized.

**Disposition:** This log is useful initial negative-access
evidence. It does **not** complete the Phase 1–7 browser,
production identity, dependency-security or merge gates.
