# Database Operations Guide

CareerOps applies Quality Engineering principles to database management by treating the database as a version-controlled engineering artifact.

---

# Environment Strategy

CareerOps's intended database environment separation is shown below. The
operational QA deployment and database isolation still require verification.

| Environment | Purpose |
|-------------|---------|
| **careerops_dev** | Active development |
| **careerops_qa** | Functional validation and testing |
| **careerops_demo** | Public demonstration environment |
| **careerops** | Production |

---

# Promotion Workflow

```
careerops_dev
        │
        ▼
careerops_qa
        │
        ▼
careerops_demo
        │
        ▼
careerops
```

Database changes are promoted sequentially through each environment.

Each promotion requires validation and explicit approval; this diagram does not
authorize automatic database changes or application deployments.

## QA Database Isolation

The intended branch mapping is `develop -> DEV`, `qa -> QA`, `demo -> DEMO`, and
`main -> PROD`. See [Deployment Guide](../deployment.md) for runtime bindings,
deployment evidence, validation, and rollback requirements.

For `APP_ENV=qa`, the effective database must be `careerops_qa`. The application
defaults to that name, rejects other names, and verifies the connected database
before accepting traffic. Configure `DB_NAME=careerops_qa` explicitly in the
intended QA service. These checks do not establish that a QA database or service
has already been provisioned.

Use QA-specific `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` bindings. The QA
account must have no production database privileges; verify permissions
independently of the application database-name check. Use synthetic or approved
sanitized data. Never store secret values in documentation or source control;
record names and verification status only.

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
- [ ] Demo validated
- [ ] Applied to careerops_demo
- [ ] Production deployment approved
- [ ] Applied to careerops

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
