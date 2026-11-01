# Showcase readiness and presentation script

Working assessment, 2026-11-01. Keep synthetic rehearsal results distinct from
live deployment checks. Do not display personal recruiter data or credentials.

## Primary journey (about three minutes)

1. Open the verified DEMO login page. Explain that guest access is passwordless
   and read-only for business data. Continue as Guest.
2. Identify the DEMO banner and open Saved Contacts. Use clearly synthetic records;
   if the deployed dataset is not synthetic, stop the public rehearsal until a
   reviewed synthetic dataset is supplied. Do not silently replace existing data.
3. Select contacts and open Detail Viewer. Show clear navigation back to Saved
   Contacts and demonstrate disabled actions when nothing is selected.
4. Open Weekly Report History and view an existing synthetic report. Explain that
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
- Use only synthetic demo records; confirm live data provenance before presentation.
- Check /health and /version for actual target revision after deployment.

## Known limitations and remaining checks

- Session storage is in-memory; restarts require fresh login and replicas need a
  shared store before scaling.
- Primary CI excludes the named weekly-history case, although the full local
  browser selection runs it. That case currently checks history UI/table presence;
  real report persistence is established by the separate MySQL runtime check.
- The separate trend chart regression is not part of the primary CI workflow.
- Telemetry endpoints can write in DEMO even though business writes are blocked.
- DEMO synchronization suppresses notes but is not a full anonymization guarantee.
- The original remote OFF-mode evidence remains unavailable; the new local run is
  distinct evidence, not recovered history.
- WSL restart persistence remains a separately pending disruptive check.
- Railway connector variable values are withheld. Runtime identity and successful
  startup verify configured schema selection, but not independent database grants.
- Automated HTTP access to the custom DEMO domain previously returned 403 while
  the signed-in user's ordinary browser could access it; record the access path.
