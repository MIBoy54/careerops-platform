// Offline evidence review only. No filesystem, SQL, network, subprocess or runtime
// imports. This report is not a restore receipt, refresh plan or authorization.
import { createHash } from 'node:crypto';
export const RECOVERY_TABLES = Object.freeze(['analytics_heartbeat_events', 'demo_refresh_history', 'recruiter_tracker',
  'report_job_contacts', 'users', 'validation_runs', 'visitor_analytics', 'weekly_reports']);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const version = value => typeof value === 'string' && /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const counter = value => value === null || (typeof value === 'string' && /^[1-9]\d*$/.test(value));
const tableNamesMatch = tables => tables && Object.keys(tables).sort().join('|') === [...RECOVERY_TABLES].sort().join('|');

export function reviewRecoveryEvidence(evidence) {
  const e = evidence ?? {};
  const blockers = [];
  const check = (condition, code) => { if (!condition) blockers.push(code); };
  const source = e.source, restored = e.restore, artifacts = e.artifacts, baseline = e.baseline;
  check(e.version === 1, 'evidence-format');
  check(sha(artifacts?.backupSha256) && sha(artifacts?.preservationInventorySha256) &&
    artifacts?.preserved === true && artifacts?.checksumVerified === true, 'artifact-preservation-and-checksum');
  const sourceTablesValid = tableNamesMatch(source?.tables);
  const restoreTablesValid = tableNamesMatch(restored?.tables);
  check(sourceTablesValid && restoreTablesValid, 'complete-eight-table-inventory');
  check(source?.database === 'careerops_qa' && uuid(source?.serverUuid), 'source-identity');
  check(restored?.database === 'careerops_qa_restore_validation' && uuid(restored?.serverUuid) &&
    ['127.0.0.1', '::1'].includes(restored?.host), 'local-restore-identity');
  const isolation = restored?.isolation;
  const existing = isolation?.existingLocalServerUuids;
  check(isolation?.newInstance === true && isolation?.inventoryComplete === true && isolation?.dedicatedDataDirectory === true &&
    isolation?.dedicatedEndpoint === true && Array.isArray(existing) && existing.length > 0 && existing.every(uuid) &&
    uuid(restored?.serverUuid) && uuid(source?.serverUuid) && restored.serverUuid.toLowerCase() !== source.serverUuid.toLowerCase() &&
    !existing.some(id => id.toLowerCase() === restored.serverUuid.toLowerCase()), 'separate-instance-required');
  check(sha(restored?.backupSha256) && restored.backupSha256 === artifacts?.backupSha256, 'restored-backup-binding');
  check(baseline?.writersQuiesced === true && baseline?.ddlFrozen === true && sha(baseline?.beforeStateSha256) &&
    baseline.beforeStateSha256 === baseline.afterStateSha256 && sourceTablesValid && baseline.beforeStateSha256 === hash(source.tables),
  'quiesced-source-baseline');
  // Matching totals or a newer version alone never qualify recovery. A cross-
  // version restore needs a separate compatibility review and same-version proof.
  const versions = [source?.serverVersion, source?.dumpClientVersion, restored?.serverVersion, restored?.importClientVersion];
  check(versions.every(version) && versions.every(v => v === versions[0]), 'exact-version-qualification-required');
  check(sha(source?.contentMethodSha256) && source.contentMethodSha256 === restored?.contentMethodSha256, 'content-method-binding');
  if (sourceTablesValid && restoreTablesValid) {
    for (const table of RECOVERY_TABLES) {
      const a = source.tables[table], b = restored.tables[table];
      const metadata = t => t?.engine === 'InnoDB' && t.kind === 'BASE TABLE' && count(t.rowCount) &&
        count(t.columnCount) && t.columnCount > 0 && count(t.indexCount) && sha(t.ddlSha256) && sha(t.contentSha256) && counter(t.autoIncrement);
      check(metadata(a) && metadata(b), `table-metadata:${table}`);
      // ddlSha256 is of exact SHOW CREATE TABLE output, with no counter/default/
      // collation/index normalization. Missing values cannot count as equality.
      check(sha(a?.ddlSha256) && a.ddlSha256 === b?.ddlSha256, `exact-ddl:${table}`);
      check(sha(a?.contentSha256) && a.contentSha256 === b?.contentSha256 && count(a?.rowCount) && a.rowCount === b?.rowCount,
        `exact-content:${table}`);
      check(count(a?.columnCount) && a.columnCount === b?.columnCount && count(a?.indexCount) && a.indexCount === b?.indexCount,
        `structural-counts:${table}`);
      check(counter(a?.autoIncrement) && a.autoIncrement === b?.autoIncrement, `exact-counter:${table}`);
    }
  }
  return { kind: 'recovery-evidence-review-only', readyForOwnerReview: blockers.length === 0,
    authorizesOperations: false, gateClosed: false, blockers, evidenceSha256: hash(e) };
}
