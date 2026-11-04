# Phase 8 PR #65 — authenticated browser acceptance (synthetic only)

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
- The current hardening branch adds pure roster/counter checks and five
  stubbed source-reader service tests. Those tests are **authored, not yet
  passed**, and do not verify PostgreSQL authorization or browser behavior.
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
