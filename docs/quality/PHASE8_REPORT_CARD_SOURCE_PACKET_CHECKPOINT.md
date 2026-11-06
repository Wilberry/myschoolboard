# Phase 8 — Private Immutable Report-Card Source Packets

**Date:** 2026-10-13
**Branch:** `feature/phase8-private-report-card-source-packets`, cumulative draft base PR #70 → #69 → #68 → #67 → #66 with unfinished Phase 6–7.
**Requirements:** RES-REQ-001 partial; TEN-REQ-001 / SEC-REQ-001 partial.
**Exit:** BLOCKED for official grading, result/report-card release, or production.

## Implementation authored

- Additive Prisma `ResultReportCardSourcePacket` and SQL migration `20261013130000_phase8_private_report_card_source_packets`. One immutable, versioned private packet per approved final owner decision. Same-school composite FKs to final decision, frozen teacher source, school-adopted grading policy and actor. No existing records changed; UPDATE/DELETE/TRUNCATE guarded and unique per final decision.
- INSERT trigger reads exact existing `APPROVED_AWAITING_RELEASE` final owner decision, **re-runs** `assert_result_publication_readiness` with school row lock and server-derived active same-school owner, independent current verified PRIMARY/SECONDARY academic approval, latest version/policy/complete unchanged enrolled roster. Does not trust browser-supplied student roster, marks, source JSONB, weights, revision, count or timestamps.
- PostgreSQL freezes an allowlisted JSONB per-pupil set of student identifiers and names, CBT numeric score evidence, independently approved original/effective written marks and the exact adopted QUIZ/TEST/EXAM weight version. No answer keys, selected options, student responses, new mark invention, grade band, pass mark, total official percentage, ranking or report layout. Student payload is **server-private**.
- Private school-owner GET/POST `/api/schools/[schoolId]/report-card-source-packets` and page/navigation. POST accepts only finalDecisionId and audit reason with active same-school owner identity from session, SERIALIZABLE and SQL enforcement. GET returns at most 100 metadata rows, SQL rechecks current owner; neither response returns `studentSourceCards`, identities, marks or full evidence.
- Synthetic authenticated suite extended: own-school super admin can prepare one source packet, all other roles and other schools concealed, client-supplied marks/rosters rejected, duplicate/replay denied, exact pupil evidence frozen without correct answer/official grade, privacy of API replies, immutable update/delete/truncate, old decision cannot be reused after policy drift, and an independently reviewed next result revision with a new owner decision gets a distinct frozen packet. Node source guard added to the existing npm test/verify:local:guards commands without removing prior suites.
- D-057/ADR-043, module spec, requirement traceability, authorization rules, status and milestones updated. Grading bands, grade computation/rounding and parent/guardian visibility remain explicit school configuration not silently inferred from the earlier Phase 7 *provisional preview* algorithm.

## Verification provenance

**ACTUALLY EXECUTED:** GitHub connector branch/file/commit operations and a freshly GitHub-fetched **56/56 targeted structural source assertions**, including Prisma relations, migration protections, same-school SQL and owner authorization, PII projection exclusions, mandatory category fields, test and package registration. This is inspection only, not executed Node tests or database validation. Local GitHub clone failed DNS resolution (`Could not resolve host: github.com`), so no checked-out project or PostgreSQL server in the isolated runtime.

**AUTHORED, NOT EXECUTED:** Prisma migration, SQL trigger, Vitest integration scenario, Node guard, Next API and UI. No real/test school data used.

**NOT EXECUTED:** cumulative migration deployment/drift on owner-confirmed disposable loopback PostgreSQL, Prisma validate/generate, actual Node/Vitest, Prettier/ESLint/TypeScript/Next build/browser/a11y, `npm run verify:local`, security `npm audit --audit-level=high`, successful CI. Prior CI runs failed without accessible job steps and the root cause remains unconfirmed. Do not use shared or production databases; never rewrite already-applied migrations.

## Follow-on

1. Execute cumulative Phase 6–8 migration, integrity, concurrency, revocation, privacy and rollback tests on the documented disposable localhost PostgreSQL target; resolve all CI and audit failures.
2. Adopt a **school-specific, versioned official grade-scale and report-card rounding/aggregation policy**, implement deterministic server-side official report-card calculations and immutable official presentation evidence, preserving earlier packet versions.
3. Separately gate any result/document release behind explicit current School Super Admin release approval, configured student/guardian visibility, verified relationship, correction amendments and passing security/release acceptance. No public report-card download/QR/portal or student result API has been added here.

**Outcome: private source foundation AUTHORED; FORMAL ACCEPTANCE BLOCKED.**
