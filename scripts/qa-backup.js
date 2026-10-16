#!/usr/bin/env node
// Plans by default. No password argument, dotenv, Railway API or source PROD access.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, requireGate } from '../src/qaDataset.js';
import { assertApproval, assertInventory } from '../src/qaRefresh.js';
import { isSafeSchemaGrant, hasQaSchemaSelect } from '../src/devGrantValidation.js';
import { privatePath, writePrivate } from './qa-refresh.js';
export function backupMain(argv = process.argv.slice(2)) {
  if (!argv.length || argv[0] === 'help') {
    console.log('node scripts/qa-backup.js [plan|execute] --manifest M --output D --metadata B --login-path L --ca C [--approval A]\nDefault plan prints only a target hash. Use ca=loopback-tunnel only for a verified loopback SSH tunnel.'); return;
  }
  const [mode, ...rest] = argv; requireGate(['plan', 'execute'].includes(mode), 'backup mode');
  const o = {};
  for (let i = 0; i < rest.length; i += 2) {
    requireGate(['--manifest', '--output', '--metadata', '--login-path', '--ca', '--approval'].includes(rest[i]) && !Object.hasOwn(o, rest[i]) && rest[i + 1], 'backup arguments');
    o[rest[i]] = rest[i + 1];
  }
  for (const key of ['--manifest', '--output', '--metadata', '--login-path', '--ca']) requireGate(o[key], 'backup arguments');
  const manifest = JSON.parse(readFileSync(privatePath(o['--manifest']), 'utf8'));
  assertInventory(manifest.target);
  const targetHash = digest(manifest.target);
  const output = privatePath(o['--output'], true), metadata = privatePath(o['--metadata'], true);
  requireGate(output !== metadata && /^[a-zA-Z0-9_-]+$/.test(o['--login-path']), 'backup paths');
  if (mode === 'plan') { console.log(`Backup plan only; no connection or export. Approval target hash: ${targetHash}`); return; }
  requireGate(o['--approval'], 'backup approval required');
  assertApproval(JSON.parse(readFileSync(privatePath(o['--approval']), 'utf8')), 'backup', targetHash);
  const t = manifest.target;
  const local = ['127.0.0.1', '::1'].includes(t.host);
  requireGate(local ? o['--ca'] === 'loopback-tunnel' : o['--ca'] !== 'loopback-tunnel', 'backup TLS configuration');
  const connectionArgs = ['--no-defaults', `--login-path=${o['--login-path']}`, '--protocol=TCP', `--host=${t.host}`, `--port=${t.port}`, `--user=${t.user}`,
    ...(local ? ['--ssl-mode=DISABLED'] : ['--ssl-mode=VERIFY_IDENTITY', `--ssl-ca=${realCa(o['--ca'])}`])];
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^MYSQL/.test(key)));
  const run = (program, args) => {
    const result = spawnSync(program, args, { encoding: 'utf8', env: childEnv, windowsHide: true, maxBuffer: 1024 * 1024 });
    requireGate(!result.error && result.status === 0, 'backup client failed'); return result.stdout;
  };
  const identity = run('mysql', [...connectionArgs, '--batch', '--skip-column-names', `--database=${t.database}`,
    '--execute=SELECT DATABASE(), @@server_uuid, @@GLOBAL.partial_revokes']).trim().split('\t');
  requireGate(identity[0] === 'careerops_qa' && identity[1] === t.serverUuid && ['0', '1'].includes(identity[2]), 'backup identity');
  const grants = run('mysql', [...connectionArgs, '--batch', '--raw', '--skip-column-names', '--execute=SHOW GRANTS FOR CURRENT_USER']).trim().split('\n');
  requireGate(hasQaSchemaSelect(grants, identity[2] === '1') && grants.length > 0 && grants.every(g => isSafeSchemaGrant(g, identity[2] === '1', 'careerops_qa')), 'backup privileges');
  // Reserve both destinations before starting mysqldump; no overwrite/retry.
  writeFileSync(output, '', { flag: 'wx', mode: 0o600 });
  writePrivate(metadata, { status: 'in-progress', targetHash });
  run('mysqldump', [...connectionArgs, '--single-transaction', '--quick', '--hex-blob', '--skip-triggers', '--skip-routines', '--skip-events',
    '--set-gtid-purged=OFF', '--no-tablespaces', '--column-statistics=0', `--result-file=${output}`, t.database]);
  requireGate(statSync(output).size > 0, 'empty backup');
  const backup = { sha256: digest(readFileSync(output)), createdAt: new Date().toISOString(), targetServerUuid: t.serverUuid };
  writeFileSync(metadata, JSON.stringify(backup, null, 2), { mode: 0o600 });
  console.log('QA backup written privately; isolated restore validation is still required.');
}
const realCa = path => privatePath(path);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { backupMain(); } catch { console.error('QA backup stopped. Inspect protected evidence; no credential or client output emitted.'); process.exitCode = 1; }
}
