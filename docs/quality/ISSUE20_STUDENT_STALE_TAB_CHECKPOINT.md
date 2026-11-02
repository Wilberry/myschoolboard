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
  synchronously hides the private DOM panel for BFCache restoration.
- Starts a new **no-store, same-origin server-authorized request** on focus,
  visibility restoration and `pageshow`, leaving the private panel hidden
  until that request succeeds.
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

The new `scripts/issue20-stale-lesson-guard.test.mjs` has three authored
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

The original-tab print and post-revocation print checks **remain blocked**
until a browser with supported printing APIs can execute them and demonstrate
that revoked lesson text does not appear in previews or PDFs. RSC/Flight
route-specific cache attribution also remains pending; it must capture URL,
status, content type, cache headers and absence of synthetic lesson markers
after revocation. Do not claim parent-facing content access; it is not
implemented in either draft.

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
Capture printer behavior and RSC/Flight headers separately. Do not run
GitHub Actions. Do not merge or deploy while any gate is outstanding.

**Acceptance disposition: BLOCKED until exact-SHA local and authenticated
browser checks substantiate the mitigation and remaining print/Flight
privacy requirements.**
