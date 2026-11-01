# Roadmap

Status reviewed 2026-10-31 at baseline `7fc0fa9`.

## Implemented

- Express/MySQL contact tracking, saved contacts, search, reporting, and CSV export.
- Session authentication, DEV stored roles, administrative route protection,
  environment/database identity guards, and DEMO business-write restrictions.
- Guarded fresh DEV schema/account bootstrap and synthetic admin provisioning.
- Session activity trends, validation history, and GitHub Actions summaries.
- Vitest, Playwright smoke/selected E2E, SQL regression, and final-server readiness.

## Validation completed for the reviewed baseline

- 457 unit tests and isolated MySQL ON/OFF behavior, permission boundaries,
  reporting, application restart, and all four state-preserving refusal checks.
- Two-clean-clone reproducibility with independent dependencies and runtime fixtures.
- GitHub CI for PRs #78/#79; owner-supplied PROD gate/deployment evidence at `7fc0fa9`.

These milestones do not certify every live workflow. See [run history](run-history.md).

## Current work

1. Refresh operational documentation in DEV.
2. Maintain the persistent local DEV runtime now provisioned; app/database restart
   and volume reuse passed. The disruptive WSL restart check is still pending.
3. Resume showcase-readiness assessment against agreed user journeys.
4. Promote each candidate through DEV → QA → DEMO → PROD with stage evidence.

## Remaining verification and improvements

- Confirm QA/DEMO service branch bindings, deployed SHA, health, access, and DB
  isolation for each promotion; project existence alone is insufficient.
- Resolve the weekly-report-history test excluded by CI.
- Reconcile the baseline versus historical migrations and verify deployed schema
  parity before any migration; correct and validate the legacy backup process.
- Maintain readable, portable validation evidence; retain the missing historical
  OFF-mode record's status without calling the new local run recovered evidence.
- Review session store/replica requirements before scaling beyond one process.
- Evaluate trend-query performance and historical timestamp conventions.

Recruiter/candidate directory SQL files are placeholders, not completed features.
A nightly validation schedule is not configured in the current CI workflow.
No new infrastructure, migration, or production change is authorized by this roadmap.
