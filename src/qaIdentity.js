import { isSafeSchemaGrant, hasQaSchemaSelect } from './devGrantValidation.js';

export const QA_TABLES = Object.freeze(['recruiter_tracker', 'weekly_reports', 'report_job_contacts',
  'users', 'validation_runs', 'visitor_analytics', 'analytics_heartbeat_events']);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fail = () => { throw new Error('QA identity or binding validation failed'); };

// Expected values must come from an independently reviewed QA inventory, never
// derive them from the observed Railway variables in a start script.
export function assertQaBindings(env) {
  for (const field of ['PROJECT_ID', 'ENVIRONMENT_ID', 'SERVICE_ID']) {
    const expected = env[`QA_EXPECTED_RAILWAY_${field}`];
    if (!uuid(expected) || env[`RAILWAY_${field}`] !== expected) fail();
  }
  if (env.DB_NAME !== 'careerops_qa' || !uuid(env.QA_EXPECTED_DB_SERVER_UUID)) fail();
  for (const field of ['HOST', 'PORT', 'USER']) {
    const expected = env[`QA_EXPECTED_DB_${field}`];
    if (typeof expected !== 'string' || !expected.trim() || expected !== env[`DB_${field}`]) fail();
  }
  if (env.DB_USER.toLowerCase() === 'root') fail();
  if (env.RAILWAY_ENVIRONMENT_NAME !== undefined && env.RAILWAY_ENVIRONMENT_NAME.toLowerCase() !== 'qa') fail();
  if (Object.keys(env).some(key => /^(MYSQL|DATABASE_URL$|DEMO_DB_)/.test(key) && env[key])) fail();
  if (env.DEMO_SYNC_ENABLED !== undefined && env.DEMO_SYNC_ENABLED !== 'false') fail();
}

export function assertQaDatabaseIdentity(row, expectedUuid, expectedUser) {
  const account = row?.authenticated_account;
  if (typeof expectedUser !== 'string' || !expectedUser || expectedUser.toLowerCase() === 'root' ||
      typeof account !== 'string' || account.lastIndexOf('@') <= 0 || account.endsWith('@') ||
      account.slice(0, account.lastIndexOf('@')) !== expectedUser) fail();
  if (!uuid(expectedUuid) || row?.db !== 'careerops_qa' || row.server_uuid !== expectedUuid ||
      ![0, 1, '0', '1', false, true].includes(row.partial_revokes)) fail();
}

export async function verifyQaConnection(connection, expectedUuid, expectedUser) {
  const [identity] = await connection.query('SELECT DATABASE() AS db, @@server_uuid AS server_uuid, CURRENT_USER() AS authenticated_account, @@GLOBAL.partial_revokes AS partial_revokes');
  const row = identity[0];
  assertQaDatabaseIdentity(row, expectedUuid, expectedUser);
  const [grants] = await connection.query('SHOW GRANTS FOR CURRENT_USER');
  if (!hasQaSchemaSelect(grants.map(grant => Object.values(grant)[0]), [1, '1', true].includes(row.partial_revokes)) || !grants.length || !grants.every(grant => isSafeSchemaGrant(Object.values(grant)[0],
    [1, '1', true].includes(row.partial_revokes), 'careerops_qa'))) {
    throw new Error('QA requires direct privileges limited to careerops_qa');
  }
  // Read-only checks: missing telemetry/auth tables block startup; never auto-migrate.
  for (const table of QA_TABLES) await connection.query(`SELECT 1 FROM \`${table}\` LIMIT 0`);
}
