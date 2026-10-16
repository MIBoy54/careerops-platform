import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fixture } from '../helpers/qaRefreshFixture.js';
import { main, privatePath } from '../../scripts/qa-refresh.js';
import { backupMain } from '../../scripts/qa-backup.js';
let directory;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'qa-synthetic-')); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { rmSync(directory, { recursive: true, force: true }); vi.restoreAllMocks(); });
const save = (name, value) => { const path = join(directory, name); writeFileSync(path, JSON.stringify(value)); return path; };
it('runs the entire default offline plan using synthetic private files without importing a DB driver', async () => {
  const f = fixture(); const backup = join(directory, 'synthetic-backup'); writeFileSync(backup, f.backupBytes);
  const output = join(directory, 'plan.json');
  await main(['plan', '--bundle', save('bundle.json', f.bundle), '--manifest', save('manifest.json', f.manifest), '--audit', save('audit.json', f.audit),
    '--backup', backup, '--restore', save('restore.json', f.restore), '--output', output]);
  expect(JSON.parse(readFileSync(output, 'utf8')).planHash).toBe(f.plan.planHash);
  expect(JSON.stringify(console.log.mock.calls)).not.toMatch(/PRIVATE|password|synthetic-users/);
});
it('plans backup without needing mysql binaries, credentials, approval or connectivity', () => {
  const f = fixture(); backupMain(['plan', '--manifest', save('manifest.json', f.manifest), '--output', join(directory, 'backup.sql'),
    '--metadata', join(directory, 'backup.json'), '--login-path', 'synthetic', '--ca', 'loopback-tunnel']);
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining('no connection or export'));
});
it('rejects commit with no owner approval before attempting credentials or a connection', async () => {
  const f = fixture(); await expect(main(['commit', '--plan', save('plan.json', f.plan), '--backup', save('backup.json', {}),
    '--approval', save('approval.json', {}), '--rehearsal', save('rehearsal.json', {}), '--output', join(directory, 'receipt.json'), '--connect-stdin'])).rejects.toThrow('approval');
});
it('refuses unknown flags and refuses artifact writes under any worktree, including double-dot names', async () => {
  await expect(main(['commit', '--yes'])).rejects.toThrow();
  expect(() => privatePath(resolve('..private.json'), true)).toThrow('inside worktree');
  expect(() => privatePath(resolve('plan.json'), true)).toThrow('inside worktree');
  for (const entry of execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' }).split('\n').filter(line => line.startsWith('worktree '))) {
    expect(() => privatePath(join(entry.slice(9), 'private.json'), true)).toThrow('inside worktree');
  }
});
it('sanitizes without logging source values and separates orphan evidence', async () => {
  const f = fixture(); f.raw.data.report_job_contacts.push({ report_id: 9, recruiter_tracker_id: 9 });
  await main(['sanitize', '--input', save('raw.json', f.raw), '--orphans', '1', '--output', join(directory, 'clean.json'), '--orphan-audit', join(directory, 'orphans.json')]);
  expect(readFileSync(join(directory, 'clean.json'), 'utf8')).not.toMatch(/PRIVATE|private@example/);
  expect(JSON.parse(readFileSync(join(directory, 'orphans.json'), 'utf8')).removed).toHaveLength(1);
  expect(JSON.stringify(console.log.mock.calls)).not.toMatch(/PRIVATE/);
});
