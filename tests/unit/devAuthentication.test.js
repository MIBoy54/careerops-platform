import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';

const mocks = vi.hoisted(() => ({ createPool: vi.fn() }));
vi.mock('mysql2/promise', () => ({ default: { createPool: mocks.createPool } }));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  for (const key of Object.keys(process.env)) {
    if (/^(DB_|DEMO_DB_|MYSQL|DATABASE_URL$|RAILWAY_)/.test(key)) vi.stubEnv(key, undefined);
  }
  vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function loginIn(name, storedRole, email = 'dev-admin@example.invalid', matches = true, session = {}) {
  const env = { APP_ENV: name, NODE_ENV: '', VITEST: '', CI: '', DEMO_MODE: 'false',
    DEMO_SYNC_ENABLED: '', DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_USER: 'fixture', DB_PASSWORD: 'fixture',
    RAILWAY_PROJECT_ID: name === 'dev' ? '' : 'fixture',
    RAILWAY_ENVIRONMENT_ID: name === 'dev' ? '' : 'fixture', BUILD_COMMIT_SHA: 'a'.repeat(40),
    SESSION_SECRET: 'synthetic-only-session-0123456789-ABCDEF' };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const connection = { query: vi.fn(async sql => {
    if (sql === 'SELECT DATABASE() AS db') return [[{ db: { dev: 'careerops_dev', qa: 'careerops_qa', demo: 'careerops_demo', production: 'railway' }[name] }]];
    if (sql.includes('partial_revokes')) return [[{ partial_revokes: 0 }]];
    return [[{ grant: 'GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\\_dev`.* TO `fixture`@`localhost`' }]];
  }), release: vi.fn() };
  const pool = { getConnection: vi.fn(async () => connection), query: vi.fn(async sql =>
    /FROM users/.test(sql) ? [[{ id: 42, email, full_name: 'Synthetic User', password_hash: 'synthetic-hash', role: storedRole }]] : [{ affectedRows: 1 }]) };
  mocks.createPool.mockReturnValue(pool);
  bcrypt.compare.mockResolvedValue(matches);
  const { app } = await import('../../src/server.js');
  const handler = app.router.stack.find(layer => layer.route?.path === '/api/auth/login').route.stack[0].handle;
  const req = { body: { email, password: 'synthetic-only-login' }, headers: {}, session };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res);
  return { req, res, pool, app };
}

describe('DEV authentication uses stored roles', () => {
  it.each(['admin', 'user', 'guest'])('accepts the validated %s role', async role => {
    const { req, res, pool } = await loginIn('dev', role);
    expect(res.code).toBe(200);
    expect(req.session.user.role).toBe(role);
    expect(res.body.user.role).toBe(role);
    expect(pool.query.mock.calls[0][0]).toContain('password_hash, role');
  });

  it.each([undefined, null, '', 'owner', 'ADMIN', '__proto__'])('rejects unknown role %s without authenticating or updating login time', async role => {
    const { req, res, pool } = await loginIn('dev', role);
    expect(res.code).toBe(403);
    expect(req.session.user).toBeUndefined();
    expect(pool.query).toHaveBeenCalledOnce();
  });

  it('cannot obtain admin access with the wrong password', async () => {
    const { req, res, pool } = await loginIn('dev', 'admin', undefined, false);
    expect(res.code).toBe(401);
    expect(req.session.user).toBeUndefined();
    expect(pool.query).toHaveBeenCalledOnce();
  });

  it('clears an authenticated DEV session on invalid role and denies subsequent protected requests', async () => {
    const session = { user: { id: 1, role: 'admin' }, retained: 'synthetic-session-field' };
    const { req, res, pool, app } = await loginIn('dev', 'unknown', undefined, true, session);
    expect(res.code).toBe(403);
    expect(req.session).toBe(session);
    expect(session.user).toBeUndefined();
    expect(session.retained).toBe('synthetic-session-field');
    pool.query.mockClear();
    for (const path of ['/api/contacts', '/env-check']) {
      const route = app.router.stack.find(layer => layer.route?.path === path && layer.route.methods.get).route;
      const denied = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      await route.stack[0].handle({ session }, denied, next);
      expect(denied.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('persists invalid-role logout across HTTP requests using the original session cookie', async () => {
    const { app, pool } = await loginIn('dev', 'admin');
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve); server.once('error', reject);
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      const login = cookie => fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify({ email: 'dev-admin@example.invalid', password: 'synthetic-only-login' })
      });
      const authenticated = await login();
      expect(authenticated.status).toBe(200);
      const cookie = authenticated.headers.get('set-cookie').split(';')[0];
      expect((await fetch(`${base}/env-check`, { headers: { Cookie: cookie } })).status).toBe(200);
      pool.query.mockResolvedValue([[{ id: 43, email: 'invalid-role@example.invalid',
        password_hash: 'synthetic-hash', role: 'unknown' }]]);
      expect((await login(cookie)).status).toBe(403);
      pool.query.mockClear();
      for (const path of ['/api/contacts', '/env-check']) {
        expect((await fetch(base + path, { headers: { Cookie: cookie } })).status).toBe(401);
      }
      expect(pool.query).not.toHaveBeenCalled();
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
});

const deployedRoles = ['qa', 'demo', 'production'].flatMap(name =>
  ['admin', 'guest', 'unrecognized', null].map(role => [name, role]));
describe('deployed-mode authentication compatibility', () => {
  it.each(deployedRoles)('keeps %s non-owner logins as guest with stored role %s', async (name, role) => {
    const { req, res, pool } = await loginIn(name, role);
    expect(res.code).toBe(200);
    expect(req.session.user.role).toBe('guest');
    expect(pool.query.mock.calls[0][0]).not.toContain('password_hash, role');
  });

  it.each(deployedRoles)('preserves %s owner admin assignment with stored role %s', async (name, role) => {
    const { req, res, pool } = await loginIn(name, role, 'b.r.lewis@outlook.com');
    expect(res.code).toBe(200);
    expect(req.session.user.role).toBe('admin');
    expect(pool.query.mock.calls[0][0]).not.toContain('password_hash, role');
  });
});
