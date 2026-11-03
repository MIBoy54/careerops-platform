// Refresh replaces only this browser's protected guest snapshot.
export async function installDemoViewRefresh({ environment, getSelectionCount, onRefreshed }) {
  if (environment !== 'demo') return;
  const panel = document.getElementById('prodViewControls');
  const button = document.getElementById('refreshProdView');
  const timestamp = document.getElementById('prodViewCapturedAt');
  const message = document.getElementById('prodViewMessage');
  if (!panel || !button || !timestamp || !message) return;
  let expiryTimer;
  let busy = false;
  let expiresAt = 0;
  const expire = () => {
    if (busy || !expiresAt || Date.now() < expiresAt) return;
    button.textContent = 'Load latest PROD view';
    message.textContent = 'This view has expired. Load the latest PROD data to continue.';
  };
  try {
    const identityResponse = await fetch('/version', { cache: 'no-store' });
    if (!identityResponse.ok) return;
    const identity = await identityResponse.json();
    if (identity.environment !== 'demo' || identity.demoEntrySnapshots !== true) return;
    panel.hidden = false;
    const metadataResponse = await fetch('/api/demo-snapshot', { cache: 'no-store' });
    if (!metadataResponse.ok) throw new Error('Snapshot unavailable');
    const metadata = await metadataResponse.json();
    const capturedAt = new Date(metadata.capturedAt);
    expiresAt = Date.parse(metadata.expiresAt);
    if (!Number.isFinite(capturedAt.valueOf()) || !Number.isFinite(expiresAt)) throw new Error('Invalid snapshot metadata');
    timestamp.dateTime = capturedAt.toISOString();
    timestamp.textContent = capturedAt.toLocaleString(undefined, { timeZoneName: 'short' });
    expiryTimer = setTimeout(expire, Math.max(0, expiresAt - Date.now()));
    document.addEventListener('visibilitychange', expire);
    expire();
  } catch {
    timestamp.textContent = 'Unavailable';
    button.textContent = 'Load latest PROD view';
    message.textContent = 'Your view is unavailable. Load the latest PROD data to continue.';
  }
  if (panel.hidden) return;
  button.addEventListener('click', async () => {
    if (busy) return;
    if (getSelectionCount() > 0 && !window.confirm('Refreshing clears your selected records and filters. Load the latest PROD view?')) return;
    busy = true;
    button.disabled = true;
    panel.setAttribute('aria-busy', 'true');
    message.textContent = 'Loading the latest protected PROD data…';
    try {
      const response = await fetch('/api/demo-snapshot/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Capture unavailable');
      const result = await response.json();
      if (result.app_env !== 'demo' || result.user?.role !== 'guest' || !Number.isFinite(Date.parse(result.snapshot?.capturedAt))) throw new Error('Invalid guest snapshot');
      clearTimeout(expiryTimer);
      onRefreshed();
    } catch {
      // Failed capture invalidates the old session; offer an explicit retry.
      message.textContent = 'A fresh PROD view is unavailable. Your displayed data has not refreshed. Please try again.';
      button.textContent = 'Load latest PROD view';
      busy = false;
      button.disabled = false;
      panel.removeAttribute('aria-busy');
    }
  });
}
