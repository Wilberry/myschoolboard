# MySchoolBoard Documentation Package

This repository contains a committed documentation-only baseline for a multi-tenant school management SaaS. It is not a completed application implementation. The project is intentionally specification-first and has reached a verified documentation milestone on the main branch.

## Purpose

This repository is the canonical engineering and product source of truth for MySchoolBoard. It captures:

- Product vision and scope
- Requirements and acceptance criteria
- Authorization and tenant-isolation rules
- Architecture and data model
- Security, privacy, quality, and testing strategy
- Roadmap and implementation checkpoints

## Documentation entry point

- [docs/README.md](docs/README.md) — full documentation navigation
- [AGENTS.md](AGENTS.md) — required workflow for future agents
- [CHANGELOG.md](CHANGELOG.md) — history of documentation milestones
- [docs/roadmap/CURRENT_STATUS.md](docs/roadmap/CURRENT_STATUS.md) — current project status
- [docs/roadmap/IMPLEMENTATION_ROADMAP.md](docs/roadmap/IMPLEMENTATION_ROADMAP.md) — roadmap and Phase 1 entry criteria

## Current verified repository state

As of the latest repository inspection:

- Repository: documentation-only baseline on GitHub, no application code implementation
- Current branch: main
- Latest verified commit: 7146bfc — docs: correct repository status and add Phase 1 audit
- Working tree: clean after the documentation commit
- Application stack: not yet selected for implementation
- Database: not yet selected or implemented
- CI/CD: not configured in the repository
- Tests: no implementation tests present yet
- Deployment configuration: none present
- Product identity: provisional; public branding remains configurable

## Current status

The repository is currently in the documentation foundation phase. The project has not moved into application implementation, and no feature implementation is considered complete without evidence of code and validation.

## Canonical rule

All future implementation work must read and follow:

- [AGENTS.md](AGENTS.md)
- [docs/README.md](docs/README.md)
- the current roadmap phase and relevant requirement documents
- the approved decision records and authorization rules

## Important unresolved decisions

The following remain open and required before Phase 1 implementation can proceed safely:

- final technology stack and hosting model
- authentication and identity provider strategy
- payment provider and currency model
- parent-first report-card acknowledgment semantics
- exceptional support-access policy
- final QR verification and public disclosure rules

## Note on branding

The provisional product name MySchoolBoard is a working label only. Public branding must remain configurable and should not be treated as a fixed product identity in architecture or implementation decisions.
