# QA discovery follow-up: evidence and owner gates

This document addresses the owner's [issue #76 discovery](https://github.com/MIBoy54/careerops-platform/issues/76#issuecomment-6219827312)
and [PR #77 follow-up](https://github.com/MIBoy54/careerops-platform/pull/77#issuecomment-6219828132),
posted October 16, 2026. It records reported evidence, not a new live inspection.
The Codex follow-up changes code/docs/synthetic tests only. No Railway access,
SQL client, real backup, restore, refresh, grant/counter change, migration, merge
or deployment is authorized here. Operational commands below are for a separately
approved owner session, not commands executed by this change.

## Reported facts versus evidence still required

| Reported discovery | Effect on PR #77 | Exact evidence still needed, retained privately |
| --- | --- | --- |
| QA app and MySQL online; diagram connected | Availability indicators only | Actual approved app version, logs, authenticated API responses and error reproduction; successful database queries from the app's established connection |
| App declares APP_ENV=qa, DB_NAME=careerops_qa, DB_USER=careerops_qa_app | Correct declared intent; not proof of established session | Independently verified app project/environment/service UUIDs, DB service UUID and app-to-DB relationship; actual DB_HOST/PORT reference resolution without passwords; same app-process pool connection's DATABASE(), CURRENT_USER(), @@server_uuid and grants |
| Console root@%, selected railway; railway and careerops_qa both exist | Console account/database is not the app account/database | Compare physical server UUID to independent QA inventory, then prove app session selects careerops_qa with the expected app account; never infer this from root's console. Do not change the DB service's MYSQL_DATABASE=railway or rename/drop either schema |
| Eight InnoDB base tables, including demo_refresh_history | All seven required tables are reported present; eighth table is retained | Fresh full table list, SHOW CREATE TABLE, COLUMNS metadata, counts/content hashes, object engine/type and counters under quiescence; complete source and target DDL, including every field type/default/EXTRA/collation |
| Empty business tables; users=2, validation_runs=0, visitor_analytics=10, analytics_heartbeat_events=674, demo_refresh_history=0 | All 686 reported protected rows must survive; empty business tables are valid recovery inputs | Fresh quiesced counts and content digests for every table, before/after export, isolated restore, counter maintenance, rehearsal and commit; screenshot counts are not immutable baselines |
| All three business counters are 1 | Rehearsal and commit remain blocked | Maxima from every approved staged explicit ID, actual target counter types/high water, independent counter approval after tested backup/restore, then fresh post-maintenance recovery evidence |
| 20 recruiter / 4 contact / 5 report columns; industry VARCHAR(100); no date_reported; nullable contact created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Supported shape with exact schema matching; DEFAULT_GENERATED is permitted only for reviewed temporal CURRENT_TIMESTAMP defaults | Names/types/default precision/EXTRA/nullability/collation of all 29 columns. The synthetic shape does not establish unseen actual DDL. Explicitly resolve any extra source date_reported before staging; do not silently drop columns |
| No declared QA FKs; zero triggers/routines/events | Logical orphan checks still mandatory; object checks remain enabled | DBA review with visibility across the whole server for inbound/outbound cross-schema FKs, referential actions, events/routines/triggers and external writers; exact approved dependency evidence, not just an empty restricted-account query |
| App has schema ALL PRIVILEGES | Fail-closed startup and operational guard deliberately reject it | SHOW GRANTS FOR the actual authenticated app account, @@GLOBAL.partial_revokes, roles/global/table/column/proxy privileges and grant options. Separately approve correction; verify no unintended scope remains |
| MySQL 9.7 compatibility requested | Existing SQL engine regression covers MySQL 8.4, not 9.7 | Exact server VERSION()/version_comment, mysql and mysqldump versions, driver/TLS/authentication support, metadata/grant rendering and isolated same-version restore/rehearsal results. No claim that 8.4 tests certify 9.7 |

QA runtime now checks CURRENT_USER() on its own pool connection against configured
DB_USER as well as schema, server UUID, restricted grants and table readiness. It
emits only a generic failure, not account/host/password/session details. This does
not establish that the currently deployed app has the new code or correct bindings.
No public endpoint is added to expose identity. The authenticated username before
`@` must match; DBA must independently verify the host-specific account row,
reference wiring, credential ownership and any proxy/authentication mapping.

The app must receive explicit DB_* references for QA. The MySQL service's own
MYSQL_DATABASE variable is a distinct service setting: its value `railway` does
not override the app's selected schema. Do not copy native MYSQL* or DATABASE_URL
bindings into the app alongside DB_*: ambiguous app bindings still fail closed.
Keep DEV strict loading, current PROD mapping and Employer Contact Form unchanged.

## Operator sequence and separate approvals

Each numbered operational gate needs explicit owner approval. A receipt, screenshot,
existing issue, private counter report or draft PR does not approve later gates.
Use the private artifact/approval formats and secret-safe PowerShell helper in the
[main runbook](qa-refresh-runbook.md). No approval artifacts or real records belong
in git or CI. All DBA SQL below requires independently verified QA context; use
interactive login paths, never command-line passwords or connection URLs.

1. **Fresh discovery and quiescence.** Independently verify app/DB service UUIDs,
   endpoint, QA server UUID, account mapping, exact source/target DDL, compatibility,
   cross-schema dependencies and logs. Stop all app replicas/workers/heartbeats,
   cron jobs, browser sessions and other writers during the approved window. An
   app online badge or disabled UI does not quiesce database writers. Capture the
   quiesced state, not earlier counts. No new diagnostic deployment is authorized;
   if a same-pool identity attestation needs instrumentation, request a separate
   reviewed deployment instead of substituting a console root query.
2. **Initial QA backup and isolated restore.** Preserve all eight tables, including
   both auth users, telemetry and DEMO history, even when business counts are zero.
   Verify a complete checksum/schema/content/count/counter restore on a new local
   server before any grant or counter mutation. Resolve the bootstrap privilege
   constraint described below without weakening application checks.
3. **Least-privilege correction.** Review a specific account/scope grant diff and
   recovery access plan; apply only through the separately approved DBA session.
   Provisioning a dedicated backup account, if needed, is a separately approved
   grant/account change too. Reinspect actual app account semantics and inventory;
   take and validate a new baseline backup if the recovery policy requires it.
4. **Local source privacy and counter plan review.** Approve local snapshot
   provenance, every field, ID/relationship retention, exact source orphans and
   sanitized schema/counts. Produce an offline counter report backed by valid
   initial recovery evidence. No counters change at this gate.
5. **Counter preparation.** Owner approves the exact per-table proposed high water
   derived from the approved bundle, including contact IDs. Apply DDL only in a
   standalone maintenance step after tested backup/restore. Verify data/permissions/
   DDL except counters remain identical, then take a fresh complete backup and
   isolated restore/audit of the post-counter state. Old plans/receipts are stale.
6. **QA rollback rehearsal.** Separately approve the fresh exact refresh plan and
   temporary DML; successful original-state/counter/protected-data rollback must
   produce a recent matching receipt. No schema/grant/counter change in rehearsal.
7. **QA commit.** Separately approve commit for that exact plan/rehearsal, with
   writers still quiesced and recovery evidence valid. On ambiguous COMMIT result,
   reconcile under a read-only approval instead of retrying or restoring blindly.
8. **QA deployment and smoke.** Separately approve exact QA code version and
   deployment/rollback plan, then verify actual login, protected endpoints,
   dashboard/search/Contact Status, industry chart, QA validation history and 12
   two-hour UTC session buckets. Refresh does not promote code. Any schema,
   variable, credential or migration change is another explicitly scoped approval.

The separate controlled PROD compromised-root rotation procedure in the main
runbook remains independent; do not reuse, test or rotate that credential here.

## Initial backup bootstrap and dedicated backup accounts

The existing ALL PRIVILEGES app account is intentionally rejected by `inspect`
and `qa-backup.js execute`; counters of 1 do **not** block backup/restore validation.
Do not temporarily broaden or relax runtime grants to get a backup. If there is no
existing approved restricted QA backup account, initial recovery must use an
independently approved DBA-managed QA export or platform recovery procedure outside
the application's DML-only tooling. Do not alter grants first merely to make that
tool pass. If no such export/recovery path exists, gate 2 is blocked and grant
correction/counter changes must wait for an owner-approved recovery solution.

A dedicated backup principal keeps auth/telemetry read access out of routine
application operations and separates duties; its account/grants/lifecycle need
review. This version's backup wrapper permits only exact-schema SELECT/DML + USAGE
and deliberately refuses backup-administrative/global privileges. A preexisting
schema-SELECT-only backup account can fit the wrapper. If the exact server/client
requires SHOW VIEW, TRIGGER, LOCK TABLES, PROCESS, RELOAD, FLUSH_TABLES, BACKUP_ADMIN
or other capabilities, stop and review the requirement separately. Do not grant
those privileges to the runtime account and do not repurpose the wrapper as an
administrative backup bypass. Views/triggers/routines/events are not in the
reported inventory; discovery must confirm none before using skip-object options.

`--single-transaction`, `--no-tablespaces`, `--set-gtid-purged=OFF` and skipping
unapproved objects reduce requirements but are not proof of MySQL 9.7 compatibility.
Record capabilities from the exact client/server manual and an isolated same-version
trial. MySQL login-path files are obfuscated local credential stores and still need
restricted ACLs/encrypted storage. Full QA backups contain user hashes and telemetry:
never print/upload them. This PR does not create a real backup or approval file.

For an owner-approved DBA bootstrap export, the following is an explicit review
recipe, **not a fallback executed by the tool**. Set all variables from independent
QA inventory. The recovery account must already exist and be approved; it need
not be the app account. Never select PROD or trust the console's default schema:

```powershell
# Review client capabilities before approval; versions alone are not compatibility proof.
mysql.exe --version
mysqldump.exe --version
mysql_config_editor.exe set --login-path=qa-approved-recovery --host=$QaHost --port=$QaPort --user=$QaRecoveryUser --password
# Approved verified loopback SSH tunnel only. For direct TLS add VERIFY_IDENTITY
# and approved CA flags; do not disable TLS on a remote endpoint.
mysql.exe --no-defaults --login-path=qa-approved-recovery --protocol=TCP --host=$QaHost --port=$QaPort --user=$QaRecoveryUser --database=careerops_qa --execute="SELECT DATABASE(), CURRENT_USER(), @@server_uuid, VERSION(), @@version_comment, @@GLOBAL.partial_revokes; SHOW GRANTS FOR CURRENT_USER;"
# Owner reviews output privately and stops on any identity/capability mismatch.
# Preserve ALL eight tables; path must be new, ACL restricted, and outside git.
if (Test-Path "$Private\bootstrap-qa.sql") { throw 'Refusing overwrite' }
mysqldump.exe --no-defaults --login-path=qa-approved-recovery --protocol=TCP --host=$QaHost --port=$QaPort --user=$QaRecoveryUser --single-transaction --quick --hex-blob --set-gtid-purged=OFF --no-tablespaces --column-statistics=0 --skip-triggers --skip-routines --skip-events --result-file="$Private\bootstrap-qa.sql" careerops_qa
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; quarantine partial artifact' }
Get-FileHash "$Private\bootstrap-qa.sql" -Algorithm SHA256
```

All omitted privileged/full-inventory checks remain gate prerequisites, including
read-only DBA inspection of schema definitions and cross-schema dependencies.
Before and after export, capture per-table schema/counter/content digests under
quiescence; any drift invalidates the export baseline. Full admin grant outputs
may reveal sensitive account metadata: keep them private, not in application logs.
The bootstrap path needs a privileged, separately attested audit if the current
app account cannot run the strict inspector. It must use exactly the audit format
consumed by `validateRestore`/the CLI; do not fabricate restore.passed or turn an
unverified screenshot into a content hash. An owner-reviewed local adapter or
approved administrative process is required if that audit cannot be produced with
existing tools. This is an explicit remaining blocker, not an automatic bypass.

Use the main runbook's new-instance local restore procedure and `verify-restore`
with a non-root read-only local verifier. Empty business tables are accepted, but
all protected tables/counts/content/DDL/counters must compare. Recheck telemetry
quiescence before/after. Any real backup/restore execution requires owner approval.

## Least-privilege grant correction: DBA-only reviewed procedure

Prerequisites: gate 2 tested recovery, independently verified QA-only server and
app account, version/partial_revokes semantics, exact current grants, explicit
owner approval of the before/after diff, and an independent recovery/admin account
that will remain usable. `REVOKE`/`GRANT` implicitly commit; they are never inside
a refresh transaction. Save the original grants in restricted recovery evidence,
not git. Determine any supported role/default-role/proxy grants with a DBA; unknown
or inherited privileges stop this narrow procedure for a separate plan.

Read-only queries for the independently approved DBA session (no passwords):

```sql
SELECT DATABASE(), CURRENT_USER(), @@server_uuid, VERSION(), @@version_comment;
SELECT @@GLOBAL.partial_revokes;
SHOW GRANTS FOR 'careerops_qa_app'@'%';
-- DBA: also inventory host-specific account variants, roles, schema/table/column
-- grants and inbound/outbound dependencies across the entire server.
```

The reported app grant is ALL PRIVILEGES on `careerops_qa`.* without grant option.
Review the **exact scope spelling/pattern from SHOW GRANTS** before revoking. An
unescaped underscore in a schema grant under partial_revokes=OFF is a wildcard;
revoking a newly escaped spelling may leave the original wildcard grant intact.
Use the exact existing scope in the REVOKE, then grant the independently reviewed
literal QA scope. This example matches the reported original unescaped scope:

```sql
-- MUTATION: owner-reviewed standalone DBA operation, after tested recovery only.
-- Abort/revise if the actual original scope/account differs from this example.
REVOKE ALL PRIVILEGES ON `careerops_qa`.* FROM 'careerops_qa_app'@'%';
-- Choose ONE branch, based on independently measured partial_revokes:
-- OFF (0): escaped underscores identify only careerops_qa:
GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\_qa`.* TO 'careerops_qa_app'@'%';
-- ON (1): names are literal instead; use this INSTEAD of the preceding GRANT:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops_qa`.* TO 'careerops_qa_app'@'%';
SHOW GRANTS FOR 'careerops_qa_app'@'%';
```

Do not use global `REVOKE ALL ... FROM account`, alter other accounts or change
partial_revokes. Do not add WITH GRANT OPTION, roles or global privileges. If grant
option/global/role grants exist, this example is insufficient: stop for a reviewed
expanded correction, not silent continuation. Grant restoration in an incident is
a separate owner-approved rollback decision, not blindly replaying ALL PRIVILEGES.
No automatic grant execution or credential rotation is added.

Postchecks: effective app grants contain only global USAGE plus direct exact-QA
SELECT/INSERT/UPDATE/DELETE (with schema-wide SELECT for complete inventory).
Verify CURRENT_USER()/DATABASE()/server UUID and SHOW GRANTS **from the actual app
pool connection** after approved session recycling/restart; an admin `SHOW GRANTS
FOR ...` is useful but insufficient. Verify that original wildcard scopes are gone.
Preserve user/password data, schema, counters, other accounts and their permissions.
Stopping/restarting/deploying the app for session verification is separately gated.

## Counter preparation: derive, approve, apply, verify, re-backup

Counter planning is purely offline and has no SQL/client dependency. It requires
fresh checksum-verified backup + measured restore, approved sanitized data/field
review, compatible metadata and quiescence/dependency/recovery attestations.
Unlike a refresh plan, it reports low counters without approving their mutation:

```powershell
node scripts/qa-refresh.js counter-plan --bundle "$Private\sanitized.json" --manifest "$Private\manifest.json" --audit "$Private\qa-before.json" --backup "$Private\qa.sql" --restore "$Private\restore.json" --output "$Private\counter-readiness.json"
```

The report is private, exclusively created, and binds bundle hash, inventory hash,
target-state hash and backup checksum. It contains only per-table key maxima,
current/minimum/proposed counters and readiness, not source rows. It has no
`planHash` and cannot be used for rehearsal/commit. There is no `--execute` option.
All ordinary privacy/recovery/schema/count gates still apply. Refresh planning
continues to reject any non-ready counter; no bypass option is added.

For **each auto-increment business-table ID**, including report_job_contacts.id,
compute stagedMaximum from actual rows, minimumNextValue=stagedMaximum+1, and
proposedNextValue=max(current,minimumNextValue). Never use row count, a presumed
1,133/204/59 maximum or MAX(target.id) on empty tables. Check integer type capacity,
fresh counter metadata, external consumers and
version-specific engine behavior. Require measured global and actual maintenance/app
session auto_increment_increment=1 and auto_increment_offset=1 for this procedure;
nondefault values need a separate reviewed calculation/procedure, not max+1.
Before reading counters, the inspector disables information_schema statistics
caching for its session (`information_schema_stats_expiry=0`); unavailable settings
fail closed. The owner must do the same in the standalone maintenance session:

```sql
-- SESSION metadata freshness only; no table/counter/grant change.
SET SESSION information_schema_stats_expiry = 0;
SELECT @@GLOBAL.auto_increment_increment, @@GLOBAL.auto_increment_offset,
       @@SESSION.auto_increment_increment, @@SESSION.auto_increment_offset;
```

The tool uses BigInt for counter comparisons;
noninteger/zero metadata and exhausted integer capacity fail closed. The observed
counters=1 intentionally remain blockers until a separate owner session.

An owner must approve the report hash, exact three table/column maxima, proposed
values, quiescence, known MySQL version/DDL behavior and recovery access. Immediately
before DDL, compare live state to the report's backed-up target, including protected
content and current counters. If any difference appears, stop/re-backup/replan.
Use a QA schema-scoped DDL maintenance principal in the independently verified
server session; do not give ALTER to the runtime account. No automatic SQL is
generated. The following is a **review template**, not runnable until independently
substituted with per-table approved integers (never copy illustrative test values):

```sql
-- MUTATION: outside any DML transaction, AFTER tested backup/restore and approval.
-- Reverify SELECT DATABASE(), CURRENT_USER(), @@server_uuid immediately beforehand.
ALTER TABLE `careerops_qa`.`recruiter_tracker` AUTO_INCREMENT = <approved_recruiter_next_value>;
ALTER TABLE `careerops_qa`.`weekly_reports` AUTO_INCREMENT = <approved_report_next_value>;
ALTER TABLE `careerops_qa`.`report_job_contacts` AUTO_INCREMENT = <approved_contact_next_value>;
-- Stop immediately on an error. These statements implicitly commit individually.
SELECT TABLE_NAME, AUTO_INCREMENT FROM information_schema.TABLES
WHERE TABLE_SCHEMA='careerops_qa'
  AND TABLE_NAME IN ('recruiter_tracker','weekly_reports','report_job_contacts');
```

Skip a table already safely above its staged maximum; never lower a counter. ALTER
may lock/rebuild a table and partially succeed across tables. Verify actual values
are at least approved proposedNextValue and strictly exceed stagedMaximum; verify
all row counts/content hashes, table definitions except the approved table counter
option, constraints, grants and protected data remain unchanged. No dummy inserts,
TRUNCATE, stored procedure, rollback trick or FOREIGN_KEY_CHECKS workaround.
Do not insert source data at this gate. Failed/partial preparation needs an incident
review; do not blindly rerun or decrease successful high water marks.

Capture a fresh post-maintenance audit, full QA backup and isolated restore, with
counters verified not to regress. Regenerate manifest/restore evidence, offline
counter report and refresh plan. Neither the pre-counter backup nor old approvals
establish that this new state is rehearsal-ready. Keep the initial recovery point
as well; restoring it would reset counters and require renewed readiness review.

## Compatibility, schema and privacy limits

Nullable TIMESTAMP/DATETIME with an allowlisted created_at/updated_at/submitted_at
CURRENT_TIMESTAMP default may have EXTRA=DEFAULT_GENERATED. These are ordinary
columns whose values are still inserted explicitly using the deterministic privacy
policy. STORED/VIRTUAL GENERATED, ON UPDATE clauses, arbitrary default expressions,
other EXTRA strings and unclassified fields remain rejected. Exact temporal
precision/type/default/EXTRA/nullability/collation mismatches still stop planning.
Do not omit contact created_at to rely on the current clock. Validate session UTC
handling and timestamp precision in the isolated same-version trial. Full 29-column
metadata is still missing from the discovery prose; synthetic tests validate a
supported shape, not every unseen live default or constraint.

If source has date_reported but QA does not, the source-to-target missing-column
check fails. Prepare an explicitly reviewed source projection/export policy in a
separate code change rather than ignoring it or altering QA. A target-only nullable
NULL-default date_reported remains the sole documented extra-column exception.
Industry(100) matches the reported QA definition; size narrowing still checks actual
staged values. Default synthetic industry replaces labels with QA; preserving 420
non-null values is a historical expectation requiring owner review, not live proof.
No-FK schemas still run logical source and post-refresh orphan checks. Extra DEMO
history is excluded from staging and included in backup/restore/preservation checks,
even if empty; changing it or telemetry invalidates state-bound recovery evidence.

MySQL 9.7 remains an explicit compatibility blocker until exact-version evidence
exists. Test metadata access/rendering (including partial_revokes), grant parser,
SHOW CREATE TABLE fingerprint stability, transaction/strict-mode/locking behavior,
TIMESTAMP timezone/precision/defaults, counter persistence and dump/restore options
and information_schema_stats_expiry=0 on an isolated server of that exact version. Do not change global settings or turn
off guards when a capability is unavailable. Confirm mysql2/client authentication
and TLS support without logging credential values. Existing MySQL 8.4 regression
fixtures alone cannot certify another server version; this follow-up runs only
in-memory/offline synthetic tests and no SQL backup/refresh commands.
