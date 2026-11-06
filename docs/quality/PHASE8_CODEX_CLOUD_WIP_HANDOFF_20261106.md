# Phase 8 Codex Cloud work-in-progress handoff (2026-11-06)

**Status: NOT ACCEPTED / NOT MERGED INTO MAIN.** This document belongs to a
reviewable cloud *snapshot*; it does not declare the underlying unresolved
merge complete and does not confer authority to release pupil information.

- Repository: `Wilberry/myschoolboard`.
- Local original worktree: `/home/wilberry/Desktop/project/myschoolboard-phase8-stack-after-pr105`.
- Local worktree branch: `verify/phase8-stack-after-pr105-20261104`.
- Original HEAD (sole parent of snapshot): `1b5b89b83bdb8d57068752b6b4df93f3c5636614`.
- Original unresolved MERGE_HEAD (provenance only, **not** a snapshot parent): `baa1fdf1fee33d003f8e24f1e4c7c68eac1ae46b`.
- Original merge index still has 12 unresolved paths, listed below. Snapshot
  files reflect their already-resolved *working-tree contents*; the local
  merge index was never staged/aborted/committed by the export.
- SHA-256 of serialized source-file snapshot content: `0079181369db8485ac912bf36151b86c5c76c15c3de69451e84b9dbfa1196283`.
- Exactly 48 migrations were present; the new forward-only migration is
  `prisma/migrations/20261105000000_phase8_grade_scale_band_basis_width/migration.sql`. Never rewrite previously applied migration SQL.
- The checkpoint includes the tracked/staged incoming changes and local
  source/docs changes, plus reviewed non-ignored new source/docs files.

## Original unresolved paths

- `app/schools/[schoolId]/page.tsx`
- `docs/architecture/ARCHITECTURE_DECISION_RECORDS.md`
- `docs/authorization/AUTHORIZATION_RULES.md`
- `docs/modules/RESULTS_AND_REPORT_CARDS.md`
- `docs/project/DECISION_LOG.md`
- `docs/quality/LOCAL_CI_RUNBOOK.md`
- `docs/requirements/REQUIREMENTS_TRACEABILITY_MATRIX.md`
- `docs/roadmap/CURRENT_STATUS.md`
- `docs/roadmap/MILESTONE_CHECKLIST.md`
- `package.json`
- `prisma/schema.prisma`
- `src/modules/assessments/questions.integration.test.ts`

## Verification evidence and remaining blockers

The user previously reported successful full Node/Vitest, static/Prisma gates,
Next build, strict and production dependency audits, 48/48 migration checksums,
clean bootstrap into a separate disposable DB, and 42 HTTP role/tenant checks.
The latest local Chromium run is documented in
`docs/quality/PHASE8_PR65_AUTHENTICATED_BROWSER_ACCEPTANCE.md`.

These reports must be independently validated after modifying code. The
Chromium fixture had **zero enrolled pupils**. Protected pupil-row lifecycle,
relationship/assignment revocation, realistic print output, source mismatch,
and remaining P8-BR acceptance scenarios were not fully demonstrated.
Guardian acknowledgment and final official recipient publication were not
shown to be implemented or accepted. Do not claim Phase 8 is complete.

## Instructions for Codex Cloud

1. Work on this **WIP checkpoint branch**, not the unrelated Phase 1
   foundation branch; read the repository's `AGENTS.md`, implementation
   roadmap, D-023, RES-REQ-001, security and privacy specifications.
2. Reconcile the snapshot against **both** original parent commits, especially
   the 12 conflict files, and compare current `main`/open PRs. The incoming
   MERGE_HEAD is **not** an ancestor of this snapshot: do not mistake this
   for a historical completed merge.
3. Finish safely implementable Phase 8 work, build disposable **cloud-local**
   Postgres fixtures with enrolled synthetic pupils and browser automation,
   preserve school and scope boundaries, and perform local-equivalent checks.
   Do not assume cloud tools can access the user's localhost or Docker.
4. Only after all required privacy/browser and implementation gates pass,
   prepare a reviewed integration into `main` under the established workflow.
   No force push, production seed, live DB access, GitHub Actions or unverified
   claims of publication/guardian access.
5. Clearly report incomplete requirements and exact blockers if acceptance
   cannot be completed safely. Keep `main` unchanged until acceptance.
