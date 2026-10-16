# Railway QA isolation and recovery-gated refresh

Issue #76 implementation, based on `dev` / PR #75 (`5a53441`). **Nothing in this
change establishes current live Railway status or deploys data.** All examples
below are for an operator to review, fill in privately, and separately authorize.
Code promotion is DEV → QA → PROD. Database refresh is a separate operation. DEMO
is a restricted public view, not a promotion step.

## Boundaries and separate approvals

| Gate | Owner must separately authorize | Evidence required |
| --- | --- | --- |
| Discovery | QA read-only discovery, inventory and maintenance window | Actual project/environment/app service IDs, DB endpoint/account/schema/server UUID; current errors, tables, grants, schema dependencies |
| 1: recovery | QA backup and restore to a NEW isolated local MySQL server | Restricted login path, encrypted storage, backup checksum, complete schema/content/count comparison, restored counters, practiced recovery procedure |
| Privacy | Every actual column and synthetic replacement | Local snapshot provenance; orphan audit; review all metadata, fields, dates, IDs and relationships; no raw export to QA |
| 2a: rehearsal | DML into QA followed by mandatory rollback | Exact plan hash, verified gate 1, quiesced writers, safe counter high water, expiring `rehearse` approval |
| 2b: refresh | QA COMMIT | Successful recent rehearsal for the same plan, distinct `commit` approval, gate 1 still valid |
| 3: deployment | QA service deployment / code promotion | Reviewed commit, Railway QA bindings, migration plan if separately needed, rollback code version and smoke checklist |
| Rotation | Compromised PROD root credential rotation | Separate security/maintenance plan below; never part of refresh/deployment |

No live operation is authorized by the PR, dry-run output, old issue evidence or a
successful test. No automatic refresh/deploy workflow or HTTP endpoint is added.
Do not run existing `.bat` files as QA tooling. Backups and SQL imports are never
run by `plan`. `rehearse` **does write to QA temporarily**, so it also needs approval.
These approvals are protected operator attestations, not a cryptographic identity
service. Store them in an owner-controlled directory or use your approved external
change system to issue them; an operator able to edit code/artifacts can bypass a
local tool. Do not auto-generate owner approval in CI. Never upload private evidence
to CI, GitHub, chat, or a PR.

## Read-only audit and outstanding findings

Repository audit (no live connections):

- `src/environment.js`: explicit environment mapping, strict `.env.dev` and dedicated
  DEV account preserved. QA formerly required only nonempty Railway project/env IDs;
  now compares project/environment/service IDs and endpoint/account to independently
  reviewed `QA_EXPECTED_*` values. QA requires explicit `DB_NAME=careerops_qa`, a
  matching physical MySQL `@@server_uuid`, restricted direct DML grants, and required
  business/auth/telemetry tables before serving. Unknown/overlapping MYSQL*,
  DATABASE_URL and DEMO_DB_* bindings are rejected, even if apparently redundant.
- Railway QA uses **inherited Railway variables only**, with no `.env` / `.env.qa`
  read or fallback. Set `APP_ENV=qa` in Railway before process startup. Railway
  references may populate DB_*; do not supply both native MYSQL* variables and DB_*
  variables to the app service. Expected IDs must come from an independent inventory,
  not shell assignments copying observed IDs. Deployed TLS behavior is retained in
  the application; operator CLI uses certificate verification for remote DB endpoints
  or a verified private SSH tunnel to loopback.
- QA checks existing tables without creating them: `recruiter_tracker`,
  `weekly_reports`, `report_job_contacts`, `users`, `validation_runs`,
  `visitor_analytics`, `analytics_heartbeat_events`. Missing tables block startup
  and refresh. No auto-migration; separately review schema completeness and the
  session report's `SESSION_TREND_SOURCE_TIME_ZONE` against historical values.
- Schema `.sql` placeholders and backup/restore/sync/deploy `.bat` scripts in this
  baseline are empty. Migrations only describe user role and industry additions;
  they are not a complete QA schema bootstrap. Use actual metadata, never infer
  readiness from these files. Do not run a migration in this task.
- The dependency is `report_job_contacts.report_id → weekly_reports.id` and
  `recruiter_tracker_id → recruiter_tracker.id`. Tooling rejects unknown/cross-schema
  dependencies, triggers, routines, events, generated columns, views and non-InnoDB tables. It reads
  all target table schemas and content digests, including retained tables. Unknown
  legacy tables remain untouched but must be backed up and transactional.
- Existing `/setup-db` is disabled; protected diagnostic/admin routes and real
  authenticated QA login stay protected. Refresh is a CLI-only operation. Existing
  CI uses a fresh test-mode server and synthetic login; new regression also uses
  two disposable MySQL servers with no network. QA logging suppresses session,
  payload, SQL and driver details; other environments keep baseline behavior.

Separate defects/enhancements to track with owners (not silently fixed here):

1. `dev` maps PROD to `careerops`; issue evidence says live schema is `railway`.
   Preserve PROD code in this PR. Owner must reconcile histories/configuration in a
   separate change before promoting this branch to PROD.
2. Current QA data counts, Quality Gate History error, session trend HTTP 500 and
   schema/grant/TLS details are **unverified**. The issue's zero-row observations
   may have changed. Discover after read-only authorization; missing QA tables or
   invalid timezone need a separate reviewed migration/configuration change.
3. Original PROD snapshot had 44 orphan contacts across 12 reports / 36 missing
   recruiter IDs. This tool removes only the **explicit expected** orphan count
   from local staging and saves a restricted separate key-only audit. No PROD
   repair; different counts stop the run and require renewed review.
4. The supplied list of PROD fields is not an authoritative schema inventory.
   Unknown fields stop staging. Decisions about realistic company/website/location,
   requisition IDs, employment-report status, free text, date fidelity, relationships
   and IDs require field-by-field privacy approval. Default transforms below erase
   these values; do not loosen a transform to copy private data for convenience.
5. Baseline auth/registration, analytics ingestion and detailed non-QA logging merit
   independent security review; this is not a PROD auth redesign. No PROD accounts,
   password hashes, sessions, visitor analytics, heartbeat events, validation history,
   DEMO history or backup tables are eligible source data.
6. Employer Contact Form matching/pipeline enhancement is out of scope: company
   3+ character matching across opportunities, Open Existing/Create New, Agency,
   Industry, Job Title, Consultant Level and pipeline belong in a later backlog.

## Runtime QA variables

Keep credentials in Railway's secret store, never in this document or git.

| Observed/runtime | Independent expected value |
| --- | --- |
| RAILWAY_PROJECT_ID | QA_EXPECTED_RAILWAY_PROJECT_ID |
| RAILWAY_ENVIRONMENT_ID | QA_EXPECTED_RAILWAY_ENVIRONMENT_ID |
| RAILWAY_SERVICE_ID (app service) | QA_EXPECTED_RAILWAY_SERVICE_ID |
| DB_HOST / DB_PORT / DB_USER | QA_EXPECTED_DB_HOST / QA_EXPECTED_DB_PORT / QA_EXPECTED_DB_USER |
| SELECT @@server_uuid on the selected QA DB | QA_EXPECTED_DB_SERVER_UUID |

Require UUID syntax for Railway IDs / MySQL UUID, explicit DB_NAME, nonempty
DB_PASSWORD/SESSION_SECRET, decimal DB_PORT, full 40-character build SHA,
DEMO_MODE=false and no synchronization enablement. The account must have only
SELECT/INSERT/UPDATE/DELETE on exact careerops_qa objects plus global USAGE, no
roles, grant option or global privileges. For schema grants escape `_` when
partial_revokes=OFF (`careerops\_qa`.*); with partial_revokes=ON names are literal.
Table/column schemas are always literal. Unknown grant syntax fails closed. Full-schema SELECT is required so table-level
grants cannot hide legacy tables from the QA backup inventory. Runtime
verification is read-only, and cannot prove endpoint provenance without trustworthy
independent inventory, credential isolation and network policy.

## Windows operator preparation and discovery

Run in PowerShell 7 from the reviewed feature checkout. Install Node 20+, MySQL 8.4
client tools, and the approved Railway CLI. Use a new private directory outside
**every git worktree**, on an encrypted disk with ACL access limited to the owner.
The CLI creates files exclusively and refuses overwrites. Example paths have no
spaces, to keep MySQL `source` unambiguous:

```powershell
$Private = 'C:\CareerOpsPrivate\qa-refresh-CHANGE_ID'
New-Item -ItemType Directory -Path $Private
icacls $Private /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F"
npm ci
npm test
railway --version
railway whoami
railway list
# Inspect supported flags locally before any linked context is selected:
railway link --help
railway status --help
# After owner selects actual QA IDs, isolate local CLI context:
$Checkout = (Get-Location).Path
New-Item -ItemType Directory -Path "$Private\railway-discovery"
Set-Location "$Private\railway-discovery"
railway link --project $QaProjectId --environment $QaEnvironmentId --service $QaServiceId
railway status --json
Set-Location $Checkout
```

Linking records local CLI configuration and reads project metadata; it does not
mutate Railway resources or deploy. Verify the linked project, environment and app
service IDs independently in the Railway console, and separately inventory the QA
DB service. Stop if CLI version/help differs or any identity is uncertain. Do not
use `railway variables`, secret-revealing output, `railway run`, `up`, `redeploy`,
`connect`, or a remembered PROD profile in this task. A private DB tunnel needs
separate owner authorization; use the exact QA DB service shown by approved
discovery, never PROD root/tunnels. Review `railway ssh --help` for the installed
CLI's private SSH forwarding options; there is deliberately no guessed tunnel
command or hardcoded live ID here.

Prepare a private `manifest.json` (not an environment file). Minimal structure:

```json
{
  "version": 1,
  "target": {
    "environment": "qa", "database": "careerops_qa",
    "projectId": "OWNER_VERIFIED_UUID", "environmentId": "OWNER_VERIFIED_UUID",
    "serviceId": "OWNER_VERIFIED_APP_SERVICE_UUID", "serverUuid": "OWNER_VERIFIED_MYSQL_UUID",
    "host": "127.0.0.1", "port": 13306, "user": "OWNER_VERIFIED_QA_DML_ACCOUNT"
  },
  "source": {
    "kind": "verified-local-restore", "snapshotSha256": "SHA256_OF_EXISTING_LOCAL_SNAPSHOT",
    "restoreEvidenceSha256": "SHA256_OF_EXPORTED_SOURCE_OBJECT", "expectedOrphans": 44
  },
  "privacy": { "owner": "OWNER_CHANGE_REFERENCE", "reviewedFields": {} },
  "expectedCounts": { "recruiter_tracker": 1133, "report_job_contacts": 204, "weekly_reports": 59 },
  "backup": {},
  "rollback": { "owner": "OWNER_CHANGE_REFERENCE", "restoreProcedureReviewed": true, "writersQuiesced": true, "dependencyReviewApproved": true }
}
```

These placeholders deliberately fail validation. Counts are historical acceptance
expectations, **not claims of deployed state**. The target host/port can be a
verified loopback QA tunnel; runtime expected DB host is the Railway app's actual
binding, not the tunnel. `serverUuid` must still match the real selected QA server.
Target `serviceId` identifies the app; separately record/verify the DB service ID
and its relationship in the owner's inventory.

All QA connected commands require a private approval JSON. `planHash` is either
SHA256 of the exact JSON-stringified target object (discovery/backup), or the
validated plan's hash (rehearse/commit). `operation` must match one command and
expire within one hour. It must be separately issued/reviewed by the owner:

```json
{
  "owner": "OWNER_CHANGE_REFERENCE", "operation": "inspect", "planHash": "EXACT_HASH",
  "approvedAt": "OWNER_APPROVAL_UTC_TIME", "expiresAt": "UTC_WITHIN_ONE_HOUR",
  "maintenanceWindow": true
}
```

Compute the target hash without connecting or disclosing bindings:

```powershell
node --input-type=module -e "import fs from 'node:fs'; import {digest} from './src/qaDataset.js'; console.log(digest(JSON.parse(fs.readFileSync(process.argv[1],'utf8')).target))" "$Private\manifest.json"
```

For Node CLI connections use an interactive secret prompt, or an approved secret
manager piping exactly `{host,port,user,password,database}` JSON. This helper keeps
the password out of command arguments/history and files. Do not enable transcript,
PS tracing, debug logs, or echo its pipeline. It briefly holds plaintext in process
memory, as any DB client must:

```powershell
function Invoke-QaDbTool {
  param([string[]]$ToolArgs, [string]$DbHost, [int]$DbPort, [string]$DbUser, [string]$DbName)
  $secret = Read-Host 'Database password' -AsSecureString
  $cred = [pscredential]::new($DbUser, $secret)
  try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    @{host=$DbHost; port=$DbPort; user=$DbUser; database=$DbName; password=$cred.GetNetworkCredential().Password} |
      ConvertTo-Json -Compress | node scripts/qa-refresh.js @ToolArgs
    if ($LASTEXITCODE -ne 0) { throw 'QA tool stopped; inspect protected evidence before retrying' }
  } finally { Remove-Variable cred,secret -ErrorAction SilentlyContinue }
}
# Values below come from the privately reviewed inventory, not a default service.
Invoke-QaDbTool -DbHost $QaHost -DbPort $QaPort -DbUser $QaUser -DbName careerops_qa -ToolArgs @(
  'inspect','--manifest',"$Private\manifest.json",'--approval',"$Private\inspect-approval.json",
  '--output',"$Private\qa-before.json",'--connect-stdin')
```

`inspect` runs in a read-only transaction and verifies restricted QA grants and
required tables. Digests cover all current tables. Keep the service, workers,
analytics clients and administrative writers quiesced from this audit through
backup, restore, rehearsal and final verification. If the database changes, take a
new backup/audit and renew every plan/approval. It is not enough to disable the UI.

## Gate 1: backup and isolated restore (separate approval)

Plan first; this command has no DB connection and does not invoke mysql/mysqldump:

```powershell
node scripts/qa-backup.js plan --manifest "$Private\manifest.json" --output "$Private\qa.sql" --metadata "$Private\backup.json" --login-path careerops-qa-backup --ca loopback-tunnel
```

Use MySQL's interactive login-path prompt; never `-pPASSWORD`, `MYSQL_PWD`, URL
credentials or a plaintext defaults file. The login file is obfuscated, not a
replacement for OS access control. Protect the operator profile and never copy it
to the repo. Review/clear inherited MYSQL* overrides without printing values.

```powershell
# Approved loopback tunnel, exact QA account and port only; prompts for password:
mysql_config_editor.exe set --login-path=careerops-qa-backup --host=127.0.0.1 --port=$QaPort --user=$QaUser --password
# ONLY after distinct owner approval operation=backup, hash=target hash:
node scripts/qa-backup.js execute --manifest "$Private\manifest.json" --output "$Private\qa.sql" --metadata "$Private\backup.json" --login-path careerops-qa-backup --ca loopback-tunnel --approval "$Private\backup-approval.json"
Get-FileHash "$Private\qa.sql" -Algorithm SHA256
```

For remote direct TLS use `--ca C:\CareerOpsPrivate\approved-ca.pem`; the script
requires VERIFY_IDENTITY. Loopback mode is only for a separately verified private
tunnel, not a claim that arbitrary loopback ports are safe. Backup script verifies
schema/server/grants, excludes routines/events/triggers (the audit rejects them),
exports **all QA tables**, and records size/checksum/time without printing records.
A failed run leaves partial artifacts/in-progress metadata; quarantine them and
start with new filenames after diagnosis. A dump is not proof of recoverability.

Provision a **new local MySQL instance** on a distinct port with a distinct server
UUID, disconnected from Railway and application processes. Give a local restore
operator DDL rights only to `careerops_qa_restore_validation`, and a separate local
read-only verifier account. These are separately authorized local actions, not
runtime application grants. Do not restore over DEV or any existing worktree DB.

```powershell
mysql_config_editor.exe set --login-path=careerops-local-restore --host=127.0.0.1 --port=$RestorePort --user=$LocalRestoreUser --password
mysql.exe --login-path=careerops-local-restore --protocol=TCP --host=127.0.0.1 --port=$RestorePort --execute="CREATE DATABASE careerops_qa_restore_validation"
mysql.exe --login-path=careerops-local-restore --protocol=TCP --host=127.0.0.1 --port=$RestorePort --database=careerops_qa_restore_validation --execute="source $Private/qa.sql"
# Record local identity with the independently provisioned local verifier:
mysql.exe --login-path=careerops-local-restore --protocol=TCP --host=127.0.0.1 --port=$RestorePort --database=careerops_qa_restore_validation --execute="SELECT DATABASE(), @@server_uuid"
```

The `CREATE DATABASE` must fail if the schema already exists; stop instead of
reusing it. Inspect the dump privately for unexpected `USE`, database-level DDL,
DEFINERs or code before importing. The backup script does not add `--databases`,
so a normal dump restores into the explicitly selected local schema. Check every
client exit code; do not continue after an SQL error. PowerShell `Get-Content | mysql`
can alter encoding and is deliberately avoided.

Copy the actual `backup.json` object into `manifest.backup`, then validate measured
schema (including SHOW CREATE TABLE fingerprints for indexes/constraints), table
counts, row-content hashes, relationships and nonregressing counters:

```powershell
Invoke-QaDbTool -DbHost 127.0.0.1 -DbPort $RestorePort -DbUser $LocalVerifier -DbName careerops_qa_restore_validation -ToolArgs @(
  'verify-restore','--manifest',"$Private\manifest.json",'--audit',"$Private\qa-before.json",
  '--backup',"$Private\qa.sql",'--server-uuid',$LocalRestoreUuid,'--output',"$Private\restore.json",'--connect-stdin')
```

A read-only verifier inspects all restored tables. Any checksum, identity,
schema/content/count mismatch, missing evidence, unknown trigger/dependency or
restore counter regression blocks the refresh. Run a second approved `inspect`
with a new filename and compare it to qa-before.json to confirm no changes while
backing up. An empty QA **business** dataset can be backed up/restored, but a
staged refresh dataset and its expected counts must be nonzero.

## Local source staging and field review

Use only the already verified **local** PROD restore (or a newly owner-verified
local restore of an existing private snapshot). No command here connects to live
PROD. Verify the snapshot checksum, local schema/server UUID, source counts, local
restore evidence and field inventory before export. The source exporter is
read-only and permits only `careerops_prod_restore_validation` or
`careerops_qa_restore_validation` on literal loopback with an expected server UUID,
non-root credentials and explicit-column SELECT. It exports only three tables.

```powershell
Invoke-QaDbTool -DbHost 127.0.0.1 -DbPort $SourcePort -DbUser $LocalSourceVerifier -DbName careerops_prod_restore_validation -ToolArgs @(
  'export-local','--schema','careerops_prod_restore_validation','--server-uuid',$SourceUuid,
  '--snapshot',"$Private\existing-local-prod-snapshot.sql",'--output',"$Private\local-export.json",'--connect-stdin')
node scripts/qa-refresh.js sanitize --input "$Private\local-export.json" --orphans 44 --output "$Private\sanitized.json" --orphan-audit "$Private\orphan-audit.json"
```

The snapshot hash is bound to measured local restore metadata, but a checksum
alone cannot prove a DB was restored from that file. The owner must attest that
provenance using their isolated restore log. Record `sanitized.source.snapshotSha256`
in manifest.source.snapshotSha256; use `digest(sanitized.source)` for
manifest.source.restoreEvidenceSha256. Keep the source restore evidence and orphan
audit privately. Do not copy the raw export into QA. If input metadata differs
from supported policy, stop and review code/schema rather than ignoring columns.

Every actual field must appear once in `privacy.reviewedFields[table]`, using its
exact column name. Owner approval is required even for deterministic transformations:

| Field category | Implemented QA value | Review concern |
| --- | --- | --- |
| id / report_id / recruiter_tracker_id | Positive integer retained, validated unique relationships | IDs/relationship patterns can be identifying; review or require a separately reviewed remap |
| recruiter_name / company | Recruiter `<id>` / Company `<id>` | No original names, including company free text |
| phone/email/address/notes/website/location/requisition_id | NULL | Nullable schema required; no partial regex-only redaction |
| comp_range/role_level/role_type | NULL | Owner approves loss of realism; incompatible NOT NULL/enum stops |
| industry | QA when source non-null, otherwise NULL | Preserves non-null count, not original category values; 420 is historical expectation |
| status/relationship_status | New | Must fit actual enum/constraints; owner reviews UI realism |
| reported_to_unemployment | No | Never copy original employment-report status |
| date_contacted / follow_up_date / date_reported | 2000-01-01 / NULL / NULL | Do not retain real contact/report dates |
| week_start/week_end | Synthetic weeks derived from report ID | Preserves report uniqueness; review ID linkage |
| submitted / submitted_at | 0 / NULL | No original submission state/timestamps |
| created_at / updated_at (where supported) | 2000-01-01 00:00:00 | No real audit timestamps |

Only fields supported for each particular table are allowed; see
`src/qaDataset.js`. This is a conservative synthetic policy, **not a completed
privacy determination**. Unknown/extra fields, incomplete review, unmasked values,
zero counts, duplicate keys and orphan mismatches fail closed. Excluded tables
never enter the source bundle. The 44 orphan keys remain only in the separate
restricted audit. Redaction verification compares every cell with its deterministic
policy, not just email/phone patterns. Industry width is checked against actual
values, with bidirectional column checks. The sole allowed omitted column is a
target-only recruiter_tracker.date_reported that is nullable, NULL-default and
not generated. Other differences stop. No INSERT SELECT *, stored procedure or
DELIMITER is used.

## Gates 2a / 2b: offline plan, forced rollback, explicit commit

Before planning, verify rollback readiness: the QA backup is less than 24 hours old,
its private file exists and matches SHA256, the isolated restore passed, writers
are quiesced, maintenance approval is current, and the recovery owner is available.
Planning and every connected run revalidate recovery evidence. A privileged DBA
must independently review cross-schema inbound foreign keys and external writers,
and approve `rollback.dependencyReviewApproved`: a deliberately schema-restricted
account cannot prove the absence of dependencies hidden in other schemas. Visible
unknown dependencies still stop automatically. Restore/rehearsal
receipts and approvals are trusted protected artifacts, not self-issued proof of
independent authorization.

```powershell
node scripts/qa-refresh.js plan --bundle "$Private\sanitized.json" --manifest "$Private\manifest.json" --audit "$Private\qa-before.json" --backup "$Private\qa.sql" --restore "$Private\restore.json" --output "$Private\plan.json"
```

MySQL does **not** roll back AUTO_INCREMENT advances. Therefore every explicit
staged ID must be **below** the target table's existing AUTO_INCREMENT high-water
value, including any contact ID. Empty QA with a counter of 1 will fail this gate.
If necessary, an owner must separately authorize counter reservation in a distinct
schema-maintenance step, take a **new backup/restore/audit** afterwards, and replan.
The tool never issues ALTER, DDL, TRUNCATE or FOREIGN_KEY_CHECKS changes. This is a
real blocker, not permission for a script to adjust counters. Do not run DDL in a
refresh transaction. Account for any external workers that could consume IDs.

Review the exact plan hash and independently issue a `rehearse` approval:

```powershell
Invoke-QaDbTool -DbHost $QaHost -DbPort $QaPort -DbUser $QaUser -DbName careerops_qa -ToolArgs @(
  'rehearse','--plan',"$Private\plan.json",'--backup',"$Private\qa.sql",'--approval',"$Private\rehearse-approval.json",
  '--output',"$Private\rehearsal.json",'--connect-stdin')
# ONLY after a separate owner decision: operation=commit, same exact plan hash:
Invoke-QaDbTool -DbHost $QaHost -DbPort $QaPort -DbUser $QaUser -DbName careerops_qa -ToolArgs @(
  'commit','--plan',"$Private\plan.json",'--backup',"$Private\qa.sql",'--approval',"$Private\commit-approval.json",
  '--rehearsal',"$Private\rehearsal.json",'--output',"$Private\commit-receipt.json",'--connect-stdin')
```

A rehearsal receipt must say rolled-back, match plan+target state, and be no older
than an hour. The code locks all target table rows/ranges with SERIALIZABLE / FOR
UPDATE in one connection, rechecks the exact backed-up state, deletes child-first,
inserts parents-first with parameters and explicit columns, checks warning/affected
row counts, exact resulting content and counts, referential integrity, retained
table digests and counters, then rolls back by default and verifies original state.
Commit is a separate mode with separate approval. Every error after BEGIN attempts
ROLLBACK before disconnect; failed rollback destroys the connection and requires
operator recovery. Count failures cannot fall through to COMMIT.

Never retry blindly after a timeout, lost COMMIT acknowledgement, an in-progress
receipt, or a receipt write failure. A disconnected client cannot prove whether a
COMMIT reached MySQL. Keep writers stopped and reconcile actual target state with
the plan and backup via separately approved read-only inspection. Rollback failure
or uncertain commit outcome needs owner incident review, not an automatic restore.
Once committed, reversal is a new approved QA recovery operation using the verified
backup; there is no automatic destructive restore switch.

## Gate 3: deployment and manual QA verification

Keep Railway automatic deployment for this feature branch disabled; draft PR is
not deployment approval. Review diff and CI, then separately authorize an exact
code version. After checking the installed CLI's flags and the selected QA app:

```powershell
# OWNER APPROVAL REQUIRED: service deployment, no DB refresh implied.
railway link --project $QaProjectId --environment $QaEnvironmentId --service $QaServiceId
railway status --json
railway up --environment $QaEnvironmentId --service $QaServiceId --detach
```

Run `railway up --help` first and stop if the installed CLI differs. Link the
approved source checkout to the independently verified QA project and verify
`status` immediately before deployment. Ensure the source checkout is the
approved commit and the Railway build/start commands select APP_ENV=qa. Missing
schemas, permissions, TLS or runtime variables require separate approvals; do not
resolve startup errors by selecting production/test mode or copying PROD credentials.
Code rollback uses the previously approved QA deployment/version through Railway's
owner-reviewed rollback action; it does not reverse database refresh. Keep both
previous code version and backup/restore evidence available before deployment.

After the separately approved deployment/refresh, record actual observations:

- /version says qa and the approved full commit; no DB/credential details exposed.
- Actual QA login/logout and protected endpoints behave correctly. Existing QA users
  and password hashes remain unchanged; no PROD user/session imported.
- Recruiter/dashboard/contact/search and Contact Status work. If the owner approved
  the historical source, expect 1,133 recruiters, 204 report contacts, 59 weekly
  reports and 420 non-null industry values; otherwise record approved actual counts.
- Industry chart reflects the approved synthetic policy (QA category), company
  search finds synthetic companies, report detail/export works, date_reported NULL
  is accepted, no orphan references exist. Synthetic report dates are not real dates.
- Quality Gate History loads existing **QA** history (possibly legitimately empty)
  without 500. No PROD validation runs are imported.
- Session Activity Trend returns 12 contiguous two-hour UTC buckets for 24 elapsed
  hours; empty QA activity shows zeros, not HTTP 500. Verify configured source
  timezone independently. Heartbeats and visitor analytics belong only to QA.
- Verify nonadmin/anonymous access boundaries, admin diagnostics, no session/payload
  or SQL values in QA logs, and DEV strict configuration still passes offline tests.
- DEV and PROD regression evidence is code/mocks here; this task performed no live
  smoke check. Stop traffic/reopen owner review if any item fails.

## Separately controlled compromised credential rotation

Treat the previously disclosed PROD root credentials as compromised. Do not paste,
retrieve, reuse, test or rotate them in this task. Owner/security operator should:

1. Review exposure/audit logs, account scope, active connections, dependent services
   and backups privately. Schedule a maintenance window and define rollback access
   without storing the old secret in tickets/chat.
2. Verify a fresh restricted application credential and recovery/admin path in the
   intended environment. Keep QA/DEV isolated and inventory all secret references.
3. In a separately approved session, rotate/revoke the compromised account via the
   approved Railway/MySQL administrative process; update secret stores, redeploy
   only authorized dependent services, invalidate old sessions/tokens as appropriate.
4. Verify new access and denied old access without logging values; inspect logs,
   revoke broad grants, remove residual copies from approved secret locations and
   record nonsecret completion evidence. Any emergency reversal requires explicit
   owner approval and must not restore a known compromised credential.

No rotation, deployment, real QA import, migration, secret/environment file or SQL
snapshot is included in the PR. Private artifacts require owner-defined retention,
encryption, access review and secure deletion after the recovery window.
