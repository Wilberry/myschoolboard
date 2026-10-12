# Authorization Rules

## Phase 7 reviewed-only manual academic gradebook foundation — AUTHORED, NOT VERIFIED

`feature/phase7-reviewed-manual-gradebook` implements a distinct private, read-only **ACADEMIC_APPROVED_PREVIEW_ONLY** teacher gradebook for exact school/session/term/class/subject. Final SQL binds actual signed-in current TEACHER to matching ACTIVE class/subject/session assignment, active school/class/section/subject/period/term, ENROLLED student and exact ACTIVE class/session enrollment; results bounded 500 students, 30 written components, 15,500 rows and fail closed for duplicate enrollment/ambiguous component rows. This reader does not join assessment answer keys or CBT answers.

For each student/written component, it distinguishes **PENDING_TEACHER_MARK**, **PENDING_ACADEMIC_REVIEW**, **RETURNED_NOT_APPROVED**, **APPROVED_INITIAL**, **APPROVED_CORRECTED**, **APPROVED_CORRECTION_PENDING**, and **APPROVED_CORRECTION_RETURNED**. Effective points derive only from initial independent APPROVED decision and most recent APPROVED correction revision; pending or returned marks never replace prior approved values. No term percent is shown if any manual component lacks approved points, any correction remains pending, or there are no components: status remains INCOMPLETE. Raw partial approved mark sum is separately identified and not an official grade. Teacher workspace and private no-store GET have **no POST, export, override, student/guardian view, CBT score merger or Phase 8 report publication**.

Synthetic authenticated actual-session test cases compare unapproved original, initial APPROVED, pending correction, approved later revision, teacher-only and foreign role/tenant denial; Node source guard included in existing npm test/verify:local:guards. **AUTHORED BUT NOT EXECUTED**. No migration added in this slice (upstream approval/correction migrations remain unexecuted). Phase 6 and 7 prerequisite gates, PostgreSQL, full CI/security audit BLOCKED. D-049/ADR-035.


## Phase 7 independent manual mark corrections — AUTHORED, UNVERIFIED

`feature/phase7-manual-mark-correction-decisions` implements immutable, sequential `AssessmentManualCorrectionRequest` and one terminal `AssessmentManualCorrectionDecision` per request. Original active same-school TEACHER/assignment may propose changed 0..max integer points **only after independently APPROVED initial mark**, with a 5–500 character reason. The school-row-locked PostgreSQL insert guard checks active exact original teacher, school/class/section/subject/session/term, original pupil/enrollment, rejects a second pending request, rejects a proposed value equal to the last approved effective mark and assigns the next revision and UTC timestamp. The reviewer must be the separately verified exact class-section **HEAD_OF_SECTION for PRIMARY** or **PRINCIPAL for SECONDARY**. Shared initial-mark SQL reviewer validation runs again on each terminal correction decision; stale/duplicate decisions and historical UPDATE/DELETE/TRUNCATE are prohibited.

A correction is not an overwrite. The initial mark remains and effective *academic-approved* points are the latest APPROVED correction revision, or the approved initial mark when no correction has been approved; pending and RETURNED revisions remain audit-only. Current exact TEACHER may see their own approved mark history and request correction; verified-section reviewer sees only eligible pending requests via repeated final SQL joins. Private no-store routes and school-gated teacher/reviewer pages authored. Synthetic real-session correction/review/return/race/immutability tests and Node guards authored but NOT EXECUTED. No official result publication or CBT key exposure, no live data or merge. D-048/ADR-034. Local disposable PostgreSQL, full CI, strict audit, prior Phase 6/7 gates BLOCKED.


## Phase 7 manual mark initial academic review — AUTHORED, NOT VERIFIED

`feature/phase7-manual-mark-section-approval` introduces immutable `AssessmentManualMarkDecision` with a unique original proposal link and terminal `APPROVED` or `RETURNED` outcome, reviewer identity, reason and trusted SQL UTC clock. Only an ACTIVE same-school **HEAD_OF_SECTION for PRIMARY** or **PRINCIPAL for SECONDARY** with a **verified SECTION grant for the actual proposal class's current section** may make a decision. School, member, original teacher/assignment, academic term, ENROLLED student and matching ACTIVE enrollment are independently checked inside PostgreSQL. No reviewer can self-approve, forge a user ID, amend a decision or submit a second outcome. The decision is approval of the initial manual mark, not final or publicly released results.

The private reviewer queue final query repeats verified section, role/stage, current student and assignment joins; only its own relevant initial pending proposals are returned. The reviewer UI and private no-store decision API preserve reasons and do not expose answer keys. Synthetic authenticated tests for wrong role/section, duplicate and immutable audit and read-only Node guard authored, NOT EXECUTED. Phase 6/prior Phase 7 DB migration and full strict local CI/security acceptance remain BLOCKED. D-047 / ADR-033; Phase 7 partial.


## Phase 7 manual written-mark proposal authorization (NOT VERIFIED)

An active exact same-school `TEACHER` may define an immutable non-CBT class/subject/session/term assessment component only for their currently ACTIVE `TeacherClassSubjectAssignment`, and propose a bounded 0..max manual mark only for an actual ENROLLED pupil holding an ACTIVE `StudentEnrollment` for that component's exact class/session. Both the authenticated service and SQL trigger recheck current teacher user+membership identity, exact source assignment, active academic structure and student relation, with original mark/reason preserved permanently. Roster GET joins actual teacher+original component class/subject/term in the final query and caps 500 students. Another teacher, School Admin, School Super Admin, HM/Principal, student, guardian or platform actor has no implicit edit or read authority. A mark proposal never changes objective score, provisional grade, parent/student display or official result. Only a future separate audited section-academic approval/correction workflow may adopt marks; no direct UPDATE. D-046/ADR-032. Tests/runtime not executed.


## Phase 7 school grading profile drafts (NOT VERIFIED)

Only an active same-school `SCHOOL_SUPER_ADMIN` may create or list school/session/term/class/subject grading preview revisions. PostgreSQL validates the true school/member/user, ACTIVE session/term/section/class/subject, and sums QUIZ+TEST+EXAM weights exactly 100; it allocates the next version under a school lock and preserves prior revisions. A TEACHER may **not** author the school policy; the teacher's private class-sheet query may see latest weights only for the teacher's exact active assigned class/subject/session/term, with no cross-class/student access. Policies are DRAFT_PREVIEW_ONLY; no student, guardian, teacher/admin privilege escalation to official grades/results, no assumption of standard weighting, no report publication. Local test/security gate pending. D-045/ADR-031.


## Phase 7 private teacher marking and provisional subject records (UNVERIFIED)

An authenticated active TEACHER with current exact `TeacherClassSubjectAssignment` to the same school's class+subject+session is the only candidate for marking submitted objective attempts and viewing that assignment's provisional class record sheet in an ACTIVE term. The private query rejoins that same authorization at the final student/score row projection and only ACTIVE matching class/session StudentEnrollment and ENROLLED StudentRecord. Staff School Administrator, unrelated TEACHER, HM/Principal, support and other-school actor do not automatically gain these subject records. No guardian, student or report publication route. No key or raw-answer disclosure; objective grade is SQL-computed and immutable. Provisional best attempt per published/reviewed assessment and score-only denominators remain defaults pending school-specific policy and full CI acceptance. D-044 / ADR-030.


## Phase 7 internal objective CBT auto-scoring (AUTHORED, NOT VERIFIED)

`feature/phase7-cbt-objective-scoring` adds immutable `AssessmentAttemptScore` (one per exact school/attempt) with max/earned weighted marks, basis-point percentage, correct count, pass threshold and UTC timestamp. An authenticated current ACTIVE exact original TEACHER for the assessment class/subject/session invokes an **internal-only** serializable scoring function after a terminal submitted attempt on a sealed, APPROVED and PUBLISHED (not withdrawn) active assessment. SQL BEFORE INSERT repeats the exact actor/teacher/assignment/term/submission authorization and **computes all numeric results itself** by joining the private `AssessmentQuestionKey` in the database and selecting each question's highest accepted response revision, counting unanswered questions as zero. The service never selects keys or accepts numeric grades from the client. Score records cannot be updated/deleted/truncated or duplicated; idempotent calls return the one original snapshot. Student scoring/result endpoints and official report publication remain absent. Synthetic correct/latest-response, unauthorized scoring, replay and immutable audit tests plus Node guards AUTHORED BUT NOT EXECUTED; no migrations or full CI/e2e/audit run. This is objective marking only—manual theory marking, review and official results are separate. D-043/ADR-029. Phase 6 and Phase 7 exit BLOCKED.


## Phase 7 key-blind enrolled-student CBT resume (authored, NOT VERIFIED)

Cumulative `feature/phase7-cbt-private-resume-reader` implements `readInternalCbtAttempt`: an **internal-only** single final SQL query for one exact signed-in, active STUDENT membership → unrevoked administrator-attested StudentAccountLink → ENROLLED StudentRecord and ACTIVE exact class/session StudentEnrollment → sealed, separately APPROVED and PUBLISHED/not WITHDRAWN assessment, current teacher assignment/class/section/subject/session/term, and an unsubmitted attempt strictly inside its server deadline. Returns bounded (up to 50) ordered question prompts/options/points and **only that student's latest saved answer option/revision** with an attempt's ID/number/title/server time bounds; no answer key, `correctIndex`, grade, other student, pupil PII or staff questions. After submission, expiry, revocation or withdrawal, the query returns NOT_FOUND. This foundation deliberately creates **no student-facing API or browser path** pending full Phase 6/student/DB security acceptance. Synthetic real-session test cases for owner/wrong actor/tenant/latest revision/after-submission and read-only Node guards are AUTHORED BUT NOT EXECUTED. All previous strict local CI/audit gates still required. See D-042 / ADR-028.


## Phase 7 CBT autosave/submission boundary (internal-only, NOT VERIFIED)

CBT answer and final submission events require the previously admitted exact AssessmentAttempt, actual signed-in same-school active STUDENT member, unrevoked admin-attested StudentAccountLink, exact ENROLLED StudentRecord/ACTIVE same-class/session StudentEnrollment, active original class/subject/session/term/teacher assignment, separate HM/Principal APPROVED and School Super Admin PUBLISHED events without WITHDRAWN. All actual mutations independently recheck this at DB INSERT under school+attempt lock. The database server sets UTC answer revisions/save time/final submit time, checks selectedIndex against the assessment's actual sealed question choices and rejects writes at/after deadline or after terminal submission. Server accepts only questionId, option index and UUID retry key; no client actor/user/class/session/clock/correct answer fields are accepted. A genuine identical replay returns a minimal acknowledgement only after current ownership/scope verification.

A STUDENT role alone, broad academic:read, platform support privilege, guardian/teacher/admin role or matching name/email does not grant another student's attempt/answers. No student HTTP/API, quiz UI, scoring, answer key read or result publication exists in this candidate. Local tenant, trigger, race, CI and security acceptance mandatory before exposure.


## Phase 7 student CBT attempt reservation (internal-only, NOT VERIFIED)

A separate APPROVED HM/Principal review and nonwithdrawn PUBLISHED School Super Admin authorization are necessary but insufficient for student CBT admission. The internal-only reservation service/SQL trigger additionally require an actual signed-in active same-school STUDENT membership with a permanently attested and unrevoked exact StudentAccountLink to an ENROLLED StudentRecord and ACTIVE StudentEnrollment for the **same assessment class and session**, plus active school, section, term, subject and original teacher assignment. No inferred student account, role-only pupil, Form Teacher, guardian, platform support, foreign tenant or school admin override. The PostgreSQL clock/row lock, not request timestamps, determines a unique attemptNumber and deadline bounded by the assessment close; unexpired attempts block parallel reservations, all historical starts count against maxAttempts.

No student CBT route or question projection has been implemented yet. This is a nonproduction internal contract, not permission to release student exams or results; full SQL, authenticated, concurrency, privacy and local CI-equivalent acceptance remains mandatory. D-040/ADR-026.


## Separate school assessment publication (Phase 7 development-only, unverified)

Only an active same-school `SCHOOL_SUPER_ADMIN` may record an AssessmentPublicationEvent PUBLISHED after a sealed exam configuration has a terminal exact-section HM/Principal APPROVED review; WITHDRAWN requires a prior publication and is terminal. Neither normal SCHOOL_ADMIN, HM/Principal reviewer, assignment TEACHER, Form Teacher nor Platform Super Admin can perform this action by role inheritance. The server and SQL separately validate the current signed-in user/member and the real school, approved draft and active academic source before publication; an independent SQL actor membership check prevents forged lower-privilege role associations. This is a **publication ledger decision, not an enabled CBT student exam endpoint**. No results publication rights change. D-039/ADR-025; full PostgreSQL and CI verification pending.


## Section-scoped assessment review — Phase 7 draft, unverified

The current Phase 7 `AssessmentReviewEvent` candidate permits an active school `HEAD_OF_SECTION` to APPROVE/RETURN a sealed teacher-created assessment configuration from the stored class's **active same-school PRIMARY section** only. A `PRINCIPAL` may do so only for SECONDARY; both require a current verified SECTION ScopeGrant for the exact `SchoolClass.sectionId`. Review queue/detail and decision repeatedly bind the actor and actual class/section plus current teacher assignment, term/session, and subject. Neither an academic role alone, independent verified CLASS and SUBJECT grants, School Administrator, School Super Admin, Form Teacher nor Platform Super Admin are exceptions. One immutable terminal review event per draft cannot be altered or used for student exam publication.

Answer keys remain separate and are not exposed in reviewer metadata or question previews. No official results or student CBT rights are granted by assessment review. See D-038/ADR-024. Database/CI tests not yet executed.


## Rule precedence

1. Tenant and school scope
2. Role definition
3. Section and class scope
4. Subject and assignment scope
5. Relationship-based access
6. Workflow state authorization
7. Explicit exception or approved support override

## Conflict resolution

When two rules conflict, the safe default is the more restrictive rule. For routine ambiguity, use a reversible least-privilege implementation default under [D-023](../project/STANDING_DEVELOPMENT_MANDATE.md) and document it. Escalate only a material conflict affecting school policy, sensitive data, irreversible live-data changes, or production/release boundaries.

## Required checks

- Every server request must validate tenant context.
- All mutations must check active state, record permissions, and workflow state.
- All exports and file downloads must check the same conditions as read access.
- Background jobs and scheduled tasks must use the same authorization policy context as user requests.
- Teacher academic read, edit, and submit actions for a class and subject require an active assignment matching the exact school, membership, class, and subject tuple.
- Section, class, and subject `ScopeGrant` records must have `verified: true` before they authorize access to that resource. In the current DB-backed principal resolver, CLASS and SUBJECT grants must additionally refer to **active** class/subject records owned by the requested school, regardless of the stored `verified` flag. Scope identifiers are not foreign keys; matching strings alone are insufficient cross-tenant authorization. SECTION and CHILD require their own model/relationship checks before any future school-data routes are exposed. A matching but unverified scope is not permission. Teacher academic operations still require an exact, active class-subject assignment independently of these grants.
- Independent class and subject `ScopeGrant` records must never be combined to infer a teacher assignment. The policy helper enforces the assignment check, but protected academic routes must still load the principal through the assignment-aware resolver and pass the requested class and subject.
- Assignment lifecycle mutations use `school:configure`, currently limited by the policy to active School Administrator and School Super Admin memberships. The four implemented assignment mutation routes authenticate with Better Auth, check the school principal at the route boundary, and call the internal service, which repeats authorization transactionally. Platform Super Admin status does not independently grant school mutation authority. Client-supplied actor identifiers are not accepted. Future academic routes must use the same server-side tenant and service checks; D-020 authorizes a development-only default for assignment **administration** reads: active same-school membership with `school:configure`, minimal necessary fields and concealed cross-tenant IDs. No assignment read handler is implemented yet; teacher self-service reads require exact-resource scoping, not a general `academic:read` grant.

- When a subject-teacher assignment is tied to an academic session, teacher access requires an **exact matching sessionId** as well as the existing active same-school class/subject tuple. The principal resolver excludes session-specific assignments if the session is not ACTIVE. A legacy NULL-session assignment is not proof of teaching in a historical or future named academic session.

- SECTION ScopeGrants in a resolved principal now require matching **active same-school SchoolSection** ownership, alongside the existing verified flag. Future class-level section permissions must independently confirm `SchoolClass.sectionId` equals the authorized section and that the stage/actor role are appropriate. A verified but foreign/inactive section, or a class with NULL sectionId, is not section authority.

## Section-scoped lesson reviewer permission (draft, pending database verification)

Reviewing `LessonNote` SUBMITTED revisions now requires a currently active same-school `HEAD_OF_SECTION` membership for a **PRIMARY** class section, or `PRINCIPAL` for a **SECONDARY** section. The actual stored `SchoolClass.sectionId` must point to an active same-school section; the actor must hold a verified SECTION ScopeGrant for **that exact section** and satisfy `academic:approve`. Independent CLASS or SUBJECT scope IDs do not confer approval rights and unclassified classes are excluded. The reviewer queue binds class/section/grant and active actor within a single SQL statement; the write uses serializable membership/section/scope locks and a separately validating PostgreSQL review-event trigger. Returns require a new author revision; approval never publishes to students. This draft has not been tested against a migrated database.

## Required distinctions

- Role-based permissions are not enough; section, class, subject, relationship, and workflow constraints also apply.
- The School Super Admin role is distinct from the Platform Super Admin role.
- Form Teacher authority is distinct from subject-teacher authority.
- Final report publication is a distinct authorized workflow from ordinary HMs or Principals’ approvals.
