#!/usr/bin/env node
// No dotenv, server import, Railway CLI, deployment, migration or automatic refresh.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { REFRESH_TABLES, digest, requireGate, sanitizeDataset, assertTableSchemas } from '../src/qaDataset.js';
import { assertApproval, assertInventory, inspectDatabase, createRefreshPlan, createCounterReadinessPlan, executeRefresh, validateRestore } from '../src/qaRefresh.js';
import { verifyQaConnection } from '../src/qaIdentity.js';

const usage = `QA refresh: offline by default
  node scripts/qa-refresh.js plan --bundle B --manifest M --audit A --backup D --restore R --output P
  node scripts/qa-refresh.js counter-plan --bundle B --manifest M --audit A --backup D --restore R --output C
  node scripts/qa-refresh.js sanitize --input I --orphans N --output B --orphan-audit O
  node scripts/qa-refresh.js export-local --schema S --server-uuid U --snapshot D --output I --connect-stdin
  node scripts/qa-refresh.js inspect --manifest M --approval A --output I --connect-stdin
  node scripts/qa-refresh.js verify-restore --manifest M --audit A --backup D --server-uuid U --output R --connect-stdin
  node scripts/qa-refresh.js rehearse --plan P --backup D --approval A --output R --connect-stdin
  node scripts/qa-refresh.js commit --plan P --backup D --approval A --rehearsal R --output C --connect-stdin
Private files must be outside all Git worktrees. Connection JSON comes ONLY from stdin.
Approvals are protected, external owner attestations; see docs/qa-refresh-runbook.md.`;
const json = path => JSON.parse(readFileSync(path, 'utf8'));
function parse(argv) {
  const [command = 'help', ...rest] = argv;
  const options = {};
  const allowed = {
    plan: ['bundle', 'manifest', 'audit', 'backup', 'restore', 'output'],
    'counter-plan': ['bundle', 'manifest', 'audit', 'backup', 'restore', 'output'],
    sanitize: ['input', 'orphans', 'output', 'orphan-audit'],
    'export-local': ['schema', 'server-uuid', 'snapshot', 'output', 'connect-stdin'],
    inspect: ['manifest', 'approval', 'output', 'connect-stdin'],
    'verify-restore': ['manifest', 'audit', 'backup', 'server-uuid', 'output', 'connect-stdin'],
    rehearse: ['plan', 'backup', 'approval', 'output', 'connect-stdin'],
    commit: ['plan', 'backup', 'approval', 'rehearsal', 'output', 'connect-stdin']
  };
  if (command === 'help') { requireGate(!rest.length, 'arguments'); return { command, options }; }
  requireGate(allowed[command], 'unknown command');
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i].slice(2);
    requireGate(rest[i].startsWith('--') && allowed[command].includes(key) && !Object.hasOwn(options, key), 'arguments');
    options[key] = key === 'connect-stdin' ? true : rest[++i];
    requireGate(options[key] && !String(options[key]).startsWith('--'), 'missing argument');
  }
  for (const key of allowed[command]) requireGate(options[key] !== undefined, 'missing argument');
  return { command, options };
}
export function privatePath(path, output = false) {
  // Do not write data/evidence into this or any sibling worktree. The original
  // checkout is included through git worktree list, with no branch modifications.
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const worktrees = execFileSync('git', ['-C', root, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' })
    .split('\n').filter(s => s.startsWith('worktree ')).map(s => realpathSync(s.slice(9)));
  const absolute = resolve(path);
  const resolved = output ? resolve(realpathSync(resolve(absolute, '..')), absolute.split(/[\\/]/).pop()) : realpathSync(absolute);
  for (const tree of worktrees) {
    const location = relative(tree, resolved);
    requireGate(location === '..' || location.startsWith(`..${sep}`) || isAbsolute(location), 'private artifact inside worktree');
  }
  return absolute;
}
export const writePrivate = (path, value) => writeFileSync(privatePath(path, true), JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
const readPrivate = path => json(privatePath(path));
async function connect(options, expected) {
  requireGate(options['connect-stdin'] && !process.stdin.isTTY, 'explicit connection stdin required');
  const credentials = JSON.parse(readFileSync(0, 'utf8'));
  requireGate(Object.keys(credentials).every(k => ['host', 'port', 'user', 'password', 'database'].includes(k)), 'connection fields');
  for (const key of ['host', 'port', 'user', 'database']) requireGate(credentials[key] === expected[key], 'connection inventory mismatch');
  requireGate(typeof credentials.password === 'string' && !!credentials.password, 'credential required');
  const local = ['127.0.0.1', '::1'].includes(credentials.host);
  const mysql = (await import('mysql2/promise')).default;
  return mysql.createConnection({ ...credentials, multipleStatements: false, dateStrings: true,
    supportBigNumbers: true, bigNumberStrings: true, connectTimeout: 10000,
    ...(local ? {} : { ssl: { rejectUnauthorized: true } }) });
}
async function connectLocal(options, database) {
  requireGate(['careerops_prod_restore_validation', 'careerops_qa_restore_validation'].includes(database), 'local restore schema allowlist');
  // Read connection input once. Local operations require exact loopback and an
  // explicit server UUID. Never use MYSQL*/DB_* ambient credentials.
  const credentials = JSON.parse(readFileSync(0, 'utf8'));
  requireGate(options['connect-stdin'] && ['127.0.0.1', '::1'].includes(credentials.host) && credentials.database === database &&
    Number.isInteger(credentials.port) && credentials.port > 0 && credentials.port <= 65535 && typeof credentials.user === 'string' &&
    credentials.user.toLowerCase() !== 'root' && typeof credentials.password === 'string' && credentials.password.length > 0 &&
    Object.keys(credentials).every(k => ['host', 'port', 'user', 'password', 'database'].includes(k)), 'local connection');
  const mysql = (await import('mysql2/promise')).default;
  const connection = await mysql.createConnection({ ...credentials, multipleStatements: false, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
  try {
    const [rows] = await connection.query('SELECT DATABASE() AS db, @@server_uuid AS server_uuid');
    requireGate(/^[0-9a-f-]{36}$/i.test(options['server-uuid']) && rows[0]?.db === database && rows[0].server_uuid === options['server-uuid'], 'local identity');
    await connection.query('SET SESSION TRANSACTION READ ONLY');
    await connection.beginTransaction();
    return { connection, credentials };
  } catch (error) { await connection.end(); throw error; }
}
export async function main(argv = process.argv.slice(2)) {
  const { command, options: o } = parse(argv);
  if (command === 'help') { console.log(usage); return; }
  if (command === 'sanitize') {
    const result = sanitizeDataset(readPrivate(o.input), Number(o.orphans));
    const { orphanAudit, ...bundle } = result;
    writePrivate(o['orphan-audit'], { sourceSha256: digest(readFileSync(privatePath(o.input))), removed: orphanAudit });
    writePrivate(o.output, bundle); console.log('Local sanitization complete; owner field review still required.'); return;
  }
  if (command === 'plan' || command === 'counter-plan') {
    const build = command === 'plan' ? createRefreshPlan : createCounterReadinessPlan;
    const plan = build(readPrivate(o.bundle), readPrivate(o.manifest), readPrivate(o.audit),
      readFileSync(privatePath(o.backup)), readPrivate(o.restore));
    writePrivate(o.output, plan); console.log(command === 'plan' ? `Offline plan validated: ${plan.planHash}` : `Offline counter readiness report: ${plan.reportHash}; separate approval required`); return;
  }
  if (command === 'export-local' || command === 'verify-restore') {
    const database = command === 'export-local' ? o.schema : 'careerops_qa_restore_validation';
    const { connection, credentials } = await connectLocal(o, database);
    try {
      const state = await inspectDatabase(connection, database);
      if (command === 'export-local') {
        const schemas = Object.fromEntries(REFRESH_TABLES.map(t => [t, state.tables[t]?.columns]));
        assertTableSchemas(schemas);
        const data = {};
        for (const table of REFRESH_TABLES) {
          [data[table]] = await connection.query(`SELECT ${schemas[table].map(c => `\`${c.name}\``).join(', ')} FROM \`${table}\` ORDER BY ${table === 'report_job_contacts' ? 'report_id, recruiter_tracker_id' : 'id'}`);
        }
        writePrivate(o.output, { schemas, data, source: { kind: 'verified-local-restore', serverUuid: o['server-uuid'],
          snapshotSha256: digest(readFileSync(privatePath(o.snapshot))), stateHash: digest(state) } });
      } else {
        const manifest = readPrivate(o.manifest);
        const result = validateRestore(readPrivate(o.audit), state, manifest.backup, readFileSync(privatePath(o.backup)),
          { ...credentials, serverUuid: o['server-uuid'] });
        writePrivate(o.output, result);
      }
    } finally { await connection.rollback(); await connection.end(); }
    console.log('Local restore operation validated.'); return;
  }
  // Every connected QA path requires a separately supplied, expiring approval.
  const plan = command === 'inspect' ? null : readPrivate(o.plan);
  const manifest = plan?.manifest || readPrivate(o.manifest);
  assertInventory(manifest.target);
  const approval = readPrivate(o.approval);
  assertApproval(approval, command, plan?.planHash || digest(manifest.target));
  if (plan) {
    const rebuilt = createRefreshPlan(plan.bundle, manifest, plan.audit, readFileSync(privatePath(o.backup)), plan.restore);
    requireGate(rebuilt.planHash === plan.planHash, 'plan changed');
  }
  // Reserve receipt path before any mutation, so an existing receipt or unwritable
  // destination cannot cause a successful commit to be reported as a failed run.
  const receiptPath = privatePath(o.output, true);
  writeFileSync(receiptPath, JSON.stringify({ status: 'in-progress', planHash: plan?.planHash || digest(manifest.target) }), { flag: 'wx', mode: 0o600 });
  const connection = await connect(o, manifest.target);
  try {
    await verifyQaConnection(connection, manifest.target.serverUuid, manifest.target.user);
    if (command === 'inspect') {
      await connection.query('SET SESSION TRANSACTION READ ONLY');
      await connection.beginTransaction();
    }
    const result = command === 'inspect' ? await inspectDatabase(connection, 'careerops_qa') :
      await executeRefresh(connection, plan, { mode: command, approval, rehearsal: command === 'commit' ? readPrivate(o.rehearsal) : undefined });
    writeFileSync(receiptPath, JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(command === 'inspect' ? 'Read-only QA inventory recorded.' : `QA transaction ${result.mode}.`);
  } finally {
    if (command === 'inspect') await connection.rollback();
    await connection.end();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('QA operation stopped. No credentials or driver details emitted. Inspect protected evidence and the runbook before retrying.'); process.exitCode = 1; });
}
