import { digest, REFRESH_TABLES, sanitizeDataset } from '../../src/qaDataset.js';
import { createRefreshPlan } from '../../src/qaRefresh.js';
import { QA_UUID, LOCAL_UUID } from './qaFixture.js';
export const column = (name, type = 'varchar(100)', nullable = true, extra = '') => ({ name, type, nullable, default: null, extra, collation: type.startsWith('varchar') ? 'utf8mb4_0900_ai_ci' : null });
export const hashRows = rows => digest(rows.map(r => JSON.stringify(r)).sort());
export function fixture() {
  const schemas = {
    recruiter_tracker: [column('id', 'int', false, 'auto_increment'), column('recruiter_name'), column('company'), column('industry'), column('email'), column('phone'), column('address'), column('notes'), column('website'), column('location'), column('requisition_id'), column('reported_to_unemployment')],
    weekly_reports: [column('id', 'int', false, 'auto_increment'), column('week_start', 'date'), column('week_end', 'date'), column('submitted', 'tinyint'), column('submitted_at', 'datetime')],
    report_job_contacts: [column('report_id', 'int', false), column('recruiter_tracker_id', 'int', false)]
  };
  const raw = { schemas, source: { kind: 'verified-local-restore', snapshotSha256: digest('synthetic snapshot'), stateHash: digest('synthetic restore'), serverUuid: LOCAL_UUID }, data: {
    recruiter_tracker: [{ id: 1, recruiter_name: 'PRIVATE_SENTINEL', company: 'PRIVATE_COMPANY', industry: 'private industry', email: 'private@example.invalid', phone: 'private phone', address: 'private address', notes: 'private notes', website: 'private url', location: 'private location', requisition_id: 'private requisition', reported_to_unemployment: 'Yes' }],
    weekly_reports: [{ id: 2, week_start: '2026-10-01', week_end: '2026-10-07', submitted: 1, submitted_at: '2026-10-07 01:01:01' }],
    report_job_contacts: [{ report_id: 2, recruiter_tracker_id: 1 }]
  } };
  const { orphanAudit: _audit, ...bundle } = sanitizeDataset(raw, 0);
  const tables = {};
  const rows = {};
  for (const table of [...REFRESH_TABLES, 'users', 'validation_runs', 'visitor_analytics', 'analytics_heartbeat_events']) {
    rows[table] = REFRESH_TABLES.includes(table) ? [] : [{ id: 3, value: `synthetic-${table}` }];
    tables[table] = { engine: 'InnoDB', definitionHash: digest(`SYNTHETIC_DDL_${table}`), columns: schemas[table] || [column('id', 'int', false), column('value')],
      autoIncrement: table === 'report_job_contacts' ? null : '1000', count: rows[table].length, contentHash: hashRows(rows[table]) };
  }
  const audit = { database: 'careerops_qa', serverUuid: QA_UUID, tables, foreignKeys: [] };
  const backupBytes = Buffer.from('SYNTHETIC_BACKUP_NOT_SQL');
  const now = Date.now();
  const manifest = { version: 1, target: { database: 'careerops_qa', environment: 'qa', host: '127.0.0.1', port: 3306, user: 'qa_fixture',
    projectId: QA_UUID, environmentId: QA_UUID, serviceId: QA_UUID, serverUuid: QA_UUID },
    source: { kind: 'verified-local-restore', snapshotSha256: raw.source.snapshotSha256, restoreEvidenceSha256: digest(raw.source), expectedOrphans: 0 },
    privacy: { owner: 'synthetic-owner', reviewedFields: Object.fromEntries(REFRESH_TABLES.map(t => [t, schemas[t].map(c => c.name)])) },
    expectedCounts: Object.fromEntries(REFRESH_TABLES.map(t => [t, 1])),
    backup: { sha256: digest(backupBytes), targetServerUuid: QA_UUID, createdAt: new Date(now - 10000).toISOString() },
    rollback: { owner: 'synthetic-owner', restoreProcedureReviewed: true, writersQuiesced: true, dependencyReviewApproved: true } };
  const restore = { passed: true, backupSha256: manifest.backup.sha256, targetStateHash: digest(audit), restoredStateHash: digest('synthetic restored state'),
    localServerUuid: LOCAL_UUID, verifiedAt: new Date(now - 5000).toISOString() };
  const plan = createRefreshPlan(bundle, manifest, audit, backupBytes, restore, now);
  const approval = mode => ({ owner: 'synthetic-owner', operation: mode, planHash: plan.planHash, approvedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString(), maintenanceWindow: true });
  return { raw, bundle, manifest, audit, rows, backupBytes, restore, plan, approval, now };
}
