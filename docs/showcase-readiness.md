# Showcase readiness and presentation script

Working assessment, 2026-11-01. Keep synthetic rehearsal results distinct from
live deployment checks. Do not display personal recruiter data or credentials.

## Primary journey (about three minutes)

1. Open the verified DEMO login page. Explain that guest access is passwordless
   and read-only for business data. Continue as Guest.
2. Identify the DEMO banner and open Saved Contacts. DEMO presents protected LIVE
   PROD data. With entry snapshots enabled, show Your DEMO snapshot and explain
   that the view stays fixed from entry. Review the protected-field policy before
   public presentation; never copy or expose raw private LIVE records.
3. Select contacts and open Detail Viewer. Show clear navigation back to Saved
   Contacts and demonstrate disabled actions when nothing is selected.
4. Open Weekly Report History and view an existing protected report. Explain that
   creation is demonstrated in DEV, while DEMO business writes are denied.
5. Show Quality Gate History as CI evidence, then /version as deployed build
   identity. They answer different questions.
6. Close with DEV → QA → DEMO → PROD, tests, and the known limitations below.

For a DEV rehearsal, use the private local synthetic admin, four synthetic contacts,
and the report established by the persistence check. Do not publish that password.

## Readiness checklist

- Passwordless guest-session request must verify app_env=demo and role=guest.
- Ordinary QA/PROD login must not become guest based on hostname text.
- Guest failure has an accessible retryable error and restores the button.
- Desktop and mobile guest entry must hide irrelevant credential fields.
- Saved Contacts, selection, Detail Viewer, history, and navigation must work.
- Read-only business restrictions must be enforced by API, not only hidden buttons.
- Loading/error states must not leave controls permanently disabled or mask errors.
- Confirm protected LIVE fields, entry timestamp and session consistency before presentation.
- Use synthetic records for controlled development and acceptance fixtures.
- Check /health and /version for actual target revision after deployment.

## Known limitations and remaining checks

- Session storage is in-memory; restarts require fresh login and replicas need a
  shared store before scaling.
- Primary CI excludes the named weekly-history case, although the full local
  browser selection runs it. That case currently checks history UI/table presence;
  real report persistence is established by the separate MySQL runtime check.
- The separate trend chart regression is not part of the primary CI workflow.
- Telemetry endpoints can write in DEMO even though business writes are blocked.
- Legacy shared DEMO synchronization suppresses only notes. The opt-in entry
  snapshot projection excludes additional protected fields; do not claim it is
  active until the configuration and deployment acceptance checks pass.
- The original remote OFF-mode evidence remains unavailable; the new local run is
  distinct evidence, not recovered history.
- WSL restart persistence remains a separately pending disruptive check.
- Railway connector variable values are withheld. Runtime identity and successful
  startup verify configured schema selection, but not independent database grants.
- Automated HTTP access to the custom DEMO domain previously returned 403 while
  the signed-in user's ordinary browser could access it; record the access path.

## Entry-time PROD view design

DEMO displays protected LIVE PROD data. The new per-visitor snapshot implementation
is opt-in and remains inactive pending its read-only source configuration and
rollout checks. See [DEMO entry snapshots](demo-entry-snapshot.md). Existing
synthetic local fixtures remain useful test data; they do not define live DEMO.
