# Database Operations Guide

CareerOps applies Quality Engineering principles to database management by treating the database as a version-controlled engineering artifact.

---

# Environment Strategy

CareerOps maintains four independent database environments.

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