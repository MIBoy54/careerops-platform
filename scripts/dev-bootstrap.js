import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { loadEnvironment, resolveEnvironment, verifyPrimaryDatabase } from '../src/environment.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

// Reviewed fresh-schema contract; changes require an explicit contract update.
export const freshSchema = {
  analytics_heartbeat_events: [
    "`id` int NOT NULL AUTO_INCREMENT",
    "`session_id` varchar(100) NOT NULL",
    "`page_path` varchar(255) NOT NULL",
    "`event_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "`seconds` int NOT NULL DEFAULT '0'",
    "PRIMARY KEY (`id`)",
  ],
  demo_refresh_history: [
    "`id` int NOT NULL AUTO_INCREMENT",
    "`started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "`completed_at` datetime DEFAULT NULL",
    "`status` varchar(20) NOT NULL DEFAULT 'STARTED'",
    "`trigger_source` varchar(50) DEFAULT NULL",
    "`rows_synced` int DEFAULT NULL",
    "`notes` text",
    "`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "PRIMARY KEY (`id`)",
  ],
  recruiter_tracker: [
    "`id` int NOT NULL AUTO_INCREMENT",
    "`date_contacted` date DEFAULT NULL",
    "`recruiter_name` varchar(255) DEFAULT NULL",
    "`company` varchar(255) DEFAULT NULL",
    "`role_level` varchar(100) DEFAULT NULL",
    "`role_type` varchar(100) DEFAULT NULL",
    "`location` varchar(255) DEFAULT NULL",
    "`comp_range` varchar(100) DEFAULT NULL",
    "`status` varchar(50) DEFAULT NULL",
    "`relationship_status` varchar(50) DEFAULT NULL",
    "`phone` varchar(50) DEFAULT NULL",
    "`email` varchar(255) DEFAULT NULL",
    "`address` varchar(255) DEFAULT NULL",
    "`website` varchar(255) DEFAULT NULL",
    "`notes` text",
    "`reported_to_unemployment` varchar(10) DEFAULT NULL",
    "`follow_up_date` date DEFAULT NULL",
    "`role_title` varchar(255) DEFAULT NULL",
    "`requisition_id` varchar(100) DEFAULT NULL",
    "`industry` varchar(100) DEFAULT NULL",
    "PRIMARY KEY (`id`)",
  ],
  report_job_contacts: [
    "`id` int NOT NULL AUTO_INCREMENT",
    "`report_id` int NOT NULL",
    "`recruiter_tracker_id` int NOT NULL",
    "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
    "PRIMARY KEY (`id`)",
  ],
  users: [
    "`id` int NOT NULL AUTO_INCREMENT",
    "`email` varchar(255) NOT NULL",
    "`full_name` varchar(255) DEFAULT NULL",
    "`created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP",
    "`password_hash` varchar(255) DEFAULT NULL",
    "`role` varchar(50) NOT NULL DEFAULT 'user'",
    "`last_login` timestamp NULL DEFAULT NULL",
    "`last_login_at` date DEFAULT NULL",
    "PRIMARY KEY (`id`)",
    "UNIQUE KEY `email` (`email`)",
  ],
  validation_runs: [
    "`id` int NOT NULL AUTO_INCREMENT",
    "`run_type` varchar(100) NOT NULL",
    "`status` varchar(50) NOT NULL DEFAULT 'STARTED'",
    "`started_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "`completed_at` datetime DEFAULT NULL",
    "`duration_ms` int DEFAULT NULL",
    "`trigger_source` varchar(100) DEFAULT NULL",
    "`notes` text",
    "`created_at` datetime DEFAULT CURRENT_TIMESTAMP",
    "PRIMARY KEY (`id`)",
  ],
  visitor_analytics: [
    "`id` int NOT NULL AUTO_INCREMENT",
    "`session_id` varchar(100) NOT NULL",
    "`page_path` varchar(255) NOT NULL",
    "`first_seen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "`last_seen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "`time_spent_seconds` int NOT NULL DEFAULT '0'",
    "PRIMARY KEY (`id`)",
    "KEY `session_id` (`session_id`)",
  ],
  weekly_reports: [
    "`id` int NOT NULL AUTO_INCREMENT",
    "`week_start` date DEFAULT NULL",
    "`week_end` date DEFAULT NULL",
    "`submitted` tinyint DEFAULT '0'",
    "`submitted_at` datetime DEFAULT NULL",
    "PRIMARY KEY (`id`)",
  ],
};
const sessionStatements = new Set([
  "/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */",
  "/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */",
  "/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */",
  "/*!50503 SET NAMES utf8mb4 */",
  "/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */",
  "/*!40103 SET TIME_ZONE='+00:00' */",
  "/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */",
  "/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */",
  "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */",
  "/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */",
  "/*!40101 SET @saved_cs_client = @@character_set_client */",
  "/*!50503 SET character_set_client = utf8mb4 */",
  "/*!40101 SET character_set_client = @saved_cs_client */",
  "/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */",
  "/*!40101 SET SQL_MODE=@OLD_SQL_MODE */",
  "/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */",
  "/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */",
  "/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */",
  "/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */",
  "/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */",
  "/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */"
]);

export function parseBaseline(sql) {
  const seen = new Set();
  const statements = sql.split(';').map(statement => statement.trim()).filter(Boolean);
  for (const statement of statements) {
    if (sessionStatements.has(statement)) continue;
    const table = /^CREATE TABLE `([a-z_]+)` \(/.exec(statement)?.[1];
    const expected = freshSchema[table];
    const reviewed = expected && 'CREATE TABLE `' + table + '` ( ' + expected.join(', ') + ' ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci';
    // This is an allowlist for this baseline, not a general SQL parser. Embedded
    // semicolons, DELIMITER, programs, other comments and changed DDL fail closed.
    if (!reviewed || seen.has(table) || statement.replace(/\s+/g, ' ') !== reviewed) {
      throw new Error('Unsupported or changed fresh-schema SQL.');
    }
    seen.add(table);
  }
  if (seen.size !== Object.keys(freshSchema).length) throw new Error('Incomplete fresh-schema SQL.');
  return statements;
}

const defaultValue = value => value == null ? null
  : /^current_timestamp(?:\(\))?$/i.test(String(value)) ? 'CURRENT_TIMESTAMP' : String(value);

export async function verifySchema(connection) {
  const [tables] = await connection.execute(`SELECT TABLE_NAME AS name, TABLE_TYPE AS type,
    ENGINE AS engine, TABLE_COLLATION AS collation FROM information_schema.tables WHERE table_schema = ?`, ['careerops_dev']);
  if (tables.length !== Object.keys(freshSchema).length || new Set(tables.map(table => table.name)).size !== tables.length || tables.some(table =>
    !Object.hasOwn(freshSchema, table.name) || table.type !== 'BASE TABLE' ||
    table.engine !== 'InnoDB' || table.collation !== 'utf8mb4_0900_ai_ci')) {
    throw new Error('Fresh-schema tables do not match the reviewed baseline.');
  }
  const [columns] = await connection.execute(`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS name,
    COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS default_value,
    EXTRA AS extra, COLLATION_NAME AS collation FROM information_schema.columns WHERE table_schema = ?`, ['careerops_dev']);
  const expected = Object.entries(freshSchema).flatMap(([table, definitions]) => definitions.filter(definition => definition.startsWith('`')).map(definition => {
    const match = /^`([a-z_]+)` (\w+(?:\(\d+\))?)(?: (NOT NULL|NULL))?(?: DEFAULT (NULL|'[^']*'|CURRENT_TIMESTAMP))?(?: (AUTO_INCREMENT))?$/.exec(definition);
    if (!match) throw new Error('Unsupported fresh-schema column contract.');
    return { table, name: match[1], type: match[2], nullable: match[3] === 'NOT NULL' ? 'NO' : 'YES',
      default_value: match[4] === 'NULL' ? null : defaultValue(match[4]?.replace(/^'|'$/g, '')),
      extra: match[5] ? 'auto_increment' : '' };
  }));
  if (columns.length !== expected.length || expected.some(spec => {
    const actual = columns.find(column => column.table_name === spec.table && column.name === spec.name);
    return !actual || actual.type !== spec.type || actual.nullable !== spec.nullable ||
      defaultValue(actual.default_value) !== spec.default_value ||
      actual.extra.toLowerCase().replace(/\bdefault_generated\b/g, '').trim() !== spec.extra ||
      (/^(varchar|text)/.test(spec.type) && actual.collation !== 'utf8mb4_0900_ai_ci');
  })) throw new Error('Fresh-schema columns do not match the reviewed baseline.');
  const [indexes] = await connection.execute(`SELECT TABLE_NAME AS table_name, INDEX_NAME AS name,
    NON_UNIQUE AS non_unique, SEQ_IN_INDEX AS position, COLUMN_NAME AS column_name, SUB_PART AS prefix_length
    FROM information_schema.statistics WHERE table_schema = ?`, ['careerops_dev']);
  for (const table of Object.keys(freshSchema)) {
    const primary = indexes.filter(index => index.table_name === table && index.name === 'PRIMARY');
    if (primary.length !== 1 || primary[0].column_name !== 'id' || Number(primary[0].non_unique) !== 0) {
      throw new Error('Fresh-schema primary key is missing.');
    }
  }
  const email = indexes.filter(index => index.table_name === 'users' && index.name === 'email');
  if (email.length !== 1 || email[0].column_name !== 'email' || Number(email[0].non_unique) !== 0) {
    throw new Error('Fresh-schema unique email constraint is missing.');
  }
  const session = indexes.filter(index => index.table_name === 'visitor_analytics' && index.name === 'session_id');
  if (session.length !== 1 || session[0].column_name !== 'session_id' ||
      Number(session[0].non_unique) !== 1 || Number(session[0].position) !== 1 || session[0].prefix_length !== null) {
    throw new Error('Fresh-schema session_id index is missing or differs from the baseline.');
  }
}

export async function verifyRequiredDml(connection) {
  // Unsafe grants are rejected first by verifyPrimaryDatabase. Here require all
  // four direct schema-wide privileges that bootstrap is intended to provision.
  const [[settings]] = await connection.query('SELECT @@GLOBAL.partial_revokes AS partial_revokes');
  if (![0, 1, '0', '1', false, true].includes(settings?.partial_revokes)) throw new Error('Unknown grant semantics.');
  const schema = [1, '1', true].includes(settings.partial_revokes) ? 'careerops_dev' : 'careerops\\_dev';
  const [rows] = await connection.query('SHOW GRANTS FOR CURRENT_USER');
  const granted = new Set();
  for (const row of rows) {
    const grant = Object.values(row)[0];
    const match = /^GRANT ([A-Z ,]+) ON (`[^`]+`|[a-z_\\]+)\.\* TO /i.exec(grant);
    if (match && match[2].replace(/^`|`$/g, '') === schema) {
      for (const privilege of match[1].split(',')) granted.add(privilege.trim().toUpperCase());
    }
  }
  if (['SELECT', 'INSERT', 'UPDATE', 'DELETE'].some(privilege => !granted.has(privilege))) {
    throw new Error('Required DEV schema-wide DML privileges are missing.');
  }
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.trim().length < 12 ||
      Buffer.byteLength(value, 'utf8') > 72 || /[\x00-\x1f\x7f]/.test(value) ||
      /[<>]|change.?me|placeholder|^password/i.test(value)) {
    throw new Error('Use a non-placeholder password of at least 12 characters and at most 72 UTF-8 bytes.');
  }
}

export function localDevConfig(env) {
  // Do not force DEV or discard inherited bindings: existing guards must reject them.
  const config = resolveEnvironment(env);
  if (config.appEnv !== 'dev' || env.DB_NAME !== 'careerops_dev' ||
      !uuid.test(env.DEV_INSTANCE_ID || '') ||
      !['localhost', '127.0.0.1', '::1'].includes(env.DEV_DB_ACCOUNT_HOST) ||
      !/^[a-z][a-z0-9_]{0,31}$/.test(env.DB_USER || '') || env.DB_USER === 'root' ||
      String(env.DEMO_MODE).trim().toLowerCase() === 'true') {
    throw new Error('Require explicit DEV schema, server UUID, loopback account host, and restricted application user.');
  }
  validatePassword(env.DB_PASSWORD);
  return config;
}

async function identify(connection, env) {
  const [[identity]] = await connection.query('SELECT @@server_uuid AS server_uuid');
  if (identity?.server_uuid?.toLowerCase() !== env.DEV_INSTANCE_ID.toLowerCase()) {
    throw new Error('Local DEV instance identity mismatch.');
  }
}

export async function verifyApplication(connection, env, config) {
  await identify(connection, env);
  const [[identity]] = await connection.query('SELECT CURRENT_USER() AS account');
  if (identity?.account !== `${env.DB_USER}@${env.DEV_DB_ACCOUNT_HOST}`) {
    throw new Error('MySQL matched an unexpected application account host.');
  }
  await verifyPrimaryDatabase({ getConnection: async () => ({
    query: (...args) => connection.query(...args), release() {}
  }) }, config);
  await verifyRequiredDml(connection);
}

export async function bootstrapDev(env, connect = mysql.createConnection, stage = () => {}) {
  stage('configuration');
  const config = localDevConfig(env);
  if (!env.DEV_PROVISION_USER?.trim() || env.DEV_PROVISION_USER === env.DB_USER ||
      !env.DEV_PROVISION_PASSWORD ||
      env.DEV_PROVISION_PASSWORD === env.DB_PASSWORD ||
      env.DEV_BOOTSTRAP_CONFIRM !== `careerops_dev@${env.DEV_INSTANCE_ID}`) {
    throw new Error('Require separate provisioning credentials and explicit schema/server confirmation.');
  }
  // This exact file is the fresh-install path. Historical upgrades are never imported.
  const sql = await readFile(new URL('../database/schema/001_initial_schema.sql', import.meta.url), 'utf8');
  const statements = parseBaseline(sql);
  stage('connection');
  const provision = await connect({
    host: config.primary.host, port: config.primary.port,
    user: env.DEV_PROVISION_USER, password: env.DEV_PROVISION_PASSWORD,
    connectTimeout: 10000, multipleStatements: false
  });
  let locked = false;
  let app;
  try {
    stage('instance verification');
    await identify(provision, env);
    stage('schema checks');
    const [[mode]] = await provision.query('SELECT @@SESSION.sql_mode AS sql_mode, @@GLOBAL.partial_revokes AS partial_revokes');
    if (!['0', '1', 0, 1, false, true].includes(mode?.partial_revokes) ||
        typeof mode.sql_mode !== 'string' || mode.sql_mode.split(',').includes('NO_BACKSLASH_ESCAPES')) {
      throw new Error('Unsupported MySQL grant or SQL escaping semantics.');
    }
    const [[lock]] = await provision.query("SELECT GET_LOCK('careerops_dev_bootstrap', 0) AS acquired");
    if (Number(lock?.acquired) !== 1) throw new Error('Another local DEV bootstrap is running.');
    locked = true;
    // Even empty tables/routines count as existing objects: never reset or merge.
    const [[objects]] = await provision.query(`SELECT
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ?) +
      (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = ?) +
      (SELECT COUNT(*) FROM information_schema.events WHERE event_schema = ?) AS count`,
    ['careerops_dev', 'careerops_dev', 'careerops_dev']);
    if (![0, '0'].includes(objects?.count)) throw new Error('DEV schema is not empty or could not be verified; refusing bootstrap.');
    const [accounts] = await provision.query('SELECT User FROM mysql.user WHERE User = ? AND Host = ?',
      [env.DB_USER, env.DEV_DB_ACCOUNT_HOST]);
    if (accounts.length) throw new Error('Application database account already exists; refusing overwrite.');

    // Require a new schema, even if an existing schema appears empty to this account.
    // CREATE without IF NOT EXISTS also closes a race with another schema creator.
    stage('schema import');
    await provision.query('CREATE DATABASE `careerops_dev` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
    await provision.query('USE `careerops_dev`');
    for (const statement of statements) {
      await provision.query(statement);
    }
    stage('schema verification');
    await verifySchema(provision);
    stage('account creation');
    await provision.query('CREATE USER ?@? IDENTIFIED BY ?',
      [env.DB_USER, env.DEV_DB_ACCOUNT_HOST, env.DB_PASSWORD]);
    const schema = [1, '1', true].includes(mode.partial_revokes) ? 'careerops_dev' : 'careerops\\_dev';
    await provision.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${mysql.escapeId(schema)}.* TO ?@?`,
      [env.DB_USER, env.DEV_DB_ACCOUNT_HOST]);
    stage('account verification');
    app = await connect({ ...config.primary, multipleStatements: false });
    await verifyApplication(app, env, config);
  } finally {
    // DDL is not transactional. On failure leave partial resources intact for review.
    try { if (app) await app.end(); }
    finally {
      try { if (locked) await provision.query("SELECT RELEASE_LOCK('careerops_dev_bootstrap')"); }
      finally { await provision.end(); }
    }
  }
}

export function hiddenInput(label, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY) throw new Error('Interactive input requires a terminal; use secure local configuration otherwise.');
  output.write(`${label}: `);
  return new Promise((resolve, reject) => {
    // readline handles editing but its echo stream is discarded.
    const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const reader = createInterface({ input, output: muted, terminal: true, historySize: 0 });
    let answered = false;
    reader.once('line', value => { answered = true; reader.close(); resolve(value); });
    reader.once('SIGINT', () => reader.close());
    reader.once('close', () => { output.write('\n'); if (!answered) reject(new Error('Input cancelled.')); });
  });
}

export async function runCli(action) {
  let stage = 'configuration';
  const setStage = value => {
    if (['configuration', 'connection', 'instance verification', 'schema checks', 'schema import',
      'schema verification', 'account creation', 'account verification', 'user creation'].includes(value)) stage = value;
  };
  try {
    if (process.argv.length !== 2) throw new Error('Command arguments are not accepted.');
    loadEnvironment(process.env, dotenv.config, root);
    await action(process.env, setStage);
  } catch {
    // Driver errors can carry SQL and credentials. Never print raw errors or bindings.
    console.error(`DEV command failed at ${stage}. Partial bootstrap resources may require review.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli(async (env, stage) => {
    localDevConfig(env);
    const options = { ...env };
    options.DEV_PROVISION_USER ||= await hiddenInput('Local provisioning user');
    options.DEV_PROVISION_PASSWORD ||= await hiddenInput('Local provisioning password');
    options.DEV_BOOTSTRAP_CONFIRM ||= await hiddenInput('Confirm careerops_dev@server-UUID');
    await bootstrapDev(options, mysql.createConnection, stage);
    console.log('Local DEV schema and restricted application account verified.');
  });
}
