import { QA_TABLES, verifyQaConnection } from './qaIdentity.js';
import { REFRESH_TABLES, digest, requireGate, verifySanitized, checkSchemaCompatibility } from './qaDataset.js';

const identifier = name => { requireGate(/^[a-z][a-z0-9_]*$/.test(name), 'unsafe identifier'); return `\`${name}\``; };
const hashPattern = /^[0-9a-f]{64}$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const stateHash = state => digest(state);
const contentHash = rows => digest(rows.map(r => JSON.stringify(r)).sort());

// Includes ALL target tables, so recovery evidence covers auth and telemetry too.
// Only digests/counts/schema leave this function; no records or credentials logged.
export async function inspectDatabase(connection, schema, lock = false) {
  const [identity] = await connection.query('SELECT DATABASE() AS db, @@server_uuid AS server_uuid');
  requireGate(identity[0]?.db === schema && uuidPattern.test(identity[0]?.server_uuid || ''), 'database identity');
  // Cached information_schema statistics can hide a newer counter and lead an
  // operator to propose lowering it. This session-only setting performs no DDL
  // or data change; unsupported servers fail closed instead of using stale data.
  await connection.query('SET SESSION information_schema_stats_expiry = 0');
  const [tables] = await connection.query(`SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_TYPE AS kind,
    AUTO_INCREMENT AS autoIncrement FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`, [schema]);
  requireGate(tables.length > 0 && tables.every(t => t.kind === 'BASE TABLE' && t.engine === 'InnoDB'), 'transactional tables required');
  const [columns] = await connection.query(`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS type,
    IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra, COLLATION_NAME AS collation
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`, [schema]);
  const [triggers] = await connection.query('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?', [schema]);
  requireGate(triggers.length === 0, 'triggers require separate review');
  const [routines] = await connection.query('SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?', [schema]);
  const [events] = await connection.query('SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?', [schema]);
  requireGate(routines.length === 0 && events.length === 0, 'routines or events require separate review');
  // Cross-schema dependencies or unknown dependencies on refreshed tables stop.
  const [foreignKeys] = await connection.query(`SELECT TABLE_SCHEMA AS childSchema, TABLE_NAME AS child,
    COLUMN_NAME AS childColumn, REFERENCED_TABLE_SCHEMA AS parentSchema, REFERENCED_TABLE_NAME AS parent,
    REFERENCED_COLUMN_NAME AS parentColumn FROM information_schema.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_NAME IS NOT NULL AND (TABLE_SCHEMA = ? OR REFERENCED_TABLE_SCHEMA = ?)
    ORDER BY TABLE_NAME, COLUMN_NAME`, [schema, schema]);
  for (const fk of foreignKeys) {
    requireGate(fk.childSchema === schema && fk.parentSchema === schema, 'cross-schema dependency');
    if (REFRESH_TABLES.includes(fk.child) || REFRESH_TABLES.includes(fk.parent)) {
      requireGate(fk.child === 'report_job_contacts' && fk.parentColumn === 'id' &&
        ((fk.parent === 'weekly_reports' && fk.childColumn === 'report_id') ||
         (fk.parent === 'recruiter_tracker' && fk.childColumn === 'recruiter_tracker_id')), 'unreviewed dependency');
    }
  }
  const result = { database: schema, serverUuid: identity[0].server_uuid, tables: {}, foreignKeys: foreignKeys.map(({ child, childColumn, parent, parentColumn }) => ({ child, childColumn, parent, parentColumn })) };
  for (const t of tables) {
    const cols = columns.filter(c => c.tableName === t.name).map(c => ({ name: c.name, type: c.type,
      nullable: c.nullable === 'YES', default: c.defaultValue, extra: c.extra, collation: c.collation }));
    requireGate(cols.length > 0, 'missing metadata');
    const [ddl] = await connection.query(`SHOW CREATE TABLE ${identifier(t.name)}`);
    const definition = ddl[0]?.['Create Table'];
    requireGate(typeof definition === 'string' && definition.length > 0, 'table definition unavailable');
    const definitionHash = digest(definition.replace(/AUTO_INCREMENT=\d+\s*/g, ''));
    const [rows] = await connection.query(`SELECT ${cols.map(c => identifier(c.name)).join(', ')} FROM ${identifier(t.name)}${lock ? ' FOR UPDATE' : ''}`);
    result.tables[t.name] = { engine: t.engine, definitionHash, columns: cols, autoIncrement: t.autoIncrement === null ? null : String(t.autoIncrement),
      count: rows.length, contentHash: contentHash(rows) };
  }
  return result;
}

export function assertInventory(target) {
  requireGate(target?.database === 'careerops_qa' && target.environment === 'qa', 'target QA only');
  for (const key of ['projectId', 'environmentId', 'serviceId', 'serverUuid']) requireGate(uuidPattern.test(target[key] || ''), 'target inventory');
  requireGate(typeof target.host === 'string' && !!target.host.trim() && typeof target.user === 'string' && !!target.user.trim() && target.user.toLowerCase() !== 'root', 'target account');
  requireGate(Number.isInteger(target.port) && target.port > 0 && target.port <= 65535, 'target port');
}
export function assertApproval(approval, operation, planHash, now = Date.now()) {
  requireGate(approval?.operation === operation && approval.planHash === planHash &&
    typeof approval.owner === 'string' && !!approval.owner.trim() &&
    Date.parse(approval.approvedAt) <= now && Date.parse(approval.expiresAt) > now &&
    Date.parse(approval.expiresAt) - Date.parse(approval.approvedAt) <= 3600000 && approval.maintenanceWindow === true,
  'separate owner approval required');
}
const schemasFrom = state => Object.fromEntries(REFRESH_TABLES.map(t => [t, state.tables[t]?.columns]));
const recoveryComparable = state => ({ ...state, database: null, serverUuid: null, tables: Object.fromEntries(Object.entries(state.tables).map(([name, t]) => [name, { ...t, autoIncrement: null }])) });

export function validateRestore(audit, restored, backup, bytes, localIdentity) {
  requireGate(bytes?.length > 0 && digest(bytes) === backup.sha256, 'backup absent or checksum mismatch');
  requireGate(localIdentity?.host === '127.0.0.1' || localIdentity?.host === '::1', 'restore must be local');
  requireGate(localIdentity.database === 'careerops_qa_restore_validation' && uuidPattern.test(localIdentity.serverUuid || '') &&
    localIdentity.serverUuid !== backup.targetServerUuid, 'isolated restore identity');
  requireGate(audit.serverUuid === backup.targetServerUuid && restored.serverUuid === localIdentity.serverUuid &&
    audit.database === 'careerops_qa' && restored.database === localIdentity.database, 'restore evidence identities');
  requireGate(digest(recoveryComparable(audit)) === digest(recoveryComparable(restored)), 'restore schema or content mismatch');
  // AUTO_INCREMENT can legitimately differ after dump/restore but cannot regress.
  for (const [name, table] of Object.entries(audit.tables)) {
    if (table.autoIncrement !== null) requireGate(BigInt(restored.tables[name].autoIncrement) >= BigInt(table.autoIncrement), 'restore counter regression');
  }
  return { backupSha256: backup.sha256, targetStateHash: stateHash(audit), restoredStateHash: stateHash(restored),
    localServerUuid: localIdentity.serverUuid, verifiedAt: new Date().toISOString(), passed: true };
}

function validateRefreshReadiness(bundle, manifest, audit, backupBytes, restore, now) {
  assertInventory(manifest.target);
  requireGate(manifest.version === 1 && manifest.source?.kind === 'verified-local-restore' &&
    hashPattern.test(manifest.source.snapshotSha256 || '') && hashPattern.test(manifest.source.restoreEvidenceSha256 || ''), 'verified local source required');
  requireGate(typeof manifest.privacy?.owner === 'string' && !!manifest.privacy.owner.trim(), 'privacy owner');
  verifySanitized(bundle, manifest.privacy.reviewedFields);
  requireGate(bundle.source?.kind === 'verified-local-restore' && bundle.source.snapshotSha256 === manifest.source.snapshotSha256 &&
    digest(bundle.source) === manifest.source.restoreEvidenceSha256 && hashPattern.test(bundle.source.stateHash || '') && uuidPattern.test(bundle.source.serverUuid || '') &&
    bundle.source.serverUuid !== manifest.target.serverUuid, 'source provenance mismatch');
  requireGate(audit.database === 'careerops_qa' && audit.serverUuid === manifest.target.serverUuid, 'audit identity');
  requireGate(Number.isSafeInteger(bundle.removedOrphanCount) && bundle.removedOrphanCount === manifest.source.expectedOrphans, 'orphan traceability');
  requireGate(manifest.backup?.targetServerUuid === manifest.target.serverUuid && backupBytes?.length > 0 && digest(backupBytes) === manifest.backup.sha256, 'backup absent or checksum mismatch');
  const age = now - Date.parse(manifest.backup.createdAt);
  requireGate(age >= 0 && age <= 86400000, 'stale backup');
  requireGate(restore?.passed === true && restore.backupSha256 === manifest.backup.sha256 &&
    restore.targetStateHash === stateHash(audit) && uuidPattern.test(restore.localServerUuid || '') &&
    restore.localServerUuid !== manifest.target.serverUuid && hashPattern.test(restore.restoredStateHash || '') &&
    Date.parse(restore.verifiedAt) >= Date.parse(manifest.backup.createdAt) && Date.parse(restore.verifiedAt) <= now, 'restore validation required');
  for (const t of QA_TABLES) requireGate(audit.tables[t], 'missing QA tables');
  for (const table of Object.values(audit.tables)) {
    requireGate(table.engine === 'InnoDB' && hashPattern.test(table.definitionHash || '') && hashPattern.test(table.contentHash || '') &&
      Number.isSafeInteger(table.count) && table.count >= 0 && Array.isArray(table.columns) && table.columns.length > 0, 'complete schema and content audit required');
  }
  for (const table of REFRESH_TABLES) {
    requireGate(manifest.expectedCounts?.[table] > 0 && manifest.expectedCounts[table] === bundle.data[table].length, 'expected count mismatch');
  }
  checkSchemaCompatibility(bundle.schemas, schemasFrom(audit), bundle.data);
  requireGate(manifest.rollback?.owner && manifest.rollback.restoreProcedureReviewed === true && manifest.rollback.writersQuiesced === true && manifest.rollback.dependencyReviewApproved === true, 'rollback and maintenance prerequisites');
  return;
}

// Offline evidence only. Never connects, emits SQL, changes counters or grants,
// or yields an executable refresh plan. Reuses every recovery/privacy/schema gate.
export function createCounterReadinessPlan(bundle, manifest, audit, backupBytes, restore, now = Date.now()) {
  validateRefreshReadiness(bundle, manifest, audit, backupBytes, restore, now);
  const counters = REFRESH_TABLES.map(table => {
    const auto = audit.tables[table].columns.filter(c => c.extra === 'auto_increment');
    requireGate(auto.length <= 1, 'multiple auto-increment columns');
    if (!auto.length) return { table, column: null, ready: true };
    const column = auto[0];
    requireGate(column.name === 'id', 'unreviewed auto-increment key');
    const type = /^(tinyint|smallint|mediumint|int|bigint)(?:\(\d+\))?( unsigned)?$/i.exec(column.type);
    requireGate(type, 'counter integer type');
    const bits = { tinyint: 8, smallint: 16, mediumint: 24, int: 32, bigint: 64 }[type[1].toLowerCase()];
    const capacity = (1n << BigInt(bits - (type[2] ? 0 : 1))) - 1n;
    const current = audit.tables[table].autoIncrement;
    requireGate(typeof current === 'string' && /^[1-9]\d*$/.test(current), 'counter metadata');
    const maximum = bundle.data[table].reduce((max, row) => {
      requireGate(Number.isSafeInteger(row[column.name]) && row[column.name] > 0, 'staged counter key');
      return BigInt(row[column.name]) > max ? BigInt(row[column.name]) : max;
    }, 0n);
    const minimum = maximum + 1n;
    requireGate(minimum <= capacity && BigInt(current) <= capacity, 'counter capacity');
    return { table, column: column.name, stagedMaximum: maximum.toString(), current: current,
      minimumNextValue: minimum.toString(), proposedNextValue: (BigInt(current) > minimum ? BigInt(current) : minimum).toString(),
      ready: BigInt(current) > maximum };
  });
  const report = { kind: 'counter-readiness-only', requiresSeparateOwnerApproval: true,
    bundleHash: digest(bundle), targetInventoryHash: digest(manifest.target), targetStateHash: stateHash(audit),
    backupSha256: manifest.backup.sha256, counters, ready: counters.every(c => c.ready) };
  return { ...report, reportHash: digest(report) };
}

export function createRefreshPlan(bundle, manifest, audit, backupBytes, restore, now = Date.now()) {
  const readiness = createCounterReadinessPlan(bundle, manifest, audit, backupBytes, restore, now);
  requireGate(readiness.ready, 'AUTO_INCREMENT reserve required before rehearsal');
  const plan = { version: 1, bundle, manifest, audit, restore };
  return { ...plan, planHash: digest(plan) };
}

export async function executeRefresh(connection, plan, { mode = 'rehearse', approval, rehearsal, now = Date.now() } = {}) {
  requireGate(['rehearse', 'commit'].includes(mode), 'unknown execution mode');
  const { planHash, ...payload } = plan;
  requireGate(digest(payload) === planHash, 'plan changed');
  assertApproval(approval, mode, planHash, now);
  if (mode === 'commit') requireGate(rehearsal?.mode === 'rolled-back' && rehearsal.planHash === planHash &&
    rehearsal.targetStateHash === stateHash(plan.audit) && Date.parse(rehearsal.at) >= Date.parse(plan.manifest.backup.createdAt) &&
    Date.parse(rehearsal.at) <= now && now - Date.parse(rehearsal.at) <= 3600000, 'successful recent rehearsal required');
  // Re-run offline gates even when invoking the exported executor directly.
  verifySanitized(plan.bundle, plan.manifest.privacy.reviewedFields);
  assertInventory(plan.manifest.target);
  let active = false;
  let commitAttempted = false;
  try {
    await verifyQaConnection(connection, plan.manifest.target.serverUuid, plan.manifest.target.user);
    const [settings] = await connection.query('SELECT @@SESSION.sql_mode AS mode');
    requireGate(/(?:^|,)(STRICT_ALL_TABLES|STRICT_TRANS_TABLES)(?:,|$)/.test(settings[0]?.mode || ''), 'strict SQL mode required');
    await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    await connection.beginTransaction(); active = true;
    const before = await inspectDatabase(connection, 'careerops_qa', true);
    requireGate(stateHash(before) === stateHash(plan.audit), 'target drift since backup');
    checkSchemaCompatibility(plan.bundle.schemas, schemasFrom(before), plan.bundle.data);
    for (const table of [...REFRESH_TABLES].reverse()) await connection.query(`DELETE FROM ${identifier(table)}`);
    for (const table of REFRESH_TABLES) {
      const columns = plan.bundle.schemas[table].map(c => c.name);
      for (const row of plan.bundle.data[table]) {
        const [result] = await connection.execute(`INSERT INTO ${identifier(table)} (${columns.map(identifier).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, columns.map(c => row[c]));
        requireGate(result.affectedRows === 1 && !result.warningStatus, 'insert count or coercion');
      }
    }
    const after = await inspectDatabase(connection, 'careerops_qa', true);
    for (const [table, original] of Object.entries(before.tables)) {
      const current = after.tables[table];
      if (!REFRESH_TABLES.includes(table)) requireGate(digest(current) === digest(original), 'protected table changed');
      else {
        requireGate(current.definitionHash === original.definitionHash && digest(current.columns) === digest(original.columns), 'schema changed during refresh');
        requireGate(current.count === plan.manifest.expectedCounts[table], 'post-refresh count mismatch');
        requireGate(current.autoIncrement === original.autoIncrement, 'counter changed');
        const names = original.columns.map(c => c.name);
        const expectedRows = plan.bundle.data[table].map(row => Object.fromEntries(names.map(name => [name, row[name] ?? null])));
        requireGate(current.contentHash === contentHash(expectedRows), 'post-refresh data mismatch');
      }
    }
    const [orphans] = await connection.query(`SELECT COUNT(*) AS n FROM report_job_contacts c
      LEFT JOIN weekly_reports w ON c.report_id = w.id LEFT JOIN recruiter_tracker r ON c.recruiter_tracker_id = r.id
      WHERE w.id IS NULL OR r.id IS NULL`);
    requireGate(Number(orphans[0]?.n) === 0, 'target orphan count');
    if (mode === 'commit') {
      assertApproval(approval, mode, planHash, Date.now());
      commitAttempted = true; await connection.commit(); active = false;
    }
    else {
      await connection.rollback(); active = false;
      requireGate(stateHash(await inspectDatabase(connection, 'careerops_qa')) === stateHash(before), 'rollback verification failed');
    }
    return { mode: mode === 'commit' ? 'committed' : 'rolled-back', planHash, targetStateHash: stateHash(before), at: new Date(now).toISOString() };
  } catch {
    if (active) {
      try { await connection.rollback(); }
      catch { connection.destroy(); throw new Error('QA refresh failed; rollback unconfirmed; connection destroyed, operator recovery required'); }
    }
    if (commitAttempted) {
      connection.destroy();
      throw new Error('QA commit outcome unconfirmed; do not retry; reconcile target against backup and plan');
    }
    // Driver errors can contain credentials or values. Never forward them to logs.
    throw new Error('QA refresh failed; transaction not committed; verify rollback and recovery evidence');
  }
}
