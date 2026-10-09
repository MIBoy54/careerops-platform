# CareerOps environment isolation (DEV implementation)

No credentials, environment files, schemas, or deployments were changed.

## Selection contract

`APP_ENV` must explicitly be one of `dev`, `qa`, `demo`, `production`, or `test`.
Git branches and browser labels do not select databases. `DB_NAME`, if supplied,
must exactly match the mapping:

| APP_ENV | Database |
| --- | --- |
| dev | careerops_dev |
| qa | careerops_qa |
| demo | careerops_demo |
| production | careerops |
| test | No database connections |

An omitted DB_NAME derives only from this validated mapping; no production fallback
exists. Missing or invalid APP_ENV, unsafe overrides, incomplete connection
configuration, and malformed ports fail before pool creation.

Inherited environment variables retain precedence over dotenv. `.env.demo` is
selected when inherited APP_ENV is demo; otherwise `.env` is selected. Test mode
never loads an environment file and rejects nonempty database/deployment bindings.
NODE_ENV=test (case/whitespace normalized) or VITEST=true requires APP_ENV=test.
CI=true alone is permitted for a deployed runtime, including Railway QA; it never
activates test shortcuts unless APP_ENV=test. All test DB calls fail
locally without creating a connection; the existing in-memory contacts/login path
remains available. Tests requiring SQL must use separate opt-in isolated fixtures.

## Local DEV prerequisites (configure only after separate authorization)

Use APP_ENV=dev, DB_NAME=careerops_dev, a literal DB_HOST of 127.0.0.1 or ::1,
the verified local DB_PORT, and a dedicated local DEV account. DB_USER must be
explicit and DB_PASSWORD must be present (empty passwords remain permitted for
local accounts). No DEMO_DB_*, RAILWAY_*, MYSQL*, or DATABASE_URL binding may be
nonempty in DEV. Broad root accounts are deliberately rejected: direct grants must
be limited to SELECT/INSERT/UPDATE/DELETE in the exact careerops_dev schema plus
global USAGE, without grant option, role grants, or cross-schema/global privileges.
Schema, table, and column grants are supported. Unrecognized grant formats fail closed.

Startup reads MySQL's global partial_revokes setting without changing it. With
pattern matching enabled (partial_revokes=OFF), a schema-level grant must escape
the underscore: `careerops\_dev`.*. Unescaped `_` and `%` are rejected as wildcards.
With partial_revokes=ON, schema names are literal and `careerops_dev`.* is accepted.
Table/column grant schemas are literal independently of that setting. Unknown or
unavailable server semantics fail startup; no global settings are changed.

`npm run start:dev` forces DEV before dotenv loading, but does not silently replace
an unsafe DB_NAME. Thus the previously reported `.env` DB_NAME=careerops will
prevent startup until an approved configuration correction is made. Generic
`npm start` with local APP_ENV=production also fails because deployed environments
require Railway project and environment IDs. No real .env was altered here.

The DEV listener binds to loopback. DEMO synchronization is unavailable and no secondary pool is created.
The DEV 9a543bb baseline contains no synchronization implementation; the guarded
manual endpoint explicitly denies refresh rather than importing that later feature.

## Deployed compatibility and startup

QA, DEMO, and production require RAILWAY_PROJECT_ID and RAILWAY_ENVIRONMENT_ID.
Their exact database mappings are enforced. Before serving, startup performs a
read-only selected-database identity check; DEV additionally checks current-account
grants. Failure rejects startup and closes the primary pool. Existing deployed TLS
options are retained; local DEV uses a normal local connection without requiring
TLS. The server-wide handlers that previously swallowed uncaught exceptions were
removed so initialization failures terminate the process.

No environment creates a secondary destination pool in this DEV-based integration.
The unrelated synchronization feature from the newer cloud history is excluded.
DEMO retains guest access/read-only behavior. QA preserves the f85f726 requirements:
explicit nonempty DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/SESSION_SECRET, strictly decimal
DB_PORT in 1..65535, no DEMO_MODE or actual test runtime, and a full 40-character Git
SHA in RAILWAY_GIT_COMMIT_SHA (preferred) or BUILD_COMMIT_SHA. CI=true is compatible
with QA and does not enable in-memory test authentication. /version returns the
validated environment and build SHA. Railway IDs and exact database identity are
also required. All deployed verification uses mocks, never Railway databases.

## Administrative routes

/setup-db is permanently disabled (HTTP 410 after administrator authorization).
/db-ping, /debug-src, /env-check, /api/analytics/ping, manual DEMO refresh, and
validation-run start/complete require a real authenticated administrator; DEMO
guest fallback cannot satisfy this middleware. /env-check returns only environment,
database name, and synchronization policy, not credential/connection bindings.
The earlier unauthenticated duplicate validation-history route was removed, leaving
its authenticated equivalent. /health remains public without connection details.

Playwright starts and stops a fresh APP_ENV=test server instead of a Windows-specific
QA command, and refuses reuse of an unknown running server. CI delegates ownership
to Playwright; its separate background server startup/wait step was removed. Sequential
smoke and E2E invocations each own and clean up their server. Optional CHROMIUM_PATH
selects an installed local browser without changing deployment configuration.

## Validation and limits

`npm test` covers offline environment selection, pool initialization with mocked
connections/grants, actual Express route chains with mocks, and existing unit tests.
The session-trend browser suite remains separately available.

Loopback addresses and Railway markers are safeguards, not proof of physical
server identity. An intentionally configured local tunnel or fabricated deployment
markers can defeat endpoint provenance checks; DEV restricted grants still prevent
cross-schema application access. External credential management and network policy
must also keep deployed credentials/tunnels out of DEV. No claim is made that
application code can prevent deliberate modification of these safeguards.

Restricted privilege checks intentionally reject role-based grants, grant options,
and privileges beyond approved DML; use an explicitly reviewed DEV account. MySQL grant syntax and Railway
markers were validated with fixtures and need review against real configuration
before any separately authorized promotion. No deployed DB access was used.
