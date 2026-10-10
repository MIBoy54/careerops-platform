import { describe, expect, it, vi } from 'vitest';
import { DATABASE_NAMES, resolveEnvironment, loadEnvironment, createDatabaseRuntime, assertDemoSyncAllowed } from '../../src/environment.js';
const dev = (extra = {}) => ({ APP_ENV: 'dev', DB_HOST: '127.0.0.1', DB_USER: 'dev_fixture', DB_PASSWORD: 'fixture', ...extra });
const deployed = (name, extra = {}) => dev({ APP_ENV: name, DB_HOST: 'mock-deployment',
  DB_PORT: '3306', SESSION_SECRET: 'isolated-fixture-secret', BUILD_COMMIT_SHA: 'a'.repeat(40),
  RAILWAY_PROJECT_ID: 'fixture-project', RAILWAY_ENVIRONMENT_ID: 'fixture-environment', ...extra });
const demo = { DEMO_DB_HOST: 'mock-demo', DEMO_DB_USER: 'fixture', DEMO_DB_PASSWORD: 'fixture', DEMO_DB_NAME: 'careerops_demo' };
const mockMysql = (database = 'careerops_dev', grants = [
  "GRANT USAGE ON *.* TO 'fixture'@'localhost'",
  "GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\\_dev`.* TO 'fixture'@'localhost'"
], partialRevokes = 0) => {
  const connection = { query: vi.fn(async sql => {
    if (sql === 'SELECT DATABASE() AS db') return [[{ db: database }]];
    if (sql.includes('partial_revokes')) return [[{ partial_revokes: partialRevokes }]];
    return [grants.map(grant => ({ grant }))];
  }), release: vi.fn() };
  const pool = { getConnection: vi.fn(async () => connection), end: vi.fn(async () => {}) };
  return { createPool: vi.fn(() => pool), pool, connection };
};

describe('environment selection and offline validation', () => {
  it.each([undefined, '', 'invalid', 'develop', 'prod', 'DEV'])('rejects unsupported APP_ENV %s', value => {
    expect(() => resolveEnvironment(dev({ APP_ENV: value }))).toThrow('APP_ENV');
  });
  it.each(['careerops', 'careerops_demo', 'careerops_qa', 'careerops_dev '])('rejects DEV database %s', name => {
    expect(() => resolveEnvironment(dev({ DB_NAME: name }))).toThrow('DB_NAME');
  });
  it('selects DEV explicitly with or without its exact DB_NAME', () => {
    expect(resolveEnvironment(dev()).database).toBe('careerops_dev');
    expect(resolveEnvironment(dev({ DB_NAME: 'careerops_dev' })).database).toBe('careerops_dev');
  });
  it.each(['railway.example', 'localhost', '0.0.0.0', '127.0.0.2', ' 127.0.0.1', undefined])('rejects nonapproved DEV host %s', host => {
    expect(() => resolveEnvironment(dev({ DB_HOST: host }))).toThrow();
  });
  it('allows literal IPv6 loopback', () => expect(resolveEnvironment(dev({ DB_HOST: '::1' })).primary.host).toBe('::1'));
  it.each(['DEMO_DB_HOST', 'DEMO_DB_PASSWORD', 'RAILWAY_PROJECT_ID', 'DATABASE_URL', 'MYSQLHOST', 'MYSQL_URL'])('rejects deployed DEV binding %s', key => {
    expect(() => resolveEnvironment(dev({ [key]: 'fixture' }))).toThrow('bindings');
  });
  it.each([{ DB_USER: '' }, { DB_PASSWORD: undefined }, { DB_PORT: 'bad' }, { DB_PORT: '0' }, { DB_PORT: '65536' }])('rejects incomplete or unsafe configuration %j', change => {
    expect(() => resolveEnvironment(dev(change))).toThrow();
  });
  it.each(['qa', 'demo', 'production'])('rejects local use of deployed environment %s', name => {
    expect(() => resolveEnvironment(dev({ APP_ENV: name, DB_NAME: DATABASE_NAMES[name] }))).toThrow('Railway');
  });
  it.each(['qa', 'demo', 'production'])('preserves explicit deployed mapping for %s', name => {
    expect(resolveEnvironment(deployed(name)).database).toBe(DATABASE_NAMES[name]);
    expect(() => resolveEnvironment(deployed(name, { DB_NAME: 'careerops_dev' }))).toThrow('DB_NAME');
  });
  it.each(['production', 'qa', 'demo'])('does not import destination pools or synchronization into %s', name => {
    const config = resolveEnvironment(deployed(name, demo));
    expect(config.secondary).toBeNull();
    expect(() => assertDemoSyncAllowed(config)).toThrow();
  });
  it.each(['dev', 'demo', 'test'])('disallows DEMO synchronization in %s', name => {
    const config = name === 'dev' ? resolveEnvironment(dev()) : name === 'test' ? resolveEnvironment({ APP_ENV: 'test' }) : resolveEnvironment(deployed('demo', demo));
    expect(config.secondary).toBeNull();
    expect(() => assertDemoSyncAllowed(config)).toThrow();
  });
  it.each(['NODE_ENV', 'VITEST'])('prevents production selection by test runtime flag %s', key => {
    expect(() => resolveEnvironment(deployed('production', { [key]: key === 'NODE_ENV' ? 'test' : 'true' }))).toThrow('Test execution');
  });
  it.each(['DB_NAME', 'DB_HOST', 'DB_PASSWORD', 'DEMO_DB_HOST', 'MYSQL_URL', 'RAILWAY_PROJECT_ID'])('rejects inherited database/deployment binding %s in test mode', key => {
    expect(() => resolveEnvironment({ APP_ENV: 'test', [key]: 'fixture' })).toThrow('prohibited');
  });
  it('never loads local dotenv credentials in test mode', () => {
    const loader = vi.fn();
    loadEnvironment({ APP_ENV: 'test' }, loader, '/fixture');
    expect(loader).not.toHaveBeenCalled();
    loadEnvironment({ APP_ENV: 'demo' }, loader, '/fixture');
    expect(loader).toHaveBeenCalledWith({ path: '/fixture/.env.demo', quiet: true });
    loadEnvironment({ APP_ENV: 'dev' }, loader, '/fixture');
    expect(loader).toHaveBeenLastCalledWith({ path: '/fixture/.env', quiet: true });
  });
});

describe('database initialization fail-fast checks (mocked only)', () => {
  it('creates only one pool in DEV and checks identity and restricted privileges before returning', async () => {
    const mysql = mockMysql();
    const runtime = await createDatabaseRuntime(mysql, resolveEnvironment(dev()));
    expect(mysql.createPool).toHaveBeenCalledTimes(1);
    expect(runtime.demoPool).toBeNull();
    expect(mysql.connection.query.mock.calls.map(call => call[0])).toEqual(['SELECT DATABASE() AS db', 'SELECT @@GLOBAL.partial_revokes AS partial_revokes', 'SHOW GRANTS FOR CURRENT_USER']);
    expect(mysql.connection.release).toHaveBeenCalled();
  });
  it('rejects a mismatched actual database and closes the pool', async () => {
    const mysql = mockMysql('careerops');
    await expect(createDatabaseRuntime(mysql, resolveEnvironment(dev()))).rejects.toThrow('identity');
    expect(mysql.pool.end).toHaveBeenCalled();
    expect(mysql.createPool).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["GRANT ALL PRIVILEGES ON *.* TO 'fixture'@'localhost'"],
    ["GRANT SELECT ON `careerops`.* TO 'fixture'@'localhost'"],
    ["GRANT SELECT ON `careerops_demo`.* TO 'fixture'@'localhost'"],
    ["GRANT `role` TO 'fixture'@'localhost'"],
    ["GRANT ALL PRIVILEGES ON `careerops_dev`.* TO 'fixture'@'localhost' WITH GRANT OPTION"], []
  ].map(grants => ({ grants })))('rejects accounts with unverified or cross-environment privileges %#', async ({ grants }) => {
    const mysql = mockMysql('careerops_dev', grants);
    await expect(createDatabaseRuntime(mysql, resolveEnvironment(dev()))).rejects.toThrow('privileges');
    expect(mysql.pool.end).toHaveBeenCalled();
  });
  it.each([0, 1])('checks the actual server mode before accepting an exact schema (partial_revokes=%s)', async mode => {
    const schema = mode === 0 ? 'careerops\\_dev' : 'careerops_dev';
    const mysql = mockMysql('careerops_dev', [`GRANT SELECT ON \`${schema}\`.* TO 'fixture'@'localhost'`], mode);
    await expect(createDatabaseRuntime(mysql, resolveEnvironment(dev()))).resolves.toHaveProperty('demoPool', null);
  });
  it('rejects an unescaped wildcard grant in pattern mode and closes the pool', async () => {
    const mysql = mockMysql('careerops_dev', ["GRANT SELECT ON `careerops_dev`.* TO 'fixture'@'localhost'"], 0);
    await expect(createDatabaseRuntime(mysql, resolveEnvironment(dev()))).rejects.toThrow('privileges');
    expect(mysql.pool.end).toHaveBeenCalled();
  });
  it('fails closed when server grant semantics cannot be verified', async () => {
    const mysql = mockMysql('careerops_dev', [], 'unknown');
    await expect(createDatabaseRuntime(mysql, resolveEnvironment(dev()))).rejects.toThrow('wildcard semantics');
    expect(mysql.pool.end).toHaveBeenCalled();
  });
  it('rejects unreachable databases and never creates a secondary pool', async () => {
    const mysql = mockMysql();
    mysql.pool.getConnection.mockRejectedValue(new Error('offline'));
    await expect(createDatabaseRuntime(mysql, resolveEnvironment(deployed('production', demo)))).rejects.toThrow('offline');
    expect(mysql.pool.end).toHaveBeenCalled();
    expect(mysql.createPool).toHaveBeenCalledTimes(1);
  });
  it.each(['qa', 'production', 'demo'])('checks %s identity and preserves deployed primary pool configuration', async name => {
    const mysql = mockMysql(DATABASE_NAMES[name]);
    const config = resolveEnvironment(deployed(name, demo));
    const runtime = await createDatabaseRuntime(mysql, config);
    expect(mysql.createPool).toHaveBeenCalledWith(config.primary);
    expect(mysql.connection.query).toHaveBeenCalledTimes(1);
    expect(mysql.createPool).toHaveBeenCalledTimes(1);
    expect(runtime.demoPool).toBeNull();
  });
  it('creates no database pools in test mode and rejects attempted DB operations', async () => {
    const mysql = mockMysql();
    const runtime = await createDatabaseRuntime(mysql, resolveEnvironment({ APP_ENV: 'test' }));
    expect(mysql.createPool).not.toHaveBeenCalled();
    expect(runtime.demoPool).toBeNull();
    await expect(runtime.pool.query('SELECT 1')).rejects.toThrow('disabled');
    await expect(runtime.pool.getConnection()).rejects.toThrow('disabled');
  });
});

describe('Railway QA runtime reconciliation', () => {
  it('accepts CI=true only as a runtime marker with all QA safeguards satisfied', () => {
    const config = resolveEnvironment(deployed('qa', { CI: 'true' }));
    expect(config.database).toBe('careerops_qa');
    expect(config.buildCommitSha).toBe('a'.repeat(40));
  });
  it.each(['DB_PORT', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET'])('rejects missing QA %s', key => {
    expect(() => resolveEnvironment(deployed('qa', { [key]: undefined, CI: 'true' }))).toThrow();
    expect(() => resolveEnvironment(deployed('qa', { [key]: ' ', CI: 'true' }))).toThrow();
  });
  it.each(['0', '65536', '3306.0', '3.306e3', ' 3306', '3306 ', '0xcea'])('rejects unsafe QA port %s', port => {
    expect(() => resolveEnvironment(deployed('qa', { DB_PORT: port, CI: 'true' }))).toThrow();
  });
  it.each([undefined, '', 'f85f726', 'g'.repeat(40)])('rejects absent or malformed build SHA %#', value => {
    expect(() => resolveEnvironment(deployed('qa', { BUILD_COMMIT_SHA: value, CI: 'true' }))).toThrow('commit SHA');
  });
  it('uses Railway SHA before the alternate build SHA and validates the selected value', () => {
    expect(resolveEnvironment(deployed('qa', { RAILWAY_GIT_COMMIT_SHA: 'b'.repeat(40) })).buildCommitSha).toBe('b'.repeat(40));
    expect(() => resolveEnvironment(deployed('qa', { RAILWAY_GIT_COMMIT_SHA: 'bad' }))).toThrow('commit SHA');
  });
  it.each([{ DEMO_MODE: ' TRUE ' }, { NODE_ENV: ' TEST ' }, { VITEST: 'true' }])('rejects QA demo or actual test runtime %#', extra => {
    expect(() => resolveEnvironment(deployed('qa', { CI: 'true', ...extra }))).toThrow();
  });
});
