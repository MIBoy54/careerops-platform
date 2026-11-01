# API reference

Source inventory reviewed 2026-10-31 at `7fc0fa9`, primarily `src/server.js`.
This is an implementation reference, not a claim that every route was tested live.

JSON requests use `Content-Type: application/json`. Authentication uses the
`connect.sid` session cookie, not a bearer token. Browser clients use same-origin
cookies; programmatic clients must preserve the cookie across requests.

Access below means the actual route middleware: **Session** is `requireAuth`,
which creates a guest session in DEMO. **Admin** requires a real authenticated
session with role `admin`; DEMO fallback alone cannot satisfy it. Do not infer
admin-only behavior merely from a button being hidden in the UI.

## Availability and authentication

| Method | Route | Access / behavior |
| --- | --- | --- |
| GET | `/health` | Public; HTTP 200, plain `ok`; not a functional DB check |
| GET | `/version` | Public; `{app, environment, commit}`; commit may be absent/null outside verified build bindings |
| GET | `/hello` | Public; plain `hello` |
| POST | `/api/auth/register` | Public entry; requires email/password, optional full_name; disabled in production and blocked for DEMO business writes |
| POST | `/api/auth/login` | Public; email/password; session on success, JSON user or HTML redirect |
| GET | `/api/auth/me` | Session; `{user, app_env}` |
| POST | `/api/auth/logout` | Session; destroys session and clears cookie |

DEV login validates stored roles `admin`, `user`, `guest`; other roles return 403
and clear the session user. QA/DEMO/production retain the existing owner-email
admin mapping; stored-role behavior is DEV-specific. `APP_ENV=test` has synthetic
in-memory login behavior and is never a substitute for real authentication tests.
Registration and the guarded synthetic DEV CLI are separate paths.

## Contacts and reporting

| Method | Route | Access / behavior |
| --- | --- | --- |
| GET | `/api/contacts` | Session; contact collection |
| POST | `/api/contacts` | Session; create contact, blocked by DEMO write guard |
| PUT | `/api/contacts/:id` | Session; update contact, blocked by DEMO write guard |
| DELETE | `/api/contacts/:id` | Session; delete contact, blocked by DEMO write guard |
| GET | `/api/contacts/export` | Session; CSV download |
| GET | `/api/companies/search?q=...` | Session; fewer than 2 query characters returns []; up to 10 company matches |
| GET | `/api/companies/details?company=...` | Session; company details; missing company returns 400 |
| GET | `/api/reports` | Session; latest submitted report per reporting window |
| POST | `/api/reports` | Session; `{selectedIds: [id1,id2,id3,id4]}`; four unique numeric IDs required; DEMO write guard applies |
| GET | `/api/reports/:id` | Session; report plus employers; missing report returns 404 |
| GET | `/api/reports/unemployment?start=...&end=...` | Session; date-range JSON; DEMO non-admin access rejected |
| GET | `/api/reports/unemployment/export?start=...&end=...` | Session; date-range CSV |

Report creation uses a transaction and the server's current Sunday–Saturday week,
marks selected contacts reported, and returns HTTP 201 with `reportId`. DEMO
contact/report JSON suppresses notes where implemented; this is not a universal
field-level privacy policy. Reporting supports recordkeeping, not certification
of an agency's compliance requirements.

## Analytics, validation, and operations

| Method | Route | Access / behavior |
| --- | --- | --- |
| GET | `/api/github/actions-summary` | Public; CI summaries, not deployed build identity |
| POST | `/api/analytics/start` | Public telemetry write; session_id/page_path |
| PUT | `/api/analytics/heartbeat` | Public telemetry write; session_id/page_path/numeric seconds |
| GET | `/api/analytics/summary` | Session; aggregate activity |
| GET | `/api/analytics/sessions-today` | Session |
| GET | `/api/analytics/session-trend` | Session; twelve two-hour buckets; see [trend contract](session-activity-trend.md) |
| GET | `/api/analytics/active-users` | Session |
| GET | `/api/analytics/stale-sessions` | Session |
| GET | `/api/validation-runs` | Session; recorded validation history |
| POST | `/api/validation-runs/start` | Admin; run_type, optional trigger_source/notes; DEMO write guard |
| PUT | `/api/validation-runs/:id/complete` | Admin; completion recording; inspect handler for payload |
| GET | `/api/analytics/ping` | Admin; selected runtime/database diagnostic |
| GET | `/db-ping` | Admin; database query diagnostic |
| GET | `/debug-src` | Admin; source directory listing |
| GET | `/env-check` | Admin; app_env/database/demo_sync_enabled, not connection secrets |
| GET | `/setup-db` | Admin; always 410; HTTP schema setup is disabled |
| POST | `/api/demo-refresh` | Admin; additionally requires production and enabled sync |
| GET | `/api/demo-refresh/latest` | Session; latest completed refresh metadata |

Manual refresh and successful production report creation can mutate the configured
DEMO snapshot when synchronization is enabled. Do not call them for a read-only
health check. Session, access, payload, and database errors vary by handler;
consult source for exact response bodies rather than assuming one universal schema.
