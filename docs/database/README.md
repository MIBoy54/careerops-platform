# Database operations

Reviewed 2026-10-31 against baseline `7fc0fa9`.

## Environment and promotion

| Branch | APP_ENV | Database |
| --- | --- | --- |
| develop | dev | careerops_dev |
| qa | qa | careerops_qa |
| demo | demo | careerops_demo |
| main | production | railway |

Work proceeds DEV → QA → DEMO → PROD. Matching code does not mean matching
credentials or data. Use synthetic DEV data; verify each deployed account's
privileges and schema independently. See [deployment](../deployment.md).

## Implemented baseline

`database/schema/001_initial_schema.sql` creates these eight tables:

| Table | Purpose |
| --- | --- |
| recruiter_tracker | Recruiter/employer contacts and reporting status |
| weekly_reports | Reporting windows and submission state |
| report_job_contacts | Report/contact association |
| users | Accounts, bcrypt hashes, stored roles and login timestamps |
| validation_runs | Recorded validation execution |
| visitor_analytics | Session/page activity |
| analytics_heartbeat_events | Heartbeat events |
| demo_refresh_history | Snapshot refresh records |

This is the source baseline, not an independently verified production schema dump.
`002_recruiter_directory.sql` and `003_candidate_directory.sql` are empty files.
`database/migrations`, `database/procedures`, and `database/views` are also empty
regular files, not populated directories. Candidate/referral directories and an
analytics_heartbeat table must not be described as implemented baseline tables.

Root `migrations/001_add_role_to_users.sql` and
`002_add_industry_to_recruiter_tracker.sql` are historical ALTER scripts. The
baseline already has both columns; industry is VARCHAR(100) in the baseline but
VARCHAR(50) in the migration. Do not apply all SQL files in filename order.

## Guarded fresh local DEV setup

The persistent local DEV runtime is documented in [local DEV operations](../local-dev.md);
its restart/volume checks are separate from the earlier disposable fixtures. The following procedure is for a new, verified local MySQL instance,
not an existing deployment or upgrade. Use MySQL compatible with the baseline's
utf8mb4_0900_ai_ci collation; runtime validation used pinned MySQL 8.4.13.

1. Establish a local endpoint and verify SELECT @@server_uuid independently.
   Obtain separate provisioning credentials through secure local configuration.
2. Set ignored local configuration: APP_ENV=dev, DB_NAME=careerops_dev,
   DB_HOST=127.0.0.1 or ::1, verified DB_PORT, dedicated DB_USER/DB_PASSWORD,
   DEV_INSTANCE_ID, DEV_DB_ACCOUNT_HOST, and generated SESSION_SECRET.
   Do not inherit deployed/secondary bindings. Verify the actual matched MySQL
   account host: a Docker published port can alter client host matching.
3. Run npm run dev:bootstrap. It prompts securely for missing provisioning user,
   password, and careerops_dev@server-UUID confirmation. Do not put secrets in
   shell arguments/history. Remove provisioning secrets from the app environment.
4. Run npm run dev:create-user. Enter a synthetic @example.invalid email and
   a new confirmed login password different from the DB password.
5. Start npm run start:dev; verify health, authenticated role, safe contact/report
   behavior, and selected database. Restart invalidates sessions; log in again.

Bootstrap checks the reviewed baseline, instance identity, empty object metadata,
absence of the exact application account, and a cooperative MySQL advisory lock.
CREATE DATABASE without IF NOT EXISTS also refuses a pre-existing empty schema.
It imports and verifies the eight-table schema, creates the account, grants only
schema-wide SELECT/INSERT/UPDATE/DELETE, and verifies the matched app account.

With partial_revokes OFF the underscore is escaped in the schema-level grant;
with ON the literal schema is used. Unknown grant semantics and
NO_BACKSLASH_ESCAPES are rejected. See [isolation](../environment-isolation.md).

DDL is not transactional. A failure leaves partial resources for inspection;
never reset or silently rerun bootstrap against them. Duplicate synthetic login
creation refuses overwrite, including concurrent duplicate inserts. The scripts
are fresh-install tools, not migrations or production account-management tools.

## Changes, evidence, backup, and rollback

Review schema changes in version control, establish compatibility with each
stage's actual schema, validate migration/rollback on disposable DEV data, and
promote only after the stage gate. Database-name verification is not a substitute
for schema inspection or proof that QA credentials cannot access production.

Retain sanitized before/after evidence and exact revisions. Keep provisioning
secrets separate from application bindings and never commit .env or SQL dumps
containing personal data. Preserve at least the established 1.5 GB validation
reserve and clean up only resources owned by the run.

The legacy backup_careerops.bat hardcodes DB_NAME=careerops, while verified PROD
maps to railway. It is not a verified rollback strategy; reconcile and test a
restore procedure separately before relying on it. Application rollback does
not revert schema/data. No database is provisioned or changed by this doc refresh.
