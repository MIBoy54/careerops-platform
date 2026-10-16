import { fixture, column, hashRows } from './qaRefreshFixture.js';
import { digest, REFRESH_TABLES, sanitizeDataset } from '../../src/qaDataset.js';

// Synthetic 20/4/5-column shape, not a substitute for the missing full live DDL.
// Counts reproduce the owner's point-in-time inventory; every record is invented.
export function discoveryFixture({ preparedCounters = false } = {}) {
  const f = fixture();
  const schemas = {
    recruiter_tracker: [column('id', 'int', false, 'auto_increment'), column('date_contacted', 'date'),
      ...['recruiter_name', 'company', 'role_level', 'role_type', 'location', 'comp_range', 'status', 'relationship_status',
        'reported_to_unemployment'].map(name => column(name)), column('follow_up_date', 'date'),
      ...['phone', 'email', 'address', 'website', 'notes', 'industry', 'requisition_id'].map(name => column(name)),
      column('created_at', 'timestamp')],
    report_job_contacts: [column('id', 'int', false, 'auto_increment'), column('report_id', 'int', false),
      column('recruiter_tracker_id', 'int', false), { ...column('created_at', 'timestamp', true, 'DEFAULT_GENERATED'), default: 'CURRENT_TIMESTAMP' }],
    weekly_reports: [column('id', 'int', false, 'auto_increment'), column('week_start', 'date'), column('week_end', 'date'),
      column('submitted', 'tinyint'), column('submitted_at', 'datetime')]
  };
  f.raw.schemas = schemas;
  f.raw.data = Object.fromEntries(REFRESH_TABLES.map(table => [table, [Object.fromEntries(schemas[table].map(c => [c.name, null]))]]));
  Object.assign(f.raw.data.recruiter_tracker[0], { id: 113, recruiter_name: 'SYNTHETIC_PRIVATE', industry: 'synthetic-private' });
  Object.assign(f.raw.data.weekly_reports[0], { id: 907, submitted: 1 });
  Object.assign(f.raw.data.report_job_contacts[0], { id: 9021, report_id: 907, recruiter_tracker_id: 113, created_at: null });
  const { orphanAudit: _orphanAudit, ...bundle } = sanitizeDataset(f.raw, 0);
  f.bundle = bundle;
  const counts = { users: 2, validation_runs: 0, visitor_analytics: 10, analytics_heartbeat_events: 674, demo_refresh_history: 0 };
  f.rows = {};
  f.audit.tables = {};
  for (const table of [...REFRESH_TABLES, ...Object.keys(counts)]) {
    f.rows[table] = REFRESH_TABLES.includes(table) ? [] : Array.from({ length: counts[table] }, (_, i) => ({ id: i + 1, value: `synthetic-${table}-${i + 1}` }));
    f.audit.tables[table] = { engine: 'InnoDB', definitionHash: digest(`SYNTHETIC_DDL_${table}`),
      columns: schemas[table] || [column('id', 'int', false), column('value')],
      autoIncrement: REFRESH_TABLES.includes(table) ? (preparedCounters ? '10000' : '1') : null,
      count: f.rows[table].length, contentHash: hashRows(f.rows[table]) };
  }
  f.audit.foreignKeys = []; // Logical checks are mandatory without declared FKs.
  f.manifest.privacy.reviewedFields = Object.fromEntries(REFRESH_TABLES.map(t => [t, schemas[t].map(c => c.name)]));
  f.restore.targetStateHash = digest(f.audit);
  delete f.plan;
  return f;
}
