import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { reviewRecoveryEvidence, RECOVERY_TABLES } from '../../src/qaRecoveryReview.js';
import { discoveryFixture } from '../helpers/qaDiscoveryFixture.js';
import { validateRestore } from '../../src/qaRefresh.js';
import { QA_UUID, LOCAL_UUID } from '../helpers/qaFixture.js';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const NEW_UUID = '33333333-3333-4333-8333-333333333333';
function evidence() {
  const columns = [8, 5, 20, 4, 5, 10, 8, 5]; // 65 total; supported illustrative metadata, not unseen live DDL.
  const indexes = [1, 2, 1, 1, 2, 1, 1, 1]; // 10 total.
  const rows = [674, 0, 0, 0, 2, 0, 10, 0];
  const tables = Object.fromEntries(RECOVERY_TABLES.map((name, i) => [name, {
    engine: 'InnoDB', kind: 'BASE TABLE', rowCount: rows[i], columnCount: columns[i], indexCount: indexes[i],
    ddlSha256: digest(`synthetic exact DDL ${name} DEFAULT NULL COLLATE utf8mb4_0900_ai_ci AUTO_INCREMENT=1`),
    contentSha256: digest(Array.from({ length: rows[i] }, (_, n) => [n, `synthetic-${name}-${n}`])),
    autoIncrement: ['recruiter_tracker', 'weekly_reports', 'report_job_contacts'].includes(name) ? '1' : null
  }]));
  const source = { database: 'careerops_qa', serverUuid: QA_UUID, serverVersion: '9.7.0', dumpClientVersion: '9.7.0',
    contentMethodSha256: digest('synthetic typed multiset comparison procedure v1'), tables };
  return { version: 1, artifacts: { backupSha256: digest('synthetic backup bytes only'), preservationInventorySha256: digest('synthetic preservation ledger'), preserved: true, checksumVerified: true },
    baseline: { writersQuiesced: true, ddlFrozen: true, beforeStateSha256: digest(tables), afterStateSha256: digest(tables) }, source,
    restore: { ...structuredClone(source), database: 'careerops_qa_restore_validation', host: '127.0.0.1', serverUuid: NEW_UUID,
      importClientVersion: '9.7.0', backupSha256: digest('synthetic backup bytes only'),
      isolation: { newInstance: true, inventoryComplete: true, dedicatedDataDirectory: true, dedicatedEndpoint: true, existingLocalServerUuids: [LOCAL_UUID] } } };
}
describe('offline exact recovery evidence review', () => {
  it('reviews matching 8-table/686-row/65-column/10-index evidence without authorizing operations or changing inputs', () => {
    const e = evidence(), before = structuredClone(e), result = reviewRecoveryEvidence(e);
    expect(Object.values(e.source.tables).reduce((n, t) => n + t.rowCount, 0)).toBe(686);
    expect(Object.values(e.source.tables).reduce((n, t) => n + t.columnCount, 0)).toBe(65);
    expect(Object.values(e.source.tables).reduce((n, t) => n + t.indexCount, 0)).toBe(10);
    expect(result.readyForOwnerReview).toBe(true); expect(result.gateClosed).toBe(false); expect(result.authorizesOperations).toBe(false);
    expect(result).not.toHaveProperty('planHash'); expect(result).not.toHaveProperty('passed'); expect(e).toEqual(before);
  });
  it.each(RECOVERY_TABLES)('rejects same-count but different DDL or content in %s', table => {
    const e = evidence(); e.restore.tables[table].ddlSha256 = digest('synthetic default/index/collation drift');
    e.restore.tables[table].contentSha256 = digest('synthetic same-count content drift');
    const result = reviewRecoveryEvidence(e);
    expect(result.blockers).toContain(`exact-ddl:${table}`); expect(result.blockers).toContain(`exact-content:${table}`);
  });
  it('rejects shifted per-table rows, columns and indexes even when all aggregate totals match', () => {
    const e = evidence();
    for (const key of ['rowCount', 'columnCount', 'indexCount']) { e.restore.tables.users[key]--; e.restore.tables.visitor_analytics[key]++; }
    const result = reviewRecoveryEvidence(e);
    expect(result.blockers).toContain('exact-content:users'); expect(result.blockers).toContain('structural-counts:visitor_analytics');
  });
  it('rejects increased counters for exact review even though the basic restore validator permits nonregression', () => {
    const e = evidence(); e.restore.tables.recruiter_tracker.autoIncrement = '2';
    expect(reviewRecoveryEvidence(e).blockers).toContain('exact-counter:recruiter_tracker');
    const f = discoveryFixture(); const restored = structuredClone(f.audit);
    restored.serverUuid = LOCAL_UUID; restored.database = 'careerops_qa_restore_validation'; restored.tables.recruiter_tracker.autoIncrement = '2';
    expect(validateRestore(f.audit, restored, f.manifest.backup, f.backupBytes,
      { host: '127.0.0.1', database: restored.database, serverUuid: LOCAL_UUID }).passed).toBe(true);
  });
  it.each(['same-port', 'different-port'])('rejects another schema on the existing local instance (%s)', port => {
    const e = evidence(); e.restore.portDescription = port; e.restore.serverUuid = LOCAL_UUID;
    expect(reviewRecoveryEvidence(e).blockers).toContain('separate-instance-required');
  });
  it('rejects same source UUID, including case changes, despite fresh-instance claims', () => {
    const e = evidence(); e.restore.serverUuid = QA_UUID.toUpperCase();
    expect(reviewRecoveryEvidence(e).blockers).toContain('separate-instance-required');
  });
  it.each(['newInstance', 'inventoryComplete', 'dedicatedDataDirectory', 'dedicatedEndpoint'])('requires independently reviewed isolation evidence: %s', key => {
    const e = evidence(); e.restore.isolation[key] = false;
    expect(reviewRecoveryEvidence(e).blockers).toContain('separate-instance-required');
  });
  it('keeps 9.6-to-9.7 and reverse trials blocked even when DDL and data match', () => {
    for (const [source, target] of [['9.6.0', '9.7.0'], ['9.7.0', '9.6.0']]) {
      const e = evidence(); e.source.serverVersion = source; e.source.dumpClientVersion = source;
      e.restore.serverVersion = target; e.restore.importClientVersion = target;
      expect(reviewRecoveryEvidence(e).blockers).toContain('exact-version-qualification-required');
    }
  });
  it.each(['9.6.0', '9.7', 'unknown', undefined])('does not infer dump/import compatibility from version %s', v => {
    const e = evidence(); e.source.dumpClientVersion = v; e.restore.importClientVersion = v;
    expect(reviewRecoveryEvidence(e).blockers).toContain('exact-version-qualification-required');
  });
  it('does not certify an older same-version recovery as QA upgrade readiness', () => {
    const e = evidence(); e.source.serverVersion = e.source.dumpClientVersion = e.restore.serverVersion = e.restore.importClientVersion = '9.6.0';
    const result = reviewRecoveryEvidence(e); expect(result.readyForOwnerReview).toBe(true); expect(result.authorizesOperations).toBe(false);
  });
  it.each(['preserved', 'checksumVerified'])('blocks missing artifact evidence without modifying artifacts: %s', key => {
    const e = evidence(); e.artifacts[key] = false;
    expect(reviewRecoveryEvidence(e).blockers).toContain('artifact-preservation-and-checksum');
  });
  it('rejects missing hash evidence, unknown/missing tables, changed telemetry and a nonquiesced baseline', () => {
    const e = evidence(); delete e.restore.tables.demo_refresh_history; e.restore.tables.unreviewed = e.source.tables.users;
    expect(reviewRecoveryEvidence(e).blockers).toContain('complete-eight-table-inventory');
    const live = evidence(); live.baseline.writersQuiesced = false; live.baseline.afterStateSha256 = digest('synthetic heartbeat arrived');
    expect(reviewRecoveryEvidence(live).blockers).toContain('quiesced-source-baseline');
    const missing = evidence(); delete missing.source.tables.users.ddlSha256; delete missing.restore.tables.users.ddlSha256;
    expect(reviewRecoveryEvidence(missing).blockers).toContain('exact-ddl:users');
  });
  it('binds the restored file and comparison method without echoing unknown sensitive fields', () => {
    const e = evidence(); e.restore.backupSha256 = digest('different synthetic file'); e.restore.contentMethodSha256 = digest('different comparison method');
    e.privateUnknownField = 'SYNTHETIC_PRIVATE_SENTINEL';
    const result = reviewRecoveryEvidence(e);
    expect(result.blockers).toContain('restored-backup-binding'); expect(result.blockers).toContain('content-method-binding');
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_SENTINEL');
  });
  it('fails closed for aggregate-only preliminary evidence and absent evidence', () => {
    expect(reviewRecoveryEvidence({ version: 1, tables: 8, rows: 686, columns: 65, indexes: 10 }).readyForOwnerReview).toBe(false);
    expect(reviewRecoveryEvidence().readyForOwnerReview).toBe(false);
  });
});
