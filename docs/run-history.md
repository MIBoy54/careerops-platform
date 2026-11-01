# Run history

Updated 2026-10-31 (America/Chicago). This is a curated evidence index, not an
execution log. Exact command output and sanitized records remain in the evidence
bundles. Successful historical runs do not establish current runtime health.

| Date | Revision / event | Result and provenance |
| --- | --- | --- |
| 2026-03-14 | Earlier local/Actions validation | Legacy document reported PASS; detailed original evidence not reviewed in this refresh. |
| 2026-10-31 | `bcd81cc49ca4f26720e771862742a8c6b127f5ae` | Reviewed application baseline; 457 unit tests and Docker prompting reported passed. |
| 2026-10-31 | Phase 2, local WSL/Docker | ON/OFF bootstrap, grants, permissions, admin login, report readback, application restart, and all four refusal checks reported passed. |
| 2026-10-31 | Reproducibility attempt 1 | Stopped at MySQL socket failures; ping-only readiness implicated, not treated as a successful run. |
| 2026-10-31 | Reproducibility attempt 2 | Each of two clones passed 6 SQL, 457 unit, 1 smoke, 9 selected E2E tests and independent ON/OFF runtime checks. External final-server readiness used. |
| 2026-10-31 | PR #78, `fc203fe` | GitHub Quality Gate verified successful; CI readiness fix merged into transfer branch as `1b729513`. |
| 2026-10-31 | PR #79, `1b729513` | Combined diff reviewed; GitHub Quality Gate verified successful; merged to main as `7fc0fa978f75f47cfab2fa2ddf2274946b32e0bb`. |
| 2026-10-31 | PROD `7fc0fa9` | Owner screenshots show successful Railway deployment and PROD Quality Gate #409; not an independent full live-workflow test. |
| 2026-10-31 | Local WSL `7fc0fa9` | 457 unit tests directly observed passing after npm ci with Linux Node 20.20.2/npm 10.8.2. |
| 2026-10-31 | DEV alignment | develop fast-forwarded to `7fc0fa9`; local clean checkout tracked develop; divergent legacy dev branch preserved. Persistent local DEV provisioning remains pending. |

## Evidence locations and caveats

Local Ubuntu evidence folders (not tracked or downloadable from GitHub):

- `~/CareerOps-Phase2-Evidence-20261031`: ON success, refusal checks, new local OFF
  run, and historical OFF evidence status.
- `~/CareerOps-Reproducibility-20261031`: failed first attempt.
- `~/CareerOps-Reproducibility-20261031-attempt2`: per-clone logs and comparison.
- `~/CareerOps-CI-Readiness-Evidence-20261031`: readiness integration summary.

These locations were supplied by the local validation session; this documentation
refresh does not independently re-execute those records. Preserve provenance when
exporting them; never commit passwords, tokens, .env files, or raw secret-bearing
container inspection output.

The original remote OFF-mode evidence could not be retrieved. Its status remains
awaiting retrieval; the successful new local OFF run is distinct evidence.
Initial ON attempts stopped on fixture/harness defects (host matching, USAGE
classification, and process-exit handling). A corrected harness passed. Attempt 2
reproducibility required Python in disposable Node runners; its external readiness
adjustment was subsequently implemented in PR #78. Diagnostics timeout hardening
followed the 6/6 readiness integration SQL run; syntax/timeout checks passed after it.

[PR #78](https://github.com/MIBoy54/careerops-platform/pull/78) ·
[PR #79](https://github.com/MIBoy54/careerops-platform/pull/79)
