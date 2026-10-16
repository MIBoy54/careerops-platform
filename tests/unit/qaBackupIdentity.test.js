import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture } from '../helpers/qaRefreshFixture.js';
import { digest } from '../../src/qaDataset.js';
const mocks = vi.hoisted(() => ({ spawnSync: vi.fn() }));
// Only Git's local worktree enumeration is real. SQL clients are never spawned.
vi.mock('node:child_process', async importOriginal => ({ ...await importOriginal(), spawnSync: mocks.spawnSync }));
import { backupMain } from '../../scripts/qa-backup.js';
let directory;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'qa-backup-mocked-')); mocks.spawnSync.mockReset(); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { rmSync(directory, { recursive: true, force: true }); vi.restoreAllMocks(); });
const save = (name, value) => { const path = join(directory, name); writeFileSync(path, JSON.stringify(value)); return path; };
const command = f => ['execute', '--manifest', save('manifest.json', f.manifest), '--output', join(directory, 'never-created.sql'),
  '--metadata', join(directory, 'never-created.json'), '--login-path', 'synthetic-qa', '--ca', 'loopback-tunnel',
  '--approval', save('approval.json', { ...f.approval('backup'), planHash: digest(f.manifest.target) })];
it.each(['root@%', 'root@localhost', 'unexpected_account@%', 'qa_fixtureX'])('blocks backup identity %s before export or output reservation', account => {
  const f = fixture();
  mocks.spawnSync.mockReturnValue({ status: 0, stdout: `careerops_qa\t${f.manifest.target.serverUuid}\t0\t${account}\n` });
  expect(() => backupMain(command(f))).toThrow('identity');
  expect(mocks.spawnSync).toHaveBeenCalledTimes(1);
  expect(mocks.spawnSync.mock.calls[0][0]).toBe('mysql');
  expect(mocks.spawnSync.mock.calls[0][1].at(-1)).toContain('CURRENT_USER()');
  expect(existsSync(join(directory, 'never-created.sql'))).toBe(false);
});
it('still refuses ALL PRIVILEGES rather than substituting the console admin or broad app account', () => {
  const f = fixture();
  mocks.spawnSync.mockReturnValueOnce({ status: 0, stdout: `careerops_qa\t${f.manifest.target.serverUuid}\t1\tqa_fixture@%\n` })
    .mockReturnValueOnce({ status: 0, stdout: "GRANT ALL PRIVILEGES ON `careerops_qa`.* TO 'qa_fixture'@'%'\n" });
  expect(() => backupMain(command(f))).toThrow('backup privileges');
  expect(mocks.spawnSync).toHaveBeenCalledTimes(2);
  expect(mocks.spawnSync.mock.calls.every(([program]) => program === 'mysql')).toBe(true);
  expect(existsSync(join(directory, 'never-created.sql'))).toBe(false);
});
