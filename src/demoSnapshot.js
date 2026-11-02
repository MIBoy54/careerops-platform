import { timingSafeEqual } from 'node:crypto';

const CONTACT_FIELDS = ['id','date_contacted','company','role_level','role_type','location',
  'comp_range','status','relationship_status','reported_to_unemployment','follow_up_date','industry'];
const REPORT_FIELDS = ['id','week_start','week_end','submitted','submitted_at'];
export const SNAPSHOT_LINKS_SQL = `SELECT links.report_id, links.recruiter_tracker_id
FROM report_job_contacts AS links
INNER JOIN recruiter_tracker AS contacts ON contacts.id = links.recruiter_tracker_id
INNER JOIN weekly_reports AS reports ON reports.id = links.report_id
LIMIT 50001`;

const MAX_BYTES = 8 * 1024 * 1024;
const TTL = 60 * 60 * 1000;
const pick = (row, fields) => Object.fromEntries(fields.map(key => [key, row[key] ?? null]));

export function protectSnapshot(raw) {
  const contacts = raw.contacts.map(row => ({
    ...pick(row, CONTACT_FIELDS), recruiter_name: 'Protected contact',
    reported_unemployment: row.reported_to_unemployment ?? null,
    next_follow_up_date: row.follow_up_date ?? null
  }));
  const ids = new Set(contacts.map(row => String(row.id)));
  const reports = raw.reports.map(row => pick(row, REPORT_FIELDS));
  const reportIds = new Set(reports.map(row => String(row.id)));
  const links = raw.links.map(row => pick(row, ['report_id','recruiter_tracker_id']));
  if (links.some(row => !ids.has(String(row.recruiter_tracker_id)) || !reportIds.has(String(row.report_id)))) {
    throw new Error('Snapshot references are incomplete');
  }
  return { schemaVersion: 1, capturedAt: raw.capturedAt, contacts, reports, links };
}

export function snapshotConfig(env, appEnv) {
  if (env.DEMO_ENTRY_SNAPSHOT_ENABLED !== 'true') return null;
  if (!['demo','production'].includes(appEnv)) throw new Error('Entry snapshots require DEMO or production');
  const token = env.DEMO_SNAPSHOT_TOKEN;
  if (!token || Buffer.byteLength(token) < 32 || new Set(token).size < 8) {
    throw new Error('Entry snapshots require a strong DEMO_SNAPSHOT_TOKEN');
  }
  if (appEnv === 'production') {
    if (!env.DEMO_SNAPSHOT_DB_USER || !env.DEMO_SNAPSHOT_DB_PASSWORD ||
        env.DEMO_SNAPSHOT_DB_USER === env.DB_USER || env.DEMO_SNAPSHOT_DB_USER === 'root') {
      throw new Error('Snapshot source requires separate read-only database credentials');
    }
    return { token, user: env.DEMO_SNAPSHOT_DB_USER, password: env.DEMO_SNAPSHOT_DB_PASSWORD };
  }
  const url = new URL(env.DEMO_SNAPSHOT_SOURCE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/internal/demo-snapshot') throw new Error('Invalid HTTPS snapshot source');
  return { token, url: url.href };
}

export async function createReadOnlySnapshotPool(mysql, primary, config) {
  const pool = mysql.createPool({ ...primary, user: config.user, password: config.password,
    connectionLimit: 4, waitForConnections: false });
  let connection;
  try {
    connection = await pool.getConnection();
    const [[identity]] = await connection.query('SELECT DATABASE() AS db');
    if (identity.db !== 'railway') throw new Error('Snapshot source requires production database');
    const [rows] = await connection.query('SHOW GRANTS FOR CURRENT_USER');
    const granted = new Set();
    for (const row of rows) {
      const grant = Object.values(row)[0];
      if (/^GRANT USAGE ON \*\.\* TO /i.test(grant) && !/WITH GRANT OPTION/i.test(grant)) continue;
      const match = /^GRANT SELECT ON `railway`\.`(recruiter_tracker|weekly_reports|report_job_contacts)` TO (?:`[^`]+`|'[^']+')@(?:`[^`]+`|'[^']+')$/i.exec(grant);
      if (!match) throw new Error('Snapshot source grants exceed read-only table allowlist');
      granted.add(match[1].toLowerCase());
    }
    if (granted.size !== 3) throw new Error('Snapshot source needs SELECT on all three tables');
    const [tables] = await connection.query(
      "SELECT TABLE_NAME, ENGINE FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('recruiter_tracker', 'weekly_reports', 'report_job_contacts')");
    if (tables.length !== 3 || tables.some(table => String(table.ENGINE).toUpperCase() !== 'INNODB')) {
      throw new Error('All snapshot source tables must use InnoDB');
    }
    return pool;
  } catch (error) { connection?.release(); connection = null; await pool.end(); throw error; }
  finally { connection?.release(); }
}

export async function captureSnapshot(pool, now = () => new Date()) {
  const connection = await pool.getConnection();
  const deadline = setTimeout(() => connection.destroy(), 10000);
  deadline.unref();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const capturedAt = now().toISOString();
    const [contacts] = await connection.query(
      'SELECT ' + CONTACT_FIELDS.join(', ') + ' FROM recruiter_tracker ORDER BY id DESC LIMIT 50001');
    const [reports] = await connection.query(
      'SELECT ' + REPORT_FIELDS.join(', ') + ' FROM weekly_reports ORDER BY week_start DESC, id DESC LIMIT 50001');
    const [links] = await connection.query(SNAPSHOT_LINKS_SQL);
    if ([contacts, reports, links].some(rows => rows.length > 50000)) throw new Error('Snapshot row limit exceeded');
    const snapshot = protectSnapshot({ capturedAt, contacts, reports, links });
    if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_BYTES) throw new Error('Snapshot exceeds limit');
    return snapshot;
  } finally {
    try { await connection.rollback(); } finally { clearTimeout(deadline); connection.release(); }
  }
}

export function createSnapshotSource({ pool, token, capture = captureSnapshot }) {
  let active = 0;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const expected = Buffer.from('Bearer ' + token);
    const received = Buffer.from(req.headers.authorization || '');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (active >= 4) return res.status(503).json({ error: 'Snapshot source busy' });
    active++;
    try { return res.json(await capture(pool)); }
    catch { return res.status(503).json({ error: 'Snapshot capture unavailable' }); }
    finally { active--; }
  };
}

export async function fetchSnapshot(config, request = fetch) {
  const response = await request(config.url, {
    headers: { Authorization: 'Bearer ' + config.token },
    redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store'
  });
  if (!response.ok) throw new Error('Snapshot source unavailable');
  // Bound streamed responses, including sources without Content-Length.
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Snapshot exceeds limit');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (raw.schemaVersion !== 1 || !Number.isFinite(Date.parse(raw.capturedAt)) ||
      !Array.isArray(raw.contacts) || !Array.isArray(raw.reports) || !Array.isArray(raw.links)) {
    throw new Error('Invalid snapshot');
  }
  return protectSnapshot(raw);
}

export function createGuestSnapshots({ load, now = Date.now, ttl = TTL, maxBytes = 64 * 1024 * 1024, maxSessions = 100 }) {
  const entries = new Map();
  const pending = new Map();
  let bytes = 0;
  const drop = id => {
    const capture = pending.get(id);
    if (capture) capture.cancelled = true;
    const entry = entries.get(id);
    if (entry) { bytes -= entry.size; entries.delete(id); }
  };
  const sweep = () => {
    for (const [id, entry] of entries) if (now() >= entry.expiresAt) drop(id);
  };
  return {
    drop,
    async enter(id) {
      sweep();
      if (entries.has(id)) return entries.get(id).data;
      if (pending.has(id)) return pending.get(id).task;
      if (entries.size + pending.size >= maxSessions) throw new Error('Snapshot capacity reached');
      const capture = { cancelled: false };
      const task = (async () => {
        const loaded = await load();
        if (capture.cancelled) throw new Error('Snapshot session ended during capture');
        const data = JSON.parse(JSON.stringify(loaded));
        const size = Buffer.byteLength(JSON.stringify(data));
        sweep();
        if (size > MAX_BYTES || bytes + size > maxBytes) throw new Error('Snapshot capacity reached');
        entries.set(id, { data, size, expiresAt: now() + ttl }); bytes += size;
        return data;
      })();
      capture.task = task;
      pending.set(id, capture);
      try { return await task; } finally { pending.delete(id); }
    },
    get(id) {
      sweep();
      return entries.get(id)?.data;
    }
  };
}

function csv(rows, fields) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [fields.map(cell).join(','), ...rows.map(row => fields.map(field => cell(row[field])).join(','))].join('\n');
}

// Installed only in enabled DEMO. Every business read is served here or refused;
// no business read can fall through to the shared DEMO database.
export function snapshotBusinessRead(req, res, next) {
  const snapshot = req.demoSnapshot;
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  const path = req.path.toLowerCase().replace(/\/$/, '');
  if (path === '/api/demo-snapshot') {
    return res.json({ capturedAt: snapshot.capturedAt, expiresAt: req.session.demoSnapshotExpiresAt, source: 'protected-live' });
  }
  if (path === '/api/demo-refresh/latest') return res.json({ snapshot: { capturedAt: snapshot.capturedAt }, refresh: null });
  if (path === '/api/contacts') return res.json(snapshot.contacts);
  if (path === '/api/reports') {
    const seen = new Set();
    return res.json(snapshot.reports.filter(row => {
      const key = String(row.week_start) + ':' + String(row.week_end);
      if (!row.submitted || seen.has(key)) return false;
      seen.add(key); return true;
    }));
  }
  const detail = /^\/api\/reports\/(\d+)$/.exec(path);
  if (detail) {
    const report = snapshot.reports.find(row => String(row.id) === detail[1]);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const ids = new Set(snapshot.links.filter(row => String(row.report_id) === detail[1]).map(row => String(row.recruiter_tracker_id)));
    return res.json({ ...report, employers: snapshot.contacts.filter(row => ids.has(String(row.id))) });
  }
  if (path === '/api/contacts/export') {
    res.type('text/csv'); res.attachment('protected-demo-contacts.csv');
    return res.send(csv(snapshot.contacts, ['id','date_contacted','recruiter_name','company','role_level','role_type','location','comp_range','status','relationship_status']));
  }
  if (path === '/api/companies/search') {
    const q = String(req.query.q || '').trim().toLowerCase();
    return res.json(q.length < 2 ? [] : [...new Set(snapshot.contacts.map(row => row.company).filter(name => name && name.toLowerCase().includes(q)))].sort().slice(0,10));
  }
  if (path === '/api/companies/details') {
    const company = String(req.query.company || '').trim();
    if (!company) return res.status(400).json({ error: 'Company is required.' });
    const contact = snapshot.contacts.find(row => String(row.company || '').trim() === company);
    return contact ? res.json(contact) : res.status(404).json({ error: 'No company record found.' });
  }
  if (path.startsWith('/api/companies/') || path.startsWith('/api/contacts/') || path.startsWith('/api/reports/')) {
    return res.status(403).json({ error: 'This view is unavailable in DEMO.' });
  }
  next();
}
