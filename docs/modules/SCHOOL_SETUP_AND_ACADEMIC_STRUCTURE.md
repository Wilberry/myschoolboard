# School Setup and Academic Structure

## Scope

This module manages school identity, branding, academic sessions, terms, sections, classes, subject catalogs, grading configuration, and school-specific policies.

## Requirements

- Support primary, secondary, or combined-school structures.
- Keep settings tenant-scoped.
- Version or date-stamp configurations that affect historical records.
- Prevent silent recalculation of previous results when configuration changes.

## Important constraints

- Academic configuration changes must not mutate previously published official records without an explicit correction workflow.
- The product must support both primary and secondary teaching models without forcing one onto the other.
