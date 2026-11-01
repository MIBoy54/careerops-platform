# Deployment and promotion

Reviewed 2026-10-31 against `7fc0fa9`. Established flow: **DEV → QA → DEMO → PROD**.
Start new work from develop, validate in DEV, and promote the reviewed candidate
through each stage. Do not use a direct main merge as the normal promotion path.

| Branch | Runtime APP_ENV | Required database |
| --- | --- | --- |
| develop | dev | careerops_dev |
| qa | qa | careerops_qa |
| demo | demo | careerops_demo |
| main | production | railway |

Branch names do not configure the runtime. Keep databases, credentials, session
secrets, and data policy separate even when environments run identical code.
The legacy dev branch is not the documented DEV branch; it has divergent work
and must not be reset or discarded during alignment.

## Verified baseline and current limits

The owner confirmed separate Railway projects for QA, DEMO, and PROD. Screenshots
show successful production deployment and PROD gate #409 after PR #79, at
`7fc0fa9`. GitHub PR CI was independently checked. See [run history](run-history.md).
QA/DEMO project existence does not verify each service's source binding, deployed
revision, runtime settings, or database privileges. Confirm those during promotion.
DEV develop was aligned with main at this revision; a persistent local DEV app
and database have not yet been provisioned. Prior local fixtures were disposable.

GitHub Actions performs tests and contains no application deployment step.
Railway auto-deployment is separate and was observed after the main merge.
Before pushing an environment branch, inspect that service's source branch and
activation settings: an approved branch update may cause an automatic deployment.
Do not change those settings merely to fit this document.

## Promotion procedure

1. Develop on a feature branch from current develop; preserve unrelated checkouts.
   Validate changes in local DEV with synthetic data and record exact revision.
2. Review the candidate and integrate through the established DEV process. Use a
   PR into qa, then demo, then main, retaining a traceable source revision and
   stage-specific approvals. Merge commits may differ; verify the resulting tree
   and build SHA rather than claiming every branch has the same commit ID.
3. Before each promotion, confirm source/base diff, CI, rollback build, migration
   compatibility, and actual Railway service/environment/branch bindings.
4. After deployment, verify Railway status, /health, /version, and authenticated
   core workflows in the target stage. Record failed and unrun checks explicitly.
5. Advance only after that stage's validation and the user's promotion decision.
   Keep credentials and data isolated; no automatic promotion follows from CI.

The recent direct integration to main is a recorded historical event, not a new
promotion policy. This guide does not perform deployments or authorize data changes.

## Runtime bindings

All database-backed runtimes require explicit DB_HOST, DB_USER, and DB_PASSWORD;
DB_PORT defaults to 3306 outside QA. If supplied, DB_NAME must match the table.
Startup checks SELECT DATABASE() before accepting traffic. DEV additionally
checks grants; schema identity alone does not prove account isolation elsewhere.

QA/DEMO/production require RAILWAY_PROJECT_ID and RAILWAY_ENVIRONMENT_ID. Supply
per-stage SESSION_SECRET and the actual build identity, preferably Railway's
RAILWAY_GIT_COMMIT_SHA; BUILD_COMMIT_SHA is the fallback. Never invent build metadata.

QA additionally requires nonempty DB_PORT/DB_PASSWORD/SESSION_SECRET, a strictly
decimal port in 1..65535, and a full 40-hex build SHA. It rejects DEMO_MODE=true
and actual test runtime. **CI=true alone is permitted** and does not enable test
shortcuts. Test mode requires APP_ENV=test and prohibits DB/deployment bindings.

Production requires a session secret of at least 32 UTF-8 bytes and eight distinct
characters; generate it cryptographically. These checks cannot prove randomness.
Cookies are Secure/HttpOnly and trust proxy is one hop, assuming all ingress
passes through Railway's HTTPS edge. Verify topology and no direct public TCP
path. Sessions are in memory: restart logs users out; shared sessions across
replicas are not implemented.

GITHUB_TOKEN is optional for dashboard access; grant only required read access.
SESSION_TREND_SOURCE_TIME_ZONE must match the verified stored timestamp convention.
Do not copy production secrets or personal records into local DEV.

## Production-to-DEMO snapshot

Only production with DEMO_SYNC_ENABLED=true can create a secondary pool, requiring
DEMO_DB_HOST, DEMO_DB_USER, DEMO_DB_PASSWORD, DB name careerops_demo, and a valid
optional DEMO_DB_PORT. It verifies the destination identity and rejects identical
source/destination bindings. Manual admin refresh and report creation can trigger
synchronization. This is data synchronization, not code promotion; do not run it
as a health check or assume all fields have been sanitized (notes are suppressed).

## Stage checks and rollback

- Confirm actual deployed build via /version (app, environment, commit), Railway
  deployment identity, and source SHA. A dashboard CI commit is not build identity.
- /health returning 200/ok is an availability probe, not a persistence/login test.
- Verify authorized login/logout, contacts, detail view, reporting, and exports
  using safe stage data; record mutations separately from read-only observations.
- Verify QA/DEMO database account isolation independently from database-name checks.
- Record a compatible previous build and any database changes before promotion.
  An application rollback does not roll back schema or safely reset data.
- Confirm any expected GitHub deployment record exists; Railway screenshot evidence
  does not prove a separate GitHub environment record was emitted.

No migration is needed solely for the DEV stored-role login code in an already
compatible schema. Do not apply baseline or historical ADD COLUMN migrations
blindly. See [database operations](database/README.md). The legacy backup script
hardcodes a different schema name; it is not a verified production restore plan.
