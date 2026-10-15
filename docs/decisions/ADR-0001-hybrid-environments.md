# ADR-0001 — Hybrid CareerOps environments

Date: 2026-10-15  
Status: Approved target architecture; implementation controls and live services pending verification

## Decision

CareerOps has three deployment stages:

| Stage | Host | Database | Role |
| --- | --- | --- | --- |
| DEV | Local Windows workstation | Local MySQL `careerops_dev` | Fast development, backup, rollback, debugging |
| QA | Railway | Isolated Railway MySQL `careerops_qa` | Cloud-based validation and regression |
| PROD | Railway | Authoritative production database (currently mapped to `railway` in code) | Live business operations |

DEMO is **intended** to be a restricted public-facing view of PROD, **not** an independent promotion stage. This is an architectural target, not a verified description of the current deployed system: repository code still supports `careerops_demo` and a synchronization path. Do not rebind DEMO or remove that path without a reviewed change and proof of data-access restrictions.

Code promotion: DEV → QA → PROD. A database refresh is a separate, controlled action based on a consistent PROD backup: PROD → local DEV, validate, then approved PROD baseline → Railway QA. No continuous cross-environment data synchronization is required.

## Why

Local DEV allows quick experiments and rapid backup/restore using existing loopback and account-grant safeguards. Railway QA tests deployment conditions that cannot be exercised faithfully against local MySQL. Keeping duplicate local QA and PROD operational databases promotes drift and ambiguity.

## Alternatives considered

- All Railway: rejected for DEV because it complicates quick local recovery and conflicts with intentional DEV loopback checks.
- All local except PROD: rejected because cloud configuration, ingress, and DB identity would go untested in QA.
- Parallel local/cloud replicas for every stage: rejected because it creates independent and easily divergent data states.

## Security requirements

- DEV must use loopback only and a schema-scoped, least-privilege MySQL account. Preserve fail-closed checks.
- QA must prove its MySQL identity, schema, grants, and inability to write to or administer PROD.
- PROD remains authoritative; refresh processes never write back to PROD.
- Protect backups, limit retention, exclude production credentials and session secrets from restores, and prevent nonproduction external side effects.
- DEMO must enforce server-side disclosure restrictions and business-write restrictions, including API routes.
- Document GitHub, Railway, Cloudflare, deployment ownership, backups, and recovery evidence without secrets.

## Implementation gates

1. Reconcile the current services and repository branches with live Railway and Cloudflare settings. Inspect existing local-only records.
2. Establish a consistent encrypted PROD backup **and verify an isolated restore**; separately archive current DEV and QA states.
3. Dry-run the proposed data transforms and destination identity checks; assess schema drift.
4. Refresh local DEV only after backup and explicit change approval. Validate counts, constraints, API, UI, and isolation.
5. Refresh Railway QA from an approved source snapshot only after DEV validation and a separate pre-QA backup; execute regression and security tests.
6. Align DEMO implementation with the restricted PROD-view contract through a separately reviewed change.
7. Retire obsolete local QA/PROD databases only after inventory, archive, restore test, and agreed retention period.

## Audit limitations and risks

The 2026-10-15 Codex repository audit did not inspect live Railway, Cloudflare, or database credentials and did not perform a backup/restore. It found an obsolete backup script with embedded credentials, unverified QA grants, DEMO implementation drift, incomplete authorization controls, and disabled deployed DB TLS certificate verification. Those are remediation candidates, not evidence that live infrastructure is safe. No database refresh or deletion is authorized by this ADR.
