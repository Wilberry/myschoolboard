# AGENTS.md

MySchoolBoard is an actively implemented, specification-led project. The Project Owner's [Standing Development Mandate](docs/project/STANDING_DEVELOPMENT_MANDATE.md) (D-023) authorizes normal non-production engineering work, development feature-branch pushes, and draft PRs within the documented roadmap without repeated approval. Before a code change, read this file, the documentation index, and the relevant requirements and roadmap documents.

## Required reading order

1. Read this file.
2. Read [docs/README.md](docs/README.md) and the [Standing Development Mandate](docs/project/STANDING_DEVELOPMENT_MANDATE.md).
3. Read the current phase in [docs/roadmap/IMPLEMENTATION_ROADMAP.md](docs/roadmap/IMPLEMENTATION_ROADMAP.md).
4. Read the relevant module specification under [docs/modules](docs/modules) and the matching requirement IDs in [docs/requirements/REQUIREMENTS_TRACEABILITY_MATRIX.md](docs/requirements/REQUIREMENTS_TRACEABILITY_MATRIX.md).
5. Read the applicable authorization rules in [docs/authorization](docs/authorization) and security requirements in [docs/security](docs/security).
6. Inspect the existing code before editing.

## Mandatory rules for future agents

- Identify the requirement IDs and acceptance criteria relevant to the requested work.
- Keep the change minimal and coherent with the specification.
- Add or update tests for the changed behavior.
- Run the smallest relevant validation command and report actual results.
- Update documentation if behavior, APIs, schema, permissions, configuration, or decisions change.
- Update [docs/roadmap/CURRENT_STATUS.md](docs/roadmap/CURRENT_STATUS.md) and [docs/roadmap/MILESTONE_CHECKLIST.md](docs/roadmap/MILESTONE_CHECKLIST.md) when milestone status changes.
- Record material architecture changes in [docs/project/DECISION_LOG.md](docs/project/DECISION_LOG.md) and [docs/architecture/ARCHITECTURE_DECISION_RECORDS.md](docs/architecture/ARCHITECTURE_DECISION_RECORDS.md).
- Report unresolved blockers honestly.
- Never mark a requirement complete without implementation evidence and validation.
- Never bypass authorization, tenant isolation, validation, or audit requirements to make a test pass.
- Never silently redefine a requirement.
- Never delete tests or weaken acceptance criteria simply to get green results.
- Never make destructive repository changes without explicit authorization.
- Never claim a commit, push, deployment, or external operation occurred unless the tool confirms it.
- Rely on the explicit standing authority in D-023 for routine non-production work; do not assume unrelated release, production security-risk acceptance, or live-data authorization. The repository state and actual command output are the source of truth.
- Preserve the distinction between specified, proposed, implemented, tested, and deployed statuses.
- Work freely within the charter, requirements, and roadmap. Escalate only a genuinely new material business scope or an exception listed in the Standing Development Mandate.
- Update traceability when requirements or behavior change.

## Required checkpoint format

Each implementation phase must end with a checkpoint containing:

- Phase and milestone
- Requirement IDs addressed
- Files and modules changed
- Database migrations, if any
- Authorization implications
- Tests added
- Tests executed and actual results
- Build, lint, and type-check results where applicable
- Security and tenant-isolation considerations
- Known limitations
- Deviations from documentation
- Documentation files updated
- Remaining tasks
- Exit-gate result: pass, fail, or blocked

## Change control

For routine underspecified implementation within the approved roadmap, choose a least-privilege, reversible and preferably configurable engineering default; document it and its tests, and continue. Do **not** repeatedly request permission to design, code, test, commit, push a non-default development branch, or open a draft PR. An unresolved future vendor or business-policy choice does not freeze unrelated modules.

Only when a requirement conflict would create an irreversible data change, contradict a material school policy, expand sensitive-data access, or cross a production/release boundary:

1. Isolate and pause **only that affected operation**; continue independent work.
2. Record the evidence, trade-offs, safe interim no-op/denial, and recommended resolution.
3. Escalate one focused question to the Project Owner where the existing documents do not safely decide it.
4. Record the resolution and update dependent requirements, tests, diagrams, and roadmap items.

See [Standing Development Mandate](docs/project/STANDING_DEVELOPMENT_MANDATE.md) (D-023). Historical D-022's review on 2026-10-18 does not halt normal development; it remains a narrowly scoped security-publication risk record, not release approval.

## Source-of-truth policy

Canonical information is owned by the documents in this repository, not by chat history. Requirement IDs and decision records are authoritative; where older development-only gate language conflicts with D-023's later standing mandate, D-023 controls routine non-production workflow without relaxing substantive security or release protections.
