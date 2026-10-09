# AGENTS.md

This repository is a specification-first project. Before making any code change, every agent must read and follow this file, the documentation index, and the relevant requirements and roadmap documents.

## Required reading order

1. Read this file.
2. Read [docs/README.md](docs/README.md).
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
- Never infer approval, completion, or deployment from documentation alone; the repository state and actual command output are the source of truth.
- Preserve the distinction between specified, proposed, implemented, tested, and deployed statuses.
- Avoid expanding scope without explicit authorization.
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

If implementation reveals a conflict or a requirement cannot be implemented as written:

1. Stop the affected work before making an irreversible assumption.
2. Document the conflict and evidence.
3. Explain the impact and options.
4. Recommend the safest reasonable option.
5. Mark it unresolved until product-owner approval.
6. Update the canonical requirement and decision record after approval.
7. Update dependent requirements, tests, diagrams, and roadmap items.

## Source-of-truth policy

Canonical information is owned by the documents in this repository, not by chat history. Requirement IDs and decision records are authoritative.
