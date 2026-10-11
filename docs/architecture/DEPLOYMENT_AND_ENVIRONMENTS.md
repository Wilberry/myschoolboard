# Deployment and Environments

## Proposed environment model

- Development
- Staging
- Production

## Deployment requirements

- Environment separation must prevent cross-environment leakage.
- Secret management must be separate per environment.
- Production environment must support audit and monitoring controls.
- Database and file backups must be governed by environment-specific retention policy.

## Current status

The repository includes local development configuration for PostgreSQL through Docker Compose and a CI workflow. No app hosting provider, domain, staging environment, or production deployment is configured. Hosting provider and domain selection are deferred until local development and testing are complete. No deployment has been verified.
