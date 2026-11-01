# Persistent local DEV

Prepared 2026-11-01. Run from the Ubuntu checkout, not Windows PowerShell.

```bash
cd ~/projects/careerops-next
python3 scripts/local-dev.py status
python3 scripts/local-dev.py start
python3 scripts/local-dev.py stop
```

The app is at http://127.0.0.1:3000. Synthetic admin credentials are generated in
`~/.config/careerops-dev/login.json` (owner-only). Read them locally; do not paste
passwords into chat, screenshots, shell arguments, Git, or evidence.

## First installation and configuration

Install lockfile dependencies with native Linux Node/npm (`npm ci`), ensure Docker
Desktop WSL integration is running, then run `python3 scripts/local-dev.py init`
once. Existing config or resource names cause refusal rather than overwrite.
The helper pulls the reviewed digest-pinned Node 20.20.2 and MySQL 8.4.13 images.
A sanitized shape is in `scripts/local-dev-config.example.json`.

Secrets are generated separately for MySQL root, the restricted application
account, synthetic login, and sessions. They stay outside the repository in the
owner-only config directory. Only the one-shot provisioning runner mounts root
and login provisioning material. The app receives app settings only. No .env is
created in the source tree, so test mode does not inherit DEV DB bindings.

MySQL uses volume `careerops-local-dev-data`. The app and database share a
container network namespace so the verified account matches 127.0.0.1; the actual
DEV server listens on 127.0.0.1:3001 inside it. A small local proxy forwards the
published 127.0.0.1:3000 port. MySQL's 3306 port is not published. The dedicated
Docker bridge is separate from remote Railway networks; no production bindings
are supplied. This local architecture is not a claim of production topology parity.

## Start, stop, restart, and recovery

- `start`: starts existing MySQL, verifies final-server readiness, recreates the
  app from the working tree, and updates build SHA metadata from HEAD.
- `stop`: stops owned app/database containers; retains volume and private config.
- `restart-app`: recreates the app; sessions reset, database data remains.
- `restart-db`: stops the app, restarts MySQL, then recreates the app.
- `recreate-db`: removes only the owned database container, recreates it with the
  same volume and original root configuration, then starts the app. No bootstrap
  is rerun and no volume is deleted.
- `logs`: recent local app logs; review before sharing, since runtime logs may
  contain user/account and query details.

No destructive data-reset command is provided. For a clean reset, stop DEV,
back up/review existing data and private credentials, and explicitly approve
removal of the exact owned volume/config. Never delete the volume to force a
bootstrap retry. A partial first install has no initialized marker; inspect its
state before recovery. Do not run init repeatedly.

If Docker Desktop or WSL is restarted, run `start` after Docker is ready. Both
containers have unless-stopped restart policy, but the controller is the supported
recovery path because the shared namespace must be re-established reliably.
An actual WSL shutdown/start test remains pending: the active VS Code session
was not interrupted. Container/volume persistence is verified separately.

Eight clearly synthetic contacts (four reported, four unreported) and a report were created for local showcase
checks. UTC is used for this new local fixture; it does not establish historical
production timestamp conventions. No production data was copied.

## Verification and limits

Real DEV bootstrap ran once, exact grants/account identity were validated, and
DDL was denied. The report and contact links survived app restart, database
restart, and container recreation. Old sessions were rejected after restart.
Evidence is outside Git in `~/CareerOps-Readiness-20261101/persistent-dev.json`.

Local source is bind-mounted read-only into the app. Restart after edits to reload
server code. A dirty worktree is not represented by HEAD alone; do not claim a
/version SHA identifies uncommitted edits. Work on a feature branch from develop
and promote through QA, DEMO, then main using the established gates.
