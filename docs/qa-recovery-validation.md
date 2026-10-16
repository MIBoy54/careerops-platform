# QA recovery: exact verification and separate-instance plan

This focused follow-up addresses the [October 16 recovery finding on PR #77](https://github.com/MIBoy54/careerops-platform/pull/77#issuecomment-6221226394).
The owner reports a preliminary QA logical backup restored into a separate schema
on an **existing local MySQL instance**: eight expected tables, 686 total rows,
65 columns and 10 indexes. Preserve that backup, schema, logs and validation output.
Those totals establish preliminary import success, not exact recovery or instance
isolation. A fresh quiesced source baseline, exact DDL/data comparisons and an
independently provisioned restore server remain outstanding. No live database
operation, configuration/grant/counter change, refresh or deployment is authorized
by this document or by an offline report. PR #77 remains draft targeting dev.

## 1. Preserve every existing artifact first

Do not open real dumps/data files in chat, git, CI or debug output. Do not rerun a
backup over its original filename, edit a dump for compatibility, rewrite its
manifest, reuse its receipt, drop/alter its preliminary restore schema, or reuse
its existing server's data directory. Do not rename, move, truncate or delete any
existing backup/validation artifacts. Existing same-instance restore evidence stays
labelled **preliminary / separate schema only**, never upgraded in place to a
separate-instance receipt.

In the owner-approved private encrypted directory, create a NEW review directory
with exclusive creation and restricted ACLs. Keep a preservation ledger of the
owner-specified existing artifact paths, sizes, SHA256 and UTC last-write times,
including dumps, original manifests, source/restore DDL, logs, checksums and earlier
validation reports. Do not recursively scan unrelated private files. For example,
these PowerShell commands only hash the explicitly supplied artifact list:

```powershell
# Owner supplies exact existing paths; do not point this at the repository.
$Review = 'C:\CareerOpsPrivate\qa-recovery-NEW_CHANGE_ID'
if (Test-Path $Review) { throw 'Use a fresh review directory' }
New-Item -ItemType Directory -Path $Review -ErrorAction Stop
icacls $Review /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F"
$ledger = foreach ($path in $ExistingArtifactPaths) {
  $item = Get-Item -LiteralPath $path -ErrorAction Stop
  if ($item.PSIsContainer) { throw 'Explicit artifact files only' }
  [pscustomobject]@{Path=$item.FullName; Bytes=$item.Length;
    Sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash;
    LastWriteUtc=$item.LastWriteTimeUtc.ToString('o')}
}
# NEW file only; no existing backup/validation artifact is rewritten.
$ledgerBytes = [Text.UTF8Encoding]::new($false).GetBytes(($ledger | ConvertTo-Json -Depth 4))
$stream = [IO.File]::Open("$Review\preservation-ledger.json", [IO.FileMode]::CreateNew)
try { $stream.Write($ledgerBytes,0,$ledgerBytes.Length) } finally { $stream.Dispose() }
```

Keep the full ledger private; only its hash belongs in metadata review. Recheck
sizes/hashes/times after the review. Generated files use new names in the new
review directory. Any changed/missing original stops the review; do not repair or
replace it silently. Additional working copies, if separately approved, get their
own filenames/checksums and never supersede originals.

## 2. Establish a quiesced source and exact per-table evidence

This is an owner-only future collection plan, **not permission for Codex to connect**.
The prior backup cannot retrospectively prove quiescence if no matching source
baseline exists. A new baseline/export, if needed, requires separate approval and
new artifact names. Pause all approved app/worker/cron/browser/heartbeat writers
and schema maintenance for the full capture/export interval. Capture a consistent
source transaction and full schema/row/counter evidence immediately before and
after export. Changed telemetry or DDL invalidates the baseline. Do not substitute
the historical 686 rows for current quiesced counts or import PROD history.

Collect both source QA and restored QA for exactly these reported eight tables:
analytics_heartbeat_events, demo_refresh_history, recruiter_tracker,
report_job_contacts, users, validation_runs, visitor_analytics, weekly_reports.
Unexpected/missing tables need renewed inventory review. Capture each table's:

- Exact `SHOW CREATE TABLE` output, including columns in ordinal order, types,
  precision, charset/collation, nullability, literal/expression defaults, EXTRA,
  generated/update clauses, PK/unique/secondary/functional/invisible indexes,
  prefix lengths/order, CHECK/FK definitions/actions, engine and table options.
- Per-table column/index counts and full index definitions. Ten aggregate indexes
  can hide a missing index on one table and an extra/wrong index on another.
- Exact AUTO_INCREMENT and fresh engine metadata. Do not ignore increases simply
  because the basic validator permits counter nonregression. No counter changes
  are authorized as part of verification.
- Row count AND a deterministic content digest covering every column of every row,
  including users/password hashes, sessions/telemetry and empty DEMO history.
  Compare a typed, length-delimited, stable-row-order/multiset representation using
  an independently reviewed procedure. Distinguish NULL from empty string, binary
  bytes from text, exact decimal/BIGINT values, Unicode and timestamp precision.
  Record timezone/SQL mode/character encoding and the hash of the comparison method.
  Do not hash only primary IDs, use server CHECKSUM TABLE as sole proof, concatenate
  ambiguous values, coerce dates/numbers lossily, omit free text, sample, or compare
  totals alone. Raw records and comparison outputs stay private.

Owner-only read-only query templates (after independent identity approval):

```sql
SELECT DATABASE(), CURRENT_USER(), @@server_uuid, VERSION(), @@version_comment;
SELECT @@SESSION.time_zone, @@SESSION.sql_mode, @@SESSION.character_set_results;
-- Repeat for EACH verified table in BOTH source and restore sessions:
SHOW CREATE TABLE `users`;
SHOW INDEX FROM `users`;
SELECT COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
       EXTRA, CHARACTER_SET_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' ORDER BY ORDINAL_POSITION;
SELECT COUNT(*) FROM `users`;
```

Full content hashing needs an approved local comparison procedure; no real data
export or content collector is run by this PR follow-up. Session-only metadata
freshness/UTC settings may be needed but require the separately approved collection
procedure; this task changes no configuration. Administrator inventory must cover
server-wide inbound/outbound dependencies and objects that restricted app accounts
cannot see. Console root and selected schema are not proof of the app's session.

Hash the UTF-8 bytes of the server-returned `Create Table` column value, excluding
client headers/framing, without rewriting SQL or line endings. Keep the raw
collector output separately. Metadata SHA256 strings use lowercase hexadecimal.

Keep exact DDL hashes separate from PR #77's normalized `definitionHash`: the
existing inspector removes the AUTO_INCREMENT table option, and `validateRestore`
allows nonregressing counters. Those checks are useful but **not exact DDL/counter
proof**. Compare raw source/restore DDL first. Any schema-name qualification or
cross-version formatting difference needs a recorded, reviewed, narrowly scoped
explanation and independent structural comparison. Never use broad string replace,
ignore all defaults/collations, strip counters, edit either dump/schema, or label
a normalized equality as an exact match. The offline exact review remains blocked
when raw DDL differs; do not manufacture matching hashes to bypass that result.

## 3. Restore on an independently provisioned local instance

A different schema, port, login path, client session or container name alone does
not prove isolation. Before any new restore, owner approval must identify a NEW
local MySQL process/container with a dedicated empty data directory/storage volume,
separate endpoint, fresh server UUID and no application connections. Independently
inventory QA's UUID, every existing local DEV/restore instance's UUID, data directory,
process/container ID, endpoint and version. Compare the new UUID case-insensitively
against ALL of them; copied auto.cnf/data directories can duplicate UUIDs.

Do not restore into the existing DEV server or the preliminary validation instance.
Do not copy/mount an existing database volume, alter its port/configuration, or
restart it. Provision a fresh instance using the exact approved version/digest and
an independent credential store. Bind only to loopback or use an isolated Unix
socket; block external networking and app access. Credentials are prompted or
supplied by an approved secret manager, never command arguments, git, environment
files or logs. Windows process/data-directory/port ownership and filesystem ACLs
must be checked independently; localhost does not establish instance separation.

The new instance may contain standard MySQL system schemas, but no existing user
application schemas/data. Restore the checksum-verified **working copy** of the
unchanged approved dump into a new `careerops_qa_restore_validation` schema only
after identity verification. Inspect privately for USE/database DDL, DEFINERs,
events/routines/triggers or paths that could redirect execution. Stop on every
client warning/error; no `--force`, DDL rewriting, automatic retries or privilege
workarounds. Record invocation, exit status and warnings privately, then collect
exact DDL/content evidence on that new instance. These are future operator steps:
this follow-up runs no MySQL client, server provisioning or real-data import.

Keep the preliminary restore intact while the separate-instance trial is reviewed.
No cleanup of an instance, schema, working copy or artifact occurs without a later
explicit retention/cleanup approval.

## 4. MySQL 9.6 → 9.7 is a compatibility trial, not proof of recovery

Record FOUR exact versions/builds independently: source server, mysqldump client,
import client and restore server. A dump header/client version does not establish
source-server version. The discovery prose does not establish these four roles;
do not infer them. A 9.6-source / 9.7-restore experiment is a forward-version trial;
a 9.6 client dumping a 9.7 server is a different, also unqualified scenario. A
successful cross-version import, matching totals, or a newer client alone certifies
neither. Do not reverse-import a newer dump into an older server as a fallback.

Obtain an authoritative isolated **same exact source-version** recovery trial first,
with matching qualified dump/import clients, preserving every original artifact.
Run any separately approved 9.6 → 9.7 trial in a second fresh instance with its own
working copies and reports. Review official exact-version support/upgrade paths,
authentication/TLS/mysql2/client behavior, removed variables/privileges, metadata
rendering, dump flags, SQL modes, collations, temporal/default semantics, index/CHECK/
FK behavior and UUID/counter persistence. Use identical reviewed session settings
for content comparison. Application behavior and rollback need their own tests.

The offline reviewer conservatively flags any source/server/dump/import version
mismatch or missing version, including 9.6 → 9.7. Even a matching same-version report
only invites owner review; it does not certify an upgrade or authorize anything.
Existing MySQL 8.4 CI regressions are not MySQL 9.6/9.7 qualification. Do not change
the source, global settings, grants or counters to make a trial succeed.

## 5. Non-executing metadata review

`src/qaRecoveryReview.js` accepts a private metadata object containing only hashes,
counts, versions, inventory and owner attestations. It imports no DB driver, reads
no files, spawns nothing and mutates no inputs. It compares exact per-table DDL,
content, counters and counts; checks before/after baseline, restored backup binding,
artifact preservation, version agreement and separation from existing local UUIDs.
It never returns restore.passed, planHash, an approval, commands or a closed gate.
A report cannot be substituted for the existing restore receipt or refresh plan.

The metadata contract is illustrated by the **invented** evidence builder in
`tests/unit/qaRecoveryReview.test.js`; do not copy test UUIDs/hashes/records into a
real attestation. `source.tables` and `restore.tables` each require all eight names,
with engine/kind, rowCount/columnCount/indexCount, exact ddlSha256/contentSha256 and
exact autoIncrement string or NULL. Raw DDL/digests must come from independently
reviewed collection artifacts, not screenshot totals. `contentMethodSha256` binds
the comparison method. `baseline.beforeStateSha256` and `afterStateSha256` must equal
`SHA256(UTF8(JSON.stringify(metadata.source.tables)))`, retaining the manifest
key order; do not hash pretty-printed/UTF-16 PowerShell output. Quiescence
and DDL freeze must also be attested. `artifacts` binds the backup checksum and preservation
ledger; `restore.backupSha256` must identify the actual file imported. Isolation
attestations include all existing local server UUIDs and independent new-instance,
data-directory, endpoint and inventory confirmation. These are trusted private
owner evidence, not cryptographically verified signatures or new measurements.

This optional command reads ONLY an already approved metadata JSON file, emits a
metadata review to stdout and performs no DB operation (no environment/secret file):

```powershell
node --input-type=module -e "import fs from 'node:fs'; import {reviewRecoveryEvidence} from './src/qaRecoveryReview.js'; try {console.log(JSON.stringify(reviewRecoveryEvidence(JSON.parse(fs.readFileSync(process.argv[1],'utf8'))),null,2))} catch {console.error('Invalid private recovery metadata'); process.exitCode=1}" "$Review\recovery-metadata.json"
```

Do not redirect over an existing report or artifact. Capture any desired new
report through an exclusively created file as in step 1. `readyForOwnerReview=true`
still has `authorizesOperations=false` and `gateClosed=false`; the owner must
review provenance, measurements and complete isolation independently. Preserve all
reported preliminary evidence regardless of blocked/matching results.

## Remaining separate owner approvals

1. Artifact inventory/preservation and fresh source read-only discovery/quiescence.
2. Any new QA backup/export and complete immutable source baseline, if existing
   evidence cannot establish exact recovery; no overwriting prior artifacts.
3. New separate-instance provisioning/credentials and local restore/comparison.
4. Exact-version recovery qualification and a separately scoped 9.6 → 9.7 trial.
5. Owner acceptance of exact DDL/content/counter evidence and recovery readiness.
6. Only subsequently: independently approved grant/account/configuration corrections,
   dataset privacy, counter preparation plus fresh backup/restore evidence, rollback
   rehearsal, distinct refresh commit, and QA deployment/smoke. All remain prohibited
   in this task. PROD credential rotation and cleanup/retention remain separate.

The broader [discovery runbook](qa-discovery-follow-up.md) and
[refresh runbook](qa-refresh-runbook.md) still apply. No existing gate is weakened
and the reported preliminary restore does not close the full recovery gate.
