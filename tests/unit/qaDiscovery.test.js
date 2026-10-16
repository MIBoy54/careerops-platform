import { describe, it, expect, vi } from 'vitest';
import { discoveryFixture } from '../helpers/qaDiscoveryFixture.js';
import { driver } from '../helpers/qaTransactionDriver.js';
import { column } from '../helpers/qaRefreshFixture.js';
import { QA_UUID, LOCAL_UUID } from '../helpers/qaFixture.js';
import { digest, checkSchemaCompatibility, sanitizeDataset } from '../../src/qaDataset.js';
import { createCounterReadinessPlan, createRefreshPlan, validateRestore, executeRefresh } from '../../src/qaRefresh.js';
import { verifyQaConnection } from '../../src/qaIdentity.js';

const args = f => [f.bundle, f.manifest, f.audit, f.backupBytes, f.restore, f.now];
describe('owner discovery shaped synthetic readiness', () => {
  it('accepts matching 20/4/5 metadata, no date_reported, industry(100), nullable temporal default and extra protected history', () => {
    const f = discoveryFixture({ preparedCounters: true });
    expect(Object.values(f.bundle.schemas).map(cols => cols.length)).toEqual([20, 4, 5]);
    expect(Object.keys(f.audit.tables)).toHaveLength(8);
    expect(f.audit.tables.recruiter_tracker.count).toBe(0);
    expect(Object.values(f.audit.tables).reduce((n, t) => n + t.count, 0)).toBe(686);
    const plan = createRefreshPlan(...args(f));
    expect(plan.bundle.data.report_job_contacts[0].created_at).toBe('2000-01-01 00:00:00');
    expect(f.raw.data.report_job_contacts[0].created_at).toBeNull();
    expect(plan.bundle.schemas.recruiter_tracker.some(c => c.name === 'date_reported')).toBe(false);
    expect(plan.audit.tables.demo_refresh_history.count).toBe(0);
  });
  it('reports all three blocked counters using actual sparse staged maxima, never row counts or assumed baselines', async () => {
    const f = discoveryFixture(); const original = digest(args(f));
    const report = createCounterReadinessPlan(...args(f));
    expect(report.kind).toBe('counter-readiness-only'); expect(report.requiresSeparateOwnerApproval).toBe(true);
    expect(report.ready).toBe(false);
    expect(report.counters.map(c => [c.table, c.current, c.stagedMaximum, c.minimumNextValue])).toEqual([
      ['recruiter_tracker', '1', '113', '114'], ['weekly_reports', '1', '907', '908'], ['report_job_contacts', '1', '9021', '9022']
    ]);
    expect(digest(args(f))).toBe(original);
    expect(() => createRefreshPlan(...args(f))).toThrow('AUTO_INCREMENT reserve');
    const connection = { query: vi.fn() };
    await expect(executeRefresh(connection, report, { mode: 'commit' })).rejects.toThrow();
    expect(connection.query).not.toHaveBeenCalled();
  });
  it.each(['backup', 'restore', 'privacy', 'dependency', 'schema'])('counter reporting cannot bypass the %s gate', gate => {
    const f = discoveryFixture();
    if (gate === 'backup') f.backupBytes = Buffer.from('wrong synthetic backup');
    if (gate === 'restore') f.restore.passed = false;
    if (gate === 'privacy') f.manifest.privacy.reviewedFields.report_job_contacts.pop();
    if (gate === 'dependency') f.manifest.rollback.dependencyReviewApproved = false;
    if (gate === 'schema') { f.audit.tables.recruiter_tracker.columns = f.audit.tables.recruiter_tracker.columns.filter(c => c.name !== 'company'); f.restore.targetStateHash = digest(f.audit); }
    expect(() => createCounterReadinessPlan(...args(f))).toThrow();
  });
  it('never proposes reducing an existing counter or uses number arithmetic for BIGINT high water', () => {
    const f = discoveryFixture({ preparedCounters: true });
    f.bundle.schemas.recruiter_tracker[0].type = 'bigint unsigned';
    f.audit.tables.recruiter_tracker.autoIncrement = '9007199254740993';
    f.restore.targetStateHash = digest(f.audit);
    const c = createCounterReadinessPlan(...args(f)).counters[0];
    expect(c.proposedNextValue).toBe('9007199254740993'); expect(c.ready).toBe(true);
  });
  it.each(['0', '-1', null, '1e3', ''])('rejects unverified counter metadata %s', value => {
    const f = discoveryFixture(); f.audit.tables.report_job_contacts.autoIncrement = value; f.restore.targetStateHash = digest(f.audit);
    expect(() => createCounterReadinessPlan(...args(f))).toThrow('counter metadata');
  });
  it('blocks exhausted counter capacity and duplicate explicit contact primary IDs before DML', () => {
    const f = discoveryFixture();
    f.bundle.schemas.report_job_contacts[0].type = 'tinyint unsigned'; // staged ID 9021 cannot fit.
    f.restore.targetStateHash = digest(f.audit);
    expect(() => createCounterReadinessPlan(...args(f))).toThrow('capacity');
    const dup = discoveryFixture(); dup.raw.data.report_job_contacts.push({ ...dup.raw.data.report_job_contacts[0], report_id: 1234 });
    expect(() => sanitizeDataset(dup.raw, 1)).toThrow('duplicate primary');
  });
  it.each(['STORED GENERATED', 'VIRTUAL GENERATED', 'DEFAULT_GENERATED on update CURRENT_TIMESTAMP'])('rejects unsupported EXTRA=%s', extra => {
    const f = discoveryFixture(); f.raw.schemas.report_job_contacts.at(-1).extra = extra;
    expect(() => sanitizeDataset(f.raw, 0)).toThrow('generated or unknown');
  });
  it.each([['varchar(100)', 'CURRENT_TIMESTAMP'], ['timestamp', '(unsafe_expression())']])('rejects generalized generated defaults %s / %s', (type, value) => {
    const f = discoveryFixture(); Object.assign(f.raw.schemas.report_job_contacts.at(-1), { type, default: value });
    expect(() => sanitizeDataset(f.raw, 0)).toThrow();
  });
  it('rejects temporal default drift and missing source/target columns in either direction', () => {
    const f = discoveryFixture(); const target = structuredClone(f.bundle.schemas);
    target.report_job_contacts.at(-1).default = null;
    expect(() => checkSchemaCompatibility(f.bundle.schemas, target, f.bundle.data)).toThrow();
    const devOnly = structuredClone(f.bundle.schemas); devOnly.recruiter_tracker.push(column('date_reported', 'date'));
    expect(() => checkSchemaCompatibility(devOnly, f.bundle.schemas, f.bundle.data)).toThrow('missing');
    expect(() => checkSchemaCompatibility(f.bundle.schemas, devOnly, f.bundle.data)).not.toThrow();
  });
  it('restores empty business tables only when all 686 protected rows and extra history match', () => {
    const f = discoveryFixture(); const restored = structuredClone(f.audit);
    restored.database = 'careerops_qa_restore_validation'; restored.serverUuid = LOCAL_UUID;
    const local = { host: '127.0.0.1', database: restored.database, serverUuid: LOCAL_UUID };
    expect(validateRestore(f.audit, restored, f.manifest.backup, f.backupBytes, local).passed).toBe(true);
    restored.tables.demo_refresh_history.contentHash = digest('unexpected history');
    expect(() => validateRestore(f.audit, restored, f.manifest.backup, f.backupBytes, local)).toThrow('restore');
  });
  it('rejects changing telemetry since backup rather than treating a screenshot count as a baseline', async () => {
    const f = discoveryFixture({ preparedCounters: true }); const plan = createRefreshPlan(...args(f));
    const d = driver(f); d.rows().analytics_heartbeat_events.push({ id: 675, value: 'synthetic-new-heartbeat' });
    await expect(executeRefresh(d.c, plan, { approval: { ...f.approval('rehearse'), planHash: plan.planHash } })).rejects.toThrow('not committed');
    expect(d.c.execute).not.toHaveBeenCalled(); expect(d.c.rollback).toHaveBeenCalledOnce(); expect(d.c.commit).not.toHaveBeenCalled();
  });
  it('fails closed before DML when fresh counter metadata cannot be requested', async () => {
    const f = discoveryFixture({ preparedCounters: true }); const plan = createRefreshPlan(...args(f)); const d = driver(f);
    const query = d.c.query.getMockImplementation();
    d.c.query.mockImplementation((sql, ...rest) => {
      if (sql === 'SET SESSION information_schema_stats_expiry = 0') throw new Error('synthetic unsupported capability');
      return query(sql, ...rest);
    });
    await expect(executeRefresh(d.c, plan, { approval: { ...f.approval('rehearse'), planHash: plan.planHash } })).rejects.toThrow('not committed');
    expect(d.c.execute).not.toHaveBeenCalled(); expect(d.c.rollback).toHaveBeenCalledOnce();
  });
  it('blocks a changed extra demo_refresh_history table and rolls back all business DML', async () => {
    const f = discoveryFixture({ preparedCounters: true }); const plan = createRefreshPlan(...args(f));
    const d = driver(f, 'demo history');
    await expect(executeRefresh(d.c, plan, { approval: { ...f.approval('rehearse'), planHash: plan.planHash } })).rejects.toThrow('not committed');
    expect(d.c.rollback).toHaveBeenCalledOnce(); expect(d.c.commit).not.toHaveBeenCalled(); expect(d.rows()).toEqual(f.rows);
  });
  it('preserves all 686 protected synthetic records and extra DEMO history through rollback and approved commit', async () => {
    const f = discoveryFixture({ preparedCounters: true }); const plan = createRefreshPlan(...args(f));
    const d = driver(f); const approval = mode => ({ ...f.approval(mode), planHash: plan.planHash });
    const receipt = await executeRefresh(d.c, plan, { approval: approval('rehearse') });
    expect(d.rows()).toEqual(f.rows);
    expect(d.c.query).toHaveBeenCalledWith('SET SESSION information_schema_stats_expiry = 0');
    await executeRefresh(d.c, plan, { mode: 'commit', approval: approval('commit'), rehearsal: receipt });
    for (const t of ['users', 'validation_runs', 'visitor_analytics', 'analytics_heartbeat_events', 'demo_refresh_history']) {
      expect(d.rows()[t]).toEqual(f.rows[t]);
    }
    expect(d.rows().recruiter_tracker[0].id).toBe(113);
    expect(d.rows().report_job_contacts[0].created_at).toBe('2000-01-01 00:00:00');
  });
});

describe('actual app-session identity and broad grant rejection', () => {
  const connection = (account, grant = "GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\\_qa`.* TO 'careerops_qa_app'@'%'") => ({ query: vi.fn(async sql =>
    sql.startsWith('SHOW GRANTS') ? [[{ grant }]] : sql.includes('@@server_uuid') ? [[{ db: 'careerops_qa', server_uuid: QA_UUID, authenticated_account: account, partial_revokes: 0 }]] : [[]]) });
  it.each(['root@%', 'root@localhost', 'other_app@%', 'careerops_qa_appX', 'careerops_qa_app@', '', undefined])('does not confuse console %s with the expected runtime account', async account => {
    const c = connection(account);
    await expect(verifyQaConnection(c, QA_UUID, 'careerops_qa_app')).rejects.toThrow('identity');
    expect(c.query).toHaveBeenCalledTimes(1);
  });
  it('accepts a verified application account, without changing grants', async () => {
    const c = connection('careerops_qa_app@%'); await verifyQaConnection(c, QA_UUID, 'careerops_qa_app');
    expect(c.query.mock.calls.every(([sql]) => /^(SELECT|SHOW)/.test(sql))).toBe(true);
  });
  it.each([0, 1])('rejects the observed schema ALL PRIVILEGES even with partial_revokes=%s', async mode => {
    const schema = mode ? 'careerops_qa' : 'careerops\\_qa';
    const c = { query: vi.fn(async sql => sql.startsWith('SHOW GRANTS') ? [[{ grant: `GRANT ALL PRIVILEGES ON \`${schema}\`.* TO 'careerops_qa_app'@'%'` }]] :
      [[{ db: 'careerops_qa', server_uuid: QA_UUID, authenticated_account: 'careerops_qa_app@%', partial_revokes: mode }]]) };
    await expect(verifyQaConnection(c, QA_UUID, 'careerops_qa_app')).rejects.toThrow('privileges');
  });
});
