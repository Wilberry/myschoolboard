# Phase 3 platform subscriptions — acceptance and safe migration checkpoint

**Status:** authored on the existing Phase 1–7 PR #98 integration branch.
**Not yet executed** on the owner's disposable PostgreSQL/Next environment.
Not a Phase 3 acceptance, financial gateway approval or production release.

## What this checkpoint adds

- Append-only, global catalog of versioned Platform Super Admin plan revisions,
  each with explicit ATTENDANCE, LESSONS, ASSESSMENTS and/or CBT feature
  metadata, optional advisory student/staff ceilings, reason and actor.
- Append-only, school-specific subscription periods with exact immutable
  plan revisions and half-open UTC intervals. PostgreSQL school-row locking
  and a GiST exclusion constraint prevent overlapping intervals, including
  direct multi-row and concurrent inserts. Adjacent intervals remain valid.
- Platform Super Admin-only, private/no-store GET/POST routes:
  \`/api/platform/plans\` and
  \`/api/platform/schools/{schoolId}/subscriptions\`.
- \`/platform\` console: a dynamic, role-locked server page with a bounded
  school-name/status list and client forms for plan revisions and subscription
  periods. Ordinary school users do not get the page or the home navigation
  link. The APIs independently check current operator authority.
- New migration \`20261101000000_phase3_platform_subscriptions\` (#37) and
  synthetic database/HTTP, pure-policy, source-guard and read-only
  migration-preflight tests.

**Not implemented:** payment capture/invoices/refunds, real paid status,
automatic renewal/expiry suspension, enforced quotas or permission grants,
staff invitations, platform metrics, full support tooling or final
entitlement policy. A CURRENT subscription **never** changes
\`School.isActive\` or a school's authorization roles. Existing school access
checks remain authoritative. This checkpoint does not add a Phase 8 or 9
feature.

## Read-only operator subscription status — source-only

The Platform Super Admin-only GET route at
`/api/platform/schools/{schoolId}/subscription-status`
reports one school's CURRENT/UPCOMING/ENDED/NONE subscription and lifecycle
independently, plus aggregate active student enrollment and staff counts
compared against current plan advisory limits. It exposes no student/staff
names or individual records; billing is NOT_TRACKED and product entitlement
enforcement NOT_ENABLED. Integration tests exercise suspended-school
non-reactivation and school-role denial, but remain unexecuted locally.

## Preserve historical evidence

Do not invalidate or blindly rerun earlier successful checks: at the
original application SHA \`686891d\`, 36/36 existing migrations, 311/311
DB-backed Vitest, 95/95 Node guards, audit/build/typecheck/lint/format
and selected pupil privacy browser checks passed. Separate later guard and
browser evidence is recorded on the acceptance matrix. These runs are
**historical**, not passes for the new migration #37 or operator console.

## Exact local procedure — **only** the established disposable DB

Do not run against a production or shared database. Preserve all other Docker
containers and Phase 8/9 worktrees.

1. Confirm the worktree is clean, and fast-forward it to the current PR #98
   branch. Never use \`reset --hard\`, force-push or stash/discard unknown
   changes. If the worktree is not clean, stop and review.
2. Load the already verified, private synthetic configuration without
   echoing secrets. The prior PostgreSQL 17 \`postgres-test\` container must
   be running, healthy, tmpfs-backed and loopback-bound at
   \`127.0.0.1:5434/myschoolboard_test\`.
3. Run the **read-only** Phase 3 preflight. Before opening any database
   connection, it also verifies that the pending migration #37 file has
   exactly two tables, four functions, six triggers, a complete validated
   plan-code expression, the bounded window, the exclusion constraint, and
   the immutable-history protection. Regression tests reject duplicate,
   truncated, unsafe-ALTER and missing-constraint SQL. This structural
   check does **not** replace real PostgreSQL syntax validation.
   It requires exact SHA-256
   matches for all 36 previously applied migrations, **exactly one**
   remaining named migration (#37), a clean exact Git SHA, the correct
   Docker context/container/worktree and matching DB URL variables.
   It does not migrate, seed or reset anything.
4. Only if all checks pass, deploy the one additive migration, verify
   37/37 exact migration checksums, and run focused tests.
5. Run the final static/build/dependency and cumulative regression gates
   at the **same exact source SHA**, preserving stdout exit codes and failing
   cases. Do not change fixture credentials or reuse a consumed browser
   revocation fixture.

~~~sh
cd ~/Desktop/project/myschoolboard-format || exit 1
set -e
test -z "$(git status --porcelain --untracked-files=all)"
git fetch origin
git switch verify/pr97-integrated-pupil-workflow
git pull --ff-only origin verify/pr97-integrated-pupil-workflow
test "$(git branch --show-current)" = "verify/pr97-integrated-pupil-workflow"
test -z "$(git status --porcelain --untracked-files=all)"
git status --short --branch
git rev-parse HEAD

# The following commands must run in a clean verified branch and private
# subshell. Never paste the loaded environment variables into reports.
(
  set -e
  set -a
  source "$HOME/.config/myschoolboard/phase17-test.env"
  set +a

  npm ci
  npm run db:generate
  npm run verify:local:preflight
  npm run verify:phase3:migration-preflight

  # This is the only planned database mutation, permitted ONLY after the
  # preceding preflight confirms 36 exact applied and one pending migration.
  npm run db:deploy
  npm run verify:migration-checksums

  node --test scripts/phase3-subscriptions-guard.test.mjs \
    scripts/verify-phase3-subscription-migration-preflight.test.mjs

  npx vitest run \
    src/modules/platform/subscription-policy.test.ts \
    src/modules/platform/subscription.integration.test.ts \
    src/modules/platform/school-lifecycle.integration.test.ts

  npm run verify:local:guards
  npm test
  npm run format:check
  npm run lint
  npm run typecheck
  npm run build
  npm audit --audit-level=high
  npm audit
  git status --short --branch
)
~~~

**Notes:** \`npm ci\` modifies only the local installed dependencies; this
workflow does **not** run \`db:reset\`, \`db:seed\` or fixture creation.
Do not substitute \`npm run verify:local\` here: that more comprehensive
script includes a seed step and its target-specific safeguards require
separate review. \`git fetch\` does not dispatch CI, but the pushed branch
may have its automatic GitHub pull-request checks.

After migration #37 is applied, the **pre-migration** preflight intentionally
rejects the already-migrated database. Use \`verify:migration-checksums\`
for the subsequent 37/37 integrity check. Never rerun the preflight as if a
failure on an already applied migration justified a reset.

## Acceptance matrix — evidence still required

| Test surface | Required evidence |
| --- | --- |
| Platform-only reads | Anonymous 401, school-role 404, Platform Super Admin 200, no-store responses and no school data for nonoperators |
| Plan revisions | Strict bounded fields, unique features, monotonically allocated per-code versions, original revisions immutable, forged SQL actor denied |
| Subscription history | One school only per listing, exact plan revision, adjacent UTC periods accepted, overlapping and concurrent periods rejected, direct multi-row SQL rejected |
| Lifecycle | PENDING allowed to receive an explicit period without enabling access; CLOSED/legacy unclassified denied; existing academic auth unchanged |
| Console | Authenticated platform page, private route/RSC, keyboard labels and forms, no data in unauthorized page/history/print; mobile/200% zoom checks |
| Cumulative safety | 37/37 migrations, complete Node/Vitest, static/type/build, full audit, and no regression of existing Phase 1–7 privacy controls |

The 6 Phase 3 source-only checks executed in an isolated JavaScript
inspection environment are **not** a substitute for the Node runner, Prisma
validation, PostgreSQL tests or live production-compiled Chrome checks.

**Exit state:** Phase 3 subscription catalog and operator console are
unverified candidates; entitlement enforcement and other canonical Phase 3
requirements remain open. Phase 1–7 acceptance is still blocked. Do not
merge to \`main\` or deploy this work from source-only evidence.
