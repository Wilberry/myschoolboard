# Phase 1 Engineering Plan

## Executive summary

This document records the proposed engineering foundation for MySchoolBoard. It is a proposal, not an approved implementation decision. The repository remains a documentation-first baseline, and Phase 1 should be treated as a controlled engineering foundation stage rather than a production build.

The recommended default is a small-team, production-minded stack centered on a modular monolith: TypeScript on a modern web framework for the application, PostgreSQL as the primary relational database, and server-side authorization with explicit tenant scoping. This choice preserves strong consistency, clear workflows, easier onboarding, and a lower operational burden than a distributed architecture for a small team.

The project should not begin application implementation until the product owner approves the relevant blocking decisions identified in this plan and in the product decision register. This document separates proposed defaults from decisions that genuinely require approval and also distinguishes between decisions that block the Phase 1 scaffold and decisions that can wait until the relevant domain is implemented.

## Decision gating by phase

### Phase 1 blockers

The following should be resolved or explicitly approved as a risk-driven exception before the engineering scaffold starts:

- initial technology stack and hosting model
- authentication provider and tenant membership model
- support-access and exceptional admin override policy
- database isolation strategy and migration workflow
- CI and dev-environment-quality baseline

### Important but deferrable

These matter to later feature work and should be tracked, but they do not necessarily block the initial engineering scaffold if their boundary is documented:

- parent-first report-card visibility semantics
- payment provider and reconciliation model
- QR verification disclosure policy

## Official source references

The proposed defaults below are informed by current official documentation from the relevant ecosystems. These references are not implementation proof and remain proposals until the product owner approves them.

- Next.js: https://nextjs.org/docs
- PostgreSQL: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Prisma: https://www.prisma.io/docs
- Auth.js: https://authjs.dev/docs
- OpenID Connect: https://openid.net/specs/openid-connect-core-1_0.html
- GitHub Actions: https://docs.github.com/actions

## Proposed technology stack

### 1. Frontend

Recommended default:

- Framework: Next.js with React and TypeScript
- Styling: Tailwind CSS or a structured design system
- Form handling: react-hook-form + zod-based validation
- Accessibility: WCAG-aware components, semantic HTML, keyboard support, focus management
- Data fetching: server components or route handlers for authenticated reads; client-side fetch only for progressive enhancement and interactive forms

Why this fits:

- Familiar to a small team and well-supported by official documentation
- Strong SSR and route-level security model for authenticated applications
- Good fit for a dashboard-heavy SaaS with forms, approvals, exports, and role-specific views
- Low operational complexity compared with a larger microfrontend or custom SPA architecture

Alternatives:

- React + Vite + custom routing and state management
- Nuxt or other SSR frameworks
- Full SPA with separate API layer and a custom component library

Trade-offs:

- Next.js is slightly more opinionated and requires disciplined route and server/client boundary management.
- A custom React setup offers more flexibility but increases operational burden.

### 2. Backend

Recommended default:

- Language: TypeScript
- Framework: Next.js App Router for application routes and API handlers, or a thin Node.js service only if a separate API is justified by measured complexity
- API design: REST or typed route handlers; no premature microservices
- Request validation: schema validation at the edge of the system before business logic
- Authorization: server-side permission checks using tenant-aware role policies
- Background jobs: queue-based worker with explicit job metadata and tenant context
- Error handling: structured application errors with correlation IDs, audit events, and safe user-facing errors

Why this fits:

- A modular monolith keeps domain boundaries explicit without adding service orchestration cost.
- One codebase is easier to secure, test, and maintain during early growth.
- Centralized server-side enforcement is easier to validate against the tenant model.

Alternatives:

- Separate NestJS API + React frontend
- Custom Express or Fastify service
- Event-driven background services before the product has measurable load or complexity

Trade-offs:

- A monolith can become large later, but the domain boundaries and modular structure in this project are designed to minimize that risk.
- Separate services are not justified before measurable scale or complexity requires them.

### 3. Database

Recommended default:

- Relational database: PostgreSQL
- ORM/query layer: Prisma or Drizzle
- Schema management: migration-based schema changes with review and CI validation
- Transactions: explicit database transactions for academic approvals, payment evidence, and state transitions
- Tenant isolation: application-enforced tenant scope as the default, with Postgres Row-Level Security evaluated as an optional defense-in-depth layer only where it materially reduces risk
- Backups: automated scheduled backups and restore testing

Why this fits:

- Strong referential integrity suits academic records and financial workflows
- Cross-tenant safety is easier to reason about with explicit scope and constraints
- The product requires historical records, approvals, and auditability

Alternatives:

- MySQL or MariaDB
- SQLite for local development only
- Document database for early prototypes, which is not recommended for this domain

Trade-offs:

- PostgreSQL requires discipline around schema design and migration hygiene.
- A document database would reduce some schema cost but would be a poor fit for approvals, audit, and academic integrity.

### 4. Authentication and authorization

Recommended default:

- Authentication provider: managed identity provider or OAuth/OIDC-based service, with a small set of supported providers
- Session handling: secure HTTP-only cookies or short-lived server-managed sessions
- MFA: optional but recommended for admin and finance roles
- Password reset and account recovery: email-based secure reset flow with audit logging
- Authorization: RBAC + scoped permissions + tenant membership constraints
- Guardian-to-student relationship: explicit link records validated in the same tenant
- Staff membership across schools: allowed only when explicitly granted and scoped by tenant membership

Why this fits:

- Centralized auth services reduce custom credential risk and improve auditability.
- RBAC with explicit tenant scoping is consistent with the requirements and reduces privilege confusion.

Alternatives:

- Self-managed authentication with custom sessions
- Lightweight magic-link or OTP-only auth for initial pilot, if explicitly approved

Trade-offs:

- Managed identity services reduce implementation effort but create vendor dependency.
- Self-managed auth gives more control but adds more security and operational effort.

### 5. Infrastructure

Recommended default:

- Initial hosting: managed platform for app and database, with clear dev, staging, and prod environments
- File/object storage: object storage service with tenant-aware pathing and signed URLs only as needed
- Emails and notifications: managed provider with tenant-safe templates
- Background jobs: queue-based background worker with explicit retry and dead-letter handling
- Monitoring: centralized logs, request tracing, error aggregation, and uptime checks
- Secret management: managed environment secrets, never committed to source control

Why this fits:

- It keeps the first operational model simple and robust without introducing unnecessary platform complexity.
- It supports production readiness without premature microservice infrastructure.

Alternatives:

- Self-hosted VM-based deployment
- Container orchestration too early
- Multiple cloud services without a clear operational owner

Trade-offs:

- Managed services reduce operational burden but add vendor lock-in and service configuration overhead.
- Self-hosting is cheaper at zero scale but not ideal for a small team seeking safe production operations.

## Architecture overview

### High-level design

The system should be designed as a modular monolith with clearly separated domain modules. Domains include:

- Platform administration
- School setup and academic structure
- Admissions and student records
- Staff and teacher assignments
- Attendance and lesson planning
- Assessments and CBT
- Results and report cards
- Fees and payments
- Communications and announcements
- Parent and student portals
- Audit, trash, and retention
- Platform support and operations

Each domain should own its own service layer, data access patterns, and validation rules while sharing a common authentication, tenancy, audit, and configuration foundation.

### Application boundaries

- Platform services operate only on platform-level data and global policy.
- School services operate only on school-scoped tenant data.
- Shared cross-cutting concerns include auth, tenant resolution, RBAC, audit logging, query scope enforcement, config, and file handling.
- No boundary should allow a school domain to read another school’s records without tenant validation.

### Database and migration strategy

- Use PostgreSQL as the default relational database.
- Use migration-based schema revisions in CI and local developer setup.
- Include explicit constraints for tenant ownership and role-scope checks where feasible.
- Maintain audit tables and immutable academic history patterns for reports and record integrity.
- Keep a separate set of retention and deletion policies for school trash and platform trash.

### Authentication and authorization design

The project requirements establish a strict distinction between:

- Platform Super Admin and School Super Admin
- School-wide Notice Board vs class-scoped announcements
- Subject Teacher vs Form/Class Teacher responsibilities
- HM/Principal academic approval vs School Super Admin final publication
- Financial evidence vs actual payment confirmation

These boundaries must be enforced in the authorization layer and not only in the interface. The auth model should be policy-driven and tenant-aware.

## Tenant-isolation approach

### Tenant resolution

- Resolve the current tenant from authenticated user membership, not from a client-provided input.
- Validate that the user has an active membership in the requested school context.
- Reject requests with a missing, stale, or mismatched tenant context.

### User membership model

- Users may belong to multiple schools or roles within a school.
- School membership should be stored as a normalized membership table with active status and role assignments.
- Each authorization check should evaluate both membership and effective role within the specific tenant.

### Request and query scoping

- Every database query that reads or writes school-owned data must include explicit tenant filters.
- UI routes and APIs should pass tenant context through a server-side request context object.
- All background jobs must include the owning tenant ID and execute with tenant-scoped access checks.

### Database enforcement options

#### Option A: Application-enforced isolation (recommended default)

- All queries and business logic are tenant-scoped explicitly in the application layer.
- This keeps the model straightforward for a small team and limits the need for database-specific security features early.
- The main cost is disciplined code review and strong repository-level tests.
- This is the default recommendation for Phase 1 because it is easier to reason about during the early architecture stage.

#### Option B: PostgreSQL Row-Level Security (RLS)

- Database-level policy enforcement can strengthen the last line of defence for tenant-scoped access.
- RLS can reduce accidental leaks if the application layer is bypassed, but it adds complexity in migration review, session setup, connection pooling, and policy testing.
- It is not a substitute for authorization design, and it requires careful handling for background jobs and service-to-service access.
- The project should treat RLS as an optional defense-in-depth mechanism after the application model is stable, rather than as the only tenant-isolation strategy.

### Insecure patterns to block

- Client-provided tenant IDs or school IDs accepted without server validation
- URL-based access to school resources without rechecking membership
- Cached or signed URLs that omit tenant path scoping
- API paths that permit direct object access by changing an ID parameter
- Support override flows that skip audit records or approval controls

### Security tests for tenant isolation

The system must include acceptance tests for:

- a user from school A attempting to read school B records
- changing a school ID in an API request to access another tenant
- parent access to a non-linked child record
- teacher access outside assigned classes or subjects
- cross-tenant export or file download paths
- stale permission recovery after role changes
- platform admin access into school data without explicit school context
- a database-level or ORM-level bypass attempt in a service or job context

## Infrastructure and environment strategy

### Environments

- Local development: developer machine
- Preview/staging: branch-based or ephemeral environment for integration validation
- Production: isolated environment with controlled deployments and backups

### Operational standards

- No secrets committed to Git
- Separate environment variable files and validation rules
- Single, documented deployment path for the first release
- Logs and errors must not capture tokens, payment secrets, or personal student data unless explicitly required and audited

## Testing and CI strategy

### Required test layers

- Unit tests for domain logic and validation
- Integration tests for auth and API flows
- Contract tests for role and permission boundaries
- Security tests for tenant isolation and direct object access
- End-to-end tests for key workflows such as admissions, assessments, publication, and finance evidence

### CI checks

- install and dependency validation
- linting
- type-checking
- unit and integration test suite
- migration validation
- build reproducibility
- security dependency and vulnerability checks

## Logging, error handling, and security standards

- Centralize application errors and include correlation IDs.
- Never log raw secrets or payment proof payloads.
- Log access to sensitive records and approval events with tenant context.
- Fail closed: if tenant context or authorization cannot be validated, deny access.
- Treat all support-access operations as exceptional and audit each event.

## Ordered Phase 1 implementation tasks

1. Approve the required product decisions.
2. Finalize the default stack and hosting choice.
3. Initialize repo tooling and quality gates.
4. Create the application skeleton and environment examples.
5. Configure database connection, migration workflow, and validation scripts.
6. Implement tenant resolution and a minimal auth shell.
7. Implement shared audit, logging, config, and error handling.
8. Add the first tenant-isolation tests and negative-access tests.
9. Validate local startup, build, migration, and CI readiness.
10. Freeze the Phase 1 scaffold for approval before Phase 2.

## Risks

- Product-owner policy decisions may be delayed and block engineering work.
- Missing auth/provider decisions can force rework.
- Overly broad module implementation before tenant boundaries are proven will increase risk.
- Unclear support-access policy can create privilege-escalation risk.
- Database isolation design may be under-specified if the team treats application filtering as complete without explicit review.

## Acceptance criteria for the scaffold

Before Phase 1 can be considered complete, the repository should show evidence that:

- the stack is documented and approved
- the app starts in a documented developer environment
- environment variables are validated without real secret values
- the health endpoint works without leaking sensitive data
- linting, type checking, and tests pass
- CI runs the required checks
- database migrations are repeatable and validated
- tenant-isolation tests fail when another tenant is targeted
- logs and errors do not expose secrets or PII

## Definition of done

Phase 1 is done only when:

- all mandatory product decisions are resolved or explicitly deferred with risk acknowledgment
- the core architecture is approved as a proposal
- the scaffold is reproducible from a fresh clone
- all required checks pass in CI
- tenant-boundary and auth tests have actual evidence
- the engineering plan is linked from the canonical documentation index

This plan remains a proposal pending product-owner approval.
