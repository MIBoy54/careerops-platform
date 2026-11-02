# DEMO entry-time protected PROD view

DEMO is a protected view of LIVE PROD business data. It is not a synthetic-only
deployment. Each visitor explicitly chooses Continue as Guest to create a new
server-issued session and a protected snapshot. Contacts, report history and
report/contact links are captured together under an InnoDB repeatable-read,
read-only transaction, then published atomically. The displayed capture timestamp
is the source transaction's UTC timestamp, formatted with the visitor's timezone.
It is distinct from the fixed dashboard creation date.

Reloads and other tabs in the same browser session reuse the same snapshot.
A new Continue as Guest entry replaces that browser's old session and creates a
fresh capture; other visitors are unaffected. Filters and selections are local
page state and never write to PROD. They reset on a full page reload.
Snapshots expire after one hour. Expiry, application restart, or a missing
snapshot requires explicit guest re-entry; requests never silently capture again
or fall back to the shared DEMO business tables.

## Data and permissions

The source selects only allowlisted business columns. Notes, recruiter identity,
phone, email, address, website and unknown fields are excluded before transfer
and storage. Recruiter labels become Protected contact. Company/job/status/date
fields and report links remain available. This is a conservative protection
policy; approve additional fields explicitly rather than broadening SELECT *.
Contact exports use the same snapshot and protect CSV formula cells.
Company search/details also use the same frozen data. Existing restricted
unemployment export/report routes remain restricted.

Business writes and administration remain blocked for guests. Visitor telemetry
continues to use DEMO's own database; operational analytics and GitHub CI status
are live operational information, not frozen PROD business data. PROD business
credentials are never supplied to the DEMO app or browser.

## Opt-in activation plan (not yet applied)

The implementation is disabled by default. Existing shared refresh behavior
remains until explicitly enabled. Do not label that legacy mode as entry-time.

1. Review the protected field projection and capacity/expiry choices.
2. Provision a distinct PROD database identity with only SELECT on the three
   tables railway.recruiter_tracker, railway.weekly_reports, and
   railway.report_job_contacts. No schema-wide, global, write, role, or grant
   privileges. Startup verifies the exact grant allowlist and requires all three source tables
   to use InnoDB.
3. Generate a random server-to-server DEMO_SNAPSHOT_TOKEN (at least 32 bytes).
   Keep it in Railway secret variables, never Git, browser configuration or logs.
4. Promote source through DEVELOP -> QA -> DEMO -> main using the existing unit,
   browser, SQL and deployment checks. Keep the feature disabled throughout.
5. Configure PROD with DEMO_ENTRY_SNAPSHOT_ENABLED=true, DEMO_SNAPSHOT_TOKEN,
   DEMO_SNAPSHOT_DB_USER and DEMO_SNAPSHOT_DB_PASSWORD for the read-only identity.
   Confirm its authenticated /internal/demo-snapshot source first.
6. Configure DEMO with DEMO_ENTRY_SNAPSHOT_ENABLED=true, the same token, and
   DEMO_SNAPSHOT_SOURCE_URL=https://careerops-platform-production-0cc7.up.railway.app/internal/demo-snapshot.
   Existing DEMO DB bindings stay isolated for telemetry. Source redirects are
   refused and capture errors have no fallback.
7. Verify two browser sessions across a controlled PROD change: A stays fixed,
   B sees the change; timestamps, company lookup, reports and exports agree;
   direct guest write/admin requests fail; protected fields never reach responses.
   Use reviewed synthetic canary records for this acceptance check, not edits to
   existing LIVE business records.

## Capacity and rollout limits

One app process owns the snapshot store: one-hour TTL, 100 active/pending
snapshots, 64 MiB combined storage, 8 MiB per snapshot, and 50,000 rows per table.
New entries are refused at capacity rather than evicting active guests.
Creation is limited to a burst of 10 with one new credit per second per process.
The source permits at most four simultaneous captures; transactions and fetches
are bounded to 10 seconds. These are initial conservative limits, not a load-test
capacity claim. An expired snapshot is purged on the next store operation.

Current deployment has one replica. Multiple DEMO replicas require a shared,
access-controlled TTL store (or guaranteed session affinity) before enabling this
feature. Process restart ends guest views; re-entry creates fresh data. No Redis
or additional infrastructure is silently installed.

Rollback: disable the DEMO feature flag and redeploy to restore the previously
verified shared DEMO view. Disable the PROD source flag and revoke/rotate the
new source identity/token if abandoning the rollout. No production business data
is changed by capture. Neither activation nor new PROD credentials were applied
during DEV implementation.

## Review and remaining enabled-flow acceptance

Independent Codex source review found no clear blocking access-control defect.
Before activation, complete browser tests against the enabled deployed server,
HTTP expiry/concurrent entry/logout-during-capture/restart checks, source timeout
and disconnection checks, and protected-field content review. Text accidentally
entered in allowed company/location/status fields is not automatically anonymized.
The 64 MiB limit measures retained JSON, not total process memory including
pending fetches, parsing and serialization. Load testing remains required.

## November 2 local acceptance

Added real HTTP checks for expiry without recapture, independent simultaneous
visitors completing out of order, restart requiring explicit re-entry, and
source disconnect/timeout/invalid-payload/unavailable responses. Source-failure
cases inject failures at the fetch boundary; they do not constitute a deployed
network timeout test. Shared business tables are never used as a fallback.

A dropped in-flight session now cancels publication. Its pending capacity stays
reserved until the bounded source request settles, then becomes available again.

Run the enabled desktop/mobile browser acceptance against the actual Express
application (synthetic source and mocked database infrastructure) with
SNAPSHOT_BROWSER_ACCEPTANCE=1 and tests/unit/environmentRoutes.test.js. This is
local integration acceptance; deployed TLS/source handshake, real read-only
grants, protected free-text review and deployment capacity checks remain rollout
requirements.
