import { describe, it, expect, vi } from 'vitest';
import { fixture, hashRows } from '../helpers/qaRefreshFixture.js';
import { digest } from '../../src/qaDataset.js';
import { executeRefresh } from '../../src/qaRefresh.js';

// Stateful synthetic driver: inspectDatabase still runs its real metadata/SELECT
// code. Fault injection exercises rollback rather than mocking the refresh itself.
function driver(f, fault) {
  let rows = structuredClone(f.rows), saved;
  let inserts = 0;
  const c = {
    beginTransaction: vi.fn(async () => { saved = structuredClone(rows); }),
    commit: vi.fn(async () => {}), rollback: vi.fn(async () => { rows = saved || rows; }), destroy: vi.fn(),
    query: vi.fn(async (sql, args) => {
      if (sql.includes('@@GLOBAL.partial_revokes')) return [[{ db: 'careerops_qa', server_uuid: f.audit.serverUuid, partial_revokes: 0 }]];
      if (sql.includes('@@server_uuid')) return [[{ db: 'careerops_qa', server_uuid: f.audit.serverUuid }]];
      if (sql.startsWith('SHOW CREATE TABLE')) return [[{ 'Create Table': `SYNTHETIC_DDL_${/`([^`]+)`/.exec(sql)[1]}` }]];
      if (sql.startsWith('SHOW GRANTS')) return [[{ grant: "GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\\_qa`.* TO 'fixture'@'localhost'" }]];
      if (sql.includes('@@SESSION.sql_mode')) return [[{ mode: 'STRICT_TRANS_TABLES' }]];
      if (sql.includes('information_schema.TABLES')) return [Object.entries(f.audit.tables).map(([name, t]) => ({ name, engine: t.engine, kind: 'BASE TABLE', autoIncrement: t.autoIncrement }))];
      if (sql.includes('information_schema.COLUMNS')) return [Object.entries(f.audit.tables).flatMap(([tableName, t]) => t.columns.map(c => ({ ...c, tableName, nullable: c.nullable ? 'YES' : 'NO', defaultValue: c.default })))];
      if (sql.includes('information_schema.TRIGGERS') || sql.includes('information_schema.ROUTINES') || sql.includes('information_schema.EVENTS') || sql.includes('information_schema.KEY_COLUMN_USAGE')) return [[]];
      if (sql.startsWith('DELETE FROM')) { const table = /`([^`]+)`/.exec(sql)[1]; rows[table] = []; return [{ affectedRows: 0 }]; }
      if (sql.startsWith('SELECT COUNT(*)')) return [[{ n: fault === 'orphans' ? 1 : 0 }]];
      if (sql.includes('LIMIT 0') || sql.startsWith('SET TRANSACTION')) return [[]];
      const table = /FROM `([^`]+)`/.exec(sql)?.[1];
      if (table) {
        if (fault === 'protected table' && inserts > 0 && table === 'users') return [[{ id: 3, value: 'changed' }]];
        if (fault === 'count' && inserts > 0 && table === 'weekly_reports') return [[]];
        return [structuredClone(rows[table])];
      }
      throw new Error(`Unhandled synthetic query ${sql} ${args}`);
    }),
    execute: vi.fn(async (sql, values) => {
      inserts++;
      if (fault === 'insert' && inserts === 2) throw new Error('PRIVATE_PASSWORD PRIVATE_ROW');
      const [, table, cols] = /^INSERT INTO `([^`]+)` \((.+)\) VALUES/.exec(sql);
      const names = [...cols.matchAll(/`([^`]+)`/g)].map(m => m[1]);
      rows[table].push(Object.fromEntries(names.map((name, i) => [name, values[i]])));
      return [{ affectedRows: 1, warningStatus: fault === 'coercion' ? 1 : 0 }];
    })
  };
  return { c, rows: () => rows };
}
describe('refresh transaction execution with synthetic state', () => {
  it('defaults to forced rollback, verifies original content, auth and telemetry, and never issues DDL', async () => {
    const f = fixture(); const d = driver(f);
    const receipt = await executeRefresh(d.c, f.plan, { approval: f.approval('rehearse'), now: f.now });
    expect(receipt.mode).toBe('rolled-back'); expect(d.rows()).toEqual(f.rows);
    expect(d.c.rollback).toHaveBeenCalledOnce(); expect(d.c.commit).not.toHaveBeenCalled();
    const statements = [...d.c.query.mock.calls, ...d.c.execute.mock.calls].map(c => c[0]);
    expect(statements.some(s => /^\s*(TRUNCATE|DROP|CREATE|ALTER|DELIMITER|CALL|SET\s+FOREIGN_KEY_CHECKS)\b/i.test(s))).toBe(false);
    expect(statements.filter(s => s.startsWith('INSERT')).every(s => !s.includes('SELECT *'))).toBe(true);
  });
  it('commits only after a matching rehearsal and a distinct commit approval', async () => {
    const f = fixture(); const d = driver(f);
    const rehearsal = await executeRefresh(d.c, f.plan, { approval: f.approval('rehearse'), now: f.now });
    const receipt = await executeRefresh(d.c, f.plan, { mode: 'commit', approval: f.approval('commit'), rehearsal, now: f.now });
    expect(receipt.mode).toBe('committed'); expect(d.c.commit).toHaveBeenCalledOnce();
    expect(hashRows(d.rows().users)).toBe(f.audit.tables.users.contentHash);
    expect(d.rows().recruiter_tracker[0].recruiter_name).toBe('Recruiter 1');
  });
  it.each(['insert', 'coercion', 'count', 'orphans', 'protected table'])('rolls back on %s failures and redacts driver values', async fault => {
    const f = fixture(); const d = driver(f, fault);
    await expect(executeRefresh(d.c, f.plan, { approval: f.approval('rehearse'), now: f.now })).rejects.toThrow(/^QA refresh failed; transaction not committed/);
    expect(d.c.rollback).toHaveBeenCalledOnce(); expect(d.c.commit).not.toHaveBeenCalled(); expect(d.rows()).toEqual(f.rows);
  });
  it('rejects target drift before deleting rows', async () => {
    const f = fixture(); const d = driver(f); f.audit.tables.users.contentHash = digest('drift');
    await expect(executeRefresh(d.c, f.plan, { approval: f.approval('rehearse'), now: f.now })).rejects.toThrow();
    expect(d.c.execute).not.toHaveBeenCalled(); expect(d.c.commit).not.toHaveBeenCalled();
  });
  it('requires explicit commit approval and recent rehearsal before any DB work', async () => {
    const f = fixture(); const d = driver(f);
    await expect(executeRefresh(d.c, f.plan, { mode: 'commit', approval: f.approval('rehearse') })).rejects.toThrow('approval');
    await expect(executeRefresh(d.c, f.plan, { mode: 'commit', approval: f.approval('commit') })).rejects.toThrow('rehearsal');
    expect(d.c.query).not.toHaveBeenCalled();
  });
  it('destroys the connection if rollback fails instead of reusing an uncertain transaction', async () => {
    const f = fixture(); const d = driver(f, 'insert'); d.c.rollback.mockRejectedValue(new Error('PRIVATE_PASSWORD'));
    await expect(executeRefresh(d.c, f.plan, { approval: f.approval('rehearse') })).rejects.toThrow('rollback unconfirmed');
    expect(d.c.destroy).toHaveBeenCalled(); expect(d.c.commit).not.toHaveBeenCalled();
  });
});

describe('uncertain commit outcomes', () => {
  it('does not claim rollback success or retry when COMMIT acknowledgement is lost', async () => {
    const f = fixture(); const d = driver(f);
    const rehearsal = await executeRefresh(d.c, f.plan, { approval: f.approval('rehearse') });
    d.c.commit.mockRejectedValue(new Error('synthetic network failure PRIVATE_PASSWORD'));
    await expect(executeRefresh(d.c, f.plan, { mode: 'commit', approval: f.approval('commit'), rehearsal })).rejects.toThrow('commit outcome unconfirmed');
    expect(d.c.destroy).toHaveBeenCalled();
  });
});
