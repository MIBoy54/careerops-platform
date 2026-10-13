export function renderSessionTrend(chart, report, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (!report || !Array.isArray(report.buckets) || report.buckets.length !== 12) {
    throw new Error('Invalid session trend response');
  }
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZoneName: 'short'
  });
  const label = value => format.format(new Date(value));
  const max = Math.max(1, ...report.buckets.map(bucket => bucket.sessions));
  const total = report.buckets.reduce((sum, bucket) => sum + bucket.sessions, 0);
  chart.replaceChildren();
  const heading = document.createElement('p');
  heading.className = 'trend-window';
  heading.textContent = `${label(report.window_start)} – Now (${label(report.window_end)}). Unique sessions started; two-hour intervals.`;
  chart.appendChild(heading);
  const plot = document.createElement('div');
  plot.className = 'trend-plot';
  plot.setAttribute('role', 'list');
  plot.setAttribute('aria-label', 'Sessions started in each two-hour interval');
  report.buckets.forEach(bucket => {
    const wrap = document.createElement('div');
    wrap.className = 'trend-bar-wrap';
    wrap.setAttribute('role', 'listitem');
    const range = `${label(bucket.start)} – ${label(bucket.end)}`;
    wrap.setAttribute('aria-label', `${range}: ${bucket.sessions} sessions`);
    const value = document.createElement('div');
    value.className = 'trend-value';
    value.textContent = String(bucket.sessions);
    const track = document.createElement('div');
    track.className = 'trend-bar-track';
    const bar = document.createElement('div');
    bar.className = 'trend-bar';
    bar.style.height = `${bucket.sessions / max * 100}%`;
    bar.title = `${range}: ${bucket.sessions} sessions`;
    track.appendChild(bar);
    const text = document.createElement('div');
    text.className = 'trend-label';
    text.textContent = label(bucket.start);
    wrap.append(value, track, text);
    plot.appendChild(wrap);
  });
  chart.appendChild(plot);
  const status = document.createElement('p');
  status.className = 'trend-status';
  status.setAttribute('role', 'status');
  status.textContent = total === 0 ? 'No sessions started during this reporting window.' : `${total} unique sessions started in the last 24 hours.`;
  chart.appendChild(status);
}

export function createSessionTrendLoader(chart, fetchReport = () => fetch('/api/analytics/session-trend', { cache: 'no-store' })) {
  let loading = false;
  return async () => {
    if (!chart || loading) return;
    loading = true;
    chart.setAttribute('aria-busy', 'true');
    const status = document.createElement('p');
    status.className = 'trend-status';
    status.setAttribute('role', 'status');
    status.textContent = 'Loading session activity…';
    chart.replaceChildren(status);
    try {
      const response = await fetchReport();
      if (!response.ok) throw new Error('Session trend request failed');
      renderSessionTrend(chart, await response.json());
    } catch (error) {
      status.setAttribute('role', 'alert');
      status.textContent = 'Session activity is unavailable. It will retry automatically on the next refresh.';
      chart.replaceChildren(status);
      console.error('Analytics trend load failed:', error);
    } finally {
      chart.setAttribute('aria-busy', 'false');
      loading = false;
    }
  };
}
