import { describe, expect, it, vi } from 'vitest';
import { createSessionTrendHandler, SESSION_TREND_SQL } from '../../src/sessionTrend.js';

const rows = () => Array.from({ length: 12 }, (_, i) => ({
  bucket_index: i, sessions: i === 3 ? '7' : 0,
  window_start: '2026-10-08T15:30:00.000000Z', window_end: '2026-10-09T15:30:00.000000Z',
  bucket_start: new Date(Date.UTC(2026, 9, 8, 15, 30) + i * 7200000).toISOString(),
  bucket_end: new Date(Date.UTC(2026, 9, 8, 15, 30) + (i + 1) * 7200000).toISOString(), timezone_valid: 1
}));
const response = () => ({ set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() });

describe('session trend API', () => {
  it('returns twelve ordered timestamped buckets and UTC window metadata', async () => {
    const pool = { query: vi.fn().mockResolvedValue([rows()]) };
    const res = response();
    await createSessionTrendHandler(pool, () => '+05:30')({}, res);
    expect(pool.query).toHaveBeenCalledWith(SESSION_TREND_SQL, ['+05:30', '+05:30']);
    const report = res.json.mock.calls[0][0];
    expect(report.time_zone).toBe('UTC');
    expect(report.metric).toBe('unique_sessions_started');
    expect(report.buckets).toHaveLength(12);
    expect(report.buckets[3].sessions).toBe(7);
    expect(report.buckets[0].sessions).toBe(0);
    expect(report.buckets[0].start).toBe('2026-10-08T15:30:00.000Z');
    expect(report.buckets[11].end).toBe('2026-10-09T15:30:00.000Z');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it.each(['missing timezone', 'unsupported timezone', 'database failure'])('fails explicitly for %s', async name => {
    const pool = { query: vi.fn().mockResolvedValue([rows().map(row => ({ ...row, timezone_valid: 0 }))]) };
    if (name === 'database failure') pool.query.mockRejectedValue(new Error('offline'));
    const res = response();
    await createSessionTrendHandler(pool, () => name === 'missing timezone' ? '' : 'Bad/Zone')({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0]).toHaveProperty('error');
    if (name === 'missing timezone') expect(pool.query).not.toHaveBeenCalled();
  });
});
