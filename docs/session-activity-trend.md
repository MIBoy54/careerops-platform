# Session Activity Trend (DEV)

This report counts unique session IDs at their earliest recorded `first_seen` across
`visitor_analytics`. Repeated rows do not create new session starts. Recording,
other telemetry metrics, and database schemas are unchanged.

`GET /api/analytics/session-trend` retains `requireAuth` and returns a UTC reporting
window and twelve chronological two-hour buckets. One MySQL `UTC_TIMESTAMP(6)`
anchors the whole query. Intervals are start-inclusive and end-exclusive. Missing
activity produces zero counts. The browser localizes complete timestamps in its
own IANA timezone and displays dates, zone names, counts, and the endpoint instant.
“Now” means the reporting instant of the latest successful response, not a browser
clock reading. The existing sixty-second refresh is retained.

## Required DEV configuration

Set `SESSION_TREND_SOURCE_TIME_ZONE` to the **verified timezone used to record
historical `first_seen` DATETIME values**. It has no default: missing configuration
or unavailable MySQL timezone conversion produces an explicit HTTP 500 and a
visible chart error, rather than misleading zero activity.

For genuinely UTC historical values, use `+00:00`. For a fixed-offset historical
convention, use that verified offset. For regional wall-clock values, use the
verified IANA name; MySQL must already have the corresponding timezone tables.
Do not rewrite timestamps or change global pool/session timezone settings for this
report. No configuration was applied to a CareerOps runtime during implementation.

Mixed historical timezone conventions cannot be recovered automatically. Regional
DATETIME values during a repeated DST hour are inherently ambiguous without a
stored offset. This implementation does not invent that missing information.

The query groups historical rows by session ID before filtering the starts. This
prevents repeat page-load rows from becoming new starts, but may require a full
historical scan; evaluate performance on DEV before promotion. No index or schema
changes are included.

## Regression checks

- `npm test`: existing unit tests plus API handler contract/error tests.
- `npm run test:session-trend`: API and Chromium rendering tests. Requires Chromium
  at `/usr/bin/chromium`, or set `CHROMIUM_PATH` to an installed executable.
- SQL checks are opt-in via `SESSION_TREND_TEST_MYSQL=1 npm run test:session-trend`.
  They require a disposable MySQL 8 container named `careerops-trend-dev-test` on
  the local Docker socket. Tests inject synthetic records as CTEs, create no tables,
  and never connect to a CareerOps database. Run it with network disabled:
  `docker run --detach --rm --name careerops-trend-dev-test --network none -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8.4`.
  Stop the disposable container after testing.

The API response changed from sparse `{hour, sessions}` rows to an object containing
`metric`, `time_zone`, `source_time_zone`, `window_start`, `window_end`,
`interval_hours`, and `buckets: [{start, end, sessions}]`. The chart consumer was
updated together with the endpoint. Any external consumers need the new contract.
