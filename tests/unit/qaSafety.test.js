import { describe, it, expect, vi } from 'vitest';
import { fixture, column } from '../helpers/qaRefreshFixture.js';
import { qaBindings, QA_UUID } from '../helpers/qaFixture.js';
import { loadEnvironment, resolveEnvironment, createDatabaseRuntime } from '../../src/environment.js';
import { verifyQaConnection, QA_TABLES } from '../../src/qaIdentity.js';
import { isSafeSchemaGrant } from '../../src/devGrantValidation.js';
import { digest, sanitizeDataset, verifySanitized, checkSchemaCompatibility } from '../../src/qaDataset.js';
import { createRefreshPlan, validateRestore, assertApproval } from '../../src/qaRefresh.js';

const qa = extra => ({ APP_ENV: 'qa', DB_HOST: 'mock-deployment', DB_USER: 'careerops_dev_app', DB_PASSWORD: 'PRIVATE_PASSWORD', DB_PORT: '3306',
  SESSION_SECRET: 'PRIVATE_SESSION_SECRET', BUILD_COMMIT_SHA: 'a'.repeat(40), ...qaBindings(), ...extra });
const rebuild = f => createRefreshPlan(f.bundle, f.manifest, f.audit, f.backupBytes, f.restore, f.now);
describe('QA runtime isolation', () => {
  it('never reads dotenv on Railway QA; inherited values are the complete configuration', () => {
    const loader = vi.fn(); const env = qa(); loadEnvironment(env, loader, '/synthetic');
    expect(loader).not.toHaveBeenCalled(); expect(resolveEnvironment(env).database).toBe('careerops_qa');
  });
  it.each(['RAILWAY_PROJECT_ID', 'RAILWAY_ENVIRONMENT_ID', 'RAILWAY_SERVICE_ID', 'QA_EXPECTED_RAILWAY_PROJECT_ID', 'QA_EXPECTED_DB_SERVER_UUID', 'QA_EXPECTED_DB_HOST', 'DB_NAME', 'DB_USER'])('fails closed on missing/conflicting %s', key => {
    expect(() => resolveEnvironment(qa({ [key]: undefined }))).toThrow();
    expect(() => resolveEnvironment(qa({ [key]: 'mismatch_PRIVATE_PASSWORD' }))).toThrow();
    try { resolveEnvironment(qa({ [key]: 'mismatch_PRIVATE_PASSWORD' })); } catch (error) { expect(error.message).not.toContain('PRIVATE_PASSWORD'); }
  });
  it.each([{ DATABASE_URL: 'SECRET_URL' }, { MYSQLHOST: 'prod' }, { DEMO_DB_HOST: 'demo' }, { DB_USER: 'root', QA_EXPECTED_DB_USER: 'root' }, { RAILWAY_ENVIRONMENT_NAME: 'production' }, { DEMO_SYNC_ENABLED: 'true' }])('rejects alternate QA routing %#', change => expect(() => resolveEnvironment(qa(change))).toThrow());
  it.each(['railway', 'careerops', 'careerops_dev', 'careerops_demo'])('rejects grants to %s even with a QA schema selected', schema => {
    expect(isSafeSchemaGrant(`GRANT SELECT ON \`${schema}\`.* TO 'fixture'@'localhost'`, true, 'careerops_qa')).toBe(false);
  });
  it('rejects wildcard, DDL, role and grant-option privileges', () => {
    for (const grant of ["GRANT SELECT ON `careerops_qa`.* TO 'f'@'localhost'", "GRANT ALL PRIVILEGES ON *.* TO 'f'@'localhost'", "GRANT CREATE ON `careerops\\_qa`.* TO 'f'@'localhost'", "GRANT 'role' TO 'f'@'localhost'", "GRANT SELECT ON `careerops\\_qa`.* TO 'f'@'localhost' WITH GRANT OPTION"]) expect(isSafeSchemaGrant(grant, false, 'careerops_qa')).toBe(false);
  });
  it.each(QA_TABLES)('missing %s blocks QA startup and emits no driver secrets', async missing => {
    const connection = { query: vi.fn(async sql => {
      if (sql === 'SELECT DATABASE() AS db') return [[{ db: 'careerops_qa' }]];
      if (sql.includes('@@server_uuid')) return [[{ db: 'careerops_qa', server_uuid: QA_UUID, partial_revokes: 0 }]];
      if (sql.startsWith('SHOW GRANTS')) return [[{ grant: "GRANT SELECT ON `careerops\\_qa`.* TO 'fixture'@'localhost'" }]];
      if (sql.includes(`\`${missing}\``)) throw new Error('PRIVATE_PASSWORD');
      return [[]];
    }), release: vi.fn() };
    const pool = { getConnection: async () => connection, end: vi.fn() };
    await expect(createDatabaseRuntime({ createPool: () => pool }, resolveEnvironment(qa()))).rejects.toThrow(/^QA database readiness validation failed$/);
    expect(pool.end).toHaveBeenCalled(); expect(connection.release).toHaveBeenCalled();
  });
  it('rejects a mismatched physical server identity before table reads', async () => {
    const query = vi.fn(async () => [[{ db: 'careerops_qa', server_uuid: 'wrong', partial_revokes: 0 }]]);
    await expect(verifyQaConnection({ query }, QA_UUID)).rejects.toThrow('identity'); expect(query).toHaveBeenCalledTimes(1);
  });
});
describe('local dataset privacy, schema and recovery gates', () => {
  it('masks every supported private field, keeping only synthetic values and relationships', () => {
    const f = fixture(); const serialized = JSON.stringify(f.bundle.data);
    for (const sentinel of ['PRIVATE_SENTINEL', 'PRIVATE_COMPANY', 'private', '2026-10', 'Yes']) expect(serialized).not.toContain(sentinel);
    expect(f.bundle.data.recruiter_tracker[0].industry).toBe('QA');
    expect(() => verifySanitized(f.bundle, f.manifest.privacy.reviewedFields)).not.toThrow();
  });
  it.each(['company', 'website', 'location', 'requisition_id', 'reported_to_unemployment', 'email', 'notes'])('rejects unsanitized %s', key => {
    const f = fixture(); f.bundle.data.recruiter_tracker[0][key] = 'PRIVATE_VALUE'; expect(() => rebuild(f)).toThrow('redaction');
  });
  it('requires every field to be classified and explicitly reviewed', () => {
    const f = fixture(); f.manifest.privacy.reviewedFields.recruiter_tracker.pop(); expect(() => rebuild(f)).toThrow('privacy review');
    f.raw.schemas.recruiter_tracker.push(column('unknown_private_field')); expect(() => sanitizeDataset(f.raw, 0)).toThrow('unclassified');
  });
  it('removes exactly the approved source orphan count and keeps traceability separate', () => {
    const f = fixture(); f.raw.data.report_job_contacts.push({ report_id: 99, recruiter_tracker_id: 99 });
    expect(() => sanitizeDataset(f.raw, 0)).toThrow('orphan mismatch');
    const cleaned = sanitizeDataset(f.raw, 1); expect(cleaned.data.report_job_contacts).toHaveLength(1);
    expect(cleaned.orphanAudit).toEqual([{ report_id: 99, recruiter_tracker_id: 99 }]);
    expect(() => sanitizeDataset(f.raw, 44)).toThrow();
  });
  it.each(['users', 'sessions', 'visitor_analytics', 'validation_runs', 'legacy_backup', 'demo_history'])('never imports %s', table => {
    const f = fixture(); f.raw.data[table] = [{ private: true }]; expect(() => sanitizeDataset(f.raw, 0)).toThrow('allowlist');
  });
  it('permits omitted date_reported only with nullable NULL default', () => {
    const f = fixture(); const target = structuredClone(f.bundle.schemas); target.recruiter_tracker.push(column('date_reported', 'date'));
    expect(() => checkSchemaCompatibility(f.bundle.schemas, target, f.bundle.data)).not.toThrow();
    target.recruiter_tracker.at(-1).nullable = false; expect(() => checkSchemaCompatibility(f.bundle.schemas, target, f.bundle.data)).toThrow('extra');
  });
  it('checks missing and extra columns in both directions and actual industry lengths', () => {
    const f = fixture(); const target = structuredClone(f.bundle.schemas); target.recruiter_tracker = target.recruiter_tracker.filter(c => c.name !== 'company');
    expect(() => checkSchemaCompatibility(f.bundle.schemas, target, f.bundle.data)).toThrow('missing');
    target.recruiter_tracker.push(column('comp_range')); expect(() => checkSchemaCompatibility(f.bundle.schemas, target, f.bundle.data)).toThrow();
    const sized = structuredClone(f.bundle.schemas); sized.recruiter_tracker.find(c => c.name === 'industry').type = 'varchar(50)';
    expect(() => checkSchemaCompatibility(f.bundle.schemas, sized, f.bundle.data)).not.toThrow();
    f.bundle.data.recruiter_tracker[0].industry = 'a'.repeat(51); expect(() => checkSchemaCompatibility(f.bundle.schemas, sized, f.bundle.data)).toThrow('width');
  });
  it.each(['missing backup', 'bad checksum', 'stale backup', 'unverified restore', 'restore mismatch', 'zero rows', 'wrong counts', 'missing QA table', 'low counter', 'source mismatch', 'rollback missing'])('stops for %s', kind => {
    const f = fixture();
    if (kind === 'missing backup') f.backupBytes = null;
    if (kind === 'bad checksum') f.backupBytes = Buffer.from('changed');
    if (kind === 'stale backup') f.manifest.backup.createdAt = '2000-01-01T00:00:00Z';
    if (kind === 'unverified restore') f.restore.passed = false;
    if (kind === 'restore mismatch') f.restore.targetStateHash = digest('wrong');
    if (kind === 'zero rows') f.bundle.data.weekly_reports = [];
    if (kind === 'wrong counts') f.manifest.expectedCounts.weekly_reports = 2;
    if (kind === 'missing QA table') delete f.audit.tables.validation_runs;
    if (kind === 'low counter') { f.audit.tables.recruiter_tracker.autoIncrement = '1'; f.restore.targetStateHash = digest(f.audit); }
    if (kind === 'source mismatch') f.bundle.source.snapshotSha256 = digest('changed');
    if (kind === 'rollback missing') f.manifest.rollback.writersQuiesced = false;
    expect(() => rebuild(f)).toThrow();
  });
  it('checks actual isolated restore schemas, contents and backup bytes', () => {
    const f = fixture(); const restored = structuredClone(f.audit); restored.database = 'careerops_qa_restore_validation'; restored.serverUuid = '22222222-2222-4222-8222-222222222222';
    const local = { host: '127.0.0.1', database: restored.database, serverUuid: restored.serverUuid };
    expect(validateRestore(f.audit, restored, f.manifest.backup, f.backupBytes, local).passed).toBe(true);
    restored.tables.users.contentHash = digest('lost auth');
    expect(() => validateRestore(f.audit, restored, f.manifest.backup, f.backupBytes, local)).toThrow('restore schema or content');
  });
  it.each([undefined, {}, { owner: 'operator' }])('requires separate operation-scoped approval %#', approval => {
    const f = fixture(); expect(() => assertApproval(approval, 'commit', f.plan.planHash, f.now)).toThrow('approval');
    expect(() => assertApproval(f.approval('rehearse'), 'commit', f.plan.planHash, f.now)).toThrow('approval');
  });
});

describe('QA telemetry errors and log privacy', () => {
  it('returns a real 500 for missing telemetry without logging connection strings or data', async () => {
    const { createRuntimeLogger } = await import('../../src/runtimeLogger.js');
    const { createSessionTrendHandler } = await import('../../src/sessionTrend.js');
    const sink = { log: vi.fn(), error: vi.fn() }; const logger = createRuntimeLogger('qa', sink);
    logger.log('PRIVATE_USER', { password: 'PRIVATE_PASSWORD' });
    const pool = { query: vi.fn().mockRejectedValue(new Error('PRIVATE_URL PRIVATE_SESSION')) };
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await createSessionTrendHandler(pool, () => '+00:00', err => logger.error('trend', err))({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify([sink.log.mock.calls, sink.error.mock.calls, res.json.mock.calls])).not.toMatch(/PRIVATE/);
    const baseline = createRuntimeLogger('production', sink); baseline.log('baseline', 42);
    expect(sink.log).toHaveBeenLastCalledWith('baseline', 42);
  });
});
