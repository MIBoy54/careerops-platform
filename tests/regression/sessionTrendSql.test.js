import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { SESSION_TREND_SQL } from '../../src/sessionTrend.js';

// Opt-in: only the named disposable container is queried, never an application DB.
const run = process.env.SESSION_TREND_TEST_MYSQL === '1' ? describe : describe.skip;
const end = '2026-10-09 00:30:00.000000';
function query(records, sourceZone = '+00:00', dbZone = '+00:00', reportingEnd = end) {
  const literal = value => `'${value.replaceAll("'", "''")}'`;
  const syntheticRows = records.length ? records.map(([id, date]) =>
    `SELECT ${literal(id)} AS session_id, CAST(${literal(date)} AS DATETIME(6)) AS first_seen`
  ).join(' UNION ALL ') : 'SELECT NULL AS session_id, CAST(NULL AS DATETIME(6)) AS first_seen WHERE FALSE';
  const sql = SESSION_TREND_SQL
    .replace('WITH RECURSIVE', `WITH RECURSIVE visitor_analytics AS (${syntheticRows}),`)
    .replace('UTC_TIMESTAMP(6)', `CAST(${literal(reportingEnd)} AS DATETIME(6))`)
    .replaceAll('?', literal(sourceZone));
  const env = { ...process.env };
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key];
  const output = execFileSync('docker', ['--host=unix:///var/run/docker.sock', 'exec', '-i',
    'careerops-trend-dev-test', 'mysql', '-uroot', '--batch', '--raw', '--skip-column-names'], {
      input: `SET time_zone=${literal(dbZone)}; ${sql};`, encoding: 'utf8', env
    });
  return output.trim().split('\n').map(line => {
    const [index, count, start, finish, bucketStart, bucketEnd, valid] = line.split('\t');
    return { index: Number(index), count: Number(count), start, finish, bucketStart, bucketEnd, valid: Number(valid) };
  });
}
run('MySQL session trend aggregation with synthetic CTEs', () => {
  it('includes start, excludes end and future, and puts internal boundaries in the next bucket', () => {
    const rows = query([
      ['before', '2026-10-08 00:29:59.999999'], ['start', '2026-10-08 00:30:00.000000'],
      ['left', '2026-10-08 02:29:59.999999'], ['boundary', '2026-10-08 02:30:00.000000'],
      ['last', '2026-10-09 00:29:59.999999'], ['end', end], ['future', '2026-10-09 00:30:00.000001']
    ]);
    expect(rows.map(row => row.count)).toEqual([2, 1, ...Array(9).fill(0), 1]);
    expect(rows[0].bucketStart).toBe('2026-10-08T00:30:00.000000Z');
    expect(rows[11].bucketEnd).toBe('2026-10-09T00:30:00.000000Z');
    expect(rows.every((row, i) => row.index === i && (i === 0 || row.bucketStart === rows[i - 1].bucketEnd))).toBe(true);
  });
  it('returns twelve zeros for no activity', () => {
    expect(query([]).map(row => row.count)).toEqual(Array(12).fill(0));
  });
  it('deduplicates a session across hours and excludes sessions first started before the window', () => {
    const rows = query([
      ['old', '2026-10-07 23:59:00'], ['old', '2026-10-08 05:00:00'],
      ['new', '2026-10-08 01:00:00'], ['new', '2026-10-08 04:00:00'],
      ['other', '2026-10-08 04:00:00'], ['third', '2026-10-08 04:00:00']
    ]);
    expect(rows.map(row => row.count)).toEqual([1, 2, ...Array(10).fill(0)]);
  });
  it('uses verified source timezone independently of the MySQL session timezone', () => {
    const records = [['start', '2026-10-07 19:30:00'], ['end', '2026-10-08 19:30:00']];
    const utc = query(records, '-05:00', '+00:00');
    const shifted = query(records, '-05:00', '+09:00');
    expect(shifted).toEqual(utc);
    expect(utc.map(row => row.count)).toEqual([1, ...Array(11).fill(0)]);
  });
  it('retains twenty-four elapsed hours through a DST transition', () => {
    const rows = query([
      ['a', '2026-11-01 05:30:00'], ['b', '2026-11-01 06:30:00'], ['c', '2026-11-01 07:30:00']
    ], '+00:00', '-06:00', '2026-11-01 12:00:00.000000');
    expect(Date.parse(rows[11].bucketEnd) - Date.parse(rows[0].bucketStart)).toBe(86400000);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(3);
  });
  it('flags unavailable timezone conversions rather than returning a valid empty report', () => {
    expect(query([], 'Invalid/Zone').every(row => row.valid === 0)).toBe(true);
  });
});
