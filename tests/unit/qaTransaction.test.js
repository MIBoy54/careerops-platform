import { describe, it, expect, vi } from 'vitest';
import { fixture, hashRows } from '../helpers/qaRefreshFixture.js';
import { digest } from '../../src/qaDataset.js';
import { executeRefresh } from '../../src/qaRefresh.js';

import { driver } from '../helpers/qaTransactionDriver.js';

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
