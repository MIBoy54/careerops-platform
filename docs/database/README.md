# Database Operations Guide

For QA use the [recovery-gated operator runbook](../qa-refresh-runbook.md). Database
refresh is separate from code promotion. Historical counts and scripts are not
proof of current Railway readiness. No deployment or database mutation is implied.

CareerOps applies Quality Engineering principles to database management by treating the database as a version-controlled engineering artifact.

---

# Environment Strategy

CareerOps maintains four independent database environments.

| Environment | Purpose |
|-------------|---------|
| **careerops_dev** | Active development |
| **careerops_qa** | Functional validation and testing |
| **careerops_demo** | Public demonstration environment |
| **railway** | Verified Railway production schema (dev runtime mapping discrepancy requires separate owner review) |

---

# Promotion Workflow

Code promotion: DEV → QA → PROD. DEMO is a restricted public view and is not a
promotion step. A QA dataset refresh is independently approved and may use only
verified local, privacy-reviewed staging; it never connects to live PROD.

---

# Schema Organization

```
database/

├── schema/
│
├── migrations/
│
├── procedures/
│
├── views/
│
└── seed/
```

---

# Schema Versioning

Every structural database change is committed to source control before promotion.

Example:

001_initial_schema.sql

002_recruiter_directory.sql

003_candidate_directory.sql

004_candidate_referrals.sql

---

# Deployment Checklist

Before promoting any schema change:

- [ ] Schema committed to GitHub
- [ ] Migration reviewed
- [ ] Applied to careerops_dev
- [ ] Unit tests passed
- [ ] Smoke tests passed
- [ ] Regression tests passed
- [ ] Applied to careerops_qa
- [ ] QA validation completed
- [ ] Separate production deployment/migration approval
- [ ] PROD runtime/schema mapping reconciled and independently verified

---

# Current Schema

## Opportunity Management

- recruiter_tracker
- report_job_contacts

## Relationship Management

- recruiter_directory
- candidate_directory

## Reporting

- weekly_reports

## Validation

- validation_runs

## Observability

- analytics_heartbeat
- visitor_analytics

## Security

- users

---

# Design Principles

CareerOps treats database design as a Quality Engineering discipline.

The database is designed to support:

- Traceability
- Auditability
- Operational reporting
- Workflow management
- Relationship management
- CI/CD promotion
- Continuous improvement

Database changes are validated with the same engineering rigor applied to application code.