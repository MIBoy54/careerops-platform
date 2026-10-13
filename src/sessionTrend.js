// Historical DATETIME values must be interpreted in their verified recording zone.
// This setting is deliberately local to this report; other metrics are unchanged.
export const SESSION_TREND_SQL = `
WITH RECURSIVE
report_window AS (
  SELECT UTC_TIMESTAMP(6) AS window_end
),
buckets AS (
  SELECT 0 AS bucket_index
  UNION ALL SELECT bucket_index + 1 FROM buckets WHERE bucket_index < 11
),
session_starts AS (
  SELECT session_id, CONVERT_TZ(MIN(first_seen), ?, '+00:00') AS started_at
  FROM visitor_analytics
  GROUP BY session_id
),
counts AS (
  SELECT FLOOR(TIMESTAMPDIFF(MICROSECOND,
    DATE_SUB(w.window_end, INTERVAL 24 HOUR), s.started_at) / 7200000000) AS bucket_index,
    COUNT(*) AS sessions
  FROM session_starts s CROSS JOIN report_window w
  WHERE s.started_at >= DATE_SUB(w.window_end, INTERVAL 24 HOUR)
    AND s.started_at < w.window_end
  GROUP BY bucket_index
)
SELECT b.bucket_index, COALESCE(c.sessions, 0) AS sessions,
  DATE_FORMAT(DATE_SUB(w.window_end, INTERVAL 24 HOUR), '%Y-%m-%dT%H:%i:%s.%fZ') AS window_start,
  DATE_FORMAT(w.window_end, '%Y-%m-%dT%H:%i:%s.%fZ') AS window_end,
  DATE_FORMAT(DATE_ADD(DATE_SUB(w.window_end, INTERVAL 24 HOUR),
    INTERVAL (b.bucket_index * 2) HOUR), '%Y-%m-%dT%H:%i:%s.%fZ') AS bucket_start,
  DATE_FORMAT(DATE_ADD(DATE_SUB(w.window_end, INTERVAL 24 HOUR),
    INTERVAL ((b.bucket_index + 1) * 2) HOUR), '%Y-%m-%dT%H:%i:%s.%fZ') AS bucket_end,
  CONVERT_TZ(w.window_end, '+00:00', ?) IS NOT NULL AS timezone_valid
FROM buckets b CROSS JOIN report_window w
LEFT JOIN counts c ON c.bucket_index = b.bucket_index
ORDER BY b.bucket_index
`;

export function createSessionTrendHandler(pool, getSourceTimeZone = () => process.env.SESSION_TREND_SOURCE_TIME_ZONE) {
  return async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const sourceTimeZone = getSourceTimeZone()?.trim();
      if (!sourceTimeZone) {
        throw new Error('SESSION_TREND_SOURCE_TIME_ZONE must match historical first_seen values');
      }
      const [rows] = await pool.query(SESSION_TREND_SQL, [sourceTimeZone, sourceTimeZone]);
      if (rows.length !== 12 || rows.some(row => !Number(row.timezone_valid))) {
        throw new Error('Session trend timezone conversion is unavailable');
      }
      res.json({
        metric: 'unique_sessions_started',
        time_zone: 'UTC',
        source_time_zone: sourceTimeZone,
        window_start: rows[0].window_start,
        window_end: rows[0].window_end,
        interval_hours: 2,
        buckets: rows.map(row => ({
          start: row.bucket_start,
          end: row.bucket_end,
          sessions: Number(row.sessions)
        }))
      });
    } catch (error) {
      console.error('Session trend failed:', error.message);
      res.status(500).json({ error: 'Session activity is unavailable. Please try again later.' });
    }
  };
}
