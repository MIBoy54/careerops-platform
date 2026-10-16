import { createHash } from 'node:crypto';

export const REFRESH_TABLES = Object.freeze(['recruiter_tracker', 'weekly_reports', 'report_job_contacts']);
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export function requireGate(condition, code) { if (!condition) throw new Error(`QA gate failed: ${code}`); }
const sameKeys = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const date = '2000-01-01';
const recruiter = {
  id: r => r.id, recruiter_name: r => `Recruiter ${r.id}`, company: r => `Company ${r.id}`,
  phone: () => null, email: () => null, address: () => null, notes: () => null,
  website: () => null, location: () => null, requisition_id: () => null,
  comp_range: () => null, role_level: () => null, role_type: () => null,
  industry: r => r.industry === null ? null : 'QA', status: () => 'New',
  relationship_status: () => 'New', reported_to_unemployment: () => 'No',
  date_contacted: () => date, follow_up_date: () => null, date_reported: () => null,
  created_at: () => `${date} 00:00:00`, updated_at: () => `${date} 00:00:00`
};
const weekly = {
  id: r => r.id, week_start: r => new Date(Date.UTC(2000, 0, 3 + r.id * 7)).toISOString().slice(0, 10),
  week_end: r => new Date(Date.UTC(2000, 0, 9 + r.id * 7)).toISOString().slice(0, 10),
  submitted: () => 0, submitted_at: () => null, created_at: () => `${date} 00:00:00`
};
const contact = { id: r => r.id, report_id: r => r.report_id, recruiter_tracker_id: r => r.recruiter_tracker_id,
  created_at: () => `${date} 00:00:00` };
export const FIELD_POLICY = Object.freeze({ recruiter_tracker: recruiter, weekly_reports: weekly, report_job_contacts: contact });

export function assertTableSchemas(schemas) {
  requireGate(schemas && sameKeys(Object.keys(schemas), REFRESH_TABLES), 'table allowlist');
  for (const table of REFRESH_TABLES) {
    const columns = schemas[table];
    requireGate(Array.isArray(columns) && columns.length > 0, 'schema missing');
    requireGate(new Set(columns.map(c => c.name)).size === columns.length, 'duplicate columns');
    for (const c of columns) {
      requireGate(Object.hasOwn(FIELD_POLICY[table], c.name), 'unclassified field');
      requireGate(typeof c.type === 'string' && typeof c.nullable === 'boolean' && Object.hasOwn(c, 'default'), 'column metadata');
      requireGate(!c.extra || c.extra === 'auto_increment', 'generated or unknown column');
    }
    const names = columns.map(c => c.name);
    for (const name of table === 'report_job_contacts' ? ['report_id', 'recruiter_tracker_id'] : ['id']) {
      requireGate(names.includes(name), 'required key column');
    }
  }
}

function assertRows(schemas, data) {
  requireGate(data && sameKeys(Object.keys(data), REFRESH_TABLES), 'data table allowlist');
  for (const table of REFRESH_TABLES) {
    requireGate(Array.isArray(data[table]) && data[table].length > 0, 'zero rows');
    const ids = new Set();
    for (const row of data[table]) {
      requireGate(sameKeys(Object.keys(row), schemas[table].map(c => c.name)), 'row columns');
      for (const key of ['id', 'report_id', 'recruiter_tracker_id'].filter(k => Object.hasOwn(row, k))) {
        requireGate(Number.isSafeInteger(row[key]) && row[key] > 0 && row[key] < 10000000, 'key range');
      }
      const key = table === 'report_job_contacts' ? `${row.report_id}:${row.recruiter_tracker_id}` : row.id;
      requireGate(!ids.has(key), 'duplicate keys'); ids.add(key);
    }
  }
}

// Input is an export of only these tables from a verified LOCAL restore. Never
// accepts SQL, credentials, users, sessions, analytics or an arbitrary transform.
export function sanitizeDataset(input, expectedOrphans) {
  assertTableSchemas(input.schemas);
  assertRows(input.schemas, input.data);
  requireGate(Number.isSafeInteger(expectedOrphans) && expectedOrphans >= 0, 'orphan expectation');
  const reports = new Set(input.data.weekly_reports.map(r => r.id));
  const recruiters = new Set(input.data.recruiter_tracker.map(r => r.id));
  const removed = input.data.report_job_contacts.filter(r => !reports.has(r.report_id) || !recruiters.has(r.recruiter_tracker_id));
  requireGate(removed.length === expectedOrphans, 'orphan mismatch');
  const data = {};
  for (const table of REFRESH_TABLES) {
    const rows = table === 'report_job_contacts' ? input.data[table].filter(r => !removed.includes(r)) : input.data[table];
    data[table] = rows.map(row => Object.fromEntries(input.schemas[table].map(c => [c.name, FIELD_POLICY[table][c.name](row)])));
  }
  assertRows(input.schemas, data);
  return { schemas: input.schemas, data, source: input.source, removedOrphanCount: removed.length,
    // Separate restricted local audit, never a CLI log or committed artifact.
    orphanAudit: removed.map(r => ({ report_id: r.report_id, recruiter_tracker_id: r.recruiter_tracker_id })) };
}

export function verifySanitized(bundle, reviewedFields) {
  assertTableSchemas(bundle.schemas);
  assertRows(bundle.schemas, bundle.data);
  for (const table of REFRESH_TABLES) {
    requireGate(Array.isArray(reviewedFields?.[table]) && sameKeys(reviewedFields[table], bundle.schemas[table].map(c => c.name)), 'privacy review incomplete');
    for (const row of bundle.data[table]) {
      for (const c of bundle.schemas[table]) {
        requireGate(row[c.name] === FIELD_POLICY[table][c.name](row), 'redaction mismatch');
      }
    }
  }
  const clean = sanitizeDataset(bundle, 0);
  requireGate(digest(clean.data) === digest(bundle.data), 'referential integrity');
}

// Check both directions; only the documented nullable date_reported addition is
// permitted. industry varchar width may differ only if every value fits.
export function checkSchemaCompatibility(source, target, data) {
  assertTableSchemas(source); assertTableSchemas(target);
  for (const table of REFRESH_TABLES) {
    const a = source[table], b = target[table];
    for (const c of a) requireGate(b.some(d => d.name === c.name), 'target missing column');
    for (const c of b) {
      const from = a.find(d => d.name === c.name);
      if (!from) {
        requireGate(table === 'recruiter_tracker' && c.name === 'date_reported' && c.nullable && c.default === null && !c.extra, 'target extra column');
        continue;
      }
      const industry = table === 'recruiter_tracker' && c.name === 'industry' && /^varchar\(\d+\)$/i.test(c.type) && /^varchar\(\d+\)$/i.test(from.type);
      requireGate(industry || c.type === from.type, 'column type mismatch');
      requireGate(c.extra === from.extra && c.nullable === from.nullable && c.default === from.default && c.collation === from.collation, 'column attributes mismatch');
      for (const row of data[table]) {
        const value = row[c.name];
        requireGate(c.nullable || value !== null, 'nullability');
        const width = /^(?:var)?char\((\d+)\)/i.exec(c.type);
        if (width && value !== null) requireGate(Array.from(String(value)).length <= Number(width[1]), 'column width');
      }
    }
  }
}
