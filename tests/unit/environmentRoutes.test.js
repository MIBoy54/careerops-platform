import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createPool: vi.fn(), loadDotenv: vi.fn() }));
vi.mock('mysql2/promise', () => ({ default: { createPool: mocks.createPool } }));
vi.mock('dotenv', () => ({ default: { config: mocks.loadDotenv } }));

function res() {
  return { code: 200, body: undefined,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    header(name, value) {
      this.headers ??= {};
      this.headers[name] = value;
      return this;
    },
    attachment(filename) {
      this.filename = filename;
      return this;
    }
  };
}
async function route(app, method, path, user, body = {}, id = '11', query = {}) {
  const registered = app.router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]);
  expect(registered, `${method} ${path} is registered`).toBeDefined();
  const response = res();
  const req = { session: { user }, body, headers: {}, params: { id }, query };
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
  const database = { dev: 'careerops_dev', qa: 'careerops_qa', demo: 'careerops_demo', production: 'railway' }[name];
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

describe('Contact mutation release safeguards', () => {
  it.each(['demo', 'production'])('blocks all contact mutations in %s read-only mode before SQL', async name => {
    stubEnv(name, { DEMO_MODE: name === 'production' ? 'true' : 'false',
      RAILWAY_PROJECT_ID: 'fixture', RAILWAY_ENVIRONMENT_ID: 'fixture' });
    const { pool, connection } = installPool(name);
    const { app } = await import('../../src/server.js');
    pool.query.mockClear();
    pool.getConnection.mockClear();
    connection.query.mockClear();
    for (const user of [{ role: 'admin' }, { role: 'guest' }]) {
      for (const [method, path] of [['post', '/api/contacts'], ['put', '/api/contacts/:id'], ['delete', '/api/contacts/:id']]) {
        expect((await route(app, method, path, user, { company: 'blocked' })).code).toBe(403);
      }
    }
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
  });

  it('supports exactly one isolated fixture through create, update, and delete, requiring authentication', async () => {
    stubEnv('test', { CI: 'true', DEMO_MODE: 'true' });
    const { app } = await import('../../src/server.js');
    for (const [method, path] of [['post', '/api/contacts'], ['put', '/api/contacts/:id'], ['delete', '/api/contacts/:id']]) {
      expect((await route(app, method, path, undefined)).code).toBe(401);
    }
    const user = { role: 'admin' };
    const created = await route(app, 'post', '/api/contacts', user, { company: 'fixture', notes: 'PRIVATE fixture notes' });
    expect(created.code).toBe(201);
    const id = String(created.body.id);
    expect((await route(app, 'get', '/api/contacts', user)).body).toHaveLength(1);
    expect((await route(app, 'put', '/api/contacts/:id', user, { company: 'updated' }, id)).code).toBe(200);
    expect((await route(app, 'get', '/api/contacts', user)).body[0].company).toBe('updated');
    expect((await route(app, 'delete', '/api/contacts/:id', user, {}, id)).code).toBe(200);
    expect((await route(app, 'get', '/api/contacts', user)).body).toEqual([]);
    expect(mocks.createPool).not.toHaveBeenCalled();
    expect(mocks.loadDotenv).not.toHaveBeenCalled();
    expect(JSON.stringify(console.log.mock.calls)).not.toContain('PRIVATE fixture notes');
  });
});

describe('DEMO contact privacy', () => {
  it('hides private recruiter fields from guest contact-list responses', async () => {
    stubEnv('demo', {
      RAILWAY_PROJECT_ID: 'fixture-project',
      RAILWAY_ENVIRONMENT_ID: 'fixture-environment',
      SESSION_SECRET: 'demo-fixture-secret'
    });

    const { pool } = installPool('demo');

    const storedContact = {
      id: 7,
      recruiter_name: 'Public Recruiter',
      company: 'Public Employer',
      notes: 'PRIVATE recruiter notes',
      reported_unemployment: 'Yes'
    };

    pool.query.mockResolvedValue([[storedContact]]);

    const { app } = await import('../../src/server.js');

    const response = await route(
      app, 'get', '/api/contacts', { role: 'guest' }
    );

    expect(response.code).toBe(200);
    expect(response.body).toEqual([{
      id: 7,
      recruiter_name: 'Public Recruiter',
      company: 'Public Employer',
      reported_unemployment: 'Yes'
    }]);

    expect(storedContact.notes).toBe('PRIVATE recruiter notes');
    expect(storedContact.reported_unemployment).toBe('Yes');
  });
});
describe('Weekly-report detail privacy', () => {
  it.each([
    ['demo', false],
    ['production', true]
  ])('handles private employer fields correctly in %s', async (environmentName, includePrivate) => {
    stubEnv(environmentName, {
      RAILWAY_PROJECT_ID: 'fixture-project',
      RAILWAY_ENVIRONMENT_ID: 'fixture-environment',
      SESSION_SECRET: 'fixture-secret'
    });

    const { pool } = installPool(environmentName);

    const employer = Object.freeze({
      id: 7,
      recruiter_name: 'Public Recruiter',
      company: 'Public Employer',
      notes: 'PRIVATE recruiter notes',
      reported_to_unemployment: 'Yes'
    });

    pool.query
      .mockResolvedValueOnce([[{
        id: 11,
        week_start: '2026-10-05',
        submitted: 1
      }]])
      .mockResolvedValueOnce([[employer]]);

    const { app } = await import('../../src/server.js');

    const response = await route(
      app, 'get', '/api/reports/:id',
      { role: 'guest' }
    );

    expect(response.code).toBe(200);
    expect(response.body.id).toBe(11);
    expect(response.body.employers).toHaveLength(1);

    const visible = response.body.employers[0];

    expect(visible.company).toBe('Public Employer');
    expect(visible.recruiter_name).toBe('Public Recruiter');
    expect(Object.hasOwn(visible, 'notes')).toBe(includePrivate);
    expect(visible.reported_to_unemployment).toBe('Yes');

    if (includePrivate) {
      expect(visible.notes).toBe('PRIVATE recruiter notes');
      expect(visible.reported_to_unemployment).toBe('Yes');
    }

    expect(employer.notes).toBe('PRIVATE recruiter notes');
    expect(employer.reported_to_unemployment).toBe('Yes');
  });
});
describe('Additional recruiter response NOTES protection', () => {
  it.each([
    ['demo', '/api/companies/details'],
    ['production', '/api/companies/details'],
    ['demo', '/api/reports/unemployment'],
    ['production', '/api/reports/unemployment']
  ])('suppresses only NOTES for %s %s without logging the record', async (name, path) => {
    stubEnv(name, { RAILWAY_PROJECT_ID: 'fixture', RAILWAY_ENVIRONMENT_ID: 'fixture' });
    const { pool } = installPool(name);
    const contact = Object.freeze({ id: 7, company: 'Public Employer',
      recruiter_name: 'Public Recruiter', email: 'fixture@example.test', phone: '555-0100',
      address: 'Fixture Address', comp_range: '120000', reported_unemployment: 'Yes',
      reported_to_unemployment: 'Yes', notes: 'PRIVATE recruiter notes' });
    pool.query.mockResolvedValue([[contact]]);
    const { app } = await import('../../src/server.js');
    const response = await route(app, 'get', path, { role: 'admin' }, {}, '11',
      { company: 'Public Employer', start: '2026-10-01', end: '2026-10-13' });
    expect(response.code).toBe(200);
    const visible = path === '/api/companies/details' ? response.body : response.body.jobs[0];
    const { notes, ...others } = contact;
    expect(visible).toEqual(name === 'demo' ? others : contact);
    expect(contact.notes).toBe('PRIVATE recruiter notes');
    expect(JSON.stringify(console.log.mock.calls)).not.toContain('PRIVATE recruiter notes');
  });

  it('retains authentication and the DEMO nonadmin unemployment-report restriction', async () => {
    stubEnv('demo', { RAILWAY_PROJECT_ID: 'fixture', RAILWAY_ENVIRONMENT_ID: 'fixture' });
    const { pool } = installPool('demo');
    const { app } = await import('../../src/server.js');
    expect((await route(app, 'get', '/api/reports/unemployment', { role: 'guest' })).code).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
    stubEnv('production', { RAILWAY_PROJECT_ID: 'fixture', RAILWAY_ENVIRONMENT_ID: 'fixture' });
    vi.resetModules();
    installPool('production');
    const production = (await import('../../src/server.js')).app;
    for (const path of ['/api/companies/details', '/api/reports/unemployment']) {
      expect((await route(production, 'get', path, undefined)).code).toBe(401);
    }
  });
});

describe('CSV export privacy', () => {
  const fields = [
    'id', 'date_contacted', 'recruiter_name', 'company',
    'role_level', 'role_type', 'location', 'comp_range',
    'status', 'relationship_status', 'phone', 'email',
    'address', 'website', 'notes'
  ];

  it.each([
    ['demo', false],
    ['production', true]
  ])('exports recruiter notes correctly in %s', async (environmentName, includeNotes) => {
    stubEnv(environmentName, {
      RAILWAY_PROJECT_ID: 'fixture-project',
      RAILWAY_ENVIRONMENT_ID: 'fixture-environment',
      SESSION_SECRET: 'fixture-secret'
    });

    const { pool } = installPool(environmentName);
    const contact = {
      id: 7,
      date_contacted: null,
      recruiter_name: 'Public Recruiter',
      company: 'Public Employer',
      role_level: 'Senior',
      role_type: 'Remote',
      location: 'Nashville',
      comp_range: '120000',
      status: 'Applied',
      relationship_status: 'New',
      phone: '555-0100',
      email: 'recruiter@example.com',
      address: 'Public Address',
      website: 'https://example.com',
      notes: 'PRIVATE recruiter notes'
    };

    pool.query.mockResolvedValue([[
      Object.fromEntries(fields.map(field => [field, contact[field]]))
    ]]);

    const { app } = await import('../../src/server.js');
    const response = await route(
      app, 'get', '/api/contacts/export', { role: 'guest' }
    );

    expect(response.code).toBe(200);
    expect(response.filename).toBe('recruiter_export.csv');

    const lines = response.body.split('\n');
    const headers = lines[0].split(',');
    const values = lines[1].split(',');

    expect(headers.includes('Notes')).toBe(includeNotes);
    expect(response.body.includes('PRIVATE recruiter notes')).toBe(includeNotes);
    expect(headers.length).toBe(includeNotes ? 15 : 14);
    expect(values.length).toBe(headers.length);
    expect(response.body).toContain('Public Employer');
    expect(contact.notes).toBe('PRIVATE recruiter notes');
  });
});
describe('DEMO administrator read-only enforcement', () => {
  it.each([
    ['put', '/api/contacts/:id'],
    ['delete', '/api/contacts/:id'],
    ['post', '/api/reports']
  ])('blocks administrator %s %s before database access', async (method, endpoint) => {
    stubEnv('demo', {
      DB_HOST: 'mock-deployment',
      DB_PORT: '3306',
      SESSION_SECRET: 'demo-fixture-secret',
      RAILWAY_PROJECT_ID: 'fixture-project',
      RAILWAY_ENVIRONMENT_ID: 'fixture-environment'
    });

    const { pool, connection } = installPool('demo');
    const { app } = await import('../../src/server.js');

    pool.query.mockClear();
    pool.getConnection.mockClear();
    connection.query.mockClear();

    const response = await route(
      app,
      method,
      endpoint,
      { role: 'admin' },
      { selectedIds: [1, 2, 3, 4] }
    );

    expect(response.code).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(connection.query).not.toHaveBeenCalled();
  });
});
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
  it('handles weekly-report connection failure without rollback or release', async () => {
    stubEnv('dev');
    const { pool, connection } = installPool('dev');
    const { app } = await import('../../src/server.js');

    pool.getConnection.mockReset();
    pool.getConnection.mockRejectedValueOnce(new Error('Connection unavailable'));
    connection.rollback.mockClear();
    connection.release.mockClear();

    const response = await route(
      app, 'post', '/api/reports',
      { role: 'admin' },
      { selectedIds: [1, 2, 3, 4] }
    );

    expect(response.code).toBe(500);
    expect(response.body).toEqual({
      error: 'Failed to generate weekly report'
    });
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).not.toHaveBeenCalled();
  });
  it('copies public PROD contacts to DEMO without private fields', async () => {
    stubEnv('production', {
      RAILWAY_PROJECT_ID: 'fixture-project',
      RAILWAY_ENVIRONMENT_ID: 'fixture-environment',
      SESSION_SECRET: 'fixture-session-secret',
      DEMO_SYNC_ENABLED: 'true',
      DEMO_DB_HOST: 'mock-demo-host',
      DEMO_DB_USER: 'demo-fixture',
      DEMO_DB_PASSWORD: 'demo-fixture-password',
      DEMO_DB_NAME: 'careerops_demo'
    });

    const primary = installPool('production');
    const secondary = installPool('demo');

    mocks.createPool
      .mockImplementationOnce(() => primary.pool)
      .mockImplementationOnce(() => secondary.pool);

    const originalContact = Object.freeze({
      id: 7,
      recruiter_name: 'Public Recruiter',
      company: 'Public Employer',
      notes: 'PRIVATE recruiter notes',
      reported_to_unemployment: 'Yes'
    });

    const contactFields = Object.keys(originalContact)
      .map(name => ({ name }));

    primary.pool.query.mockImplementation(async sql => {
      if (/INSERT INTO demo_refresh_history/.test(sql))
        return [{ insertId: 55 }];

      if (/SELECT \* FROM recruiter_tracker/.test(sql))
        return [[originalContact], contactFields];

      if (/SELECT \* FROM weekly_reports/.test(sql))
        return [[{ id: 11 }], [{ name: 'id' }]];

      if (/SELECT \* FROM report_job_contacts/.test(sql))
        return [
          [{ report_id: 11, recruiter_tracker_id: 7 }],
          [{ name: 'report_id' }, { name: 'recruiter_tracker_id' }]
        ];

      if (/SELECT \*[\s\S]*FROM demo_refresh_history/.test(sql))
        return [[{ id: 55, status: 'COMPLETED' }]];

      if (/SHOW COLUMNS FROM demo_refresh_history/.test(sql))
        return [[{ Field: 'id' }, { Field: 'status' }]];

      return [{ affectedRows: 1 }];
    });

    secondary.pool.query.mockImplementation(async sql => {
      if (sql === 'SELECT DATABASE() AS db')
        return [[{ db: 'careerops_demo' }]];
      return [[]];
    });

    secondary.connection.query.mockImplementation(async sql => {
      if (/SELECT DATABASE\(\)/.test(sql))
        return [[{ db: 'careerops_demo' }]];

      if (/SELECT COUNT\(\*\)/.test(sql))
        return [[{ count: 1 }]];

      return [{ affectedRows: 1 }];
    });

    const { app } = await import('../../src/server.js');

    const response = await route(
      app, 'post', '/api/demo-refresh', { role: 'admin' }
    );

    expect(response.code).toBe(200);
    expect(response.body.rowsSynced).toBe(3);
    expect(mocks.createPool).toHaveBeenCalledTimes(2);

    const insert = secondary.connection.query.mock.calls.find(
      ([sql]) => /INSERT INTO `recruiter_tracker`/.test(sql)
    );

    expect(insert).toBeDefined();

    const [sql, values] = insert;
    expect(sql).toContain('`notes`');
    expect(sql).toContain('`reported_to_unemployment`');

    expect(values).toEqual([
      7,
      'Public Recruiter',
      'Public Employer',
      null,
      'Yes'
    ]);

    expect(originalContact.notes).toBe('PRIVATE recruiter notes');
    expect(originalContact.reported_to_unemployment).toBe('Yes');

    expect(secondary.connection.commit).toHaveBeenCalledTimes(2);
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
