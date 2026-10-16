# Decision Log

## D-P9-002: Reasoned student-specific fee obligations preserve financial history

- **Status:** Phase 9 obligation implementation authored, NOT DATABASE VERIFIED
  (2026-10-16), subject to disposable PostgreSQL and security acceptance.
- **Decision:** current same-school School Super Admin may explicitly issue
  one immutable student debt per school/ENROLLED pupil/category/session/term
  only for an exact ACTIVE enrollment and latest applicable immutable policy
  revision. Application accepts enrollmentId, revisionId, UUID requestKey
  and reason—not student identity, monetary amount, status, or actor. SQL
  re-derives and snapshots pupil/class/period/category, currency and positive
  minor-unit amount from trusted tenant-bound tables.
- **Idempotency and history:** identical request-key/payload replay returns
  the original obligation; changed replay is denied, and unique pupil/
  category/term constraint prevents a second issue. Price changes append
  revisions, never reprice historical debt. Credits, discounts, disputes,
  withdrawals, actual payments and reversals require separate audited
  append-only events; never silently mutate the original charge.
- **Safety boundary:** `PHASE9_FEE_WRITE_ENABLED` defaults OFF for all
  Phase 9 writes until full DB and authorization acceptance. The school-
  owner-only read is not a guardian or student finance portal; `ISSUED_UNPAID`
  means issued charge only, never confirmed outstanding balance or receipt.
  No live payment provider, upload, settlement or verification workflow.
- **Verification:** synthetic integration test code authored only; three
  structural source-guard predicates passed against GitHub-fetched files
  in isolated V8, not Node. Schema/migrations/CI/security still unexecuted.
  See ADR-P9-002, FEE-REQ-001.


## D-P9-001: Immutable, explicit school fee configuration before obligations

- **Status:** Phase 9 authored, NOT DATABASE VERIFIED (2026-10-16).
- **Decision:** implement immutable FeeCategory and versioned FeeStructureRevision
  for one real same-school category, session/term and SCHOOL/SECTION/CLASS scope,
  with an explicit positive integer minor-unit amount and uppercase
  three-letter currency. No school charges, discounts, student debts,
  payments or receipts are inferred or automatically issued.
- **Permission/default:** only active same-school SCHOOL_SUPER_ADMIN
  configures fee policy initially, consistent with the configuration
  catalog. Class/section/academic period must currently exist and not be
  closed. No default fee amount, auto-assignment, date-driven repricing,
  waiver or national fee policy. BigInt upper bound of 1,000,000,000,000
  minor units is a conservative reversible input ceiling pending a
  school-configurable business policy; values are exchanged as strings.
- **Integrity:** SQL validates actor and school, school-locks version
  allocation, binds targets through school-composite FKs, rejects UPDATE,
  DELETE and TRUNCATE. Future obligations must pin one immutable revision.
  Deliberately defer delegated bursar roles, independent payment verification,
  provider selection, trusted receipt issuance and ledger reconciliation.
- **Boundary:** no live provider/real money and no billing integration.
  This choice does not lift blocked security/CI or release gates.
  See ADR-P9-001 and FEE-REQ-001.


## D-049: Derive effective reviewed manual marks without mutating grade history

- Status: authored/unverified. Keep a teacher-only preview for matching active class/subject/session/term. Only independently APPROVED initial marks and latest APPROVED correction count; pending/RETURNED remain distinguished and final totals withheld until every manual component approved and corrections settled. No assumed CBT/manual merger or official report release. ADR-035.


## D-048: Sequential audited teacher correction requests and independent section decisions

- Status: Authored/unverified. After independent original approval, an active exact source teacher may append a reasoned changed score version; pending blocks further requests. HM PRIMARY/Principal SECONDARY with current exact verified SECTION grant approves/returns separately, and only approved correction becomes the derived effective academic mark. Never modify original teacher mark or prior decisions. No result publication or security bypass; ADR-034.


## D-047: Independent section approval for original written mark proposals

- Status: Authored/unverified. The actual exact active section's verified HM (PRIMARY) or Principal (SECONDARY) may record a one-time immutable APPROVED/RETURNED reasoned decision, never the proposing teacher nor a broader school admin. No mark mutation or official report release. Corrections require separate append-only request/decision history. ADR-033.


## D-046: Written/manual teacher marks begin as immutable unapproved proposals

- Status: Phase 7 authored, NOT TESTED.
- Decision: Make written/non-CBT assessment a separate teacher-owned immutable component (QUIZ/TEST/EXAM, bounded max points) and permit at most one reasoned initial unapproved whole-number mark proposal for each exact ACTIVE enrolled pupil in that class/session. Validate teacher actor, assignment, active term, mark bounds and enrollment again in SQL; append-only audit blocks edit/delete/truncate. A future correction is a different reasoned academic request with independent HM PRIMARY / Principal SECONDARY authorization, never an overwrite. Until independently adopted, manual proposals are invisible to provisional/official aggregates.
- Rationale: Avoid smuggling uncontrolled manual marks into immutable CBT objective scoring or legally meaningful report cards while still building teacher workflows. Review/publication/security gates remain blocked. ADR-032.


## D-045: Explicit append-only school grading profile revisions, with fail-closed previews

- Status: Phase 7 grading foundation authored; NOT EXECUTED.
- Decision: Choose a reversible per school/session/term/class/subject immutable School Super Admin-authored QUIZ/TEST/EXAM weighting profile (non-negative integer percentages exactly 100). No global/national school weighting default. Each change appends a SQL-serialized reasoned version; no in-place edits or historical score recalculation. Display separate provisional teacher-only weighted preview only when every positive-weight category has at least one published assessment and each has a scored attempt. No official status, student grade publication or auto-migration of records.
- Consequence: Profile is a **policy candidate**, not adoption. Manual/theory scores, alternate CA rules, exam eligibility and report-card acceptance remain separate decisions; full database/CI/strict audit gate blocked. See ADR-031.


## D-044: Teacher-only provisional class record, best scored attempt until school grade policy

- Status: Authored; unverified. The teacher owning an exact ACTIVE class/subject/session assignment may trigger SQL-computed objective marking of their submitted attempts (not supply marks) and privately view current ENROLLED students in that same class/session/term. The provisional per-assessment best scored attempt rule prefers highest percent, then marks, then earlier ordinal; pending scores do not count as zero. The reader bounds pupil and assessment rows and fails closed on duplicate enrollment. No permanent class sheet or official result publication occurs, and no other roles inherit grade access. CA/exam weights, theory grades, grading scales, correction and report release need later scoped audited design/acceptance. See ADR-030.


## D-043: Teacher-authorized server objective scoring, independent of publication

- Status: Authored unverified. Immutable one-per-submitted-attempt PostgreSQL calculated score based on latest answer event and secret key, exact active original teacher, separate review/release and school rules. No student publication, staff override, theory grade or mutable marks. New scoring decisions require audited correction workflow, not UPDATE. ADR-029.


## D-042: CBT student resume requires final-query exact active ownership and no keys

- Status: Implementation candidate; integration/browser/DB gates unexecuted.
- Decision: A student's active CBT question/resume read is scoped in the FINAL SQL content query to their signed-in school STUDENT membership, unrevoked attested child link, current exact active enrollment, sealed approved published nonwithdrawn assessment, active teacher/term and unsubmitted/unexpired attempt. Return only questions/options and the student's latest saved option, no answer keys/scores/other-pupil identities. The internal reader has no student HTTP route until Phase 6 and local acceptance pass. See ADR-028.


## D-041: Key-blind immutable CBT autosaves and separate final submission

- Status: Phase 7 additive code authored; no SQL/CI acceptance.
- Decision: Persist each submitted option selection as an immutable school/attempt/question-bound AssessmentAttemptAnswerEvent with its own UUID idempotency key and SQL-generated sequential question revision/UTC timestamp, not a mutable latest-answer row. A second distinct request key creates a new audit revision; same-key/same-payload replay is acknowledged once, changed replay denied. Maintain one immutable terminal AssessmentAttemptSubmission per attempt; never rewrite admission start/deadline or prior autosaves. A terminal submission does not produce grades or publish results.
- SQL/server boundary: repeat active exact attested student+enrollment, approved+PUBLISHED/not-withdrawn draft, current teacher/term, sealed selected question/option and server deadline. Both event kinds serialize on school + attempt and reject new writes after cutoff/submission. Internal-only serializable services remain hidden until safe question projection, real student UI and cumulative database/CI/audit verification. See ADR-027.


## D-040: Fail-closed CBT admission reservation is not student examination delivery

- Status: Phase 7 candidate authored, PostgreSQL/runtime verification pending.
- Decision: Persist exact-identity CBT attempt starts in an immutable AssessmentAttempt record with redundant school/class/session/student/enrollment/member/attestation link composite references. Require actual signed-in same-school STUDENT membership and unrevoked administrator-attested enrolled pupil; separate approved HM/Principal review and PUBLISHED without WITHDRAWN; current active school/class/section/teacher assignment/session/term. The DB admission trigger holds the existing shared school lock, assigns attempt numbers and trusted UTC start/deadline, enforces 1–3 configured attempts, disallows another unexpired reservation and retains all starts including abandoned. All direct UPDATE/DELETE/TRUNCATE rejected.
- Engineering boundary: offer only an internal transactional reservation service and synthetic tests now; do **not** add student HTTP routes or deliver exam questions until independently audited idempotent resume, autosave, submission, scoring and current eligibility reads are implemented, Phase 6 identities verified and full local CI/audit exit succeeds.
- Limitations: no submission/early-completion handling yet, so reservations remain active until deadline; school-timezone presentation and clock-skew/performance testing remain pending. See ADR-026.


## D-039: Independent School Super Admin assessment publication and terminal withdrawal

- Status: Phase 7 additive development candidate, unexecuted.
- Decision: Maintain strict separation between HM/Principal exact-section academic approval of a sealed assessment and the school-controlled publication decision. Conservative initial publish/withdraw actor is active same-school SCHOOL_SUPER_ADMIN only (ordinary school/platform admins, teachers and reviewers have no implicit publish rights). The latest configuration cannot be edited; record an immutable PUBLISHED event only after approved sealed active assessment, and at most one immutable WITHDRAWN event afterward. Withdrawal is terminal and may occur when the original teacher assignment is no longer active, as a fail-closed withdrawal mechanism.
- Scope: A publication record is NOT automatic release to students. No current student exam reader, answer-key reveal, attempt/score service or class record data is enabled. Production-specific publication policy remains configurable only after explicit security/identity and school acceptance. Tests/migrations remain unexecuted. See ADR-025.


## D-038: Section academic assessment moderation before separate CBT publication

- Status: Additive Phase 7 candidate, not validated or production-authorized.
- Decision: A sealed immutable teacher assessment draft receives at most one terminal reasoned APPROVED or RETURNED academic review event. Only active HM with verified PRIMARY section of the draft's true class or Principal with verified SECONDARY section can review. Validate actor membership, stage, grant, current assignment/term, complete seal independently in PostgreSQL. Reviewers may preview ordered question text/options/points but not private correct keys. Approvals do not independently publish exams, confer student eligibility, start attempts, calculate scores or approve official report cards.
- Future CBT preflight: use server clock and deadline min(start + duration, exam close), count all attempts toward 1–3 configured limit and deny parallel active attempts. This pure logic is not an authorization boundary until same exact constraints are enforced transactionally and with SQL alongside distinct publication and verified enrollment.
- Finding: previously authored assessment-draft migration included malformed function dollar quotes; repaired on cumulative branch and test guard added, actual PostgreSQL migration execution pending. D-023 permits this safe review hardening without release approval. See ADR-024.


## D-037: Immutable draft-only assessment setup with post-creation seal

- Status: Phase 7 development candidate, untested.
- Decision: Teacher-owned assessments start as non-publishable immutable QUIZ/TEST/EXAM configuration snapshots, not active CBT assessments. Require exact active teacher assignment, school/class/subject/session/term, UTC window inside current active term, bounded duration/attempt/pass rule and 1–50 unique pre-keyed questions from the same owned assignment. Each selected item has explicit bounded points; these are future marking definitions, not released student results.
- Direct SQL protection: School-locked insert validators enforce actor identity/resource and question eligibility; service inserts draft+items+one-time `AssessmentDraftSeal` inside serializable transaction. Any later item addition is rejected; both snapshot and seal are immutable and unsealed entries are not displayed. No student attempt, score, answer disclosure or publication handler is authorized.
- Trade-off: UTC is explicit for initial internal schedule data; school-local exam delivery/window conversion, grading/attempt policies and moderation/approval are separate future work. Corrections create new audited drafts, not updates. Keep Phase 6/local CI/security gates blocked; see ADR-023.


## D-036: Teacher-owned private question bank and separately guarded answer keys

- Status: Phase 7 candidate authored but NOT tested against PostgreSQL or CI.
- Decision: Require an active TEACHER membership and exact current school/class/subject/session/term subject assignment to author multiple-choice questions. Store immutable question text/options in AssessmentQuestion and the correct option index in an independently immutable AssessmentQuestionKey created atomically, never returning keys in teacher metadata GET or POST. Neither a Form Teacher responsibility, an independent CLASS/SUBJECT grant, a school-wide administrator nor platform support is an author override. PostgreSQL independently enforces the exact actor-assignment relationship, validates 2–6 distinct nonempty options and key index. No student endpoints, publication, scoring, grade sheets, key reveals or exam attempts in this foundation.
- Constraints: Bounded metadata reads and private no-store HTTP; authoring UI defaults to four options while server supports 2–6. Updating a question requires a later separately audited versioned workflow, not mutation of historical key/text. Phase 6 and strict local CI/security gates remain blocked. See ADR-022.


## D-034: Administrator-attested, one-to-one student account ownership

- Status: Conservative development implementation; identity evidence/business acceptance pending.
- Decision: There is NO inferred student-user link. School admin explicitly attests an existing active STUDENT membership to the same-school ENROLLED StudentRecord with current ACTIVE enrollment and required explanation. Each student and each STUDENT membership may be linked at most once, with a terminal reasoned immutable revocation. The database validates school, role, enrollment, attestor and revocation. A membership, email, name, admission number, teacher/super-admin role or historic enrollment cannot independently grant a released lesson read.
- Consequences: Existing student accounts require active per-student administrator verification. Revoked bindings never automatically relink; any reassignment requires a separately approved lifecycle design. The product must not release child data solely on weak name/email similarities. See ADR-020.

## D-035: Typed schemes of work share the controlled lesson planning lifecycle

- Status: Least-privilege Phase 6 development default; tests and CI outstanding.
- Decision: Schemes of work are typed `SCHEME_OF_WORK` documents with immutable first/last teaching weeks (1–53) on the existing LessonNote / immutable revisions and review/release event architecture, not a new automatically published document store. Ordinary lesson notes retain `LESSON_NOTE` by default. Scheme content requires exact active teacher assignment, term/session, staged submission/return and HM PRIMARY / Principal SECONDARY approval; only a separate explicit RELEASED event and a verified pupil/class/term link permit learner reads. Publication withdrawal revokes visibility without deleting the history.
- Consequences: School-specific week structure and future scheme template formats may be configurable later, but do not weaken versioning/approval/release/privacy. See ADR-021.


## D-033: Explicit lesson release distinct from approval (development default)

- Status: Authored, not executed or released.
- Decision: An HM/Principal section approval never automatically publishes lesson content to learners. An active exact verified HM PRIMARY / Principal SECONDARY reviewer may append a separate reasoned RELEASED event for the exact current approved immutable lesson revision, and later WITHDRAWN once. SQL guards independently validate school/class/subject/term/session, teacher assignment, approval event and correct actor section. A withdrawn revision cannot silently republish. No automatic student relationship from membership or name.
- Next: verified student-account/student-record link with explicit administrator attestation; exact active class/session and term-visibility reader; disposable DB and security checkpoint. See ADR-019.


## D-032: Explicit, immutable school teaching-day calendar

- Status: Development default; not production-verified.
- Decision: Do not infer weekends or national public holidays for every school. Instead, an active School Administrator/Super Admin may append an actor-attributed revision designating a specific date teaching or closed. The latest designation controls only future SUBMITTED attendance events. Once attendance has been recorded for that date, deny any further designation changes to avoid silently rewriting academic history. Require school lock, reason, sequential date revision and independent SQL actor check. Corrections of already approved attendance remain governed by their immutable history and school correction window.
- Consequences: School holiday import/feed, regional observances and calendar synchronization are not approved or implemented. Existing UTC/date, Form Teacher and section-scope checks remain strictly enforced. See ADR-018.


## D-031: Audited school calendar-day attendance policy (development default)

- Status: Draft implementation; not business policy approval or executed validation.
- Decision: Configure school attendance timezone and age limits as append-only actor-attributed SchoolAttendancePolicyRevision rows rather than overwriting an old school setting. Only active same-school school:configure members may add revisions; SQL must validate actor, sequential revision and PostgreSQL-recognized time zone in addition to service authorization. The no-revision default is Etc/UTC with past 7 calendar days for submission and past 30 days for corrections. School may choose submission 0–30 and correction 0–365 days. Local calendar arithmetic accounts for daylight saving transitions.
- Preserve the original UTC nonfuture submission constraint: a configured school timezone may **restrict** but must not extend that limit. This conservative overlap avoids rewriting earlier SQL actor/audit guards pending validation. All original marks and prior correction approvals remain immutable when policy changes. School holidays, closure exceptions and broader retrospective policy require future specification and tests; no production authorization implied.
- Enforcement: server checks within school-locked serializable transactions plus additive direct-write SQL event/correction-request guards and immutable audit. This may be tightened after full DB evidence, but cannot be loosened silently. See ADR-017.


## D-030: Database independent exact full-roster submission guard

- Status: Development-only hardening authored; trigger and tests not executed on PostgreSQL.
- Context: Existing UI and serializable submit service reject partial rosters, but the initial SQL AttendanceEvent actor trigger only demanded at least one entry. A database caller could record an otherwise eligible Form Teacher submission with omitted active pupils.
- Decision: Layer an additive BEFORE INSERT ON AttendanceEvent trigger for SUBMITTED events that takes an active school row lock and enforces 1–500 entries, equality with the complete ACTIVE enrollment/ENROLLED student roster for the persisted school/class/session, and individual entry eligibility at the stored date. Do not remove, replace or relax existing composite FKs, actor validators, deferred event-presence triggers or immutable audit history. Preserve API full-roster checks as defense-in-depth.
- Consequences: add direct SQL rejection/rollback integration test and lightweight read-only schema-invariant guard inside existing `npm test`; no data backfill, migrations applied, release claim or new permissions. Source-inspection pass is not DB execution. See ADR-016.


## D-029: Restricted correction read disclosure default (unverified)

- Status: Development-only implementation direction; no user/live data access authorized.
- Decision: Current active PRIMARY Form Teacher relationship permits viewing approved registers for exact school/class/session, including the immutable original and computed latest approved corrected mark of an individual historic pupil entry. Reviewers see a pending correction queue of register/class/date metadata **without** pupil name, mark or reason; reviewer detail adds minimum data only with a fresh exact stored section and verified stage-matched HM/Principal authority check. All reads are no-store and deny foreign IDs; server pages recheck roles.
- Rationale: Distinguish correction evidence from retroactive overwriting while respecting verified staff/student/class relationships. Pending/returned proposals may never silently become official attendance or be disclosed to guardians/students.
- Outstanding: operation must be tested on disposable DB; consent/privacy review, correction windows, school-specific timezone, historical closed-period policy and local CI-equivalent are release blockers, not authority to broaden data access.


## D-001: Documentation-first baseline

- Status: Accepted
- Decision: The repository is being treated as a documentation-first product baseline before implementation.
- Rationale: The repository contains a specification-first documentation baseline and no application implementation evidence.

## D-002: Multi-tenant architecture model

- Status: Proposed
- Decision: Shared SaaS platform with explicit tenant isolation and school-scoped configuration.
- Rationale: Required by product and security specifications.

## D-003: Two distinct super-admin roles

- Status: Required specification
- Decision: Platform Super Admin and School Super Admin are distinct roles with different authorization scopes.
- Rationale: The product requires explicit separation between platform-level and school-level authority.

## D-004: Final publication by School Super Admin

- Status: Required specification
- Decision: Official report cards require final School Super Admin approval before parent access.
- Rationale: This is a mandatory product requirement.

## D-005: 30-day school trash, 90-day platform trash

- Status: Required specification
- Decision: School Trash retention is 30 days; platform Trash retention is 90 days.
- Rationale: Explicitly required by the business specification.

## D-006: Documentation baseline commit on main

- Status: Verified
- Decision: The repository now contains a documentation baseline commit on main.
- Rationale: Repository inspection confirmed the live Git state and the branch was updated accordingly.

## D-007: Phase 1 implementation remains gated

- Status: Superseded by D-010
- Decision: This was the gate before the local foundation work began; it no longer describes the current repository state.
- Rationale: The local foundation and implementation-state decisions are recorded below. Production and later-phase decisions remain gated.

## D-008: Local Phase 1 foundation verified

- Status: Locally implemented and verified for the documented scope
- Decision: The project has a verified local application foundation built with Next.js, Better Auth, Prisma, and PostgreSQL using explicit tenant validation and access checks.
- Rationale: Local migration, seed, test, lint, typecheck, format, and build commands passed. This does not claim production readiness or completion of all SEC-REQ-001 / TEN-REQ-001 acceptance criteria.

## D-009: Production hosting and external identity remain deferred

- Status: Deferred
- Decision: Hosting provider and domain selection remain deferred until local development and testing are complete; external identity-provider selection and production deployment remain unresolved pending owner approval and environment design.
- Rationale: The local validation proves the app foundation, not a hosted production system.

## D-010: Approved local technology direction

- Status: Approved for the local foundation
- Decision: Use TypeScript, Next.js, PostgreSQL, and a modular-monolith architecture for local development and testing.
- Rationale: This is the implemented stack and the approved scope for the current checkpoint; it does not select a hosting provider or domain.

## D-011: Local authentication and identity-provider boundary

- Status: Better Auth implemented locally; external provider deferred
- Decision: Better Auth currently provides local email/password authentication and server-side session validation. Final external identity-provider selection remains open.
- Rationale: Local implementation evidence does not constitute provider approval or production identity readiness.

## D-012: Tenant enforcement and RLS

- Status: Application checks implemented for current access paths; RLS deferred
- Decision: Current protected school access uses server-side active-membership checks and role policy. PostgreSQL RLS is not enabled.
- Rationale: Local integration tests cover implemented tenant-context boundaries; future routes and operations still require the same enforcement and tests.

## D-013: Support-access default

- Status: Default approved; enforcement workflow outstanding
- Decision: No unrestricted routine support access. Any exceptional access must be authorized, scoped, time-limited, justified, and audited.
- Rationale: The policy boundary is approved, but the exact approval, enforcement, expiry, and audit mechanism has not been implemented and remains a security requirement.

## D-014: Later-phase product decisions

- Status: Deferred
- Decision: Payment-provider selection is deferred to Phase 9; parent-first report visibility to Phase 8; QR disclosure to the QR verification implementation phase. Hosting provider and domain remain deferred until local development and testing are complete.
- Rationale: These decisions are outside the verified local foundation and must remain unresolved until their owning phase.

## D-015: Dependency audit remains a security and release blocker

- Status: The original dependency-remediation/release restriction remains active. D-022's time-limited exception records publication of the *original checkpoint*; D-023 separately authorizes routine ongoing development and draft PRs without accepting production dependency risk.
- Decision: The known dependency findings remain unresolved. D-022 Option C supersedes Option A only for publishing the specifically scoped development-only feature branch and pull request; it does not accept production risk, authorize merging to `main`, production deployment, or release. Preserve the `npm audit --audit-level=high` CI gate and disclose its expected failure.
- Rationale: The 2026-10-10 dependency review recorded no verified compatible remediation for the two advisories. See [Dependency Advisory Assessment](../security/DEPENDENCY_ADVISORY_ASSESSMENT.md) for dated evidence; reassess current fixes before release. Do not suppress or weaken the CI audit gate. Dependency findings do not halt ordinary non-production feature development.

## D-022: Approved limited development-branch dependency risk exception

- Status: Option C approved for the limited scope below; effective 2026-10-11 through 2026-10-18. D-015 Option A remains active for all other purposes.
- Question: May a reviewed feature branch and pull request for local-development work be published while the two known high-severity advisories remain unresolved and the existing CI audit job fails?
- Approval: Option C approved 2026-10-11.
- Approver: Platform Admin — MySchoolBoard Project Owner.
- Risk owner: Platform Admin — MySchoolBoard Security Risk Owner.
- Authority: Sole Project Owner and Final Decision-Maker.
- Approved scope: Development-only feature-branch publication and draft pull request containing the validated 81-file changed/new manifest (139 projected repository paths), subject to separate push authorization.
- Accepted advisory IDs for this limited exception: GHSA-vfj7-8cjw-p6xm and GHSA-ggr8-5vv4-36mx. The full audit reports 8 high-severity package findings; the production-only audit reports 3. This is a temporary, scoped development-publication risk decision, not a finding that the advisories are harmless or a production security acceptance.
- Compensating controls: Preserve `npm audit --audit-level=high` unchanged in CI and disclose all 8 high-severity findings, including the 3 from production-only audit. Do not bypass, disable, weaken, or misreport the audit gate. Keep the current dependency versions and audit evidence; monitor both advisories and reconsider when compatible remediation becomes available.
- Restrictions: No merge to `main`, production deployment, release, or claim of production readiness under this exception. TCH-REQ-001, TEN-REQ-001, and SEC-REQ-001 remain open. The exception expires or must be reviewed by 2026-10-18.
- Separate authorization: This risk approval does not authorize push, merge, deployment, or release. Push authorization remains separate. The current checkpoint preparation request separately authorizes creating the named local branch, staging the exact manifest, and making one local commit.
- Decision record: The approval identity, scope, expiry, controls, and advisory exposure are also recorded in the [Dependency Advisory Assessment](../security/DEPENDENCY_ADVISORY_ASSESSMENT.md).
- Publication evidence (2026-10-11): The exact 81-file checkpoint commit `2c7c6b9a905272ac5f9cc70d06b67367b2c1c791` was separately authorized and pushed to `checkpoint/phase1-tenant-safe-foundation`; [draft PR #1](https://github.com/Wilberry/myschoolboard/pull/1) was created. This records completion of those specific actions, not permission for merge, deployment, or release.
- Subsequent governance (D-023, 2026-10-12): The 2026-10-18 date remains the historic review/expiry of **this specific risk acceptance**, not a project deadline or a requirement for per-branch/per-feature sign-off. D-023 does not renew, retroactively enlarge, or override its accepted security exposure.

## D-016: Canonical teacher assignment persistence

- Status: Implemented and locally validated for the schema and policy-helper checkpoint
- Decision: Persist one assignment row per exact school, membership, class, and subject tuple. Enforce school consistency with composite foreign keys and retain assignment history through status transitions on the same row.
- Rationale: Independent scope grants cannot represent a teacher's exact class-subject authorization. No grants are backfilled. The assignment creation service must validate active teacher role, and protected academic routes remain outstanding.

## D-017: Assignment administration and lifecycle audit

- Status: Service and four mutation routes implemented and locally validated against the disposable PostgreSQL test database; no UI, assignment reads, or academic read routes
- Decision: Derive the actor from the Better Auth session; require the existing `school:configure` policy; validate target membership, class, subject, school, and lifecycle state server-side; write each status change and its actor-level event in one serializable transaction.
- Rationale: Assignment administration must not trust client actor identifiers or mutable timestamps as history. The HTTP handlers authenticate and authorize the school context, then call the service, which locks current authorization and target rows inside the mutation transaction. Composite database constraints bind events to their assignment and teacher; an insert trigger validates the actor snapshot. Append-only triggers block ordinary event changes, while approved school cascade cleanup remains permitted. Mutation-route integration coverage passes against the guarded disposable database. No audit read interface or UI is introduced.

## D-018: Active class and subject name uniqueness

- Status: Implemented and locally validated
- Decision: Active names are unique per school on `lower(btrim(name))`; case differences and surrounding ASCII spaces normalize to the same name, internal whitespace remains significant, and inactive records do not reserve the name.
- Rationale: A read-only duplicate precheck found no existing active collisions in the local development database. Additive partial expression indexes enforce the rule without modifying existing records.

## D-019: Assignment audit actor history and test database isolation

- Status: Approved by the project owner on 2026-10-10
- Decision: Store actor user and membership IDs as immutable historical snapshots without foreign keys. Validate their school/user association when each event is inserted. Later user or membership deletion must not rewrite or remove an event; school deletion remains the existing explicit tenant-cleanup exception. Database-writing tests must use the separately configured disposable `myschoolboard_test` database.
- Rationale: This preserves the current user and membership deletion behavior while retaining actor identity in audit history. Target assignment, school, and teacher membership are enforced with a composite foreign key. The migration and tests passed on the ephemeral test database; the normal development and production databases were not used.

## D-020: Assignment read-route authorization

- Status: **Development implementation default adopted under D-023 on 2026-10-12; not implemented or locally validated.**
- Decision: School-level teacher-assignment **administrative** list/detail reads may be implemented only for an authenticated, active school membership with `school:configure`, scoped to that school and with a deliberately minimal response. Cross-school or nonexistent IDs remain indistinguishable. Do **not** reuse broad `academic:read` to expose administration records, and do not grant teachers or platform operators additional school authority.
- Future teacher self-service: Design a separate explicitly resource-scoped view, restricted to the requesting teacher's own exact active school/class/subject assignment. This development default does not enable that route by implication.
- Rationale: Reuse the already restricted administration permission rather than widening ordinary academic access. New routes require actual negative tenant/role tests before use; production policy may refine the school-configurable readers without broadening default access.

## D-021: Academic assignment domain implementation direction

- Status: **Reversible, school-configurable development defaults authorized under D-023 on 2026-10-12; schema and acceptance still require implementation/testing.**
- Decision: Add school-owned `AcademicSession` with terms beneath it and session-scoped *new* subject assignments. Permit more than one teacher per class/subject/session while preventing duplicate assignment for the same teacher and pair. Keep curriculum eligibility configurable rather than assuming a universal required `ClassSubject`. Model Form Teacher responsibility separately from subject-teacher assignments; support a primary responsible teacher and explicitly modeled co-responsibility/handover without silently imposing irreversible cardinality on legacy data. A school membership may hold both responsibilities, each with distinct permissions.
- Decision detail: P-013 through P-017 in [Product Decisions for Approval](PRODUCT_DECISIONS_FOR_APPROVAL.md) document the development defaults and school-specific options. Follow that module's tests and requirements; do not treat design authorization as feature completion.
- Safety constraints: **Never infer periods for existing period-free assignments** from timestamps, status, or scope grants. Use additive schema with explicit legacy handling; require authoritative data mapping before a destructive or mandatory backfill. Maintain same-school FKs, tenant isolation, transactional authorization, audit history, and distinct D-020 assignment-administration reader permissions.
- Rationale: The documented product explicitly supports configurable primary/secondary school staffing. Secure reversible defaults let implementation advance while preventing silent data rewrites or unjustified restrictions.

## D-023: Standing, roadmap-led development authorization

- Status: **Approved by the Project Owner on 2026-10-12, effective for routine non-production implementation going forward.**
- Decision: The existing charter, requirements, module specifications and phased roadmap constitute the ongoing engineering mandate. Engineers and agents may design, implement, test, refactor, document, commit, push reviewed *non-default development branches*, and open draft PRs within that scope without repeated per-task approvals. Use secure, reversible, configurable defaults for ordinary specification gaps, record decisions, and continue other work if one material choice remains isolated.
- Reserved decisions: New material business/legal policy, irreversible live-data changes, production/shared-data operations, broadening minor/financial-data access, external payment/communication rollout, **merging to `main`**, deployment, release, and acceptance or weakening of a failing security gate still require explicit Project Owner authorization and completed safety checks. In-product academic, payment and support-access approvals remain mandatory.
- Security effect: **No waiver** of tenant isolation, active membership/resource authorization, verified relationships, immutable audit, CI-equivalent local verification, or `npm audit --audit-level=high`. The recorded high-severity dependencies remain unresolved and block release readiness. D-022 remains a historical, limited exception ending/requiring review 2026-10-18; **that date is not a deadline for ordinary engineering and D-023 is not a renewal of its risk acceptance**.
- Authority and rationale: Explicit Project Owner instruction to remove unnecessary approval loops while following the canonical roadmap and requirements. The controlling operational rules are in [Standing Development Mandate](STANDING_DEVELOPMENT_MANDATE.md). This change does not assert that new features are implemented, tested, deployed, or production-ready.

## D-024: Section-scoped lesson-note reviewer default (unverified implementation)

- Status: Draft development default under D-023; **not** a product owner's final school-specific academic policy, migration validation or release approval.
- Decision: `HEAD_OF_SECTION` reviews only notes in a verified active same-school PRIMARY section, while `PRINCIPAL` reviews only notes in a verified active same-school SECONDARY section, as identified by the note's stored class.sectionId. All decisions require an auditable reason and current revision; only SUBMITTED notes can be reviewed. A RETURNED note requires a new immutable author revision before re-submission; APPROVED does not make notes visible to students.
- Rationale: This preserves the documented school roles and section isolation without fabricating missing historical class mappings or broadening sensitive school-data access. See ADR-010. Review and event migration tests remain outstanding; school-configurable reviewer delegation, cross-section staffing and student release must be separately designed.

## D-025: Additive, school-owned student enrollment default (unverified)

- Status: Routine D-023 development default; source authored, migration/tests not executed, no live or production approval.
- Decision: Keep student registration separate from `User` login records, use normalized school-owned admission codes and explicit ACTIVE same-school academic-session/class/Section enrollment rather than inferred historic records, and preserve class history by reasoned withdrawal to ENDED state. Enforce school admin-only registration and lifecycle writes with actor-audited immutable events and a PostgreSQL one-active-student/session partial unique index. No pupil/student/guardian reads or attendance writes are enabled by this initial schema.
- Rationale: Establishes an auditable, tenant-safe prerequisite for attendance without fabricating child relationships or exposing sensitive student data. School-specific admissions acceptance, promotion, re-enrollment, transfer and graduation workflows remain future requirements. See ADR-011; complete local verification required before any release.

## D-026: Exact-roster daily attendance and terminal reviewed state (development default)

- Status: Development-only proposed implementation; migrations, suites and full CI not executed.
- Decision: For the initial Phase 6 slice, bind each attendance mark by exact same-school student/enrollment/class/session composite keys and prevent duplicate school/class/session/day registers at PostgreSQL. Only an active PRIMARY Form Teacher responsibility for the current actor and exact class/session can submit a complete currently active class roster. A single review from SUBMITTED to APPROVED or RETURNED requires an HM's verified PRIMARY section scope or Principal's verified SECONDARY section scope. SQL actor-event validation, deferred event-presence checks and append-only entry/event protections supplement serializable application transactions. No implied platform/teacher/student/guardian reads or support overrides.
- Conservative unresolved-school-policy behavior: no future attendance beyond the UTC current calendar day, even while school timezone configuration is absent; terminal decisions cannot be edited, replaced or resubmitted in this slice. A later approved correction workflow must append reasoned changes while retaining original marks and author/decision provenance. Absence/presence categories are PRESENT/ABSENT/LATE/EXCUSED for this provisional implementation; any school-specific leave or attendance codes require explicit configurable future handling.
- Consequences: Safe non-production structural development may proceed without accepting new disclosure, historic backfills or irreversible correction policy. Future Form Teacher roster reader, verified section queue, correction ledger, school calendar/timezone, tests and security gates remain mandatory. See ADR-012 and ATT-REQ-001.

## D-027: Narrow Form Teacher and section-reviewer attendance readers (development default)

- Status: Development-only, unverified candidate; **not** permission for deployment or unrestricted pupil data.
- Decision: Authenticated Form Teachers (including a TEACHER membership carrying a distinct PRIMARY Form Teacher responsibility) can view only their exact ACTIVE school/class/session enrollment roster with minimal admission number/names and student/enrollment IDs, using a single SQL statement joining active school, class, session, section, actor membership, PRIMARY responsibility and student enrollment. Support-only Form Teacher responsibility and independent class/subject teacher assignments do not grant roster access. Head of Section reviews only the PRIMARY section in its exact active verified grant; Principal reviews only SECONDARY. Reviewer queue returns register metadata without minor identities; authorized single-register detail returns its historical marks and minimum names. No generic student GET, export, parent/guardian access or broad `academic:read` reuse.
- Browser default: No attendance status is preselected; each pupil must be explicitly marked before submitting an immutable whole-class register. A review must include a reason; terminal review cannot edit submitted marks. All mutations recheck transactional authorization independently of UI navigation.
- Consequences: Author these narrowly relationship-scoped readers and screens under D-023, with tests and documented sensitive projection. Complete disposable-DB, accessibility, browser, timezone and correction checks before marking ATT-REQ-001 complete or releasing. See ADR-013.

## D-028: Immutable attendance correction requests and separate approvals (development default)

- Status: Drafted implementation, **migration and tests not executed**.
- Decision: An APPROVED attendance register is not reopened and its original pupil marks/events are never mutated. A currently active exact PRIMARY Form Teacher can append an immutable reasoned correction request for an exact existing register entry, even if the pupil's historical enrollment subsequently ended; school, class, Section, and session must currently be active. The request snapshots prior effective mark, proposed mark, original entry, actor, reason and revision. At most one pending request exists per entry; the next correction is allowed only after its predecessor has a separate immutable approval/return decision. The latest APPROVED proposal only (not pending or returned) determines corrected effective mark for future *authorized* read views.
- Approval: a different active HM for PRIMARY or Principal for SECONDARY with a verified ScopeGrant to the actual stored class section decides with reason. No Form Teacher self-approval, general staff role, Platform Super Admin override or cross-school access.
- Safety defaults: closed sessions are not corrected until a school-specific retrospective correction policy can be configured; no automatic past-enrollment reconstruction; no general pupil/correction GET/export is authorized by this initial mutation-only slice. Use composite school/entry/register keys and database actor/expected-mark/revision triggers in addition to service transactions.
- Next: implement authorized effective-mark reader and pending correction queue; run disposable PostgreSQL migration/trigger/rollback and CI-equivalent tests. Existing release/security gates remain unchanged. See ADR-014.

## Unresolved decisions

- Exact support-access escalation, enforcement, expiry, and audit mechanism
- Exact parent-view acknowledgment semantics for the parent-first policy
- Hosting provider and domain selection
- Payment provider, currencies, and reconciliation model
- Final public QR verification and disclosure fields
- External identity-provider selection and production identity strategy
- Remediation or explicit risk acceptance for high-severity dependency advisories
- Security remediation for D-015; the historic D-022 **original-checkpoint** risk exception is reviewed/expires 2026-10-18, but ordinary non-production work continues under D-023
- Whether section, stream, grade, code, or academic-year dimensions belong in class/subject identity
- Whether future audit readers, retention, or export workflows require additional owner-approved policy
- Whether individual schools require additional assignment-administration reader roles beyond D-020's conservative `school:configure` development default (do not broaden access without a documented school policy)
- School-specific configuration of curriculum eligibility, co-teaching, Form Teacher co-responsibility and handover under D-021/P-013–P-017; safe additive development can proceed while destructive legacy backfills remain prohibited

These items remain tracked in their owning phase; they are not all stop-work gates. Follow D-023 and the standing mandate to build reversible development defaults. Do not misrepresent unresolved **production** choices, implementation status, validation or historical risk approvals.
