# Implementation Roadmap

## Phase 0 — Repository baseline and documentation foundation

- Objective: establish the documentation source of truth and capture the specification baseline.
- Requirements covered: PLAT-REQ-001, SEC-REQ-001, OPS-REQ-001
- Dependencies: none
- Exit criteria: documentation is navigable, unresolved decisions are explicit, and repository state is correctly documented
- Status: complete for the documentation baseline

## Phase 1 — Architecture and engineering foundation

- Objective: approve the initial technical stack, environment model, and engineering standards before implementation begins.
- Requirements covered: OPS-REQ-001, SEC-REQ-001
- Dependencies: Phase 0
- Must not begin until the following entry criteria are satisfied or deliberately marked as deferred with a risk note:
  1. technology stack and hosting model approved or evaluated in a technical spike
  2. local dev environment and tooling baseline defined
  3. database and migration approach approved or explicitly deferred
  4. security and secret-handling baseline established
  5. CI and quality gates defined
  6. tenant-scoping model and authorization architecture reviewed
- Deliverables: application skeleton, environment template, quality tooling, smoke tests, security baseline, ADRs
- Acceptance criteria: scaffold works locally, CI is configured, migrations are defined if required, and the architecture passes a documented review
- Status: not started; entry condition pending product-owner approval or explicit technical spike

## Phase 2 — Identity, tenancy, and authorization

- Objective: authentication, roles, scopes, and tenant context.
- Requirements covered: TEN-REQ-001, USR-REQ-001, SEC-REQ-001
- Dependencies: Phase 1

## Phase 3 — Platform administration and subscriptions

- Objective: onboarding, plans, subscriptions, and platform lifecycle.
- Requirements covered: PLAT-REQ-001, SUB-REQ-001
- Dependencies: Phase 2

## Phase 4 — School setup and academic structure

- Objective: school configuration, class, subject, student, and academic structure.
- Requirements covered: SCH-REQ-001, ADM-REQ-001
- Dependencies: Phase 2, Phase 3

## Phase 5 — Teacher assignments and timetables

- Objective: assignments, section logic, and timetable integrity.
- Requirements covered: TCH-REQ-001
- Dependencies: Phase 4

## Phase 6 — Attendance and lesson planning

- Objective: attendance, lesson notes, approval, and release.
- Requirements covered: ATT-REQ-001, LES-REQ-001
- Dependencies: Phase 4, Phase 5

## Phase 7 — Assessments, CBT, and class record sheets

- Objective: tests, question bank, scoring, and result sheets.
- Requirements covered: ASM-REQ-001
- Dependencies: Phase 4, Phase 5, Phase 6

## Phase 8 — Results and report cards

- Objective: result approval, publication, and report visibility.
- Requirements covered: RES-REQ-001
- Dependencies: Phase 7

## Phase 9 — Fees and payments

- Objective: fee obligations and payment evidence processing.
- Requirements covered: FEE-REQ-001
- Dependencies: Phase 2, Phase 4

## Phase 10 — Communications and learning resources

- Objective: notices, announcements, portals, library, and notifications.
- Requirements covered: COM-REQ-001, LIB-REQ-001, AUD-REQ-001
- Dependencies: Phase 4, Phase 8

## Phase 11 — Trash, recovery, and lifecycle management

- Objective: school and platform trash retention and recovery.
- Requirements covered: DEL-REQ-001
- Dependencies: Phase 2, Phase 10

## Phase 12 — Quality, security, and production readiness

- Objective: final verification, testing, and release readiness.
- Requirements covered: SEC-REQ-001, OPS-REQ-001, all critical high-severity requirements
- Dependencies: All prior phases

## Roadmap rules

- Separate MVP from future enhancements.
- Deferred requirements remain visible and traceable.
- Do not claim delivery estimates without approved team capacity.
- Do not mark future phases as complete because documentation exists; completion requires implementation evidence and validation.
