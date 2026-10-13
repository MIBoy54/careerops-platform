# Deployment Guide

## Verified LIVE database mapping

Production sessions require a configured SESSION_SECRET of at least 32 UTF-8
bytes with at least eight distinct characters. Generate it cryptographically;
these validation checks reject missing/obviously weak values but cannot prove
randomness. No production fallback secret is used. Do not put secrets in Git.
Production cookies use Secure and HttpOnly, including logout cookie clearing.

Express trusts only the immediate proxy hop in production (`trust proxy=1`),
for Railway's HTTPS edge and its X-Forwarded-Proto header. This assumes all public
traffic reaches Node through Railway's edge, with no direct public TCP ingress
or shorter alternate path. Verify this topology and header handling before
deployment; the hop limit is not an IP allowlist. DEV/QA/DEMO/test proxy trust and
cookie behavior are unchanged. Verify owner login/session persistence/logout
over the deployed HTTPS hostname after separately authorized deployment.
Sessions still use in-memory storage: restarts clear sessions and multiple
replicas are unsupported without a separately approved store change.

For production, the fixed schema mapping is `railway`. The operator verified
LIVE `DB_NAME=railway` and `SELECT DATABASE()` returned `railway`. This evidence
establishes schema identity, not full schema compatibility or deployment approval.
DEV, QA, and DEMO remain `careerops_dev`, `careerops_qa`, and `careerops_demo`.
Explicit mismatched DB_NAME values and mismatched connected identities fail closed.
Production-to-DEMO synchronization still requires explicit enablement and the
verified `careerops_demo` destination; NOTES alone are suppressed.

`backup_careerops.bat` still hardcodes `DB_NAME=careerops`. A separately authorized
change must target the verified LIVE schema `railway` and verify the LIVE service,
connection bindings, restore procedure, and schema compatibility before relying
on that backup for rollback. The script was not changed or executed as part of
the mapping correction. Do not run the baseline or ADD COLUMN migrations blindly:
the industry baseline is VARCHAR(100), while its migration declares VARCHAR(50).

## Status and intended mapping

This guide defines the approved QA deployment design. A dedicated QA Railway
service, URL, source-branch binding, database bindings, and deployed revision have
not yet been verified. Existing Railway environments labeled `production` must
not be assumed to provide QA. The application safety changes on
`feature/qa-deployment-safety` are not evidence of a deployed service.

| Source branch | Intended environment |
| --- | --- |
| `develop` | DEV |
| `qa` | QA |
| `demo` | DEMO |
| `main` | PROD |

The GitHub Actions workflow runs isolated tests; it does not deploy the application.
A successful CI run does not establish deployed QA availability or identity.

## Intended QA deployment flow

1. Review and validate the candidate, including the application safety changes,
   before explicitly approving its integration into `qa`.
2. Identify or create a dedicated QA Railway environment and application service
   in a separately approved infrastructure phase. Bind the service to
   `MIBoy54/careerops-platform`, source branch `qa`, and the QA database only.
3. Configure the runtime bindings below through secure settings. Use the existing
   `npm start` command and `/health` health check. Record the QA application URL
   and Railway project, environment, and service identifiers after verification.
4. Disable automatic deployment initially. Obtain explicit approval to deploy
   the exact full candidate SHA, then verify that the source revision has not
   changed before triggering the deployment.
5. Record deployment evidence and complete the QA validation checklist. Stop for
   review; QA approval does not authorize promotion to DEMO or PROD.

Each subsequent environment requires its own validation and explicit promotion
approval. No automatic promotions are authorized by this guide.

## QA runtime bindings

| Name | QA requirement |
| --- | --- |
| `APP_ENV` | `qa` |
| `DB_NAME` | Explicitly configure `careerops_qa`; this is also the QA application default. Any other effective name is rejected. |
| `DB_HOST` | Required QA database host binding. |
| `DB_PORT` | Required integer port from 1 through 65535. |
| `DB_USER` | Required QA-only database account. |
| `DB_PASSWORD` | Required secret for the QA-only account. |
| `SESSION_SECRET` | Required QA-specific secret; do not reuse production session secrets. |
| `PORT` | Railway-assigned application port; the application otherwise defaults to 3000. |
| `RAILWAY_GIT_COMMIT_SHA` | Railway Git deployment commit identity, when supplied; takes precedence over `BUILD_COMMIT_SHA`. |
| `BUILD_COMMIT_SHA` | Fallback for an approved build mechanism; inject the full SHA of the checked-out source during the build. |

QA startup requires a 40-character hexadecimal commit SHA. A malformed Railway
SHA is rejected even if the fallback is valid. The identity must match the actual
source build, not merely a manually entered candidate reference.

`CI` and `DEMO_MODE` must not be enabled, and `NODE_ENV` must not be `test`.
`GITHUB_TOKEN` is optional for GitHub dashboard functionality; if enabled, supply
only the read access that functionality requires. No `DEMO_DB_*` bindings are
required for this QA scope.

QA credentials must have no production database privileges. Verify isolation
through approved database permission evidence; the application database-name
check alone cannot establish account isolation. Before accepting traffic, the
QA application queries `SELECT DATABASE()` and requires `careerops_qa`.

Never store secret values in documentation, source control, examples, logs, or
validation evidence. Document binding names and verification status only; supply
values through approved secure settings. Use synthetic or approved sanitized QA
data, not unapproved production copies.

## Availability and version validation

- `GET /health` must return HTTP 200 with body `ok`. It is an availability probe,
  not proof of authentication, database functionality, or deployed commit identity.
- `GET /version` returns only `app`, `environment`, and `commit`. Require
  `app=careerops-platform`, `environment=qa`, and the full approved SHA.
- Confirm database-backed behavior separately through authenticated application
  checks. The dashboard's GitHub Actions commit identifies a CI run, not the
  running application build.

## Required deployment evidence

Retain the approved full source SHA, validation results, and deployment approval.
Record the Railway deployment ID, QA project/environment/service identity, source
repository and revision, successful deployment status, and QA application URL.
Require a GitHub deployment record for environment `QA` at the same full SHA,
linked to the deployment and QA URL. Whether Railway supplies that record needs
verification; any additional reporting integration requires separate approval.

The approved SHA, Railway revision, GitHub deployment record, and `/version`
response must agree. Build metadata alone does not prove isolation or deployment
success. Do not treat existing `production` records as QA evidence.

## QA validation checklist

- [ ] Candidate SHA and deployment are explicitly approved; required CI passes.
- [ ] Railway service is bound to `qa`; exact source SHA is confirmed.
- [ ] QA URL and project/environment/service identifiers are recorded.
- [ ] Runtime bindings are complete, QA-specific, and free of inherited production secrets.
- [ ] QA database is `careerops_qa`; QA account has no production database privileges.
- [ ] Unsafe configuration and missing commit identity fail startup before traffic is accepted.
- [ ] Railway and GitHub deployment evidence match the approved full SHA.
- [ ] `/health` and `/version` pass the checks above.
- [ ] Full unit suite and CI-selected E2E suite pass for the candidate.
- [ ] Detail Viewer smoke passes 20 repetitions in the isolated candidate validation.
- [ ] Independent early-navigation regression passes analytics HTTP 200 and 500 cases; negative controls fail as expected in isolation.
- [ ] Deployed QA login, Saved Contacts, Detail Viewer, and contact loading/rendering pass using existing authorized access and safe data.
- [ ] Readiness and real navigation behavior are confirmed; deployed early navigation is exercised if practical, with any limitation recorded.
- [ ] Compare deployed results with isolated results; record failures, differences, and unrun checks.
- [ ] Rollback target and compatibility are recorded; stop for review without DEMO or PROD promotion.

## Rollback

Before deployment, record the previous QA deployment ID and full SHA, if one
exists, and verify its database compatibility. An explicitly approved rollback
reverts only the QA application service to a known compatible build; it must not
switch database bindings, reset data, or promote another environment.

The application safety changes require no schema migration. An older build
without the QA guards requires separately verified safe bindings before reuse.
Repeat identity, availability, and core functional checks after rollback. If this
is the first QA deployment and no safe rollback target exists, record that
limitation and agree on a containment plan before deployment approval.
