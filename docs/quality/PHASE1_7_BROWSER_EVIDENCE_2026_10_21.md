# Phase 1–7 browser security evidence — 2026-10-21

**Verification outcome: PARTIAL / NOT ACCEPTED.** This log includes both the original development-mode smoke and a separate production-compiled follow-up. Local operator
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

## Production-compiled browser follow-up — PR #96

**Source of evidence:** operator's local, clean, detached PR #96
commit `7e1c609922531f64dc32aec8c327272fb9d399ea`;
not a claim that this later documentation commit has been retested.
The same Compose-managed PostgreSQL 17 test instance was verified
healthy with tmpfs data and loopback-only port `127.0.0.1:5434`;
Prisma migration status and the read-only integrity checker
confirmed **36/36 exact applied checksums**. The application
was built successfully and served using `next start` on
`127.0.0.1:3000`, not `next dev`. The source worktree
remained clean. The production app server was then stopped;
the disposable PostgreSQL service remained available.

### Observations

| Surface | Observed outcome | Classification |
| --- | --- | --- |
| School B-only administrator requests school A student page | Streaming **HTTP 200** document; completed page renders not-found UI, carries `<meta name="robots" content="noindex">`, and contains neither demo school's name | **Expected streamed Next.js soft-404 behavior**, not an API authorization pass |
| Foreign school RSC/Flight request | HTTP **200**, `text/x-component`; payload includes `NEXT_HTTP_ERROR_FALLBACK;404` marker and neither school name | **Denial observed;** broader payload / cache and identifiable ID audit not yet accepted |
| Foreign-school lesson-notes JSON API | **HTTP 404**, `Cache-Control: private, no-store`, no demo-school name in response | **Negative-access check passed** for this request |
| Signed-out student-lessons JSON API | **HTTP 401**, `private, no-store`, no school names | **Negative-access check passed** for this request |
| Production server console | The earlier `next dev` uncached-data/prerender error did not recur in the reported production run | **Not reproduced in production;** no evidence to justify removing Suspense/auth checks |

The HTTP 200 on the streamed **HTML document and RSC**
does not mean that the school data was authorized. The
actual protected JSON API continued to deny the user.
A route's final displayed not-found state, completed RSC
payload, private-data absence and noindex marker must
be assessed together; not-found appearance alone does
not prove safety. The reported captures verified the
404 marker and school-name absence, **not** every possible
student ID, subject, cached flight fragment or browser
history state. Do not overstate these observations.

### Acceptance progress

- **BR-01 remains PARTIAL**: signed-out home and the
  student-lessons negative API were checked. Back/Forward,
  logout revocation and other private pages were not fully
  exercised.
- **BR-03 remains PARTIAL**: school B-to-A denial
  was confirmed in a production-built browser session
  across completed rendered HTML, sampled RSC and
  protected JSON API. Comprehensive ID/payload
  inspection, role mutation and browser history/cache
  cases are still pending.
- **BR-02, BR-04 through BR-16 are NOT FULLY EXECUTED.**
  Some overlap may be indirectly supported by the
  negative-access smoke; this is not a PASS for them.

**Static release checks on this exact commit:**
format, ESLint, TypeScript, production build, local DB
preflight, Prisma migration status and the checksum
verifier all **PASS**. **Full `npm test` and both npm
audit commands were NOT re-run on PR #96.**
The most recent complete regression is the earlier
PR #94 checkpoint (65/65 Node guards and 302/302
Vitest tests), and the previously confirmed strict
audit still reports five high affected-package entries
from the dev-only unpatched `braces` advisory.

No full authenticated-browser signoff, security
exception, GitHub Actions, merge into `main`
or production deployment occurred.

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
