# Testing and validation

Reviewed 2026-10-31 against `7fc0fa9`. Use the committed lockfile (`npm ci`).
CI selects Node 20; local reproducibility used Node 20.20.2 / npm 10.8.2 and
MySQL 8.4.13. `package.json` does not declare an engines constraint.

## Local commands

| Command | Scope |
| --- | --- |
| `npm ci` | Install exact lockfile dependencies |
| `npm test` | `tests/unit/**/*.test.js` and `*.spec.js`; not E2E/regressions |
| `npx playwright install --with-deps` | Install browser executables and OS dependencies |
| `npx playwright test tests/e2e/smoke --workers=1` | CI smoke selection |
| `npx playwright test tests/e2e --workers=1` | Entire E2E directory, including CI's excluded history case |
| `npm run test:session-trend` | Trend unit/browser tests; SQL skips without opt-in |
| `SESSION_TREND_TEST_MYSQL=1 npx vitest run --config tests/sessionTrend.config.js tests/regression/sessionTrendSql.test.js` | Isolated SQL regression only |

On Linux the hidden-input PTY tests require `python3`; a minimal Node container
may not include it. They skip on non-Linux systems, so a Windows-only pass does
not verify terminal echo/cleanup. Shell commands above use POSIX syntax.

Playwright owns a new loopback `APP_ENV=test` server (port 3100 by default;
`PLAYWRIGHT_PORT` overrides), never reuses an existing server, and tears it down.
Test mode rejects nonempty DB/deployment bindings and makes no DB connections.
It uses synthetic login and in-memory contacts, not real MySQL persistence.
Browser helpers can load dotenv even though test server startup does not; keep
production settings out of test workspaces. `TEST_EMAIL`/`TEST_PASSWORD` override
synthetic defaults. `CHROMIUM_PATH` overrides the browser executable.

The separate trend chart regression uses `/usr/bin/chromium` unless
`CHROMIUM_PATH` is set. It is not selected by the primary CI workflow.

## SQL fixture readiness

Use only a disposable, network-disabled container named
`careerops-trend-dev-test`, with no published ports. The test helper queries it
using `docker exec` through the local Docker socket. Synthetic CTEs create no
CareerOps tables and do not access application databases.

```bash
set -euo pipefail
# Use an unused container name; do not remove a pre-existing container.
mysql_image='mysql@sha256:a0225d1ea6631c8bc2385dc4c2faba17bbf1834ecf369e1659a9a382bd8d5dd7'
docker run -d --name careerops-trend-dev-test --network none   --tmpfs /var/lib/mysql -e MYSQL_ALLOW_EMPTY_PASSWORD=yes "$mysql_image"
# After successful creation, clean up this fixture when the shell exits.
trap 'docker rm -f careerops-trend-dev-test >/dev/null 2>&1 || true' EXIT
bash .github/scripts/wait-for-mysql-final-server.sh careerops-trend-dev-test 8.4.13 120
SESSION_TREND_TEST_MYSQL=1 npx vitest run --config tests/sessionTrend.config.js tests/regression/sessionTrendSql.test.js
```

Run the block in a dedicated Bash shell with `set -euo pipefail` enabled, so a
failed creation/readiness check stops before tests. The empty root password is
only for this network-isolated disposable fixture. Never use this setup for a
persistent application database. `mysqladmin ping` alone can accept MySQL's
temporary initialization server. The helper requires a successful socket query,
`skip_networking=0`, nonempty server UUID, and the exact pinned version. Probes
and diagnostics are bounded; readiness waits up to 120 seconds plus bounded
failure diagnostics. Container pulls/creation have separate execution times.

## GitHub Actions selections

Push branches: `dev`, `develop`, `qa`, `demo`, `main`. PR target branches: the same
plus `transfer/careerops-reviewed-bcd81cc`. The legacy `dev` trigger does not change
the documented `develop` → DEV mapping. No workflow_dispatch is configured.

| Trigger | Unit | SQL | Smoke | Broader E2E |
| --- | --- | --- | --- | --- |
| Push `dev`/`develop` | Yes | No | No | No |
| Push `qa` | Yes | No | Yes | No |
| Push `demo`/`main` | Yes | No | Yes | Yes |
| PR to an allowed base other than main | Yes | Yes | Yes | No |
| PR to `main` | Yes | Yes | Yes | Yes |

Broader E2E excludes `Generated weekly report appears in Weekly Report History`
with `--grep-invert`. Its resolution remains open; a green gate does not cover
that case. The workflow validates software and has no application deployment step.
Railway auto-deployment is separate; merging a bound branch can deploy it.

## Runtime validation and evidence

Real MySQL validation separately verifies ON/OFF partial_revokes semantics,
bootstrap, DML/DDL boundaries, synthetic admin login, report readback, application
restart persistence, and refusal without overwriting existing state. Bootstrap is
fresh-install only: never reset partial resources to manufacture a passing retry.
Use separate provisioning/application/login credentials, sanitized evidence,
sequential fixtures, and at least a 1.5 GB reserve on relevant storage.

The reviewed application baseline `bcd81cc` passed both modes and all four refusal
checks. Two independent clones passed 457 unit, 6 SQL, 1 smoke, 9 selected E2E,
and ON/OFF runtime checks each. Initial harness/setup failures remain recorded;
the original remote OFF-mode evidence was unavailable and a new local OFF run
supplied verification. These are historical results, not a promise for new changes.
See [run history](run-history.md) for provenance and limitations.
