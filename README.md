# CareerOps Platform

CareerOps is a web application for organizing recruiter and employer contacts,
tracking job-search activity, and preparing weekly unemployment reporting records.
It also provides a quality engineering showcase through validation logic,
automated tests, and dashboards for application activity and GitHub Actions runs.
Reporting features support recordkeeping; they do not establish compliance with
any particular agency's requirements.

## Current implementation

The source includes contact entry and editing, saved-contact search and detail
views, weekly report creation and history, CSV exports, session authentication,
administrative route checks, DEMO guest access with write restrictions, and
session activity analytics. These are implementation observations, not a claim
that every workflow has been verified in a running deployment.

### Architecture

| Layer | Implementation |
| --- | --- |
| Browser | `ui/index.html` and `ui/login.html`; the main page loads the ES module `src/app.js` and `src/App.css`. |
| Application | Node.js ES modules and Express in `src/server.js`, serving the UI and API from one process. |
| Validation and access | Contact/report validation modules, administrative checks, and environment selection under `src/`. |
| Persistence | MySQL through `mysql2`; database identity is checked during startup outside test mode. |
| Sessions | `express-session` and bcrypt authentication; sessions currently use the default in-memory store. |
| Visibility | Application telemetry, session trends, validation-run records, and a GitHub Actions summary using Octokit. |
| Automated validation | Vitest unit/route tests, Playwright browser tests, and separate session-trend regressions. |

There is no frontend build script in `package.json`. React-style components remain
in `src/components/`, but are not wired into the current HTML entry point.
In-memory sessions are cleared by process restarts; shared sessions across replicas
would require an additional session store.

### Hosting

The owner confirms separate Railway projects for CareerOps QA, DEMO, and PROD,
each containing application and MySQL services. Coolify and DigitalOcean are
retired. Cloudflare's specific role has not been verified.

Project/service existence does not prove deployed revision, application health,
database privileges, or workflow correctness. GitHub Actions performs automated
validation; the checked-in workflow contains no application deployment step.
Branch protection, required checks, and automatic deployment settings are not
established by this README.

## Repository guide

```text
.github/workflows/careerops-ci.yml  GitHub Actions validation workflow
src/server.js                      Express server and API entry point
src/app.js                         Active browser application module
src/environment.js                 Runtime selection and database configuration
src/validateContact.js             Contact validation
src/validateWeeklyReport.js        Weekly-report validation
src/sessionTrend*.js               Session-trend API and browser rendering
ui/                                HTML pages and additional styles
scripts/start-dev.js                Local DEV entry point
scripts/                           Additional operational script placeholders
database/schema/                   Baseline schema and placeholder SQL files
migrations/                        Incremental ALTER TABLE scripts
tests/unit/                        Default Vitest suite
tests/e2e/                         Playwright suite, including smoke tests
tests/helpers/                     Shared browser-test helpers
tests/regression/                  Separate session-trend regressions
archive/                           Legacy browser source
docs/                              Operational notes and design documentation
```

Some tracked paths that resemble directories, such as `database/migrations`,
`database/procedures`, `database/views`, and `tests/api`, are empty regular files.
`docs/api.md` and `docs/testing.md` are also empty. These placeholders do not
represent implemented documentation or test suites. `tests/smoke/` is outside
the configured Playwright test directory; active CI smoke selection is under
`tests/e2e/smoke/`.

## Local setup

### Prerequisites and verification status

- Git, Node.js, and npm. CI selects Node 20; `package.json` does not declare an
  `engines` requirement. Use a dependency-compatible Node version and the committed
  lockfile.
- A local MySQL server supporting the schema's MySQL 8-style collation and the
  runtime's `partial_revokes` check. The exact local server version and fresh
  database provisioning procedure have not been validated here.
- A dedicated local DEV database/account with reviewed schema and grants.
- For browser tests, the appropriate Playwright browser installation. The separate
  session-trend chart suite expects Chromium at `/usr/bin/chromium` or an explicit
  `CHROMIUM_PATH`.
- For opt-in SQL regression tests, Docker with the local Unix socket and the
  specifically named disposable MySQL container described below.

The following is the setup sequence derived from source and configuration. It
has not been exercised as a fresh-clone installation during this README update.

```sh
git clone https://github.com/MIBoy54/careerops-platform.git
cd careerops-platform
npm ci
```

Before starting DEV, provision the local `careerops_dev` schema and a dedicated
account. Review [database operations](docs/database/README.md) and
[environment isolation](docs/environment-isolation.md). Do not apply every SQL
file sequentially: the baseline already includes `users.role` and
`recruiter_tracker.industry`, while the root migrations add those columns again;
the industry widths also differ. A reconciled, repeatable bootstrap remains to
be verified. HTTP database setup is disabled.

Configure a local ignored `.env` or supply process environment variables. No
`.env.example` is currently supplied. Existing process variables take precedence
over dotenv values.

| Binding | Local DEV requirement |
| --- | --- |
| `APP_ENV` | `dev`; `npm run start:dev` sets this before loading dotenv. |
| `DB_HOST` | Literal `127.0.0.1` or `::1`. |
| `DB_PORT` | Verified local port; defaults to 3306. |
| `DB_USER` | Dedicated DEV account, not a broad administrative account. |
| `DB_PASSWORD` | Must be supplied; use local secure configuration, never committed values. |
| `DB_NAME` | If supplied, must be exactly `careerops_dev`; otherwise derived from `APP_ENV`. |
| `SESSION_SECRET` | Supply a locally generated session secret. |
| `PORT` | Optional; defaults to 3000. |
| `SESSION_TREND_SOURCE_TIME_ZONE` | Required for the session-trend endpoint; must match the verified historical timestamp convention. See the [trend notes](docs/session-activity-trend.md). |
| `GITHUB_TOKEN` | Optional for authenticated GitHub dashboard access; grant only the necessary read access. |

DEV startup rejects nonempty `DEMO_DB_*`, `RAILWAY_*`, `MYSQL*`, and
`DATABASE_URL` bindings. It checks the selected schema and account grants;
accepted DEV grants are restricted to approved DML within `careerops_dev`,
without roles, grant option, or cross-schema privileges. See the isolation guide
for underscore/wildcard handling and supported grant formats.

After provisioning and configuration:

```sh
npm run start:dev
```

Open `http://127.0.0.1:3000` (or the configured port). A usable local account and
its role must be established through a reviewed local account setup; no seeded
login is documented. `npm start` and `npm run api` both run `src/server.js`
directly and require an explicitly configured runtime.

The source maps `dev`, `qa`, `demo`, and `production` to `careerops_dev`,
`careerops_qa`, `careerops_demo`, and `railway`, respectively. Deployed modes
also require Railway project/environment identifiers; QA requires additional
bindings and a full build commit SHA. These mappings describe code requirements,
not independent verification of deployed configuration.

## Tests and automated validation

Commands below describe available selections; no test suite or installation was
run for this documentation update, and no current passing status is asserted.
After dependencies are installed, `npx` commands use the project's test tools.

| Command | Scope and prerequisites |
| --- | --- |
| `npm test` | Vitest tests under `tests/unit/`, including mocked environment/route checks. Excludes E2E, standalone smoke, and regression directories. |
| `npx playwright test tests/e2e/smoke --workers=1` | CI smoke selection. Requires installed Playwright browsers. |
| `npx playwright test tests/e2e --workers=1` | Local selection of the E2E directory, including the history test excluded by CI. |
| `npm run test:session-trend` | Session-trend unit, Chromium rendering, and opt-in SQL regressions. SQL tests skip unless enabled. |
| `SESSION_TREND_TEST_MYSQL=1 npm run test:session-trend` | POSIX-shell syntax enabling SQL checks as well; requires the isolated container and Chromium. |

`playwright.config.js` starts its own loopback server on port 3100 by default
(overridable with `PLAYWRIGHT_PORT`), sets `APP_ENV=test`, and refuses to reuse an
existing server. Test mode avoids application database connections and provides
in-memory contacts/login behavior. Tests do not establish real MySQL persistence
or deployed behavior. Use a shell without nonempty database or Railway bindings:
test mode rejects them. The application skips dotenv in test mode, but browser
helpers import dotenv; keep deployed configuration out of the test environment.
The login helper supports `TEST_EMAIL` and `TEST_PASSWORD` with synthetic defaults.

The SQL regression requires a disposable container named
`careerops-trend-dev-test` on `/var/run/docker.sock`; it uses synthetic CTE data,
not a CareerOps database. See [session-trend regression instructions](docs/session-activity-trend.md#regression-checks)
for container setup and cleanup. Browser installation and container creation are
separate prerequisites, not actions performed by these instructions being read.

### What GitHub Actions selects

The [workflow](.github/workflows/careerops-ci.yml) runs on pushes and pull requests
for `dev`, `develop`, `qa`, `demo`, and `main`:

- All triggered runs install with `npm ci` and run the unit suite.
- Pull requests also run the SQL regression against a disposable MySQL 8.4
  container with networking disabled.
- All pull requests and pushes to `qa`, `demo`, or `main` install Playwright
  browsers and run `tests/e2e/smoke`.
- Pushes to `demo` or `main`, and pull requests targeting `main`, run the broader
  E2E selection with `--grep-invert "Generated weekly report appears in Weekly Report History"`.
  That test is explicitly excluded; the workflow gives no resolution for it.
- The separate session-trend Chromium regression is not selected by this workflow.

These selections provide automated validation, not complete test coverage,
verified deployment readiness, or enforced environment promotion. Inspect
[Actions runs](https://github.com/MIBoy54/careerops-platform/actions/workflows/careerops-ci.yml)
for results tied to a specific commit.

## Operational documentation and remaining verification

- [Environment isolation](docs/environment-isolation.md): runtime selection, DEV
  grant restrictions, test ownership, and implementation limitations.
- [Deployment guide](docs/deployment.md): deployed bindings, identity checks,
  validation evidence, and rollback considerations.
- [Database operations](docs/database/README.md): schema organization and database
  review checklists.
- [Session activity trend](docs/session-activity-trend.md): timestamp assumptions,
  endpoint contract, and regression prerequisites.

Some operational notes describe earlier implementation snapshots. In particular,
the deployment guide's unverified QA-service-existence note predates the owner's
confirmation of separate Railway projects; its prohibition on `CI=true` also
differs from current environment code, where `CI=true` alone does not select test
mode. The isolation guide's no-secondary-pool statement predates the guarded
production-to-DEMO synchronization path now in `src/environment.js`. Verify
current source and runtime settings before using these notes operationally.

Fresh database setup, local account bootstrap, live endpoints, deployed revision
and database permissions, and current test outcomes remain unverified by this
README update. The historical demo URL is omitted pending an availability check.
