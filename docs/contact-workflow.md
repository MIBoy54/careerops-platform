# Employer contact workflow

Role remains free text in `role_level`. The three independent, nullable fields are:

| UI field | API / SQL field | Values |
| --- | --- | --- |
| Role Type | `role_category` | Consultant, Individual Contributor, Leadership |
| Hiring Workflow | `hiring_stage` | Applied, Recruiter Interview, Submitted, HR Interview, Hiring Interview |
| Position Status | `position_status` | Awaiting Decision, On-hold, Rejected, Closed, Hired |

Relationship Status remains separate. New forms default to Applied and Awaiting
Decision. Loading an existing record replaces these defaults with its stored
values, including blanks. Previous category and status remain visible for review.

## API compatibility and reporting

POST and PUT validate the canonical choices and return 400 for invalid values.
An omitted canonical field on PUT preserves its value; null or blank explicitly
clears it. Legacy `role_type` and `status` remain stored and are preserved when
omitted by the new UI. Older-client creates derive only known facts using the
same mapping as migration. Explicit canonical clears override derived defaults.
New-client creates also populate a coarse legacy status for older readers;
subsequent canonical edits do not rewrite historical legacy evidence.

Hiring Workflow Submitted does not mark a contact as reported to unemployment.
The existing explicit legacy `status: Submitted` update behavior remains for
older clients. Report creation remains the explicit reporting operation.

Contact JSON, selected-contact details, report details, and CSV exports include
all three canonical fields. CSV labels distinguish previous category/status from
the canonical fields. DEMO snapshots include the new fields under the existing
privacy allowlist and remain read-only. Snapshot source SELECT grants already
cover these columns; no broader grants are required.

Dashboard and Contact Status use the same independent distributions: hiring stage,
position status, and reporting. Each distribution sums to all saved records, including
reported records and records with matching company/date values. Unknown or explicitly
cleared fields are Unclassified; only absent canonical fields use unambiguous legacy
mappings. Legacy Offer/Accepted remain historical details, never inferred as Hired.

Contact Status defaults to All records. Stage, position and reporting filters combine;
Showing X of Y reflects the filtered table while summary totals remain global.
Reported records remain visible but cannot be selected for another weekly report.
Sorting uses displayed dimensions, calendar dates, and deterministic company/ID ties.
Only the active column displays a direction arrow; header buttons support keyboard use.

Validation: npm test; npx playwright test --config tests/status-view/playwright.config.js.
The focused browser check serves repository assets and mocked API responses, requiring
no database, production access, or saved credentials.

## Additive database migration

`src/contactWorkflowMigration.js` exports `inspectContactWorkflow(connection,
expectedDatabase)` and `migrateContactWorkflow(connection, options)` for an
operator-owned mysql2 connection. Inspect first. Apply requires both the exact
expected database and confirmation `add-contact-workflow:<database>`.
Never log connection secrets or contact rows.

The migration checks database identity and existing column types. It adds only
missing nullable VARCHAR columns (32, 40, 40 respectively) using MySQL
`ALGORITHM=INSTANT`, with bounded metadata/row lock waits. There is no table-copy
fallback. Incompatible schemas or lock failures stop promotion.

Only columns newly added by that invocation are backfilled:

- Exact case/space-normalized Consultant, Individual Contributor, and Leadership
  map to Role Type.
- Applied and Submitted map to their corresponding Hiring Workflow stage.
- Awaiting decision, On hold/On-hold, Rejected, Closed, and Hired map to Position
  Status.
- Interviewing, Offer, Accepted, and other ambiguous legacy values remain null.

The backfill transaction locks legacy rows, hashes id/category/status before and
after, and refuses to commit if that evidence changes. Other legacy fields and
report relationships are never updated. Rerunning with existing columns does
not repeat the backfill, so explicit clears and later classifications survive.
MySQL DDL commits separately: if backfill fails after columns are added, retain
the nullable columns, inspect the failure, and review recovery explicitly. Do
not drop columns or automatically classify existing nulls to retry.

Apply and verify in DEV, QA, DEMO, then PROD before each environment runs code
that selects the new columns. The old application tolerates added columns;
application rollback retains all columns and values. Do not use a destructive
schema rollback. For active DEMO snapshots, migrate PROD before deploying its
updated snapshot source; new DEMO can read an older source with missing fields
as null during the staged rollout.

## Validation

`tests/regression/contactWorkflowMigration.test.js` exercises real isolated
MySQL migration, preservation, rerun, mismatch, and rollback behavior. Run via
`scripts/test-workflow-migration.sh` with the owned disposable fixture container
`careerops-trend-dev-test`. It never connects to application databases.

`npx playwright test --config tests/workflow.playwright.config.js --workers=1`
checks owner create/edit/filter, ambiguous legacy preservation, and guest
read-only behavior in a separate synthetic server. Unit/HTTP tests cover
validation, omission, explicit clears, legacy compatibility, bucket counts,
CSV privacy, and protected snapshot projection.

## Interview dates and automatic aging

Run the additive workflow date migration before deploying this revision to any
environment with a contact database. On an operator-owned mysql2 connection,
call the exported migrateWorkflowDates function in src/contactWorkflowDatesMigration.js
with the verified database name and confirmation add-workflow-dates:<database>.
It adds nullable stage_entered_at and interview_date columns with no backfill.
For the protected DEMO snapshot, migrate the PROD source database before
deploying the source. The consumer accepts snapshots from the previous source.

The app records UTC stage entry on a new contact and when the stage changes.
Existing contacts with unknown stage entry remain undated. Interview Date is
entered separately. Interview results are newest first with undated rows last.
An authenticated owner can update only Position Status from the results.
DEMO guests can view the results.

After validating the deployment, set CONTACT_GHOSTING_ENABLED=true in PROD to
enable hourly aging. The update applies only to Awaiting Decision at 60 days
in Applied or 45 days in Submitted. Null stage-entry dates are ineligible.
