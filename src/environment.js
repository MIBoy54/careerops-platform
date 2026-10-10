import { isSafeDevGrant } from "./devGrantValidation.js";

export const DATABASE_NAMES = Object.freeze({
  dev: 'careerops_dev', qa: 'careerops_qa', demo: 'careerops_demo', production: 'careerops'
});
const LOOPBACK = new Set(['127.0.0.1', '::1']);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const databaseBinding = key => /^(DB_|DEMO_DB_|MYSQL|DATABASE_URL$)/.test(key);
const railwayBinding = key => key.startsWith('RAILWAY_');

export function loadEnvironment(env, loadDotenv, directory) {
  // Tests never read the developer's .env, which may contain deployed credentials.
  if (env.APP_ENV?.trim() === 'test') return;
  const file = env.APP_ENV?.trim() === 'demo' ? '.env.demo' : '.env';
  loadDotenv({ path: `${directory}/${file}`, quiet: true });
}

export function resolveEnvironment(env) {
  const appEnv = env.APP_ENV?.trim();
  if (![...Object.keys(DATABASE_NAMES), 'test'].includes(appEnv)) {
    throw new Error('APP_ENV must explicitly be dev, qa, demo, production, or test');
  }
  if ((env.NODE_ENV?.trim().toLowerCase() === 'test' || env.VITEST === 'true') && appEnv !== 'test') {
    throw new Error('Test execution requires APP_ENV=test');
  }
  if (appEnv === 'test') {
    if (Object.keys(env).some(key => (databaseBinding(key) || railwayBinding(key)) && nonempty(env[key]))) {
      throw new Error('Database and deployment bindings are prohibited in test mode');
    }
    return Object.freeze({ appEnv, database: null, primary: null, secondary: null, demoSyncEnabled: false });
  }
  const database = DATABASE_NAMES[appEnv];
  if (env.DB_NAME !== undefined && env.DB_NAME !== database) {
    throw new Error('DB_NAME does not match APP_ENV');
  }
  if (!nonempty(env.DB_HOST) || !nonempty(env.DB_USER) || typeof env.DB_PASSWORD !== 'string') {
    throw new Error('Explicit DB_HOST, DB_USER, and DB_PASSWORD configuration is required');
  }
  const port = env.DB_PORT === undefined ? 3306 : Number(env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DB_PORT');
  if (appEnv === 'dev') {
    if (!LOOPBACK.has(env.DB_HOST)) throw new Error('DEV requires a literal loopback DB_HOST');
    if (Object.keys(env).some(key => nonempty(env[key]) && (
      key.startsWith('DEMO_DB_') || railwayBinding(key) || /^(MYSQL|DATABASE_URL$)/.test(key)
    ))) throw new Error('Deployed or secondary database bindings are prohibited in DEV');
  } else if (!nonempty(env.RAILWAY_PROJECT_ID) || !nonempty(env.RAILWAY_ENVIRONMENT_ID)) {
    throw new Error('QA, DEMO, and PROD require Railway deployment context; use dev locally');
  }
  const buildCommitSha = env.RAILWAY_GIT_COMMIT_SHA || env.BUILD_COMMIT_SHA || null;
  // CI=true is a Railway runtime marker, not evidence that this is a test process.
  if (appEnv === 'qa') {
    for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET']) {
      if (!nonempty(env[key])) throw new Error(`QA requires ${key}`);
    }
    if (!/^\d+$/.test(env.DB_PORT)) throw new Error('QA requires a valid DB_PORT');
    if (env.DEMO_MODE?.trim().toLowerCase() === 'true') throw new Error('QA cannot run with DEMO_MODE');
    if (!/^[0-9a-f]{40}$/i.test(buildCommitSha || '')) {
      throw new Error('QA requires a full Git commit SHA in RAILWAY_GIT_COMMIT_SHA or BUILD_COMMIT_SHA');
    }
  }
  const primary = {
    host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD, database, port,
    connectTimeout: 10000,
    ...(appEnv === 'dev' ? {} : { ssl: { rejectUnauthorized: false } })
  };
  // Synchronization is absent from the selected DEV baseline; do not import it.
  return Object.freeze({ appEnv, database, primary, secondary: null, demoSyncEnabled: false, buildCommitSha });
}

export function assertDemoSyncAllowed(config) {
  if (!config.demoSyncEnabled || !config.secondary) {
    throw new Error('DEMO synchronization is unavailable in this environment');
  }
}

export async function verifyPrimaryDatabase(pool, config) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT DATABASE() AS db');
    if (rows[0]?.db !== config.database) throw new Error('Primary database identity does not match APP_ENV');
    if (config.appEnv === 'dev') {
      // Reject accounts capable of reaching other schemas, even through a local tunnel.
      const [settings] = await connection.query('SELECT @@GLOBAL.partial_revokes AS partial_revokes');
      const value = settings[0]?.partial_revokes;
      if (![0, 1, '0', '1', false, true].includes(value)) {
        throw new Error('Cannot verify MySQL database-grant wildcard semantics');
      }
      const partialRevokes = value === 1 || value === '1' || value === true;
      const [grants] = await connection.query('SHOW GRANTS FOR CURRENT_USER');
      const safe = grants.length > 0 && grants.every(row =>
        isSafeDevGrant(Object.values(row)[0], partialRevokes)
      );
      if (!safe) throw new Error('DEV database account must have privileges limited to careerops_dev');
    }
  } finally {
    connection.release();
  }
}

export async function createDatabaseRuntime(mysql, config) {
  if (config.appEnv === 'test') {
    const unavailable = async () => { throw new Error('Database access is disabled in test mode'); };
    return { pool: { query: unavailable, getConnection: unavailable }, demoPool: null };
  }
  const pool = mysql.createPool(config.primary);
  try {
    await verifyPrimaryDatabase(pool, config);
    const demoPool = null;
    return { pool, demoPool };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
