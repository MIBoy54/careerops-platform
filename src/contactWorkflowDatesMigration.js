const columns = ['stage_entered_at', 'interview_date'];

export async function migrateWorkflowDates(connection, { expectedDatabase, confirmation }) {
  if (!expectedDatabase || confirmation !== 'add-workflow-dates:' + expectedDatabase) {
    throw new Error('Explicit workflow dates migration confirmation required');
  }
  const [[identity]] = await connection.query('SELECT DATABASE() AS db');
  if (identity.db !== expectedDatabase) throw new Error('Workflow dates migration database mismatch');
  const [rows] = await connection.query(
    'SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    ['recruiter_tracker']
  );
  const existing = new Map(rows.map(row => [row.COLUMN_NAME, row]));
  if (!existing.has('hiring_stage') || !existing.has('position_status')) {
    throw new Error('Expected contact workflow schema missing');
  }
  for (const [index, name] of columns.entries()) {
    const column = existing.get(name);
    if (column && (column.DATA_TYPE !== (index === 0 ? 'datetime' : 'date') || column.IS_NULLABLE !== 'YES')) {
      throw new Error('Incompatible workflow date column: ' + name);
    }
  }
  const definitions = ['ADD COLUMN stage_entered_at DATETIME NULL', 'ADD COLUMN interview_date DATE NULL'];
  const missing = columns.filter(name => !existing.has(name));
  if (missing.length) {
    await connection.query('SET SESSION lock_wait_timeout = 5');
    await connection.query('ALTER TABLE recruiter_tracker ' +
      definitions.filter((_, index) => missing.includes(columns[index])).join(', ') + ', ALGORITHM=INSTANT');
  }
  return { database: identity.db, addedColumns: missing };
}
