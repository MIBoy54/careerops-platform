import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import mysql from 'mysql2/promise';
import { fixture } from '../helpers/qaRefreshFixture.js';
import { digest, REFRESH_TABLES } from '../../src/qaDataset.js';
import { inspectDatabase, createRefreshPlan, executeRefresh, validateRestore } from '../../src/qaRefresh.js';

// Fixed disposable container and Unix socket only. No host/URL/env credentials.
const run = process.env.QA_REFRESH_TEST_MYSQL === '1' ? describe : describe.skip;
const socketPath = '/tmp/careerops-qa-refresh-test/mysqld.sock';
const dockerEnv = { ...process.env };
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnv[key];
const docker = args => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env: dockerEnv, encoding: 'utf8' });
function setup(extra = '') {
  const env = dockerEnv;
  execFileSync('docker', ['--host=unix:///var/run/docker.sock', 'exec', '-i', 'careerops-qa-refresh-test', 'mysql', '-uroot'], { env, input: `
    DROP DATABASE IF EXISTS careerops_qa;
    CREATE DATABASE careerops_qa;
    CREATE USER IF NOT EXISTS 'qa_fixture'@'localhost' IDENTIFIED BY 'synthetic-fixture-only';
    GRANT SELECT, INSERT, UPDATE, DELETE ON \`careerops\\_qa\`.* TO 'qa_fixture'@'localhost';
    USE careerops_qa;
    CREATE TABLE recruiter_tracker (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, recruiter_name VARCHAR(100), company VARCHAR(100),
      industry VARCHAR(50), email VARCHAR(100), phone VARCHAR(100), address VARCHAR(100), notes VARCHAR(100), website VARCHAR(100),
      location VARCHAR(100), requisition_id VARCHAR(100), reported_to_unemployment VARCHAR(100), date_reported DATE NULL DEFAULT NULL) ENGINE=InnoDB AUTO_INCREMENT=1000;
    CREATE TABLE weekly_reports (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, week_start DATE, week_end DATE, submitted TINYINT, submitted_at DATETIME) ENGINE=InnoDB AUTO_INCREMENT=1000;
    CREATE TABLE report_job_contacts (report_id INT NOT NULL, recruiter_tracker_id INT NOT NULL, PRIMARY KEY(report_id, recruiter_tracker_id),
      FOREIGN KEY(report_id) REFERENCES weekly_reports(id), FOREIGN KEY(recruiter_tracker_id) REFERENCES recruiter_tracker(id)) ENGINE=InnoDB;
    CREATE TABLE users (id INT PRIMARY KEY, value VARCHAR(100)) ENGINE=InnoDB;
    CREATE TABLE validation_runs LIKE users;
    CREATE TABLE visitor_analytics LIKE users;
    CREATE TABLE analytics_heartbeat_events LIKE users;
    INSERT INTO users VALUES(3, 'synthetic-auth-sentinel');
    INSERT INTO validation_runs VALUES(3, 'synthetic-history-sentinel');
    INSERT INTO visitor_analytics VALUES(3, 'synthetic-session-sentinel');
    INSERT INTO analytics_heartbeat_events VALUES(3, 'synthetic-heartbeat-sentinel');
    ${extra}
  `, encoding: 'utf8' });
}
run('MySQL 8.4 QA refresh with disposable synthetic fixtures', () => {
  let c;
  beforeEach(async () => {
    const container = JSON.parse(docker(['inspect', 'careerops-qa-refresh-test']))[0];
    expect(container.HostConfig.NetworkMode).toBe('none');
    expect(container.HostConfig.Tmpfs).toHaveProperty('/var/lib/mysql');
    expect(container.Mounts.some(m => m.Source === '/tmp/careerops-qa-refresh-test' && m.Destination === '/var/run/mysqld')).toBe(true);
    setup();
    c = await mysql.createConnection({ socketPath, user: 'qa_fixture', password: 'synthetic-fixture-only', database: 'careerops_qa', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
  });
  afterEach(async () => { if (c) await c.end(); });
  async function realPlan() {
    const f = fixture(); const audit = await inspectDatabase(c, 'careerops_qa');
    // Explicitly exercise PROD industry(100) -> QA industry(50), and omitted date_reported.
    for (const table of REFRESH_TABLES) f.bundle.schemas[table] = structuredClone(audit.tables[table].columns).filter(col => col.name !== 'date_reported');
    f.bundle.schemas.recruiter_tracker.find(col => col.name === 'industry').type = 'varchar(100)';
    f.manifest.target.serverUuid = audit.serverUuid; f.manifest.backup.targetServerUuid = audit.serverUuid;
    f.restore.targetStateHash = digest(audit);
    f.manifest.privacy.reviewedFields = Object.fromEntries(REFRESH_TABLES.map(t => [t, f.bundle.schemas[t].map(col => col.name)]));
    const plan = createRefreshPlan(f.bundle, f.manifest, audit, f.backupBytes, f.restore);
    const approval = mode => ({ ...f.approval(mode), planHash: plan.planHash });
    return { plan, approval, audit, f };
  }
  it('rolls back actual DELETE/INSERT and preserves counters, users and telemetry; then commits with separate approval', async () => {
    const { plan, approval, audit } = await realPlan();
    const rehearsal = await executeRefresh(c, plan, { approval: approval('rehearse') });
    expect(rehearsal.mode).toBe('rolled-back'); expect(await inspectDatabase(c, 'careerops_qa')).toEqual(audit);
    await executeRefresh(c, plan, { mode: 'commit', approval: approval('commit'), rehearsal });
    const state = await inspectDatabase(c, 'careerops_qa');
    for (const t of ['users', 'validation_runs', 'visitor_analytics', 'analytics_heartbeat_events']) expect(state.tables[t]).toEqual(audit.tables[t]);
    expect(state.tables.recruiter_tracker.count).toBe(1);
    expect(state.tables.recruiter_tracker.autoIncrement).toBe('1000');
    const [rows] = await c.query('SELECT date_reported, recruiter_name, industry, email FROM recruiter_tracker');
    expect(rows).toEqual([{ date_reported: null, recruiter_name: 'Recruiter 1', industry: 'QA', email: null }]);
  });
  it('rolls back partial work on a real constraint failure before commit', async () => {
    await c.end(); setup('ALTER TABLE weekly_reports ADD CONSTRAINT synthetic_failure CHECK (submitted = 1);');
    c = await mysql.createConnection({ socketPath, user: 'qa_fixture', password: 'synthetic-fixture-only', database: 'careerops_qa', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
    const { plan, approval, audit } = await realPlan();
    await expect(executeRefresh(c, plan, { approval: approval('rehearse') })).rejects.toThrow('not committed');
    expect(await inspectDatabase(c, 'careerops_qa')).toEqual(audit);
    // MySQL rejects this statement if a transaction is still active.
    await expect(c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')).resolves.toBeDefined();
  });
  it('blocks drift and a zero/incorrect post-refresh count before commit', async () => {
    const { plan, approval } = await realPlan();
    await c.query("INSERT INTO users VALUES(4, 'synthetic-drift')");
    await expect(executeRefresh(c, plan, { approval: approval('rehearse') })).rejects.toThrow('not committed');
    const [rows] = await c.query('SELECT COUNT(*) AS n FROM recruiter_tracker'); expect(Number(rows[0].n)).toBe(0);
  });
  it('validates measured isolated restore state and rejects lost authentication rows', async () => {
    const { audit, f } = await realPlan();
    const restored = structuredClone(audit); restored.database = 'careerops_qa_restore_validation'; restored.serverUuid = f.restore.localServerUuid;
    const local = { host: '127.0.0.1', database: restored.database, serverUuid: restored.serverUuid };
    expect(validateRestore(audit, restored, f.manifest.backup, f.backupBytes, local).passed).toBe(true);
    restored.tables.users.count = 0;
    expect(() => validateRestore(audit, restored, f.manifest.backup, f.backupBytes, local)).toThrow();
  });
  it('exports and restores a real synthetic dump on a second isolated MySQL server', async () => {
    const audit = await inspectDatabase(c, 'careerops_qa');
    const restoreContainer = JSON.parse(docker(['inspect', 'careerops-qa-restore-test']))[0];
    expect(restoreContainer.HostConfig.NetworkMode).toBe('none');
    expect(restoreContainer.HostConfig.Tmpfs).toHaveProperty('/var/lib/mysql');
    expect(restoreContainer.Mounts.some(m => m.Source === '/tmp/careerops-qa-restore-test' && m.Destination === '/var/run/mysqld')).toBe(true);
    const bytes = Buffer.from(docker(['exec', 'careerops-qa-refresh-test', 'mysqldump', '-uroot', '--single-transaction', '--quick', '--hex-blob',
      '--skip-triggers', '--skip-routines', '--skip-events', '--set-gtid-purged=OFF', '--no-tablespaces', '--column-statistics=0', 'careerops_qa']));
    const localSql = "DROP DATABASE IF EXISTS careerops_qa_restore_validation; CREATE DATABASE careerops_qa_restore_validation; CREATE USER IF NOT EXISTS 'restore_fixture'@'localhost' IDENTIFIED BY 'synthetic-restore-only'; GRANT SELECT ON careerops_qa_restore_validation.* TO 'restore_fixture'@'localhost'; USE careerops_qa_restore_validation;";
    execFileSync('docker', ['--host=unix:///var/run/docker.sock', 'exec', '-i', 'careerops-qa-restore-test', 'mysql', '-uroot'],
      { env: dockerEnv, input: Buffer.concat([Buffer.from(localSql + '\n'), bytes]), encoding: 'utf8' });
    const local = await mysql.createConnection({ socketPath: '/tmp/careerops-qa-restore-test/mysqld.sock', user: 'restore_fixture',
      password: 'synthetic-restore-only', database: 'careerops_qa_restore_validation', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
    try {
      const restored = await inspectDatabase(local, 'careerops_qa_restore_validation');
      expect(restored.serverUuid).not.toBe(audit.serverUuid);
      const backup = { sha256: digest(bytes), targetServerUuid: audit.serverUuid };
      const result = validateRestore(audit, restored, backup, bytes,
        { host: '127.0.0.1', database: 'careerops_qa_restore_validation', serverUuid: restored.serverUuid });
      expect(result.passed).toBe(true);
      expect(result.targetStateHash).toBe(digest(audit));
      expect(() => validateRestore(audit, restored, backup, Buffer.from('corrupted'),
        { host: '127.0.0.1', database: 'careerops_qa_restore_validation', serverUuid: restored.serverUuid })).toThrow('checksum');
    } finally { await local.end(); }
  });

});
