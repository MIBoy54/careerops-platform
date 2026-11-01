import { PassThrough } from 'node:stream';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { bootstrapDev, hiddenInput, parseBaseline, runCli, validatePassword, verifySchema } from '../../scripts/dev-bootstrap.js';
import { createDevUser } from '../../scripts/dev-create-user.js';

const instance = '11111111-2222-3333-4444-555555555555';
const settings = () => ({ APP_ENV: 'dev', DB_NAME: 'careerops_dev',
  DB_HOST: '127.0.0.1', DB_PORT: '3306', DB_USER: 'careerops_app',
  DB_PASSWORD: 'synthetic-db-only-1234', DEV_DB_ACCOUNT_HOST: 'localhost',
  DEV_INSTANCE_ID: instance, DEV_PROVISION_USER: 'local_provisioner',
  DEV_PROVISION_PASSWORD: 'synthetic-provision-only-5678',
  DEV_BOOTSTRAP_CONFIRM: `careerops_dev@${instance}` });
const login = () => ({ email: 'Dev-Admin@example.invalid',
  password: 'synthetic-login-only-9876', confirmation: 'synthetic-login-only-9876' });

const baseline = readFileSync(new URL('../../database/schema/001_initial_schema.sql', import.meta.url), 'utf8');
// Independent metadata fixtures read from the SQL under review, not the verifier's contract.
function schemaFixture() {
  const tables = [], columns = [], indexes = [];
  for (const [, table, body] of baseline.matchAll(/CREATE TABLE `([^`]+)` \(\n([\s\S]*?)\n\) ENGINE/g)) {
    tables.push({ name: table, type: 'BASE TABLE', engine: 'InnoDB', collation: 'utf8mb4_0900_ai_ci' });
    indexes.push({ table_name: table, name: 'PRIMARY', non_unique: 0, position: 1, column_name: 'id' });
    for (const line of body.split('\n')) {
      const column = /^\s*`([^`]+)` (\w+(?:\(\d+\))?)(.*)/.exec(line);
      if (!column) continue;
      const [, name, type, tail] = column;
      const value = /DEFAULT (NULL|'([^']*)'|CURRENT_TIMESTAMP)/.exec(tail);
      columns.push({ table_name: table, name, type, nullable: tail.includes('NOT NULL') ? 'NO' : 'YES',
        default_value: !value || value[1] === 'NULL' ? null : value[2] ?? 'CURRENT_TIMESTAMP()',
        extra: tail.includes('AUTO_INCREMENT') ? 'auto_increment' : '',
        collation: /varchar|text/.test(type) ? 'utf8mb4_0900_ai_ci' : null });
    }
  }
  indexes.push({ table_name: 'users', name: 'email', non_unique: 0, position: 1, column_name: 'email' });
  indexes.push({ table_name: 'visitor_analytics', name: 'session_id', non_unique: 1,
    position: 1, column_name: 'session_id', prefix_length: null });
  return { tables, columns, indexes };
}

function database({ count = 0, existingAccount = false, existingUser = false,
  server = instance, account = 'careerops_app@localhost', partialRevokes = 0,
  grant = 'GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\\_dev`.* TO `careerops_app`@`localhost`',
  sqlMode = 'STRICT_TRANS_TABLES', metadata = schemaFixture() } = {}) {
  const query = vi.fn(async sql => {
    if (sql.includes('@@server_uuid')) return [[{ server_uuid: server }]];
    if (sql.includes('@@SESSION.sql_mode')) return [[{ sql_mode: sqlMode, partial_revokes: partialRevokes }]];
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
    if (sql.includes('information_schema.tables')) return [[{ count }]];
    if (sql.includes('mysql.user')) return [existingAccount ? [{ User: 'careerops_app' }] : []];
    if (sql.includes('CURRENT_USER()')) return [[{ account }]];
    if (sql === 'SELECT DATABASE() AS db') return [[{ db: 'careerops_dev' }]];
    if (sql.includes('@@GLOBAL.partial_revokes')) return [[{ partial_revokes: partialRevokes }]];
    if (sql === 'SHOW GRANTS FOR CURRENT_USER') return [[{ grant }]];
    return [{ affectedRows: 1 }];
  });
  const execute = vi.fn(async sql => {
    if (sql.includes('information_schema.tables')) return [metadata.tables];
    if (sql.includes('information_schema.columns')) return [metadata.columns];
    if (sql.includes('information_schema.statistics')) return [metadata.indexes];
    return /SELECT id/.test(sql) ? [existingUser ? [{ id: 1 }] : []] : [{ insertId: 1 }];
  });
  const connection = { query, execute, end: vi.fn(async () => {}) };
  return { connection, connect: vi.fn(async () => connection) };
}
const writes = connection => connection.query.mock.calls.filter(([sql]) => /^\s*(?:CREATE|ALTER|DROP|GRANT|INSERT|UPDATE|DELETE|TRUNCATE)\b/i.test(sql));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('reviewed fresh-baseline SQL and schema completeness', () => {
  it('accepts the actual baseline and its reviewed executable SET comments', async () => {
    const statements = parseBaseline(baseline);
    expect(statements.filter(sql => sql.startsWith('CREATE TABLE')).map(sql => /CREATE TABLE `([^`]+)`/.exec(sql)[1])).toEqual([
      'analytics_heartbeat_events', 'demo_refresh_history', 'recruiter_tracker', 'report_job_contacts',
      'users', 'validation_runs', 'visitor_analytics', 'weekly_reports'
    ]);
    expect(statements.filter(sql => sql.startsWith('/*!')).length).toBeGreaterThan(0);
    await expect(verifySchema(database().connection)).resolves.toBeUndefined();
  });

  it.each([
    baseline.replace("DEFAULT 'user'", "DEFAULT 'semi;colon'"),
    baseline + '\nDELIMITER $$\n',
    baseline + '\nCREATE PROCEDURE unsupported() BEGIN SELECT 1; END;',
    baseline + '\n/*!80000 DROP TABLE users */;',
    baseline + '\n-- unsupported comment\n',
    baseline + '\n/* unsupported comment */;',
    baseline + '\nINSERT INTO users (email) VALUES (\'synthetic@example.invalid\');',
    baseline.replace('`industry` varchar(100)', '`industry` varchar(50)'),
    baseline.replace("`role` varchar(50) NOT NULL DEFAULT 'user'", "`role` varchar(50) DEFAULT 'user'"),
    baseline.replace(/CREATE TABLE `weekly_reports` \([\s\S]*?\) ENGINE[^;]+;/, ''),
    baseline + '\n' + baseline.match(/CREATE TABLE `users` \([\s\S]*?\) ENGINE[^;]+;/)[0]
  ])('rejects unsupported constructs, changed definitions, and incomplete/duplicate tables %#', sql => {
    expect(() => parseBaseline(sql)).toThrow();
  });

  it.each(schemaFixture().tables.map(table => table.name))('detects missing table %s', async name => {
    const metadata = schemaFixture();
    metadata.tables = metadata.tables.filter(table => table.name !== name);
    await expect(verifySchema(database({ metadata }).connection)).rejects.toThrow('tables');
  });

  it.each(schemaFixture().columns.map(column => [column.table_name, column.name]))('detects missing column %s.%s', async (table, name) => {
    const metadata = schemaFixture();
    metadata.columns = metadata.columns.filter(column => column.table_name !== table || column.name !== name);
    await expect(verifySchema(database({ metadata }).connection)).rejects.toThrow('columns');
  });

  it.each([
    ['users', 'role', 'nullable', 'YES'], ['users', 'role', 'default_value', 'guest'],
    ['users', 'role', 'default_value', 'USER'], ['users', 'role', 'type', 'varchar(20)'],
    ['recruiter_tracker', 'industry', 'type', 'varchar(50)'],
    ['users', 'id', 'extra', ''], ['users', 'email', 'collation', 'utf8mb4_bin']
  ])('detects conflicting definition %s.%s %s', async (table, name, field, value) => {
    const metadata = schemaFixture();
    metadata.columns.find(column => column.table_name === table && column.name === name)[field] = value;
    await expect(verifySchema(database({ metadata }).connection)).rejects.toThrow('columns');
  });

  it('refuses account creation when the imported schema is incomplete', async () => {
    const metadata = schemaFixture(); metadata.columns.pop();
    const { connection, connect } = database({ metadata });
    const stage = vi.fn();
    await expect(bootstrapDev(settings(), connect, stage)).rejects.toThrow('columns');
    expect(stage).toHaveBeenLastCalledWith('schema verification');
    expect(writes(connection).some(([sql]) => /^CREATE USER|^GRANT/.test(sql))).toBe(false);
    expect(writes(connection).some(([sql]) => /^DROP|^TRUNCATE/.test(sql))).toBe(false);
  });

  it.each(['PRIMARY', 'email'])('detects a missing users %s constraint', async name => {
    const metadata = schemaFixture();
    metadata.indexes = metadata.indexes.filter(index => index.table_name !== 'users' || index.name !== name);
    await expect(verifySchema(database({ metadata }).connection)).rejects.toThrow(/key|constraint/);
  });

  it.each(['missing', 'wrong column', 'unique', 'wrong position', 'prefix', 'composite'])('rejects %s session_id index', async variant => {
    const metadata = schemaFixture();
    const index = metadata.indexes.find(row => row.table_name === 'visitor_analytics' && row.name === 'session_id');
    if (variant === 'missing') metadata.indexes = metadata.indexes.filter(row => row !== index);
    if (variant === 'wrong column') index.column_name = 'page_path';
    if (variant === 'unique') index.non_unique = 0;
    if (variant === 'wrong position') index.position = 2;
    if (variant === 'prefix') index.prefix_length = 8;
    if (variant === 'composite') metadata.indexes.push({ ...index, position: 2, column_name: 'page_path' });
    await expect(verifySchema(database({ metadata }).connection)).rejects.toThrow('session_id index');
  });
});

describe('required schema-wide DML in addition to unsafe-grant rejection', () => {
  it.each([0, 1].flatMap(mode => ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].map(privilege => [mode, privilege])))('rejects mode %s grant missing %s', async (mode, missing) => {
    const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].filter(privilege => privilege !== missing).join(', ');
    const schema = mode === 1 ? 'careerops_dev' : 'careerops\\_dev';
    const { connection, connect } = database({ partialRevokes: mode,
      grant: `GRANT ${privileges} ON \`${schema}\`.* TO \`careerops_app\`@\`localhost\`` });
    await expect(createDevUser(settings(), login(), connect)).rejects.toThrow('DML');
    expect(connection.execute).not.toHaveBeenCalled();
  });

  it.each([0, 1])('rejects other-schema privileges through user creation in mode %s before user SQL', async mode => {
    const schema = mode === 1 ? 'other_schema' : 'other\\_schema';
    const { connection, connect } = database({ partialRevokes: mode,
      grant: `GRANT SELECT, INSERT, UPDATE, DELETE ON \`${schema}\`.* TO \`careerops_app\`@\`localhost\`` });
    const hash = vi.spyOn(bcrypt, 'hash');
    await expect(createDevUser(settings(), login(), connect)).rejects.toThrow('privileges limited to careerops_dev');
    expect(connection.execute).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it.each([
    'GRANT USAGE ON *.* TO `careerops_app`@`localhost`',
    'GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops_dev`.`users` TO `careerops_app`@`localhost`',
    'GRANT ALL PRIVILEGES ON *.* TO `careerops_app`@`localhost`'
  ])('does not confuse USAGE, table-only grants or unsafe grants with complete schema privileges %#', async grant => {
    const { connection, connect } = database({ grant });
    await expect(createDevUser(settings(), login(), connect)).rejects.toThrow();
    expect(connection.execute).not.toHaveBeenCalled();
  });

  it('accepts complete privileges split across safe schema grants', async () => {
    const { connection, connect } = database();
    const query = connection.query.getMockImplementation();
    connection.query.mockImplementation(async (...args) => args[0] === 'SHOW GRANTS FOR CURRENT_USER' ? [[
      { grant: 'GRANT SELECT, INSERT ON `careerops\\_dev`.* TO `careerops_app`@`localhost`' },
      { grant: 'GRANT UPDATE, DELETE ON `careerops\\_dev`.* TO `careerops_app`@`localhost`' }
    ]] : query(...args));
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('synthetic-hash');
    await expect(createDevUser(settings(), login(), connect)).resolves.toBeUndefined();
  });
});

describe('local DEV bootstrap refusal before mutations', () => {
  it.each([
    { APP_ENV: 'production' }, { APP_ENV: 'qa' }, { APP_ENV: 'test' },
    { DB_HOST: 'remote.example.invalid' }, { DB_HOST: 'localhost' },
    { DB_NAME: undefined }, { DB_NAME: 'railway' }, { DB_USER: 'root' },
    { RAILWAY_PROJECT_ID: 'synthetic' }, { MYSQLHOST: 'synthetic' },
    { DATABASE_URL: 'synthetic' }, { DEMO_DB_HOST: 'synthetic' },
    { DEMO_SYNC_ENABLED: 'true' }, { DEMO_MODE: 'true' },
    { DEV_INSTANCE_ID: undefined }, { DEV_INSTANCE_ID: 'not-a-uuid' },
    { DEV_DB_ACCOUNT_HOST: '%' }, { DEV_BOOTSTRAP_CONFIRM: 'yes' },
    { DEV_PROVISION_USER: 'careerops_app' }, { DEV_PROVISION_PASSWORD: 'synthetic-db-only-1234' },
    { DB_PASSWORD: '<placeholder>' }
  ])('rejects unsafe or unidentified target %#', async change => {
    const { connect } = database();
    await expect(bootstrapDev({ ...settings(), ...change }, connect)).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
  });

  it.each([
    { count: 1 }, { count: '2' }, { count: null }, { existingAccount: true },
    { server: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    { sqlMode: 'STRICT_TRANS_TABLES,NO_BACKSLASH_ESCAPES' }, { partialRevokes: null }
  ])('refuses existing resources or incompatible identity/semantics %#', async options => {
    const { connection, connect } = database(options);
    await expect(bootstrapDev(settings(), connect)).rejects.toThrow();
    expect(writes(connection)).toEqual([]);
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it('imports only the fresh baseline and verifies metadata, identity and DML using mocks', async () => {
    const provision = database();
    const app = database();
    const connect = vi.fn().mockResolvedValueOnce(provision.connection).mockResolvedValueOnce(app.connection);
    await bootstrapDev(settings(), connect);
    expect(connect.mock.calls[0][0].user).toBe('local_provisioner');
    expect(connect.mock.calls[0][0].database).toBeUndefined();
    expect(connect.mock.calls[1][0].user).toBe('careerops_app');
    expect(connect.mock.calls[1][0].database).toBe('careerops_dev');
    const statements = writes(provision.connection).map(([sql]) => sql).join('\n');
    expect(statements).toContain("`role` varchar(50) NOT NULL DEFAULT 'user'");
    expect(statements).toContain('`industry` varchar(100)');
    expect(statements).not.toMatch(/ALTER TABLE|DROP|TRUNCATE/);
    expect(provision.connection.query).toHaveBeenCalledWith(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\\_dev`.* TO ?@?', ['careerops_app', 'localhost']);
    expect(app.connection.query).toHaveBeenCalledWith('SELECT CURRENT_USER() AS account');
    expect(app.connection.query).toHaveBeenCalledWith('SHOW GRANTS FOR CURRENT_USER');
    expect(app.connection.end).toHaveBeenCalledOnce();
    expect(provision.connection.end).toHaveBeenCalledOnce();
  });

  it('uses literal schema grants when partial_revokes is enabled', async () => {
    const provision = database({ partialRevokes: 1 });
    const app = database({ partialRevokes: 1, grant: 'GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops_dev`.* TO `careerops_app`@`localhost`' });
    await bootstrapDev(settings(), vi.fn().mockResolvedValueOnce(provision.connection).mockResolvedValueOnce(app.connection));
    expect(provision.connection.query).toHaveBeenCalledWith(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops_dev`.* TO ?@?', ['careerops_app', 'localhost']);
  });

  it('refuses a preexisting or concurrently created schema even when metadata appears empty', async () => {
    const { connection, connect } = database();
    const query = connection.query.getMockImplementation();
    connection.query.mockImplementation(async (...args) => {
      if (args[0].startsWith('CREATE DATABASE')) throw { code: 'ER_DB_CREATE_EXISTS' };
      return query(...args);
    });
    await expect(bootstrapDev(settings(), connect)).rejects.toMatchObject({ code: 'ER_DB_CREATE_EXISTS' });
    expect(writes(connection)).toEqual([[
      'CREATE DATABASE `careerops_dev` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'
    ]]);
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it.each([
    { account: 'careerops_app@%' },
    { grant: 'GRANT ALL PRIVILEGES ON *.* TO `careerops_app`@`localhost`' }
  ])('fails verification without destructive cleanup %#', async options => {
    const provision = database();
    const app = database(options);
    await expect(bootstrapDev(settings(), vi.fn().mockResolvedValueOnce(provision.connection).mockResolvedValueOnce(app.connection))).rejects.toThrow();
    expect(writes(provision.connection).some(([sql]) => /DROP|TRUNCATE|DELETE/.test(sql) && !/^GRANT/.test(sql))).toBe(false);
    expect(app.connection.end).toHaveBeenCalledOnce();
  });
});

describe('synthetic DEV login provisioning', () => {
  it('stores a cost-12 bcrypt hash and explicit admin role with bound parameters', async () => {
    const { connection, connect } = database();
    await createDevUser(settings(), login(), connect);
    const [sql, params] = connection.execute.mock.calls[1];
    expect(sql).toBe('INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
    expect(params[0]).toBe('dev-admin@example.invalid');
    expect(params[3]).toBe('admin');
    expect(bcrypt.getRounds(params[1])).toBe(12);
    expect(await bcrypt.compare(login().password, params[1])).toBe(true);
    expect(sql).not.toContain(login().password);
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it('refuses an existing email without hashing or updating it', async () => {
    const { connection, connect } = database({ existingUser: true });
    const hash = vi.spyOn(bcrypt, 'hash');
    await expect(createDevUser(settings(), login(), connect)).rejects.toThrow('already exists');
    expect(hash).not.toHaveBeenCalled();
    expect(connection.execute).toHaveBeenCalledOnce();
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it('handles a concurrent duplicate insert without overwriting the account', async () => {
    const { connection, connect } = database();
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('synthetic-hash');
    connection.execute.mockResolvedValueOnce([[]]).mockRejectedValueOnce({ code: 'ER_DUP_ENTRY', sql: 'not-for-output' });
    await expect(createDevUser(settings(), login(), connect)).rejects.toThrow('already exists');
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it.each([
    { password: '' }, { password: 123 }, { password: 'short' },
    { password: 'x'.repeat(73) }, { password: '界'.repeat(25) },
    { password: '<login-password>' }, { password: 'password123456789' },
    { password: 'synthetic\npassword' }, { password: '            ' },
    { confirmation: 'different-confirmation' }, { email: 'someone@example.com' },
    { email: "dev' OR 1=1@example.invalid" },
    { password: settings().DB_PASSWORD, confirmation: settings().DB_PASSWORD }
  ])('rejects invalid identity/password before connecting %#', async change => {
    const { connect } = database();
    await expect(createDevUser(settings(), { ...login(), ...change }, connect)).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
  });

  it('accepts 72 UTF-8 bytes but never silently truncates longer passwords', () => {
    expect(() => validatePassword('界'.repeat(24))).not.toThrow();
    expect(() => validatePassword('界'.repeat(25))).toThrow();
  });

  it('also applies unsafe-target and actual account-host/grant checks to user creation', async () => {
    const { connection, connect } = database({ account: 'careerops_app@%' });
    await expect(createDevUser({ ...settings(), DB_HOST: 'remote.invalid' }, login(), connect)).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
    await expect(createDevUser(settings(), login(), connect)).rejects.toThrow('account host');
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.end).toHaveBeenCalledOnce();
  });
});

describe('credential-safe command input and errors', () => {
  it('requires a terminal and hides typed characters', async () => {
    const input = new PassThrough(); input.isTTY = true;
    const output = new PassThrough(); output.isTTY = true;
    let displayed = ''; output.on('data', chunk => { displayed += chunk; });
    const answer = hiddenInput('Password', input, output);
    input.write('synthetic-hidden-input\r');
    expect(await answer).toBe('synthetic-hidden-input');
    expect(displayed).toBe('Password: \n');
    expect(() => hiddenInput('Password', new PassThrough(), output)).toThrow('terminal');
  });

  it('rejects cancellation rather than accepting partial input', async () => {
    const input = new PassThrough(); input.isTTY = true;
    const output = new PassThrough(); output.isTTY = true;
    const answer = hiddenInput('Password', input, output);
    input.write('partial\x03');
    await expect(answer).rejects.toThrow('cancelled');
  });

  it('rejects command arguments without invoking a command or logging their values', async () => {
    const argv = process.argv;
    process.argv = ['node', 'script', 'synthetic-secret-argument'];
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const oldCode = process.exitCode;
    const action = vi.fn();
    try {
      await runCli(action);
      expect(action).not.toHaveBeenCalled();
      expect(JSON.stringify(error.mock.calls)).not.toContain('synthetic-secret-argument');
      expect(process.exitCode).toBe(1);
    } finally { process.exitCode = oldCode; process.argv = argv; }
  });

  it('redacts database errors even if the driver attaches credentials or SQL', async () => {
    vi.stubEnv('APP_ENV', 'test'); // Never load local dotenv while exercising the CLI wrapper.
    const argv = process.argv;
    process.argv = ['node', 'script'];
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const oldCode = process.exitCode;
    try {
      await runCli(async (_env, stage) => {
        stage('schema import');
        stage('synthetic-private-stage'); // Only fixed labels may reach output.
        throw Object.assign(new Error('synthetic-private-error'), { sql: 'synthetic-private-sql' });
      });
      expect(JSON.stringify(error.mock.calls)).not.toContain('synthetic-private');
      expect(error.mock.calls[0][0]).toContain('schema import');
      expect(process.exitCode).toBe(1);
    } finally { process.exitCode = oldCode; process.argv = argv; }
  });
});
