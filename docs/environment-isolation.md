# Environment isolation

Reviewed 2026-10-31 against `7fc0fa9`. Source: src/environment.js,
src/devGrantValidation.js, src/adminAccess.js, src/server.js, and DEV scripts.

## Runtime selection

APP_ENV must explicitly be dev, qa, demo, production, or test. Branch and browser
labels do not select databases. DB_NAME, when supplied, must exactly match:

| APP_ENV | Database |
| --- | --- |
| dev | careerops_dev |
| qa | careerops_qa |
| demo | careerops_demo |
| production | railway |
| test | No database connection |

Explicit process variables take precedence over dotenv. Inherited APP_ENV=demo
selects .env.demo; otherwise .env is used. Test mode skips dotenv and rejects
nonempty DB_*, DEMO_DB_*, MYSQL*, DATABASE_URL, and RAILWAY_* bindings.
NODE_ENV=test or VITEST=true requires APP_ENV=test. CI=true alone is permitted,
including in Railway QA, and never activates in-memory behavior by itself.

Missing/invalid selection, unsafe overrides, malformed ports, or missing bindings
fail before runtime initialization. Before traffic, connected database identity
must match the selected environment. Pools are closed on startup failure.

## Local DEV

Use APP_ENV=dev, literal DB_HOST=127.0.0.1 or ::1, and a dedicated account on
careerops_dev. No nonempty DEMO_DB_*, RAILWAY_*, MYSQL*, or DATABASE_URL bindings
are allowed. npm run start:dev sets DEV before loading dotenv and binds to
loopback; it does not hide an unsafe DB_NAME override.

Startup permits only reviewed DML grants in that exact schema plus global USAGE;
roles, grant options, global/cross-schema privileges, and unknown formats fail.
With partial_revokes=OFF, schema-level grants must escape the underscore as
`careerops\_dev`.*. With ON, the schema name is literal. Table/column schemas are
literal independently of that setting. Unknown semantics fail startup.

The fresh bootstrap is stricter than generic runtime configuration: it requires
explicit DB_NAME, DEV_INSTANCE_ID server UUID, DEV_DB_ACCOUNT_HOST loopback,
a non-root account name, a non-placeholder app password, distinct provisioning
credentials, and schema/instance confirmation. It refuses existing schema/account
state and leaves partial DDL resources intact on failure. See
[bootstrap instructions](database/README.md).

DEV login accepts stored roles admin/user/guest and rejects unknown roles while
clearing the session user. The DEV account CLI creates only synthetic
@example.invalid administrators, bcrypt cost 12, and refuses duplicate emails.
The existing public registration route is separate and is not the documented
administrator bootstrap procedure. Hidden input disables terminal echo before
publishing the prompt; real Linux PTY tests cover input, cancellation, and cleanup.

DEV runtime may accept an empty DB password, but the guarded bootstrap does not.
Supply a generated SESSION_SECRET even where a nonproduction fallback exists.

## Deployed environments

QA/DEMO/production require Railway project/environment markers and separate DB
bindings. QA additionally requires nonempty credentials/port/session secret and
full build SHA; it rejects DEMO_MODE=true and actual test runtime. Production
requires a strong configured session secret, Secure/HttpOnly cookies, and trusts
only the immediate proxy hop. Deployed login retains owner-email admin assignment;
stored-role authentication is currently DEV-only.

DEMO requireAuth can create a guest session. requireAdmin never accepts that
fallback as an administrator. Business write guards reject contact/report and
validation writes in DEMO; public telemetry can still record activity.

Production synchronization is implemented. A secondary DEMO pool exists only
with production and DEMO_SYNC_ENABLED=true, required destination bindings, and
verified careerops_demo identity. Manual refresh and report-triggered refresh are
unavailable in DEV/QA. No-secondary-pool statements from older snapshots no longer
apply. Sync is not a comprehensive anonymization guarantee; review copied fields.

## Administrative and test boundaries

/setup-db remains disabled (410 after admin middleware). /db-ping, /debug-src,
/env-check, /api/analytics/ping, validation start/complete, and manual refresh
require admin; refresh also requires enabled production sync. /env-check exposes
runtime/database/policy, not connection credentials. See [API reference](api.md).

Playwright owns a fresh loopback APP_ENV=test server and refuses reuse. Tests
use synthetic in-memory contact/login behavior and cannot establish real database
persistence. MySQL regression/runtime checks use isolated opt-in fixtures.

## Limits and verified evidence

Loopback and Railway markers are safeguards, not proof against deliberate local
tunnels or fabricated bindings. External credential/network controls must keep
production access out of DEV. No role checks replace database account isolation.
In-memory sessions are lost on restart and do not support shared replica sessions.

The reviewed baseline passed mocked route/configuration tests, real ON/OFF MySQL
bootstrap/grant/login/report/restart checks, state-preserving refusal checks, and
two-clean-clone reproducibility. Live QA/DEMO binding/privilege parity and full
production workflow behavior remain separate stage checks. See [run history](run-history.md).
