# Hybrid environment implementation checklist

**Current status:** Architecture agreed; documentation branch only. No database, deployed configuration, or application changes completed.

## Baseline and ownership

- [ ] Capture repository revision, branch-to-service bindings, Railway service and MySQL instance IDs, and Cloudflare DNS/proxy/access configuration (redacted).
- [ ] Verify PROD schema and endpoint by read-only identity and row-count queries.
- [ ] Verify QA schema, server identity, account grants, connection health, and app revision; prove QA cannot reach or write to PROD.
- [ ] Verify local DEV loopback binding, `careerops_dev` identity, and restricted grants.
- [ ] Determine what data exists only in local `careerops_qa` and `careerops_demo` before any retirement.
- [ ] Reconcile DEMO code (separate database/sync) with requested restricted PROD-view architecture.

## Data protection and refresh

- [ ] Replace or disable unsafe legacy root-account backup script; handle exposed password through an approved credential-rotation plan.
- [ ] Create a consistent encrypted PROD snapshot; record version, timestamp, checksum, owner, and retention location.
- [ ] Test a restore into a **disposable isolated database**, not PROD, DEV, or QA.
- [ ] Back up local DEV and the Railway QA destination separately; verify each archive.
- [ ] Document approved data exclusion/transform rules: secrets, password hashes, personal fields, session/analytics activity, and historical validation runs.
- [ ] Document rollback of each destination and matching application revision without touching PROD.
- [ ] Following explicit approval, restore the approved PROD snapshot into local DEV; validate schemas, indexes, row counts, references, UI, API, exports, and local-only access controls.
- [ ] Following DEV acceptance and explicit approval, refresh Railway QA from approved PROD snapshot; validate grants, cloud connectivity, functional flows, quality gates, and the earlier 500/failed-history symptoms.
- [ ] Re-check DEMO security separately; it is not part of the DEV→QA→PROD promotion chain.
- [ ] Archive and retire obsolete local QA/PROD only after preserving unique records and testing recovery.

## Definition of done

- DEV operates only on the workstation and its dedicated local DB.
- QA operates on Railway against a distinct least-privilege database identity; no PROD write privileges.
- PROD retains its data and stable services throughout.
- DEMO exposes only the authorized public subset of PROD and has no unauthorized business write path.
- Backups/restore/rollback are repeatable and demonstrated, not merely documented.
- README and operating runbooks reflect verified implementation, not only intention.
- CI and QA regression results are attached to a reviewed production release decision.

## Codex / implementation scope

Prepare changes in short PRs: (1) architecture docs and evidence register, (2) backup/restore plan and non-destructive scripts, (3) refresh tooling and safety checks, (4) DEMO access model remediation. Never run a destructive command or alter live infrastructure as part of a documentation task.
