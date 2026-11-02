# Issue #20 — student lesson stale-tab privacy follow-up

**Status: DRAFT / NOT ACCEPTED.** This follow-up branch is stacked on the
locally tested guardian attestation draft PR #103 at commit
`40a56d8c98387291d95c8037e0c08a854d7b1ff1`. It does not modify the
accepted `main` branch or grant guardian/parent academic access.

## Triggering evidence — 2 November 2026

The owner-provided localhost acceptance checkpoint at the base SHA reported:
38/38 exact migrations, 139 Node tests, 345 Vitest tests, Prisma validation,
format/lint/typecheck/build and both npm audits passing, with zero reported
vulnerabilities. The guarded exact-SHA acceptance script passed. Scoped
authenticated browser evidence also showed proper 404/private/no-store denial
of guardian data and student lessons before/after guardian-link revocation,
and properly denied fresh lesson API reads after a student-account-link
revocation.

**Open privacy failure:** a student's already-rendered, previously authorized
lesson stayed visible in the original tab after the school administrator
revoked the student's account link, until that tab was reloaded or navigated.
Network denial alone cannot erase content previously delivered into the DOM.

## Mitigation implemented for review

The student lesson client component now:
- Conceals all list and detail text immediately when its window loses focus,
  its tab becomes hidden or it receives `pagehide`; it clears React state and
  synchronously hides the private DOM panel for BFCache restoration. The only
  blur/visibility exception is a **five-second print grant** obtained through
  a fresh authorized detail request; `pagehide` still clears the panel.
- Starts a new **no-store, same-origin server-authorized request** on focus,
  visibility restoration and `pageshow` (unless a freshly authorized print
  preview is active), leaving the private panel hidden until that request
  succeeds.
- Rechecks list and any currently displayed detail every **10 seconds** while
  the tab remains visible; requests have a **5-second deadline**. Failed,
  timed-out or unauthorized checks conceal previously displayed data rather
  than continuing to present it.
- Cancels superseded requests and uses a monotonic request epoch so a late
  successful response cannot restore sensitive content after a more recent
  denial, focus change or tab hide.
- Keeps server-side pupil identity/link/revocation, tenant, enrollment and
  release authorization unchanged; never uses local/session storage to cache
  lesson content.
- Adds an explicit **Print this lesson** control that first rereads the
  currently open lesson through the signed-in student's private/no-store
  detail endpoint and requires an identical revision, objectives and content.
  A temporary five-second print grant allows the browser print dialog's
  ordinary window blur without erasing this freshly verified content. Native
  Ctrl+P without that grant conceals the private panel; `afterprint` and
  permit expiration clear it and recheck access. Printing remains a
  separately unverified browser acceptance gate.

The new `scripts/issue20-stale-lesson-guard.test.mjs` has six authored
source regression checks, included in `npm test` and
`npm run verify:local:guards`. Source inspection is **not** a passing browser
or application test.

## Boundaries and unresolved checks

This is a **bounded-exposure mitigation, not instantaneous remote erasure**.
A foreground tab can retain data for the polling interval plus request
timeout after a remote revocation. Browser timers may be throttled or
suspended; blur, pagehide and restoration checks reduce that exposure but
cannot erase screenshots, already printed documents, saved content or memory.
A future real-time invalidation mechanism may be needed for any stronger
revocation latency guarantee.

The positive authorized **Print this lesson** action, native Ctrl+P
without a print grant, and original-tab **post-revocation** print checks
**remain blocked** until a browser with supported printing APIs confirms
a fresh authorized print includes only the exact current released content,
and any print attempted after revocation contains none of that lesson text.
A print dialog can retain content already rendered into a preview; this
client mitigation cannot revoke a print job already started. RSC/Flight
route-specific cache attribution also remains pending; it must capture URL,
status, content type, cache headers and absence of synthetic lesson markers
after revocation. Do not claim parent-facing content access; it is not
implemented in either draft.

## Local checkpoint and RSC cache-header follow-up — 2 November 2026

The operator's exact-SHA guarded run at
`30f4947dbfd8ed8d8e805b9cd5e357f2a88ed391` passed 38/38 migration
checksums, 144 Node tests, 345 Vitest tests, Prettier, lint, typecheck, build,
Prisma validation and both npm audits with zero reported vulnerabilities.
Chrome confirmed synthetic student lesson authorization, parent/foreign-school
denials, post-revocation API 404/no-store and original-tab concealment. This
evidence applies **only to that immutable commit**.

Three outstanding browser findings are independently tracked:

- One actual Next.js **Flight prefetch response lacked `Cache-Control`**,
  while other Flight/document responses were private/no-store. The particular
  response path and body were not captured in the summary, so there is not yet
  proof whether it carried a public static fallback or private data.
- Authorized lesson print preview visibly contained the released lesson, but
  Chrome's Save to PDF stalled; a verified positive PDF output is missing.
  Denied post-revocation PDF contained no lesson marker.
- The observed Back/Forward checks had `pageshow.persisted === false`, so
  the true BFCache lifecycle remains untested.

A narrow follow-up adds a **route-scoped `Cache-Control: private, no-cache,
no-store, max-age=0, must-revalidate` rule** in `next.config.ts` for
`/schools/:schoolId/my-lessons` and its Next.js 16
`my-lessons.segments/:path*` prefetch form. This is HTTP response cache
hardening only; it must not replace server-side guardian/student access
checks or falsely imply client-side router memory is cleared. The existing
Next.js `cacheComponents` and `partialPrefetching` configuration remains
enabled for other routes. A new source regression guard checks the matching
paths and header policy.

**None of the previously passing checks automatically verify the new
follow-up commit.** Re-run the guarded full suite on the new clean SHA and
capture **every actual network response** (URL, request and response headers,
status, content type and checked synthetic marker absence/presence),
including default prefetch and segment prefetch. If any response is still
cacheable or missing the intended header, or an unauthorized payload includes
a lesson marker, keep acceptance blocked and investigate the exact route.

## Required local gates before acceptance

Run this follow-up branch in a separate clean local worktree on its **exact
new commit** and on the inspected disposable PostgreSQL 17 fixture. Follow
`docs/quality/LOCAL_CI_RUNBOOK.md` and the existing guarded
`npm run verify:local` workflow. Require 38 exact migrations, formatting,
lint, TypeScript, 139+ Node and 345+ Vitest tests (counts can increase),
build, strict and full audits, and Prisma validation.

Using synthetic pupil fixtures only: capture an authorized open lesson; keep
that original tab open; revoke the student account link through the guarded
administrator workflow; verify the lesson content disappears on tab blur,
focus/visibility restoration, and no later than the interval+timeout while
the page stays foregrounded; verify it does not return following
Back/Forward, BFCache restoration, duplicate tab, or an in-flight request
race. Confirm fresh list and detail endpoints remain private/no-store 404.
Capture explicit Print button / native Ctrl+P / post-revocation print
preview behavior and RSC/Flight headers separately. Verify both no print
grant after a 404 and no stale print on blur, focus or pageshow. Do not run
GitHub Actions. Do not merge or deploy while any gate is outstanding.

**Acceptance disposition: BLOCKED until exact-SHA local and authenticated
browser checks substantiate the mitigation and remaining print/Flight
privacy requirements.**
