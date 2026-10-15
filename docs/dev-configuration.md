# Local DEV configuration

This implements the local configuration portion of the architecture in
[draft PR #73](https://github.com/MIBoy54/careerops-platform/pull/73), informed by
[Issue #74](https://github.com/MIBoy54/careerops-platform/issues/74).
Promotion is DEV → QA → PROD. DEMO is not a promotion stage; its existing deployment
and separate-schema implementation require independent reconciliation.

## Selection and required settings

| Runtime selected before loading | Active source | Precedence |
| --- | --- | --- |
| DEV (`APP_ENV=dev`) | Repository-root `.env.dev` only | File must be complete; conflicting inherited file keys fail |
| Railway QA / PROD | Existing Railway service variables; legacy `.env` loader unchanged | Inherited variables win |
| DEMO | Existing `.env.demo` loading | Unchanged |
| Test | No environment file | Database/deployment bindings prohibited |

Previously DEV selected `.env`, ignored dotenv read errors, and let inherited
variables win. Now an absent/unreadable `.env.dev` or an incomplete file fails
startup before database access. Inherited settings cannot fill missing required
values. Even a valid file does not hide inherited Railway/secondary bindings.
Generic startup cannot select DEV through APP_ENV inside legacy `.env`.
All loader errors contain setting names or fixed messages, never values.

Required nonempty names in `.env.dev`:

| Name | DEV contract |
| --- | --- |
| `DB_HOST` | Literal `127.0.0.1` or `::1` |
| `DB_PORT` | Verified local MySQL port; decimal integer 1–65535 |
| `DB_NAME` | Exactly `careerops_dev` |
| `DB_USER` | Exactly `careerops_dev_app` |
| `DB_PASSWORD` | Existing dedicated DEV account password |
| `SESSION_SECRET` | A local DEV session secret |
| `SESSION_TREND_SOURCE_TIME_ZONE` | Verified historical analytics recording zone |

`APP_ENV=dev` is optional inside the file because the launcher selects it; any
other value there is rejected. `PORT` is optional (HTTP default 3000).
The sanitized `.env.dev.example` contains placeholders, not working credentials.
Do not populate settings by copying secrets from another environment file.

The primary database identity and restricted account grants are still checked
read-only before listening. Scope/wildcard validation still fails closed; the
account name alone is not proof of least privilege. DEV creates one primary pool,
no secondary pool, and no synchronization. No account, password, grant, schema,
global database timezone, or deployed environment is changed by this implementation.

## Names-only inventory

Neither `.env` nor `.env.dev` exists in the implementation workspace. Consequently,
the Windows workstation's actual missing/obsolete names have **not** been verified.
Run this PowerShell comparison locally; it outputs names only:

```powershell
function Get-EnvNames($Path) {
  if (!(Test-Path -LiteralPath $Path)) { throw "Missing configuration file: $Path" }
  Get-Content -LiteralPath $Path | ForEach-Object {
    if ($_ -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=') { $Matches[1] }
  } | Sort-Object -Unique
}
$legacyNames = @(Get-EnvNames '.env')
$devNames = @(Get-EnvNames '.env.dev')
Compare-Object $legacyNames $devNames
$requiredNames = @('DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD',
  'SESSION_SECRET','SESSION_TREND_SOURCE_TIME_ZONE')
$requiredNames | Where-Object { $_ -notin $devNames }
```

`<=` identifies a name only in `.env`; `=>` identifies one only in `.env.dev`.
Name presence does not prove a value is correct or nonempty; startup validates that
privately. Do not paste file contents, value diffs, process-environment dumps, or
credentials into issues or logs.

`DEMO_DB_*`, `RAILWAY_*`, `MYSQL*`, and `DATABASE_URL` are prohibited when nonempty
in DEV, whether inherited or in the file. DEMO synchronization flags are unnecessary;
they do not enable synchronization in this DEV baseline. `.env.qa`, `.env.before-recovery`,
and `.env.local-backup` are not active DEV sources. Do not delete or overwrite them
as part of this change. Real `.env` and `.env.*` files stay ignored; only explicitly
sanitized example files are allowlisted. Git ignore rules do not untrack a file
that was already committed; verify with `git ls-files -- '.env*'` (names only).

## Startup and troubleshooting

1. Review the names-only inventory and privately complete the existing `.env.dev`
   using approved local configuration. No credentials are supplied by this PR.
2. Run `npm run start:dev` from the repository root. The listener binds only to
   `127.0.0.1`; both the DEV launcher and direct DEV server path retain this rule.
3. If an inherited key conflicts, open a clean terminal or clear that specific
   shell variable. Do not override validation or point DEV at a deployed endpoint.
4. Missing-file/required-setting failures occur before any pool. Identity/grant
   failures close the primary pool. Investigate with the existing account; do not
   broaden privileges or use root to make startup pass.
5. For request errors, inspect both stdout and stderr of the actual Node process.
   The trend handler logs `Session trend failed:` on stderr. Do not publish logs
   containing private records or credentials.

## Session trend recording zone

Repository recording paths use MySQL `NOW()` for `first_seen`/`last_seen` and heartbeat
`event_time`, stored as DATETIME. No pool timezone initialization is present.
Thus new values follow the database session's recording convention, which may
inherit the server's zone. DATETIME contains no offset or zone provenance.

The operator reports that current local MySQL uses Central time and that named
`America/Chicago` conversion succeeds. This supports that zone for locally recorded
Central wall-clock values, but does not prove historical imported/restored values
share the convention. No historical provenance or live database was accessible here.

With the existing restricted DEV connection, use only these read-only checks:

```sql
SELECT DATABASE(), VERSION(), @@session.time_zone, @@global.time_zone,
       @@system_time_zone, NOW(), UTC_TIMESTAMP();
SELECT CONVERT_TZ('2026-01-15 12:00:00', 'America/Chicago', '+00:00') AS winter_utc,
       CONVERT_TZ('2026-07-15 12:00:00', 'America/Chicago', '+00:00') AS summer_utc;
```

Require `careerops_dev`. Expected sample conversions are 18:00 UTC in winter and
17:00 UTC in summer, with neither NULL. Check historical deployment/session timezone
settings, restore provenance, and known event timestamps against independently
dated activity. If all relevant history is Central regional wall-clock time,
set `SESSION_TREND_SOURCE_TIME_ZONE=America/Chicago` privately in `.env.dev`.
If verified history is UTC, use `+00:00`; do not infer UTC from the report's output.
A fixed Central offset is unsuitable for regional history spanning DST.

Mixed conventions or repeated DST-hour DATETIME values cannot be recovered from
these columns alone. Record that uncertainty before relying on the report; do not
rewrite history or change global/session timezone settings to hide it.

After startup, an authenticated GET `/api/analytics/session-trend` should return
200, UTC window metadata, and twelve two-hour buckets, including zero intervals.
Unknown named zones/conversion failures must continue to return an explicit error.
This configuration change does not repair `/api/demo-refresh/latest`; that endpoint
is a separate investigation and must never be solved by connecting DEV to DEMO/PROD.

## Backup, recovery, and validation

Keep private environment backups outside Git with appropriate local access controls.
Record the application revision and nonsecret configuration names separately.
Do not restore deployed credentials/session secrets into DEV. Database backups,
refreshes, restores, grant changes, and credential rotation require separate scope;
none are executed here. Retain old files securely until recovery ownership is clear.
On rollback to older code, remember that its loader uses `.env`; review selection
before starting it rather than copying `.env.dev` secrets into legacy files.

Run `npm test` for synthetic-file loading, mocked startup/identity/grant checks,
secret-output checks, and DEV launcher binding. Run `npm run test:session-trend`
for handler/browser regressions. Its opt-in SQL suite uses only the disposable,
network-disabled MySQL container described in [the trend documentation](session-activity-trend.md).
Never point tests at workstation data, Railway QA, or PROD.
