import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createPool: vi.fn(), loadDotenv: vi.fn() }));
vi.mock('mysql2/promise', () => ({ default: { createPool: mocks.createPool } }));
vi.mock('dotenv', () => ({ default: { config: mocks.loadDotenv } }));

function res() {
  return { code: 200, body: undefined,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; }
  };
}
async function route(app, method, path, user, body = {}) {
  const registered = app.router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
  expect(registered, `${method} ${path} is registered`).toBeDefined();
  const response = res();
  const req = { session: { user }, body, headers: {} };
  for (const layer of registered.route.stack) {
    let continued = false;
    await layer.handle(req, response, () => { continued = true; });
    if (!continued) break;
  }
  return response;
}
function stubEnv(name, extra = {}) {
  for (const key of Object.keys(process.env)) {
    if (/^(DB_|DEMO_DB_|MYSQL|DATABASE_URL$|RAILWAY_)/.test(key)) vi.stubEnv(key, undefined);
  }
  for (const [key, value] of Object.entries({
    APP_ENV: name, CI: '', NODE_ENV: '', VITEST: '', DEMO_MODE: 'false', BUILD_COMMIT_SHA: '', SESSION_SECRET: '',
    ...(name === 'test' ? {} : { DB_HOST: '127.0.0.1', DB_USER: 'fixture', DB_PASSWORD: 'fixture' }),
    ...extra
  })) vi.stubEnv(key, value);
}
function installPool(name) {
  const database = { dev: 'careerops_dev', qa: 'careerops_qa', demo: 'careerops_demo', production: 'careerops' }[name];
  const connection = {
    query: vi.fn(async sql => {
      if (sql === 'SELECT DATABASE() AS db') return [[{ db: database }]];
      if (sql.includes('partial_revokes')) return [[{ partial_revokes: 0 }]];
      if (sql === 'SHOW GRANTS FOR CURRENT_USER') return [[{ grant: "GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\\_dev`.* TO 'fixture'@'localhost'" }]];
      return [{ insertId: 42 }];
    }), release: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn()
  };
  const pool = { query: vi.fn(async () => [[]]), getConnection: vi.fn(async () => connection), end: vi.fn() };
  mocks.createPool.mockReturnValue(pool);
  return { pool, connection };
}
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const sensitive = ['/setup-db', '/db-ping', '/debug-src', '/env-check', '/api/analytics/ping', '/api/demo-refresh', '/api/validation-runs/start', '/api/validation-runs/:id/complete'];
describe('actual administrative route wiring, with mocked infrastructure', () => {
  it.each(sensitive)('protects %s from anonymous and nonadmin sessions', async path => {
    stubEnv('dev'); installPool('dev');
    const { app } = await import('../../src/server.js');
    const method = path.endsWith('/complete') ? 'put' : path === '/api/demo-refresh' || path.endsWith('/start') ? 'post' : 'get';
    expect((await route(app, method, path, undefined)).code).toBe(401);
    expect((await route(app, method, path, { role: 'guest' })).code).toBe(403);
  });
  it('keeps only the authenticated validation-history route', async () => {
    stubEnv('dev'); installPool('dev');
    const { app } = await import('../../src/server.js');
    expect(app.router.stack.filter(layer => layer.route?.path === '/api/validation-runs')).toHaveLength(1);
    expect((await route(app, 'get', '/api/validation-runs', undefined)).code).toBe(401);
  });
  it('disables HTTP schema setup even for an administrator', async () => {
    stubEnv('dev'); const { connection, pool } = installPool('dev');
    const { app } = await import('../../src/server.js');
    connection.query.mockClear();
    expect((await route(app, 'get', '/setup-db', { role: 'admin' })).code).toBe(410);
    expect(pool.query).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
  });
  it('prevents DEV administrators from invoking manual synchronization before any DB work', async () => {
    stubEnv('dev'); const { connection, pool } = installPool('dev');
    const { app } = await import('../../src/server.js');
    connection.query.mockClear();
    expect((await route(app, 'post', '/api/demo-refresh', { role: 'admin' })).code).toBe(403);
    expect(mocks.createPool).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
  });
  it('generates a DEV weekly report without automatic DEMO synchronization', async () => {
    stubEnv('dev'); const { connection, pool } = installPool('dev');
    const { app } = await import('../../src/server.js');
    connection.query.mockClear();
    const response = await route(app, 'post', '/api/reports', { role: 'admin' }, { selectedIds: [1, 2, 3, 4] });
    expect(response.code).toBe(201);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(pool.query).not.toHaveBeenCalled();
    expect(connection.query.mock.calls.some(([sql]) => /demo_refresh|DELETE FROM/.test(sql))).toBe(false);
    expect(mocks.createPool).toHaveBeenCalledTimes(1);
  });
  it('allows admin diagnostics without exposing connection bindings', async () => {
    stubEnv('dev'); installPool('dev');
    const { app } = await import('../../src/server.js');
    const response = await route(app, 'get', '/env-check', { role: 'admin' });
    expect(response.code).toBe(200);
    expect(response.body).toEqual({ app_env: 'dev', database: 'careerops_dev', demo_sync_enabled: false });
  });
  it('does not promote anonymous DEMO visitors to administrators', async () => {
    stubEnv('demo', { RAILWAY_PROJECT_ID: 'fixture', RAILWAY_ENVIRONMENT_ID: 'fixture' }); installPool('demo');
    const { app } = await import('../../src/server.js');
    expect((await route(app, 'get', '/env-check', undefined)).code).toBe(401);
    expect((await route(app, 'post', '/api/demo-refresh', { role: 'guest' })).code).toBe(403);
  });
  it('starts the actual QA application with CI=true, keeping SQL-backed authentication and runtime identity', async () => {
    const sha = 'b'.repeat(40);
    stubEnv('qa', {
      CI: 'true', RAILWAY_PROJECT_ID: 'fixture', RAILWAY_ENVIRONMENT_ID: 'fixture',
      DB_PORT: '3306', SESSION_SECRET: 'isolated-fixture-secret', BUILD_COMMIT_SHA: sha
    });
    const { pool } = installPool('qa');
    const { app } = await import('../../src/server.js');
    expect(mocks.createPool).toHaveBeenCalledTimes(1);
    expect((await route(app, 'get', '/version', undefined)).body).toEqual({
      app: 'careerops-platform', environment: 'qa', commit: sha
    });
    const login = await route(app, 'post', '/api/auth/login', undefined, { email: 'fixture@example.test', password: 'fixture' });
    expect(login.code).toBe(401);
    expect(pool.query).toHaveBeenCalled();
  });
  it('keeps CI contacts and login functional while test mode creates no DB pools', async () => {
    stubEnv('test', { CI: 'true', DEMO_MODE: 'true' });
    const { app } = await import('../../src/server.js');
    expect(mocks.loadDotenv).not.toHaveBeenCalled();
    expect(mocks.createPool).not.toHaveBeenCalled();
    const login = await route(app, 'post', '/api/auth/login', undefined, { email: 'fixture@example.test', password: 'fixture' });
    expect(login.code).toBe(200);
    expect((await route(app, 'get', '/api/contacts', { role: 'admin' })).code).toBe(200);
    expect((await route(app, 'post', '/api/contacts', { role: 'admin' }, { company: 'fixture' })).code).toBe(201);
    expect((await route(app, 'post', '/api/demo-refresh', { role: 'admin' })).code).toBe(403);
    expect(mocks.createPool).not.toHaveBeenCalled();
  });
  it.each([
    { APP_ENV: 'dev', DB_NAME: 'careerops' },
    { APP_ENV: 'invalid' },
    { APP_ENV: 'production', DB_NAME: 'careerops' },
    { APP_ENV: 'dev', DEMO_DB_HOST: 'deployed-fixture' },
    { APP_ENV: 'test', DB_NAME: 'careerops' }
  ])('aborts unsafe actual server initialization before creating any pool %#', async change => {
    stubEnv('dev', change);
    await expect(import('../../src/server.js')).rejects.toThrow();
    expect(mocks.createPool).not.toHaveBeenCalled();
  });
});
