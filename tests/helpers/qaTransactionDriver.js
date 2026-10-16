import { vi } from 'vitest';

// Stateful synthetic driver: inspectDatabase still runs its real metadata/SELECT
// code. Fault injection exercises rollback rather than mocking the refresh itself.
export function driver(f, fault) {
  let rows = structuredClone(f.rows), saved;
  let inserts = 0;
  const c = {
    beginTransaction: vi.fn(async () => { saved = structuredClone(rows); }),
    commit: vi.fn(async () => {}), rollback: vi.fn(async () => { rows = saved || rows; }), destroy: vi.fn(),
    query: vi.fn(async (sql, args) => {
      if (sql.includes('@@GLOBAL.partial_revokes')) return [[{ db: 'careerops_qa', server_uuid: f.audit.serverUuid, partial_revokes: 0, authenticated_account: 'qa_fixture@synthetic-host' }]];
      if (sql.includes('@@server_uuid')) return [[{ db: 'careerops_qa', server_uuid: f.audit.serverUuid }]];
      if (sql.startsWith('SHOW CREATE TABLE')) return [[{ 'Create Table': `SYNTHETIC_DDL_${/`([^`]+)`/.exec(sql)[1]}` }]];
      if (sql.startsWith('SHOW GRANTS')) return [[{ grant: "GRANT SELECT, INSERT, UPDATE, DELETE ON `careerops\\_qa`.* TO 'fixture'@'localhost'" }]];
      if (sql.includes('@@SESSION.sql_mode')) return [[{ mode: 'STRICT_TRANS_TABLES' }]];
      if (sql.includes('information_schema.TABLES')) return [Object.entries(f.audit.tables).map(([name, t]) => ({ name, engine: t.engine, kind: 'BASE TABLE', autoIncrement: t.autoIncrement }))];
      if (sql.includes('information_schema.COLUMNS')) return [Object.entries(f.audit.tables).flatMap(([tableName, t]) => t.columns.map(c => ({ ...c, tableName, nullable: c.nullable ? 'YES' : 'NO', defaultValue: c.default })))];
      if (sql.includes('information_schema.TRIGGERS') || sql.includes('information_schema.ROUTINES') || sql.includes('information_schema.EVENTS') || sql.includes('information_schema.KEY_COLUMN_USAGE')) return [[]];
      if (sql.startsWith('DELETE FROM')) { const table = /`([^`]+)`/.exec(sql)[1]; rows[table] = []; return [{ affectedRows: 0 }]; }
      if (sql.startsWith('SELECT COUNT(*)')) return [[{ n: fault === 'orphans' ? 1 : 0 }]];
      if (sql === 'SET SESSION information_schema_stats_expiry = 0') return [[]];
      if (sql.includes('LIMIT 0') || sql.startsWith('SET TRANSACTION')) return [[]];
      const table = /FROM `([^`]+)`/.exec(sql)?.[1];
      if (table) {
        if (fault === 'demo history' && inserts > 0 && table === 'demo_refresh_history') return [[{ id: 1, value: 'synthetic unexpected history' }]];
        if (fault === 'protected table' && inserts > 0 && table === 'users') return [[{ id: 3, value: 'changed' }]];
        if (fault === 'count' && inserts > 0 && table === 'weekly_reports') return [[]];
        return [structuredClone(rows[table])];
      }
      throw new Error(`Unhandled synthetic query ${sql} ${args}`);
    }),
    execute: vi.fn(async (sql, values) => {
      inserts++;
      if (fault === 'insert' && inserts === 2) throw new Error('PRIVATE_PASSWORD PRIVATE_ROW');
      const [, table, cols] = /^INSERT INTO `([^`]+)` \((.+)\) VALUES/.exec(sql);
      const names = [...cols.matchAll(/`([^`]+)`/g)].map(m => m[1]);
      rows[table].push(Object.fromEntries(names.map((name, i) => [name, values[i]])));
      return [{ affectedRows: 1, warningStatus: fault === 'coercion' ? 1 : 0 }];
    })
  };
  return { c, rows: () => rows };
}
